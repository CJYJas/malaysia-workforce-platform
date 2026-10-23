"""
Unit tests for RunPodLLMClient against mocked HTTP transport.
Zero network or GPU requirements.
Covers:
- Successful 200 response parsing.
- 401 Unauthorized handling (no wasteful retries, immediate RunPodAuthError).
- 429 Rate limiting with capped retries and backoff.
- 503 Cold-start server error with successful retry.
- TimeoutException with retry exhaustion.
- Non-JSON bad response handling.
- Security & Privacy: Never logs prompts or authorization keys.
- Reachability check caching.
"""

import logging
import pytest
import httpx

from app.llm_client import (
    RunPodLLMClient,
    RunPodAuthError,
    RunPodRateLimitError,
    RunPodTimeoutError,
    RunPodBadResponseError
)


class MockTransport(httpx.BaseTransport):
    """Configurable mock transport for httpx."""

    def __init__(self, responses):
        self.responses = list(responses)
        self.call_count = 0
        self.recorded_requests = []

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        self.call_count += 1
        self.recorded_requests.append(request)

        if not self.responses:
            return httpx.Response(200, json={"choices": [{"message": {"content": "default"}}]})

        item = self.responses.pop(0)
        if isinstance(item, Exception):
            raise item
        status_code, body = item
        if isinstance(body, dict):
            return httpx.Response(status_code, json=body, request=request)
        return httpx.Response(status_code, text=body, request=request)


def test_runpod_client_success():
    mock_data = {
        "id": "chatcmpl-123",
        "choices": [{"message": {"content": "Data Engineer has 52.8% match."}}],
        "usage": {"total_tokens": 12}
    }
    transport = MockTransport([(200, mock_data)])
    client = httpx.Client(transport=transport)

    rp = RunPodLLMClient(
        api_key="rpa_testkey",
        endpoint_id="vllm-test-123",
        http_client=client,
        retry_backoff=0.01
    )

    out = rp.generate("Test prompt")
    assert out == "Data Engineer has 52.8% match."
    assert transport.call_count == 1

    # Verify official RunPod URL construction
    req = transport.recorded_requests[0]
    assert str(req.url) == "https://api.runpod.ai/v2/vllm-test-123/openai/v1/chat/completions"
    assert req.headers["Authorization"] == "Bearer rpa_testkey"


def test_runpod_client_401_unauthorized():
    transport = MockTransport([(401, {"error": "Unauthorized API key"})])
    client = httpx.Client(transport=transport)

    rp = RunPodLLMClient(
        api_key="rpa_invalid_key",
        endpoint_id="vllm-test-123",
        http_client=client,
        max_retries=3,
        retry_backoff=0.01
    )

    with pytest.raises(RunPodAuthError) as exc_info:
        rp.generate("Test prompt")

    assert "invalid or missing RUNPOD_API_KEY" in str(exc_info.value)
    # Must fail immediately on 401 without retries
    assert transport.call_count == 1


def test_runpod_client_429_rate_limit_retries_and_raises():
    transport = MockTransport([
        (429, {"error": "Rate limit exceeded"}),
        (429, {"error": "Rate limit exceeded"}),
        (429, {"error": "Rate limit exceeded"})
    ])
    client = httpx.Client(transport=transport)

    rp = RunPodLLMClient(
        api_key="rpa_valid_key",
        endpoint_id="vllm-test-123",
        http_client=client,
        max_retries=3,
        retry_backoff=0.01
    )

    with pytest.raises(RunPodRateLimitError) as exc_info:
        rp.generate("Test prompt")

    assert "rate limit exceeded" in str(exc_info.value).lower()
    assert transport.call_count == 3


def test_runpod_client_cold_start_retry_and_success():
    # Attempt 1: 503 Worker Cold-Start Provisioning -> Attempt 2: 200 Success
    success_data = {
        "choices": [{"message": {"content": "Cold start resolved successfully."}}],
        "usage": {"total_tokens": 8}
    }
    transport = MockTransport([
        (503, "Worker provisioning"),
        (200, success_data)
    ])
    client = httpx.Client(transport=transport)

    rp = RunPodLLMClient(
        api_key="rpa_valid_key",
        endpoint_id="vllm-test-123",
        http_client=client,
        max_retries=3,
        retry_backoff=0.01
    )

    res = rp.generate("Test prompt")
    assert res == "Cold start resolved successfully."
    assert transport.call_count == 2


def test_runpod_client_timeout_exhaustion():
    transport = MockTransport([
        httpx.TimeoutException("Cold start timeout 1"),
        httpx.TimeoutException("Cold start timeout 2")
    ])
    client = httpx.Client(transport=transport)

    rp = RunPodLLMClient(
        api_key="rpa_valid_key",
        endpoint_id="vllm-test-123",
        http_client=client,
        max_retries=2,
        retry_backoff=0.01
    )

    with pytest.raises(RunPodTimeoutError) as exc_info:
        rp.generate("Test prompt")

    assert "timed out after 2 attempts" in str(exc_info.value)
    assert transport.call_count == 2


def test_runpod_client_bad_json_response():
    transport = MockTransport([
        (200, "<html><head><title>502 Bad Gateway</title></head><body>Bad Gateway</body></html>")
    ])
    client = httpx.Client(transport=transport)

    rp = RunPodLLMClient(
        api_key="rpa_valid_key",
        endpoint_id="vllm-test-123",
        http_client=client,
        max_retries=1
    )

    with pytest.raises(RunPodBadResponseError) as exc_info:
        rp.generate("Test prompt")

    assert "non-JSON" in str(exc_info.value)


def test_runpod_client_never_logs_prompt_or_key(caplog):
    mock_data = {
        "choices": [{"message": {"content": "Safe response"}}]
    }
    transport = MockTransport([(200, mock_data)])
    client = httpx.Client(transport=transport)

    secret_key = "rpa_super_secret_runpod_key_xyz987"
    secret_prompt = "CONFIDENTIAL_USER_PII_JOHN_DOE_IC_990101"

    rp = RunPodLLMClient(
        api_key=secret_key,
        endpoint_id="vllm-test-123",
        http_client=client
    )

    with caplog.at_level(logging.DEBUG):
        out = rp.generate(secret_prompt)

    assert out == "Safe response"

    # Strict privacy verification: Neither the prompt text nor the API key may appear in logs
    log_text = caplog.text
    assert secret_key not in log_text, "SECURITY VIOLATION: API key leaked in application logs!"
    assert secret_prompt not in log_text, "PRIVACY VIOLATION: User prompt text leaked in application logs!"


def test_runpod_client_is_reachable_caching():
    transport = MockTransport([
        (200, {"data": [{"id": "Qwen/Qwen2.5-7B-Instruct"}]})
    ])
    client = httpx.Client(transport=transport)

    rp = RunPodLLMClient(
        api_key="rpa_testkey",
        endpoint_id="vllm-test-123",
        http_client=client
    )

    # First check calls the endpoint
    assert rp.is_reachable() is True
    assert transport.call_count == 1

    # Second check within TTL is cached (call count remains 1)
    assert rp.is_reachable() is True
    assert transport.call_count == 1
