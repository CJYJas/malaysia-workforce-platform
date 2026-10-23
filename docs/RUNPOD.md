# RunPod Production Deployment Guide & Architecture Specification
## Malaysia Tech Workforce Intelligence Platform

**Document Version:** 1.0.0  
**Target Cloud:** [RunPod.io](https://runpod.io)  
**FastAPI Pod:** CPU-Only Container (Port 8000)  
**LLM Inference:** RunPod Serverless vLLM Worker (GPU, `Qwen2.5-7B-Instruct`)  
**Shared Persistent Storage:** RunPod Network Volume (`/workspace/data`)  

---

## 1. System Architecture
<img width="1828" height="1652" alt="mermaid-diagram" src="https://github.com/user-attachments/assets/20f5d91a-5f82-43f5-93f8-07d44b2657a0" />

> [!IMPORTANT]
> **Strict CPU/GPU Separation:**  
> The FastAPI application container is **100% CPU-only**, requiring only ~185 MB RAM. A GPU is provisioned **only** on the RunPod Serverless vLLM worker, scaling to zero when no inference requests are active to minimize cloud expenses.

---

## 2. Verified RunPod Endpoint URL Formats

Per official RunPod documentation ([docs.runpod.io/serverless/endpoints/openai-compatibility](https://docs.runpod.io/serverless/endpoints/openai-compatibility)), RunPod serverless endpoints natively support the OpenAI chat completions schema.

* **Base URL Format:**
  ```text
  https://api.runpod.ai/v2/{RUNPOD_ENDPOINT_ID}/openai/v1
  ```
* **Chat Completions Endpoint:**
  ```text
  https://api.runpod.ai/v2/{RUNPOD_ENDPOINT_ID}/openai/v1/chat/completions
  ```
* **Authentication Header:**
  ```text
  Authorization: Bearer {RUNPOD_API_KEY}
  ```
* **Citations & References:**
  * Official RunPod OpenAI Compatibility: https://docs.runpod.io/serverless/endpoints/openai-compatibility
  * RunPod Serverless API Overview: https://api.runpod.ai/v2/

---

## 3. Step-by-Step Deployment Instructions

### Step 1: Create a RunPod Network Volume
1. In the [RunPod Console](https://runpod.io/console/storage), navigate to **Storage** $\to$ **Network Volumes**.
2. Click **Add Network Volume**:
   * **Name:** `workforce-data`
   * **Data Center:** Choose your preferred region (e.g. `US-CA-1` or `EU-RO-1`).
   * **Size:** 20 GB (sufficient for raw CSVs, parquet partitions, embeddings, and caches).
3. Record the volume ID.

---

### Step 2: Deploy the vLLM Serverless Worker (GPU)
1. In the RunPod Console, navigate to **Serverless** $\to$ **Endpoints**.
2. Click **New Endpoint**:
   * **Endpoint Name:** `vllm-qwen2-5-7b`
   * **Template:** Select the official **RunPod vLLM** template (`runpod/worker-vllm:latest`).
   * **Model Name / Repository:** `Qwen/Qwen2.5-7B-Instruct`
   * **GPU Target:** NVIDIA RTX 3090, RTX 4090, or A4000 (24 GB VRAM).
   * **Max Workers:** 2
   * **Min Workers (Scale to Zero):** `0` (ensures zero idle cost).
   * **Idle Timeout:** 60 seconds.
3. Once deployed, copy your **Endpoint ID** (e.g. `abc123xyz456`).

---

### Step 3: Deploy the FastAPI CPU Pod
1. In the RunPod Console, navigate to **Pods** $\to$ **Deploy**.
2. Select **CPU Instances** (e.g., 2 vCPU, 4–8 GB RAM).
3. Configure the container:
   * **Container Image:** Built from this repository's [Dockerfile](../Dockerfile) (e.g. `your-dockerhub/malaysia-workforce:latest`).
   * **Expose HTTP Ports:** `8000`
   * **Volume Mount Path:** `/workspace/data` (attach the `workforce-data` network volume created in Step 1).
4. Set **Environment Variables** in Pod Settings:
   ```env
   DATA_ROOT=/workspace/data
   HF_HOME=/workspace/data/cache/huggingface
   PORT=8000
   RUNPOD_API_KEY=rpa_your_live_runpod_key_here
   RUNPOD_ENDPOINT_ID=abc123xyz456
   LLM_MODEL_NAME=Qwen/Qwen2.5-7B-Instruct
   CORS_ORIGINS=["https://replit.com","https://*.replit.dev"]
   RETRIEVER=tfidf
   ```
5. Click **Deploy Pod**. The container will run [scripts/bootstrap.sh](../scripts/bootstrap.sh) automatically to initialize datasets and start Uvicorn.

---

## 4. cURL Smoke Tests

Verify each tier directly from your terminal or pod shell:

### 4.1 Health Check (Verifying CPU, Platform, and Retriever)
```bash
curl -s http://localhost:8000/health | jq
```
**Expected Response:**
```json
{
  "status": "healthy",
  "service": "malaysia-workforce-intelligence",
  "version": "1.0.0",
  "data_loaded": true,
  "total_postings": 63852,
  "retriever_active": "tfidf",
  "embeddings_loaded": true,
  "llm_enabled": true,
  "llm_reachable": true,
  "device": "cpu",
  "platform": "runpod"
}
```

### 4.2 Test Direct vLLM Connectivity from Pod
```bash
curl -X POST "https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/openai/v1/chat/completions" \
  -H "Authorization: Bearer ${RUNPOD_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen2.5-7B-Instruct",
    "messages": [{"role": "user", "content": "Respond with the single word: OK"}],
    "temperature": 0.0,
    "max_tokens": 10
  }' | jq
```

### 4.3 Profile Parsing with PII Redaction & Verification Gate
```bash
curl -X POST "http://localhost:8000/profile/parse" \
  -H "Content-Type: application/json" \
  -d '{
    "raw_text": "Senior Data Engineer with 4 years building pipelines in Python, SQL, and Docker. Contact me at john@example.com."
  }' | jq
```

### 4.4 Role Match with Explainable Narration
```bash
curl -X POST "http://localhost:8000/roles/match" \
  -H "Content-Type: application/json" \
  -d '{
    "skills": ["Python", "SQL", "Docker"],
    "top_k": 3,
    "explain": "llm"
  }' | jq
```

### 4.5 Skill Gap Analysis from PDF Resume
```bash
curl -X POST "http://localhost:8000/skills/gap-resume" \
  -F "file=@sample_resume.pdf" \
  -F "target_role=Data Engineer" | jq
```

---

## 5. Pre-Demo Checklist

Before presenting or judging:
1. [ ] **Pre-warm the Serverless Endpoint**: Run a 1-token test prompt 2 minutes before the demo. This ensures the GPU worker is warm and avoids a ~30–45s cold-start provisioning delay during live evaluation.
2. [ ] **Verify Replit CORS Origin**: Confirm `CORS_ORIGINS` includes your live Replit application URL (`https://<repl-id>.<user>.repl.co` or `https://<hash>.replit.dev`).
3. [ ] **Check `/health` Status**: Ensure `data_loaded: true`, `embeddings_loaded: true`, and `device: "cpu"`.
4. [ ] **Verify Disk Space on Network Volume**: Run `df -h /workspace/data` to ensure at least 2 GB of free space remains for cache files.

---

## 6. Cost Controls & Teardown

* **Scale to Zero**: The vLLM worker is configured with `Min Workers: 0` and `Idle Timeout: 60s`. When no requests arrive for 60 seconds, GPU billing stops immediately.
* **Stopping the CPU Pod**: When not active, click **Stop** on the CPU Pod in the RunPod console. The Network Volume preserves all parquet datasets and embedding files for fast re-launch.
