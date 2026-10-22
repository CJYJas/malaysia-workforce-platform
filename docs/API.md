# Malaysia Tech Workforce Intelligence Platform - REST API Documentation

**Base URL:** `http://localhost:8000` (or RunPod assigned host)  
**Interactive Docs:** `GET /docs` (Swagger UI) / `GET /redoc` (ReDoc)  
**Governing Constraints:** Zero hardcoded metrics, strict disclosure of denominators & deduplication policies, zero subjective labels (`emerging`, `fast-growing`, `latest`, `currently in demand`).

---

## 1. System Endpoints

### 1.1 Service Health Check
* **Endpoint:** `GET /health`
* **Description:** Verifies service availability and indicates whether processed Malaysian job posting data is currently loaded in memory.
* **Response (Data Loaded):**
```json
{
  "status": "healthy",
  "service": "malaysia-workforce-intelligence",
  "version": "1.0.0",
  "timestamp_utc": "2026-10-22T02:42:38.200026+00:00",
  "data_loaded": true,
  "total_postings": 63852,
  "target_roles_postings": 1553,
  "retriever_active": "tfidf",
  "embeddings_loaded": true,
  "llm_enabled": true,
  "llm_reachable": true,
  "device": "cpu",
  "platform": "runpod"
}
```
* **Response (Server Started Without Data):**
```json
{
  "status": "healthy",
  "service": "malaysia-workforce-intelligence",
  "version": "1.0.0",
  "timestamp_utc": "2026-10-22T02:42:38.200026+00:00",
  "data_loaded": false,
  "total_postings": null,
  "target_roles_postings": null,
  "retriever_active": "tfidf",
  "embeddings_loaded": false,
  "llm_enabled": false,
  "llm_reachable": null,
  "device": "cpu",
  "platform": "local"
}
```

---

### 1.2 Platform Processing Metadata
* **Endpoint:** `GET /metadata`
* **Description:** Returns pipeline version, configuration SHA-256 hash, dataset licenses, deduplication policy, date coverage, and supported roles list.
* **Response:**
```json
{
  "pipeline_version": "1.0.0",
  "config_hash": "db0b2e8411f37ed1b6fda848562c6f2c75a3beabe23df9de0228a8b3d7827b9d",
  "data_loaded": true,
  "dataset_licenses": {
    "jobstreet_all_job_dataset.csv": "Not specified / Web scraped from JobStreet Malaysia",
    "CourseraDataset-Clean.csv": "Not specified / Kaggle (elvinrustam/coursera-dataset)",
    "JobsDatasetProcessed.csv": "Apache 2.0 (meerawks/it-skills-from-jobs on Kaggle)",
    "Job Posting.csv": "Commercial teaser / Restricted (Techsalerator)"
  },
  "deduplication_policy": {
    "key": ["job_title", "company", "location"],
    "keep": "first",
    "rationale": "Deduplicate on job_title, company, and location to eliminate re-advertisements."
  },
  "date_coverage": {
    "valid_dates_count": 63852,
    "min_date": "2023-03-23 19:44:00+00:00",
    "max_date": "2025-05-08 11:12:22+00:00",
    "months_count": 19,
    "min_months_for_trends_threshold": 3,
    "has_sufficient_trend_data": true
  },
  "supported_roles": [
    "Software Engineer / Developer",
    "Data Engineer",
    "Data Scientist",
    "Machine Learning / AI Engineer",
    "Cloud Engineer"
  ]
}
```

---

## 2. Roles Catalog

### 2.1 List Supported Roles
* **Endpoint:** `GET /roles`
* **Description:** Returns all supported Malaysian tech roles, including descriptions, eligible sample counts, and statistical adequacy flags.
* **Response:**
```json
{
  "total_roles": 5,
  "roles": [
    {
      "role": "Software Engineer / Developer",
      "description": "Builds and maintains software applications, services, and digital products across web, mobile, and backend platforms.",
      "priority": 1,
      "eligible_postings_count": 1326,
      "sample_adequacy_status": "Adequate",
      "sample_size_warning": false
    },
    {
      "role": "Data Engineer",
      "description": "Designs, constructs, and maintains scalable data architectures, ingestion pipelines, and ETL/ELT workflows.",
      "priority": 2,
      "eligible_postings_count": 104,
      "sample_adequacy_status": "Adequate",
      "sample_size_warning": false
    },
    {
      "role": "Data Scientist",
      "description": "Applies statistical modeling, machine learning algorithms, and exploratory data analysis to derive business insights.",
      "priority": 3,
      "eligible_postings_count": 56,
      "sample_adequacy_status": "Adequate",
      "sample_size_warning": false
    },
    {
      "role": "Machine Learning / AI Engineer",
      "description": "Develops, trains, evaluates, and deploys machine learning models and artificial intelligence systems into production.",
      "priority": 4,
      "eligible_postings_count": 32,
      "sample_adequacy_status": "Adequate",
      "sample_size_warning": true
    },
    {
      "role": "Cloud Engineer",
      "description": "Architects, provisions, automates, and operates cloud infrastructure, container platforms, and DevOps environments.",
      "priority": 5,
      "eligible_postings_count": 35,
      "sample_adequacy_status": "Adequate",
      "sample_size_warning": true
    }
  ]
}
```

---

## 3. Skills Demand & Analytics

### 3.1 Skill Demand for a Role
* **Endpoint:** `GET /skills/demand`
* **Query Parameters:**
  - `role` (string, required): e.g. `Software Engineer / Developer`
  - `top_n` (integer, optional, default: 20): Maximum number of top skills to return.
  - `window` (string, optional): `all` or `representative_2024` (Feb-Jun 2024 peak).
  - `compare_with` (string, optional): Second role to compare with.
* **Example Request:**
  `GET /skills/demand?role=Software%20Engineer%20/%20Developer&top_n=5`
* **Response:**
```json
{
  "status": "success",
  "role": "Software Engineer / Developer",
  "time_window": "2023-03 to 2025-05 (All Available)",
  "denominator": 1326,
  "deduplication_policy": "job_title, company, location",
  "sample_size_warning": false,
  "warning_message": null,
  "skills_count": 5,
  "skills": [
    {
      "rank": 1,
      "skill": "JavaScript",
      "category": "Programming Languages",
      "mention_count": 608,
      "posting_share": 0.4585,
      "posting_share_percentage": 45.85
    },
    {
      "rank": 2,
      "skill": "HTML",
      "category": "Web Technologies",
      "mention_count": 468,
      "posting_share": 0.3529,
      "posting_share_percentage": 35.29
    },
    {
      "rank": 3,
      "skill": "CSS",
      "category": "Web Technologies",
      "mention_count": 459,
      "posting_share": 0.3462,
      "posting_share_percentage": 34.62
    },
    {
      "rank": 4,
      "skill": "Java",
      "category": "Programming Languages",
      "mention_count": 449,
      "posting_share": 0.3386,
      "posting_share_percentage": 33.86
    },
    {
      "rank": 5,
      "skill": "C#",
      "category": "Programming Languages",
      "mention_count": 347,
      "posting_share": 0.2617,
      "posting_share_percentage": 26.17
    }
  ]
}
```

* **Example Response with Sample Size Warning (e.g. Machine Learning Engineer):**
```json
{
  "status": "success",
  "role": "Machine Learning / AI Engineer",
  "time_window": "2023-03 to 2025-05 (All Available)",
  "denominator": 32,
  "deduplication_policy": "job_title, company, location",
  "sample_size_warning": true,
  "warning_message": "Small sample size (N = 32 < 50). Findings should be interpreted with caution.",
  "skills_count": 3,
  "skills": [
    {
      "rank": 1,
      "skill": "Artificial Intelligence",
      "category": "Machine Learning & AI",
      "mention_count": 29,
      "posting_share": 0.9062,
      "posting_share_percentage": 90.62
    },
    {
      "rank": 2,
      "skill": "Machine Learning",
      "category": "Machine Learning & AI",
      "mention_count": 28,
      "posting_share": 0.875,
      "posting_share_percentage": 87.5
    },
    {
      "rank": 3,
      "skill": "Python",
      "category": "Programming Languages",
      "mention_count": 20,
      "posting_share": 0.625,
      "posting_share_percentage": 62.5
    }
  ]
}
```

* **Example Response for Role with Insufficient Postings (`N < min_postings_per_role`):**
```json
{
  "status": "insufficient_evidence",
  "role": "Quantum Computing Engineer",
  "postings_count": 8,
  "min_postings_required": 30,
  "message": "Insufficient postings in Malaysian job market data for 'Quantum Computing Engineer' (N = 8 < 30 required). Findings cannot be statistically supported.",
  "deduplication_policy": "job_title, company, location",
  "skills": []
}
```

---

### 3.2 Historical Demand Trends
* **Endpoint:** `GET /skills/trends`
* **Query Parameters:**
  - `role` (string, required): e.g. `Data Engineer`
  - `skill` (string, optional): Specific skill to track (e.g. `SQL`)
  - `window` (string, optional): `all` or `representative_2024`
* **Example Request:**
  `GET /skills/trends?role=Data%20Engineer&skill=SQL`
* **Response (Sufficient Dates):**
```json
{
  "status": "success",
  "role": "Data Engineer",
  "time_window": "2024-02 to 2024-06",
  "months_covered": 5,
  "denominator": 104,
  "deduplication_policy": "job_title, company, location",
  "sample_size_warning": false,
  "warning_message": null,
  "monthly_trends": [
    {
      "month": "2024-02",
      "total_role_postings": 12,
      "sample_size_warning": false,
      "skills": [
        {
          "skill": "SQL",
          "mentions": 10,
          "posting_share": 0.8333,
          "posting_share_percentage": 83.33
        }
      ]
    },
    {
      "month": "2024-03",
      "total_role_postings": 45,
      "sample_size_warning": false,
      "skills": [
        {
          "skill": "SQL",
          "mentions": 35,
          "posting_share": 0.7778,
          "posting_share_percentage": 77.78
        }
      ]
    }
  ]
}
```

* **Response (Insufficient Date Data - Graceful Fallback):**
```json
{
  "status": "insufficient_date_data",
  "role": "Cloud Engineer",
  "demand_label": "frequency-based",
  "reason": "Fewer than 3 reliable monthly observation periods found for role 'Cloud Engineer' (found: 1 months). Historical longitudinal trend cannot be reliably constructed.",
  "denominator": 35,
  "deduplication_policy": "job_title, company, location",
  "sample_size_warning": true,
  "warning_message": "Small sample size (N = 35).",
  "frequency_based_demand": [
    {
      "rank": 1,
      "skill": "AWS",
      "category": "Cloud & DevOps",
      "mention_count": 22,
      "posting_share": 0.6286,
      "posting_share_percentage": 62.86
    }
  ]
}
```

---

### 3.3 Role-to-Role Skill Comparison
* **Endpoint:** `GET /skills/compare` (also available via `GET /skills/demand?role=...&compare_with=...`)
* **Query Parameters:**
  - `role1` (string, required): e.g. `Data Engineer`
  - `role2` (string, required): e.g. `Data Scientist`
  - `top_n` (integer, optional, default: 15)
* **Example Request:**
  `GET /skills/compare?role1=Data%20Engineer&role2=Data%20Scientist&top_n=3`
* **Response:**
```json
{
  "status": "success",
  "role1": "Data Engineer",
  "role2": "Data Scientist",
  "denominator_role1": 104,
  "denominator_role2": 56,
  "deduplication_policy": "job_title, company, location",
  "sample_size_disparity_warning": false,
  "warning_message": null,
  "comparison": [
    {
      "skill": "Python",
      "category": "Programming Languages",
      "role1_mentions": 56,
      "role1_posting_share": 0.5385,
      "role1_share_percentage": 53.85,
      "role2_mentions": 44,
      "role2_posting_share": 0.7857,
      "role2_share_percentage": 78.57,
      "share_difference_percentage": -24.72
    },
    {
      "skill": "SQL",
      "category": "Databases & Query",
      "role1_mentions": 78,
      "role1_posting_share": 0.75,
      "role1_share_percentage": 75.0,
      "role2_mentions": 28,
      "role2_posting_share": 0.5,
      "role2_share_percentage": 50.0,
      "share_difference_percentage": 25.0
    },
    {
      "skill": "ETL",
      "category": "Data Engineering & Big Data",
      "role1_mentions": 63,
      "role1_posting_share": 0.6058,
      "role1_share_percentage": 60.58,
      "role2_mentions": 8,
      "role2_posting_share": 0.1429,
      "role2_share_percentage": 14.29,
      "share_difference_percentage": 46.29
    }
  ],
  "common_skills": ["Python", "SQL", "ETL"],
  "unique_to_role1": [],
  "unique_to_role2": []
}
```

---

## 4. Profile Analysis, Role Matching & Skill Gap Remediation (JSON API)

### 4.1 Normalize & Analyze Candidate Profile Skills
* **Endpoint:** `POST /profile/analyze`
* **Description:** Normalizes candidate surface skills to canonical vocabulary terms and isolates unrecognized tokens.
* **Request:**
```json
{
  "skills": ["python", "js", "react", "docker", "unknown_tool_xyz"],
  "experience_years": 3.5,
  "education": "Bachelor's Degree"
}
```
* **Response:**
```json
{
  "status": "success",
  "raw_skills_count": 5,
  "normalized_skills": ["Python", "JavaScript", "React", "Docker"],
  "unrecognized_skills": ["unknown_tool_xyz"],
  "experience_years": 3.5,
  "education": "Bachelor's Degree"
}
```

---

### 4.2 Parse Candidate Bio / Text with LLM Extraction & Verification Gate
* **Endpoint:** `POST /profile/parse`
* **Description:** Parses unstructured candidate bios or resumes using LLM extraction. Pre-redacts all PII (email, phone, NRIC, address). Uses system prompt with strict injection defense. Enforces post-extraction verification gate: rejects non-canonical or hallucinated skills (lacking verbatim evidence). Bounds experience [0, 50]. Falls back to dictionary extractor on schema error, injection attempt, or timeout.
* **Request:**
```json
{
  "raw_text": "Experienced Cloud Data Engineer with 4 years designing pipelines using Python, SQL, and Docker. Contact: test@example.com."
}
```
* **Response:**
```json
{
  "status": "success",
  "method": "llm_extraction_verified",
  "fallback_reason": null,
  "skills": ["Docker", "Python", "SQL"],
  "skill_evidence": {
    "Python": ["Python"],
    "SQL": ["SQL"],
    "Docker": ["Docker"]
  },
  "experience_years": 4.0,
  "education": null,
  "latency_ms": 112.5,
  "privacy_note": "Profile data is processed in-memory for extraction only and is not persisted or used for training."
}
```

---

### 4.3 Analyze Skill Gaps for a Target Role
* **Endpoint:** `POST /skills/gap`
* **Description:** Categorizes missing skills against empirical JobStreet Malaysian postings for the specified target role into core ($\ge 25\%$), recommended ($10\% - 25\%$), and optional ($< 10\%$) skills, and calculates the candidate's empirical coverage percentage.
* **Request:**
```json
{
  "target_role": "Data Engineer",
  "current_skills": ["Python", "SQL"]
}
```
* **Response:**
```json
{
  "status": "success",
  "target_role": "Data Engineer",
  "evidence_sample_size": 104,
  "sample_size_warning": false,
  "warning_message": null,
  "candidate_skills": ["Python", "SQL"],
  "matched_skills": [
    {
      "skill": "SQL",
      "category": "Databases & Query",
      "empirical_posting_share": 0.75,
      "posting_share_percentage": 75.0
    },
    {
      "skill": "Python",
      "category": "Programming Languages",
      "empirical_posting_share": 0.5385,
      "posting_share_percentage": 53.85
    }
  ],
  "matched_skills_count": 2,
  "core_gaps": [
    {
      "skill": "ETL",
      "category": "Data Engineering & Big Data",
      "empirical_posting_share": 0.6058,
      "posting_share_percentage": 60.58
    },
    {
      "skill": "Data Warehouse",
      "category": "Data Engineering & Big Data",
      "empirical_posting_share": 0.3558,
      "posting_share_percentage": 35.58
    }
  ],
  "core_gaps_count": 2,
  "recommended_gaps": [
    {
      "skill": "AWS",
      "category": "Cloud & Infrastructure",
      "empirical_posting_share": 0.2308,
      "posting_share_percentage": 23.08
    }
  ],
  "recommended_gaps_count": 1,
  "optional_gaps": [],
  "optional_gaps_count": 0,
  "total_gaps_count": 3,
  "coverage_percentage": 40.0,
  "method": "deterministic_skill_gap"
}
```

---

### 4.3 Match Profile to Roles with Explainable Scoring
* **Endpoint:** `POST /roles/match`
* **Description:** Ranks target Malaysian tech roles for a candidate profile using empirical posting profiles. Combines skill coverage (70%) and TF-IDF cosine similarity (30%), accompanied by a statutory disclaimer.
* **Request:**
```json
{
  "skills": ["Python", "SQL", "Apache Spark", "AWS"],
  "experience_years": 4.0,
  "top_k": 3
}
```
* **Response:**
```json
{
  "status": "success",
  "candidate_profile": {
    "normalized_skills": ["Python", "SQL", "Apache Spark", "AWS"],
    "skill_count": 4,
    "experience_years": 4.0
  },
  "disclaimer": "This match score reflects empirical alignment with historical Malaysian tech job postings (JobStreet 2023-2025). It is NOT a hiring probability, candidate ranking, or predictor of employment success.",
  "total_roles_evaluated": 5,
  "ranked_matches": [
    {
      "role": "Data Engineer",
      "match_score": 52.8,
      "score_components": {
        "skill_coverage": 0.60,
        "tfidf_cosine": 0.36,
        "weights": { "skill_coverage": 0.7, "tfidf_cosine": 0.3 }
      },
      "evidence_sample_size": 104,
      "sample_size_warning": false,
      "warning_message": null,
      "matched_skills": [
        { "skill": "SQL", "category": "Databases & Query", "empirical_posting_share": 0.75, "posting_share_percentage": 75.0 },
        { "skill": "Python", "category": "Programming Languages", "empirical_posting_share": 0.5385, "posting_share_percentage": 53.85 },
        { "skill": "Apache Spark", "category": "Data Engineering & Big Data", "empirical_posting_share": 0.2308, "posting_share_percentage": 23.08 },
        { "skill": "AWS", "category": "Cloud & Infrastructure", "empirical_posting_share": 0.2308, "posting_share_percentage": 23.08 }
      ],
      "matched_skills_count": 4,
      "core_gaps": [
        { "skill": "ETL", "category": "Data Engineering & Big Data", "empirical_posting_share": 0.6058, "posting_share_percentage": 60.58 },
        { "skill": "Data Warehouse", "category": "Data Engineering & Big Data", "empirical_posting_share": 0.3558, "posting_share_percentage": 35.58 }
      ],
      "recommended_gaps": [],
      "total_gaps_count": 2
    }
  ],
  "insufficient_evidence_roles": [],
  "method": "deterministic_matching"
}
```

---

### 4.4 Generate Skill-Gap Learning Roadmap
* **Endpoint:** `POST /roadmap/generate`
* **Description:** Identifies skill gaps for a target role, retrieves verified Coursera courses, organizes courses using prerequisite heuristic sequence, and attaches documented UN SDG alignments.
* **Request:**
```json
{
  "target_role": "Data Engineer",
  "current_skills": ["Python"],
  "max_courses": 4
}
```
* **Response:**
```json
{
  "status": "success",
  "target_role": "Data Engineer",
  "evidence_sample_size": 104,
  "total_gaps_identified": 6,
  "ordered_pathway": [
    {
      "step_number": 1,
      "source_record_id": "coursera_45",
      "course_title": "SQL for Data Science",
      "course_url": "https://www.coursera.org/learn/sql-for-data-science",
      "gap_addressed": "SQL",
      "why_recommended": "Directly addresses your skill gap in 'SQL' (required in 75.0% of Malaysian Data Engineer postings).",
      "skills_gained": "SQL, Data Analysis, SQLite",
      "difficulty_level": "Beginner level",
      "rating": 4.6,
      "duration": "Approx. 14 hours to complete",
      "offered_by": "University of California, Davis",
      "relevance_score": 9.5
    }
  ],
  "unresolved_skill_gaps": [],
  "pathway_ordering_label": "heuristic, not a validated sequence",
  "ordering_disclaimer": "Course sequences are prioritized by prerequisite fundamentals (programming and querying before advanced systems). This is a pedagogical heuristic, not a scientifically validated learning sequence.",
  "sdg_alignments": [
    {
      "sdg_number": 8,
      "target": "8.5",
      "sdg_title": "Decent Work and Economic Growth",
      "rationale": "High-value digital engineering skills support sustainable technological productivity and decent work.",
      "sources": ["UN Sustainable Development Goals Knowledge Platform (2015)"],
      "mapping_type": "documented_mapping",
      "measured_impact": false
    }
  ],
  "sdg_disclaimer": "SDG alignments reflect potential documented relevance to UN Sustainable Development Goal targets. They do not constitute measured or certified social impact.",
  "method": "deterministic_recommender"
}
```

---

## 5. PDF Resume Extraction & Direct Analytics

### 5.1 Upload and Parse PDF Resume
* **Endpoint:** `POST /profile/upload-resume`
* **Content-Type:** `multipart/form-data`
* **Parameters:**
  * `file`: Uploaded PDF resume binary file (`.pdf`)
* **Description:** Extracts raw text from an uploaded PDF resume, identifies canonical skills, retains verbatim matching evidence, and heuristically detects years of experience and education level.
* **Curl Example:**
```bash
curl -X POST "http://localhost:8000/profile/upload-resume" \
     -F "file=@/path/to/my_resume.pdf"
```
* **Response:**
```json
{
  "status": "success",
  "filename": "my_resume.pdf",
  "page_count": 2,
  "text_length": 1850,
  "extracted_skills": ["AWS", "Apache Spark", "Docker", "Python", "SQL"],
  "skill_evidence": {
    "Python": ["Python", "python"],
    "SQL": ["SQL"],
    "Docker": ["Docker"],
    "Apache Spark": ["Spark"],
    "AWS": ["AWS"]
  },
  "skill_count": 5,
  "experience_years": 4.0,
  "detected_education": "Bachelor's Degree",
  "warning": null
}
```

---

### 5.2 Match PDF Resume to Tech Roles
* **Endpoint:** `POST /roles/match-resume`
* **Content-Type:** `multipart/form-data`
* **Parameters:**
  * `file`: Uploaded PDF resume file (`.pdf`)
  * `top_k`: Optional integer (default 5, range 1-10)
  * `experience_years_override`: Optional float override
* **Description:** Directly uploads a PDF resume and performs empirical role matching against all supported Malaysian tech roles. Returns ranked roles, component scores, matched skills, missing core/recommended gaps, and resume extraction metadata.
* **Curl Example:**
```bash
curl -X POST "http://localhost:8000/roles/match-resume" \
     -F "file=@/path/to/candidate_resume.pdf" \
     -F "top_k=3"
```

---

### 5.3 Skill Gap Analysis from PDF Resume
* **Endpoint:** `POST /skills/gap-resume`
* **Content-Type:** `multipart/form-data`
* **Parameters:**
  * `file`: Uploaded PDF resume file (`.pdf`)
  * `target_role`: Target tech role title (e.g. `"Data Engineer"`)
* **Description:** Directly uploads a PDF resume, parses canonical skills with evidence retention, and performs empirical skill gap analysis against the target role.
* **Curl Example:**
```bash
curl -X POST "http://localhost:8000/skills/gap-resume" \
     -F "file=@/path/to/candidate_resume.pdf" \
     -F "target_role=Data Engineer"
```
* **Response:**
```json
{
  "status": "success",
  "target_role": "Data Engineer",
  "filename": "candidate_resume.pdf",
  "page_count": 1,
  "evidence_sample_size": 104,
  "sample_size_warning": false,
  "warning_message": null,
  "extracted_skills": ["Apache Spark", "AWS", "Docker", "Python", "SQL"],
  "skill_evidence": {
    "Python": ["Python"],
    "SQL": ["SQL"],
    "Apache Spark": ["Apache Spark"],
    "AWS": ["AWS"],
    "Docker": ["Docker"]
  },
  "experience_years": 4.0,
  "detected_education": "Bachelor's Degree",
  "matched_skills": [
    { "skill": "SQL", "category": "Databases & Query", "empirical_posting_share": 0.75, "posting_share_percentage": 75.0 },
    { "skill": "Python", "category": "Programming Languages", "empirical_posting_share": 0.5385, "posting_share_percentage": 53.85 },
    { "skill": "Apache Spark", "category": "Data Engineering & Big Data", "empirical_posting_share": 0.2308, "posting_share_percentage": 23.08 },
    { "skill": "AWS", "category": "Cloud & Infrastructure", "empirical_posting_share": 0.2308, "posting_share_percentage": 23.08 }
  ],
  "matched_skills_count": 4,
  "core_gaps": [
    { "skill": "ETL", "category": "Data Engineering & Big Data", "empirical_posting_share": 0.6058, "posting_share_percentage": 60.58 },
    { "skill": "Data Warehouse", "category": "Data Engineering & Big Data", "empirical_posting_share": 0.3558, "posting_share_percentage": 35.58 }
  ],
  "core_gaps_count": 2,
  "recommended_gaps": [],
  "recommended_gaps_count": 0,
  "optional_gaps": [],
  "optional_gaps_count": 0,
  "total_gaps_count": 2,
  "coverage_percentage": 66.67,
  "method": "deterministic_skill_gap_from_resume"
}
```

---

### 5.4 Generate Learning Roadmap from PDF Resume
* **Endpoint:** `POST /roadmap/generate-from-resume`
* **Content-Type:** `multipart/form-data`
* **Parameters:**
  * `file`: Uploaded PDF resume file (`.pdf`)
  * `target_role`: Target tech role title (e.g. `"Data Engineer"`)
  * `max_courses`: Optional integer (default 8, range 1-20)
* **Description:** Directly uploads a PDF resume, identifies candidate skill gaps against empirical role requirements, retrieves verified Coursera courses for the gaps, and attaches heuristic sequencing and UN SDG alignments.
* **Curl Example:**
```bash
curl -X POST "http://localhost:8000/roadmap/generate-from-resume" \
     -F "file=@/path/to/candidate_resume.pdf" \
     -F "target_role=Data Engineer" \
     -F "max_courses=4"
```

---

## 6. Error Responses

### 6.1 Role Not Found (404)
When querying an unsupported or misspelled role title:
```json
{
  "error": "RoleNotFound",
  "message": "Role 'Software Ninja' is not supported. Please choose from supported roles.",
  "supported_roles": [
    "Software Engineer / Developer",
    "Data Engineer",
    "Data Scientist",
    "Machine Learning / AI Engineer",
    "Cloud Engineer"
  ]
}
```

### 6.2 Processed Dataset Missing (503)
When the API server starts before the pipeline is executed:
```json
{
  "error": "DataNotLoaded",
  "message": "Processed job market data is not loaded yet. Please run data pipeline (`python -m app.pipeline`) to generate dataset.",
  "data_loaded": false
}
```

### 6.3 Validation Error (422)
When required query parameters are missing or out of valid ranges:
```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["query", "role"],
      "msg": "Field required",
      "input": null
    }
  ]
}
```

### 6.4 Invalid Resume File / Format (400)
When an unsupported non-PDF file or empty/scanned document is uploaded:
```json
{
  "detail": "Invalid file type. Only PDF resume files (.pdf) are supported."
}
```

---

## 7. Execution Method & Fallback Governance Transparency

In compliance with strict platform auditing rules, every response returned by the platform explicitly reports the algorithm or model that generated it via the `"method"` field, and populates `"fallback_reason"` if an AI model failed or violated guardrails.

### 7.1 Method Values Taxonomy

| Endpoint Group | `method` Value | Description & Determinism Guarantee |
| :--- | :--- | :--- |
| **Profile Parsing** | `llm_extraction_verified` | Extracted by LLM and validated by post-extraction verification gate (canonical vocabulary + verbatim input evidence check). |
| | `dictionary_fallback` | Generated purely by deterministic dictionary extractor following an LLM error or guardrail trigger. |
| **Role Matching** | `deterministic_matching` | Calculated via deterministic $70\%$ coverage + $30\%$ TF-IDF cosine formula. |
| | `deterministic_matching_from_resume` | Extracted from PDF resume and scored deterministically. |
| **Roadmap Generation** | `deterministic_recommender` | Retrieved from authentic Coursera dataset using active retriever (`tfidf`, `dense`, `hybrid`). |
| **Narration / Summaries** | `verified_llm_narration` | Executive summary generated by LLM and verified by factual fidelity guardrail. |
| | `deterministic_template` | Purely rule-based template summary using verified statistical facts. |

### 7.2 Fallback Reasons Taxonomy

When `"fallback_reason"` is non-null, the platform transparently explains why a deterministic fallback was triggered:

| `fallback_reason` Code | Trigger Condition & Safety Enforcement |
| :--- | :--- |
| `prompt_injection_attempt_detected` | Input contained prompt injection patterns (e.g. *"ignore previous instructions"*). |
| `factual_fidelity_violation` | LLM narration attempted to introduce an ungrounded number, percentage, or fabricated statistic. |
| `banned_phrase_detected` | LLM narration included prohibited subjective hype terms (`"emerging"`, `"fast-growing"`, `"guaranteed hire"`). |
| `invalid_llm_json_output` | LLM returned malformed JSON or failed to adhere to the strict output schema. |
| `llm_service_error_TimeoutError` | RunPod serverless worker timed out during cold-start or heavy queueing. |


