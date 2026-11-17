from datetime import date
import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger("cinebot.downstream")

_client = httpx.AsyncClient(
    timeout=3.0,
    headers={"X-Internal-Token": settings.INTERNAL_API_TOKEN},
    limits=httpx.Limits(max_connections=20),
)


def _unwrap_data(payload: Any) -> Any:
    if isinstance(payload, dict) and "data" in payload:
        return payload["data"]
    return payload


async def get_movie_by_id(movie_id: int) -> dict | None:
    """Fetch full movie details (including description/genres) from catalog-service."""
    url = f"{settings.CATALOG_SERVICE_URL.rstrip('/')}/api/movies/{movie_id}"
    try:
        resp = await _client.get(url)
        resp.raise_for_status()
        data = _unwrap_data(resp.json())
        return data if isinstance(data, dict) else None
    except Exception:
        logger.warning("Failed to fetch movie %s from catalog-service", movie_id, exc_info=True)
        return None


async def list_all_movies(limit: int = 500) -> list[dict]:
    """Fetch active movies from catalog-service for catalog backfill/reindexing."""
    base = settings.CATALOG_SERVICE_URL.rstrip("/")
    try:
        resp = await _client.get(f"{base}/api/movies")
        resp.raise_for_status()
        data = _unwrap_data(resp.json())
        if not isinstance(data, list):
            return []
        return [m for m in data if isinstance(m, dict)][: max(0, limit)]
    except Exception:
        logger.warning("Failed to list all movies from catalog-service", exc_info=True)
        return []


async def search_movies(keyword: str = "") -> list[dict]:
    """Search active movies via catalog-service /api/catalog/search or /api/movies."""
    base = settings.CATALOG_SERVICE_URL.rstrip("/")
    cleaned = (keyword or "").strip()

    if cleaned:
        try:
            resp = await _client.get(
                f"{base}/api/catalog/search",
                params={"keyword": cleaned, "page": 0, "size": 5},
            )
            resp.raise_for_status()
            data = _unwrap_data(resp.json()) or {}
            movies = data.get("movies") if isinstance(data, dict) else data
            if isinstance(movies, list) and movies:
                return movies[:5]
        except Exception:
            logger.warning("Catalog search failed for keyword=%r", cleaned, exc_info=True)

    try:
        resp = await _client.get(f"{base}/api/movies")
        resp.raise_for_status()
        data = _unwrap_data(resp.json())
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
    except Exception:
        logger.warning("Failed to fetch movie list from catalog-service", exc_info=True)
        return []


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

    all_items: list[dict] = []
    for mid in movie_ids:
        try:
            resp = await _client.get(f"{base}/api/showtimes/movie/{mid}")
            resp.raise_for_status()
            data = _unwrap_data(resp.json())
            if not isinstance(data, list):
                continue
            for item in data:
                if not isinstance(item, dict):
                    continue
                if str(item.get("status") or "").upper() == "CANCELLED":
                    continue
                if cinema_id is not None and item.get("cinemaId") != cinema_id:
                    continue
                all_items.append(item)
        except Exception:
            logger.warning("Failed to fetch showtimes for movie_id=%s", mid, exc_info=True)

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
    try:
        if user_id is not None:
            resp = await _client.get(
                f"{base}/api/recommendations/movies",
                params={"userId": user_id, "limit": 5},
                headers={"X-User-Id": str(user_id)},
            )
        else:
            resp = await _client.get(
                f"{base}/api/recommendations/movies/popular",
                params={"limit": 5},
            )
        resp.raise_for_status()
        data = _unwrap_data(resp.json())
        if isinstance(data, dict):
            recs = data.get("recommendations")
            return recs[:5] if isinstance(recs, list) else []
        if isinstance(data, list):
            return data[:5]
        return []
    except Exception:
        logger.warning("Failed to fetch recommendations for user_id=%s", user_id, exc_info=True)
        return []
