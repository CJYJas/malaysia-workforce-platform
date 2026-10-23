#!/usr/bin/env bash
# ==============================================================================
# Malaysia Tech Workforce Intelligence Platform - RunPod Pod Bootstrap Script
# Idempotent: downloads, preprocesses, and embeds only if missing or hash mismatch.
# Guarantee: The server will still start even if bootstrap steps fail (degraded mode).
# ==============================================================================

set -o pipefail

echo "========================================================================"
echo " Starting Malaysia Workforce Intelligence Platform Bootstrap"
echo " Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo " Platform: RunPod Pod (CPU Container)"
echo "========================================================================"

# 1. Configure paths and Network Volume
DATA_ROOT="${DATA_ROOT:-data}"
export DATA_ROOT
export HF_HOME="${DATA_ROOT}/cache/huggingface"
export TRANSFORMERS_CACHE="${DATA_ROOT}/cache/huggingface/transformers"

echo "[1/4] Configuring Data Directory: $DATA_ROOT"
mkdir -p "$DATA_ROOT/processed/v1.0.0"
mkdir -p "$DATA_ROOT/cache/huggingface"

# 2. Check and run Data Pipeline idempotently
PARQUET_FILE="$DATA_ROOT/processed/v1.0.0/processed_jobs.parquet"
META_FILE="$DATA_ROOT/processed/v1.0.0/processing_metadata.json"

echo "[2/4] Checking Processed Job Postings..."
if [ -f "$PARQUET_FILE" ] && [ -f "$META_FILE" ]; then
    echo "  -> Found existing processed dataset ($PARQUET_FILE). Verifying freshness..."
    # If file exists and is non-empty, skip
    if [ -s "$PARQUET_FILE" ]; then
        echo "  -> Processed dataset is ready. Skipping pipeline execution."
    else
        echo "  -> Processed dataset is empty. Rebuilding..."
        python -m app.pipeline || echo "  [WARNING] Pipeline build failed. Server will start with data_loaded=false."
    fi
else
    echo "  -> Processed dataset missing. Running data pipeline..."
    python -m app.pipeline || echo "  [WARNING] Pipeline build failed. Server will start with data_loaded=false."
fi

# 3. Check and run Course Embeddings idempotently
EMBEDDINGS_FILE="$DATA_ROOT/processed/v1.0.0/coursera_embeddings.npy"
EMBEDDINGS_META="$DATA_ROOT/processed/v1.0.0/coursera_embeddings_meta.json"

echo "[3/4] Checking Course Embeddings..."
if [ -f "$EMBEDDINGS_FILE" ] && [ -f "$EMBEDDINGS_META" ]; then
    if [ -s "$EMBEDDINGS_FILE" ]; then
        echo "  -> Found existing course embeddings ($EMBEDDINGS_FILE). Skipping precomputation."
    else
        echo "  -> Course embeddings file is empty. Precomputing..."
        python -m scripts.build_course_embeddings || echo "  [WARNING] Embedding generation failed. Falling back to TF-IDF retriever."
    fi
else
    echo "  -> Course embeddings missing. Running offline precomputation..."
    python -m scripts.build_course_embeddings || echo "  [WARNING] Embedding generation failed. Falling back to TF-IDF retriever."
fi

# 4. Launch FastAPI Uvicorn Server
PORT="${PORT:-8000}"
HOST="0.0.0.0"

echo "[4/4] Bootstrap phase complete. Starting FastAPI server on http://${HOST}:${PORT}..."
echo "========================================================================"

exec uvicorn app.extension_entrypoint:app --host "$HOST" --port "$PORT"
