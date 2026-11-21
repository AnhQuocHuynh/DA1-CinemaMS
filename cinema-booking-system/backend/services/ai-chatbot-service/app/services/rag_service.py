import logging

from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import SessionLocal
from app.services.cache_service import vector_literal

logger = logging.getLogger("cinebot.rag")


def apply_relative_margin(rows: list[dict], margin: float) -> list[dict]:
    """Keep retrieved rows whose similarity is within `margin` of the top hit."""
    if not rows:
        return []
    effective_margin = max(0.0, float(margin))
    cutoff = float(rows[0]["similarity"]) - effective_margin
    return [row for row in rows if float(row["similarity"]) >= cutoff]


def clip_snippet(text: str | None, max_len: int = 300) -> str:
    """Clip text to at most `max_len` characters, breaking on whitespace."""
    if not text:
        return ""
    stripped = text.strip()
    if len(stripped) <= max_len:
        return stripped
    window = stripped[: max_len + 1]
    for idx in range(len(window) - 1, 0, -1):
        if window[idx].isspace():
            return stripped[:idx].rstrip()
    return stripped[:max_len]


def _to_source_dict(
    source_type: str,
    item_id: int | str | None,
    title: str | None,
    snippet: str | None,
    similarity: float | int | None,
) -> dict:
    return {
        "type": source_type,
        "id": item_id,
        "title": title or "",
        "snippet": clip_snippet(snippet),
        "similarity": float(similarity) if similarity is not None else None,
    }


def faq_sources(faqs: list[dict]) -> list[dict]:
    """Build citation source dicts from retrieved FAQ rows."""
    return [
        _to_source_dict(
            "faq",
            faq.get("id"),
            faq.get("question"),
            faq.get("answer"),
            faq.get("similarity"),
        )
        for faq in faqs
    ]


def movie_sources(movies: list[dict]) -> list[dict]:
    """Build citation source dicts from vector-retrieved movie rows."""
    return [
        _to_source_dict(
            "movie",
            m.get("movie_id"),
            m.get("title"),
            m.get("synopsis"),
            m.get("similarity"),
        )
        for m in movies
    ]


async def _execute_vector_query(
    stmt: object,
    params: dict,
    db: AsyncSession | None,
) -> list[dict]:
    if db is not None:
        result = await db.execute(stmt, params)
        return [dict(row) for row in result.mappings().all()]
    async with SessionLocal() as session:
        result = await session.execute(stmt, params)
        return [dict(row) for row in result.mappings().all()]


async def search_faqs(
    query_embedding: list[float],
    limit: int = 2,
    db: AsyncSession | None = None,
    threshold: float | None = None,
    relative_margin: float | None = None,
) -> list[dict]:
    """Cosine similarity search over faq_embeddings (similarity >= threshold)."""
    if not query_embedding:
        return []
    sim_threshold = settings.FAQ_SIMILARITY_THRESHOLD if threshold is None else threshold
    margin = settings.FAQ_RELATIVE_MARGIN if relative_margin is None else relative_margin
    stmt = sql_text(
        """
        SELECT id, category, question, answer, metadata,
               1 - (embedding <=> CAST(:embedding AS vector)) AS similarity
        FROM faq_embeddings
        WHERE embedding IS NOT NULL
          AND 1 - (embedding <=> CAST(:embedding AS vector)) >= :threshold
        ORDER BY embedding <=> CAST(:embedding AS vector) ASC
        LIMIT :limit
        """
    )
    rows = await _execute_vector_query(
        stmt,
        {
            "embedding": vector_literal(query_embedding),
            "threshold": sim_threshold,
            "limit": limit,
        },
        db,
    )
    mapped = [
        {
            "id": row["id"],
            "category": row["category"],
            "question": row["question"],
            "answer": row["answer"],
            "metadata": row.get("metadata"),
            "similarity": float(row["similarity"]),
        }
        for row in rows
    ]
    return apply_relative_margin(mapped, margin)


async def search_movies_vector(
    query_embedding: list[float],
    limit: int = 3,
    db: AsyncSession | None = None,
    threshold: float = 0.65,
    relative_margin: float | None = None,
) -> list[dict]:
    """Cosine similarity search over movie_embeddings for semantic movie discovery."""
    if not query_embedding:
        return []
    margin = settings.MOVIE_RELATIVE_MARGIN if relative_margin is None else relative_margin
    stmt = sql_text(
        """
        SELECT movie_id, title, genres, synopsis, age_rating,
               1 - (embedding <=> CAST(:embedding AS vector)) AS similarity
        FROM movie_embeddings
        WHERE embedding IS NOT NULL
          AND 1 - (embedding <=> CAST(:embedding AS vector)) >= :threshold
        ORDER BY embedding <=> CAST(:embedding AS vector) ASC
        LIMIT :limit
        """
    )
    rows = await _execute_vector_query(
        stmt,
        {
            "embedding": vector_literal(query_embedding),
            "threshold": threshold,
            "limit": limit,
        },
        db,
    )
    mapped = [
        {
            "movie_id": row["movie_id"],
            "title": row["title"],
            "genres": row.get("genres"),
            "synopsis": row.get("synopsis"),
            "age_rating": row.get("age_rating"),
            "similarity": float(row["similarity"]),
        }
        for row in rows
    ]
    return apply_relative_margin(mapped, margin)


async def list_movie_titles(db: AsyncSession | None = None) -> list[str]:
    """Return all non-null movie titles stored in movie_embeddings."""
    stmt = sql_text("SELECT title FROM movie_embeddings WHERE title IS NOT NULL")
    try:
        rows = await _execute_vector_query(stmt, {}, db)
    except Exception as exc:
        logger.warning("Failed to list movie titles: %s", exc)
        return []
    return [str(row["title"]) for row in rows if row.get("title")]


def format_faq_context(faqs: list[dict]) -> str:
    """Format retrieved FAQ entries into a prompt-ready knowledge block."""
    blocks = []
    for faq in faqs:
        category = faq.get("category")
        prefix = f"[{category}] " if category else ""
        blocks.append(f"{prefix}Q: {faq['question']}\nA: {faq['answer']}")
    return "\n\n".join(blocks)


def select_faqs_for_language(faqs: list[dict], lang: str) -> list[dict]:
    """Prefer FAQ rows matching `lang`, falling back to all rows if none match."""
    if not faqs:
        return []
    target = (lang or "en").strip().lower()
    matched = [
        faq
        for faq in faqs
        if str((faq.get("metadata") or {}).get("lang", "en")).strip().lower() == target
    ]
    return matched if matched else faqs


def format_direct_faq_reply(faqs: list[dict]) -> str:
    """Format matched FAQ entries into a plain-text reply without LLM generation."""
    if not faqs:
        return ""
    valid = [faq for faq in faqs if str(faq.get("answer") or "").strip()]
    if not valid:
        return ""
    if len(valid) == 1:
        return str(valid[0].get("answer") or "").strip()
    blocks: list[str] = []
    for faq in valid:
        question = str(faq.get("question") or "").strip()
        answer = str(faq.get("answer") or "").strip()
        blocks.append(f"{question}\n{answer}".strip() if question else answer)
    return "\n\n".join(blocks)
