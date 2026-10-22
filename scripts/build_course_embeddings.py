"""
Offline precomputation script for Coursera course embeddings.
Generates:
- data/processed/v1.0.0/coursera_embeddings.npy
- data/processed/v1.0.0/coursera_embeddings_meta.json
"""

import os
import sys
import json
import hashlib
import time
import logging

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
import pandas as pd

from app.config import Config, load_config
from app.data_loader import load_coursera_data
from app.embeddings import DenseEmbedder
from app.course_recommender import TfidfCourseRetriever

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("build_course_embeddings")


def compute_file_hash(filepath: str) -> str:
    """Computes SHA-256 hex digest of a file."""
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def main():
    config = load_config()
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    output_dir = os.path.join(base_dir, "data", "processed", "v1.0.0")
    os.makedirs(output_dir, exist_ok=True)

    coursera_csv_path = config.raw_coursera_path
    if not os.path.exists(coursera_csv_path):
        coursera_csv_path = os.path.join(base_dir, "data", "CourseraDataset-Clean.csv")

    logger.info("Loading Coursera dataset from: %s", coursera_csv_path)
    df_coursera = load_coursera_data(config=config)
    logger.info("Loaded %d course records.", len(df_coursera))

    csv_hash = compute_file_hash(coursera_csv_path) if os.path.exists(coursera_csv_path) else "unknown"

    # Use TfidfCourseRetriever to generate identical search_text representations
    retriever = TfidfCourseRetriever(df_coursera=df_coursera, config=config)
    search_texts = [r["search_text"] for r in retriever.records]

    embedder = DenseEmbedder()
    logger.info("Encoding %d courses with DenseEmbedder...", len(search_texts))
    t0 = time.time()
    embeddings = embedder.encode(search_texts, normalize_embeddings=True)
    elapsed = time.time() - t0
    logger.info("Encoded in %.2f seconds. Embeddings shape: %s", elapsed, embeddings.shape)

    npy_path = os.path.join(output_dir, "coursera_embeddings.npy")
    np.save(npy_path, embeddings)
    logger.info("Saved embeddings to: %s", npy_path)

    meta_path = os.path.join(output_dir, "coursera_embeddings_meta.json")
    meta = {
        "dataset": "CourseraDataset-Clean.csv",
        "dataset_sha256": csv_hash,
        "records_count": len(retriever.records),
        "embedding_dimensions": embeddings.shape[1],
        "model_name": embedder.model_name,
        "backend": embedder.backend,
        "is_sentence_transformers": embedder.model is not None,
        "created_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "generation_time_seconds": round(elapsed, 2)
    }

    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    logger.info("Saved embedding metadata to: %s", meta_path)
    print("SUCCESS: Course embeddings generated successfully.")


if __name__ == "__main__":
    main()
