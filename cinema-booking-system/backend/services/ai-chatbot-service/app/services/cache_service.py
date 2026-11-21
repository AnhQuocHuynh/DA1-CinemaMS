import hashlib
import json
import logging
import re
from typing import Any

from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings

logger = logging.getLogger("cinebot.cache")

BYPASS_KEYWORDS = (
    "today",
    "tonight",
    "now",
    "seats left",
    "order #",
    "booking",
    "my order",
    "my orders",
    "my ticket",
    "my tickets",
    "my booking",
    "my bookings",
    "order status",
    "order history",
    "hôm nay",
    "tối nay",
    "bây giờ",
    "hiện tại",
    "còn ghế",
    "mã đơn",
    "đặt vé",
    "vé của tôi",
    "vé của mình",
    "vé đã đặt",
    "đơn hàng",
    "đơn đặt vé",
    "lịch sử đặt vé",
    "ve cua toi",
    "ve cua minh",
    "ve da dat",
    "don hang",
    "don dat ve",
    "lich su dat ve",
    "ma don",
)
_PREFIXES = re.compile(
    r"^(hi|hello|please tell me|xin chào|chào bạn|cho tôi hỏi|cho mình hỏi)\b\s*",
    re.IGNORECASE,
)


def normalize(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]", "", text)
    text = _PREFIXES.sub("", text)
    return re.sub(r"\s+", " ", text).strip()


def exact_key(text: str) -> str:
    return "cache:chat:exact:" + hashlib.sha256(normalize(text).encode()).hexdigest()


def faq_exact_key(text: str) -> str:
    return "cache:chat:faq:exact:" + hashlib.sha256(normalize(text).encode()).hexdigest()


def query_hash(text: str) -> str:
    return hashlib.sha256(normalize(text).encode()).hexdigest()


def should_bypass(text: str) -> bool:
    lowered = text.lower()
    return any(k in lowered for k in BYPASS_KEYWORDS)


def vector_literal(embedding: list[float]) -> str:
    """Format a float list as a pgvector literal string '[v1,v2,...]'."""
    return "[" + ",".join(f"{float(v):.8f}" for v in embedding) + "]"


async def get_exact(redis_client: Any, text: str) -> str | None:
    """Look up an exact normalized response in L1 Redis cache."""
    if redis_client is None or should_bypass(text):
        return None
    try:
        value = await redis_client.get(exact_key(text))
        if isinstance(value, bytes):
            return value.decode("utf-8")
        return value
    except Exception:
        logger.warning("Redis exact cache lookup failed", exc_info=True)
        return None


async def set_exact(
    redis_client: Any,
    text: str,
    response_text: str,
    ttl_seconds: int | None = None,
) -> bool:
    """Store a response in L1 Redis cache with TTL."""
    if redis_client is None or should_bypass(text) or not response_text:
        return False
    ttl = settings.EXACT_CACHE_TTL_SECONDS if ttl_seconds is None else ttl_seconds
    try:
        await redis_client.setex(exact_key(text), ttl, response_text)
        return True
    except Exception:
        logger.warning("Redis exact cache write failed", exc_info=True)
        return False


async def get_faq_exact(redis_client: Any, text: str) -> tuple[str, list[dict]] | None:
    """Look up a direct FAQ response and citations in the isolated guest FAQ L1 cache."""
    if redis_client is None:
        return None
    try:
        value = await redis_client.get(faq_exact_key(text))
        if value is None:
            return None
        if isinstance(value, bytes):
            value = value.decode("utf-8")
        payload = json.loads(value)
        if not isinstance(payload, dict):
            return None
        reply = payload.get("reply")
        sources = payload.get("sources")
        if not isinstance(reply, str) or not reply:
            return None
        clean_sources = (
            [s for s in sources if isinstance(s, dict)] if isinstance(sources, list) else []
        )
        return reply, clean_sources
    except Exception:
        logger.warning("Redis guest FAQ cache lookup failed", exc_info=True)
        return None


async def set_faq_exact(
    redis_client: Any,
    text: str,
    response_text: str,
    sources: list[dict] | None = None,
    ttl_seconds: int | None = None,
) -> bool:
    """Store a direct FAQ response and citations in the isolated guest FAQ L1 cache."""
    if redis_client is None or not response_text:
        return False
    ttl = settings.EXACT_CACHE_TTL_SECONDS if ttl_seconds is None else ttl_seconds
    payload = json.dumps({"reply": response_text, "sources": sources or []})
    try:
        await redis_client.setex(faq_exact_key(text), ttl, payload)
        return True
    except Exception:
        logger.warning("Redis guest FAQ cache write failed", exc_info=True)
        return False


async def get_semantic(
    db: AsyncSession | None,
    query_embedding: list[float],
    text: str | None = None,
    threshold: float | None = None,
) -> str | None:
    """Look up a semantically similar cached response in L2 pgvector cache."""
    if db is None or not query_embedding or (text is not None and should_bypass(text)):
        return None
    sim_threshold = settings.SEMANTIC_CACHE_THRESHOLD if threshold is None else threshold
    vec = vector_literal(query_embedding)
    select_stmt = sql_text(
        """
        SELECT id, response_text,
               1 - (embedding <=> CAST(:embedding AS vector)) AS similarity
        FROM semantic_cache
        WHERE expires_at > NOW()
          AND 1 - (embedding <=> CAST(:embedding AS vector)) >= :threshold
        ORDER BY embedding <=> CAST(:embedding AS vector) ASC
        LIMIT 1
        """
    )
    update_stmt = sql_text(
        "UPDATE semantic_cache SET hit_count = hit_count + 1 WHERE id = :id"
    )
    try:
        result = await db.execute(
            select_stmt, {"embedding": vec, "threshold": sim_threshold}
        )
        row = result.mappings().first()
        if not row:
            return None
        await db.execute(update_stmt, {"id": row["id"]})
        await db.commit()
        return row["response_text"]
    except Exception:
        logger.warning("Semantic cache lookup failed", exc_info=True)
        return None


async def set_semantic(
    db: AsyncSession | None,
    text: str,
    query_embedding: list[float],
    response_text: str,
    ttl_days: int | None = None,
) -> bool:
    """Store a query embedding and response in L2 pgvector semantic cache."""
    if db is None or should_bypass(text) or not query_embedding or not response_text:
        return False
    days = settings.SEMANTIC_CACHE_TTL_DAYS if ttl_days is None else ttl_days
    stmt = sql_text(
        """
        INSERT INTO semantic_cache
            (query_hash, query_text, response_text, embedding, hit_count, expires_at)
        VALUES
            (:query_hash, :query_text, :response_text, CAST(:embedding AS vector),
             0, NOW() + (:ttl_days * INTERVAL '1 day'))
        """
    )
    try:
        await db.execute(
            stmt,
            {
                "query_hash": query_hash(text),
                "query_text": text,
                "response_text": response_text,
                "embedding": vector_literal(query_embedding),
                "ttl_days": days,
            },
        )
        await db.commit()
        return True
    except Exception:
        logger.warning("Semantic cache write failed", exc_info=True)
        return False
