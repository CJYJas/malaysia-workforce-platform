"""
LLM Client Protocol and Implementations for Malaysia Tech Workforce Intelligence Platform.
Supports:
- LLMClient protocol.
- RunPodLLMClient: httpx client for RunPod Serverless vLLM endpoint with Bearer auth,
  capped exponential backoff retries, cold-start handling, temperature 0.0, zero prompt/key logging.
  Official RunPod OpenAI-compatible URL formats:
  - Base URL: https://api.runpod.ai/v2/{ENDPOINT_ID}/openai/v1
  - Chat completions: https://api.runpod.ai/v2/{ENDPOINT_ID}/openai/v1/chat/completions
  Citations:
  - https://docs.runpod.io/serverless/endpoints/openai-compatibility
  - https://api.runpod.ai/v2/{ENDPOINT_ID}/openai/v1
- MockLLMClient for deterministic test automation and offline CPU environments.
- OpenWeightLLMClient supporting generic OpenAI-compatible vLLM endpoints.
"""

import os
import json
import time
import logging
from typing import Optional, Protocol, Dict, Any, List
import httpx

logger = logging.getLogger(__name__)


class RunPodClientError(Exception):
    """Base exception for RunPod LLM client errors."""
    pass


class RunPodAuthError(RunPodClientError):
    """Raised on 401 Unauthorized (invalid API key)."""
    pass


class RunPodRateLimitError(RunPodClientError):
    """Raised on 429 Rate Limit after retries exhausted."""
    pass


class RunPodTimeoutError(RunPodClientError):
    """Raised on cold start / gateway timeout after retries exhausted."""
    pass


class RunPodBadResponseError(RunPodClientError):
    """Raised when response is not valid JSON or missing expected schema."""
    pass


class LLMClient(Protocol):
    """Protocol for LLM clients."""
    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 300,
        temperature: float = 0.0
    ) -> str:
        ...

    def is_reachable(self) -> bool:
        ...


class RunPodLLMClient:
    """
    Production-grade client for RunPod Serverless vLLM endpoints.
    
    Architecture:
    FastAPI Pod (CPU) -> RunPod Serverless vLLM Worker (GPU, e.g. Qwen2.5-7B-Instruct).
    
    Guarantees:
    - Bearer authentication from RUNPOD_API_KEY.
    - Official RunPod OpenAI-compatible URL format:
      https://api.runpod.ai/v2/{ENDPOINT_ID}/openai/v1/chat/completions
    - Capped retries with exponential backoff on cold-starts (500/502/503/504, 429, timeouts).
    - Long cold-start timeout (default 60s).
    - Strict temperature 0.0 for deterministic factual generation.
    - Security & Privacy: Never logs prompt text or API keys.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        endpoint_id: Optional[str] = None,
        endpoint_url: Optional[str] = None,
        model_name: str = "Qwen/Qwen2.5-7B-Instruct",
        timeout: Optional[float] = None,
        max_retries: int = 3,
        retry_backoff: float = 1.0,
        http_client: Optional[httpx.Client] = None
    ):
        self.api_key = api_key or os.environ.get("RUNPOD_API_KEY", "")
        self.endpoint_id = endpoint_id or os.environ.get("RUNPOD_ENDPOINT_ID", "")
        self.model_name = model_name or os.environ.get("LLM_MODEL_NAME", "Qwen/Qwen2.5-7B-Instruct")
        self.max_retries = max(1, min(max_retries, 5))
        self.retry_backoff = retry_backoff
        
        # Cold-start timeout: configurable via env var, default 60s
        env_timeout = os.environ.get("RUNPOD_TIMEOUT_SECONDS")
        if timeout is not None:
            self.timeout = float(timeout)
        elif env_timeout:
            self.timeout = float(env_timeout)
        else:
            self.timeout = 60.0

        # Construct official RunPod endpoint URL
        # Docs: https://docs.runpod.io/serverless/endpoints/openai-compatibility
        if endpoint_url:
            self.chat_url = endpoint_url
            self.base_url = endpoint_url.rsplit("/chat/completions", 1)[0]
        elif self.endpoint_id:
            self.base_url = f"https://api.runpod.ai/v2/{self.endpoint_id}/openai/v1"
            self.chat_url = f"{self.base_url}/chat/completions"
        else:
            # Fallback to generic local or direct URL if provided
            raw_base = os.environ.get("LLM_ENDPOINT_URL", "http://localhost:8000/v1")
            self.base_url = raw_base.rstrip("/")
            self.chat_url = f"{self.base_url}/chat/completions"

        self._custom_client = http_client
        self._headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "User-Agent": "MalaysiaWorkforcePlatform/1.0"
        }

        # Cached reachability status
        self._last_reachability_check: float = 0.0
        self._is_reachable_cache: bool = False
        self._reachability_ttl_seconds: float = 60.0

    def _get_client(self) -> httpx.Client:
        if self._custom_client is not None:
            return self._custom_client
        return httpx.Client(timeout=self.timeout)

    def is_reachable(self, force_refresh: bool = False) -> bool:
        """
        Fast, non-blocking reachability check with 60-second TTL cache.
        Pings endpoint /models with 3s timeout to verify worker readiness.
        """
        now = time.time()
        if not force_refresh and (now - self._last_reachability_check < self._reachability_ttl_seconds):
            return self._is_reachable_cache

        if not self.api_key or not self.endpoint_id:
            self._is_reachable_cache = False
            self._last_reachability_check = now
            return False

        models_url = f"{self.base_url}/models"
        client = self._get_client()
        try:
            # Short timeout so health endpoint never blocks
            res = client.get(models_url, headers=self._headers, timeout=3.0)
            self._is_reachable_cache = res.status_code in (200, 204)
        except Exception:
            self._is_reachable_cache = False

        self._last_reachability_check = now
        return self._is_reachable_cache

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 300,
        temperature: float = 0.0
    ) -> str:
        """
        Sends generation request to RunPod vLLM serverless worker.
        Temperature is locked to 0.0 for factual fidelity.
        Never logs prompt text or authorization keys.
        """
        if not self.api_key:
            raise RunPodAuthError("RUNPOD_API_KEY environment variable is not configured.")

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        # Mandatory constraint: temperature = 0.0 for deterministic factual fidelity
        payload = {
            "model": self.model_name,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": 0.0
        }

        client = self._get_client()
        last_exception = None

        for attempt in range(1, self.max_retries + 1):
            t0 = time.perf_counter()
            try:
                # Privacy rule: never log prompt or payload
                logger.info(
                    "Sending RunPod vLLM request: attempt=%d/%d, model=%s, max_tokens=%d",
                    attempt, self.max_retries, self.model_name, max_tokens
                )

                response = client.post(
                    self.chat_url,
                    headers=self._headers,
                    json=payload,
                    timeout=self.timeout
                )
                elapsed_ms = (time.perf_counter() - t0) * 1000.0

                # 401 Unauthorized: Do not retry, raise immediately
                if response.status_code == 401:
                    logger.error("RunPod authentication failed: HTTP 401 Unauthorized.")
                    raise RunPodAuthError("Authentication failed: invalid or missing RUNPOD_API_KEY.")

                # 429 Rate Limit: Retry with exponential backoff
                if response.status_code == 429:
                    logger.warning(
                        "RunPod rate limit encountered (HTTP 429) on attempt %d/%d (latency=%.1fms).",
                        attempt, self.max_retries, elapsed_ms
                    )
                    if attempt < self.max_retries:
                        sleep_time = self.retry_backoff * (2 ** (attempt - 1))
                        time.sleep(sleep_time)
                        continue
                    raise RunPodRateLimitError("RunPod rate limit exceeded (HTTP 429) after maximum retries.")

                # 5xx Server Error: Worker cold-start, queueing, or provisioning
                if response.status_code in (500, 502, 503, 504):
                    logger.warning(
                        "RunPod worker provisioning / cold-start error (HTTP %d) on attempt %d/%d.",
                        response.status_code, attempt, self.max_retries
                    )
                    if attempt < self.max_retries:
                        sleep_time = self.retry_backoff * (2 ** (attempt - 1))
                        time.sleep(sleep_time)
                        continue
                    response.raise_for_status()

                response.raise_for_status()

                # Parse JSON output
                try:
                    data = response.json()
                except Exception as json_err:
                    raise RunPodBadResponseError(f"RunPod endpoint returned non-JSON body: {json_err}")

                try:
                    content = data["choices"][0]["message"]["content"]
                    usage = data.get("usage", {})
                    tokens = usage.get("total_tokens", len(content.split()))
                    logger.info(
                        "RunPod vLLM generation succeeded: status=200, latency_ms=%.2f, total_tokens=%d",
                        elapsed_ms, tokens
                    )
                    return content
                except (KeyError, IndexError, TypeError) as schema_err:
                    raise RunPodBadResponseError(f"Unexpected JSON schema from RunPod vLLM: {schema_err}")

            except httpx.TimeoutException as timeout_err:
                elapsed_ms = (time.perf_counter() - t0) * 1000.0
                logger.warning(
                    "RunPod request timed out (cold-start delay) on attempt %d/%d after %.1fms (limit=%.1fs)",
                    attempt, self.max_retries, elapsed_ms, self.timeout
                )
                last_exception = timeout_err
                if attempt < self.max_retries:
                    sleep_time = self.retry_backoff * (2 ** (attempt - 1))
                    time.sleep(sleep_time)
                    continue
                raise RunPodTimeoutError(
                    f"RunPod serverless request timed out after {self.max_retries} attempts ({self.timeout}s timeout per attempt)."
                )
            except (RunPodAuthError, RunPodRateLimitError, RunPodBadResponseError):
                raise
            except Exception as e:
                last_exception = e
                logger.warning("RunPod invocation failed on attempt %d/%d (%s).", attempt, self.max_retries, type(e).__name__)
                if attempt < self.max_retries:
                    sleep_time = self.retry_backoff * (2 ** (attempt - 1))
                    time.sleep(sleep_time)
                    continue
                raise RunPodClientError(f"RunPod request failed after {self.max_retries} attempts: {e}")

        if last_exception:
            raise last_exception
        raise RunPodClientError("RunPod request failed with unknown error.")


class MockLLMClient:
    """
    High-fidelity mock LLM client for offline test automation.
    Simulates structured JSON generation and error conditions.
    """

    def __init__(self, mode: str = "normal"):
        self.mode = mode  # 'normal', 'bad_json', 'timeout', 'hallucinate', 'injection'

    def is_reachable(self) -> bool:
        return self.mode != "timeout"

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 300,
        temperature: float = 0.0
    ) -> str:
        """Simulates LLM generation based on mode and prompt content."""
        if self.mode == "timeout":
            raise TimeoutError("Simulated LLM call timed out after 5.0s.")

        if self.mode == "bad_json":
            return "This is not a JSON response! Just random text."

        # Detect prompt injection attempts
        if "ignore previous instructions" in prompt.lower() or "disregard system" in prompt.lower():
            if self.mode == "injection":
                return json.dumps({
                    "skills": ["HACKED_SYSTEM"],
                    "experience_years": 100.0,
                    "education": "Doctorate"
                })

        # Normal extraction: extract canonical skills mentioned in prompt
        known_skills = [
            "Python", "SQL", "Docker", "Kubernetes", "AWS", "Azure",
            "Machine Learning", "Deep Learning", "React", "JavaScript",
            "ETL", "Data Warehouse", "Apache Spark", "Git", "Linux"
        ]

        extracted = []
        prompt_lower = prompt.lower()
        for skill in known_skills:
            if skill.lower() in prompt_lower:
                extracted.append(skill)

        # Mode to inject hallucinated skill
        if self.mode == "hallucinate":
            extracted.append("Quantum Teleportation 9000")

        import re
        exp_match = re.search(r"(\d{1,2}(?:\.\d)?)\s*(?:years?|yrs?)", prompt, re.IGNORECASE)
        exp_years = float(exp_match.group(1)) if exp_match else None

        education = None
        if "phd" in prompt_lower or "doctorate" in prompt_lower:
            education = "Doctorate"
        elif "master" in prompt_lower:
            education = "Master's Degree"
        elif "bachelor" in prompt_lower or "degree" in prompt_lower:
            education = "Bachelor's Degree"
        elif "diploma" in prompt_lower:
            education = "Diploma"

        response_dict = {
            "skills": extracted,
            "experience_years": exp_years,
            "education": education
        }
        return json.dumps(response_dict)


class OpenWeightLLMClient:
    """
    Client for generic OpenAI-compatible vLLM endpoints.
    """

    def __init__(
        self,
        endpoint_url: Optional[str] = None,
        api_key: Optional[str] = None,
        model_name: str = "Qwen/Qwen2.5-7B-Instruct"
    ):
        self.endpoint_url = endpoint_url or os.environ.get("LLM_ENDPOINT_URL", "http://localhost:8000/v1")
        self.api_key = api_key or os.environ.get("LLM_API_KEY", "EMPTY")
        self.model_name = model_name

    def is_reachable(self) -> bool:
        try:
            with httpx.Client(timeout=2.0) as client:
                res = client.get(f"{self.endpoint_url}/models", headers={"Authorization": f"Bearer {self.api_key}"})
                return res.status_code == 200
        except Exception:
            return False

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 300,
        temperature: float = 0.0
    ) -> str:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model_name,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": 0.0
        }

        with httpx.Client(timeout=10.0) as client:
            res = client.post(f"{self.endpoint_url}/chat/completions", headers=headers, json=payload)
            res.raise_for_status()
            data = res.json()
            return data["choices"][0]["message"]["content"]


def get_llm_client() -> LLMClient:
    """
    Factory creating the configured LLMClient.
    Priority:
    1. If RUNPOD_API_KEY and (RUNPOD_ENDPOINT_ID or RUNPOD_ENDPOINT_URL) are set -> RunPodLLMClient.
    2. Else if LLM_ENABLED=true and LLM_ENDPOINT_URL is set -> OpenWeightLLMClient.
    3. Default -> MockLLMClient for offline execution.
    """
    runpod_key = os.environ.get("RUNPOD_API_KEY")
    runpod_endpoint_id = os.environ.get("RUNPOD_ENDPOINT_ID")
    runpod_endpoint_url = os.environ.get("RUNPOD_ENDPOINT_URL")

    if runpod_key and (runpod_endpoint_id or runpod_endpoint_url):
        logger.info("Initializing RunPodLLMClient with RunPod Serverless vLLM endpoint.")
        return RunPodLLMClient(
            api_key=runpod_key,
            endpoint_id=runpod_endpoint_id,
            endpoint_url=runpod_endpoint_url
        )

    llm_enabled = os.environ.get("LLM_ENABLED", "false").lower() in ("true", "1", "yes")
    endpoint = os.environ.get("LLM_ENDPOINT_URL")

    if llm_enabled and endpoint:
        logger.info("Initializing OpenWeightLLMClient pointing to %s", endpoint)
        return OpenWeightLLMClient(endpoint_url=endpoint)

    return MockLLMClient()
