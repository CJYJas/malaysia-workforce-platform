"""
FastAPI Application for Malaysia Tech Workforce Intelligence Platform.
Exposes RESTful endpoints for:
- Health check and metadata governance
- Supported tech roles catalog
- Empirical skill demand analysis with explicit denominators and deduplication policy
- Monthly historical demand trends (qualified by data thresholds, no forbidden subjective terms)
- Role-to-role skill comparisons
"""

import os
import json
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Union
from fastapi import FastAPI, Query, HTTPException, status, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import Config, load_config
from app.trend_analyzer import TrendAnalyzer, RoleNotFoundError, DataNotLoadedError
from app.role_matcher import RoleMatcher
from app.course_recommender import CourseRecommender
from app.sdg_mapper import SDGAlignmentMapper
from app.resume_parser import ResumeParser, PDFExtractionError
from app.llm_parser import ProfileParser
from app.llm_narrator import LLMNarrator
from app.schemas import (
    HealthResponse,
    MetadataResponse,
    RolesListResponse,
    SkillDemandResponse,
    InsufficientEvidenceResponse,
    SkillTrendsResponse,
    InsufficientDateDataResponse,
    RoleComparisonResponse,
    ErrorDetail,
    ProfileAnalyzeRequest,
    ProfileAnalyzeResponse,
    RolesMatchRequest,
    RolesMatchResponse,
    RoadmapGenerateRequest,
    RoadmapGenerateResponse,
    ResumeUploadResponse,
    SkillsGapRequest,
    SkillsGapResponse,
    SkillsGapResumeResponse,
    ProfileParseRequest,
    ProfileParseResponse
)

logger = logging.getLogger(__name__)

# Initialize configuration
config = load_config()

# Read CORS origins from environment variable or fallback to config
cors_env = os.environ.get("CORS_ORIGINS")
if cors_env:
    try:
        # Check if valid JSON array
        cors_origins = json.loads(cors_env)
        if not isinstance(cors_origins, list):
            cors_origins = [s.strip() for s in cors_env.split(",") if s.strip()]
    except Exception:
        cors_origins = [s.strip() for s in cors_env.split(",") if s.strip()]
else:
    cors_origins = config.cors_origins_default

# Create FastAPI application
app = FastAPI(
    title="Malaysia Tech Workforce Intelligence Platform API",
    description=(
        "Empirical, data-driven workforce intelligence API analyzing employer skill demand, "
        "historical trends, and skill requirement profiles across Malaysian technology roles."
    ),
    version=config.version,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Attach CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize TrendAnalyzer (starts even if data is not loaded yet)
analyzer = TrendAnalyzer(config=config)


# ==============================================================================
# EXCEPTION HANDLERS
# ==============================================================================

@app.exception_handler(RoleNotFoundError)
async def role_not_found_handler(request, exc: RoleNotFoundError):
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={
            "error": "RoleNotFound",
            "message": f"Role '{exc.role}' is not supported. Please choose from supported roles.",
            "supported_roles": exc.supported_roles
        }
    )


@app.exception_handler(DataNotLoadedError)
async def data_not_loaded_handler(request, exc: DataNotLoadedError):
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "error": "DataNotLoaded",
            "message": (
                "Processed job market data is not loaded yet. "
                "Please run data pipeline (`python -m app.pipeline`) to generate dataset."
            ),
            "data_loaded": False
        }
    )


@app.exception_handler(PDFExtractionError)
async def pdf_extraction_error_handler(request, exc: PDFExtractionError):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "error": "InvalidPDF",
            "message": str(exc)
        }
    )


# ==============================================================================
# ENDPOINTS
# ==============================================================================

@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["System"],
    summary="Service Health Check"
)
async def get_health():
    """
    Returns service health status, API version, timestamp, and whether processed
    job posting data is loaded in memory.
    """
    total_postings = len(analyzer.df) if (analyzer.is_data_loaded and analyzer.df is not None) else None
    target_postings = None
    if analyzer.is_data_loaded and analyzer.df is not None:
        target_roles = analyzer.get_supported_roles()
        target_postings = int(analyzer.df["assigned_role"].isin(target_roles).sum())

    # Active retriever detection
    retriever_name = "tfidf"
    if hasattr(course_recommender, "retriever"):
        ret = course_recommender.retriever
        from app.embeddings import HybridRetriever, EmbeddingRetriever
        if isinstance(ret, HybridRetriever):
            retriever_name = "hybrid"
        elif isinstance(ret, EmbeddingRetriever):
            retriever_name = "dense"

    # Check embeddings on disk or memory
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    emb_path = os.path.join(base_dir, "data", "processed", "v1.0.0", "coursera_embeddings.npy")
    embeddings_loaded = os.path.exists(emb_path)

    llm_enabled = bool(os.environ.get("RUNPOD_API_KEY") or os.environ.get("LLM_ENABLED", "false").lower() in ("true", "1", "yes"))

    llm_reachable = None
    if hasattr(profile_parser, "llm") and hasattr(profile_parser.llm, "is_reachable"):
        llm_reachable = profile_parser.llm.is_reachable()

    platform_type = "runpod" if (os.environ.get("RUNPOD_POD_ID") or os.environ.get("RUNPOD_API_KEY")) else "local"

    return HealthResponse(
        status="healthy",
        service="malaysia-workforce-intelligence",
        version=config.version,
        timestamp_utc=datetime.now(timezone.utc).isoformat(),
        data_loaded=analyzer.is_data_loaded,
        total_postings=total_postings,
        target_roles_postings=target_postings,
        retriever_active=retriever_name,
        embeddings_loaded=embeddings_loaded,
        llm_enabled=llm_enabled,
        llm_reachable=llm_reachable,
        device="cpu",
        platform=platform_type
    )


@app.get(
    "/metadata",
    response_model=MetadataResponse,
    tags=["System"],
    summary="Platform Processing Metadata & Governance"
)
async def get_metadata():
    """
    Returns pipeline version, config hash, dataset licenses, deduplication policy,
    date coverage window, and supported roles list.
    """
    metadata_path = config.latest_metadata_path
    date_coverage = None

    if os.path.exists(metadata_path):
        try:
            with open(metadata_path, "r", encoding="utf-8") as f:
                saved_meta = json.load(f)
                date_coverage = saved_meta.get("date_coverage")
        except Exception as e:
            logger.warning("Could not read metadata file: %s", e)

    return MetadataResponse(
        pipeline_version=config.version,
        config_hash=config.get_config_hash(),
        data_loaded=analyzer.is_data_loaded,
        dataset_licenses=config.dataset_licenses,
        deduplication_policy={
            "key": config.deduplication_key,
            "keep": config.deduplication_keep,
            "rationale": "Deduplicate on job_title, company, and location to eliminate re-advertisements."
        },
        date_coverage=date_coverage,
        supported_roles=analyzer.get_supported_roles()
    )


@app.get(
    "/roles",
    response_model=RolesListResponse,
    tags=["Roles"],
    summary="List Supported Tech Roles"
)
async def get_roles():
    """
    Returns all supported Malaysian tech roles with their descriptions, priorities,
    eligible posting counts, sample adequacy status, and sample size warnings.
    """
    summary = analyzer.get_roles_summary()
    return RolesListResponse(
        total_roles=len(summary),
        roles=summary
    )


@app.get(
    "/skills/demand",
    response_model=Union[SkillDemandResponse, InsufficientEvidenceResponse, RoleComparisonResponse],
    tags=["Skills"],
    summary="Skill Demand for Target Role"
)
async def get_skill_demand(
    role: str = Query(..., description="Target tech role name (e.g. 'Software Engineer / Developer')"),
    top_n: Optional[int] = Query(None, ge=1, le=100, description="Number of top skills to return"),
    window: Optional[str] = Query(None, description="Time window ('all' or 'representative_2024')"),
    compare_with: Optional[str] = Query(None, description="Optional second role name to perform role-to-role comparison")
):
    """
    Calculates employer skill demand metrics for a selected Malaysian tech role.
    
    Formula:
        Skill Posting Share = eligible postings mentioning skill / eligible postings for role and period.
        
    - If `compare_with` is provided, returns side-by-side comparison between the two roles.
    - If postings count < min_postings_per_role, returns a structured insufficient-evidence response.
    - If sample size < sample_size_warning_threshold, includes an explicit sample size warning.
    """
    # If comparison requested via query parameter
    if compare_with:
        return analyzer.compare_roles(role1=role, role2=compare_with, top_n=top_n)

    result = analyzer.calculate_skill_demand(role=role, top_n=top_n, time_window=window)
    return result


@app.get(
    "/skills/trends",
    response_model=Union[SkillTrendsResponse, InsufficientDateDataResponse],
    tags=["Skills"],
    summary="Historical Monthly Demand Trends"
)
async def get_skill_trends(
    role: str = Query(..., description="Target tech role name"),
    skill: Optional[str] = Query(None, description="Optional specific skill name filter"),
    window: Optional[str] = Query(None, description="Optional window ('all' or 'representative_2024')")
):
    """
    Calculates empirical monthly historical demand trends for a role.
    
    - If monthly date coverage does not satisfy min_months_for_trends threshold,
      returns status `insufficient_date_data` with frequency-based static demand.
    - Strictly factual: never uses subjective labels such as 'emerging' or 'fast-growing'.
    """
    result = analyzer.calculate_skill_trends(role=role, skill_filter=skill, window=window)
    return result


@app.get(
    "/skills/compare",
    response_model=RoleComparisonResponse,
    tags=["Skills"],
    summary="Role-to-Role Skill Demand Comparison"
)
async def compare_roles(
    role1: str = Query(..., description="First role name (e.g. 'Data Engineer')"),
    role2: str = Query(..., description="Second role name (e.g. 'Data Scientist')"),
    top_n: Optional[int] = Query(None, ge=1, le=50, description="Top skills to compare")
):
    """
    Performs side-by-side comparison of skill demands between two tech roles.
    Discloses individual role denominators and deduplication policy, and flags
    sample size disparities transparently.
    """
    return analyzer.compare_roles(role1=role1, role2=role2, top_n=top_n)


# ==============================================================================
# PART 1 ENDPOINTS: Profile Analysis, Role Matching, Roadmap Generation
# ==============================================================================

# Core engine instances
role_matcher = RoleMatcher(trend_analyzer=analyzer, config=config, normalizer=analyzer.normalizer)
course_recommender = CourseRecommender(config=config)
sdg_mapper = SDGAlignmentMapper(config=config)
profile_parser = ProfileParser(config=config)
llm_narrator = LLMNarrator(config=config)


@app.post(
    "/profile/analyze",
    response_model=ProfileAnalyzeResponse,
    tags=["Profile"],
    summary="Normalize and Analyze Candidate Profile Skills"
)
async def analyze_profile(request: ProfileAnalyzeRequest):
    """
    Normalizes candidate surface skills to canonical vocabulary terms
    and flags unrecognized tokens.
    """
    canonical_skills, unrecognized = role_matcher.normalize_profile_skills(request.skills)
    return ProfileAnalyzeResponse(
        status="success",
        raw_skills_count=len(request.skills),
        normalized_skills=canonical_skills,
        unrecognized_skills=unrecognized,
        experience_years=request.experience_years,
        education=request.education
    )


@app.post(
    "/profile/parse",
    response_model=ProfileParseResponse,
    tags=["Profile", "AI"],
    summary="Parse Candidate Bio / Profile Text with LLM and Verification Gate"
)
async def parse_profile_text(request: ProfileParseRequest):
    """
    Parses unstructured candidate profile, bio, or resume text with LLM extraction:
    - Pre-redacts all PII (email, phone, NRIC, address).
    - Uses system prompt with strict injection defense.
    - Post-extraction verification gate: rejects non-canonical or hallucinated skills.
    - Bounds experience years to [0, 50].
    - Automatic dictionary fallback on schema error, injection attempt, or timeout.
    - Privacy guarantee: in-memory processing only, never persisted.
    """
    return profile_parser.parse_profile(request.raw_text)


@app.post(
    "/skills/gap",
    response_model=SkillsGapResponse,
    tags=["Skills", "Profile"],
    summary="Analyze Candidate Skill Gaps for a Target Tech Role"
)
async def analyze_skill_gap(request: SkillsGapRequest):
    """
    Analyzes candidate skill gaps against empirical JobStreet posting requirements
    for a specified tech role. Categorizes gaps into core (>= 25%), recommended
    (10% - 25%), and optional (< 10%) skills, and calculates coverage percentage.
    """
    if not analyzer.is_data_loaded or analyzer.df is None:
        raise DataNotLoadedError("Job posting dataset is not loaded.")

    canonical_role = analyzer.validate_role(request.target_role)

    # Normalize user's current skills
    user_skills, _ = role_matcher.normalize_profile_skills(request.current_skills)

    # Get empirical demand profile for the role
    role_profiles = role_matcher._get_empirical_role_profiles()
    profile_info = role_profiles.get(canonical_role, {})

    if profile_info.get("status") == "insufficient_evidence":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role '{canonical_role}' has insufficient postings (N < {config.min_postings_per_role}) for skill gap analysis."
        )

    skill_shares = profile_info.get("skill_shares", {})
    evidence_n = profile_info.get("denominator", 0)
    sample_warning = evidence_n < config.sample_size_warning_threshold
    warning_msg = (
        f"Small sample size (N = {evidence_n} postings). Findings should be interpreted as directional."
        if sample_warning else None
    )

    gap_data = role_matcher.gap_analyzer.analyze_gaps(
        user_skills=user_skills,
        role_skill_shares=skill_shares
    )

    return SkillsGapResponse(
        status="success",
        target_role=canonical_role,
        evidence_sample_size=evidence_n,
        sample_size_warning=sample_warning,
        warning_message=warning_msg,
        candidate_skills=user_skills,
        matched_skills=gap_data["matched_skills"],
        matched_skills_count=gap_data["matched_skills_count"],
        core_gaps=gap_data["core_gaps"],
        core_gaps_count=gap_data["core_gaps_count"],
        recommended_gaps=gap_data["recommended_gaps"],
        recommended_gaps_count=gap_data["recommended_gaps_count"],
        optional_gaps=gap_data["optional_gaps"],
        optional_gaps_count=gap_data["optional_gaps_count"],
        total_gaps_count=gap_data["total_gaps_count"],
        coverage_percentage=gap_data["coverage_percentage"],
        method="deterministic_skill_gap"
    )


@app.post(
    "/roles/match",
    response_model=RolesMatchResponse,
    tags=["Matching"],
    summary="Match Profile to Tech Roles with Explainable Scoring"
)
async def match_roles(request: RolesMatchRequest):
    """
    Ranks target roles for a candidate profile using empirical JobStreet requirement profiles.
    
    - Score is a weighted combination of skill coverage and TF-IDF cosine similarity.
    - Returns score components, matched skills, missing core/recommended gaps, and sample sizes.
    - Accompanied by binding disclaimer (not a hiring probability).
    - Handles sparse or empty profiles gracefully.
    """
    if not analyzer.is_data_loaded or analyzer.df is None:
        raise DataNotLoadedError("Job posting dataset is not loaded.")

    result = role_matcher.match_roles(
        raw_skills=request.skills,
        experience_years=request.experience_years,
        top_k=request.top_k or 5
    )
    narration_info = llm_narrator.narrate_role_match(result, explain_mode=request.explain or "template")
    return RolesMatchResponse(
        status=result["status"],
        candidate_profile=result["candidate_profile"],
        disclaimer=result["disclaimer"],
        total_roles_evaluated=result["total_roles_evaluated"],
        ranked_matches=result["ranked_matches"],
        insufficient_evidence_roles=result.get("insufficient_evidence_roles", []),
        method="deterministic_matching",
        narration=narration_info["narration"],
        narration_method=narration_info["method"],
        narration_fallback_reason=narration_info["fallback_reason"]
    )


@app.post(
    "/roadmap/generate",
    response_model=RoadmapGenerateResponse,
    tags=["Roadmap"],
    summary="Generate Skill-Gap Learning Roadmap with Coursera and SDG Alignments"
)
async def generate_roadmap(request: RoadmapGenerateRequest):
    """
    Identifies empirical skill gaps for a target role, retrieves verified Coursera courses,
    orders recommendations via prerequisite heuristic, and attaches documented UN SDG alignments.
    
    - Coursera records only, traceable to source_record_id and real URLs.
    - Zero fabricated prices or ratings.
    - Unresolved gaps returned explicitly.
    - Pathway ordering labeled as 'heuristic, not a validated sequence'.
    - SDG mapping described as potential documented alignment, never measured impact.
    """
    if not analyzer.is_data_loaded or analyzer.df is None:
        raise DataNotLoadedError("Job posting dataset is not loaded.")

    canonical_role = analyzer.validate_role(request.target_role)

    # Normalize user's current skills
    user_skills, _ = role_matcher.normalize_profile_skills(request.current_skills)

    # Get empirical demand profile for the role
    role_profiles = role_matcher._get_empirical_role_profiles()
    profile_info = role_profiles.get(canonical_role, {})

    if profile_info.get("status") == "insufficient_evidence":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role '{canonical_role}' has insufficient postings (N < {config.min_postings_per_role}) for roadmap generation."
        )

    skill_shares = profile_info.get("skill_shares", {})
    evidence_n = profile_info.get("denominator", 0)

    # Analyze gaps
    gap_data = role_matcher.gap_analyzer.analyze_gaps(
        user_skills=user_skills,
        role_skill_shares=skill_shares
    )
    all_gaps = gap_data["all_gaps"]

    # Recommend courses for gaps
    rec_result = course_recommender.recommend_for_gaps(
        skill_gaps=all_gaps,
        max_total=request.max_courses or 8
    )

    # Retrieve documented SDG alignments
    role_sdg = sdg_mapper.get_role_sdg_alignments(canonical_role)
    upskill_sdg = sdg_mapper.get_skill_remediation_sdg()
    combined_sdg = role_sdg.get("alignments", []) + upskill_sdg.get("alignments", [])

    roadmap_data = {
        "target_role": canonical_role,
        "evidence_sample_size": evidence_n,
        "total_gaps_identified": len(all_gaps),
        "ordered_pathway": rec_result["ordered_pathway"]
    }
    narration_info = llm_narrator.narrate_roadmap(roadmap_data, explain_mode=request.explain or "template")

    return RoadmapGenerateResponse(
        status="success",
        target_role=canonical_role,
        evidence_sample_size=evidence_n,
        total_gaps_identified=len(all_gaps),
        ordered_pathway=rec_result["ordered_pathway"],
        unresolved_skill_gaps=rec_result["unresolved_skill_gaps"],
        pathway_ordering_label=rec_result["pathway_ordering_label"],
        ordering_disclaimer=rec_result["ordering_disclaimer"],
        sdg_alignments=combined_sdg,
        sdg_disclaimer=role_sdg.get("disclaimer", config.sdg_disclaimer),
        method="deterministic_recommender",
        narration=narration_info["narration"],
        narration_method=narration_info["method"],
        narration_fallback_reason=narration_info["fallback_reason"]
    )


# ==============================================================================
# PDF RESUME UPLOAD ENDPOINTS: Role Matching & Skill Gap Remediation
# ==============================================================================

resume_parser = ResumeParser(config=config)


@app.post(
    "/profile/upload-resume",
    response_model=ResumeUploadResponse,
    tags=["Resume"],
    summary="Extract Skills and Experience from PDF Resume"
)
async def upload_resume(file: UploadFile = File(..., description="PDF Resume file")):
    """
    Parses an uploaded PDF resume, extracts candidate skills using canonical taxonomy,
    retains matched text evidence, and detects candidate experience level.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only PDF resume files (.pdf) are supported."
        )

    pdf_bytes = await file.read()
    parse_result = resume_parser.parse_resume(pdf_bytes)

    return ResumeUploadResponse(
        status="success",
        filename=file.filename,
        page_count=parse_result["page_count"],
        text_length=parse_result["text_length"],
        extracted_skills=parse_result["extracted_skills"],
        skill_evidence=parse_result["skill_evidence"],
        skill_count=parse_result["skill_count"],
        experience_years=parse_result["experience_years"],
        detected_education=parse_result["detected_education"],
        warning=parse_result["warning"]
    )


@app.post(
    "/roles/match-resume",
    response_model=RolesMatchResponse,
    tags=["Resume", "Matching"],
    summary="Match PDF Resume to Tech Roles with Explainable Scoring"
)
async def match_resume(
    file: UploadFile = File(..., description="PDF Resume file"),
    top_k: Optional[int] = Form(5, description="Number of ranked roles to return"),
    experience_years_override: Optional[float] = Form(None, description="Optional manual override for years of experience")
):
    """
    Directly uploads a PDF resume and performs empirical role matching.
    
    1. Extracts raw resume text and parses skills.
    2. Ranks Malaysian tech roles using empirical JobStreet requirement profiles.
    3. Returns score components, matched skills, core gaps, and legal disclaimer.
    """
    if not analyzer.is_data_loaded or analyzer.df is None:
        raise DataNotLoadedError("Job posting dataset is not loaded.")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only PDF resume files (.pdf) are supported."
        )

    pdf_bytes = await file.read()
    parse_result = resume_parser.parse_resume(pdf_bytes)

    if not parse_result["has_extractable_text"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded PDF contains no extractable text. Scanned images without text layers are not supported."
        )

    exp_years = experience_years_override if experience_years_override is not None else parse_result["experience_years"]

    result = role_matcher.match_roles(
        raw_skills=parse_result["extracted_skills"],
        experience_years=exp_years,
        top_k=top_k or 5
    )

    # Attach evidence tracking to candidate profile
    candidate_profile = result["candidate_profile"]
    candidate_profile["resume_filename"] = file.filename
    candidate_profile["page_count"] = parse_result["page_count"]
    candidate_profile["skill_evidence"] = parse_result["skill_evidence"]
    candidate_profile["detected_education"] = parse_result["detected_education"]

    return RolesMatchResponse(
        status=result["status"],
        candidate_profile=candidate_profile,
        disclaimer=result["disclaimer"],
        total_roles_evaluated=result["total_roles_evaluated"],
        ranked_matches=result["ranked_matches"],
        insufficient_evidence_roles=result.get("insufficient_evidence_roles", []),
        method="deterministic_matching_from_resume"
    )


@app.post(
    "/skills/gap-resume",
    response_model=SkillsGapResumeResponse,
    tags=["Resume", "Skills"],
    summary="Analyze Skill Gaps from Uploaded PDF Resume"
)
async def analyze_skill_gap_from_resume(
    file: UploadFile = File(..., description="PDF Resume file"),
    target_role: str = Form(..., description="Target tech role name (e.g. 'Data Engineer')")
):
    """
    Directly uploads a PDF resume and performs empirical skill gap analysis
    against the specified target tech role:
    
    1. Extracts raw resume text and parses skills using canonical taxonomy.
    2. Retains verbatim evidence substrings from resume text.
    3. Categorizes gaps into core (>= 25%), recommended (10% - 25%), and optional (< 10%).
    4. Computes empirical coverage percentage and reports sample sizes transparently.
    """
    if not analyzer.is_data_loaded or analyzer.df is None:
        raise DataNotLoadedError("Job posting dataset is not loaded.")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only PDF resume files (.pdf) are supported."
        )

    pdf_bytes = await file.read()
    parse_result = resume_parser.parse_resume(pdf_bytes)

    if not parse_result["has_extractable_text"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded PDF contains no extractable text. Scanned images without text layers are not supported."
        )

    canonical_role = analyzer.validate_role(target_role)

    # Get empirical demand profile for the role
    role_profiles = role_matcher._get_empirical_role_profiles()
    profile_info = role_profiles.get(canonical_role, {})

    if profile_info.get("status") == "insufficient_evidence":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role '{canonical_role}' has insufficient postings (N < {config.min_postings_per_role}) for skill gap analysis."
        )

    skill_shares = profile_info.get("skill_shares", {})
    evidence_n = profile_info.get("denominator", 0)
    sample_warning = evidence_n < config.sample_size_warning_threshold
    warning_msg = (
        f"Small sample size (N = {evidence_n} postings). Findings should be interpreted as directional."
        if sample_warning else None
    )

    gap_data = role_matcher.gap_analyzer.analyze_gaps(
        user_skills=parse_result["extracted_skills"],
        role_skill_shares=skill_shares
    )

    return SkillsGapResumeResponse(
        status="success",
        target_role=canonical_role,
        filename=file.filename,
        page_count=parse_result["page_count"],
        evidence_sample_size=evidence_n,
        sample_size_warning=sample_warning,
        warning_message=warning_msg,
        extracted_skills=parse_result["extracted_skills"],
        skill_evidence=parse_result["skill_evidence"],
        experience_years=parse_result["experience_years"],
        detected_education=parse_result["detected_education"],
        matched_skills=gap_data["matched_skills"],
        matched_skills_count=gap_data["matched_skills_count"],
        core_gaps=gap_data["core_gaps"],
        core_gaps_count=gap_data["core_gaps_count"],
        recommended_gaps=gap_data["recommended_gaps"],
        recommended_gaps_count=gap_data["recommended_gaps_count"],
        optional_gaps=gap_data["optional_gaps"],
        optional_gaps_count=gap_data["optional_gaps_count"],
        total_gaps_count=gap_data["total_gaps_count"],
        coverage_percentage=gap_data["coverage_percentage"],
        method="deterministic_skill_gap_from_resume"
    )


@app.post(
    "/roadmap/generate-from-resume",
    response_model=RoadmapGenerateResponse,
    tags=["Resume", "Roadmap"],
    summary="Generate Skill-Gap Learning Roadmap from PDF Resume"
)
async def generate_roadmap_from_resume(
    file: UploadFile = File(..., description="PDF Resume file"),
    target_role: str = Form(..., description="Target tech role name (e.g. 'Data Engineer')"),
    max_courses: Optional[int] = Form(8, description="Maximum total courses to recommend")
):
    """
    Directly uploads a PDF resume and generates a personalized learning roadmap
    for the specified target role:
    
    1. Extracts skills from resume.
    2. Identifies missing skill gaps against empirical role requirements.
    3. Retrieves verified Coursera courses for the gaps.
    4. Attaches prerequisite heuristic sequence and documented UN SDG alignments.
    """
    if not analyzer.is_data_loaded or analyzer.df is None:
        raise DataNotLoadedError("Job posting dataset is not loaded.")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only PDF resume files (.pdf) are supported."
        )

    pdf_bytes = await file.read()
    parse_result = resume_parser.parse_resume(pdf_bytes)

    if not parse_result["has_extractable_text"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded PDF contains no extractable text. Scanned images without text layers are not supported."
        )

    canonical_role = analyzer.validate_role(target_role)

    # Get empirical demand profile for the role
    role_profiles = role_matcher._get_empirical_role_profiles()
    profile_info = role_profiles.get(canonical_role, {})

    if profile_info.get("status") == "insufficient_evidence":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role '{canonical_role}' has insufficient postings (N < {config.min_postings_per_role}) for roadmap generation."
        )

    skill_shares = profile_info.get("skill_shares", {})
    evidence_n = profile_info.get("denominator", 0)

    # Analyze gaps
    gap_data = role_matcher.gap_analyzer.analyze_gaps(
        user_skills=parse_result["extracted_skills"],
        role_skill_shares=skill_shares
    )
    all_gaps = gap_data["all_gaps"]

    # Recommend courses for gaps
    rec_result = course_recommender.recommend_for_gaps(
        skill_gaps=all_gaps,
        max_total=max_courses or 8
    )

    # Retrieve documented SDG alignments
    role_sdg = sdg_mapper.get_role_sdg_alignments(canonical_role)
    upskill_sdg = sdg_mapper.get_skill_remediation_sdg()
    combined_sdg = role_sdg.get("alignments", []) + upskill_sdg.get("alignments", [])

    return RoadmapGenerateResponse(
        status="success",
        target_role=canonical_role,
        evidence_sample_size=evidence_n,
        total_gaps_identified=len(all_gaps),
        ordered_pathway=rec_result["ordered_pathway"],
        unresolved_skill_gaps=rec_result["unresolved_skill_gaps"],
        pathway_ordering_label=rec_result["pathway_ordering_label"],
        ordering_disclaimer=rec_result["ordering_disclaimer"],
        sdg_alignments=combined_sdg,
        sdg_disclaimer=role_sdg.get("disclaimer", config.sdg_disclaimer),
        method="deterministic_recommender_from_resume"
    )


# ==============================================================================
# AUTH & PERSISTENT LEARNING PROGRESS EXTENSION
# ==============================================================================
try:
    from app.auth.persistence import initialize_sqlite_schema
    from app.auth.routes import router as account_router
    app.include_router(account_router)
    app.router.add_event_handler("startup", initialize_sqlite_schema)
    initialize_sqlite_schema()
    logger.info("Auth & account routes successfully mounted on main API app.")
except Exception as exc:
    logger.warning(f"Could not initialize auth routes: {exc}")



