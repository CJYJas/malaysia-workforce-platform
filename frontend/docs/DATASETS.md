# Dataset inspection and first frontend milestone

## What was inspected

Source: https://github.com/CJYJas/malaysia-workforce-platform
The exact source revision and machine-read findings are in [source-inventory.json](source-inventory.json).
The standard-library importer reads each CSV header and counts every CSV record; it does not infer a schema from filenames.

| Available source file | Finding | Use in this milestone |
|---|---|---|
| `CourseraDataset-Clean.csv` | 8,370 rows, 13 columns; UTF-8. Actual columns include course title, rating, level, schedule, learning description, skill gain, modules, instructor, provider, keyword, URL, approximate hours and review count. | Bounded, traceable keyword retrieval for the skills available in the dashboard. |
| `JobsDatasetProcessed.csv` | 3,000 rows, 9 columns; UTF-8. ID, query, title, description, IT skills, soft skills, education, experience and token usage. | Inspected only. Not added to Malaysian market statistics. |
| `Job Posting.csv` | 9,919 rows, 21 columns; Latin-1, matching the source inspection script's encoding choice. Includes location, description, source URL and observed timestamps. | Inspected only. Commercial teaser/restricted rights; excluded from demand metrics. |
| `processed/processing_metadata.json` | Records pipeline version, source counts, exclusions, deduplication, role counts, coverage and per-role top skills. | Dashboard source, explicitly labeled as a repository snapshot. |
| `processed/v1.0.0/processed_jobs.parquet` | Present in Git. | Not redistributed or parsed in this milestone; its schema and row-level quality were not independently verified. |
| `skills_taxonomy.json` | Canonical skills, categories and aliases. | Category labels and exact keyword normalization only. |

The raw `jobstreet_all_job_dataset.csv` is **not present** in the inspected repository. The metadata reports 69,024 source rows, 198 unknown-location exclusions, 4,974 duplicate removals, and 63,852 final rows. These are **source processing claims read from metadata**, not independent reprocessing results.

The five role counts sum to 1,553: Software Engineer / Developer 1,326; Data Engineer 104; Data Scientist 56; Machine Learning / AI Engineer 32; Cloud Engineer 35. The remaining 62,299 rows are other/unassigned roles, not tech postings for the supported roles. Metadata coverage is March 23, 2023–May 8, 2025; processing timestamp is October 22, 2026.

## Metric and comparison rules

- Posting share = recorded skill mention count / recorded eligible role posting count.
- Deduplication key is job title, company, location, keeping the first record.
- Only the top skills retained in metadata are exposed. Missing skills are **not in the snapshot**, never silently treated as zero.
- Compare percentages together with each role's denominator, not raw counts alone.
- Source `config.yaml` supplies minimum evidence and small-sample thresholds. The importer applies the caution threshold independently because the metadata's per-role warning flags disagree with the configured caution threshold.
- Role-specific historical trends are unavailable: global monthly counts do not establish role-specific skill observations. No trend curves or future-demand claims are displayed.

## Course retrieval

Job demand and course data remain separate. The importer scans real course records for canonical skills and source taxonomy aliases. Exact skill-tag matches rank before title matches, then learning-description matches; ties keep original record order. Short terms are restricted to exact skill tags to avoid broad substring matches. Search length and displayed result limits live in `config/workforce.json`.

Each returned course retains its one-based CSV data-record number (header excluded), actual title, source URL when valid, skills and available historical metadata. Zero ratings and nonpositive hours are treated as unavailable, not displayed as verified values. No fabricated course fallback exists. Only dashboard skills are indexed; unknown skills produce an explicit no-indexed-records response, not a catalog-wide absence claim.

No Malaysian availability, price, teaching language, accessibility, current rating or current duration has been verified. Keyword relevance is a transparent heuristic, not a validated educational sequence.

## Licenses and unresolved gaps

- JobStreet and Coursera: license unspecified in source metadata. Review redistribution rights before public release.
- IT Skills taxonomy seed: source metadata reports Apache 2.0; full upstream attribution/license compliance still needs review.
- Techsalerator: source metadata reports commercial teaser/restricted.
- Source references `document/DATASETS.md`, `document/Agents.md` and backend tests, but those files/directories are absent in this revision. The supplied standing rules govern this frontend work.
- No live RunPod API URL was supplied. Nothing here claims live API health or current job-market coverage.

## Smallest architecture and milestones

1. **Current: skills dashboard.** React frontend, generated typed API client, read-only Express snapshot adapter, real role filtering, top-skill posting shares, qualified role comparison, course lookup and source/methodology disclosure. No database or AI is needed.
2. **After review: live FastAPI integration and role matching.** Obtain the backend URL through environment configuration, verify its actual OpenAPI and CORS/auth contract, add profile entry and explainable scores/gaps. Never log profile text. Scores are not hiring probabilities.
3. **After review: personalized learning pathways.** Integrate the real roadmap endpoint, show unresolved gaps, retrieval evidence, ordering limitations and documented SDG rationale when returned.

The existing Python backend is unchanged. This first milestone intentionally stops before implementing the entire application.
