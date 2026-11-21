import asyncio
from collections.abc import Awaitable, Callable, Sequence
import logging
import random
import time as _stdlib_time
from typing import Any, TypeVar

import httpx

from app.core.config import settings


class _LocalTimeProxy:
    """Module-local time proxy so patching resiliency.time never freezes asyncio's loop clock."""

    monotonic = staticmethod(_stdlib_time.monotonic)

    def __getattr__(self, name: str) -> Any:
        return getattr(_stdlib_time, name)


time = _LocalTimeProxy()

logger = logging.getLogger("cinebot.resiliency")

T = TypeVar("T")


class CircuitBreakerOpenError(RuntimeError):
    """Raised when a downstream circuit breaker is open and fast-failing."""


class CircuitBreaker:
    """Lightweight per-service circuit breaker (CLOSED -> OPEN -> HALF_OPEN)."""

    def __init__(
        self,
        name: str,
        *,
        failure_threshold: int | None = None,
        recovery_timeout: float | None = None,
        half_open_max_calls: int = 1,
    ) -> None:
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max_calls = max(1, half_open_max_calls)
        self._state = "CLOSED"
        self._failure_count = 0
        self._opened_at: float | None = None
        self._half_open_in_flight = 0

    def _threshold(self) -> int:
        if self.failure_threshold is not None:
            return max(1, self.failure_threshold)
        return max(1, settings.CIRCUIT_BREAKER_FAILURE_THRESHOLD)

    def _recovery_seconds(self) -> float:
        if self.recovery_timeout is not None:
            return max(0.0, self.recovery_timeout)
        return max(0.0, settings.CIRCUIT_BREAKER_RECOVERY_SECONDS)

    @property
    def state(self) -> str:
        if self._state == "OPEN" and self._opened_at is not None:
            if (time.monotonic() - self._opened_at) >= self._recovery_seconds():
                self._state = "HALF_OPEN"
                self._half_open_in_flight = 0
        return self._state

    def allow_request(self) -> bool:
        current = self.state
        if current == "CLOSED":
            return True
        if current == "HALF_OPEN":
            if self._half_open_in_flight < self.half_open_max_calls:
                self._half_open_in_flight += 1
                return True
            return False
        return False

    def record_success(self) -> None:
        if self._state != "CLOSED":
            logger.info("Circuit breaker '%s' closed after recovery", self.name)
        self._state = "CLOSED"
        self._failure_count = 0
        self._opened_at = None
        self._half_open_in_flight = 0

    def record_failure(self) -> None:
        if self._state == "HALF_OPEN":
            self._state = "OPEN"
            self._opened_at = time.monotonic()
            self._half_open_in_flight = 0
            logger.warning("Circuit breaker '%s' reopened after half-open probe failure", self.name)
            return

        self._failure_count += 1
        if self._failure_count >= self._threshold():
            if self._state != "OPEN":
                logger.warning(
                    "Circuit breaker '%s' opened after %d consecutive failures",
                    self.name,
                    self._failure_count,
                )
            self._state = "OPEN"
            self._opened_at = time.monotonic()
            self._half_open_in_flight = 0

    def reset(self) -> None:
        self._state = "CLOSED"
        self._failure_count = 0
        self._opened_at = None
        self._half_open_in_flight = 0


def is_retryable_status(status_code: int) -> bool:
    return status_code in (408, 429) or status_code >= 500


def is_retryable_exception(exc: BaseException) -> bool:
    resp = getattr(exc, "response", None)
    status_code = getattr(resp, "status_code", None)
    if isinstance(status_code, int):
        return is_retryable_status(status_code)
    return isinstance(exc, (httpx.HTTPError, TimeoutError, ConnectionError, OSError))


def is_transient_llm_error(exc: BaseException) -> bool:
    if isinstance(exc, (TimeoutError, ConnectionError, httpx.HTTPError)):
        return is_retryable_exception(exc)
    status = getattr(exc, "status_code", None) or getattr(exc, "code", None)
    if isinstance(status, int):
        return is_retryable_status(status)
    msg = str(exc).lower()
    return any(
        token in msg
        for token in (
            "429",
            "500",
            "502",
            "503",
            "504",
            "rate limit",
            "quota",
            "resource exhausted",
            "temporarily unavailable",
            "timeout",
            "timed out",
            "connection",
        )
    )


async def async_sleep(seconds: float) -> None:
    """Sleep when an asyncio event loop is active; no-op in sync sandbox test runner."""
    if seconds <= 0:
        return
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return
    await asyncio.sleep(seconds)


async def gather_concurrency(coros: Sequence[Awaitable[T]]) -> list[T | BaseException]:
    """Run awaitables concurrently when an event loop is running, else sequentially."""
    if not coros:
        return []
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        results: list[T | BaseException] = []
        for coro in coros:
            try:
                results.append(await coro)
            except BaseException as exc:
                results.append(exc)
        return results
    return list(await asyncio.gather(*coros, return_exceptions=True))


def _backoff_delay(attempt: int, base_delay: float, max_delay: float) -> float:
    raw = min(max_delay, base_delay * (2**attempt))
    return raw * random.uniform(0.5, 1.0)


async def retry_with_circuit_breaker(
    breaker: CircuitBreaker,
    operation: Callable[[], Awaitable[T]],
    *,
    max_retries: int | None = None,
    base_delay: float | None = None,
    max_delay: float | None = None,
) -> T:
    """Execute an async HTTP operation protected by retries with jitter and a circuit breaker."""
    if not breaker.allow_request():
        raise CircuitBreakerOpenError(f"Circuit breaker '{breaker.name}' is OPEN")

    retries = max(0, settings.DOWNSTREAM_MAX_RETRIES if max_retries is None else max_retries)
    base = max(0.0, settings.DOWNSTREAM_RETRY_BASE_DELAY if base_delay is None else base_delay)
    cap = max(base, settings.DOWNSTREAM_RETRY_MAX_DELAY if max_delay is None else max_delay)

    for attempt in range(retries + 1):
        try:
            response = await operation()
        except Exception as exc:
            if not is_retryable_exception(exc):
                if breaker.state == "HALF_OPEN":
                    breaker.record_success()
                raise
            if attempt < retries:
                await async_sleep(_backoff_delay(attempt, base, cap))
                continue
            breaker.record_failure()
            raise

        status_code = getattr(response, "status_code", None)
        if isinstance(status_code, int) and status_code >= 400:
            if is_retryable_status(status_code):
                if attempt < retries:
                    await async_sleep(_backoff_delay(attempt, base, cap))
                    continue
                breaker.record_failure()
                response.raise_for_status()
            else:
                if breaker.state == "HALF_OPEN":
                    breaker.record_success()
                response.raise_for_status()

        breaker.record_success()
        return response

    raise CircuitBreakerOpenError(f"Circuit breaker '{breaker.name}' exhausted retries")
