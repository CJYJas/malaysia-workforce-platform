import hashlib
import os
import re
from datetime import timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.models import AuthAttempt, LearnerProfile, LessonCompletion, RefreshSession, RefreshToken, User
from app.auth.persistence import get_db
from app.auth.roadmap_reconciler import reconcile_roadmap
from app.auth.schemas import AuthResponse, Credentials, LessonCompletionResponse, LessonCompletionUpdate, ProfileUpdate
from app.auth.security import (
    REFRESH_TOKEN_DAYS, create_access_token, create_session, current_user,
    hash_token, is_expired, password_hasher, refresh_session, utc_now, verify_csrf, verify_password,
)
from app.skill_normalizer import SkillNormalizer

_normalizer: SkillNormalizer | None = None
RATE_LIMIT_WINDOW_MINUTES = 15
RATE_LIMIT_MAX_ATTEMPTS = 10
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
SKILL_TAG_SEPARATOR = re.compile(r"[,;|]")
SKILL_SLUG_SEPARATOR = re.compile(r"[^a-z0-9]+")


def _ensure_enabled() -> None:
    if os.environ.get("AUTH_ENABLED", "false").strip().lower() not in ("true", "1", "yes"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account features are disabled.")


router = APIRouter(dependencies=[Depends(_ensure_enabled)])


def _check_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    allowed = {
        item.strip().rstrip("/")
        for item in os.environ.get(
            "AUTH_ALLOWED_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173",
        ).split(",")
        if item.strip()
    }
    if not origin or origin.rstrip("/") not in allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Request origin is not allowed.")


def _rate_limit(db: Session, request: Request, email: str) -> None:
    now = utc_now()
    for value in (email, request.client.host if request.client else "unknown"):
        fingerprint = hashlib.sha256(value.casefold().encode("utf-8")).hexdigest()
        db.add(AuthAttempt(fingerprint=fingerprint, attempted_at=now))
        count = db.query(func.count(AuthAttempt.id)).filter(
            AuthAttempt.fingerprint == fingerprint,
            AuthAttempt.attempted_at >= now - timedelta(minutes=RATE_LIMIT_WINDOW_MINUTES),
        ).scalar()
        if count > RATE_LIMIT_MAX_ATTEMPTS:
            db.rollback()
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many authentication attempts. Try again later.")
    db.commit()


def _cookies(response: Response, session_id: str, user_id: str, refresh_token: str, csrf_token: str) -> None:
    secure = os.environ.get("AUTH_COOKIE_SECURE", "true").strip().lower() not in ("false", "0", "no")
    response.set_cookie(
        "access_token", create_access_token(user_id, session_id),
        max_age=900, httponly=True, secure=secure, samesite="lax", path="/",
    )
    response.set_cookie(
        "refresh_token", refresh_token,
        max_age=REFRESH_TOKEN_DAYS * 24 * 60 * 60, httponly=True, secure=secure, samesite="lax", path="/",
    )
    response.set_cookie(
        "csrf_token", csrf_token,
        max_age=REFRESH_TOKEN_DAYS * 24 * 60 * 60, httponly=False, secure=secure, samesite="lax", path="/",
    )


def _clear_cookies(response: Response) -> None:
    secure = os.environ.get("AUTH_COOKIE_SECURE", "true").strip().lower() not in ("false", "0", "no")
    for name in ("access_token", "refresh_token", "csrf_token"):
        response.delete_cookie(name, path="/", secure=secure, httponly=name != "csrf_token", samesite="lax")


def _user_payload(user: User) -> dict[str, str]:
    return {"id": user.id, "email": user.email}


def _current(request: Request, db: Session = Depends(get_db)) -> tuple[User, RefreshSession]:
    _ensure_enabled()
    return current_user(request, db)


def _authenticated_csrf(request: Request, db: Session, csrf_header: str | None) -> tuple[User, RefreshSession]:
    _ensure_enabled()
    user, session = current_user(request, db)
    verify_csrf(request, session, csrf_header)
    return user, session


def _course_tag_skills(item_id: str, item_type: str) -> tuple[list[str], list[str], list[dict[str, str]]]:
    from app.api import course_recommender

    retriever = getattr(course_recommender, "retriever", None)
    records = getattr(retriever, "records", None)
    if records is None:
        records = getattr(getattr(retriever, "tfidf", None), "records", None)
    if records is None:
        records = getattr(getattr(retriever, "dense", None), "records", None)
    if not isinstance(records, list):
        return [], [], []

    normalizer = _get_skill_normalizer()
    matched_skills: set[str] = set()
    unmapped_tags: set[str] = set()
    sources: set[tuple[str, str, str]] = set()
    for record in records:
        if not isinstance(record, dict):
            continue
        source_record_id = str(record.get("source_record_id", "")).strip()
        if not source_record_id:
            continue
        if item_type == "course" and item_id != source_record_id:
            continue
        tags = record.get("skills_gained")
        if not isinstance(tags, str) or not tags.strip():
            continue
        for raw_tag in SKILL_TAG_SEPARATOR.split(tags):
            tag = raw_tag.strip()
            if not tag:
                continue
            canonical = normalizer.normalize(tag)
            if canonical is None:
                if item_type == "course" and item_id == source_record_id:
                    unmapped_tags.add(tag)
                continue
            if item_type == "pathway_step":
                slug = SKILL_SLUG_SEPARATOR.sub("-", canonical.casefold()).strip("-")
                if item_id != f"step-{slug}":
                    continue
            matched_skills.add(canonical)
            sources.add((canonical, source_record_id, tag))

    evidence_sources = [
        {
            "canonical_skill": skill,
            "source_record_id": record_id,
            "skill_tag": tag,
        }
        for skill, record_id, tag in sorted(sources)
    ]
    return sorted(matched_skills), sorted(unmapped_tags), evidence_sources


def _get_skill_normalizer() -> SkillNormalizer:
    global _normalizer
    if _normalizer is None:
        _normalizer = SkillNormalizer()
    return _normalizer


def _completion_response(item: LessonCompletion) -> LessonCompletionResponse:
    completed_at = item.completed_at
    if completed_at is not None:
        if completed_at.tzinfo is None:
            completed_at = completed_at.replace(tzinfo=timezone.utc)
        completed_at = completed_at.astimezone(timezone.utc)
    return LessonCompletionResponse(
        item_id=item.item_id,
        item_type=item.item_type,
        title=item.title,
        status=item.learning_status,
        completed=item.learning_status == "completed",
        completed_at=completed_at.isoformat() if completed_at else None,
        evidence_type=item.evidence_type,
        mapping_status="verified" if item.canonical_skills else "no verified mapping",
        mapped_skills=item.canonical_skills,
        unmapped_skills=item.unmapped_skills,
        evidence_sources=item.evidence_sources,
    )


@router.post("/auth/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(body: Credentials, request: Request, response: Response, db: Session = Depends(get_db)) -> AuthResponse:
    _ensure_enabled()
    _check_origin(request)
    _rate_limit(db, request, body.email)
    normalized = body.email.strip().casefold()
    if not EMAIL_PATTERN.fullmatch(normalized):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Enter a valid email address.")
    user = User(
        id=str(uuid4()),
        email=body.email.strip(),
        email_normalized=normalized,
        password_hash=password_hasher.hash(body.password),
        created_at=utc_now(),
    )
    db.add(user)
    try:
        db.flush()
        _, refresh_token, csrf_token = create_session(db, user)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.") from exc
    session = db.query(RefreshSession).filter(RefreshSession.user_id == user.id).one()
    _cookies(response, session.id, user.id, refresh_token, csrf_token)
    return AuthResponse(user=_user_payload(user), csrf_token=csrf_token)


@router.post("/auth/login", response_model=AuthResponse)
def login(body: Credentials, request: Request, response: Response, db: Session = Depends(get_db)) -> AuthResponse:
    _ensure_enabled()
    _check_origin(request)
    _rate_limit(db, request, body.email)
    user = db.query(User).filter(User.email_normalized == body.email.strip().casefold()).one_or_none()
    if user is None or user.disabled_at is not None or not verify_password(user.password_hash, body.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")
    session, refresh_token, csrf_token = create_session(db, user)
    db.commit()
    _cookies(response, session.id, user.id, refresh_token, csrf_token)
    return AuthResponse(user=_user_payload(user), csrf_token=csrf_token)


@router.post("/auth/refresh", response_model=AuthResponse)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)) -> AuthResponse:
    _ensure_enabled()
    _check_origin(request)
    token = request.cookies.get("refresh_token")
    csrf_token = request.headers.get("x-csrf-token")
    if not token or not csrf_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh session is missing.")
    user, session, new_refresh, new_csrf = refresh_session(db, token, csrf_token)
    _cookies(response, session.id, user.id, new_refresh, new_csrf)
    return AuthResponse(user=_user_payload(user), csrf_token=new_csrf)


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    csrf_header: str | None = Header(None, alias="X-CSRF-Token"),
) -> Response:
    _ensure_enabled()
    _check_origin(request)
    token = request.cookies.get("refresh_token")
    csrf_token = csrf_header or request.headers.get("x-csrf-token")
    if not token or not csrf_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    token_record = db.query(RefreshToken).filter(
        RefreshToken.token_hash == hash_token(token),
    ).one_or_none()
    if token_record is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session.")
    session = db.query(RefreshSession).filter(
        RefreshSession.id == token_record.session_id,
    ).with_for_update().one_or_none()
    if session is None or session.revoked_at is not None or is_expired(session.expires_at):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session.")
    verify_csrf(request, session, csrf_token)
    session.revoked_at = utc_now()
    db.commit()
    _clear_cookies(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/auth/me")
def get_me(user_session: tuple[User, RefreshSession] = Depends(_current)) -> dict[str, dict[str, str]]:
    user, _ = user_session
    return {"user": _user_payload(user)}


@router.get("/me/profile")
def get_profile(user_session: tuple[User, RefreshSession] = Depends(_current), db: Session = Depends(get_db)) -> dict:
    user, _ = user_session
    profile = db.get(LearnerProfile, user.id)
    if profile is None:
        return {"target_role": None, "profile": {}, "version": 0}
    return {"target_role": profile.target_role, "profile": profile.profile_data, "version": profile.version}


@router.put("/me/profile")
def put_profile(
    body: ProfileUpdate,
    request: Request,
    db: Session = Depends(get_db),
    csrf_header: str | None = Header(None, alias="X-CSRF-Token"),
) -> dict:
    _check_origin(request)
    user, _ = _authenticated_csrf(request, db, csrf_header or request.headers.get("x-csrf-token"))
    target_role = body.target_role.strip() if body.target_role else None
    if target_role:
        from app.api import analyzer
        target_role = analyzer.validate_role(target_role)
    profile = db.get(LearnerProfile, user.id)
    profile_data = {
        "skills": body.skills,
        "experience_years": body.experience_years,
        "education": body.education,
    }
    if profile is None:
        profile = LearnerProfile(
            user_id=user.id,
            target_role=target_role,
            profile_data=profile_data,
            version=1,
            updated_at=utc_now(),
        )
        db.add(profile)
    else:
        if profile.target_role != target_role or profile.profile_data != profile_data:
            profile.target_role = target_role
            profile.profile_data = profile_data
            profile.version += 1
            profile.updated_at = utc_now()
    db.commit()
    roadmap = None
    roadmap_error = None
    if profile.target_role:
        try:
            roadmap = reconcile_roadmap(db, user.id, profile)
        except HTTPException as exc:
            roadmap_error = str(exc.detail)
    return {
        "target_role": profile.target_role,
        "profile": profile.profile_data,
        "version": profile.version,
        "roadmap": roadmap,
        "roadmap_error": roadmap_error,
    }


@router.get("/me/lessons", response_model=list[LessonCompletionResponse])
def get_lessons(user_session: tuple[User, RefreshSession] = Depends(_current), db: Session = Depends(get_db)):
    user, _ = user_session
    records = db.query(LessonCompletion).filter(LessonCompletion.user_id == user.id).order_by(LessonCompletion.updated_at.desc()).all()
    return [_completion_response(item) for item in records]


@router.put("/me/lessons/{item_id}/completion", response_model=LessonCompletionResponse)
def update_lesson_completion(
    item_id: str,
    body: LessonCompletionUpdate,
    request: Request,
    db: Session = Depends(get_db),
    csrf_header: str | None = Header(None, alias="X-CSRF-Token"),
) -> LessonCompletionResponse:
    _check_origin(request)
    if not item_id.strip() or len(item_id) > 240:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid pathway item identifier.")
    user, _ = _authenticated_csrf(request, db, csrf_header or request.headers.get("x-csrf-token"))
    mapped, unmapped, evidence_sources = _course_tag_skills(item_id, body.item_type)
    now = utc_now()
    values = {
        "user_id": user.id,
        "item_id": item_id,
        "item_type": body.item_type,
        "title": body.title,
        "canonical_skills": mapped,
        "unmapped_skills": unmapped,
        "evidence_sources": evidence_sources,
        "learning_status": body.status,
        "completed_at": now if body.status == "completed" else None,
        "updated_at": now,
        "evidence_type": "lesson_completed" if body.status == "completed" else "progress_status",
    }
    dialect = db.get_bind().dialect.name
    if dialect == "sqlite":
        insert = sqlite_insert
    elif dialect == "postgresql":
        insert = postgresql_insert
    else:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Lesson persistence supports SQLite for local use and PostgreSQL for production.",
        )
    statement = insert(LessonCompletion).values(**values)
    completed_at = (
        func.coalesce(LessonCompletion.completed_at, statement.excluded.completed_at)
        if body.status == "completed"
        else None
    )
    statement = statement.on_conflict_do_update(
        index_elements=[LessonCompletion.user_id, LessonCompletion.item_id],
        set_={
            "item_type": statement.excluded.item_type,
            "title": statement.excluded.title,
            "canonical_skills": statement.excluded.canonical_skills,
            "unmapped_skills": statement.excluded.unmapped_skills,
            "evidence_sources": statement.excluded.evidence_sources,
            "learning_status": statement.excluded.learning_status,
            "completed_at": completed_at,
            "updated_at": statement.excluded.updated_at,
            "evidence_type": statement.excluded.evidence_type,
        },
    ).returning(LessonCompletion)
    item = db.execute(statement).scalar_one()
    db.commit()
    profile = db.get(LearnerProfile, user.id)
    roadmap_error = None
    if profile is not None and profile.target_role:
        try:
            reconcile_roadmap(db, user.id, profile)
        except HTTPException as exc:
            db.commit()
            roadmap_error = str(exc.detail)
    else:
        db.commit()
    completion = _completion_response(item)
    completion.roadmap_error = roadmap_error
    return completion


@router.get("/me/skill-evidence")
def get_skill_evidence(user_session: tuple[User, RefreshSession] = Depends(_current), db: Session = Depends(get_db)) -> dict:
    user, _ = user_session
    records = db.query(LessonCompletion).filter(
        LessonCompletion.user_id == user.id,
        LessonCompletion.learning_status == "completed",
    ).all()
    skills: dict[str, list[dict]] = {}
    for record in records:
        for skill in record.canonical_skills:
            skills.setdefault(skill, []).append({
                "source_item_id": record.item_id,
                "source_title": record.title,
                "evidence_type": "lesson_completed",
                "completed_at": _completion_response(record).completed_at,
                "is_assessed_proficiency": False,
                "sources": [
                    source for source in record.evidence_sources
                    if source.get("canonical_skill") == skill
                ],
            })
    return {
        "evidence_type": "lesson_completed",
        "skills": skills,
        "unmapped_items": [
            {
                "item_id": record.item_id,
                "title": record.title,
                "mapping_status": "no verified mapping",
                "skills": record.unmapped_skills,
            }
            for record in records if not record.canonical_skills
        ],
        "note": "Lesson completion is learning evidence, not assessed proficiency and does not change role-match scores.",
    }


@router.get("/me/roadmap")
def get_roadmap(user_session: tuple[User, RefreshSession] = Depends(_current), db: Session = Depends(get_db)) -> dict:
    user, _ = user_session
    profile = db.get(LearnerProfile, user.id)
    if profile is None or not profile.target_role:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Save a target role before requesting a roadmap.")
    return reconcile_roadmap(db, user.id, profile)


@router.post("/me/roadmap/reconcile")
def post_reconcile_roadmap(
    request: Request,
    db: Session = Depends(get_db),
    csrf_header: str | None = Header(None, alias="X-CSRF-Token"),
) -> dict:
    _check_origin(request)
    user, _ = _authenticated_csrf(request, db, csrf_header or request.headers.get("x-csrf-token"))
    profile = db.get(LearnerProfile, user.id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Save a target role before reconciling a roadmap.")
    return reconcile_roadmap(db, user.id, profile)
