# Candidate Datasets Inventory & Evaluation Report

**Project:** Malaysia Tech Workforce Intelligence Platform (Hackathon MVP)  
**Date of Inspection:** 2026-10-22  
**Reproducible Inspection Script:** [`scripts/inspect_datasets.py`](../scripts/inspect_datasets.py)  
**Inspection Output Data:** [`scripts/inspection_results.json`](../scripts/inspection_results.json)  

---

## 1. Executive Summary

Every candidate dataset in `data/` was inspected in read-only mode using pandas (`Python 3.13.0`, `pandas 2.2.3`). No synthetic or assumed figures were used.

| Dataset Identifier | Local Filename | File Size | Total Rows | Relevant Malaysia Rows | Confident Malaysia % | Primary Utility for MVP |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `azraimohamad/jobstreet-all-job-dataset` | `jobstreet_all_job_dataset.csv` | 158.80 MB | 69,024 | 46,822 (narrow) / 68,826 (comprehensive) | 67.83% - 99.71% | **Primary Job Posting Dataset** (Dashboard & Role Matching) |
| `techsalerator/job-posting-data-in-malaysia` | `Job Posting.csv` | 37.54 MB | 9,919 | 123 | 1.24% | **Unusable as Primary** (98.76% non-Malaysia; only 1 tech role) |
| `meerawks/it-skills-from-jobs` | `JobsDatasetProcessed.csv` | 12.78 MB | 3,000 | 1 (in passing text) | 0.03% | **Skill Taxonomy & Seed Dictionary Reference** (No location/dates) |
| `elvinrustam/coursera-dataset` | `CourseraDataset-Clean.csv` | 5.16 MB | 8,370 (6,093 unique URLs) | N/A (Global Courses) | 100.00% | **Primary Learning Pathway Dataset** (Gap remediation) |

---

## 2. Dataset Inventory & Technical Audit

### 2.1. `azraimohamad/jobstreet-all-job-dataset`

* **Filename:** `jobstreet_all_job_dataset.csv`
* **File Size:** 166,519,093 bytes (158.80 MB)
* **Total Rows:** 69,024
* **Total Columns:** 11
* **Declared License & Attribution:** `NOT VERIFIED - needs manual check on Kaggle`. (No companion license/metadata file found in repository).
* **Provenance:** Scraped from JobStreet Malaysia (`jobstreet.com.my`) job board listings and search APIs across Malaysian employers.

#### Column Schema, Dtypes & Missingness
| Column | Dtype | Meaning | Null Count | Null Rate (%) |
| :--- | :--- | :--- | :--- | :--- |
| `job_id` | `float64` | Unique listing identifier on JobStreet | 0 | 0.00% |
| `job_title` | `object` | Title of the advertised job position | 0 | 0.00% |
| `company` | `object` | Hiring company or agency name | 0 | 0.00% |
| `descriptions` | `object` | Complete job posting text & requirement description | 0 | 0.00% |
| `location` | `object` | Stated work location (state, city, or district) | 0 | 0.00% |
| `category` | `object` | Top-level JobStreet industry/function category | 0 | 0.00% |
| `subcategory` | `object` | Granular job role classification | 0 | 0.00% |
| `role` | `object` | Normalized role slug/title from JobStreet | 2,252 | 3.26% |
| `type` | `object` | Employment type (e.g., Full time, Contract/Temp) | 0 | 0.00% |
| `salary` | `object` | Disclosed salary range string in MYR | 37,430 | 54.23% |
| `listingDate` | `object` | ISO-8601 posting timestamp | 0 | 0.00% |

#### Key Field Availability & Quality Checks
* **Job Title:** Available in 100% of rows (`job_title`).
* **Job Description:** Available in 100% of rows (`descriptions`).
* **Location:** Available in 100% of rows (`location`).
* **Date:** Available in 100% of rows (`listingDate`).
* **Skills Column:** **Explicit column is ABSENT**. Must be extracted from `descriptions`.
* **Duplicates:**
  * Exact full-row duplicates: **0 (0.00%)**
  * Duplicate `job_id`: **0 (0.00%)**
  * Content duplicates on `(job_title, company, location)`: **4,988 (7.23%)** (representing re-posted or recurring vacancies).
* **Malaysia Coverage & Verification Rule:**
  * *Narrow Keyword Rule:* Regex matching explicit Malaysian states, Federal Territories, and major tech hubs (e.g. Kuala Lumpur, Selangor, Penang, Johor, Cyberjaya, Bayan Lepas). **Yields 46,822 rows (67.83%)**.
  * *Comprehensive Administrative District Rule:* In-depth verification of all 350+ unique location values shows that the source is exclusively `jobstreet.com.my`. Aside from `Others` (198 rows, 0.29%), all remaining 68,826 rows (99.71%) are officially gazetted Malaysian administrative districts, divisions, and townships (e.g., Petaling [9,746], Seberang Perai [1,796], Hulu Langat [958], Sepang [865], Kinta [776], Cheras [304], Bintulu [301]).
  * *Excluded ambiguous rows:* 198 rows with `location == "Others"`.
* **Date Range & Reliability:**
  * Min date: `2023-03-23 19:44:00+00:00`
  * Max date: `2025-05-08 11:12:22+00:00` (Span: 776 days)
  * Monthly distribution: Sporadic coverage in 2023 (1,777 rows); massive concentration between **February 2024 and June 2024 (57,060 rows, 82.67%)**; and a second wave in **March–May 2025 (9,718 rows, 14.08%)**.
  * *Reliability assessment:* The timestamps represent true listing posting dates, but the scrape window is heavily clustered. It cannot support a smooth, uniform multi-year longitudinal trend without distorting macroeconomic reality. Trend metrics must be restricted to peak observation windows or reported as static demand frequencies.

#### Target Role Counts (Documented Regex Matching)
Title matching regex patterns:
* *Software Engineer / Developer:* `(?i)\b(software\s+(?:engineer|developer)|full\s*stack\s+(?:engineer|developer)|backend\s+(?:engineer|developer)|frontend\s+(?:engineer|developer)|web\s+developer|mobile\s+developer|(?:ios|android)\s+developer|application\s+developer|software\s+programmer|java\s+developer|\.net\s+developer|python\s+developer)\b`
* *Data Engineer:* `(?i)\b(data\s+engineer|big\s*data\s+engineer|data\s+pipeline\s+engineer|etl\s+developer|database\s+engineer)\b`
* *Data Scientist:* `(?i)\b(data\s+scientist|data\s+science\s+specialist|lead\s+data\s+scientist|senior\s+data\s+scientist)\b`
* *Machine Learning / AI Engineer:* `(?i)\b(machine\s+learning\s+engineer|ml\s+engineer|ai\s+engineer|artificial\s+intelligence\s+engineer|deep\s+learning\s+engineer|nlp\s+engineer|computer\s+vision\s+engineer|ai\s+specialist|machine\s+learning\s+specialist)\b`
* *Cloud Engineer:* `(?i)\b(cloud\s+engineer|cloud\s+architect|cloud\s+infrastructure\s+engineer|cloud\s+systems\s+engineer|aws\s+engineer|azure\s+engineer|gcp\s+engineer|cloud\s+operations\s+engineer)\b`

| Target Role | Total Count | Narrow MY Count | Comprehensive MY Count | Sample Adequacy |
| :--- | :--- | :--- | :--- | :--- |
| **Software Engineer / Developer** | 1,490 | 1,104 | 1,486 | **Strong** (>1,000 postings) |
| **Data Engineer** | 118 | 88 | 118 | **Adequate** (~100 postings) |
| **Data Scientist** | 63 | 47 | 63 | **Moderate** (Caution required) |
| **Machine Learning / AI Engineer** | 35 | 28 | 35 | **Low** (Small sample warning needed) |
| **Cloud Engineer** | 35 | 27 | 35 | **Low** (Small sample warning needed) |

#### Evidence Samples (Jobstreet)
```text
[Sample 1]
job_id: 74630583.0
job_title: Procurement Executive (Contract)
company: Coca-Cola Bottlers (Malaysia) Sdn Bhd
descriptions: Position Purpose\nManage aspects of procurement including supplier management, contract management...
location: Negeri Sembilan
category: Manufacturing, Transport & Logistics
subcategory: Purchasing, Procurement & Inventory
role: procurement-executive
type: Contract/Temp
salary: nan
listingDate: 2024-03-21T05:58:35Z

[Sample 2]
job_id: 74660602.0
job_title: Account Executive/ Assistant
company: Acoustic & Lighting System Sdn Bhd
descriptions: We are looking for a Account Executive/ Assistant to join our team.\nWhat you will get when you join...
location: Petaling
category: Accounting
subcategory: Bookkeeping & Small Practice Accounting
role: executive-assistant
type: Full time
salary: RM 2,800 – RM 3,200 per month
listingDate: 2024-03-22T06:52:57Z

[Sample 3]
job_id: 74655679.0
job_title: Data Analyst - Asset Management, SPX Express
company: Shopee Mobile Malaysia Sdn Bhd
descriptions: Performs detailed data analysis on existing spendings / consumptions of SPX and identifies cost savi...
location: Klang District
category: Manufacturing, Transport & Logistics
subcategory: Analysis & Reporting
role: asset-management-analyst
type: Full time
salary: nan
listingDate: 2024-03-22T04:22:43Z
```

---

### 2.2. `techsalerator/job-posting-data-in-malaysia`

* **Filename:** `Job Posting.csv`
* **File Size:** 39,361,744 bytes (37.54 MB)
* **Total Rows:** 9,919
* **Total Columns:** 21
* **Encoding Caveat:** Fails standard UTF-8 parsing due to invalid continuation bytes (e.g. `0xd0`); requires `latin-1` or `cp1252` encoding.
* **Declared License & Attribution:** `NOT VERIFIED - needs manual check on Kaggle`. Commercial teaser dataset from Techsalerator.
* **Provenance:** Global corporate applicant tracking systems (SmartRecruiters, Workday) scraped for multinational companies (e.g., Bosch, ZF).

#### Column Schema, Dtypes & Missingness
| Column | Dtype | Meaning | Null Count | Null Rate (%) |
| :--- | :--- | :--- | :--- | :--- |
| `Website Domain` | `object` | Hiring company corporate domain | 0 | 0.00% |
| `Ticker` | `float64` | Stock ticker symbol | 9,919 | **100.00%** |
| `Job Opening Title` | `object` | Title of vacancy | 0 | 0.00% |
| `Job Opening URL` | `object` | ATS posting URL | 0 | 0.00% |
| `First Seen At` | `object` | Crawler discovery timestamp | 0 | 0.00% |
| `Last Seen At` | `object` | Crawler last verification timestamp | 0 | 0.00% |
| `Location` | `object` | Plain text location | 411 | 4.14% |
| `Location Data` | `object` | JSON blob with country, state, city | 0 | 0.00% |
| `Category` | `object` | Job function category | 1,669 | 16.83% |
| `Seniority` | `object` | Manager vs non-manager | 0 | 0.00% |
| `Keywords` | `object` | Tagged keywords / skills | 2,273 | 22.92% |
| `Description` | `object` | Full job text | 112 | 1.13% |
| `Salary` | `object` | Raw salary text | 9,343 | **94.19%** |
| `Salary Data` | `object` | JSON salary attributes | 0 | 0.00% |
| `Contract Types` | `object` | Contract classification | 1,915 | 19.31% |
| `Job Status` | `object` | Status (e.g. closed, open) | 3,147 | 31.73% |
| `Job Language` | `object` | Language code (e.g., 'en') | 2 | 0.02% |
| `Job Last Processed At`| `object`| Aggregator processing timestamp | 0 | 0.00% |
| `O*NET Code` | `object` | US DOL O*NET standard SOC code | 3 | 0.03% |
| `O*NET Family` | `object` | US DOL occupational family | 3 | 0.03% |
| `O*NET Occupation Name`| `object`| US DOL occupation title | 3 | 0.03% |

#### Key Field Availability & Quality Checks
* **Job Title:** Available (`Job Opening Title`, 0% null).
* **Job Description:** Available (`Description`, 1.13% null).
* **Location:** Available (`Location` 4.14% null; `Location Data` 0% null).
* **Date:** Available (`First Seen At`, `Last Seen At`, 0% null).
* **Skills Column:** Partially available (`Keywords`, 22.92% null).
* **Duplicates:** Exact row duplicates: **0 (0.00%)**; duplicate URLs: **14 (0.14%)**; duplicate `(Title, Domain, Location)`: **2,155 (21.73%)**.
* **CRITICAL FINDING: Severe Weakness in Malaysia Coverage:**
  * Despite being marketed on Kaggle as *"Job Posting Data in Malaysia"*, inspection of `Location` and `Location Data` reveals that **9,796 rows (98.76%) are in international jurisdictions**: Bangalore, India (642); Chennai, India (305); Indiana, USA (239); Germany (229); Brazil (212); Poland (207); Hungary (196); China (139), etc.
  * Only **123 rows (1.24%)** are located in Malaysia.
* **Target Roles in Confirmed Malaysian Rows:**
  * Software Engineer / Developer: **1** (`Embedded Software Engineer - Hardware solution product`)
  * Data Engineer: **0**
  * Data Scientist: **0**
  * Machine Learning / AI Engineer: **0**
  * Cloud Engineer: **0**
* **Verdict:** **Completely inadequate and disqualified as a primary source** for the Malaysian Tech Workforce Intelligence Platform. Using it would violate Section 1 of the Project Guide (*"The product must not present generic global job-market statistics as Malaysian findings"*).

#### Evidence Samples (Techsalerator)
```text
[Sample 1]
Website Domain: bosch.com
Job Opening Title: IN_RBAI_Assistant Manager_Dispensing Process Engineer_IN
Location: Indiana, United States
Location Data: [{"city":null,"state":"Indiana","zip_code":null,"country":"United States","region":null...
Category: engineering, management, support
Keywords: nan
First Seen At: 2024-05-29T19:59:45Z

[Sample 2]
Website Domain: bosch.com
Job Opening Title: Professional Internship: Hardware Development (M/F/Div.)
Location: Delaware, United States
Location Data: [{"city":null,"state":"Delaware","zip_code":null,"country":"United States","region":null...
Category: internship
Keywords: Scrum
First Seen At: 2024-05-04T01:00:12Z

[Sample 3]
Website Domain: zf.com
Job Opening Title: Process Expert BMS Production
Location: China
Location Data: [{"city":null,"state":null,"zip_code":null,"country":"China","region":null...
Category: engineering
Keywords: SAP
First Seen At: 2024-04-19T06:47:24Z
```

---

### 2.3. `meerawks/it-skills-from-jobs`

* **Filename:** `JobsDatasetProcessed.csv`
* **File Size:** 13,403,035 bytes (12.78 MB)
* **Total Rows:** 3,000
* **Total Columns:** 9
* **Declared License & Attribution:** `NOT VERIFIED - needs manual check on Kaggle`. (Note: Kaggle page indicates Apache 2.0, but no license file is included locally).
* **Provenance:** Synthesized dataset scraped across 25 IT queries (exactly 120 rows per query: e.g., 'Artificial Intelligence', 'Data Engineer', 'Full Stack Developer', 'Cloud Architect') processed with LLMs for token-extracted entities.

#### Column Schema, Dtypes & Missingness
| Column | Dtype | Meaning | Null Count | Null Rate (%) |
| :--- | :--- | :--- | :--- | :--- |
| `ID` | `int64` | Arbitrary posting index | 0 | 0.00% |
| `Query` | `object` | Search query used to pull the posting (25 queries) | 0 | 0.00% |
| `Job Title` | `object` | Job vacancy title | 0 | 0.00% |
| `Description` | `object` | Full job description text | 0 | 0.00% |
| `IT Skills` | `object` | LLM-extracted technical skills list (comma-separated)| 10 | 0.33% |
| `Soft Skills` | `object` | LLM-extracted interpersonal skills list | 22 | 0.73% |
| `Education` | `object` | Extracted degree/education requirements | 1,437 | 47.90% |
| `Experience` | `object` | Extracted years/type of experience | 1,428 | 47.60% |
| `Token Usage` | `int64` | OpenAI API tokens consumed during extraction | 0 | 0.00% |

#### Key Field Availability & Quality Checks
* **Job Title:** Available (`Job Title`, 0% null).
* **Job Description:** Available (`Description`, 0% null).
* **Location:** **COMPLETELY ABSENT**. No location, country, or city column exists.
* **Date:** **COMPLETELY ABSENT**. No posting date, crawl date, or timestamp exists.
* **Skills Column:** **Explicit and clean** (`IT Skills` available in 99.67% of rows; `Soft Skills` in 99.27% of rows).
* **Duplicates:** Exact row duplicates: **0 (0.00%)**; duplicate ID: **0 (0.00%)**; duplicate `(Job Title, Description)`: **35 (1.17%)**.
* **Malaysia Coverage:** Keyword scanning of `Description` reveals only **1 row (0.03%)** mentioning Malaysia (a US-based company mentioning an overseas plant).
* **Target Roles (Global):**
  * Software Engineer / Developer: **179**
  * Data Engineer: **117**
  * Data Scientist: **123**
  * Machine Learning / AI Engineer: **25**
  * Cloud Engineer: **16**
* **Verdict:** Unusable for Malaysian employer demand metrics, geographic filtering, or historical trends. However, it represents an **exceptional reference corpus / seed dictionary for tech skill taxonomy extraction and normalization**.

#### Evidence Samples (Meerawks)
```text
[Sample 1]
ID: 3859 | Query: Artificial Intelligence
Job Title: Collaborative Manipulation Roboticist
Description: Location: Schlumberger-Doll Research, Cambridge, MA, USA At Schlumberger-Doll...
IT Skills: Collaborative Manipulation, Artificial Intelligence, Robot Operating System (ROS), Programming (Python, C++), Motion Planning, Inverse Kinematics, Task Planning under Uncertainty, Supervised Learning, Reinforcement/Demonstration Learning
Soft Skills: Problem-solving, Organizational skills, Communication skills

[Sample 2]
ID: 3764 | Query: Artificial Intelligence
Job Title: Software Engineer - Innovation Lab
Description: About DENSO DENSO is one of the largest global automotive suppliers of advanc...
IT Skills: Software Development, Infotainment Systems, Augmented Reality (AR), Heads-up Display (HUD), Haptic Devices, Platform Optimization, Cross-functional Collaboration, Proof of Concept (PoC), System Application Development, Linux/Android Development, Programming Languages: C, C++, Java, Python, Artificial Intelligence (AI), Prototype Development, Technical Requirement Analysis
Soft Skills: Creativity, Collaboration, Problem-solving, Adaptability, Proactive Attitude, Self-direction

[Sample 3]
ID: 3597 | Query: Artificial Intelligence
Job Title: Director, Standards & Strategy
Description: As a Director of Strategy & Strategy at Xperi, you will participate in indust...
IT Skills: Audio/video codec, Media streaming and storage formats, AR/VR, Machine learning, Artificial intelligence, Technical specifications authoring and reviewing
Soft Skills: Participation in international standards, consortia, or industry fora, Working in an international and multicultural environment, Communication and presentation skills, Relationship management
```

---

### 2.4. `elvinrustam/coursera-dataset`

* **Filename:** `CourseraDataset-Clean.csv`
* **File Size:** 5,406,326 bytes (5.16 MB)
* **Total Rows:** 8,370
* **Unique Course URLs:** 6,093 (2,277 rows represent cross-listed courses across the 10 catalog categories)
* **Unique Course Titles:** 6,081
* **Total Columns:** 13
* **Declared License & Attribution:** `NOT VERIFIED - needs manual check on Kaggle`.
* **Provenance:** Scraped from the public Coursera online course catalog across 10 top-level topic keywords (`DataScience`, `Computer Science`, `Information Technology`, `Business`, `Health`, etc.).

#### Column Schema, Dtypes & Missingness
| Column | Dtype | Meaning | Null Count | Placeholder Count ("Not specified") | Effective Missing Rate (%) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `Course Title` | `object` | Title of the Coursera course | 0 | 0 | 0.00% |
| `Rating` | `float64` | Average student rating (0.0 to 5.0) | 0 | 0 (1,163 unrated = 0.0) | 0.00% (13.89% unrated) |
| `Level` | `object` | Course difficulty (Beginner, Intermediate, etc.) | 0 | 1,106 | 13.21% |
| `Schedule` | `object` | Learning schedule flexibility | 0 | 0 | 0.00% |
| `What you will learn`| `object` | Course description and learning objectives | 0 | 4,110 | 49.10% |
| `Skill gain` | `object` | Comma-separated acquired skills | 0 | 2,699 | 32.25% |
| `Modules` | `object` | Syllabus breakdown of course modules | 33 | 0 | 0.39% |
| `Instructor` | `object` | Course instructors | 88 | 0 | 1.05% |
| `Offered By` | `object` | Partner university or enterprise creator | 0 | 0 | 0.00% |
| `Keyword` | `object` | Query category under which course was indexed | 0 | 0 | 0.00% |
| `Course Url` | `object` | Web URL to course page | 0 | 0 | 0.00% |
| `Duration to complete (Approx.)`| `float64`| Estimated hours to complete | 0 | 0 | 0.00% |
| `Number of Review` | `int64` | Total student review count | 0 | 0 | 0.00% |

#### Field Availability & URL Usability Checks
* **Course Name:** Available (`Course Title`, 100%).
* **Description:** Available (`What you will learn` [50.90% valid] + `Modules` [99.61% valid]).
* **Skills:** Available (`Skill gain`, 67.75% populated; 32.25% `"Not specified"`).
* **Difficulty:** Available (`Level`, 86.79% valid; 13.21% `"Not specified"`).
* **Rating:** Available (`Rating`, 100% numeric; ratings range 0.0 - 5.0 with median 4.7).
* **Duration:** Available (`Duration to complete (Approx.)`, numeric hours; e.g. 20.0).
* **URL:** Available (`Course Url`, 100% populated).
  * URL usability: **100% valid HTTP/HTTPS**, all pointing to valid canonical endpoints at `https://www.coursera.org/learn/<slug>`.
* **Price:** **COMPLETELY ABSENT**. No fee, price, or currency column exists.
* **Verdict:** Highly suitable for Journey C (Personalized Learning Pathway) after deduplicating by `Course Url` (6,093 unique courses). Price must be explicitly documented as unverified/not provided. When `Skill gain` is `"Not specified"`, semantic/keyword fallback matching across `Course Title` and `Modules` is required.

#### Evidence Samples (Coursera)
```text
[Sample 1]
Course Title: Fashion as Design
Rating: 4.8 | Level: Beginner level | Schedule: Flexible schedule
What you will learn: Not specified
Skill gain: Art History, Art, History, Creativity
Modules: Introduction, Heroes, Silhouettes, Coutures, Lifecycle, Modesty, Expression
Offered By: The Museum of Modern Art
Course Url: https://www.coursera.org/learn/fashion-design
Duration (Hours): 20.0 | Number of Review: 2813

[Sample 2]
Course Title: Modern American Poetry
Rating: 4.4 | Level: Beginner level | Schedule: Flexible schedule
What you will learn: Not specified
Skill gain: Not specified
Modules: Orientation, Module 1, Module 2, Module 3, Module 4
Offered By: University of Illinois at Urbana-Champaign
Course Url: https://www.coursera.org/learn/modern-american-poetry
Duration (Hours): 34.0 | Number of Review: 100

[Sample 3]
Course Title: Pixel Art for Video Games
Rating: 4.5 | Level: Beginner level | Schedule: Flexible schedule
What you will learn: Not specified
Skill gain: Not specified
Modules: Week 1: Introduction to Pixel Art, Week 2: Pixel Art Environments, Week 3: Pixel Art Characters...
Offered By: Michigan State University
Course Url: https://www.coursera.org/learn/pixel-art-video-games
Duration (Hours): 9.0 | Number of Review: 227
```

---

## 3. Feature-Support Matrix

Each candidate dataset was evaluated against the MVP's 5 core features as defined in `document/Agents.md`.

| Feature | `jobstreet-all-job-dataset` | `techsalerator-job-posting-data-in-malaysia` | `it-skills-from-jobs` (Meerawks) | `coursera-dataset` (Elvin Rustam) |
| :--- | :--- | :--- | :--- | :--- |
| **(a) Skills Dashboard** (Role-based demand in Malaysia) | **YES**<br>Contains 68,826 verified Malaysian postings; 1,486 Software Engineers, 118 Data Engineers, 63 Data Scientists, 35 ML Engineers, 35 Cloud Engineers. | **NO**<br>Only 123 Malaysian postings total; only 1 tech role found. Completely statistically invalid. | **NO**<br>Zero Malaysian location tags (1 mention in passing). Global crawl. | **NO**<br>Course dataset, not job demand data. Cannot measure employer demand. |
| **(b) Historical Trends** (Longitudinal demand over time) | **PARTIAL / QUALIFIED**<br>Dates exist, but 82.67% of postings cluster in Feb–June 2024. Can show monthly trend for 2024, but cannot infer multi-year macroeconomic shifts without misleading users. | **NO**<br>Only 1 tech posting in Malaysia; zero trend sample size. | **NO**<br>Contains zero date or timestamp columns. | **NO**<br>No date or demand trend information. |
| **(c) Role Matching & Skill-Gap Analysis** | **YES**<br>Rich description texts in Malaysian postings enable empirical skill requirement profiles for target roles. | **NO**<br>Insufficient Malaysian tech role records to build empirical role profiles. | **AUXILIARY ONLY**<br>Cannot provide Malaysian benchmarks, but provides 3,000 ground-truth IT/soft skill tag pairs for taxonomy building. | **NO**<br>Supplies learning resources, not role vacancy requirements. |
| **(d) Learning Pathway Recommendation** | **NO**<br>Does not contain course or training resources. | **NO**<br>Does not contain course resources. | **NO**<br>Does not contain course resources. | **YES**<br>6,093 unique Coursera courses with verified URLs, difficulty levels, duration, and skill topics. |
| **(e) SDG Mapping** | **NO DIRECT MAPPING**<br>Contains no SDG labels. (Must be mapped via standard UN taxonomy). | **NO DIRECT MAPPING**<br>Contains O*NET codes but no SDG mappings. | **NO DIRECT MAPPING**<br>Contains no SDG labels. | **NO DIRECT MAPPING**<br>Contains no SDG labels. |

---

## 4. Problem Report & Explicit Anomalies

1. **No Accompanying License Files in Repository:**
   None of the 4 CSV files in `data/` came with dedicated license or metadata files. Status remains **"NOT VERIFIED - needs manual check on Kaggle"**. Commercial teaser data (`Techsalerator`) has unknown/restricted terms; `Meerawks` is declared as Apache 2.0 on Kaggle; `Jobstreet` and `Coursera` are community web-scraped datasets subject to platform Terms of Service.
2. **False Malaysia Advertising in Techsalerator:**
   Although titled `techsalerator/job-posting-data-in-malaysia`, **98.76% of rows are located in India, the United States, Germany, Brazil, Poland, and China**. Out of 9,919 records, only 123 belong to Malaysia, containing only a single software engineer job and zero postings for the other four target roles. **It must not be used as primary market data**.
3. **No Geographic or Temporal Dimensions in Meerawks:**
   `JobsDatasetProcessed.csv` completely lacks `Location` and `Date` fields. It cannot be used to represent Malaysian tech workforce reality. Its value is purely as an auxiliary dictionary of IT skill phrases.
4. **Scraping Artifacts in Jobstreet Timestamps:**
   `jobstreet_all_job_dataset.csv` contains dates from 2023 to 2025, but 82.67% of records were captured in a single scrape burst between February 2024 and June 2024. Displaying a multi-year line chart would show artificial peaks caused by scraping activity rather than actual labor market surges. Demand metrics must be framed as a representative snapshot of the 2024 Malaysian hiring market.
5. **Small Sample Sizes for AI, ML, and Cloud Engineers:**
   In the Jobstreet dataset, while Software Engineer (1,486) and Data Engineer (118) have strong sample sizes, Data Scientist has 63, Machine Learning / AI Engineer has 35, and Cloud Engineer has 35. The dashboard must prominently display sample size warnings (`N = 35`) for these roles to maintain statistical honesty.
6. **No Pre-Extracted Skills in Jobstreet:**
   `jobstreet_all_job_dataset.csv` has no explicit `skills` column. Technical skills must be extracted from the raw HTML/text in `descriptions`.
7. **Coursera Placeholders & Missing Price Data:**
   `CourseraDataset-Clean.csv` uses string literal `"Not specified"` for 32.25% of `Skill gain` and 49.10% of `What you will learn`. Course pricing is completely absent. Recommendation logic must fall back gracefully to searching `Course Title` and `Modules` when `Skill gain` is missing, and prices must not be fabricated.
