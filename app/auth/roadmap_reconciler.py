import hashlib
import json
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.auth.models import LearnerProfile, LessonCompletion, RoadmapSnapshot
from app.auth.security import utc_now


def reconcile_roadmap(db: Session, user_id: str, profile: LearnerProfile) -> dict:
    from app.api import analyzer, config, course_recommender, role_matcher

    profile = db.query(LearnerProfile).filter(
        LearnerProfile.user_id == user_id,
    ).with_for_update().populate_existing().one()
    role = profile.target_role
    if not role:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Choose a target role before generating a roadmap.")
    if not analyzer.is_data_loaded or analyzer.df is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Job-demand data is not loaded; the roadmap cannot be reconciled.")
    canonical_role = analyzer.validate_role(role)
    role_profiles = role_matcher._get_empirical_role_profiles()
    role_info = role_profiles.get(canonical_role, {})
    if role_info.get("status") != "success":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="There is insufficient Malaysian posting evidence for this target role.")

    profile_skills, _ = role_matcher.normalize_profile_skills([
        item.get("name", "") for item in profile.profile_data.get("skills", []) if isinstance(item, dict)
    ])
    completed_records = db.query(LessonCompletion).filter(
        LessonCompletion.user_id == user_id,
        LessonCompletion.learning_status == "completed",
    ).all()
    completed_skills = sorted({skill for item in completed_records for skill in item.canonical_skills})
    skill_shares = role_info.get("skill_shares", {})
    gaps = role_matcher.gap_analyzer.analyze_gaps(profile_skills, skill_shares)["all_gaps"]
    recommendations_by_skill: dict[str, list[dict]] = {}
    for gap in gaps:
        skill = gap["skill"]
        recommendations_by_skill[skill] = [
            {
                "source_record_id": course["source_record_id"],
                "title": course["course_title"],
                "url": course["course_url"],
                "skills_gained": course.get("skills_gained"),
                "difficulty_level": course.get("difficulty_level"),
                "duration": course.get("duration"),
                "offered_by": course.get("offered_by"),
                "why_recommended": course["why_recommended"],
            }
            for course in course_recommender.retriever.retrieve_for_gap(skill)
        ]

    items = []
    for gap in gaps:
        skill = gap["skill"]
        items.append({
            "item_id": f"skill:{skill.casefold()}",
            "skill": skill,
            "posting_share": gap["empirical_posting_share"],
            "evidence_sample_size": role_info.get("denominator", 0),
            "status": "learning_completed" if skill in completed_skills else "not_started",
            "proficiency_claim": False,
            "courses": recommendations_by_skill.get(skill, []),
        })
    unresolved = sorted(
        gap["skill"] for gap in gaps
        if not recommendations_by_skill.get(gap["skill"])
    )
    gap_skills = {gap["skill"] for gap in gaps}
    completed_gap_skills = sorted(skill for skill in completed_skills if skill in gap_skills)
    evidence_denominator = len(gap_skills)
    evidence_score = {
        "label": "self-reported learning-completion coverage",
        "completed_required_skills": len(completed_gap_skills),
        "required_skills_with_gaps": evidence_denominator,
        "percentage": round(len(completed_gap_skills) / evidence_denominator * 100, 2) if evidence_denominator else 0.0,
        "skills": completed_gap_skills,
        "is_assessed_proficiency": False,
        "does_not_change_role_match_score": True,
    }
    config_hash = config.get_config_hash()
    fingerprint_data = {
        "role": canonical_role,
        "profile_version": profile.version,
        "profile_skills": sorted(profile_skills),
        "completed_gap_skills": completed_gap_skills,
        "job_data_version": config.version,
        "config_hash": config_hash,
        "role_evidence": {
            "denominator": int(role_info.get("denominator", 0)),
            "skill_shares": sorted(
                (str(skill), float(share)) for skill, share in skill_shares.items()
            ),
        },
        "items": [(item["item_id"], [course.get("source_record_id") for course in item["courses"]]) for item in items],
    }
    fingerprint = hashlib.sha256(json.dumps(fingerprint_data, sort_keys=True).encode()).hexdigest()
    previous = db.query(RoadmapSnapshot).filter(
        RoadmapSnapshot.user_id == user_id,
        RoadmapSnapshot.active.is_(True),
    ).one_or_none()
    if previous is not None and previous.fingerprint == fingerprint:
        return previous.payload

    reason_parts = []
    if previous is None:
        reason_parts.append("initial generation")
    else:
        if previous.target_role != canonical_role:
            reason_parts.append("target role changed")
        if previous.payload.get("evidence_score") != evidence_score:
            reason_parts.append("learning evidence changed")
        old_ids = {item.get("item_id") for item in previous.payload.get("items", [])}
        new_ids = {item["item_id"] for item in items}
        if old_ids != new_ids:
            reason_parts.append("empirical skill requirements changed")
        if not reason_parts:
            reason_parts.append("source data or course recommendations changed")
    version = 1 if previous is None else previous.version + 1
    payload = {
        "version": version,
        "target_role": canonical_role,
        "change_reason": "; ".join(reason_parts),
        "evidence_score": evidence_score,
        "items": items,
        "unresolved_skill_gaps": unresolved,
    }
    if previous is not None:
        previous.active = False
    db.add(RoadmapSnapshot(
        id=str(uuid4()),
        user_id=user_id,
        version=version,
        target_role=canonical_role,
        fingerprint=fingerprint,
        change_reason=payload["change_reason"],
        payload=payload,
        active=True,
        created_at=utc_now(),
    ))
    db.commit()
    return payload
