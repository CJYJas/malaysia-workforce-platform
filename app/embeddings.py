"""
Dense and Hybrid Course Retrieval and Semantic Skill Suggestions for Malaysia Tech Workforce Platform.
Implements:
- DenseEmbedder: Supports SentenceTransformers (CPU/GPU) with seamless ONNX Runtime fallback
  (avoiding Windows PyTorch DLL issues), plus deterministic projection fallback.
- EmbeddingRetriever: Dense semantic retrieval conforming to CourseRetriever protocol,
  with content-hashed disk caching (.npy / .json) and minimum relevance threshold.
- HybridRetriever: Reciprocal Rank Fusion (RRF) between lexical TF-IDF and dense semantic retrieval.
- SemanticSkillSuggester: Computes semantic suggestions for uncataloged candidate phrases (confirmed=False).
"""

import os
import re
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

# Check sentence_transformers availability
try:
    from sentence_transformers import SentenceTransformer
    HAVE_SENTENCE_TRANSFORMERS = True
except (ImportError, OSError, Exception) as e:
    logger.debug("SentenceTransformer unavailable (%s). Will attempt ONNX Runtime.", e)
    HAVE_SENTENCE_TRANSFORMERS = False

# Check ONNX Runtime and Tokenizers availability
try:
    import onnxruntime as ort
    import tokenizers
    from huggingface_hub import hf_hub_download
    HAVE_ONNX = True
except (ImportError, OSError, Exception) as e:
    logger.debug("ONNX Runtime / Tokenizers unavailable (%s). Will use projection fallback if needed.", e)
    HAVE_ONNX = False


class DenseEmbedder:
    """
    Encapsulates dense embedding generation.
    Supports:
    1. SentenceTransformers (CPU/GPU)
    2. ONNX Runtime + tokenizers with sentence-transformers/all-MiniLM-L6-v2 (CPU-optimized)
    3. Deterministic sklearn Hashing projection fallback.
    """

    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
        self.model_name = model_name
        self.model = None
        self.onnx_session = None
        self.tokenizer = None
        self.backend = "unknown"

        # 1. Try SentenceTransformers
        if HAVE_SENTENCE_TRANSFORMERS:
            try:
                logger.info("Initializing SentenceTransformer('%s')...", model_name)
                self.model = SentenceTransformer(model_name)
                self.backend = "sentence_transformers"
                logger.info("DenseEmbedder using SentenceTransformers backend.")
                return
            except Exception as e:
                logger.warning("SentenceTransformer failed to initialize (%s). Attempting ONNX.", e)
                self.model = None

        # 2. Try ONNX Runtime + Tokenizers
        if HAVE_ONNX:
            try:
                logger.info("Initializing ONNX Runtime backend for '%s'...", model_name)
                tok_path = hf_hub_download(model_name, "tokenizer.json")
                model_path = hf_hub_download(model_name, "onnx/model.onnx")

                # Configure ONNX session for CPU execution
                sess_options = ort.SessionOptions()
                sess_options.intra_op_num_threads = min(4, os.cpu_count() or 2)
                sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

                self.tokenizer = tokenizers.Tokenizer.from_file(tok_path)
                # Enable truncation to max 256 tokens for speed and consistency
                self.tokenizer.enable_truncation(max_length=256)
                self.onnx_session = ort.InferenceSession(model_path, sess_options=sess_options, providers=["CPUExecutionProvider"])
                self.backend = "onnx"
                logger.info("DenseEmbedder using ONNX Runtime backend (CPU-optimized).")
                return
            except Exception as e:
                logger.warning("ONNX Runtime backend failed (%s). Falling back to projection.", e)
                self.onnx_session = None
                self.tokenizer = None

        # 3. Deterministic Hashing Projection Fallback
        self.backend = "projection_fallback"
        logger.info("DenseEmbedder using deterministic projection fallback.")

    def _encode_onnx(self, texts: List[str], batch_size: int = 64) -> np.ndarray:
        """Encodes texts using ONNX Runtime and mean pooling."""
        if not texts or self.tokenizer is None or self.onnx_session is None:
            return np.zeros((len(texts), 384), dtype=np.float32)

        all_embeddings = []

        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i:i + batch_size]
            encodings = [self.tokenizer.encode(str(t) if t else "") for t in batch_texts]

            max_len = max(len(e.ids) for e in encodings)
            if max_len == 0:
                max_len = 1

            # Pad batch
            input_ids = np.zeros((len(batch_texts), max_len), dtype=np.int64)
            attention_mask = np.zeros((len(batch_texts), max_len), dtype=np.int64)
            token_type_ids = np.zeros((len(batch_texts), max_len), dtype=np.int64)

            for row_idx, enc in enumerate(encodings):
                ids = enc.ids
                mask = enc.attention_mask
                types = enc.type_ids if hasattr(enc, "type_ids") else [0] * len(ids)
                n = len(ids)
                if n > 0:
                    input_ids[row_idx, :n] = ids
                    attention_mask[row_idx, :n] = mask
                    token_type_ids[row_idx, :n] = types

            # Run inference
            inputs = {
                "input_ids": input_ids,
                "attention_mask": attention_mask,
                "token_type_ids": token_type_ids
            }
            # Handle model inputs if token_type_ids is not required
            input_names = [inp.name for inp in self.onnx_session.get_inputs()]
            feed_dict = {k: inputs[k] for k in input_names if k in inputs}

            outputs = self.onnx_session.run(None, feed_dict)
            token_embeddings = outputs[0]  # Shape: [batch, seq_len, 384]

            # Mean pooling with attention mask
            mask_expanded = np.expand_dims(attention_mask, -1)
            sum_embeddings = np.sum(token_embeddings * mask_expanded, axis=1)
            sum_mask = np.clip(mask_expanded.sum(axis=1), a_min=1e-9, a_max=None)
            mean_pooled = sum_embeddings / sum_mask

            # L2 normalize
            norms = np.linalg.norm(mean_pooled, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            normalized = mean_pooled / norms

            all_embeddings.append(normalized.astype(np.float32))

        return np.vstack(all_embeddings)

    def encode(self, texts: List[str], normalize_embeddings: bool = True) -> np.ndarray:
        """Encodes a list of strings into normalized dense embedding vectors."""
        if not texts:
            return np.zeros((0, 384), dtype=np.float32)

        # Sanitize texts
        clean_texts = [str(t).strip() if t is not None else "" for t in texts]

        # 1. SentenceTransformers
        if self.backend == "sentence_transformers" and self.model is not None:
            embs = self.model.encode(clean_texts, normalize_embeddings=normalize_embeddings, show_progress_bar=False)
            return np.asarray(embs, dtype=np.float32)

        # 2. ONNX Runtime
        if self.backend == "onnx" and self.onnx_session is not None:
            return self._encode_onnx(clean_texts)

        # 3. Deterministic Hashing Projection Fallback
        from sklearn.feature_extraction.text import HashingVectorizer
        vectorizer = HashingVectorizer(n_features=384, alternate_sign=False, norm="l2")
        matrix = vectorizer.fit_transform(clean_texts).toarray()
        return matrix.astype(np.float32)


def compute_file_sha256(filepath: str) -> str:
    """Computes SHA-256 hash of a file for cache invalidation."""
    if not os.path.exists(filepath):
        return "missing"
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


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
        fallback_retriever: Optional[TfidfCourseRetriever] = None,
        min_similarity: Optional[float] = None,
        auto_rebuild: bool = False
    ):
        self.config = config or load_config()
        self.df = df_coursera if df_coursera is not None else load_coursera_data(config=self.config)
        self.fallback = fallback_retriever or TfidfCourseRetriever(df_coursera=self.df, config=self.config)
        self.embedder = DenseEmbedder(model_name=self.config.embedding_model_name)
        self.min_similarity = (
            min_similarity if min_similarity is not None else self.config.min_semantic_similarity
        )
        self.auto_rebuild = auto_rebuild

        # Paths
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.embeddings_path = embeddings_path or os.path.join(base_dir, "data", "processed", "v1.0.0", "coursera_embeddings.npy")
        self.meta_path = meta_path or os.path.join(base_dir, "data", "processed", "v1.0.0", "coursera_embeddings_meta.json")

        self.embeddings: Optional[np.ndarray] = None
        self.records: List[Dict[str, Any]] = self.fallback.records
        self.is_ready = False
        self._load_or_build_embeddings()

    def _build_search_texts(self) -> List[str]:
        """Constructs rich semantic search text for each course record."""
        texts = []
        for idx, row in self.df.iterrows():
            title = str(row.get("Course Title", "")).strip()
            skills_raw = str(row.get("Skill gain", "")).strip()
            what_learn = str(row.get("What you will learn", "")).strip()
            modules_raw = str(row.get("Modules", "")).strip()

            parts = []
            if title and title.lower() != "nan":
                parts.append(title)
            if skills_raw and skills_raw.lower() not in ("not specified", "nan", ""):
                parts.append(f"Skills: {skills_raw}")
            if what_learn and what_learn.lower() not in ("not specified", "nan", ""):
                parts.append(f"Summary: {what_learn[:250]}")
            if modules_raw and modules_raw.lower() not in ("not specified", "nan", ""):
                parts.append(f"Curriculum: {modules_raw[:250]}")

            texts.append(" | ".join(parts) if parts else title)
        return texts

    def _load_or_build_embeddings(self) -> None:
        """Loads precomputed embeddings from .npy if valid, otherwise attempts to build if auto_rebuild=True."""
        coursera_csv_path = self.config.raw_coursera_path
        current_csv_hash = compute_file_sha256(coursera_csv_path)

        if os.path.exists(self.embeddings_path) and os.path.exists(self.meta_path):
            try:
                with open(self.meta_path, "r", encoding="utf-8") as f:
                    meta = json.load(f)

                saved_hash = meta.get("dataset_sha256")
                saved_count = meta.get("records_count")
                saved_backend = meta.get("backend", "")

                # Cache is valid if records match, hash matches, and backend is valid
                if (
                    saved_count == len(self.records)
                    and saved_hash == current_csv_hash
                    and saved_backend in ("onnx", "sentence_transformers")
                ):
                    loaded_emb = np.load(self.embeddings_path)
                    if len(loaded_emb) == len(self.records) and loaded_emb.shape[1] == 384:
                        self.embeddings = loaded_emb.astype(np.float32)
                        self.is_ready = True
                        logger.info("Loaded precomputed course embeddings: %s (shape: %s)", self.embeddings_path, self.embeddings.shape)
                        return
                    else:
                        logger.warning("Embeddings dimensions mismatch: expected (%d, 384), got %s", len(self.records), getattr(loaded_emb, "shape", None))
                else:
                    logger.warning("Embeddings cache metadata mismatch or invalid backend (%s).", saved_backend)
            except Exception as e:
                logger.warning("Failed to validate cached embeddings (%s).", e)

        if not self.auto_rebuild:
            logger.info("Embeddings cache invalid or unavailable and auto_rebuild=False. Falling back to TF-IDF.")
            self.is_ready = False
            return

        # Build in-memory embeddings
        try:
            logger.info("Computing dense embeddings for %d Coursera records...", len(self.records))
            texts = self._build_search_texts()
            self.embeddings = self.embedder.encode(texts, normalize_embeddings=True)
            self.is_ready = True

            # Save cache to disk
            os.makedirs(os.path.dirname(self.embeddings_path), exist_ok=True)
            np.save(self.embeddings_path, self.embeddings)

            meta = {
                "dataset": "CourseraDataset-Clean.csv",
                "dataset_sha256": current_csv_hash,
                "records_count": len(self.records),
                "embedding_dimensions": self.embeddings.shape[1],
                "model_name": self.embedder.model_name,
                "backend": self.embedder.backend,
                "created_at_utc": time_utc_str()
            }
            with open(self.meta_path, "w", encoding="utf-8") as f:
                json.dump(meta, f, indent=2)

            logger.info("Successfully persisted course embeddings to %s.", self.embeddings_path)
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

        if not skill_gap or not isinstance(skill_gap, str) or not skill_gap.strip():
            return []

        query_clean = skill_gap.strip()
        query_emb = self.embedder.encode([query_clean], normalize_embeddings=True)

        # Cosine similarity is dot product of normalized vectors
        scores = np.dot(self.embeddings, query_emb.T).flatten()
        top_indices = np.argsort(scores)[::-1][:top_k * 4]

        results = []
        for idx in top_indices:
            score = float(scores[idx])
            if score < self.min_similarity:
                continue

            rec = self.records[idx]
            results.append({
                "source_record_id": rec["source_record_id"],
                "course_title": rec["title"],
                "course_url": rec["url"],
                "gap_addressed": query_clean,
                "why_recommended": (
                    f"Dense semantic curriculum match for your skill gap in '{query_clean}' "
                    f"(semantic similarity: {round(score, 3)})."
                ),
                "skills_gained": rec["skills_gained"],
                "difficulty_level": rec["level"],
                "rating": rec["rating"],
                "duration": rec["duration"],
                "offered_by": rec["offered_by"],
                "relevance_score": round(score * 10.0, 2),
                "retriever": "dense_embedding",
                "semantic_similarity": round(score, 4)
            })
            if len(results) >= top_k:
                break

        return results


def time_utc_str() -> str:
    """Returns current UTC ISO timestamp string."""
    import time
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


class HybridRetriever:
    """
    Hybrid Course Retriever combining Reciprocal Rank Fusion (RRF)
    between lexical TF-IDF retrieval and dense embedding retrieval.
    RRF Score(d) = sum_{method} (1 / (rrf_k + rank_method(d)))
    """

    def __init__(
        self,
        tfidf_retriever: Optional[TfidfCourseRetriever] = None,
        dense_retriever: Optional[EmbeddingRetriever] = None,
        rrf_k: Optional[int] = None,
        candidate_pool_size: Optional[int] = None,
        config: Optional[Config] = None
    ):
        self.config = config or load_config()
        self.tfidf = tfidf_retriever or TfidfCourseRetriever(config=self.config)
        self.dense = dense_retriever or EmbeddingRetriever(config=self.config, fallback_retriever=self.tfidf)
        self.rrf_k = rrf_k if rrf_k is not None else self.config.rrf_k
        self.candidate_pool_size = (
            candidate_pool_size if candidate_pool_size is not None else self.config.retrieval_candidate_pool_size
        )

    def retrieve_for_gap(self, skill_gap: str, top_k: int = 3) -> List[Dict[str, Any]]:
        """
        Combines TF-IDF and Dense retrieval results using Reciprocal Rank Fusion (RRF).
        
        Args:
            skill_gap: Missing technical skill (e.g., 'FastAPI', 'data pipeline orchestration').
            top_k: Number of ranked courses to return.
            
        Returns:
            List of course dictionaries adhering to standard protocol schema.
        """
        if not skill_gap or not isinstance(skill_gap, str) or not skill_gap.strip():
            return []

        clean_gap = skill_gap.strip()
        pool_size = max(top_k * 4, self.candidate_pool_size)

        tfidf_results = self.tfidf.retrieve_for_gap(clean_gap, top_k=pool_size)
        dense_results = self.dense.retrieve_for_gap(clean_gap, top_k=pool_size)

        # If both engines return nothing, return empty (unresolved gap)
        if not tfidf_results and not dense_results:
            return []

        rrf_scores: Dict[str, float] = {}
        course_data: Dict[str, Dict[str, Any]] = {}
        match_signals: Dict[str, str] = {}

        # 1. Score TF-IDF candidates
        for rank, item in enumerate(tfidf_results, start=1):
            url = item["course_url"]
            rrf_scores[url] = rrf_scores.get(url, 0.0) + (1.0 / (self.rrf_k + rank))
            course_data[url] = item
            match_signals[url] = "keyword"

        # 2. Score Dense candidates
        for rank, item in enumerate(dense_results, start=1):
            url = item["course_url"]
            rrf_scores[url] = rrf_scores.get(url, 0.0) + (1.0 / (self.rrf_k + rank))
            if url in match_signals:
                match_signals[url] = "both"  # Dual confirmation
            else:
                match_signals[url] = "semantic"
                course_data[url] = item

        # Sort by RRF score descending
        sorted_urls = sorted(
            rrf_scores.keys(),
            key=lambda u: (
                rrf_scores[u],
                course_data[u].get("rating") or 0.0
            ),
            reverse=True
        )

        final_results = []
        for url in sorted_urls[:top_k]:
            item = dict(course_data[url])
            score = round(rrf_scores[url] * 100.0, 2)
            item["relevance_score"] = score
            item["retriever"] = "hybrid_rrf"
            signal = match_signals.get(url, "keyword")
            item["match_signal"] = signal

            if signal == "both":
                item["why_recommended"] = (
                    f"Dual confirmation: Direct keyword curriculum match + Semantic similarity "
                    f"for '{clean_gap}' (RRF score: {score})."
                )
            elif signal == "semantic":
                sim = item.get("semantic_similarity")
                sim_str = f"similarity: {sim}, " if sim else ""
                item["why_recommended"] = (
                    f"Semantic curriculum match addressing skill gap '{clean_gap}' "
                    f"({sim_str}RRF score: {score})."
                )
            else:
                item["why_recommended"] = (
                    f"Direct keyword curriculum match addressing skill gap '{clean_gap}' "
                    f"(RRF score: {score})."
                )

            final_results.append(item)

        return final_results


def get_course_retriever(
    retriever_type: Optional[str] = None,
    config: Optional[Config] = None
) -> CourseRetriever:
    """
    Factory creating the configured CourseRetriever based on environment or argument.
    Supported: 'hybrid' (default), 'dense', 'tfidf'.
    """
    cfg = config or load_config()
    chosen_type = retriever_type or cfg.course_retriever_type

    tfidf = TfidfCourseRetriever(config=cfg)

    if not cfg.semantic_retrieval_enabled:
        logger.info("Semantic retrieval disabled in config/environment. Using TF-IDF baseline.")
        return tfidf

    if chosen_type == "dense":
        return EmbeddingRetriever(config=cfg, fallback_retriever=tfidf)
    elif chosen_type == "hybrid":
        dense = EmbeddingRetriever(config=cfg, fallback_retriever=tfidf)
        return HybridRetriever(tfidf_retriever=tfidf, dense_retriever=dense, config=cfg)
    else:
        # Explicit 'tfidf' baseline requested
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
