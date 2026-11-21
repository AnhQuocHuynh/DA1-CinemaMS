from datetime import date
import logging
from typing import Any

import httpx

from app.core.config import settings
from app.services import resiliency
from app.services.resiliency import CircuitBreaker, CircuitBreakerOpenError

logger = logging.getLogger("cinebot.downstream")

_client = httpx.AsyncClient(
    timeout=settings.DOWNSTREAM_TIMEOUT_SECONDS,
    headers={"X-Internal-Token": settings.INTERNAL_API_TOKEN},
    limits=httpx.Limits(max_connections=20),
)

_BREAKERS: dict[str, CircuitBreaker] = {
    "catalog": CircuitBreaker("catalog"),
    "showtime": CircuitBreaker("showtime"),
    "booking": CircuitBreaker("booking"),
    "recommendation": CircuitBreaker("recommendation"),
    "identity": CircuitBreaker("identity"),
    "keycloak": CircuitBreaker("keycloak"),
}


def get_breaker(service: str) -> CircuitBreaker:
    breaker = _BREAKERS.get(service)
    if breaker is None:
        breaker = CircuitBreaker(service)
        _BREAKERS[service] = breaker
    return breaker


def reset_circuit_breakers() -> None:
    for breaker in _BREAKERS.values():
        breaker.reset()


def get_circuit_breaker_states() -> dict[str, str]:
    return {name: breaker.state for name, breaker in _BREAKERS.items()}


async def get_with_resilience(
    service: str,
    url: str,
    *,
    params: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
) -> Any:
    """Execute a GET request protected by retries with jitter and a per-service circuit breaker."""
    breaker = get_breaker(service)

    async def _call() -> Any:
        return await _client.get(url, params=params, headers=headers)

    return await resiliency.retry_with_circuit_breaker(breaker, _call)


async def _get_json_fail_open(
    service: str,
    url: str,
    *,
    params: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
) -> tuple[bool, Any]:
    try:
        resp = await get_with_resilience(service, url, params=params, headers=headers)
        return True, resp.json()
    except CircuitBreakerOpenError as exc:
        logger.warning("Circuit open for %s (%s): %s", service, url, exc)
        return False, None
    except Exception:
        logger.warning("Downstream %s request failed (%s)", service, url, exc_info=True)
        return False, None


def _unwrap_data(payload: Any) -> Any:
    if isinstance(payload, dict) and "data" in payload:
        return payload["data"]
    return payload


async def get_movie_by_id(movie_id: int) -> dict | None:
    """Fetch full movie details (including description/genres) from catalog-service."""
    url = f"{settings.CATALOG_SERVICE_URL.rstrip('/')}/api/movies/{movie_id}"
    ok, payload = await _get_json_fail_open("catalog", url)
    if not ok:
        return None
    data = _unwrap_data(payload)
    return data if isinstance(data, dict) else None


async def list_all_movies(limit: int = 500) -> list[dict]:
    """Fetch active movies from catalog-service for catalog backfill/reindexing."""
    base = settings.CATALOG_SERVICE_URL.rstrip("/")
    ok, payload = await _get_json_fail_open("catalog", f"{base}/api/movies")
    if not ok:
        return []
    data = _unwrap_data(payload)
    if not isinstance(data, list):
        return []
    return [m for m in data if isinstance(m, dict)][: max(0, limit)]


async def search_movies(keyword: str = "") -> list[dict]:
    """Search active movies via catalog-service /api/catalog/search or /api/movies."""
    base = settings.CATALOG_SERVICE_URL.rstrip("/")
    cleaned = (keyword or "").strip()

    if cleaned:
        ok, payload = await _get_json_fail_open(
            "catalog",
            f"{base}/api/catalog/search",
            params={"keyword": cleaned, "page": 0, "size": 5},
        )
        if ok:
            data = _unwrap_data(payload) or {}
            movies = data.get("movies") if isinstance(data, dict) else data
            if isinstance(movies, list) and movies:
                return movies[:5]

    ok, payload = await _get_json_fail_open("catalog", f"{base}/api/movies")
    if not ok:
        return []
    data = _unwrap_data(payload)
    if not isinstance(data, list):
        return []
    if not cleaned:
        return data[:5]
    lowered = cleaned.lower()
    filtered = [
        m
        for m in data
        if lowered in str(m.get("title") or "").lower()
        or any(lowered in str(g).lower() for g in (m.get("genres") or []))
    ]
    return filtered[:5]


async def get_today_showtimes(
    movie_id: int | None = None, cinema_id: int | None = None
) -> list[dict]:
    """Fetch active showtimes from showtime-service, prioritizing today's schedule."""
    base = settings.SHOWTIME_SERVICE_URL.rstrip("/")
    if movie_id is not None:
        movie_ids = [movie_id]
    else:
        movies = await search_movies("")
        movie_ids = [m["id"] for m in movies[:5] if isinstance(m, dict) and m.get("id") is not None]

    async def _fetch_for_movie(mid: int) -> list[dict]:
        ok, payload = await _get_json_fail_open(
            "showtime", f"{base}/api/showtimes/movie/{mid}"
        )
        if not ok:
            return []
        data = _unwrap_data(payload)
        if not isinstance(data, list):
            return []
        items: list[dict] = []
        for item in data:
            if not isinstance(item, dict):
                continue
            if str(item.get("status") or "").upper() == "CANCELLED":
                continue
            if cinema_id is not None and item.get("cinemaId") != cinema_id:
                continue
            items.append(item)
        return items

    batches = await resiliency.gather_concurrency(
        [_fetch_for_movie(mid) for mid in movie_ids]
    )
    all_items: list[dict] = []
    for batch in batches:
        if isinstance(batch, list):
            all_items.extend(batch)

    today_prefix = date.today().isoformat()
    today_items = [
        item for item in all_items if str(item.get("startTime") or "").startswith(today_prefix)
    ]
    selected = today_items if today_items else all_items
    selected.sort(key=lambda item: str(item.get("startTime") or ""))
    return selected[:10]


async def get_user_recommendations(user_id: int | None = None) -> list[dict]:
    """Fetch personalized or popular movie recommendations from recommendation-service."""
    base = settings.RECOMMENDATION_SERVICE_URL.rstrip("/")
    if user_id is not None:
        ok, payload = await _get_json_fail_open(
            "recommendation",
            f"{base}/api/recommendations/movies",
            params={"userId": user_id, "limit": 5},
            headers={"X-User-Id": str(user_id)},
        )
    else:
        ok, payload = await _get_json_fail_open(
            "recommendation",
            f"{base}/api/recommendations/movies/popular",
            params={"limit": 5},
        )
    if not ok:
        return []
    data = _unwrap_data(payload)
    if isinstance(data, dict):
        recs = data.get("recommendations")
        return recs[:5] if isinstance(recs, list) else []
    if isinstance(data, list):
        return data[:5]
    return []


async def resolve_user_id(keycloak_id: str | None) -> int | None:
    """Resolve a Keycloak UUID subject to the platform numeric user_id via identity-service."""
    cleaned = str(keycloak_id or "").strip()
    if not cleaned:
        return None
    base = settings.IDENTITY_SERVICE_URL.rstrip("/")
    ok, payload = await _get_json_fail_open(
        "identity",
        f"{base}/internal/users/resolve",
        params={"keycloakId": cleaned},
    )
    if not ok:
        return None
    data = _unwrap_data(payload)
    if isinstance(data, bool):
        return None
    if isinstance(data, int):
        return data if data > 0 else None
    if isinstance(data, str) and data.strip().isdigit():
        parsed = int(data.strip())
        return parsed if parsed > 0 else None
    return None


async def get_user_orders(
    user_id: int | None, auth_token: str | None = None
) -> list[dict]:
    """Fetch user ticket orders from booking-service for an authorized positive user_id."""
    if user_id is None or user_id <= 0:
        return []
    base = settings.BOOKING_SERVICE_URL.rstrip("/")
    headers: dict[str, str] = {"X-User-Id": str(user_id)}
    if auth_token:
        headers["Authorization"] = f"Bearer {auth_token}"
    ok, payload = await _get_json_fail_open(
        "booking",
        f"{base}/api/orders/users/{user_id}",
        headers=headers,
    )
    if not ok:
        return []
    data = _unwrap_data(payload)
    if not isinstance(data, list):
        return []
    return [item for item in data if isinstance(item, dict)][:10]
