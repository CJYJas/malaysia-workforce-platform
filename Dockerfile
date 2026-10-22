# ==============================================================================
# Dockerfile: Malaysia Tech Workforce Intelligence Platform (FastAPI CPU Pod)
# RunPod Architecture: FastAPI Pod (CPU) -> RunPod Serverless vLLM Worker (GPU)
# ==============================================================================

FROM python:3.11-slim

# Prevent Python from writing .pyc files and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000
ENV RETRIEVER=tfidf
ENV PLATFORM=runpod

WORKDIR /workspace

# Install system dependencies (curl for container healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install PyTorch CPU-only wheel first to avoid downloading 8GB CUDA drivers
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Copy requirements and install python packages
COPY requirements.txt /workspace/
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source, data, configs, and scripts
COPY config.yaml /workspace/
COPY app/ /workspace/app/
COPY data/ /workspace/data/
COPY scripts/ /workspace/scripts/

# Ensure bootstrap script has executable permissions
RUN chmod +x /workspace/scripts/bootstrap.sh

# Expose HTTP port (default 8000)
EXPOSE 8000

# Healthcheck to ensure container is responsive
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

# Start via idempotent bootstrap script
CMD ["/bin/bash", "/workspace/scripts/bootstrap.sh"]
