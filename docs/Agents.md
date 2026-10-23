# Malaysia Tech Workforce Intelligence Platform

STANDING RULES (apply to every milestone; AGENTS.md section 11 is binding)
- Inspect before changing. Never overwrite working code without explaining why.
- Never fabricate data, metrics, courses, URLs or citations. Every reported number
  must come from code you ran.
- No hardcoded rankings or statistics. Thresholds and weights live in config.
- Keep job-demand data, course data, and AI output separate.
- Never log user profile text. No secrets in source.
- Every AI feature sits behind a config flag, and the app must work with all flags off.
- After each milestone: run the full test suite, report real results, list what
  could not be verified, update docs, then STOP for review.

## Codex Project Guide

> **Purpose:** Build a hackathon MVP that helps tech job seekers in
> Malaysia understand employer skill demand, find suitable future roles,
> and create personalized learning pathways.
>
> **Deployment:** FastAPI backend hosted on RunPod. Frontend developed
> separately by a teammate in Replit. Codex is the coding agent, not a
> runtime component.

------------------------------------------------------------------------

## 1. Product Goal

Build a data-driven platform for **Malaysia's technology job market**.
The product must not present generic global job-market statistics as
Malaysian findings.

The MVP has three connected features:

1.  **Tech Skills Intelligence Dashboard** --- users select a tech role
    and see the skills most frequently requested in relevant Malaysian
    job postings.
2.  **Future Role Matching** --- users provide their current skills and
    experience and receive explainable role matches.
3.  **Personalized Learning Pathway** --- the system identifies skill
    gaps and recommends relevant courses from the Coursera dataset.

The dashboard is the shared data foundation for the other features. Do
not build a static dashboard with hardcoded skill rankings.

## 2. Target Users and Supported Roles

### Target users

People exploring, entering, or transitioning into technology careers in
Malaysia.

### Initial roles

-   Software Engineer / Software Developer
-   Data Engineer
-   Data Scientist
-   Machine Learning / AI Engineer
-   Cloud Engineer

Add other roles only when the available Malaysian job-posting data
provides sufficient coverage.

### Geography

-   Include job postings confidently identified as being in Malaysia.
-   Exclude unknown or ambiguous locations from Malaysia-specific
    statistics and document the exclusion.
-   Do not include global comparisons in the MVP.
-   International courses may be recommended, but do not assume
    Malaysian availability, language, price, or accessibility unless
    verified.

## 3. Core User Journeys

### Journey A: Explore skills

1.  User opens the dashboard.
2.  User selects a role, such as Software Engineer.
3.  Backend returns the number of relevant Malaysian postings, dataset
    coverage dates, and the most requested skills.
4.  User can inspect historical trends if adequate dated data exists.
5.  User selects a skill to see relevant learning resources.

### Journey B: Match to roles

1.  User enters skills, experience, education, and optional preferences.
2.  Backend normalizes the profile's skills.
3.  System compares the profile against the role requirements derived
    from the processed job data.
4.  User receives ranked roles, an explainable match score, existing
    matching skills, and skill gaps.

### Journey C: Generate a learning pathway

1.  User chooses a target role or selects a role match.
2.  Backend identifies missing or underdeveloped skills.
3.  System retrieves suitable courses from the Coursera dataset.
4.  The pathway orders learning recommendations where the available
    metadata supports ordering.
5.  Each recommendation explains which skill gap it addresses.
6.  Relevant SDG mappings are shown with a short rationale and a clear
    distinction between a documented mapping and a measured impact.

## 4. Data Sources

### A. Malaysian job-posting data

Candidate datasets to investigate: -
`azraimohamad/jobstreet-all-job-dataset` -
`techsalerator/job-posting-data-in-malaysia` -
`meerawks/it-skills-from-jobs`

These are candidates, not pre-approved sources. Inspect the actual files
before choosing them.

For every candidate, document: - Source URL and downloaded filename -
Declared license and attribution requirements - Data provenance, where
stated - Actual schema and column meanings - Total rows and relevant
Malaysian rows - Available job titles, descriptions, locations, and
dates - Missing values, duplicate records, and cleaning decisions - Date
coverage and limitations - Whether the dataset is adequate for each
planned feature

Do not assume that a dataset is licensed under Apache 2.0 merely because
it is hosted on Kaggle. Record the license shown for each specific
dataset. Do not scrape live job sites or access restricted sources.

### B. Coursera course data

Candidate source: -
https://www.kaggle.com/datasets/elvinrustam/coursera-dataset

Inspect the actual schema. Determine whether course names, descriptions,
skills, difficulty, ratings, duration, URLs, and prices are available.
Do not assume any field exists before inspecting the files.

Use this dataset to retrieve relevant courses for identified skill gaps.
Course popularity is not evidence of employer demand. Keep course data
separate from job-demand calculations.

### C. Skills taxonomy and SDG reference data

If using an external skills taxonomy or SDG reference, document its
source, license, mapping method, and limitations. Normalize equivalent
skill names (for example, abbreviations and full names) without losing
the original evidence.

## 5. Dashboard Requirements

For a selected role, display:

-   Number of relevant Malaysian job postings analyzed
-   Data coverage period and last processing date
-   Most frequently requested skills
-   Percentage of relevant postings mentioning each skill
-   Historical demand trend by month or quarter, only when dates are
    reliable and sufficient
-   Role-to-role skill comparison
-   Relevant courses for a selected skill

### Metric definitions

-   **Skill posting share:** number of eligible postings mentioning the
    skill divided by the number of eligible postings for the selected
    role and period.
-   Deduplicate postings where possible before calculating the metric.
-   State the denominator and time window clearly.
-   Avoid comparing raw counts across roles with very different sample
    sizes without context.

### Trend rules

-   If reliable dates are unavailable, show frequency-based demand and
    label it accordingly.
-   Do not call a skill "emerging," "fast-growing," "latest," or
    "currently in demand" without adequate recent and historical
    evidence.
-   Do not infer future demand directly from a single snapshot.
-   Show warnings when sample sizes are small or coverage is incomplete.
-   Never invent numbers for demonstration. Any mock data must be
    visibly labeled as mock data and must not be used in production
    responses.

## 6. Role Matching and Skill-Gap Analysis

Use an explainable hybrid approach where appropriate: 1. Extract or
identify skills from job descriptions and user profiles. 2. Normalize
skill terms to a consistent vocabulary. 3. Represent role requirements
using evidence from eligible Malaysian job postings. 4. Calculate
transparent matching features, such as skill coverage and semantic
similarity. 5. Return the score components and the skills that
influenced the result.

Requirements: - Do not claim a score is a probability of getting
hired. - Do not imply the ranking guarantees employability. - Keep
source evidence traceable to the processed data. - Handle profiles with
few skills without crashing. - Return a clear message when the dataset
does not have enough evidence for a role.

An LLM may help extract structured skills from text, but validate its
output and do not rely on an LLM to fabricate market statistics.

## 7. Learning Pathway

For each identified skill gap: - Search the actual Coursera records
using available skill tags, titles, and descriptions. - Rank relevant
courses using documented criteria. - Return the course title, available
URL, relevant skills, and any verified metadata that exists. - Explain
why each course was recommended. - Do not invent course URLs, skills,
ratings, prices, duration, or availability. - If no suitable course is
found, say so and return the unresolved skill gap.

Learning order may be based on documented prerequisites or a transparent
heuristic. Do not present a heuristic as a validated educational
sequence.

## 8. SDG Mapping

Map roles or skills to relevant United Nations Sustainable Development
Goals only when a defensible connection can be explained.

For each mapping, store: - Role or skill - SDG number and official
title - Rationale - Source or mapping method - Confidence or review
status, if implemented

Do not claim that learning a skill itself achieves an SDG or creates
measurable social impact. Describe the mapping as a potential alignment
unless impact has been measured.

## 9. Proposed Backend Architecture

Keep modules small and testable. Adapt to the existing repository rather
than overwriting working code.

Possible modules: - `data_loader.py` --- load source files -
`data_validation.py` --- schema and data-quality checks -
`preprocessing.py` --- deduplication, missing values, and Malaysia
filtering - `skill_extractor.py` --- skill extraction from text if
needed - `skill_normalizer.py` --- canonical skill vocabulary -
`trend_analyzer.py` --- demand metrics and historical trends -
`role_matcher.py` --- role ranking - `skills_gap.py` --- profile-to-role
gaps - `course_recommender.py` --- Coursera course retrieval -
`sdg_mapper.py` --- documented SDG alignment - `api.py` --- FastAPI
routes and response schemas

Suggested API endpoints: - `GET /health` --- service health -
`GET /metadata` --- dataset coverage, processing version, and available
roles - `GET /roles` --- roles supported by processed data -
`GET /skills/demand?role=...` --- skill-demand metrics for a role -
`GET /skills/trends?role=...` --- trends when supported by the data -
`POST /profile/analyze` --- normalize and analyze a user's skills
profile - `POST /roles/match` --- return ranked roles and explanations -
`POST /roadmap/generate` --- generate a skill-gap-based learning pathway

Document request and response schemas so the Replit frontend can
integrate without depending on internal Python code. Validate user input
and return useful HTTP error messages.

## 10. RunPod Deployment

-   Run FastAPI on `0.0.0.0` and the configured port (use port `8000` by
    default).
-   Provide a working health endpoint.
-   Store secrets in environment variables or RunPod secrets, never in
    source code.
-   Document required environment variables in `.env.example` without
    real secrets.
-   Do not assume container-local data persists after a restart.
-   Use persistent storage or a documented data-download/preprocessing
    step for datasets and indexes.
-   Provide clear setup, run, test, and deployment instructions.
-   Start with CPU-compatible processing unless a GPU provides a
    demonstrated benefit. Avoid unnecessary paid inference services.

## 11. Engineering Rules for Codex

1.  Inspect the repository and available files before changing code.
2.  Do not assume dataset schemas; inspect and document the actual
    columns.
3.  Do not fabricate data, metrics, courses, or citations.
4.  Keep observed metrics, scenario assumptions, and recommendations
    clearly separated.
5.  Do not hardcode skill rankings or job statistics.
6.  Keep data processing reproducible and version its outputs where
    practical.
7.  Use configuration for documented thresholds and scoring weights.
8.  Add unit tests for preprocessing, Malaysia filtering, demand
    calculations, role matching, and course retrieval.
9.  Add API tests for success cases, invalid inputs, missing data, and
    insufficient sample sizes.
10. Handle empty datasets, missing dates, duplicates, and malformed
    records.
11. Log errors and useful processing metadata without logging sensitive
    user profile data unnecessarily.
12. Do not introduce an LLM, vector database, GPU dependency, or
    external API unless the benefit justifies its cost and complexity.
13. Do not overwrite existing working code without explaining why.
14. Update documentation whenever an endpoint, schema, or major design
    decision changes.

## 12. Acceptance Criteria & Verification Evidence

| Status | Verification Criterion | Implementation & Evidence Reference | Live RunPod Manual Verification |
| :---: | :--- | :--- | :--- |
| **[x] PASS** | **1. System Health & Non-blocking Readiness** | `GET /health` reports `status: "healthy"`, `retriever_active`, `embeddings_loaded`, `llm_enabled`, `device: "cpu"`. Tested in `tests/test_api.py`. | **[ ] NEEDS MANUAL VERIFICATION**<br>`curl -s http://<RUNPOD_HOST>:8000/health \| jq` |
| **[x] PASS** | **2. Roles Catalog & Date Range Disclosure** | `GET /roles` and `GET /metadata` report 5 supported roles and verified 19-month date window (2023-03 to 2025-05). | Verified via `GET /metadata` and `tests/test_api.py`. |
| **[x] PASS** | **3. Empirical Data Pipeline** | Cleaned 69,024 rows $\to$ 63,852 deduplicated postings in `data/processed/v1.0.0/processed_jobs.parquet`. | Verified via `app/pipeline.py` and `tests/test_pipeline.py`. |
| **[x] PASS** | **4. Denominators & Dedup Disclosure** | Every skill posting share explicitly discloses `denominator` ($N$), `deduplication_policy`, and sample warnings ($N < 50$). | Implemented in `app/trend_analyzer.py`; verified in `test_api.py`. |
| **[x] PASS** | **5. Strict Trend Date Qualification** | Fails safely with `status: "insufficient_date_data"` if dates span $< 3$ months. Strictly zero subjective buzzwords (`"emerging"`, `"fast-growing"`). | Implemented in `app/trend_analyzer.py`; tested in `test_api.py`. |
| **[x] PASS** | **6. Empirical Role Matching & Gaps** | Weighted $70\%$ coverage + $30\%$ TF-IDF cosine score. Identifies core gaps ($\ge 25\%$), recommended gaps ($10\% - 25\%$), and binding disclaimer. | Implemented in `app/role_matcher.py` & `app/skills_gap.py`. |
| **[x] PASS** | **7. Direct PDF Resume Analytics** | PDF text extraction via PyMuPDF/pypdf with verbatim matched text evidence retention. Extracts skills, experience, and education. | Tested across 10 tests in `tests/test_resume_parser.py`. |
| **[x] PASS** | **8. Authentic Coursera Records Only** | Recommends courses from 8,370 verified Coursera records with real URLs. Zero fabricated prices or ratings. | Implemented in `app/course_recommender.py`; tested in `test_api.py`. |
| **[x] PASS** | **9. Course Traceability & Unresolved Gaps** | Every recommendation traceable to `source_record_id: "coursera_<id>"`. Explicitly returns unresolved gaps. | Implemented in `app/course_recommender.py`. |
| **[x] PASS** | **10. Documented UN SDG Alignments** | Mapped to SDG 4 (Target 4.4), SDG 8 (Target 8.5), and SDG 9 (Target 9.b) with rationale and explicit disclaimer (`measured_impact: false`). | Implemented in `app/sdg_mapper.py`. |
| **[x] PASS** | **11. Dense & Hybrid Course Retrievers** | Precomputed embeddings in `coursera_embeddings.npy` (8,370 courses). Supports TF-IDF, Dense, and Hybrid RRF ($k=60$). Auto-fallback to TF-IDF. | Tested across 8 tests in `tests/test_embeddings.py`. |
| **[x] PASS** | **12. Retrieval Human Eval Candidates** | 239 candidate query-course pairs generated without self-labeling for human annotators in `data/retrieval_eval_candidates.json`. | Verified in `scripts/evaluate_retrieval.py` & `tests/test_embeddings.py`. |
| **[x] PASS** | **13. PII Redaction & LLM Parsing Gate** | Pre-redacts Malaysian NRIC, email, phone, address. Post-extraction gate rejects non-canonical or hallucinated skills. Injection defense fallback. | Tested across 8 tests in `tests/test_profile_parse.py`. |
| **[x] PASS** | **14. Factual Fidelity Narration Guard** | Rejects ungrounded numbers, hallucinated entities, or banned buzzwords (`"emerging"`, `"guaranteed hire"`). Reverts cleanly to deterministic template. | Tested across 9 tests in `tests/test_llm_narrator.py`. |
| **[x] PASS** | **15. RunPodLLMClient Capped Retries & Privacy** | Bearer auth from `RUNPOD_API_KEY`, official OpenAI route, cold-start handling, temperature 0.0, zero prompt/key logging. | Tested across 8 tests in `tests/test_runpod_llm.py`. |
| **[ ] NEEDS MANUAL VERIFICATION** | **16. Live RunPod vLLM Serverless Connectivity** | Live invocation of self-hosted Qwen2.5-7B-Instruct worker on RunPod Serverless GPU. | **Run Shell Command on Live Pod:**<br>`curl -X POST "https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/openai/v1/chat/completions" -H "Authorization: Bearer ${RUNPOD_API_KEY}" -H "Content-Type: application/json" -d '{"model":"Qwen/Qwen2.5-7B-Instruct","messages":[{"role":"user","content":"Respond with: OK"}],"max_tokens":10}' \| jq` |
| **[x] PASS** | **17. Comprehensive Automated Test Suite** | **84 tests passing 100%** across pipeline, API, resume parsing, embeddings, LLM parsing, narration, and RunPod client. | Verified via `python -m pytest tests -q` (84 passed in ~25s). |
| **[x] PASS** | **18. Replit API Contract & Transparency** | Fully documented in `docs/API.md` with explicit `"method"` and `"fallback_reason"` taxonomy. | Documented in `docs/API.md` and `document/API.md`. |
| **[x] PASS** | **19. Setup & RunPod Deployment Docs** | Production Dockerfile, .dockerignore, .env.example, scripts/bootstrap.sh, docs/RUNPOD.md, docs/BENCHMARKS.md, README.md. | Complete deployment package created in repository root. |

## 13. First Task --- Do Not Build Everything at Once

Start by: 1. Inspecting the existing repository. 2. Listing available
dataset files and reading their schemas. 3. Drafting a `DATASETS.md`
inventory with actual findings. 4. Identifying which features each
dataset can genuinely support. 5. Proposing the smallest viable
architecture and implementation milestones. 6. Reporting missing files,
license questions, weak Malaysia coverage, and missing dates.

Do not implement the entire application until this initial report and
plan are ready for review.
