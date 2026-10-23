from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Credentials(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=12, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip()
        if normalized.count("@") != 1 or "." not in normalized.rsplit("@", 1)[1]:
            raise ValueError("Enter a valid email address.")
        return normalized


class AuthResponse(BaseModel):
    user: dict[str, str]
    csrf_token: str


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    target_role: str | None = Field(None, max_length=160)
    skills: list[dict[str, Any]] = Field(default_factory=list, max_length=100)
    experience_years: float | None = Field(None, ge=0, le=50)
    education: str | None = Field(None, max_length=160)


class LessonCompletionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["not_started", "in_progress", "completed"]
    item_type: Literal["pathway_step", "course"] = "pathway_step"
    title: str = Field(min_length=1, max_length=500)
    # Retained for request compatibility; the server never uses client skill claims as evidence.
    skills: list[str] = Field(default_factory=list, max_length=30)

    @field_validator("title")
    @classmethod
    def trim_title(cls, value: str) -> str:
        return value.strip()


class LessonCompletionResponse(BaseModel):
    item_id: str
    item_type: str
    title: str
    status: str
    completed: bool
    completed_at: str | None
    evidence_type: str
    mapping_status: Literal["verified", "no verified mapping"]
    mapped_skills: list[str]
    unmapped_skills: list[str]
    evidence_sources: list[dict[str, str]]
    roadmap_error: str | None = None


class RoadmapResponse(BaseModel):
    version: int
    target_role: str
    change_reason: str
    evidence_score: dict[str, Any]
    items: list[dict[str, Any]]
    unresolved_skill_gaps: list[str]
