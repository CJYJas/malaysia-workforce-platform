"""
Unit tests for Part 2: Dense & Hybrid Embeddings, Retrievers, and Semantic Suggestions.
Covers:
- TfidfCourseRetriever, EmbeddingRetriever, and HybridRetriever.
- Fallback to TF-IDF on missing or corrupt .npy files.
- Environment variable RETRIEVER selection ('tfidf', 'dense', 'hybrid').
- Semantic skill suggestions for uncataloged phrases (confirmed=False).
- Retrieval evaluation candidate formatting and benchmark structure.
"""

import os
import pytest
import numpy as np

from app.course_recommender import TfidfCourseRetriever, CourseRecommender
from app.embeddings import (
    EmbeddingRetriever,
    HybridRetriever,
    DenseEmbedder,
    SemanticSkillSuggester,
    get_course_retriever
)


def test_dense_embedder_encodes_texts():
    embedder = DenseEmbedder()
    texts = ["Python data science and machine learning", "Docker containerization Kubernetes"]
    embs = embedder.encode(texts, normalize_embeddings=True)

    assert embs.shape == (2, 384)
    # Normalized embeddings should have unit length ~ 1.0
    norms = np.linalg.norm(embs, axis=1)
    for n in norms:
        assert pytest.approx(n, abs=1e-3) == 1.0


def test_dense_embedder_empty_input():
    embedder = DenseEmbedder()
    embs = embedder.encode([], normalize_embeddings=True)
    assert embs.shape == (0, 384)


def test_embedding_retriever_retrieval():
    retriever = EmbeddingRetriever()
    results = retriever.retrieve_for_gap("Python", top_k=3)

    assert len(results) > 0
    assert len(results) <= 3
    for c in results:
        assert "course_title" in c
        assert "course_url" in c
        assert c["gap_addressed"] == "Python"
        assert c["relevance_score"] > 0
        assert c["source_record_id"].startswith("coursera_")


def test_hybrid_retriever_rrf_scoring():
    tfidf = TfidfCourseRetriever()
    dense = EmbeddingRetriever(fallback_retriever=tfidf)
    hybrid = HybridRetriever(tfidf_retriever=tfidf, dense_retriever=dense, rrf_k=60)

    results = hybrid.retrieve_for_gap("SQL", top_k=4)

    assert len(results) > 0
    assert len(results) <= 4
    for c in results:
        assert c["retriever"] == "hybrid_rrf"
        assert c["relevance_score"] > 0
        assert "RRF score" in c["why_recommended"]


def test_fallback_to_tfidf_on_corrupt_npy(tmp_path):
    bad_npy = tmp_path / "corrupt.npy"
    bad_npy.write_bytes(b"bad binary content not a numpy array")
    bad_meta = tmp_path / "meta.json"
    bad_meta.write_text('{"records_count": 999999}', encoding="utf-8")

    # Should not crash; gracefully falls back to TF-IDF
    retriever = EmbeddingRetriever(embeddings_path=str(bad_npy), meta_path=str(bad_meta))
    results = retriever.retrieve_for_gap("SQL", top_k=2)

    assert len(results) > 0
    assert results[0]["gap_addressed"] == "SQL"


def test_get_course_retriever_env_var(monkeypatch):
    monkeypatch.setenv("RETRIEVER", "dense")
    ret_dense = get_course_retriever()
    assert isinstance(ret_dense, EmbeddingRetriever)

    monkeypatch.setenv("RETRIEVER", "hybrid")
    ret_hybrid = get_course_retriever()
    assert isinstance(ret_hybrid, HybridRetriever)

    monkeypatch.setenv("RETRIEVER", "tfidf")
    ret_tfidf = get_course_retriever()
    assert isinstance(ret_tfidf, TfidfCourseRetriever)

    # Invalid / empty defaults to tfidf
    monkeypatch.setenv("RETRIEVER", "unknown_retriever")
    ret_default = get_course_retriever()
    assert isinstance(ret_default, TfidfCourseRetriever)


def test_semantic_skill_suggester():
    suggester = SemanticSkillSuggester()
    # Unmatched phrases
    unmatched = ["deep neural networks", "data wrangling", "random unknown buzzword 12345"]
    suggestions = suggester.suggest_canonical_skills(unmatched, top_k=1, min_similarity=0.4)

    assert len(suggestions) > 0
    for s in suggestions:
        assert "phrase" in s
        assert "suggested_canonical" in s
        assert s["tag"] == "semantic_suggestion"
        # BINDING RULE: confirmed must be False, never counted in match score
        assert s["confirmed"] is False
        assert s["similarity"] >= 0.4
        assert "not counted in match score" in s["note"]


def test_exact_keyword_match():
    retriever = get_course_retriever("hybrid")
    results = retriever.retrieve_for_gap("Python", top_k=3)
    assert len(results) > 0
    assert len(results) <= 3
    # Check that top result is Python related
    top = results[0]
    assert "python" in (top["course_title"] + " " + str(top.get("skills_gained", ""))).lower()
    assert top["match_signal"] in ("both", "keyword", "semantic")


def test_semantically_related_query_different_wording():
    """Verifies that 'data pipeline orchestration' retrieves relevant ETL/workflow/Airflow courses."""
    retriever = get_course_retriever("hybrid")
    results = retriever.retrieve_for_gap("data pipeline orchestration", top_k=3)
    assert len(results) > 0
    # Should find courses touching data engineering / pipelines / orchestration
    combined_text = " ".join(
        (r["course_title"] + " " + str(r.get("skills_gained", "")) + " " + r.get("why_recommended", "")).lower()
        for r in results
    )
    assert any(term in combined_text for term in ["data", "pipeline", "airflow", "engineering", "etl", "cloud", "orchestration"])
    # At least one result should originate from the semantic signal
    assert any(r["match_signal"] in ("semantic", "both") for r in results)


def test_duplicate_courses_deduplicated_in_hybrid():
    """Verifies courses matched by both TF-IDF and Dense appear only once with 'both' label."""
    retriever = get_course_retriever("hybrid")
    results = retriever.retrieve_for_gap("Machine Learning", top_k=5)
    assert len(results) > 0
    urls = [r["course_url"] for r in results]
    assert len(urls) == len(set(urls)), "Duplicate course URLs found in hybrid results!"


def test_empty_query_and_missing_descriptions():
    retriever = get_course_retriever("hybrid")
    assert retriever.retrieve_for_gap("") == []
    assert retriever.retrieve_for_gap("   ") == []
    assert retriever.retrieve_for_gap(None) == []  # type: ignore


def test_empty_course_dataset():
    """Verifies graceful handling when initialized with an empty dataframe."""
    import pandas as pd
    empty_df = pd.DataFrame(columns=[
        "Course Title", "Course Url", "Skill gain", "Modules", "Level", "Rating",
        "Duration to complete (Approx.)", "Offered By", "What you will learn"
    ])
    tfidf = TfidfCourseRetriever(df_coursera=empty_df)
    dense = EmbeddingRetriever(df_coursera=empty_df, fallback_retriever=tfidf)
    hybrid = HybridRetriever(tfidf_retriever=tfidf, dense_retriever=dense)

    assert tfidf.retrieve_for_gap("Python") == []
    assert dense.retrieve_for_gap("Python") == []
    assert hybrid.retrieve_for_gap("Python") == []


def test_top_k_limits_and_result_ordering():
    retriever = get_course_retriever("hybrid")
    top_2 = retriever.retrieve_for_gap("Python", top_k=2)
    top_5 = retriever.retrieve_for_gap("Python", top_k=5)

    assert len(top_2) <= 2
    assert len(top_5) <= 5

    # Check strictly monotonic descending score order
    scores = [r["relevance_score"] for r in top_5]
    for i in range(len(scores) - 1):
        assert scores[i] >= scores[i + 1]


def test_cache_reuse_and_invalidation(tmp_path):
    """Verifies that mismatched hash in meta.json prevents using stale/invalid cache."""
    fake_npy = tmp_path / "stale.npy"
    fake_npy.write_bytes(b"\x00" * 100)
    fake_meta = tmp_path / "stale_meta.json"
    fake_meta.write_text('{"dataset_sha256": "wrong_hash", "records_count": 8370, "backend": "onnx"}', encoding="utf-8")

    retriever = EmbeddingRetriever(embeddings_path=str(fake_npy), meta_path=str(fake_meta), auto_rebuild=False)
    assert retriever.is_ready is False
    # Still safely answers query via fallback
    results = retriever.retrieve_for_gap("SQL", top_k=2)
    assert len(results) > 0


def test_keyword_only_fallback_when_disabled(monkeypatch):
    monkeypatch.setenv("SEMANTIC_RETRIEVAL_ENABLED", "false")
    ret = get_course_retriever()
    assert isinstance(ret, TfidfCourseRetriever)
    results = ret.retrieve_for_gap("SQL", top_k=2)
    assert len(results) > 0


def test_evaluation_artifacts_exist():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    candidates_path = os.path.join(base_dir, "data", "retrieval_eval_candidates.json")
    report_path = os.path.join(base_dir, "data", "retrieval_evaluation_report.json")

    assert os.path.exists(candidates_path)
    assert os.path.exists(report_path)

    import json
    with open(candidates_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert data["metadata"]["total_candidate_pairs"] >= 30
    assert len(data["candidates"]) >= 30

    # Human label must be None (not self-labeled)
    sample_candidate = data["candidates"][0]
    assert sample_candidate["human_label"] is None
    assert "query_skill" in sample_candidate
    assert "course_title" in sample_candidate

