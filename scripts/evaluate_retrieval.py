"""
Retrieval Evaluation Script for Coursera Course Recommendations.
Generates candidate query-course pairs for human evaluation without self-labeling.
Computes retrieval metrics (Precision@5, Recall@10, MRR, nDCG@10, and latency)
across TF-IDF, Dense, and Hybrid retrievers.
"""

import os
import json
import time
import math
import logging
from typing import Dict, List, Any, Optional

from app.config import Config, load_config
from app.data_loader import load_coursera_data
from app.course_recommender import TfidfCourseRetriever
from app.embeddings import EmbeddingRetriever, HybridRetriever

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("evaluate_retrieval")

# 30 representative real skill gaps derived from Malaysian tech role demands
EVAL_SKILL_GAPS = [
    "Python", "SQL", "ETL", "Docker", "Kubernetes",
    "AWS", "Machine Learning", "Deep Learning", "Apache Spark", "React",
    "Java", "Power BI", "Data Analysis", "Azure", "Git",
    "Cybersecurity", "Data Warehouse", "Node.js", "Tableau", "Linux",
    "C++", "NoSQL", "Spring Boot", "TensorFlow", "PyTorch",
    "DevOps", "Microservices", "REST API", "CI/CD", "Pandas"
]


def generate_candidate_pairs(
    skill_gaps: List[str],
    retrievers: Dict[str, Any],
    top_k: int = 5
) -> List[Dict[str, Any]]:
    """
    Extracts candidate query-course pairs across all retrievers for human labeling.
    Does NOT self-label relevance, guaranteeing unbiased human evaluation.
    """
    candidates = []
    pair_id = 1

    for skill in skill_gaps:
        course_pool = {}
        for ret_name, retriever in retrievers.items():
            results = retriever.retrieve_for_gap(skill, top_k=top_k)
            for rank, c in enumerate(results, start=1):
                url = c["course_url"]
                if url not in course_pool:
                    course_pool[url] = {
                        "pair_id": pair_id,
                        "query_skill": skill,
                        "course_title": c["course_title"],
                        "course_url": url,
                        "source_record_id": c["source_record_id"],
                        "difficulty_level": c.get("difficulty_level"),
                        "retrieved_by": [ret_name],
                        "retriever_ranks": {ret_name: rank},
                        "human_label": None  # Left blank for human annotator (0: irrelevant, 1: relevant, 2: highly relevant)
                    }
                    pair_id += 1
                else:
                    course_pool[url]["retrieved_by"].append(ret_name)
                    course_pool[url]["retriever_ranks"][ret_name] = rank

        candidates.extend(list(course_pool.values()))

    return candidates


def compute_metrics_summary(
    retrievers: Dict[str, Any],
    skill_gaps: List[str]
) -> Dict[str, Any]:
    """
    Measures latency and retrieval candidate yield across retrievers.
    Simulates placeholder IR evaluation structure (P@5, R@10, MRR, nDCG@10)
    ready to populate when human labels are applied.
    """
    benchmarks = {}

    for ret_name, ret in retrievers.items():
        latencies = []
        total_courses_returned = 0

        for skill in skill_gaps:
            t0 = time.perf_counter()
            courses = ret.retrieve_for_gap(skill, top_k=10)
            elapsed = (time.perf_counter() - t0) * 1000.0  # ms
            latencies.append(elapsed)
            total_courses_returned += len(courses)

        avg_latency = sum(latencies) / len(latencies) if latencies else 0.0
        p95_latency = sorted(latencies)[int(len(latencies) * 0.95)] if latencies else 0.0

        benchmarks[ret_name] = {
            "queries_evaluated": len(skill_gaps),
            "average_latency_ms": round(avg_latency, 2),
            "p95_latency_ms": round(p95_latency, 2),
            "total_courses_retrieved": total_courses_returned,
            "mean_results_per_query": round(total_courses_returned / len(skill_gaps), 1),
            "metrics_status": "Awaiting human annotation in retrieval_eval_candidates.json",
            "p_at_5": None,
            "r_at_10": None,
            "mrr": None,
            "ndcg_at_10": None,
            "current_default": ret_name == "tfidf"
        }

    return benchmarks


def main():
    config = load_config()
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    output_dir = os.path.join(base_dir, "data")
    os.makedirs(output_dir, exist_ok=True)

    df_coursera = load_coursera_data(config=config)
    tfidf = TfidfCourseRetriever(df_coursera=df_coursera, config=config)
    dense = EmbeddingRetriever(df_coursera=df_coursera, config=config, fallback_retriever=tfidf)
    hybrid = HybridRetriever(tfidf_retriever=tfidf, dense_retriever=dense)

    retrievers = {
        "tfidf": tfidf,
        "dense": dense,
        "hybrid": hybrid
    }

    logger.info("Extracting candidate evaluation pairs for %d queries...", len(EVAL_SKILL_GAPS))
    candidate_pairs = generate_candidate_pairs(EVAL_SKILL_GAPS, retrievers, top_k=5)
    candidates_path = os.path.join(output_dir, "retrieval_eval_candidates.json")

    with open(candidates_path, "w", encoding="utf-8") as f:
        json.dump({
            "metadata": {
                "total_candidate_pairs": len(candidate_pairs),
                "total_queries": len(EVAL_SKILL_GAPS),
                "retrievers_compared": list(retrievers.keys()),
                "scoring_guidelines": {
                    "0": "Irrelevant / No coverage of the target skill",
                    "1": "Marginally relevant / Skill is mentioned tangentially",
                    "2": "Directly relevant / Primary focus is teaching the target skill"
                }
            },
            "candidates": candidate_pairs
        }, f, indent=2)

    logger.info("Saved %d candidate pairs for human evaluation to: %s", len(candidate_pairs), candidates_path)

    logger.info("Computing retrieval latency and yield benchmarks...")
    benchmarks = compute_metrics_summary(retrievers, EVAL_SKILL_GAPS)
    report_path = os.path.join(output_dir, "retrieval_evaluation_report.json")

    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(benchmarks, f, indent=2)

    logger.info("Saved retrieval benchmark summary to: %s", report_path)
    print("SUCCESS: Retrieval evaluation candidates and benchmarks generated.")


if __name__ == "__main__":
    main()
