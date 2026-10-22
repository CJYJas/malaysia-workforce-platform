"""Build a bounded, traceable frontend snapshot without changing the source repo.

Usage: python3 scripts/import-workforce.py /path/to/source/git/repository
Only standard-library modules are used. Source thresholds are read from config.yaml.
"""
import csv
import io
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SETTINGS = json.loads((ROOT / "config/workforce.json").read_text())
REPO = Path(sys.argv[1])
REF = SETTINGS["source_ref"]


def git(*args):
    return subprocess.check_output(["git", "-C", str(REPO), *args])


def text(path, encoding="utf-8-sig"):
    return git("show", f"{REF}:{path}").decode(encoding)


def clean(value):
    value = value.strip()
    return None if value.lower() in {"", "not specified", "nan", "none"} else value


def number(value):
    value = clean(value)
    try:
        return float(value) if value is not None else None
    except ValueError:
        return None


metadata = json.loads(text("data/processed/processing_metadata.json"))
taxonomy = json.loads(text("data/skills_taxonomy.json"))["skills"]
config = text("config.yaml")
commit = git("rev-parse", REF).decode().strip()
# These narrow readers fail if the inspected config layout changes.
warning_threshold = int(re.search(
    r"^  sample_size_warning_threshold: (\d+)$", config, re.M
).group(1))
min_required = int(re.search(
    r"^  min_postings_per_role: (\d+)$", config, re.M
).group(1))
role_rules = re.findall(
    r'^    "([^"]+)":\n      pattern:.*?\n      priority: (\d+)\n      description: "([^"]+)"',
    config, re.M
)
if not role_rules:
    raise ValueError("Source role config could not be parsed; snapshot not updated")
known_roles = {name: description for name, _, description in role_rules}
skill_info = {x["canonical"]: x for x in taxonomy}
date = metadata["date_coverage"]
counts = metadata["stage_row_counts"]
role_counts = metadata["role_counts"]
roles = [
    {
        "name": name, "description": known_roles[name],
        "postings": role_counts[name],
        "sample_warning": role_counts[name] < warning_threshold,
    }
    for name, _, _ in role_rules
    if name in role_counts
]

inventory = {}
catalog = []
for filename in ["CourseraDataset-Clean.csv", "Job Posting.csv", "JobsDatasetProcessed.csv"]:
    # Source inspection script uses latin-1 for the commercial teaser CSV.
    encoding = "latin-1" if filename == "Job Posting.csv" else "utf-8-sig"
    reader = csv.DictReader(io.StringIO(text("data/" + filename, encoding)))
    rows = list(reader)
    inventory[filename] = {"rows": len(rows), "columns": reader.fieldnames, "encoding": encoding}
    if filename == "CourseraDataset-Clean.csv":
        catalog = rows

demands = {}
for role in roles:
    name, denominator = role["name"], role["postings"]
    ordered = sorted(
        metadata["skill_extraction_summary"]["target_role_top_skills"][name].items(),
        key=lambda item: -item[1]
    )
    demands[name] = {
        "role": name,
        "status": "success" if denominator >= min_required else "insufficient_evidence",
        "denominator": denominator,
        "time_window": f'{date["min_date"][:10]} to {date["max_date"][:10]}',
        "deduplication_policy": ", ".join(metadata["deduplication_policy"]["key"]),
        "sample_size_warning": role["sample_warning"],
        "warning_message": (
            f"Small sample: {denominator} postings, below the configured caution threshold "
            f"of {warning_threshold}. Interpret percentages with care."
            if role["sample_warning"] else None
        ),
        "scope_note": "Top skills recorded in repository processing metadata only. "
                      "Skills outside this list are unobserved in this snapshot, not zero-demand.",
        "skills": [
            {
                "rank": rank, "skill": skill,
                "category": skill_info.get(skill, {}).get("category", "Uncategorized"),
                "mention_count": mentions,
                "posting_share": mentions / denominator,
                "posting_share_percentage": 100 * mentions / denominator,
            }
            for rank, (skill, mentions) in enumerate(ordered, 1)
        ] if denominator >= min_required else []
    }

courses = {}
for skill in dict.fromkeys(x["skill"] for d in demands.values() for x in d["skills"]):
    terms = {skill.casefold(), *(a.casefold() for a in skill_info.get(skill, {}).get("aliases", []))}
    keywords = [t for t in terms if len(t) >= SETTINGS["minimum_title_keyword_length"]]

    def contains(value):
        return any(re.search(r"(?<!\w)" + re.escape(term) + r"(?!\w)", value.casefold())
                   for term in keywords)

    hits = []
    for record, row in enumerate(catalog, 1):
        tags = [t.strip() for t in (clean(row["Skill gain"]) or "").split(",") if t.strip()]
        tag_match = bool(terms.intersection(t.casefold() for t in tags))
        title_match = contains(row["Course Title"])
        description_match = contains(clean(row["What you will learn"]) or "")
        if not (tag_match or title_match or description_match):
            continue
        url = clean(row["Course Url"])
        if url and not re.match(r"^https://(?:www\.)?coursera\.org/", url):
            url = None
        reason = "skill tag" if tag_match else "course title" if title_match else "learning description"
        rating = number(row["Rating"])
        duration = number(row["Duration to complete (Approx.)"])
        item = {
            "id": f"coursera-record-{record}",
            "source_record": record,
            "title": row["Course Title"],
            "provider": clean(row["Offered By"]),
            "url": url, "level": clean(row["Level"]),
            "rating": rating if rating is not None and rating > 0 else None,
            "duration_hours": duration if duration is not None and duration > 0 else None,
            "skills": tags,
            "match_reason": f'Matched "{skill}" or a taxonomy alias in the {reason}.',
        }
        hits.append(((not tag_match, not title_match, not description_match, record), item))
    hits.sort(key=lambda x: x[0])
    courses[skill] = {
        "skill": skill,
        "total_matches": len(hits),
        "courses": [item for _, item in hits[:SETTINGS["course_results_limit"]]],
        "method": "Exact taxonomy aliases: skill-tag matches, then title, then learning description; "
                  "ties preserve source record order. No semantic or AI ranking.",
        "disclaimer": "Historical Coursera catalog records; ratings and estimated hours may be outdated. "
                      "Price, Malaysian availability, teaching language and accessibility are not verified. "
                      "Course relevance is not evidence of employer demand.",
    }

overview = {
    "source_mode": "repository_snapshot",
    "repository_url": SETTINGS["source_repository"],
    "source_commit": commit,
    "processed_at": metadata["timestamp_utc"],
    "pipeline_version": metadata["pipeline_version"],
    "total_postings": counts["final_processed_rows"],
    "target_postings": role_counts["target_roles_total"],
    "raw_postings": counts["raw_loaded"],
    "excluded_postings": counts["unknown_location_excluded"],
    "duplicates_removed": counts["duplicates_removed"],
    "coverage_start": date["min_date"],
    "coverage_end": date["max_date"],
    "observed_months": date["months_count"],
    "deduplication_policy": ", ".join(metadata["deduplication_policy"]["key"]),
    "course_count": len(catalog),
    "roles": roles,
    "licenses": [
        {"filename": filename, "status": status}
        for filename, status in metadata["dataset_licenses"].items()
    ],
    "trend_status": "unavailable",
    "trend_reason": "This metadata snapshot has no role-specific monthly skill observations. "
                    "Overall dataset date coverage does not establish reliable role-level trends.",
    "limitations": [
        "Repository snapshot, not a live connection to the RunPod API or current vacancies.",
        "Market totals cover all deduplicated Malaysian postings; only the target-role subset is used for role statistics.",
        "Only top skills preserved in processing metadata are available; missing skills are not zero-demand.",
        "Source processing counts were read from metadata, not independently reprocessed from raw JobStreet data.",
        "The raw JobStreet CSV, dataset inventory document, AGENTS.md and backend test directory are absent from this repository snapshot.",
        "JobStreet and Coursera redistribution rights are unspecified in source metadata and require review before public release.",
        "No forecasts, hiring probabilities, AI-generated advice, SDG impact claims or personalized matching are computed in this milestone.",
    ],
}
output = ROOT / "artifacts/api-server/src/data/workforce-snapshot.json"
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps({"overview": overview, "demands": demands, "courses": courses}, indent=2))
audit = {
    "source_repository": SETTINGS["source_repository"],
    "source_commit": commit, "csv_inventory": inventory,
    "thresholds": {"minimum_postings": min_required, "sample_warning": warning_threshold},
    "source_metadata_counts": counts, "source_role_counts": role_counts,
    "distinct_dashboard_skills": len(courses),
    "bounded_course_records": sum(len(c["courses"]) for c in courses.values()),
    "output_bytes": output.stat().st_size,
}
(ROOT / "docs").mkdir(exist_ok=True)
(ROOT / "docs/source-inventory.json").write_text(json.dumps(audit, indent=2))
print(json.dumps(audit, indent=2))
