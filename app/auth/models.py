from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    email_normalized: Mapped[str] = mapped_column(String(320), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    disabled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    profile: Mapped[Optional["LearnerProfile"]] = relationship(back_populates="user", uselist=False)


class RefreshSession(Base):
    __tablename__ = "refresh_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    family_id: Mapped[str] = mapped_column(String(36), nullable=False)
    csrf_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship()

    __table_args__ = (Index("ix_refresh_sessions_user_expiry", "user_id", "expires_at"),)


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("refresh_sessions.id", ondelete="CASCADE"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


class AuthAttempt(Base):
    __tablename__ = "auth_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    attempted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (Index("ix_auth_attempts_fingerprint_time", "fingerprint", "attempted_at"),)


class LearnerProfile(Base):
    __tablename__ = "learner_profiles"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    target_role: Mapped[Optional[str]] = mapped_column(String(160))
    profile_data: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    user: Mapped[User] = relationship(back_populates="profile")


class LessonCompletion(Base):
    __tablename__ = "lesson_completions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    item_id: Mapped[str] = mapped_column(String(240), nullable=False)
    item_type: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    canonical_skills: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    unmapped_skills: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    evidence_sources: Mapped[list[dict[str, str]]] = mapped_column(JSON, nullable=False, default=list)
    learning_status: Mapped[str] = mapped_column(String(20), nullable=False, default="not_started")
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    evidence_type: Mapped[str] = mapped_column(String(40), nullable=False, default="progress_status")

    __table_args__ = (
        UniqueConstraint("user_id", "item_id", name="uq_lesson_completion_user_item"),
        Index("ix_lesson_completions_user_status", "user_id", "completed_at"),
        CheckConstraint(
            "learning_status IN ('not_started', 'in_progress', 'completed')",
            name="ck_lesson_completion_status",
        ),
        CheckConstraint(
            "item_type IN ('pathway_step', 'course')",
            name="ck_lesson_completion_item_type",
        ),
    )


class RoadmapSnapshot(Base):
    __tablename__ = "roadmap_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    target_role: Mapped[str] = mapped_column(String(160), nullable=False)
    fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    change_reason: Mapped[str] = mapped_column(Text, nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "version", name="uq_roadmap_user_version"),
        Index("ix_roadmap_user_active", "user_id", "active"),
        Index(
            "uq_roadmap_one_active_per_user",
            "user_id",
            unique=True,
            postgresql_where=active.is_(True),
            sqlite_where=active.is_(True),
        ),
    )
