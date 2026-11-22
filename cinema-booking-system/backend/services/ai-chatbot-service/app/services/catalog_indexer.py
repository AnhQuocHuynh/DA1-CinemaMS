import logging
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
        (movie_id, title, genres, synopsis, age_rating, embedding, updated_at)
    VALUES
        (:movie_id, :title, :genres, :synopsis, :age_rating, CAST(:embedding AS vector), NOW())
    ON CONFLICT (movie_id) DO UPDATE SET
        title = EXCLUDED.title,
        genres = EXCLUDED.genres,
        synopsis = EXCLUDED.synopsis,
        age_rating = EXCLUDED.age_rating,
        embedding = EXCLUDED.embedding,
        updated_at = NOW()
    """
)


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
    age_rating = str(movie.get("ageRating") or "")[:16]

    embed_text = f"{title}\nGenres: {genres}\nSynopsis: {synopsis}".strip()
    embedding = await llm_client.embed(embed_text)
    vec = vector_literal(embedding)

    params = {
        "movie_id": movie_id_int,
        "title": title,
        "genres": genres,
        "synopsis": synopsis,
        "age_rating": age_rating,
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
