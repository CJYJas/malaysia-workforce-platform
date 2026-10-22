"""
Dense and Hybrid Course Retrieval and Semantic Skill Suggestions for Malaysia Tech Workforce Platform.
Implements:
- EmbeddingRetriever using dense embeddings (sentence-transformers or offline precomputed .npy).
- HybridRetriever using Reciprocal Rank Fusion (RRF) between TF-IDF and dense embeddings.
- Automatic fallback to TfidfCourseRetriever on missing/corrupt embeddings.
- Semantic suggestions for uncataloged candidate phrases (marked confirmed=False).
"""

import os
import json
import hashlib
import logging
from typing import Dict, List, Optional, Any, Tuple
import numpy as np
import pandas as pd

from app.config import Config, load_config
from app.data_loader import load_coursera_data
from app.course_recommender import CourseRetriever, TfidfCourseRetriever
from app.skill_normalizer import SkillNormalizer

logger = logging.getLogger(__name__)

# Try importing sentence_transformers
try:
    from sentence_transformers import SentenceTransformer
    HAVE_SENTENCE_TRANSFORMERS = True
except (ImportError, OSError, Exception) as e:
    logger.debug("SentenceTransformer unavailable (%s). Using fallback vectorizer.", e)
    HAVE_SENTENCE_TRANSFORMERS = False


class DenseEmbedder:
    """
    Encapsulates dense embedding generation.
    Uses SentenceTransformer if available, or a deterministic sklearn-based projection fallback.
    """

    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
        self.model_name = model_name
        self.model = None
        if HAVE_SENTENCE_TRANSFORMERS:
            try:
                logger.info("Initializing SentenceTransformer('%s')...", model_name)
                self.model = SentenceTransformer(model_name)
            except Exception as e:
                logger.warning("Failed to initialize SentenceTransformer (%s). Using fallback vectorizer.", e)
                self.model = None

    def encode(self, texts: List[str], normalize_embeddings: bool = True) -> np.ndarray:
        """Encodes texts into normalized dense embedding vectors."""
        if not texts:
            return np.zeros((0, 384), dtype=np.float32)

        if self.model is not None:
            embeddings = self.model.encode(texts, normalize_embeddings=normalize_embeddings, show_progress_bar=False)
            return np.asarray(embeddings, dtype=np.float32)

        # Fallback: Deterministic TF-IDF + hashing projection into 384 dimensions
        from sklearn.feature_extraction.text import HashingVectorizer
        vectorizer = HashingVectorizer(n_features=384, alternate_sign=False, norm='l2')
        matrix = vectorizer.fit_transform(texts).toarray()
        return matrix.astype(np.float32)


class EmbeddingRetriever:
    """
    Dense Course Retriever conforming to CourseRetriever protocol.
    Matches skill gaps against precomputed course embeddings or computes embeddings on-the-fly.
    Falls back gracefully to TfidfCourseRetriever if embeddings are missing or corrupt.
    """

    def __init__(
        self,
        df_coursera: Optional[pd.DataFrame] = None,
        config: Optional[Config] = None,
        embeddings_path: Optional[str] = None,
        meta_path: Optional[str] = None,
        fallback_retriever: Optional[TfidfCourseRetriever] = None
    ):
        self.config = config or load_config()
        self.df = df_coursera if df_coursera is not None else load_coursera_data(config=self.config)
        self.fallback = fallback_retriever or TfidfCourseRetriever(df_coursera=self.df, config=self.config)
        self.embedder = DenseEmbedder()

        # Paths
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.embeddings_path = embeddings_path or os.path.join(base_dir, "data", "processed", "v1.0.0", "coursera_embeddings.npy")
        self.meta_path = meta_path or os.path.join(base_dir, "data", "processed", "v1.0.0", "coursera_embeddings_meta.json")

        self.embeddings: Optional[np.ndarray] = None
        self.records: List[Dict[str, Any]] = self.fallback.records
        self.is_ready = False
        self._load_or_build_embeddings()

    def _load_or_build_embeddings(self) -> None:
        """Loads precomputed embeddings from .npy if valid, otherwise attempts to build."""
        if os.path.exists(self.embeddings_path) and os.path.exists(self.meta_path):
            try:
                with open(self.meta_path, "r", encoding="utf-8") as f:
                    meta = json.load(f)

                loaded_emb = np.load(self.embeddings_path)
                if len(loaded_emb) == len(self.records):
                    self.embeddings = loaded_emb.astype(np.float32)
                    self.is_ready = True
                    logger.info("Loaded precomputed course embeddings: %s (shape: %s)", self.embeddings_path, self.embeddings.shape)
                    return
                else:
                    logger.warning(
                        "Embedding row count (%d) does not match course records count (%d). Falling back to TF-IDF.",
                        len(loaded_emb), len(self.records)
                    )
            except Exception as e:
                logger.warning("Failed to load precomputed embeddings (%s). Falling back to TF-IDF.", e)

        # Build in-memory embeddings
        try:
            logger.info("Computing dense embeddings in memory for %d Coursera records...", len(self.records))
            texts = [r["search_text"] for r in self.records]
            self.embeddings = self.embedder.encode(texts, normalize_embeddings=True)
            self.is_ready = True
            logger.info("In-memory dense course embeddings ready.")
        except Exception as e:
            logger.error("Failed to build course embeddings (%s). Using fallback retriever.", e)
            self.is_ready = False

    def retrieve_for_gap(self, skill_gap: str, top_k: int = 3) -> List[Dict[str, Any]]:
        """
        Retrieves top Coursera courses for a skill gap using dense cosine similarity.
        Falls back to TF-IDF retriever if embeddings are unavailable.
        """
        if not self.is_ready or self.embeddings is None:
            return self.fallback.retrieve_for_gap(skill_gap, top_k=top_k)

        if not skill_gap or not isinstance(skill_gap, str):
            return []

        query_emb = self.embedder.encode([skill_gap], normalize_embeddings=True)
        # Cosine similarity is dot product of normalized vectors
        scores = np.dot(self.embeddings, query_emb.T).flatten()

        top_indices = np.argsort(scores)[::-1][:top_k * 3]

        results = []
        for idx in top_indices:
            score = float(scores[idx])
            if score < 0.15:  # Relevance threshold
                continue
            rec = self.records[idx]
            results.append({
                "source_record_id": rec["source_record_id"],
                "course_title": rec["title"],
                "course_url": rec["url"],
                "gap_addressed": skill_gap,
                "why_recommended": f"Dense semantic match for your skill gap in '{skill_gap}' (similarity: {round(score, 3)}).",
                "skills_gained": rec["skills_gained"],
                "difficulty_level": rec["level"],
                "rating": rec["rating"],
                "duration": rec["duration"],
                "offered_by": rec["offered_by"],
                "relevance_score": round(score * 10.0, 2),
                "retriever": "dense_embedding"
            })
            if len(results) >= top_k:
                break

        # If dense retrieval yielded zero results, fallback to TF-IDF
        if not results:
            return self.fallback.retrieve_for_gap(skill_gap, top_k=top_k)

        return results


class HybridRetriever:
    """
    Hybrid Course Retriever combining Reciprocal Rank Fusion (RRF)
    between lexical TF-IDF retrieval and dense embedding retrieval.
    RRF Score(d) = 1 / (60 + rank_tfidf(d)) + 1 / (60 + rank_dense(d))
    """

    def __init__(
        self,
        tfidf_retriever: Optional[TfidfCourseRetriever] = None,
        dense_retriever: Optional[EmbeddingRetriever] = None,
        rrf_k: int = 60
    ):
        self.tfidf = tfidf_retriever or TfidfCourseRetriever()
        self.dense = dense_retriever or EmbeddingRetriever(fallback_retriever=self.tfidf)
        self.rrf_k = rrf_k

    def retrieve_for_gap(self, skill_gap: str, top_k: int = 3) -> List[Dict[str, Any]]:
        """
        Combines TF-IDF and Dense retrieval results using RRF.
        """
        candidate_pool_size = max(top_k * 4, 15)
        tfidf_results = self.tfidf.retrieve_for_gap(skill_gap, top_k=candidate_pool_size)
        dense_results = self.dense.retrieve_for_gap(skill_gap, top_k=candidate_pool_size)

        rrf_scores: Dict[str, float] = {}
        course_data: Dict[str, Dict[str, Any]] = {}

        # Rank TF-IDF results
        for rank, item in enumerate(tfidf_results, start=1):
            url = item["course_url"]
            rrf_scores[url] = rrf_scores.get(url, 0.0) + (1.0 / (self.rrf_k + rank))
            course_data[url] = item

        # Rank Dense results
        for rank, item in enumerate(dense_results, start=1):
            url = item["course_url"]
            rrf_scores[url] = rrf_scores.get(url, 0.0) + (1.0 / (self.rrf_k + rank))
            if url not in course_data:
                course_data[url] = item

        # Sort by RRF score descending
        sorted_urls = sorted(rrf_scores.keys(), key=lambda u: rrf_scores[u], reverse=True)

        final_results = []
        for url in sorted_urls[:top_k]:
            item = dict(course_data[url])
            score = round(rrf_scores[url] * 100.0, 2)
            item["relevance_score"] = score
            item["retriever"] = "hybrid_rrf"
            item["why_recommended"] = (
                f"Hybrid lexical and semantic match addressing skill gap '{skill_gap}' (RRF score: {score})."
            )
            final_results.append(item)

        return final_results


def get_course_retriever(
    retriever_type: Optional[str] = None,
    config: Optional[Config] = None
) -> CourseRetriever:
    """
    Factory creating the configured CourseRetriever based on environment or argument.
    Default: 'tfidf' until human evaluation is completed.
    Supported: 'tfidf', 'dense', 'hybrid'.
    """
    cfg = config or load_config()
    chosen_type = retriever_type or os.environ.get("RETRIEVER", "tfidf").lower().strip()

    tfidf = TfidfCourseRetriever(config=cfg)

    if chosen_type == "dense":
        return EmbeddingRetriever(config=cfg, fallback_retriever=tfidf)
    elif chosen_type == "hybrid":
        dense = EmbeddingRetriever(config=cfg, fallback_retriever=tfidf)
        return HybridRetriever(tfidf_retriever=tfidf, dense_retriever=dense)
    else:
        # Default baseline
        return tfidf


class SemanticSkillSuggester:
    """
    Computes semantic suggestions for uncataloged candidate phrases.
    Guarantees:
    - Never counted as confirmed skills in match scoring.
    - Labeled with tag='semantic_suggestion' and confirmed=False.
    """

    def __init__(self, normalizer: Optional[SkillNormalizer] = None):
        self.normalizer = normalizer or SkillNormalizer()
        self.embedder = DenseEmbedder()
        self.canonical_skills = self.normalizer.get_canonical_vocabulary()
        self._build_skill_index()

    def _build_skill_index(self) -> None:
        """Precomputes embeddings for canonical skills."""
        if not self.canonical_skills:
            self.canonical_embeddings = np.zeros((0, 384), dtype=np.float32)
            return

        self.canonical_embeddings = self.embedder.encode(self.canonical_skills, normalize_embeddings=True)

    def suggest_canonical_skills(
        self,
        unmatched_phrases: List[str],
        top_k: int = 1,
        min_similarity: float = 0.55
    ) -> List[Dict[str, Any]]:
        """
        Suggests closest canonical skills for unmatched user phrases.
        
        Args:
            unmatched_phrases: List of unrecognized token strings.
            top_k: Maximum suggestions per phrase.
            min_similarity: Minimum cosine similarity threshold.
            
        Returns:
            List of suggestion dictionaries strictly marked confirmed=False.
        """
        if not unmatched_phrases or len(self.canonical_skills) == 0:
            return []

        clean_phrases = [p.strip() for p in unmatched_phrases if p and p.strip()]
        if not clean_phrases:
            return []

        phrase_embs = self.embedder.encode(clean_phrases, normalize_embeddings=True)
        # Cosine similarity matrix: [num_phrases, num_canonical]
        sim_matrix = np.dot(phrase_embs, self.canonical_embeddings.T)

        suggestions = []
        for i, phrase in enumerate(clean_phrases):
            scores = sim_matrix[i]
            best_idx = int(np.argmax(scores))
            best_score = float(scores[best_idx])

            if best_score >= min_similarity:
                canonical = self.canonical_skills[best_idx]
                suggestions.append({
                    "phrase": phrase,
                    "suggested_canonical": canonical,
                    "similarity": round(best_score, 4),
                    "tag": "semantic_suggestion",
                    "confirmed": False,
                    "note": "Semantic suggestion only; not counted in match score until confirmed by candidate."
                })

        return suggestions
