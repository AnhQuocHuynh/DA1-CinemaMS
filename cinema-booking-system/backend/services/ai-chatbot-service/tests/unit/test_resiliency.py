from datetime import date

import httpx
import pytest

from app import main
from app.services import downstream_client, llm_client, resiliency
from app.services.resiliency import CircuitBreaker, CircuitBreakerOpenError


class _FakeResp:
    def __init__(self, payload, status_code: int = 200) -> None:
        self._payload = payload
        self.status_code = status_code

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise httpx.HTTPError(f"HTTP {self.status_code}")

    def json(self):
        return self._payload


class _SequencedHttp:
    def __init__(self, outcomes_by_pattern: dict[str, list[object]]) -> None:
        self.outcomes = {k: list(v) for k, v in outcomes_by_pattern.items()}
        self.calls: list[str] = []

    async def get(self, url: str, params=None, headers=None):
        self.calls.append(url)
        for pattern, queue in self.outcomes.items():
            if pattern in url:
                item = queue.pop(0) if len(queue) > 1 else queue[0]
                if isinstance(item, BaseException):
                    raise item
                return item
        return _FakeResp({}, status_code=404)


@pytest.mark.asyncio
async def test_retries_transient_errors_and_succeeds(monkeypatch):
    sleeps: list[float] = []

    async def fake_sleep(delay: float) -> None:
        sleeps.append(delay)

    monkeypatch.setattr(resiliency, "async_sleep", fake_sleep)
    monkeypatch.setattr(resiliency.settings, "DOWNSTREAM_MAX_RETRIES", 2)

    http = _SequencedHttp(
        {
            "/api/movies/7": [
                _FakeResp({}, status_code=503),
                httpx.HTTPError("transient reset"),
                _FakeResp({"success": True, "data": {"id": 7, "title": "Avatar"}}),
            ]
        }
    )
    monkeypatch.setattr(downstream_client, "_client", http)

    movie = await downstream_client.get_movie_by_id(7)
    assert movie == {"id": 7, "title": "Avatar"}
    assert len(http.calls) == 3
    assert len(sleeps) == 2
    assert downstream_client.get_breaker("catalog").state == "CLOSED"


@pytest.mark.asyncio
async def test_client_errors_404_do_not_retry_or_trip_circuit(monkeypatch):
    monkeypatch.setattr(resiliency.settings, "DOWNSTREAM_MAX_RETRIES", 2)
    monkeypatch.setattr(resiliency.settings, "CIRCUIT_BREAKER_FAILURE_THRESHOLD", 2)

    http = _SequencedHttp({"/api/movies/999": [_FakeResp({}, status_code=404)]})
    monkeypatch.setattr(downstream_client, "_client", http)

    for _ in range(4):
        assert await downstream_client.get_movie_by_id(999) is None

    assert len(http.calls) == 4
    assert downstream_client.get_breaker("catalog").state == "CLOSED"


@pytest.mark.asyncio
async def test_circuit_breaker_opens_fast_fails_and_recovers(monkeypatch):
    clock = [100.0]
    monkeypatch.setattr(resiliency.time, "monotonic", lambda: clock[0])
    monkeypatch.setattr(resiliency.settings, "DOWNSTREAM_MAX_RETRIES", 1)
    monkeypatch.setattr(resiliency.settings, "CIRCUIT_BREAKER_FAILURE_THRESHOLD", 2)
    monkeypatch.setattr(resiliency.settings, "CIRCUIT_BREAKER_RECOVERY_SECONDS", 30.0)

    http = _SequencedHttp(
        {
            "/api/orders/users/5": [
                _FakeResp({}, status_code=503),
                _FakeResp({}, status_code=503),
                _FakeResp({}, status_code=503),
                _FakeResp({}, status_code=503),
                _FakeResp([{"id": 10, "status": "PAID"}]),
            ],
            "/api/movies/1": [_FakeResp({"success": True, "data": {"id": 1, "title": "Dune"}})],
        }
    )
    monkeypatch.setattr(downstream_client, "_client", http)

    # 2 failing calls (each retrying once = 4 HTTP calls) open the booking circuit
    assert await downstream_client.get_user_orders(5) == []
    assert downstream_client.get_breaker("booking").state == "CLOSED"
    assert await downstream_client.get_user_orders(5) == []
    assert downstream_client.get_breaker("booking").state == "OPEN"
    calls_before_open = len(http.calls)

    # While OPEN, booking calls fast-fail without hitting HTTP
    assert await downstream_client.get_user_orders(5) == []
    assert len(http.calls) == calls_before_open

    # Independent catalog circuit remains CLOSED and healthy
    assert (await downstream_client.get_movie_by_id(1))["title"] == "Dune"
    assert downstream_client.get_breaker("catalog").state == "CLOSED"

    # Advance past recovery timeout -> HALF_OPEN probe succeeds -> CLOSED
    clock[0] += 31.0
    assert downstream_client.get_breaker("booking").state == "HALF_OPEN"
    orders = await downstream_client.get_user_orders(5)
    assert orders == [{"id": 10, "status": "PAID"}]
    assert downstream_client.get_breaker("booking").state == "CLOSED"


@pytest.mark.asyncio
async def test_half_open_probe_failure_reopens_circuit(monkeypatch):
    clock = [10.0]
    monkeypatch.setattr(resiliency.time, "monotonic", lambda: clock[0])

    breaker = CircuitBreaker("showtime", failure_threshold=1, recovery_timeout=15.0)

    async def failing_op():
        raise httpx.HTTPError("timeout")

    with pytest.raises(httpx.HTTPError):
        await resiliency.retry_with_circuit_breaker(breaker, failing_op, max_retries=0)
    assert breaker.state == "OPEN"

    clock[0] += 16.0
    assert breaker.state == "HALF_OPEN"
    with pytest.raises(httpx.HTTPError):
        await resiliency.retry_with_circuit_breaker(breaker, failing_op, max_retries=0)
    assert breaker.state == "OPEN"

    with pytest.raises(CircuitBreakerOpenError):
        await resiliency.retry_with_circuit_breaker(breaker, failing_op, max_retries=0)


@pytest.mark.asyncio
async def test_showtimes_concurrent_fanout_and_health_circuits(monkeypatch):
    today = date.today().isoformat()
    http = _SequencedHttp(
        {
            "/api/movies": [
                _FakeResp(
                    {
                        "success": True,
                        "data": [
                            {"id": 1, "title": "M1"},
                            {"id": 2, "title": "M2"},
                        ],
                    }
                )
            ],
            "/api/showtimes/movie/1": [
                _FakeResp(
                    {
                        "success": True,
                        "data": [
                            {
                                "id": 101,
                                "movieId": 1,
                                "displayTitle": "M1",
                                "startTime": f"{today}T18:00:00",
                                "status": "ACTIVE",
                            }
                        ],
                    }
                )
            ],
            "/api/showtimes/movie/2": [
                _FakeResp(
                    {
                        "success": True,
                        "data": [
                            {
                                "id": 102,
                                "movieId": 2,
                                "displayTitle": "M2",
                                "startTime": f"{today}T19:00:00",
                                "status": "ACTIVE",
                            }
                        ],
                    }
                )
            ],
        }
    )
    monkeypatch.setattr(downstream_client, "_client", http)

    slots = await downstream_client.get_today_showtimes(movie_id=None)
    assert [s["id"] for s in slots] == [101, 102]

    health = await main.health()
    assert health["status"] == "ok"
    assert health["circuits"]["showtime"] == "CLOSED"


@pytest.mark.asyncio
async def test_llm_client_retries_transient_error_before_succeeding_or_failing_over(monkeypatch):
    monkeypatch.setattr(llm_client.settings, "AI_PROVIDER", "Gemini")
    monkeypatch.setattr(llm_client.settings, "GEMINI_API_KEY", "gem-key")
    monkeypatch.setattr(llm_client.settings, "OPENAI_API_KEY", "oai-key")
    monkeypatch.setattr(llm_client.settings, "LLM_MAX_RETRIES", 1)

    attempts = 0

    async def flaky_gemini(prompt, temperature, max_tokens):
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise RuntimeError("429 Resource exhausted")
        return "Recovered Gemini reply"

    monkeypatch.setattr(llm_client, "_gemini_generate", flaky_gemini)
    assert await llm_client.generate("hello") == "Recovered Gemini reply"
    assert attempts == 2

    # Non-transient error does not retry primary and fails over immediately
    primary_calls = 0

    async def auth_fail_gemini(prompt, temperature, max_tokens):
        nonlocal primary_calls
        primary_calls += 1
        raise ValueError("Invalid API key 401")

    async def ok_openai(prompt, temperature, max_tokens):
        return "OpenAI backup"

    monkeypatch.setattr(llm_client, "_gemini_generate", auth_fail_gemini)
    monkeypatch.setattr(llm_client, "_openai_generate", ok_openai)
    assert await llm_client.generate("hello") == "OpenAI backup"
    assert primary_calls == 1
