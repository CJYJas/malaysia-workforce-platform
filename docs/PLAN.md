# Implementation Plan: Malaysia Tech Workforce Intelligence Platform

**Platform:** Malaysia Tech Workforce Intelligence Platform (Hackathon MVP)  
**Backend:** FastAPI hosted on RunPod (port 8000 default)  
**Frontend Contract:** RESTful JSON endpoints for Replit-hosted UI  
**Governing Rules:** Binding engineering constraints from [`document/Agents.md`](file:///c:/Documents/Jasmine/XMUM_Hack/document/Agents.md)  
**Status:** Phase 0 Completed; Phase 1–5 Proposed for User Approval  

---

## 1. Smallest Viable Architecture

To avoid unnecessary complexity, bloated dependencies, and GPU costs, the MVP architecture consists of **8 focused, testable Python modules** under `src/`, accompanied by automated unit and API test suites.

```
XMUM_Hack/
├── data/                               # Raw datasets (Read-only)
│   ├── CourseraDataset-Clean.csv
│   ├── Job Posting.csv
│   ├── JobsDatasetProcessed.csv
│   └── jobstreet_all_job_dataset.csv
├── scripts/
│   ├── inspect_datasets.py             # Reproducible audit script (Phase 0)
│   └── inspection_results.json
├── src/
│   ├── config.py                       # Paths, role definitions, scoring weights, thresholds
│   ├── data_loader.py                  # Streamlined data ingestion & caching
│   ├── preprocessing.py                # Malaysia location filtering & deduplication
│   ├── skill_engine.py                 # Skill dictionary, alias normalization & text extraction
│   ├── demand_analyzer.py              # Skill posting share & qualified temporal trends
│   ├── role_matcher.py                 # Profile matching, gap analysis, and explainable scoring
│   ├── course_recommender.py           # Coursera course retrieval for skill gaps
│   ├── sdg_mapper.py                   # Documented UN SDG alignment mappings
│   └── api.py                          # FastAPI application, Pydantic schemas, error handlers
├── tests/
│   ├── test_preprocessing.py           # Malaysia filter, deduplication tests
│   ├── test_skill_engine.py            # Extraction & alias normalization tests
│   ├── test_demand_analyzer.py         # Skill posting share calculation tests
│   ├── test_role_matcher.py            # Matching logic, edge cases (empty profile)
│   ├── test_course_recommender.py      # Coursera retrieval & gap resolution tests
│   └── test_api.py                     # Endpoint contract tests (200, 400, 404, 422)
├── DATASETS.md                         # Technical audit & feature-support matrix
├── PLAN.md                             # Architecture & milestone specification
├── requirements.txt                    # Pinned lightweight dependencies
└── .env.example                        # RunPod configuration variables
```

### Module Responsibilities & Trimming Rationale
1. **`src/config.py`**:
   - Contains target role regexes, Malaysia location lists, score weights, min-sample thresholds, and environment variables.
2. **`src/data_loader.py`**:
   - Loads `jobstreet_all_job_dataset.csv` and `CourseraDataset-Clean.csv` once into structured memory caches or pre-processed Parquet/SQLite tables to ensure fast startup on RunPod.
3. **`src/preprocessing.py`**:
   - Applies the verified Malaysia administrative rule (excluding ambiguous `"Others"`), deduplicates postings by `(job_title, company, location)` (removing the 7.23% duplicates), and formats dates.
4. **`src/skill_engine.py`** *(Combines skill_extractor + skill_normalizer)*:
   - *Why combined?* Avoids circular dependencies and keeps normalization tightly coupled to extraction.
   - Leverages a curated canonical tech vocabulary seeded from `JobsDatasetProcessed.csv` (Meerawks) and standard tech aliases (e.g., `Py` -> `Python`, `K8s` -> `Kubernetes`, `React.js` -> `React`).
   - Uses compiled regex boundary matching across `descriptions`.
5. **`src/demand_analyzer.py`** *(trend_analyzer)*:
   - Calculates **Skill Posting Share** = `Count(postings mentioning skill) / Total eligible deduplicated role postings`.
   - Computes monthly demand trends for the representative 2024 window (Feb–June 2024), while attaching explicit sample-size warnings for small roles (`N < 50`).
6. **`src/role_matcher.py`** *(Combines role_matcher + skills_gap)*:
   - Calculates explainable match scores based on user skills vs. role requirement profiles derived from JobStreet.
   - Returns matched skills, missing skill gaps, and a breakdown score. Handles empty skill profiles without crashing.
7. **`src/course_recommender.py`**:
   - Indexes unique Coursera courses (6,093 courses). Given missing skill gaps, searches `Skill gain`, `Course Title`, and `Modules`. Returns course title, real URL, rating, difficulty, and rationale.
8. **`src/sdg_mapper.py`**:
   - Maintains documented, defensible alignments to UN SDG 8 (Decent Work & Economic Growth) and SDG 9 (Industry, Innovation & Infrastructure), with clear disclaimer that mappings represent potential alignment, not measured impact.
9. **`src/api.py`**:
   - Implements the 8 required FastAPI endpoints with full Pydantic schemas, CORS middleware (for Replit frontend), and structured health/metadata responses.

---

## 2. Implementation Milestones & Acceptance Checks

### Milestone 1: Data Pipeline, Preprocessing & Skill Extraction Engine
* **Deliverables:** `config.py`, `data_loader.py`, `preprocessing.py`, `skill_engine.py`, unit tests.
* **Acceptance Checks:**
  - [ ] `load_jobstreet_data()` loads 69,024 raw rows and outputs 63,838 deduplicated, confidently identified Malaysian postings.
  - [ ] Ambiguous `location == "Others"` (198 rows) are excluded.
  - [ ] Skill extractor identifies technical skills from job descriptions with exact case-insensitive word-boundary matching and alias resolution.
  - [ ] Unit tests pass: `pytest tests/test_preprocessing.py tests/test_skill_engine.py`.

### Milestone 2: Market Demand & Trend Analyzer
* **Deliverables:** `demand_analyzer.py`, offline cache/pre-aggregated metrics, unit tests.
* **Acceptance Checks:**
  - [ ] Skill posting share formula strictly follows `document/Agents.md` Section 5 with explicit denominator disclosure.
  - [ ] Rankings for Software Engineer (N = 1,486), Data Engineer (N = 118), Data Scientist (N = 63), ML Engineer (N = 35), and Cloud Engineer (N = 35) are pre-calculated and reproducible.
  - [ ] Trend queries for ML/AI and Cloud Engineer include `sample_size_warning: true` and `warning_message`.
  - [ ] Zero synthetic or hardcoded numbers in results.
  - [ ] Unit tests pass: `pytest tests/test_demand_analyzer.py`.

### Milestone 3: Role Matching, Skill-Gap Analysis & Coursera Recommender
* **Deliverables:** `role_matcher.py`, `course_recommender.py`, unit tests.
* **Acceptance Checks:**
  - [ ] User input profile with valid skills (e.g. `['Python', 'SQL']`) receives ranked roles with score breakdowns (coverage %, bonus for foundational skills).
  - [ ] Empty or unknown profile (`[]`) returns graceful 200 response with informative guidance, no 500 error.
  - [ ] Identified skill gaps are fed into Coursera recommender; returns real Coursera courses with valid URLs.
  - [ ] Courses without price data do not display invented fees.
  - [ ] When a skill gap has no matching course, an explicit `unresolved_skill_gap` status is returned.
  - [ ] Unit tests pass: `pytest tests/test_role_matcher.py tests/test_course_recommender.py`.

### Milestone 4: SDG Alignment & FastAPI Service
* **Deliverables:** `sdg_mapper.py`, `api.py`, `.env.example`, `requirements.txt`, integration tests.
* **Acceptance Checks:**
  - [ ] `GET /health` returns `{"status": "healthy", "service": "malaysia-workforce-intelligence"}`.
  - [ ] `GET /metadata` returns dataset version, date ranges (Feb 2024 - Jun 2024 primary), and list of 5 supported roles.
  - [ ] `GET /roles` and `GET /skills/demand?role=Software%20Engineer%20/%20Developer` return verified empirical rankings.
  - [ ] `POST /roles/match` and `POST /roadmap/generate` validate schemas and return complete explanations.
  - [ ] API tests pass with 100% success across valid requests, 400 bad inputs, and 404 missing roles.

### Milestone 5: RunPod Deployment Preparation & Replit Documentation
* **Deliverables:** `README.md`, RunPod startup script, OpenAPI contract export for Replit frontend team.
* **Acceptance Checks:**
  - [ ] Service binds to `0.0.0.0:8000` via Uvicorn.
  - [ ] Setup script reproduces dataset preparation on a fresh container.
  - [ ] OpenAPI JSON / Swagger docs accessible at `/docs`.

---

## 3. Decisions Flagged for User Review & Input

Before implementing Phase 1 code, the following decisions are flagged for your explicit input and alignment:

### Decision A: Primary Job Dataset Selection
* **Our Recommendation:** Use `azraimohamad/jobstreet-all-job-dataset` (`jobstreet_all_job_dataset.csv`) as the sole primary dataset for the dashboard and role matching.
* **Justification:** As verified in `DATASETS.md`, `Job Posting.csv` (Techsalerator) contains 98.76% non-Malaysian jobs and only 1 tech role in Malaysia. `JobsDatasetProcessed.csv` (Meerawks) has 0 Malaysian locations and 0 dates. JobStreet has 68,826 verified Malaysian postings and over 1,700 postings across our 5 target roles.
* **Question for You:** Do you approve designating JobStreet as the sole primary Malaysian job dataset, while using Meerawks purely as an auxiliary skill dictionary?

### Decision B: Tech Skill Taxonomy & Vocabulary Source
* **Options:**
  1. *(Recommended)* **Curated Hybrid Tech Vocabulary:** Combine the 3,000 extracted IT skills from `meerawks/it-skills-from-jobs` with a canonical list of ~250 top Malaysian tech skills (programming languages, frameworks, cloud platforms, databases, data science tools) and aliasing rules (`k8s` -> `Kubernetes`, `reactjs` -> `React`).
  2. **Strict In-Dataset Extracted Terms:** Only extract terms that appear in JobStreet descriptions without external curation.
* **Question for You:** Do you approve using the hybrid taxonomy (Meerawks seed + standard tech alias dictionary)?

### Decision C: Historical Trend Display Window
* **Observation:** JobStreet posting dates are heavily clustered in **February 2024 – June 2024 (82.67%)**. Postings in 2023 are sparse, and 2025 has a separate small cluster.
* **Options:**
  1. *(Recommended)* **Qualified 2024 Trend Window:** Display monthly trends strictly for the reliable Feb–Jun 2024 window, with explicit UI copy explaining that this represents the peak 2024 hiring snapshot.
  2. **Static Demand Frequency Only:** Disable time-series trend lines altogether and display static demand rankings, noting that longitudinal historical data is insufficient.
* **Question for You:** Which trend presentation policy do you prefer?

### Decision D: SDG Reference Alignment Source
* **Proposed Mappings:**
  - **SDG 8 (Decent Work and Economic Growth - Target 8.5 & 8.6):** Mapped to tech upskilling, role matching, and digital economy career pathways in Malaysia.
  - **SDG 9 (Industry, Innovation and Infrastructure - Target 9.b):** Mapped to Cloud, ML/AI, and Data Engineering talent development enabling domestic innovation.
  - **SDG 4 (Quality Education - Target 4.4):** Mapped to targeted Coursera lifelong learning pathways for technical skill gaps.
* **Question for You:** Are these three SDG targets acceptable for the documented rationale?
