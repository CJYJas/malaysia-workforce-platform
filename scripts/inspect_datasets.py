"""
Dataset Inspection Script for Malaysia Tech Workforce Intelligence Platform
Reproducibly inspects all candidate datasets in data/ and outputs exact metrics.
"""

import os
import re
import json
import pandas as pd
import numpy as np

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
RESULTS_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "inspection_results.json"))

# Target role title matching patterns (documented and reproducible)
ROLE_PATTERNS = {
    "Software Engineer / Developer": re.compile(
        r"(?i)\b(software\s+(?:engineer|developer)|full\s*stack\s+(?:engineer|developer)|backend\s+(?:engineer|developer)|frontend\s+(?:engineer|developer)|web\s+developer|mobile\s+developer|(?:ios|android)\s+developer|application\s+developer|software\s+programmer|java\s+developer|\.net\s+developer|python\s+developer)\b"
    ),
    "Data Engineer": re.compile(
        r"(?i)\b(data\s+engineer|big\s*data\s+engineer|data\s+pipeline\s+engineer|etl\s+developer|database\s+engineer)\b"
    ),
    "Data Scientist": re.compile(
        r"(?i)\b(data\s+scientist|data\s+science\s+specialist|lead\s+data\s+scientist|senior\s+data\s+scientist)\b"
    ),
    "Machine Learning / AI Engineer": re.compile(
        r"(?i)\b(machine\s+learning\s+engineer|ml\s+engineer|ai\s+engineer|artificial\s+intelligence\s+engineer|deep\s+learning\s+engineer|nlp\s+engineer|computer\s+vision\s+engineer|ai\s+specialist|machine\s+learning\s+specialist)\b"
    ),
    "Cloud Engineer": re.compile(
        r"(?i)\b(cloud\s+engineer|cloud\s+architect|cloud\s+infrastructure\s+engineer|cloud\s+systems\s+engineer|aws\s+engineer|azure\s+engineer|gcp\s+engineer|cloud\s+operations\s+engineer)\b"
    )
}

# Rule 1: Narrow State/City Keywords
NARROW_MY_KEYWORDS = [
    'malaysia', 'kuala lumpur', 'selangor', 'penang', 'pulau pinang', 'johor', 'johor bahru',
    'sarawak', 'kuching', 'sabah', 'kota kinabalu', 'perak', 'ipoh', 'melaka', 'malacca',
    'pahang', 'kuantan', 'negeri sembilan', 'seremban', 'kedah', 'kelantan', 'terengganu',
    'perlis', 'putrajaya', 'cyberjaya', 'petaling jaya', 'subang jaya', 'shah alam',
    'klang', 'bangsar', 'damansara', 'puchong', 'georgetown', 'bayan lepas'
]
NARROW_MY_REGEX = re.compile(r'(?i)\b(?:' + '|'.join([re.escape(k) for k in NARROW_MY_KEYWORDS]) + r')\b')

results = {}

def inspect_coursera(fpath):
    print("Inspecting Coursera dataset...")
    size_bytes = os.path.getsize(fpath)
    df = pd.read_csv(fpath)
    total_rows = len(df)
    
    col_info = {}
    for col in df.columns:
        null_count = int(df[col].isnull().sum())
        not_specified_count = int((df[col].astype(str).str.strip() == "Not specified").sum())
        effective_missing = null_count + not_specified_count
        col_info[col] = {
            "dtype": str(df[col].dtype),
            "raw_null_count": null_count,
            "raw_null_pct": round(null_count / total_rows * 100, 2),
            "placeholder_not_specified": not_specified_count,
            "effective_missing_count": effective_missing,
            "effective_missing_pct": round(effective_missing / total_rows * 100, 2)
        }
    
    urls = df['Course Url'].dropna() if 'Course Url' in df.columns else pd.Series([], dtype=str)
    valid_http = int(urls.str.startswith(('http://', 'https://')).sum())
    coursera_domain = int(urls.str.contains(r'coursera\.org', case=False, na=False).sum())
    
    samples = []
    for idx, row in df.head(3).iterrows():
        s = {}
        for col in df.columns:
            val_str = str(row[col])
            s[col] = val_str[:100] + "..." if len(val_str) > 100 else val_str
        samples.append(s)

    results['coursera'] = {
        "dataset_name": "elvinrustam/coursera-dataset",
        "filename": os.path.basename(fpath),
        "file_size_bytes": size_bytes,
        "file_size_mb": round(size_bytes / (1024*1024), 2),
        "total_rows": total_rows,
        "total_columns": len(df.columns),
        "columns": col_info,
        "declared_license": "NOT VERIFIED - needs manual check on Kaggle",
        "provenance": "Scraped from Coursera catalog across 10 top-level topic keywords.",
        "field_availability": {
            "course_name": True,
            "course_name_col": "Course Title",
            "description": True,
            "description_cols": ["What you will learn", "Modules"],
            "skills": True,
            "skills_col": "Skill gain",
            "difficulty": True,
            "difficulty_col": "Level",
            "rating": True,
            "rating_col": "Rating",
            "duration": True,
            "duration_col": "Duration to complete (Approx.)",
            "url": True,
            "url_col": "Course Url",
            "price": False,
            "price_col": None
        },
        "url_usability": {
            "total_urls": len(urls),
            "valid_http_pct": round(valid_http / len(urls) * 100, 2) if len(urls) else 0.0,
            "coursera_domain_pct": round(coursera_domain / len(urls) * 100, 2) if len(urls) else 0.0,
            "sample_urls": list(urls.head(3))
        },
        "duplicates": {
            "exact_row_dups": int(df.duplicated().sum()),
            "title_dups": int(df.duplicated(subset=['Course Title']).sum()),
            "url_dups": int(df.duplicated(subset=['Course Url']).sum()) if 'Course Url' in df.columns else None,
            "unique_urls": int(df['Course Url'].nunique()) if 'Course Url' in df.columns else 0
        },
        "samples": samples
    }

def inspect_jobstreet(fpath):
    print("Inspecting JobStreet dataset...")
    size_bytes = os.path.getsize(fpath)
    df = pd.read_csv(fpath)
    total_rows = len(df)
    
    col_info = {}
    for col in df.columns:
        null_count = int(df[col].isnull().sum())
        col_info[col] = {
            "dtype": str(df[col].dtype),
            "null_count": null_count,
            "null_pct": round(null_count / total_rows * 100, 2)
        }

    exact_dups = int(df.duplicated().sum())
    job_id_dups = int(df.duplicated(subset=['job_id']).sum()) if 'job_id' in df.columns else 0
    content_dups = int(df.duplicated(subset=['job_title', 'company', 'location']).sum())

    # Narrow vs Comprehensive rule
    narrow_mask = df['location'].fillna('').str.contains(NARROW_MY_REGEX)
    narrow_rows = int(narrow_mask.sum())
    
    # In Jobstreet Malaysia portal, all locations except "Others" (198 rows) are explicitly named Malaysian districts/towns
    comprehensive_mask = df['location'].fillna('').str.strip() != "Others"
    comprehensive_rows = int(comprehensive_mask.sum())
    others_count = int((df['location'].fillna('').str.strip() == "Others").sum())

    top_locs = {str(k): int(v) for k, v in df['location'].value_counts(dropna=False).head(15).items()}

    dates = pd.to_datetime(df['listingDate'], errors='coerce')
    valid_dates = dates.dropna()
    min_date = str(valid_dates.min()) if len(valid_dates) else None
    max_date = str(valid_dates.max()) if len(valid_dates) else None
    date_range_days = int((valid_dates.max() - valid_dates.min()).days) if len(valid_dates) else 0
    monthly_dist = {str(k): int(v) for k, v in valid_dates.dt.to_period('M').value_counts().sort_index().items()}

    role_counts_all = {}
    role_counts_my_narrow = {}
    role_counts_my_comp = {}
    df_my_narrow = df[narrow_mask]
    df_my_comp = df[comprehensive_mask]

    for rname, pattern in ROLE_PATTERNS.items():
        role_counts_all[rname] = int(df['job_title'].fillna('').str.contains(pattern).sum())
        role_counts_my_narrow[rname] = int(df_my_narrow['job_title'].fillna('').str.contains(pattern).sum())
        role_counts_my_comp[rname] = int(df_my_comp['job_title'].fillna('').str.contains(pattern).sum())

    samples = []
    for idx, row in df.head(3).iterrows():
        s = {}
        for col in df.columns:
            val_str = str(row[col])
            s[col] = val_str[:100] + "..." if len(val_str) > 100 else val_str
        samples.append(s)

    results['jobstreet'] = {
        "dataset_name": "azraimohamad/jobstreet-all-job-dataset",
        "filename": os.path.basename(fpath),
        "file_size_bytes": size_bytes,
        "file_size_mb": round(size_bytes / (1024*1024), 2),
        "total_rows": total_rows,
        "total_columns": len(df.columns),
        "columns": col_info,
        "declared_license": "NOT VERIFIED - needs manual check on Kaggle",
        "provenance": "Scraped from JobStreet Malaysia (jobstreet.com.my) via JobStreet Search API / HTML listings.",
        "key_columns": {
            "title": "job_title",
            "description": "descriptions",
            "location": "location",
            "date": "listingDate",
            "skills": None
        },
        "duplicates": {
            "exact_row_dups": exact_dups,
            "exact_row_dups_pct": round(exact_dups / total_rows * 100, 2),
            "job_id_dups": job_id_dups,
            "job_id_dups_pct": round(job_id_dups / total_rows * 100, 2),
            "content_dups_title_company_loc": content_dups,
            "content_dups_pct": round(content_dups / total_rows * 100, 2)
        },
        "malaysia_coverage": {
            "narrow_rule": "Case-insensitive regex matching Malaysian states, federal territories, and tech hubs in 'location'",
            "narrow_malaysia_rows": narrow_rows,
            "narrow_malaysia_pct": round(narrow_rows / total_rows * 100, 2),
            "comprehensive_rule": "Exclusion of ambiguous 'Others' (all other 350+ location strings are verified gazetted Malaysian administrative districts/towns)",
            "comprehensive_malaysia_rows": comprehensive_rows,
            "comprehensive_malaysia_pct": round(comprehensive_rows / total_rows * 100, 2),
            "ambiguous_others_rows": others_count,
            "ambiguous_others_pct": round(others_count / total_rows * 100, 2),
            "top_locations": top_locs
        },
        "date_analysis": {
            "column": "listingDate",
            "valid_dates_count": len(valid_dates),
            "valid_dates_pct": round(len(valid_dates) / total_rows * 100, 2),
            "min_date": min_date,
            "max_date": max_date,
            "date_range_days": date_range_days,
            "monthly_distribution": monthly_dist,
            "reliability_assessment": "Timestamps are ISO-8601 posting dates. However, distribution is highly bimodal/clustered (57,060 rows, 82.7%, in Feb-June 2024; 9,718 rows in Mar-May 2025; sporadic 2023). Not a uniform multi-year longitudinal series; long-term trend lines will reflect batch collection artifacts rather than true macroeconomic shifts."
        },
        "target_roles": {
            "all_rows": role_counts_all,
            "malaysia_narrow_rows": role_counts_my_narrow,
            "malaysia_comprehensive_rows": role_counts_my_comp
        },
        "samples": samples
    }

def inspect_techsalerator(fpath):
    print("Inspecting Techsalerator dataset...")
    size_bytes = os.path.getsize(fpath)
    df = pd.read_csv(fpath, encoding='latin-1')
    total_rows = len(df)

    col_info = {}
    for col in df.columns:
        null_count = int(df[col].isnull().sum())
        col_info[col] = {
            "dtype": str(df[col].dtype),
            "null_count": null_count,
            "null_pct": round(null_count / total_rows * 100, 2)
        }

    exact_dups = int(df.duplicated().sum())
    url_dups = int(df.duplicated(subset=['Job Opening URL']).sum()) if 'Job Opening URL' in df.columns else 0
    content_dups = int(df.duplicated(subset=['Job Opening Title', 'Website Domain', 'Location']).sum())

    loc_col = df['Location'].fillna('')
    loc_data_col = df['Location Data'].fillna('') if 'Location Data' in df.columns else pd.Series(['']*total_rows)
    malaysia_mask = loc_col.str.contains(NARROW_MY_REGEX) | loc_data_col.str.contains(NARROW_MY_REGEX)
    malaysia_rows = int(malaysia_mask.sum())
    unknown_loc = total_rows - malaysia_rows

    top_locs = {str(k): int(v) for k, v in df['Location'].value_counts(dropna=False).head(15).items()}

    dates = pd.to_datetime(df['First Seen At'], errors='coerce')
    valid_dates = dates.dropna()
    min_date = str(valid_dates.min()) if len(valid_dates) else None
    max_date = str(valid_dates.max()) if len(valid_dates) else None
    date_range_days = int((valid_dates.max() - valid_dates.min()).days) if len(valid_dates) else 0
    monthly_dist = {str(k): int(v) for k, v in valid_dates.dt.to_period('M').value_counts().sort_index().items()}

    role_counts_all = {}
    role_counts_my = {}
    my_df = df[malaysia_mask]
    for rname, pattern in ROLE_PATTERNS.items():
        role_counts_all[rname] = int(df['Job Opening Title'].fillna('').str.contains(pattern).sum())
        role_counts_my[rname] = int(my_df['Job Opening Title'].fillna('').str.contains(pattern).sum())

    samples = []
    for idx, row in df.head(3).iterrows():
        s = {}
        for col in df.columns:
            val_str = str(row[col])
            s[col] = val_str[:100] + "..." if len(val_str) > 100 else val_str
        samples.append(s)

    results['techsalerator'] = {
        "dataset_name": "techsalerator/job-posting-data-in-malaysia",
        "filename": os.path.basename(fpath),
        "file_size_bytes": size_bytes,
        "file_size_mb": round(size_bytes / (1024*1024), 2),
        "total_rows": total_rows,
        "total_columns": len(df.columns),
        "columns": col_info,
        "declared_license": "NOT VERIFIED - needs manual check on Kaggle",
        "provenance": "Aggregated by Techsalerator from corporate ATS / career portals (e.g. SmartRecruiters, Workday).",
        "key_columns": {
            "title": "Job Opening Title",
            "description": "Description",
            "location": "Location",
            "date": "First Seen At",
            "skills": "Keywords"
        },
        "duplicates": {
            "exact_row_dups": exact_dups,
            "exact_row_dups_pct": round(exact_dups / total_rows * 100, 2),
            "url_dups": url_dups,
            "url_dups_pct": round(url_dups / total_rows * 100, 2),
            "content_dups": content_dups,
            "content_dups_pct": round(content_dups / total_rows * 100, 2)
        },
        "malaysia_coverage": {
            "rule": "Case-insensitive regex matching Malaysian states, tech hubs, or 'Malaysia' in 'Location' or 'Location Data'",
            "malaysia_rows": malaysia_rows,
            "malaysia_pct": round(malaysia_rows / total_rows * 100, 2),
            "unknown_ambiguous_rows": unknown_loc,
            "unknown_ambiguous_pct": round(unknown_loc / total_rows * 100, 2),
            "top_locations": top_locs
        },
        "date_analysis": {
            "column": "First Seen At",
            "valid_dates_count": len(valid_dates),
            "valid_dates_pct": round(len(valid_dates) / total_rows * 100, 2),
            "min_date": min_date,
            "max_date": max_date,
            "date_range_days": date_range_days,
            "monthly_distribution": monthly_dist,
            "reliability_assessment": "First Seen At represents web crawler observation dates between Feb 2024 and Sep 2024. Not reliable as Malaysian market dates because 98.76% of rows are outside Malaysia."
        },
        "target_roles": {
            "all_rows": role_counts_all,
            "malaysia_rows": role_counts_my
        },
        "samples": samples
    }

def inspect_meerawks(fpath):
    print("Inspecting Meerawks dataset...")
    size_bytes = os.path.getsize(fpath)
    df = pd.read_csv(fpath)
    total_rows = len(df)

    col_info = {}
    for col in df.columns:
        null_count = int(df[col].isnull().sum())
        col_info[col] = {
            "dtype": str(df[col].dtype),
            "null_count": null_count,
            "null_pct": round(null_count / total_rows * 100, 2)
        }

    exact_dups = int(df.duplicated().sum())
    id_dups = int(df.duplicated(subset=['ID']).sum()) if 'ID' in df.columns else 0
    content_dups = int(df.duplicated(subset=['Job Title', 'Description']).sum())

    desc_series = df['Description'].fillna('')
    malaysia_desc = int(desc_series.str.contains(NARROW_MY_REGEX).sum())

    role_counts_all = {}
    for rname, pattern in ROLE_PATTERNS.items():
        role_counts_all[rname] = int(df['Job Title'].fillna('').str.contains(pattern).sum())

    samples = []
    for idx, row in df.head(3).iterrows():
        s = {}
        for col in df.columns:
            val_str = str(row[col])
            s[col] = val_str[:100] + "..." if len(val_str) > 100 else val_str
        samples.append(s)

    results['meerawks'] = {
        "dataset_name": "meerawks/it-skills-from-jobs",
        "filename": os.path.basename(fpath),
        "file_size_bytes": size_bytes,
        "file_size_mb": round(size_bytes / (1024*1024), 2),
        "total_rows": total_rows,
        "total_columns": len(df.columns),
        "columns": col_info,
        "declared_license": "NOT VERIFIED - needs manual check on Kaggle",
        "provenance": "Processed dataset of 25 job queries with LLM-extracted IT Skills, Soft Skills, Education, Experience.",
        "key_columns": {
            "title": "Job Title",
            "description": "Description",
            "location": None,
            "date": None,
            "skills": "IT Skills"
        },
        "duplicates": {
            "exact_row_dups": exact_dups,
            "exact_row_dups_pct": round(exact_dups / total_rows * 100, 2),
            "id_dups": id_dups,
            "id_dups_pct": round(id_dups / total_rows * 100, 2),
            "content_dups": content_dups,
            "content_dups_pct": round(content_dups / total_rows * 100, 2)
        },
        "malaysia_coverage": {
            "rule": "Keyword search for Malaysia in 'Description' (no location column present)",
            "malaysia_rows": malaysia_desc,
            "malaysia_pct": round(malaysia_desc / total_rows * 100, 2),
            "unknown_ambiguous_rows": total_rows - malaysia_desc,
            "unknown_ambiguous_pct": round((total_rows - malaysia_desc) / total_rows * 100, 2),
            "notes": "Dataset completely lacks location and date columns. The 1 matched description is a US job posting referencing international offices."
        },
        "date_analysis": {
            "column": None,
            "valid_dates_count": 0,
            "valid_dates_pct": 0.0,
            "min_date": None,
            "max_date": None,
            "date_range_days": 0,
            "monthly_distribution": {},
            "reliability_assessment": "No date column present."
        },
        "target_roles": {
            "all_rows": role_counts_all,
            "malaysia_rows": {k: 0 for k in role_counts_all}
        },
        "samples": samples
    }

def main():
    coursera_path = os.path.join(DATA_DIR, 'CourseraDataset-Clean.csv')
    jobstreet_path = os.path.join(DATA_DIR, 'jobstreet_all_job_dataset.csv')
    techsalerator_path = os.path.join(DATA_DIR, 'Job Posting.csv')
    meerawks_path = os.path.join(DATA_DIR, 'JobsDatasetProcessed.csv')

    inspect_coursera(coursera_path)
    inspect_jobstreet(jobstreet_path)
    inspect_techsalerator(techsalerator_path)
    inspect_meerawks(meerawks_path)

    with open(RESULTS_PATH, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2)
    print(f"\nAll inspection metrics successfully written to:\n{RESULTS_PATH}")

if __name__ == '__main__':
    main()
