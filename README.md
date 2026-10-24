> [!IMPORTANT]
> ## 📁 Official Submission Documents & Deliverables
> **All official submission proposals, technical declarations, slide decks, and proofs of use for Team Powerstrangers are accessible in the Google Drive folder below:**
>
> ### 👉 [**OPEN SUBMISSION GOOGLE DRIVE FOLDER**](https://drive.google.com/drive/folders/1W2apstHq5FjAP19sp99vLAm_CzGRXjf7?usp=sharing) 👈

---

# FutureReady MY — Malaysia Tech Workforce Intelligence Platform

> An empirical, AI-assisted career analytics and upskilling ecosystem that grounds tech career transitions in 63,852 Malaysian job postings and traceable, verified learning pathways for students, job seekers, and career changers.

---

## Team Information

| Field                  | Details                                     |
| ---------------------- | ------------------------------------------- |
| **Team Name**          | Powerstrangers                              |
| **Team Domain**        | Domain 1 – Future-Ready Workforce Domain    |
| **SDG Track (1–17)**   | SDG 4 — Quality Education *(Target 4.4, with secondary alignment to SDG 8 & SDG 9)* |
| **Team Leader**        | Mak Jia Hng                                 |
| **University**         | University of Malaya, University Tunku Abdul Rahman, Xiamen University Malaysia |
| **Number of Members**  | 5                                           |

## Links

| Resource          | Link                                           |
| ----------------- | ---------------------------------------------- |
| GitHub Repository | https://github.com/CJYJas/malaysia-workforce-platform |
| Live Demo         | https://xvu8eu1rakfbfc-8000.proxy.runpod.net   |
| RunPod Endpoint   | https://api.runpod.ai/v2/vllm-qwen2-5-7b/openai/v1 |
| Slide Deck        | https://drive.google.com/file/d/16Z32uECBQOPHcBRlcOiit74u6vkUjDCb/view?usp=drivesdk |
| Demo Video        | https://youtu.be/Rq44yEZXFb8 |

---

## Overview

### Problem

Malaysia’s technology job seekers, students, and career changers often make upskilling decisions using fragmented information, generic global trend reports, and oversized course catalogues that do not reflect actual local employer demand. This lack of transparency leads learners to spend time and money on mismatched courses without clear evidence of role readiness. This widening mismatch strains Malaysia’s digital economy and limits equitable career mobility for talent without established professional networks.

### Solution

FutureReady MY is an empirical, AI-assisted career analytics and upskilling ecosystem that grounds career transitions in 63,852 deduplicated Malaysian tech job postings and 8,370 authenticated Coursera courses. It provides privacy-first resume extraction (Qwen2.5-7B on RunPod vLLM), deterministic 100-point role-fit matching, and CPU-efficient hybrid semantic course retrieval (MiniLM ONNX + TF-IDF RRF), producing explainable, zero-hallucination learning roadmaps mapped directly to UN SDGs.

### Key Features

- **Empirical Market Evidence & Skills Radar** — Skill shares, demand shifts, and WEF 2025–2030 outlooks derived directly from 63,852 verified Malaysian job postings (zero hallucinated stats).
- **Privacy-First AI Resume Parser** — Open-weight Qwen2.5-7B vLLM extraction with automated Malaysian PII redaction (NRIC, phone, email) and canonical dictionary fallbacks.
- **Explainable 100-Point Role Matching** — Transparent, auditable candidate scoring (75% skill coverage, 15% interests, 10% experience) without black-box generative AI bias.
- **Hybrid Semantic Course Retrieval** — Ultra-fast CPU ONNX dense vector search (`all-MiniLM-L6-v2`) combined with TF-IDF Reciprocal Rank Fusion ($k=60$) over 8,370 courses in <7 ms.
- **Persistent Learning Pathways & Auth** — Argon2id session authentication, persistent checklist progress syncing, and exportable career dossiers.

### Tech Stack

| Layer         | Technology                   |
| ------------- | ---------------------------- |
| Frontend      | React 19, TypeScript, Vite 6, Tailwind CSS v4, Radix UI, TanStack Query |
| Backend       | Python 3.11+, FastAPI 0.109+, Pydantic v2, Uvicorn, Pandas, PyArrow |
| Database      | SQLite (local/dev), PostgreSQL-compatible migrations (SQLAlchemy 2.0 + psycopg 3) |
| AI / Compute  | RunPod Serverless GPU (`Qwen2.5-7B-Instruct` vLLM), CPU ONNX Runtime (`all-MiniLM-L6-v2`) |
| Hosting / Dev | Replit & RunPod Cloud (CPU Pod on port 8000) |

---

## Project Structure

```
.
├── docs/                                          # Technical specifications, benchmarks, dataset docs
│   ├── ACCOUNT_EXTENSION.md
│   ├── API.md
│   ├── BENCHMARKS.md
│   ├── DATASETS.md
│   └── RUNPOD.md
├── runpod/                                        # RunPod serverless & cloud configuration
│   └── (Serverless vLLM Worker: Qwen2.5-7B-Instruct)
├── app/                                           # Application entry point & intelligence services
│   ├── api.py                                     # Main REST API application entry point & unified router
│   ├── auth/                                      # Security, Argon2id, CSRF, and session persistence
│   ├── course_recommender.py                      # Hybrid ONNX dense + TF-IDF RRF course retriever (k=60)
│   ├── resume_parser.py                           # PDF extraction, PII scrubber & vLLM client
│   ├── role_matcher.py                            # Explainable 100-point role matching algorithm
│   └── trend_analyzer.py                          # JobStreet 63k postings empirical market trends
├── frontend/                                      # React 19 + TypeScript + Vite web client workspace
│   ├── artifacts/workforce/                       # Single Page Application client source code
│   └── artifacts/api-server/                      # Express OpenAPI snapshot adapter (:5000)
├── data/                                          # Audited datasets, parquets, taxonomy & ONNX models
├── migrations/                                    # PostgreSQL & SQLite schema migrations
├── scripts/                                       # Preprocessing & retrieval benchmarking scripts
├── submission/                                    # Required SDC hackathon submission documents
│   ├── SDC2026_Powerstrangers_Preliminary.pdf     # Preliminary submission proposal
│   ├── SDC2026_Powerstranger_TechDeclaration.pdf  # Technology & tools declaration
│   ├── SDC2026_Powerstranger_Replit_POU.pdf       # Replit proof of use
│   └── SDC2026_Powerstranger_Runpod_POU.pdf       # RunPod proof of use
├── tests/                                         # Automated unit and integration test suite (110+ tests)
│   ├── test_api.py
│   ├── test_auth_extension.py
│   ├── test_course_recommender.py
│   ├── test_pii_scrubber.py
│   ├── test_resume_parser.py
│   └── test_trend_analyzer.py
├── .env.example                                   # Example environment variables
├── .gitignore
├── .replit                                        # Replit run configuration
├── Dockerfile                                     # Production container build
├── LICENSE                                        # Apache License 2.0
├── requirements.txt                               # Python dependencies
└── README.md
```

### Architecture

```
User ──► Replit / Web App (React 19 Frontend) ──► FastAPI Backend (:8000) ──► RunPod vLLM Endpoint (Qwen2.5-7B GPU)
                                                          │
                                                          ├──► Hybrid Course Retriever (CPU ONNX + RRF)
                                                          ├──► 63,852 JobStreet Dataset (Empirical Demand)
                                                          └──► Response returned to user
```

---

## How to Run

### Option 1 — Run on Replit (Recommended)

1. Open the [Replit Project](https://replit.com/@jasminecjy06/malaysia-workforce-platform), or import this repository via **Create Repl → Import from GitHub**.
2. Open the **Secrets** tab (🔒) and add the variables listed in `.env.example`:
   - `RUNPOD_API_KEY` (Optional for local fallback)
   - `RUNPOD_ENDPOINT_ID` (Optional for local fallback)
3. Click **Run**. Replit uses the `.replit` configuration to start the platform on port 8000.

### Option 2 — Run Locally

```bash
# 1. Clone the repository
git clone https://github.com/CJYJas/malaysia-workforce-platform.git
cd malaysia-workforce-platform

# 2. Create and activate a virtual environment
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment variables
cp .env.example .env            # then fill in your values (or use defaults for offline CPU mode)

# 5. Run the app (serves Frontend UI + Backend API on port 8000)
uvicorn app.api:app --host 0.0.0.0 --port 8000 --reload
```

Open your browser to: **`http://localhost:8000`** (or view interactive OpenAPI docs at `http://localhost:8000/docs`).

### Run Tests

```bash
python -m pytest tests -v
```

---

## How We Use Replit *(Required)*

Describe how your team used Replit:

- **Development:** Collaborative coding in a shared Repl workspace, rapid UI iterations, and real-time multiplayer editing between frontend and backend developers.
- **Hosting:** The full-stack application prototype is served and validated directly within Replit’s cloud environment.
- **Secrets:** API keys, database URLs, and serverless authentication tokens are stored securely in Replit Secrets, never hardcoded in git.

📄 Proof of use: [`submission/SDC2026_Powerstranger_Replit_POU.pdf`](submission/SDC2026_Powerstranger_Replit_POU.pdf)

## How We Use RunPod *(Required)*

Describe how your team used RunPod:

- **Workload:** Open-weight LLM inference (`Qwen/Qwen2.5-7B-Instruct`) running on a dedicated GPU serverless worker for resume skill extraction and verified career narration, plus CPU Pod hosting for the FastAPI intelligence engine.
- **Setup:** Deployed as a **RunPod Serverless Endpoint** with OpenAI-compatible vLLM endpoints and a persistent Network Volume (`/workspace/data`).
- **Integration:** The application sends inference requests to the endpoint using `RUNPOD_API_KEY` and `RUNPOD_ENDPOINT_ID`. If the worker is offline, the system automatically falls back to an offline deterministic dictionary parser.

Example request:

```bash
curl -X POST https://api.runpod.ai/v2/$RUNPOD_ENDPOINT_ID/openai/v1/chat/completions \
  -H "Authorization: Bearer $RUNPOD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen2.5-7B-Instruct",
    "messages": [
      {"role": "system", "content": "You are a specialized technical skills extractor."},
      {"role": "user", "content": "Extract technical skills from: 3 years building APIs with FastAPI, Docker, and PostgreSQL."}
    ],
    "temperature": 0.1
  }'
```

📄 Proof of use: [`submission/SDC2026_Powerstranger_Runpod_POU.pdf`](submission/SDC2026_Powerstranger_Runpod_POU.pdf)

---

## Challenges & Learnings

- **Challenges Faced & Solutions:**
  - *LLM Hallucinations in Career Guidance:* Generic LLMs frequently invent non-existent course titles and exaggerate niche skills. We solved this by enforcing **100% empirical grounding**: market demand is strictly aggregated from 63,852 verified Malaysian postings, and course recommendations are retrieved from an auditable 8,370 Coursera dataset via hybrid MiniLM ONNX + TF-IDF RRF ($k=60$) rather than generative text.
  - *Privacy & PII Protection:* Resume uploads contain sensitive personal data. We built an automated multi-layer regex scrubber that redacts Malaysian NRIC numbers, phone numbers, emails, and physical addresses in memory before any data reaches the RunPod vLLM inference worker.
  - *Cloud Cost & Zero-Credit Resilience:* Cloud GPU endpoints can deplete credits during intensive judging. We engineered the entire architecture to run seamlessly on CPU with deterministic regex/dictionary fallback parsing and local SQLite persistence, guaranteeing $0 cloud cost operation without failure.
- **Team Learnings:**
  - Mastering production LLM deployment via RunPod Serverless vLLM and OpenAI-compatible API schemas.
  - Combining dense semantic vector search (ONNX Runtime) with reciprocal rank fusion for sub-10ms CPU recommendation retrieval.
  - Implementing enterprise-grade session security (Argon2id, CSRF rotation, timing-safe tokens) in Python and React 19.

## Future Improvements

- [ ] Real-time ingestion pipelines connecting to LinkedIn and JobStreet API feeds for continuous market updates.
- [ ] Multilingual parsing support for resumes written in Bahasa Melayu and Simplified Chinese.
- [ ] Integration with Malaysian government initiatives (e.g., MDEC, HRD Corp) for micro-credential sponsorship verification.
- [ ] Fine-tuning Qwen2.5 on localized Malaysian tech job descriptions using LoRA on RunPod GPUs.

## Team

| Name | Role | GitHub |
| ---- | ---- | ------ |
| Mak Jia Hng | Team Leader / Architecture & Backend | [@ivanmaktech](https://github.com/ivanmaktech) |
| Jasmine Chin Jia Yee | Frontend | [@CJYJas](https://github.com/CJYJas) |
| Lai Yan Hang | Documentation | [@infinite-sherry](https://github.com/infinite-sherry) |
| Jaclyn | Documentation | — |
| Rei Wen | Auth, Persistence & Backend | [@reiwen](https://github.com/reiwen) |

---

## Submission Checklist

- [x] Team name, domain (Domain 1 / Domain 2) and SDG track filled in
- [x] Slide deck link added
- [x] Demo video link added
- [x] Replit used, with proof of use in `submission/`
- [x] RunPod used, with proof of use in `submission/`
- [x] Preliminary submission completed (`SDC2026_Powerstrangers_Preliminary.pdf`)
- [x] Technology declaration completed (`SDC2026_Powerstranger_TechDeclaration.pdf`)
- [x] Submission files renamed with your team name (replace `TeamName`)
- [x] "How to Run" steps verified
- [x] No API keys or secrets committed to the repository

## License

This project is licensed under the [Apache License 2.0](LICENSE).
