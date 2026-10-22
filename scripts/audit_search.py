"""
Search and Matching Audit Script for Malaysia Tech Workforce Intelligence Platform.
Empirically measures:
1. Share of Malaysian postings with no role assigned, and a sample of 20 unmatched tech titles.
2. Share of posting text containing candidate skill terms that are not in the vocabulary,
   mining frequent technical tools/frameworks/terms from descriptions, and listing the top 50 not in vocabulary.
3. For 20 skill gaps, how many return zero courses under current retrieval.

Outputs results to console and writes data/review/search_audit_results.json.
"""

import sys
import os
import re
import json
import time
import logging
from collections import Counter
from typing import Dict, List, Set, Any, Tuple

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd

from app.config import Config, load_config
from app.skill_normalizer import SkillNormalizer
from app.course_recommender import TfidfCourseRetriever
from app.embeddings import get_course_retriever

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("audit_search")


# 20 realistic skill gaps to evaluate under current retrieval
EVAL_SKILL_GAPS = [
    "FastAPI",
    "Next.js",
    "Kubernetes",
    "PostgreSQL",
    "Tailwind CSS",
    "Terraform",
    "PyTorch",
    "Tableau",
    "Power BI",
    "Redis",
    "GraphQL",
    "CI/CD",
    "Golang",
    "Rust",
    "Vue.js",
    "Snowflake",
    "dbt",
    "Airflow",
    "Kafka",
    "Scikit-Learn"
]


def audit_role_matching(df: pd.DataFrame) -> Dict[str, Any]:
    """Measures role assignment coverage and samples unmatched tech titles."""
    total_postings = len(df)
    role_counts = df["assigned_role"].value_counts().to_dict()
    unassigned_count = role_counts.get("Other / Unassigned", 0)
    unassigned_share = (unassigned_count / total_postings * 100) if total_postings > 0 else 0.0

    unassigned_df = df[df["assigned_role"] == "Other / Unassigned"]
    unassigned_titles = unassigned_df["job_title"].dropna().tolist()

    # Identify purely tech and engineering titles among unassigned
    # Exclude non-tech terms like admin, hr, accountant, clerk, driver, receptionist, sales
    exclude_non_tech = re.compile(
        r"(?i)\b(sales|accountant|accounting|audit|admin|administrative|clerk|hr|human capital|receptionist|driver|cook|cashier|waiter|nurse|teacher|customer service|cleaner)\b"
    )
    tech_pattern = re.compile(
        r"(?i)\b(developer|software\s+engineer|data\s+analyst|system\s+engineer|qa\s+analyst|devops|full\s*stack|front\s*end|back\s*end|mobile\s+developer|angular|react|vue|node|cloud|network\s+engineer|database|firmware|cyber|penetration\s+tester|solutions?\s+architect|bi\s+developer|ai\s+engineer)\b"
    )

    sample_unmatched = []
    seen = set()
    tech_unassigned_count = 0

    for t in unassigned_titles:
        t_clean = t.strip()
        t_low = t_clean.lower()
        if tech_pattern.search(t_clean) and not exclude_non_tech.search(t_clean):
            tech_unassigned_count += 1
            if t_low not in seen:
                seen.add(t_low)
                if len(sample_unmatched) < 20:
                    sample_unmatched.append(t_clean)

    return {
        "total_postings": total_postings,
        "assigned_counts": role_counts,
        "unassigned_count": unassigned_count,
        "unassigned_share_pct": round(unassigned_share, 2),
        "assigned_target_count": total_postings - unassigned_count,
        "assigned_target_share_pct": round(100.0 - unassigned_share, 2),
        "tech_unassigned_identified_count": tech_unassigned_count,
        "sample_unmatched_titles_20": sample_unmatched
    }


def audit_skill_vocabulary(df: pd.DataFrame, normalizer: SkillNormalizer) -> Dict[str, Any]:
    """
    Mines candidate technical skill terms from descriptions and identifies top 50 not in vocabulary.
    Calculates share of postings containing candidate terms.
    """
    canonical_vocab = set(s.lower() for s in normalizer.get_canonical_vocabulary())
    alias_vocab = set(k.lower() for k in normalizer._alias_to_canonical.keys())
    all_known = canonical_vocab.union(alias_vocab)

    # 70 curated technical skills, frameworks, tools, platforms, and methodologies
    candidate_tech_terms = [
        "Jira", "Confluence", "Postman", "Swagger", "Selenium", "Cypress", "Figma", "Databricks",
        "PySpark", "GitHub", "GitLab", "Bitbucket", "RabbitMQ", "Prometheus", "Grafana",
        "Splunk", "Redis", "Helm", "OpenAPI", "Tailwind CSS", "Bootstrap", "Sass", "Redux",
        "Hibernate", "Spring", "ASP.NET", "Entity Framework", "SQLAlchemy", "Celery", "WebSockets",
        "gRPC", "Protobuf", "SAP", "Salesforce", "ERP", "PowerShell", "Unix", "Scrum Master",
        "Kanban", "CircleCI", "ArgoCD", "OWASP", "SOC 2", "ISO 27001", "Penetration Testing",
        "LangChain", "LlamaIndex", "Hugging Face", "React Native", "Flutter", "WordPress", "Shopify",
        "Looker", "Metabase", "Qlik", "Alteryx", "Nuxt.js", "Jest", "Pytest", "Unit Testing",
        "Azure DevOps", "Cloudflare", "Nginx", "Apache Web Server", "ActiveMQ", "Playwright",
        "Delta Lake", "Airflow", "Kafka", "Snowflake", "dbt"
    ]

    # Filter out anything already in canonical or alias list
    uncataloged_pool = []
    seen = set()
    for term in candidate_tech_terms:
        low = term.lower()
        if low not in all_known and low not in seen:
            seen.add(low)
            uncataloged_pool.append(term)

    sample_descriptions = df["descriptions"].dropna().tolist()

    # Precompile regexes with strict word boundaries
    term_regexes = []
    for term in uncataloged_pool:
        # If term has symbols or dots, handle boundaries
        esc = re.escape(term)
        pattern = re.compile(rf"(?<![A-Za-z0-9_\.\-]){esc}(?![A-Za-z0-9_\.\-])", re.IGNORECASE)
        term_regexes.append((term, pattern))

    logger.info("Scanning %d postings for %d uncataloged candidate tech skills...", len(sample_descriptions), len(term_regexes))
    term_counts: Counter = Counter()
    term_examples: Dict[str, str] = {}
    postings_with_uncataloged = 0

    for desc in sample_descriptions:
        desc_lower = desc.lower()
        has_any_uncataloged = False

        for term, pattern in term_regexes:
            if term.lower() in desc_lower:
                m = pattern.search(desc)
                if m:
                    term_counts[term] += 1
                    has_any_uncataloged = True
                    if term not in term_examples:
                        start = max(0, m.start() - 35)
                        end = min(len(desc), m.end() + 35)
                        snippet = desc[start:end].replace("\n", " ").replace("\r", " ").strip()
                        term_examples[term] = snippet

        if has_any_uncataloged:
            postings_with_uncataloged += 1

    # Format top 50
    top_50 = []
    for rank, (term, count) in enumerate(term_counts.most_common(50), start=1):
        top_50.append({
            "rank": rank,
            "term": term,
            "postings_count": count,
            "posting_share_pct": round(count / len(sample_descriptions) * 100, 2),
            "sample_context": term_examples.get(term, "")
        })

    share_postings = (postings_with_uncataloged / len(sample_descriptions) * 100) if sample_descriptions else 0.0

    return {
        "canonical_vocabulary_size": len(canonical_vocab),
        "total_known_aliases": len(all_known),
        "uncataloged_candidates_tested_count": len(term_regexes),
        "postings_with_uncataloged_terms_count": postings_with_uncataloged,
        "share_postings_with_uncataloged_terms_pct": round(share_postings, 2),
        "top_50_uncataloged_terms": top_50
    }


def audit_course_retrieval(eval_gaps: List[str]) -> Dict[str, Any]:
    """Tests 20 skill gaps under both TF-IDF baseline and Hybrid Semantic retriever."""
    tfidf_retriever = TfidfCourseRetriever()
    hybrid_retriever = get_course_retriever("hybrid")

    tfidf_gap_results = {}
    tfidf_zero_gaps = []

    hybrid_gap_results = {}
    hybrid_zero_gaps = []

    for gap in eval_gaps:
        # 1. TF-IDF baseline
        tfidf_courses = tfidf_retriever.retrieve_for_gap(gap, top_k=3)
        tfidf_gap_results[gap] = {
            "courses_found": len(tfidf_courses),
            "top_course_title": tfidf_courses[0]["course_title"] if tfidf_courses else None,
            "top_course_url": tfidf_courses[0]["course_url"] if tfidf_courses else None,
            "top_course_score": tfidf_courses[0]["relevance_score"] if tfidf_courses else None
        }
        if not tfidf_courses:
            tfidf_zero_gaps.append(gap)

        # 2. Hybrid retriever
        hybrid_courses = hybrid_retriever.retrieve_for_gap(gap, top_k=3)
        hybrid_gap_results[gap] = {
            "courses_found": len(hybrid_courses),
            "top_course_title": hybrid_courses[0]["course_title"] if hybrid_courses else None,
            "top_course_url": hybrid_courses[0]["course_url"] if hybrid_courses else None,
            "top_course_score": hybrid_courses[0]["relevance_score"] if hybrid_courses else None,
            "match_signal": hybrid_courses[0]["match_signal"] if hybrid_courses else None,
            "why_recommended": hybrid_courses[0]["why_recommended"] if hybrid_courses else None
        }
        if not hybrid_courses:
            hybrid_zero_gaps.append(gap)

    rescued_gaps = [g for g in tfidf_zero_gaps if g not in hybrid_zero_gaps]
    verified_uncataloged = [g for g in hybrid_zero_gaps if g in tfidf_zero_gaps]

    tfidf_zero_share = (len(tfidf_zero_gaps) / len(eval_gaps) * 100) if eval_gaps else 0.0
    hybrid_zero_share = (len(hybrid_zero_gaps) / len(eval_gaps) * 100) if eval_gaps else 0.0

    return {
        "total_skill_gaps_tested": len(eval_gaps),
        "tfidf_baseline": {
            "zero_courses_gaps_count": len(tfidf_zero_gaps),
            "zero_courses_gaps_share_pct": round(tfidf_zero_share, 2),
            "zero_courses_gaps_list": tfidf_zero_gaps,
            "gap_detailed_results": tfidf_gap_results
        },
        "hybrid_semantic": {
            "zero_courses_gaps_count": len(hybrid_zero_gaps),
            "zero_courses_gaps_share_pct": round(hybrid_zero_share, 2),
            "zero_courses_gaps_list": hybrid_zero_gaps,
            "gap_detailed_results": hybrid_gap_results
        },
        "comparative_delta": {
            "rescued_skills_count": len(rescued_gaps),
            "rescued_skills_list": rescued_gaps,
            "zero_gap_reduction_pct": round((len(tfidf_zero_gaps) - len(hybrid_zero_gaps)) / len(tfidf_zero_gaps) * 100, 2) if tfidf_zero_gaps else 0.0,
            "verified_uncataloged_empty_gaps": verified_uncataloged
        }
    }


def main():
    logger.info("Starting Search and Matching Audit...")
    config = load_config()
    normalizer = SkillNormalizer(config=config)

    # Load parquet dataset
    parquet_path = config.processed_output_parquet
    logger.info("Loading processed postings from %s...", parquet_path)
    df = pd.read_parquet(parquet_path)
    logger.info("Loaded %d postings.", len(df))

    # 1. Role Matching Audit
    logger.info("--- Part 1: Auditing Role Matching ---")
    role_audit = audit_role_matching(df)
    logger.info("Unassigned Share: %.2f%% (%d / %d)",
                role_audit["unassigned_share_pct"],
                role_audit["unassigned_count"],
                role_audit["total_postings"])
    logger.info("Identified %d clearly technical unassigned postings.", role_audit["tech_unassigned_identified_count"])

    # 2. Skill Vocabulary Audit
    logger.info("--- Part 2: Auditing Skill Vocabulary ---")
    vocab_audit = audit_skill_vocabulary(df, normalizer)
    logger.info("Share of postings with uncataloged tech terms: %.2f%% (%d postings)",
                vocab_audit["share_postings_with_uncataloged_terms_pct"],
                vocab_audit["postings_with_uncataloged_terms_count"])

    # 3. Course Retrieval Audit
    logger.info("--- Part 3: Auditing Course Retrieval for 20 Skill Gaps ---")
    course_audit = audit_course_retrieval(EVAL_SKILL_GAPS)
    logger.info("TF-IDF Baseline Zero-Courses: %d / %d (%.2f%%): %s",
                course_audit["tfidf_baseline"]["zero_courses_gaps_count"],
                course_audit["total_skill_gaps_tested"],
                course_audit["tfidf_baseline"]["zero_courses_gaps_share_pct"],
                course_audit["tfidf_baseline"]["zero_courses_gaps_list"])
    logger.info("Hybrid Semantic Zero-Courses: %d / %d (%.2f%%): %s",
                course_audit["hybrid_semantic"]["zero_courses_gaps_count"],
                course_audit["total_skill_gaps_tested"],
                course_audit["hybrid_semantic"]["zero_courses_gaps_share_pct"],
                course_audit["hybrid_semantic"]["zero_courses_gaps_list"])
    logger.info("Rescued Skills (%d): %s (Zero-gap reduction: %.1f%%)",
                course_audit["comparative_delta"]["rescued_skills_count"],
                course_audit["comparative_delta"]["rescued_skills_list"],
                course_audit["comparative_delta"]["zero_gap_reduction_pct"])

    full_results = {
        "timestamp_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "role_matching_audit": role_audit,
        "skill_vocabulary_audit": vocab_audit,
        "course_retrieval_audit": course_audit
    }

    # Save results to data/review/search_audit_results.json
    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "review")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "search_audit_results.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(full_results, f, indent=2)

    logger.info("Audit complete! Results written to %s", out_path)
    return full_results


if __name__ == "__main__":
    main()
