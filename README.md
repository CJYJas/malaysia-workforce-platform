# Malaysia Tech Workforce Intelligence Platform
### Empirical Tech Career Analytics, Skill-Gap Remediation & Workforce Intelligence

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-green.svg)](https://fastapi.tiangolo.com)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Tests Passing](https://img.shields.io/badge/tests-105%20passed-brightgreen.svg)]()
[![RunPod Cloud](https://img.shields.io/badge/RunPod-Serverless%20vLLM-purple.svg)](https://runpod.io)

---

## 1. System Overview

The **Malaysia Tech Workforce Intelligence Platform** bridges Malaysian tech job market demands with personalized learning roadmaps. It eliminates subjective career advice and algorithmic hallucinations by computing empirical skill demand distributions from **63,852 deduplicated Malaysian tech job postings (JobStreet 2023–2025)**, mapping candidate profiles to authentic Coursera courses and United Nations Sustainable Development Goals (SDG 4, 8, and 9).

---

## 2. Architecture Diagram
<img width="8192" height="6476" alt="RunPod Career Skills Matching Architecture-2026-10-22-043419" src="https://github.com/user-attachments/assets/cb9c043d-96e1-42a0-a052-681a778c4488" />

---

## 3. Raw Datasets & Data Provenance

The platform relies strictly on verifiable, publicly audited datasets without fabricated numbers or synthetic filler. All four source datasets were inspected in read-only mode and validated for schema integrity:

| Dataset | Kaggle Source & Link | Local File | Total Records | Role in Platform |
| :--- | :--- | :--- | :--- | :--- |
| **JobStreet Malaysia Postings** | [`azraimohamad/jobstreet-all-job-dataset`](https://www.kaggle.com/datasets/azraimohamad/jobstreet-all-job-dataset) | `data/jobstreet_all_job_dataset.csv` | 69,024 postings | **Primary Job Market Dataset**: Cleaned and deduplicated into 63,852 records to compute empirical Malaysian tech skill demand, temporal trends, and role profiles. |
| **Coursera Course Catalog** | [`elvinrustam/coursera-dataset`](https://www.kaggle.com/datasets/elvinrustam/coursera-dataset) | `data/CourseraDataset-Clean.csv` | 8,370 courses | **Primary Learning Pathway Dataset**: Source of authentic courses, verified URLs, ratings, and skills gained. Indexed into 384-d semantic embeddings for hybrid course retrieval. |
| **IT Skills Taxonomy** | [`meerawks/it-skills-from-jobs`](https://www.kaggle.com/datasets/meerawks/it-skills-from-jobs) | `data/JobsDatasetProcessed.csv` | 3,000 postings | **Skill Taxonomy & Normalization Reference**: Apache 2.0 licensed seed dictionary used to construct `data/skills_taxonomy.json` and map surface aliases to canonical skills. |
| **Techsalerator Sample** | [`techsalerator/job-posting-data-in-malaysia`](https://www.kaggle.com/datasets/techsalerator/job-posting-data-in-malaysia) | `data/Job Posting.csv` | 9,919 postings | **Audited Baseline / Cross-Check**: Audited for Malaysian geographic coverage; confirmed 98.76% non-MY (global teaser), documenting why JobStreet is the primary dataset. |

> Complete schema audits, data provenance, license analyses, and cleaning decisions are documented in **[document/DATASETS.md](file:///c:/Documents/Jasmine/XMUM_Hack/document/DATASETS.md)**.

---

## 4. Key Features

1. **Empirical Tech Role Matching & Flexible Normalization**:
   * Requirements are derived dynamically from Malaysian job market data, not static hand-written checklists.
   * **Multi-Tier Role Normalization**: Flexible title resolution (`RoleNormalizer`) allows abbreviations, shorthands, and aliases (e.g. `data en` $\to$ `Data Engineer`, `swe` $\to$ `Software Engineer / Developer`, `cloud en` $\to$ `Cloud Engineer`) across all query endpoints.
   * Transparent scoring: $70\%$ skill coverage + $30\%$ TF-IDF cosine similarity with binding legal disclaimers.

2. **Direct PDF Resume Extraction**:
   * Upload PDF resumes directly to extract canonical skills, retain verbatim matching evidence, and analyze gaps for any target role (`POST /roles/match-resume`, `POST /skills/gap-resume`).

3. **Hybrid Semantic Course Retrieval**:
   * Upgraded hybrid retrieval combining deterministic keyword search (TF-IDF) and dense vector semantic search (`sentence-transformers/all-MiniLM-L6-v2` via CPU-optimized ONNX runtime).
   * **Reciprocal Rank Fusion (RRF $k=60$)**: Merges retrieval signals with transparent match labeling (`both`, `keyword`, `semantic`).
   * **Wording Invariance**: Queries with different terminology (e.g. *"data pipeline orchestration"*) successfully retrieve relevant courses (Apache Airflow / ETL pipelines).
   * **57.1% Reduction in False-Negative Gaps**: Rescues valid Coursera courses for skills like `Golang`, `Vue.js`, `dbt`, and `Redis` while cleanly returning `[]` for uncataloged skills (`FastAPI`, `Next.js`, `Tailwind CSS`) without hallucinating irrelevant courses.
   * Precomputed 8,370 course embeddings matrix with SHA-256 dataset hash validation.

4. **Dual-Layer AI Safety & Factual Guardrails**:
   * **PII Redaction**: Strips Malaysian NRIC numbers, emails, phone numbers, and street addresses before any LLM processing.
   * **Post-Extraction Verification Gate**: Automatically discards hallucinated skills or non-canonical tokens.
   * **Factual Fidelity Guard**: Rejects ungrounded numbers, fabricated courses, or banned marketing buzzwords (`"emerging"`, `"fast-growing"`), cleanly reverting to deterministic templates.

5. **RunPod Cloud & Local CPU Flexibility**:
   * CPU-only FastAPI service communicates asynchronously with RunPod Serverless vLLM worker (`Qwen/Qwen2.5-7B-Instruct`).
   * Operates completely offline on CPU when running locally without a GPU.

---

## 5. Local Setup & Quickstart

### Prerequisites
* Python 3.10+ (Python 3.11 recommended)
* Git

### Installation
```bash
# Clone repository
git clone https://github.com/CJYJas/malaysia-workforce-platform.git
cd XMUM_Hack

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env
```

### Environment Configuration (`.env`)
Populate your [`.env`](file:///c:/Documents/Jasmine/XMUM_Hack/.env) file:
```bash
# Server & Network
PORT=8000
HOST=0.0.0.0
CORS_ORIGINS=["https://replit.com","http://localhost:3000","http://localhost:5173"]

# Active Course Retriever: hybrid (default) | dense | tfidf
RETRIEVER=hybrid

# RunPod Authentication & Endpoint
RUNPOD_API_KEY=your_runpod_api_key
RUNPOD_ENDPOINT_ID=your_serverless_endpoint_id
RUNPOD_TIMEOUT_SECONDS=60.0
LLM_MODEL_NAME=Qwen/Qwen2.5-7B-Instruct

# Hugging Face Access Token (Optional: prevents download rate limits)
HF_TOKEN=your_huggingface_token
```

### Run Automated Tests
```bash
python -m pytest tests -v
```
*Current test suite: **105 passed in ~48 seconds (100% pass rate across 15 test suites)**.*

### Start Local Development Server
```bash
uvicorn app.api:app --host 0.0.0.0 --port 8000 --reload
```
Interactive API documentation is accessible at:
* Swagger UI: `http://localhost:8000/docs`
* ReDoc: `http://localhost:8000/redoc`

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

1. **Docker Container**: Build and deploy using the provided [Dockerfile](file:///c:/Documents/Jasmine/XMUM_Hack/Dockerfile).
2. **Bootstrap Script**: Container automatically runs [scripts/bootstrap.sh](file:///c:/Documents/Jasmine/XMUM_Hack/scripts/bootstrap.sh) to mount Network Volume data and launch Uvicorn.
3. **vLLM Serverless Worker**: Configured with `Min Workers: 0` and `Idle Timeout: 60s` to scale to zero when idle, minimizing costs.

For step-by-step setup, Network Volume configuration, and curl smoke tests, see **[docs/RUNPOD.md](file:///c:/Documents/Jasmine/XMUM_Hack/docs/RUNPOD.md)**.

---

## 8. AI / ML Usage & Safety Transparency

In compliance with hackathon and production ethics guidelines, the platform transparently discloses the exact role of AI models:

| Component | Technology | Role & Safeguards |
| :--- | :--- | :--- |
| **Market Intelligence** | Deterministic Python / Pandas | Strictly frequency-based statistics. Never uses AI to invent trends or demand. |
| **Role Normalization** | Multi-Tier `RoleNormalizer` | Normalizes queries (`data en` $\to$ `Data Engineer`) via canonical, alias, token-prefix, regex, and fuzzy matching. |
| **Role Matching** | Deterministic Weighted Vector Math | $70\%$ coverage + $30\%$ TF-IDF cosine. Binding legal disclaimer (*not a hiring probability*). |
| **Course Retrieval** | `all-MiniLM-L6-v2` (ONNX CPU) & RRF | Hybrid dense + lexical ranking. Annotated with `match_signal` (`both`, `keyword`, `semantic`). Returns `[]` for non-existent courses (zero hallucinations). |
| **Profile Parsing** | Open-Weight `Qwen2.5-7B-Instruct` | Extracts skills from text. **Post-extraction verification gate** discards any non-canonical or hallucinated skill. Falls back to dictionary extractor on error. |
| **Executive Narration** | Open-Weight `Qwen2.5-7B-Instruct` | Summarizes deterministic facts. **Factual fidelity checker** verifies all numbers and entities exist in input data; rejects subjective buzzwords. |

---

## 9. Performance Benchmarks

Directly measured empirical benchmarks (zero fabricated numbers) recorded in **[docs/BENCHMARKS.md](file:///c:/Documents/Jasmine/XMUM_Hack/docs/BENCHMARKS.md)**:

* **Memory Usage**: ~185 MB steady-state RAM (runs comfortably on minimal CPU instances).
* **Dense Course Retrieval Latency**: **6.9 ms** (vs 104 ms TF-IDF baseline).
* **Profile Verification Latency**: **1.48 ms** end-to-end.
* **Test Coverage**: **105 automated unit and integration tests passing (100% pass rate)**.

---

## 10. Documentation Index

* **[document/API.md](file:///c:/Documents/Jasmine/XMUM_Hack/document/API.md)**: Comprehensive REST API endpoint reference with curl examples.
* **[docs/RUNPOD.md](file:///c:/Documents/Jasmine/XMUM_Hack/docs/RUNPOD.md)**: RunPod deployment guide, vLLM worker setup, and pre-demo checklist.
* **[docs/BENCHMARKS.md](file:///c:/Documents/Jasmine/XMUM_Hack/docs/BENCHMARKS.md)**: Empirical latency, memory, and throughput benchmarks.
* **[document/DATASETS.md](file:///c:/Documents/Jasmine/XMUM_Hack/document/DATASETS.md)**: Dataset provenance, licensing, and schema verification.
* **[document/Agents.md](file:///c:/Documents/Jasmine/XMUM_Hack/document/Agents.md)**: Platform rules, engineering constraints, and verification checklist.
