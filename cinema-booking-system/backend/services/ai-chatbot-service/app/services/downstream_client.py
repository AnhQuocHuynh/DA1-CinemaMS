import httpx

from app.core.config import settings

_client = httpx.AsyncClient(
    timeout=3.0,
    headers={"X-Internal-Token": settings.INTERNAL_API_TOKEN},
    limits=httpx.Limits(max_connections=20),
)


async def get_today_showtimes(movie_id: int | None = None, cinema_id: int | None = None) -> list[dict]:
    raise NotImplementedError  # TODO: showtime-service


async def search_movies(keyword: str) -> list[dict]:
    raise NotImplementedError  # TODO: catalog-service


async def get_user_recommendations(user_id: int) -> list[dict]:
    raise NotImplementedError  # TODO: recommendation-service

