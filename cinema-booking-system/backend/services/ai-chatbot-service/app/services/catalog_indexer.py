from datetime import date, datetime
import logging
import math
from typing import Any

from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import SessionLocal
from app.services import downstream_client, llm_client
from app.services.cache_service import vector_literal

logger = logging.getLogger("cinebot.indexer")

_UPSERT_MOVIE_SQL = sql_text(
    """
    INSERT INTO movie_embeddings
        (movie_id, title, genres, synopsis, age_rating,
         director, actors, imdb_rating, region, release_date, language, duration_minutes,
         embedding, updated_at)
    VALUES
        (:movie_id, :title, :genres, :synopsis, :age_rating,
         :director, :actors, :imdb_rating, :region, :release_date, :language, :duration_minutes,
         CAST(:embedding AS vector), NOW())
    ON CONFLICT (movie_id) DO UPDATE SET
        title = EXCLUDED.title,
        genres = EXCLUDED.genres,
        synopsis = EXCLUDED.synopsis,
        age_rating = EXCLUDED.age_rating,
        director = EXCLUDED.director,
        actors = EXCLUDED.actors,
        imdb_rating = EXCLUDED.imdb_rating,
        region = EXCLUDED.region,
        release_date = EXCLUDED.release_date,
        language = EXCLUDED.language,
        duration_minutes = EXCLUDED.duration_minutes,
        embedding = EXCLUDED.embedding,
        updated_at = NOW()
    """
)


def _opt_str(value: Any, max_len: int | None = None) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    return text[:max_len] if max_len is not None else text


def _opt_float(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if math.isfinite(parsed) else None


def _opt_int(value: Any) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _opt_date(value: Any) -> date | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, (list, tuple)) and len(value) >= 3:
        try:
            return date(int(value[0]), int(value[1]), int(value[2]))
        except (TypeError, ValueError):
            return None
    try:
        text = str(value).strip()
        if len(text) < 10:
            return None
        return date.fromisoformat(text[:10])
    except (TypeError, ValueError):
        return None


def _pick(movie: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        val = movie.get(key)
        if val is not None and (not isinstance(val, str) or val.strip() != ""):
            return val
    return None


def _extract_movie_ids(result: Any) -> list[int]:
    """Read integer movie_id values from a SQLAlchemy Result or test double."""
    if result is None:
        return []
    scalars_fn = getattr(result, "scalars", None)
    if callable(scalars_fn):
        scalars = scalars_fn()
        all_fn = getattr(scalars, "all", None)
        if callable(all_fn):
            return [int(mid) for mid in all_fn() if mid is not None]
    for method_name in ("fetchall", "all"):
        method = getattr(result, method_name, None)
        if callable(method):
            rows = method()
            ids: list[int] = []
            for row in rows:
                val = row[0] if isinstance(row, (tuple, list)) else getattr(row, "movie_id", row)
                if val is not None:
                    ids.append(int(val))
            return ids
    return []


async def upsert_movie(
    movie: dict[str, Any],
    db: AsyncSession | None = None,
    *,
    commit: bool = True,
) -> bool:
    """Embed a catalog movie dict and upsert it into movie_embeddings."""
    movie_id = movie.get("id") if movie.get("id") is not None else movie.get("movieId")
    if movie_id is None:
        return False

    movie_id_int = int(movie_id)
    title = str(movie.get("title") or f"Movie {movie_id_int}")[:255]
    raw_genres = movie.get("genres") or movie.get("genreNames") or []
    genres = (
        ", ".join(str(g) for g in raw_genres)
        if isinstance(raw_genres, list)
        else str(raw_genres or "")
    )[:255]
    synopsis = str(
        movie.get("description")
        or movie.get("aiSummary")
        or movie.get("synopsis")
        or ""
    )
    age_rating = str(movie.get("ageRating") or movie.get("age_rating") or "")[:16]

    director = _opt_str(movie.get("director"), 200)
    raw_actors = movie.get("actors")
    if isinstance(raw_actors, list):
        actors = _opt_str(", ".join(str(a).strip() for a in raw_actors if str(a).strip()))
    else:
        actors = _opt_str(raw_actors)
    imdb_rating = _opt_float(_pick(movie, "imdbRating", "imdb_rating"))
    region = _opt_str(movie.get("region"), 255)
    release_date = _opt_date(_pick(movie, "releaseDate", "release_date"))
    language = _opt_str(movie.get("language"), 50)
    duration_minutes = _opt_int(_pick(movie, "durationMinutes", "duration_minutes"))
    ai_summary = _opt_str(_pick(movie, "aiSummary", "ai_summary"))

    lines = [
        title,
        f"Genres: {genres}",
    ]
    if director:
        lines.append(f"Director: {director}")
    if actors:
        lines.append(f"Cast: {actors}")
    if release_date is not None:
        lines.append(f"Released: {release_date.year}")
    if region:
        lines.append(f"Region: {region}")
    if language:
        lines.append(f"Language: {language}")
    lines.append(f"Synopsis: {synopsis}")
    if ai_summary and ai_summary != synopsis.strip():
        lines.append(f"Summary: {ai_summary}")

    embed_text = "\n".join(lines).strip()
    embedding = await llm_client.embed(embed_text)
    vec = vector_literal(embedding)

    params = {
        "movie_id": movie_id_int,
        "title": title,
        "genres": genres,
        "synopsis": synopsis,
        "age_rating": age_rating,
        "director": director,
        "actors": actors,
        "imdb_rating": imdb_rating,
        "region": region,
        "release_date": release_date,
        "language": language,
        "duration_minutes": duration_minutes,
        "embedding": vec,
    }

    if db is not None:
        await db.execute(_UPSERT_MOVIE_SQL, params)
        if commit:
            await db.commit()
    else:
        async with SessionLocal() as session:
            await session.execute(_UPSERT_MOVIE_SQL, params)
            await session.commit()
    return True


async def _reindex_movies(movies: list[dict[str, Any]], session: AsyncSession) -> dict[str, int]:
    indexed = 0
    skipped = 0
    catalog_ids: list[int] = []

    for movie in movies:
        if not isinstance(movie, dict):
            skipped += 1
            continue
        raw_id = movie.get("id") if movie.get("id") is not None else movie.get("movieId")
        if raw_id is None:
            logger.warning("Skipping movie without id during reindex: %s", movie)
            skipped += 1
            continue
        try:
            movie_id_int = int(raw_id)
        except (TypeError, ValueError):
            logger.warning("Skipping movie with invalid id %r during reindex", raw_id)
            skipped += 1
            continue

        catalog_ids.append(movie_id_int)
        try:
            ok = await upsert_movie(movie, session, commit=False)
            if ok:
                indexed += 1
            else:
                skipped += 1
        except Exception:
            logger.warning("Failed to embed/upsert movie_id=%s during reindex", movie_id_int, exc_info=True)
            skipped += 1

    removed = 0
    if catalog_ids:
        existing_res = await session.execute(sql_text("SELECT movie_id FROM movie_embeddings"))
        existing_ids = set(_extract_movie_ids(existing_res))
        unique_ids = list(dict.fromkeys(catalog_ids))
        removed = len(existing_ids - set(unique_ids))
        await session.execute(
            sql_text("DELETE FROM movie_embeddings WHERE movie_id <> ALL(:ids)"),
            {"ids": unique_ids},
        )
        await session.commit()

    return {"indexed": indexed, "removed": removed, "skipped": skipped}


async def reindex_catalog(db: AsyncSession | None = None) -> dict[str, int]:
    """Backfill all active catalog movies into movie_embeddings and prune removed ones."""
    try:
        movies = await downstream_client.list_all_movies(settings.REINDEX_MAX_MOVIES)
    except Exception:
        logger.warning("Failed to list catalog movies during reindex", exc_info=True)
        return {"indexed": 0, "removed": 0, "skipped": 0}

    if not movies:
        return {"indexed": 0, "removed": 0, "skipped": 0}

    if db is not None:
        return await _reindex_movies(movies, db)

    async with SessionLocal() as session:
        return await _reindex_movies(movies, session)
