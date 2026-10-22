"""
Pydantic Schemas for Malaysia Tech Workforce Intelligence Platform API.
Defines strict response and request models conforming to documented engineering constraints.
"""

from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Health check response schema."""
    status: str = Field(..., examples=["healthy"])
    service: str = Field(..., examples=["malaysia-workforce-intelligence"])
    version: str = Field(..., examples=["1.0.0"])
    timestamp_utc: str = Field(..., examples=["2026-10-22T02:42:38Z"])
    data_loaded: bool = Field(..., examples=[True])
    total_postings: Optional[int] = Field(None, examples=[63852])
    target_roles_postings: Optional[int] = Field(None, examples=[1553])
    retriever_active: str = Field("tfidf", examples=["tfidf", "dense", "hybrid"])
    embeddings_loaded: bool = Field(False, examples=[True])
    llm_enabled: bool = Field(False, examples=[True])
    llm_reachable: Optional[bool] = Field(None, examples=[True])
    device: str = Field("cpu", examples=["cpu"])
    platform: str = Field("local", examples=["runpod", "local"])


class MetadataResponse(BaseModel):
    """Platform processing and governance metadata schema."""
    pipeline_version: str = Field(..., examples=["1.0.0"])
    config_hash: str = Field(..., examples=["db0b2e8411f3..."])
    data_loaded: bool = Field(..., examples=[True])
    dataset_licenses: Dict[str, str]
    deduplication_policy: Dict[str, Any]
    date_coverage: Optional[Dict[str, Any]] = None
    supported_roles: List[str]


class RoleInfo(BaseModel):
    """Metadata and empirical count for a supported tech role."""
    role: str = Field(..., examples=["Software Engineer / Developer"])
    description: str = Field(..., examples=["Builds and maintains software applications..."])
    priority: int = Field(..., examples=[1])
    eligible_postings_count: int = Field(..., examples=[1326])
    sample_adequacy_status: str = Field(..., examples=["Adequate"])
    sample_size_warning: bool = Field(..., examples=[False])


class RolesListResponse(BaseModel):
    """List of supported roles in the platform."""
    total_roles: int = Field(..., examples=[5])
    roles: List[RoleInfo]


class SkillDemandItem(BaseModel):
    """Employer skill demand metric for a single skill."""
    rank: int = Field(..., examples=[1])
    skill: str = Field(..., examples=["JavaScript"])
    category: str = Field(..., examples=["Programming Languages"])
    mention_count: int = Field(..., examples=[608])
    posting_share: float = Field(..., examples=[0.4585])
    posting_share_percentage: float = Field(..., examples=[45.85])


class SkillDemandResponse(BaseModel):
    """Skill demand ranking for a selected tech role."""
    status: str = Field("success", examples=["success"])
    role: str = Field(..., examples=["Software Engineer / Developer"])
    time_window: str = Field(..., examples=["2023-03 to 2025-05"])
    denominator: int = Field(..., examples=[1326], description="Total eligible deduplicated postings for role and window")
    deduplication_policy: str = Field(..., examples=["job_title, company, location"])
    sample_size_warning: bool = Field(..., examples=[False])
    warning_message: Optional[str] = Field(None, examples=["Small sample size warning if N < 50"])
    skills_count: int = Field(..., examples=[20])
    skills: List[SkillDemandItem]


class InsufficientEvidenceResponse(BaseModel):
    """Structured response when a role has fewer than min_postings_per_role."""
    status: str = Field("insufficient_evidence", examples=["insufficient_evidence"])
    role: str = Field(..., examples=["Quantum Specialist"])
    postings_count: int = Field(..., examples=[12])
    min_postings_required: int = Field(..., examples=[30])
    message: str = Field(..., examples=["Insufficient postings in Malaysian job market data..."])
    deduplication_policy: str = Field(..., examples=["job_title, company, location"])
    skills: List[Any] = Field(default_factory=list)


class MonthlySkillStat(BaseModel):
    skill: str
    mentions: int
    posting_share: float
    posting_share_percentage: float


class MonthlyTrendPoint(BaseModel):
    month: str = Field(..., examples=["2024-03"])
    total_role_postings: int = Field(..., examples=[450])
    sample_size_warning: bool = Field(..., examples=[False])
    skills: List[MonthlySkillStat]


class SkillTrendsResponse(BaseModel):
    """Empirical historical monthly demand trend for a role."""
    status: str = Field("success", examples=["success"])
    role: str = Field(..., examples=["Software Engineer / Developer"])
    time_window: str = Field(..., examples=["2024-02 to 2024-06"])
    months_covered: int = Field(..., examples=[5])
    denominator: int = Field(..., examples=[1326])
    deduplication_policy: str = Field(..., examples=["job_title, company, location"])
    sample_size_warning: bool = Field(..., examples=[False])
    warning_message: Optional[str] = Field(None)
    monthly_trends: List[MonthlyTrendPoint]


class InsufficientDateDataResponse(BaseModel):
    """Returned when historical date coverage fails thresholds."""
    status: str = Field("insufficient_date_data", examples=["insufficient_date_data"])
    role: str = Field(..., examples=["Cloud Engineer"])
    demand_label: str = Field("frequency-based", examples=["frequency-based"])
    reason: str = Field(..., examples=["Fewer than 3 reliable monthly observation periods found..."])
    denominator: int = Field(..., examples=[35])
    deduplication_policy: str = Field(..., examples=["job_title, company, location"])
    sample_size_warning: bool = Field(..., examples=[True])
    warning_message: Optional[str] = Field(None)
    frequency_based_demand: List[SkillDemandItem]


class SkillComparisonItem(BaseModel):
    skill: str
    category: str
    role1_mentions: int
    role1_posting_share: float
    role1_share_percentage: float
    role2_mentions: int
    role2_posting_share: float
    role2_share_percentage: float
    share_difference_percentage: float


class RoleComparisonResponse(BaseModel):
    """Side-by-side comparison of skills between two tech roles."""
    status: str = Field("success", examples=["success"])
    role1: str = Field(..., examples=["Data Engineer"])
    role2: str = Field(..., examples=["Data Scientist"])
    denominator_role1: int = Field(..., examples=[104])
    denominator_role2: int = Field(..., examples=[56])
    deduplication_policy: str = Field(..., examples=["job_title, company, location"])
    sample_size_disparity_warning: bool = Field(..., examples=[False])
    warning_message: Optional[str] = Field(None)
    comparison: List[SkillComparisonItem]
    common_skills: List[str]
    unique_to_role1: List[str]
    unique_to_role2: List[str]


class ErrorDetail(BaseModel):
    error: str
    message: str
    supported_roles: Optional[List[str]] = None


# ==============================================================================
# PART 1 SCHEMAS: Profile Analysis, Role Matching & Learning Roadmaps
# ==============================================================================

class ProfileAnalyzeRequest(BaseModel):
    """Candidate profile skill analysis request."""
    skills: List[str] = Field(..., examples=[["python", "js", "react", "docker"]])
    experience_years: Optional[float] = Field(None, ge=0, le=50, examples=[3.5])
    education: Optional[str] = Field(None, examples=["Bachelor's Degree"])


class ProfileAnalyzeResponse(BaseModel):
    """Normalized profile skills and unrecognized tokens."""
    status: str = Field("success", examples=["success"])
    raw_skills_count: int = Field(..., examples=[4])
    normalized_skills: List[str] = Field(..., examples=[["Python", "JavaScript", "React", "Docker"]])
    unrecognized_skills: List[str] = Field(default_factory=list, examples=[[]])
    experience_years: Optional[float] = Field(None)
    education: Optional[str] = Field(None)


class RolesMatchRequest(BaseModel):
    """Candidate profile for empirical role matching."""
    skills: List[str] = Field(..., examples=[["Python", "SQL", "Pandas"]])
    experience_years: Optional[float] = Field(None, ge=0, le=50, examples=[2.0])
    top_k: Optional[int] = Field(5, ge=1, le=10, examples=[5])
    explain: Optional[str] = Field("template", examples=["template"])


class ScoreComponents(BaseModel):
    skill_coverage: float = Field(..., examples=[0.75])
    tfidf_cosine: float = Field(..., examples=[0.68])
    weights: Dict[str, float] = Field(..., examples=[{"skill_coverage": 0.7, "tfidf_cosine": 0.3}])


class RoleMatchItem(BaseModel):
    role: str = Field(..., examples=["Data Scientist"])
    match_score: float = Field(..., examples=[72.9])
    score_components: ScoreComponents
    evidence_sample_size: int = Field(..., examples=[56])
    sample_size_warning: bool = Field(..., examples=[False])
    warning_message: Optional[str] = Field(None)
    matched_skills: List[Dict[str, Any]]
    matched_skills_count: int
    core_gaps: List[Dict[str, Any]]
    recommended_gaps: List[Dict[str, Any]]
    total_gaps_count: int


class RolesMatchResponse(BaseModel):
    """Empirical role ranking and score breakdown."""
    status: str = Field("success", examples=["success"])
    candidate_profile: Dict[str, Any]
    disclaimer: str = Field(..., examples=["This match score reflects empirical alignment..."])
    total_roles_evaluated: int = Field(..., examples=[5])
    ranked_matches: List[RoleMatchItem]
    insufficient_evidence_roles: List[Dict[str, Any]] = Field(default_factory=list)
    method: str = Field("deterministic_matching", examples=["deterministic_matching"])
    narration: Optional[str] = Field(None, examples=["Based on historical Malaysian job postings..."])
    narration_method: Optional[str] = Field(None, examples=["deterministic_template", "verified_llm_narration"])
    narration_fallback_reason: Optional[str] = Field(None)


class RoadmapGenerateRequest(BaseModel):
    """Request to generate a learning roadmap addressing skill gaps."""
    target_role: str = Field(..., examples=["Data Engineer"])
    current_skills: List[str] = Field(default_factory=list, examples=[["Python"]])
    max_courses: Optional[int] = Field(8, ge=1, le=20, examples=[8])
    explain: Optional[str] = Field("template", examples=["template"])


class RecommendedCourseItem(BaseModel):
    step_number: int = Field(..., examples=[1])
    source_record_id: str = Field(..., examples=["coursera_45"])
    course_title: str = Field(..., examples=["SQL for Data Science"])
    course_url: str = Field(..., examples=["https://www.coursera.org/learn/sql-for-data-science"])
    gap_addressed: str = Field(..., examples=["SQL"])
    why_recommended: str = Field(..., examples=["Directly addresses your skill gap in 'SQL'..."])
    skills_gained: Optional[str] = Field(None)
    difficulty_level: str = Field(..., examples=["Beginner level"])
    rating: Optional[float] = Field(None, examples=[4.6])
    duration: Optional[str] = Field(None, examples=["Approx. 14 hours to complete"])
    offered_by: Optional[str] = Field(None, examples=["University of California, Davis"])
    relevance_score: float = Field(..., examples=[9.5])


class SDGAlignmentItem(BaseModel):
    sdg_number: int = Field(..., examples=[8])
    target: str = Field(..., examples=["8.5"])
    sdg_title: str = Field(..., examples=["Decent Work and Economic Growth"])
    rationale: str = Field(..., examples=["Fosters productive employment..."])
    sources: List[str]
    mapping_type: str = Field("documented_mapping", examples=["documented_mapping"])
    measured_impact: bool = Field(False, examples=[False])


class RoadmapGenerateResponse(BaseModel):
    """Personalized learning pathway with verified Coursera courses and SDG alignment."""
    status: str = Field("success", examples=["success"])
    target_role: str = Field(..., examples=["Data Engineer"])
    evidence_sample_size: int = Field(..., examples=[104])
    total_gaps_identified: int = Field(..., examples=[4])
    ordered_pathway: List[RecommendedCourseItem]
    unresolved_skill_gaps: List[str] = Field(default_factory=list)
    pathway_ordering_label: str = Field("heuristic, not a validated sequence")
    ordering_disclaimer: str
    sdg_alignments: List[SDGAlignmentItem]
    sdg_disclaimer: str
    method: str = Field("deterministic_recommender", examples=["deterministic_recommender"])
    narration: Optional[str] = Field(None, examples=["This learning roadmap identifies..."])
    narration_method: Optional[str] = Field(None, examples=["deterministic_template", "verified_llm_narration"])
    narration_fallback_reason: Optional[str] = Field(None)


# ==============================================================================
# PDF RESUME UPLOAD SCHEMAS
# ==============================================================================

class ResumeUploadResponse(BaseModel):
    """Structured candidate profile extracted from uploaded PDF resume."""
    status: str = Field("success", examples=["success"])
    filename: str = Field(..., examples=["resume_candidate.pdf"])
    page_count: int = Field(..., examples=[2])
    text_length: int = Field(..., examples=[1850])
    extracted_skills: List[str] = Field(..., examples=[["Python", "SQL", "Docker", "AWS"]])
    skill_evidence: Dict[str, List[str]] = Field(
        ...,
        examples=[{"Python": ["Python", "py"], "SQL": ["SQL"]}]
    )
    skill_count: int = Field(..., examples=[4])
    experience_years: Optional[float] = Field(None, examples=[3.5])
    detected_education: Optional[str] = Field(None, examples=["Bachelor's Degree"])
    warning: Optional[str] = Field(None)


class SkillGapItem(BaseModel):
    """Details for a skill in gap or match analysis."""
    skill: str = Field(..., examples=["Python"])
    category: str = Field(..., examples=["Programming Languages"])
    empirical_posting_share: float = Field(..., examples=[0.5385])
    posting_share_percentage: float = Field(..., examples=[53.85])


class SkillsGapRequest(BaseModel):
    """Request for skill gap analysis against a target role."""
    target_role: str = Field(..., examples=["Data Engineer"])
    current_skills: List[str] = Field(default_factory=list, examples=[["Python", "SQL"]])
    experience_years: Optional[float] = Field(None, ge=0, le=50, examples=[2.0])


class SkillsGapResponse(BaseModel):
    """Empirical skill gap analysis for a target tech role."""
    status: str = Field("success", examples=["success"])
    target_role: str = Field(..., examples=["Data Engineer"])
    evidence_sample_size: int = Field(..., examples=[104])
    sample_size_warning: bool = Field(..., examples=[False])
    warning_message: Optional[str] = Field(None)
    candidate_skills: List[str]
    matched_skills: List[SkillGapItem]
    matched_skills_count: int
    core_gaps: List[SkillGapItem]
    core_gaps_count: int
    recommended_gaps: List[SkillGapItem]
    recommended_gaps_count: int
    optional_gaps: List[SkillGapItem]
    optional_gaps_count: int
    total_gaps_count: int
    coverage_percentage: float = Field(..., examples=[66.7], description="Percentage of role's core and recommended skills matched")
    method: str = Field("deterministic_skill_gap", examples=["deterministic_skill_gap"])


class SkillsGapResumeResponse(BaseModel):
    """Empirical skill gap analysis extracted directly from uploaded PDF resume."""
    status: str = Field("success", examples=["success"])
    target_role: str = Field(..., examples=["Data Engineer"])
    filename: str = Field(..., examples=["candidate_resume.pdf"])
    page_count: int = Field(..., examples=[2])
    evidence_sample_size: int = Field(..., examples=[104])
    sample_size_warning: bool = Field(..., examples=[False])
    warning_message: Optional[str] = Field(None)
    extracted_skills: List[str]
    skill_evidence: Dict[str, List[str]]
    experience_years: Optional[float] = Field(None)
    detected_education: Optional[str] = Field(None)
    matched_skills: List[SkillGapItem]
    matched_skills_count: int
    core_gaps: List[SkillGapItem]
    core_gaps_count: int
    recommended_gaps: List[SkillGapItem]
    recommended_gaps_count: int
    optional_gaps: List[SkillGapItem]
    optional_gaps_count: int
    total_gaps_count: int
    coverage_percentage: float = Field(..., examples=[66.7], description="Percentage of role's core and recommended skills matched")
    method: str = Field("deterministic_skill_gap_from_resume", examples=["deterministic_skill_gap_from_resume"])


class ProfileParseRequest(BaseModel):
    """Raw candidate profile / bio text for LLM extraction."""
    raw_text: str = Field(..., examples=["Experienced software engineer with 4 years building APIs in Python and deploying with Docker."])


class ProfileParseResponse(BaseModel):
    """Structured candidate profile extracted and verified by post-extraction gate."""
    status: str = Field("success", examples=["success"])
    method: str = Field(..., examples=["llm_extraction_verified", "dictionary_fallback"])
    fallback_reason: Optional[str] = Field(None, examples=[None, "prompt_injection_attempt_detected"])
    skills: List[str] = Field(..., examples=[["Docker", "Python"]])
    skill_evidence: Dict[str, List[str]] = Field(..., examples=[{"Python": ["Python"], "Docker": ["Docker"]}])
    experience_years: Optional[float] = Field(None, examples=[4.0])
    education: Optional[str] = Field(None, examples=["Bachelor's Degree"])
    latency_ms: float = Field(..., examples=[125.4])
    privacy_note: str = Field(..., examples=["Profile data is processed in-memory for extraction only and is not persisted or used for training."])




