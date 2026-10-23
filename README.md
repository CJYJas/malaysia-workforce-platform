# Malaysia Tech Workforce Intelligence Platform
### Empirical Tech Career Analytics, Skill-Gap Remediation & Workforce Intelligence

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-green.svg)](https://fastapi.tiangolo.com)
[![React 19](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646cff.svg)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8.svg)](https://tailwindcss.com/)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Backend Tests](https://img.shields.io/badge/backend%20tests-CI-blue.svg)]()
[![RunPod Cloud](https://img.shields.io/badge/RunPod-Serverless%20vLLM-purple.svg)](https://runpod.io)

---

## 1. System Overview

The **Malaysia Tech Workforce Intelligence Platform** is a full-stack career analytics platform bridging Malaysian tech job market demands with personalized, actionable learning roadmaps. It eliminates subjective career advice and algorithmic hallucinations by grounding all insights in empirical data from **63,852 deduplicated Malaysian tech job postings (JobStreet 2023–2025)**, mapping candidate profiles to authentic Coursera courses and United Nations Sustainable Development Goals (SDG 4, 8, and 9).

The platform comprises two primary layers:
1. **High-Performance Python/FastAPI Backend**: Statistical market intelligence engine, multi-tier role normalizer, hybrid semantic course retriever (`all-MiniLM-L6-v2` via CPU ONNX Runtime + RRF), and RunPod Serverless vLLM worker (`Qwen/Qwen2.5-7B-Instruct`) with strict factual fidelity guardrails.
2. **FutureReady MY Interactive Web Frontend**: A modern web client and adapter workspace (`frontend/`) built with React 19, TypeScript, Tailwind CSS, TanStack Query, and Radix UI primitives. It provides an explainable 4-stage career journey, interactive role exploration, skill-gap analysis, uncertainty scenario planning, and learning progress tracking.

Account registration, server-side learning progress, and evidence-qualified roadmap reconciliation are documented in [docs/ACCOUNT_EXTENSION.md](./docs/ACCOUNT_EXTENSION.md). Account routes are disabled by default and are mounted by the standard Docker bootstrap through `app.extension_entrypoint:app`.

---

## 2. Architecture Diagram & System Design

<img width="8192" height="6476" alt="RunPod Career Skills Matching Architecture-2026-10-22-043419" src="https://github.com/user-attachments/assets/cb9c043d-96e1-42a0-a052-681a778c4488" />

### Full-Stack Architecture
* **Frontend Web Application (`@workspace/workforce`)**: React 19 Single-Page Application (SPA) with responsive desktop sidebar and mobile navigation drawers, versioned client-side profile storage (`localStorage`), interactive charts, and accessible Radix UI components. When accounts are enabled and a user signs in, selected profile fields and pathway progress can also be synchronized to PostgreSQL.
* **API Adapter & Snapshot Server (`@workspace/api-server`)**: Express-based Node.js service providing read-only snapshot data and contract validation via OpenAPI and Zod schemas, mounted under `/api/workforce` and `/api/journey`.
* **Backend Intelligence API (`app.api:app`)**: FastAPI service running asynchronous RunPod Serverless vLLM extraction, ONNX CPU hybrid retrieval, and deterministic role normalization.

---

## 3. Raw Datasets & Data Provenance

The platform relies strictly on verifiable, publicly audited datasets without fabricated numbers or synthetic filler. All four source datasets were inspected in read-only mode and validated for schema integrity:

| Dataset | Kaggle Source & Link | Local File | Total Records | Role in Platform |
| :--- | :--- | :--- | :--- | :--- |
| **JobStreet Malaysia Postings** | [`azraimohamad/jobstreet-all-job-dataset`](https://www.kaggle.com/datasets/azraimohamad/jobstreet-all-job-dataset) | `data/jobstreet_all_job_dataset.csv` | 69,024 postings | **Primary Job Market Dataset**: Cleaned and deduplicated into 63,852 records to compute empirical Malaysian tech skill demand, temporal trends, and role profiles. |
| **Coursera Course Catalog** | [`elvinrustam/coursera-dataset`](https://www.kaggle.com/datasets/elvinrustam/coursera-dataset) | `data/CourseraDataset-Clean.csv` | 8,370 courses | **Primary Learning Pathway Dataset**: Source of authentic courses, verified URLs, ratings, and skills gained. Indexed into 384-d semantic embeddings for hybrid course retrieval. |
| **IT Skills Taxonomy** | [`meerawks/it-skills-from-jobs`](https://www.kaggle.com/datasets/meerawks/it-skills-from-jobs) | `data/JobsDatasetProcessed.csv` | 3,000 postings | **Skill Taxonomy & Normalization Reference**: Apache 2.0 licensed seed dictionary used to construct `data/skills_taxonomy.json` and map surface aliases to canonical skills. |
| **Techsalerator Sample** | [`techsalerator/job-posting-data-in-malaysia`](https://www.kaggle.com/datasets/techsalerator/job-posting-data-in-malaysia) | `data/Job Posting.csv` | 9,919 postings | **Audited Baseline / Cross-Check**: Audited for Malaysian geographic coverage; confirmed 98.76% non-MY (global teaser), documenting why JobStreet is the primary dataset. |

> Complete schema audits, data provenance, license analyses, and cleaning decisions are documented in **[docs/DATASETS.md](./docs/DATASETS.md)**.

---

## 4. Key Features

### A. FutureReady MY Frontend Experience
1. **Guided 4-Stage Personal Career Journey**:
   * **Stage 1 — Profile Intake (`/profile`)**: Structured 3-part intake (*About you*, *Your skills*, *Your direction*) with self-reported proficiencies (*Beginner*, *Working*, *Confident*, or *Not sure*). Full support for zero-skill newcomers and non-destructive editing. Browser-local storage is the default; accounts synchronize selected fields for signed-in users when they use a learning pathway.
   * **Stage 2 — Future Skills Radar (`/radar`, `/skills-radar`)**: Source-backed technology outlook signals categorized into rising/declining skills, mapped against real Malaysian market demand and UN SDG goals.
   * **Stage 3 — Explainable Role Matching (`/matches`, `/role-matches`)**: Transparent 100-point alignment formula (**75 pts skills + 15 pts interests + 10 pts experience**). Highlights matched skills vs. developmental gaps, with clear disclaimers (*readiness alignment, not a hiring guarantee*).
   * **Stage 4 — Actionable Learning Pathway (`/pathway`)**: Ordered sequence of curriculum steps mapping identified skill gaps to authentic Coursera courses with estimated study hours, interactive status tracking (*Not started*, *In progress*, *Completed*), and downloadable JSON career plans.

2. **Workforce Intelligence & Exploration Tools**:
   * **AI Resume Parser & Skill Gap Analyzer (`/resume`, `/parser`)**: Drag-and-drop PDF resume analysis powered by RunPod / vLLM. Automatically extracts canonical tech skills, verifies Malaysian market matches, and generates role-specific skill gap breakdowns with course recommendations.
   * **Role Explorer & Detail Views (`/roles`, `/roles/:roleId`)**: Deep-dive into empirical Malaysian tech roles, top required skills, sample cautionary indicators, and linked courses.
   * **Side-by-Side Role Comparison (`/compare`)**: Compare two tech roles simultaneously across skill share percentages, common overlap, and unique prerequisites, with CSV export.
   * **Coursera Course Directory (`/courses`)**: Searchable and filterable catalog of verified Coursera courses indexed to canonical tech skills.
   * **UN SDG Impact Alignment (`/goals`, `/sdg-alignment`)**: Explicit linkage to UN Sustainable Development Goals (SDG 4: Quality Education, SDG 8: Decent Work, SDG 9: Industry & Innovation).
   * **Uncertainty Scenario Analysis (`/scenarios`)**: Stress-test career pathways across three macro scenarios (*Steady Transition*, *Accelerated AI Adoption*, *Human-Centred Transition*).

### B. High-Performance Backend & AI Engine
1. **Empirical Tech Role Matching & Multi-Tier Normalization**:
   * Requirements are derived dynamically from Malaysian job market data, not static hand-written checklists.
   * `RoleNormalizer` resolves abbreviations and aliases (e.g. `data en` $\to$ `Data Engineer`, `swe` $\to$ `Software Engineer / Developer`, `cloud en` $\to$ `Cloud Engineer`).
2. **Direct PDF Resume Extraction**:
   * Upload PDF resumes to extract canonical skills, retain verbatim matching evidence, and analyze gaps for any target role (`POST /roles/match-resume`, `POST /skills/gap-resume`).
3. **Hybrid Semantic Course Retrieval**:
   * Lexical search (TF-IDF) + dense vector semantic search (`sentence-transformers/all-MiniLM-L6-v2` via CPU-optimized ONNX runtime) merged via Reciprocal Rank Fusion (RRF $k=60$).
   * 57.1% reduction in false-negative gaps while cleanly returning `[]` for uncataloged skills without hallucinating irrelevant courses.
4. **Dual-Layer AI Safety & Factual Guardrails**:
   * Automated PII redaction (stripping Malaysian NRIC, phone, email, and addresses).
   * Post-extraction verification gate discards hallucinated skills or non-canonical tokens.
   * Factual fidelity checker strictly rejects fabricated metrics or marketing buzzwords.
5. **RunPod Cloud & Local CPU Flexibility**:
   * CPU-only FastAPI service communicates asynchronously with RunPod Serverless vLLM worker (`Qwen/Qwen2.5-7B-Instruct`), falling back seamlessly to offline local CPU mode.

---

## 5. Local Setup & Quickstart

### Prerequisites
* **Python**: 3.10+ (Python 3.11 recommended)
* **Node.js**: v20+ or v24
* **pnpm**: v9+ (`corepack enable pnpm` or `npm install -g pnpm`)
* **Git**

---

### Backend Setup (FastAPI)

1. **Clone and enter the repository**:
   ```bash
   git clone https://github.com/CJYJas/malaysia-workforce-platform.git
   cd malaysia-workforce-platform
   ```

2. **Create and activate a virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install backend dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment (`.env`)**:
   ```bash
   cp .env.example .env
   ```
   Configure key variables:
   ```bash
   PORT=8000
   HOST=0.0.0.0
   CORS_ORIGINS=["https://replit.com","http://localhost:3000","http://localhost:5173","http://localhost:21728"]
   RETRIEVER=hybrid
   RUNPOD_API_KEY=your_runpod_api_key
   RUNPOD_ENDPOINT_ID=your_serverless_endpoint_id
   LLM_MODEL_NAME=Qwen/Qwen2.5-7B-Instruct
   ```

5. **Run backend automated tests**:
   ```bash
   python -m pytest tests -v
   ```

6. **Start local FastAPI server**:
   ```bash
   uvicorn app.extension_entrypoint:app --host 0.0.0.0 --port 8000 --reload
   ```
   * Interactive Swagger UI: `http://localhost:8000/docs`
   * ReDoc: `http://localhost:8000/redoc`

### Local account API (Windows PowerShell)

For local-only account testing, use SQLite; PostgreSQL remains the production database and requires the manual migrations described in [docs/ACCOUNT_EXTENSION.md](./docs/ACCOUNT_EXTENSION.md).

```powershell
$env:DATABASE_URL = "sqlite+pysqlite:///./local_dev.db"
$env:AUTH_ENABLED = "true"
$env:AUTH_SIGNING_KEY = (python -c "import secrets; print(secrets.token_urlsafe(48))")
$env:AUTH_COOKIE_SECURE = "false"
$env:AUTH_ALLOWED_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:8000"
$env:CORS_ORIGINS = '["http://localhost:5173","http://127.0.0.1:5173","http://127.0.0.1:8000"]'
python -m uvicorn app.extension_entrypoint:app --host 127.0.0.1 --port 8000 --reload
```

SQLite account tables are created automatically when this entrypoint starts. Account routes require an allowlisted `Origin`; authenticated write requests also require the `X-CSRF-Token` returned by registration/login. Swagger UI at `/docs` does not automatically add the CSRF header, so set it for authenticated mutations; requests made with `curl` or PowerShell must provide the `Origin` header explicitly.

---

### Frontend Setup (FutureReady MY Web Client & Adapter)

1. **Navigate to the frontend workspace**:
   ```bash
   cd frontend
   ```

2. **Install dependencies and verify type integrity**:
   ```bash
   pnpm install
   pnpm run typecheck
   ```

3. **Start the API servers and web development client**:
   Open separate terminal tabs:

   * **Terminal 1 — API Snapshot Adapter (Port 5000)**:
     ```bash
     pnpm --filter @workspace/api-server run dev
     ```
     *Serves `/api/workforce` and `/api/journey` snapshot endpoints on `http://localhost:5000`.*

   * **Terminal 2 — FutureReady MY Web App (Port 5173)**:
     ```bash
     pnpm --filter @workspace/workforce run dev
     ```
     *Accessible at `http://localhost:5173`. Automatically proxies `/api` calls to port 5000 and `/api/py` calls to port 8000 via Vite.*

   * **Terminal 3 (Optional) — FastAPI Intelligence Engine (Port 8000)**:
     ```bash
     uvicorn app.extension_entrypoint:app --host 0.0.0.0 --port 8000 --reload
     ```
     *Provides RunPod/vLLM resume analysis, hybrid course retrieval, and real-time gap modeling.*

4. **Full-Stack Connection Architecture**:
   * **Seamless Reverse Proxy**: The frontend development server (`vite.config.ts`) includes built-in proxying to eliminate CORS barriers:
     * `/api/*` $\to$ Express Snapshot Adapter (`http://127.0.0.1:5000`)
     * `/api/py/*` $\to$ FastAPI Intelligence API (`http://127.0.0.1:8000`)
   * **Reactive Client Query Layer (`@workspace/api-client-react`)**: Powered by TanStack Query for asynchronous fetching, smart caching, automatic retries, and clean optimistic state handling across all 4 journey stages.

5. **Build production bundles**:
   ```bash
   pnpm -r --if-present run build
   ```

6. **Run frontend verification test suites**:
   ```bash
   # Client-side state and data-model tests across profile, flow, matching, and plan summary
   pnpm --filter @workspace/scripts exec tsx --test test-profile-storage.mjs test-journey-flow.mjs test-match-view.mjs test-course-catalog.mjs test-plan-summary.mjs test-learning-progress.mjs

   # Snapshot contract & journey API verification (Python)
   python scripts/test-workforce.py
   python scripts/test-journey.py
   python scripts/test-course-api.py
   ```

---

## 6. Empirical Benchmark & Audit Tools

Audit search and retrieval performance with empirical data from 63,852 postings:
```bash
python scripts/audit_search.py
```
Outputs empirical metrics and side-by-side retrieval benchmarks directly to `data/review/search_audit_results.json`:
* **Zero-Course Gaps**: Dropped from **35.0%** (TF-IDF baseline) to **15.0%** (Hybrid Semantic) — a **57.1% reduction**.
* **Role Title Normalization**: Evaluated on Malaysian postings, resolving non-standard titles and abbreviations.
* **Skill Vocabulary Expansion**: Top uncataloged tech terms discovered from employer descriptions (e.g. SAP, ERP, Jira, Redis, Git).

---

## 7. RunPod Cloud Deployment

The production deployment runs the FastAPI application on a low-cost CPU container pod, communicating with a serverless GPU worker running `Qwen2.5-7B-Instruct`:

1. **Docker Container**: Build and deploy using the provided [Dockerfile](./Dockerfile).
2. **Bootstrap Script**: Container automatically runs [scripts/bootstrap.sh](./scripts/bootstrap.sh) to mount Network Volume data and launch Uvicorn.
3. **vLLM Serverless Worker**: Configured with `Min Workers: 0` and `Idle Timeout: 60s` to scale to zero when idle, minimizing costs.

For step-by-step setup, Network Volume configuration, and curl smoke tests, see **[docs/RUNPOD.md](./docs/RUNPOD.md)**.

---

## 8. AI / ML Usage & Safety Transparency

In compliance with hackathon and production ethics guidelines, the platform transparently discloses the exact role of AI models:

| Component | Technology | Role & Safeguards |
| :--- | :--- | :--- |
| **Market Intelligence** | Deterministic Python / Pandas | Strictly frequency-based statistics. Never uses AI to invent trends or demand. |
| **Role Normalization** | Multi-Tier `RoleNormalizer` | Normalizes queries (`data en` $\to$ `Data Engineer`) via canonical, alias, token-prefix, regex, and fuzzy matching. |
| **Role Matching** | Deterministic Weighted Vector Math | 75% skill coverage + 15% interest alignment + 10% experience. Binding legal disclaimer (*readiness alignment, not hiring probability*). |
| **Course Retrieval** | `all-MiniLM-L6-v2` (ONNX CPU) & RRF | Hybrid dense + lexical ranking. Annotated with `match_signal` (`both`, `keyword`, `semantic`). Returns `[]` for non-existent courses (zero hallucinations). |
| **Profile Parsing** | Open-Weight `Qwen2.5-7B-Instruct` | Extracts skills from text. **Post-extraction verification gate** discards any non-canonical or hallucinated skill. Falls back to dictionary extractor on error. |
| **Executive Narration** | Open-Weight `Qwen2.5-7B-Instruct` | Summarizes deterministic facts. **Factual fidelity checker** verifies all numbers and entities exist in input data; rejects subjective buzzwords. |
| **Frontend Privacy** | Browser Storage; PostgreSQL accounts | Guest profiles and pathway checklists remain browser-local. When enabled, the account API persists selected profile fields and pathway-step statuses for signed-in users; no profile-text logging or background tracking is introduced. |

---

## 9. Performance Benchmarks

Directly measured empirical benchmarks (zero fabricated numbers) recorded in **[docs/BENCHMARKS.md](./docs/BENCHMARKS.md)**:

* **Memory Usage**: ~185 MB steady-state RAM (runs comfortably on minimal CPU instances).
* **Dense Course Retrieval Latency**: **6.9 ms** (vs 104 ms TF-IDF baseline).
* **Profile Verification Latency**: **1.48 ms** end-to-end.
* **Automated checks**: Backend tests run with `python -m pytest tests -v`; GitHub Actions runs frontend typechecking, the account request contract test, and the documented client-side state/model tests. Test counts are reported by the test runners rather than hard-coded here.

---

## 10. Documentation Index

### Core Architecture & Backend
* **[docs/API.md](./docs/API.md)**: Comprehensive FastAPI REST API endpoint reference with curl examples.
* **[docs/RUNPOD.md](./docs/RUNPOD.md)**: RunPod deployment guide, vLLM worker setup, and pre-demo checklist.
* **[docs/BENCHMARKS.md](./docs/BENCHMARKS.md)**: Empirical latency, memory, and throughput benchmarks.
* **[docs/DATASETS.md](./docs/DATASETS.md)**: Dataset provenance, licensing, and schema verification.
* **[docs/Agents.md](./docs/Agents.md)**: Platform rules, engineering constraints, and verification checklist.
* **[docs/PLAN.md](./docs/PLAN.md)**: Milestone execution plan and technical specifications.

### FutureReady MY Frontend Workspace
* **[frontend/README.md](./frontend/README.md)**: Frontend workspace overview and quickstart instructions.
* **[frontend/docs/FRONTEND.md](./frontend/docs/FRONTEND.md)**: Frontend architecture, pnpm setup, and API adapter integration.
* **[frontend/docs/JOURNEY.md](./frontend/docs/JOURNEY.md)**: 4-stage personal career journey, scoring logic, and privacy model.
* **[frontend/docs/ROLE-MATCHES.md](./frontend/docs/ROLE-MATCHES.md)**: Role matching, evidence breakdown, and scenario weighting.
* **[frontend/docs/COURSES-LEARNING.md](./frontend/docs/COURSES-LEARNING.md)**: Coursera indexing, hybrid retrieval, and progress tracking.
* **[frontend/docs/MARKET-INTELLIGENCE.md](./frontend/docs/MARKET-INTELLIGENCE.md)**: Role Explorer, Malaysian tech skill demand, and methodology.
* **[frontend/docs/VERIFICATION.md](./frontend/docs/VERIFICATION.md)**: Verification log across milestones, test suites, and browser checks.
