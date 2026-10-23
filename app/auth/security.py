import base64
import hashlib
import hmac
import json
import os
import secrets
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from fastapi import HTTPException, Request, status
from sqlalchemy.orm import Session

from app.auth.models import RefreshSession, RefreshToken, User

password_hasher = PasswordHasher()
ACCESS_TOKEN_SECONDS = 900
REFRESH_TOKEN_DAYS = 30


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def is_expired(value: datetime, now: datetime | None = None) -> bool:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value <= (now or utc_now())


def _signing_key() -> bytes:
    value = os.environ.get("AUTH_SIGNING_KEY", "")
    if len(value) < 32:
        value = "malaysia-workforce-platform-dev-signing-secret-key-32b-minimum"
    return value.encode("utf-8")


def hash_token(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def create_access_token(user_id: str, session_id: str) -> str:
    payload = json.dumps(
        {"sub": user_id, "sid": session_id, "exp": int((utc_now() + timedelta(seconds=ACCESS_TOKEN_SECONDS)).timestamp())},
        separators=(",", ":"),
    ).encode("utf-8")
    encoded = base64.urlsafe_b64encode(payload).rstrip(b"=")
    signature = hmac.new(_signing_key(), encoded, hashlib.sha256).digest()
    return encoded.decode("ascii") + "." + base64.urlsafe_b64encode(signature).rstrip(b"=").decode("ascii")


def _decode_access_token(token: str) -> dict[str, str]:
    try:
        encoded, signature = token.split(".", 1)
        expected = hmac.new(_signing_key(), encoded.encode("ascii"), hashlib.sha256).digest()
        supplied = base64.urlsafe_b64decode(signature + "=" * (-len(signature) % 4))
        if not hmac.compare_digest(expected, supplied):
            raise ValueError("Invalid token signature.")
        payload = base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))
        claims = json.loads(payload)
        if int(claims["exp"]) <= int(utc_now().timestamp()):
            raise ValueError("Expired token.")
        if not all(isinstance(claims[key], str) for key in ("sub", "sid")):
            raise ValueError("Invalid token claims.")
        return {"sub": claims["sub"], "sid": claims["sid"]}
    except HTTPException:
        raise
    except (ValueError, TypeError, KeyError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session.") from exc


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return password_hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def create_session(db: Session, user: User) -> tuple[RefreshSession, str, str]:
    now = utc_now()
    session = RefreshSession(
        id=str(uuid4()),
        user_id=user.id,
        family_id=str(uuid4()),
        csrf_hash="",
        created_at=now,
        expires_at=now + timedelta(days=REFRESH_TOKEN_DAYS),
    )
    refresh_token = secrets.token_urlsafe(48)
    csrf_token = secrets.token_urlsafe(32)
    session.csrf_hash = hash_token(csrf_token)
    db.add(session)
    db.flush()
    db.add(RefreshToken(
        session_id=session.id,
        token_hash=hash_token(refresh_token),
        created_at=now,
    ))
    return session, refresh_token, csrf_token


def current_user(request: Request, db: Session) -> tuple[User, RefreshSession]:
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    claims = _decode_access_token(token)
    session = db.get(RefreshSession, claims["sid"])
    user = db.get(User, claims["sub"])
    now = utc_now()
    if (
        session is None
        or user is None
        or session.user_id != user.id
        or session.revoked_at is not None
        or is_expired(session.expires_at, now)
        or user.disabled_at is not None
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session.")
    return user, session


def verify_csrf(request: Request, session: RefreshSession, csrf_header: str | None) -> None:
    if not csrf_header or not hmac.compare_digest(hash_token(csrf_header), session.csrf_hash):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF token is missing or invalid.")


def refresh_session(db: Session, token: str, csrf_token: str) -> tuple[User, RefreshSession, str, str]:
    token_hash = hash_token(token)
    token_record = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).with_for_update().one_or_none()
    if token_record is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh session.")
    session = db.query(RefreshSession).filter(RefreshSession.id == token_record.session_id).with_for_update().one()
    now = utc_now()
    if token_record.used_at is not None:
        db.query(RefreshSession).filter(RefreshSession.family_id == session.family_id).update(
            {RefreshSession.revoked_at: now}, synchronize_session=False
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh-token reuse detected; sign in again.")
    if (
        session.revoked_at is not None
        or is_expired(session.expires_at, now)
        or not hmac.compare_digest(hash_token(csrf_token), session.csrf_hash)
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh session.")
    user = db.get(User, session.user_id)
    if user is None or user.disabled_at is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh session.")

    token_record.used_at = now
    new_refresh = secrets.token_urlsafe(48)
    new_csrf = secrets.token_urlsafe(32)
    session.csrf_hash = hash_token(new_csrf)
    db.add(RefreshToken(session_id=session.id, token_hash=hash_token(new_refresh), created_at=now))
    db.commit()
    return user, session, new_refresh, new_csrf
