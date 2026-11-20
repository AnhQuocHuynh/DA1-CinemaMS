from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import UserContext
from app.services import (
    answer_guard,
    cache_service,
    guardrails,
    intent_router,
    llm_client,
    prompt_builder,
    rag_service,
    sanitizer,
    session_service,
)

_FOLLOW_UPS_BY_INTENT: dict[str, list[str]] = {
    "CINEMA_FAQ": [
        "What movies are showing today?",
        "What seat classes do you offer?",
    ],
    "SHOWTIME_QUERY": [
        "What is the ticket cancellation policy?",
        "What payment methods are accepted?",
    ],
    "MOVIE_QUERY": [
        "Show today's showtimes",
        "Recommend a movie for me",
    ],
    "ORDER_QUERY": [
        "Show today's showtimes",
        "What is the ticket cancellation policy?",
    ],
}

_FOLLOW_UPS_BY_INTENT_VI: dict[str, list[str]] = {
    "CINEMA_FAQ": [
        "Hôm nay đang chiếu những phim nào?",
        "Rạp có những loại ghế nào?",
    ],
    "SHOWTIME_QUERY": [
        "Chính sách hủy và hoàn vé như thế nào?",
        "Rạp chấp nhận những phương thức thanh toán nào?",
    ],
    "MOVIE_QUERY": [
        "Xem lịch chiếu hôm nay",
        "Gợi ý phim hay cho tôi",
    ],
    "ORDER_QUERY": [
        "Xem lịch chiếu hôm nay",
        "Chính sách hủy và hoàn vé như thế nào?",
    ],
}


def get_redis(request: Request) -> Any:
    app = getattr(request, "app", None)
    state = getattr(app, "state", None)
    return getattr(state, "redis", None)


def suggested_follow_ups(intent: str | None, lang: str = "en") -> list[str]:
    if not intent:
        return []
    mapping = _FOLLOW_UPS_BY_INTENT_VI if lang == "vi" else _FOLLOW_UPS_BY_INTENT
    return list(mapping.get(intent, []))


def offline_grounded_reply(knowledge: str | None, lang: str = "en") -> str:
    if knowledge:
        if lang == "vi":
            return (
                "Hiện tôi đang hoạt động ở chế độ ngoại tuyến (offline mode). "
                "Dưới đây là thông tin từ hệ thống rạp:\n\n"
                f"{knowledge}"
            )
        return (
            "I'm currently operating in offline mode. "
            "Here is the relevant information from our cinema knowledge base:\n\n"
            f"{knowledge}"
        )
    return llm_client.OFFLINE_FALLBACK_MESSAGE_VI if lang == "vi" else llm_client.OFFLINE_FALLBACK_MESSAGE


@dataclass
class PreparedChatTurn:
    session_id: UUID
    immediate_reply: str | None = None
    cached: bool = False
    intent: str | None = None
    query_embedding: list[float] | None = None
    knowledge: str | None = None
    sources: list[dict] = field(default_factory=list)
    prompt: str | None = None
    follow_ups: list[str] = field(default_factory=list)
    history_text: str = ""
    guarded: bool = False


async def prepare_chat_turn(
    message: str,
    user: UserContext,
    db: AsyncSession | None,
    redis: Any,
    session_id: UUID | None = None,
) -> PreparedChatTurn:
    """Run guardrails, L1/L2 cache checks, intent routing, and prompt assembly."""
    guardrails.validate_length(message)
    lang = guardrails.detect_language(message)
    resolved_session_id = await session_service.ensure_session(
        db, user, session_id=session_id, title_hint=message[:80]
    )

    if guardrails.is_injection(message):
        refusal = guardrails.get_refusal_message(message)
        await session_service.append_exchange(
            db, resolved_session_id, message, refusal, cached=False
        )
        return PreparedChatTurn(
            session_id=resolved_session_id,
            immediate_reply=refusal,
            cached=False,
            intent="ADVERSARIAL",
        )

    exact_hit = await cache_service.get_exact(redis, message)
    if exact_hit is not None:
        clean_hit = sanitizer.sanitize_output(exact_hit)
        await session_service.append_exchange(
            db, resolved_session_id, message, clean_hit, cached=True
        )
        return PreparedChatTurn(
            session_id=resolved_session_id,
            immediate_reply=clean_hit,
            cached=True,
            follow_ups=suggested_follow_ups("CINEMA_FAQ", lang=lang),
        )

    query_embedding = await llm_client.embed(message)
    semantic_hit = await cache_service.get_semantic(db, query_embedding, text=message)
    if semantic_hit is not None:
        clean_hit = sanitizer.sanitize_output(semantic_hit)
        await cache_service.set_exact(redis, message, clean_hit)
        await session_service.append_exchange(
            db, resolved_session_id, message, clean_hit, cached=True
        )
        return PreparedChatTurn(
            session_id=resolved_session_id,
            immediate_reply=clean_hit,
            cached=True,
            query_embedding=query_embedding,
            follow_ups=suggested_follow_ups("CINEMA_FAQ", lang=lang),
        )

    intent = await guardrails.classify_intent(message)
    if intent in ("OFF_TOPIC", "ADVERSARIAL"):
        refusal = guardrails.get_refusal_message(message)
        await session_service.append_exchange(
            db, resolved_session_id, message, refusal, cached=False
        )
        return PreparedChatTurn(
            session_id=resolved_session_id,
            immediate_reply=refusal,
            cached=False,
            intent=intent,
        )

    knowledge, sources = await intent_router.build_context_and_sources(
        intent, message, user=user, db=db, query_embedding=query_embedding
    )
    if intent in ("CINEMA_FAQ", "MOVIE_QUERY") and not knowledge:
        refusal = guardrails.get_refusal_message(message)
        await session_service.append_exchange(
            db, resolved_session_id, message, refusal, cached=False
        )
        return PreparedChatTurn(
            session_id=resolved_session_id,
            immediate_reply=refusal,
            cached=False,
            intent=intent,
            query_embedding=query_embedding,
        )

    history = await session_service.get_recent_history(db, resolved_session_id)
    history_text = " ".join(
        str(item.get("content") or "") for item in history if item.get("content")
    )
    prompt = prompt_builder.build_prompt(message, knowledge=knowledge, history=history)
    return PreparedChatTurn(
        session_id=resolved_session_id,
        intent=intent,
        query_embedding=query_embedding,
        knowledge=knowledge,
        sources=sources,
        prompt=prompt,
        follow_ups=suggested_follow_ups(intent, lang=lang),
        history_text=history_text,
    )


async def finalize_chat_turn(
    prepared: PreparedChatTurn,
    message: str,
    raw_reply: str,
    db: AsyncSession | None,
    redis: Any,
) -> str:
    """Sanitize, guard, cache (L1/L2), and persist a newly generated assistant reply."""
    lang = guardrails.detect_language(message)
    reply = raw_reply
    is_offline = reply == llm_client.OFFLINE_FALLBACK_MESSAGE
    if is_offline:
        reply = offline_grounded_reply(prepared.knowledge, lang=lang)
    else:
        allowed_text = " ".join(
            part
            for part in (prepared.knowledge or "", message, prepared.history_text)
            if part
        )
        titles = await rag_service.list_movie_titles(db)
        refusal = guardrails.get_refusal_message(message)
        guarded_reply = answer_guard.guard_answer(reply, allowed_text, titles, refusal)
        if guarded_reply == refusal:
            prepared.guarded = True
            prepared.sources = []
            await session_service.append_exchange(
                db, prepared.session_id, message, refusal, cached=False
            )
            return refusal
        reply = guarded_reply

    clean_reply = sanitizer.sanitize_output(reply)
    is_private_order = prepared.intent == "ORDER_QUERY" or intent_router.wants_orders(message)
    if not is_offline and not is_private_order:
        await cache_service.set_exact(redis, message, clean_reply)
        if prepared.query_embedding:
            await cache_service.set_semantic(
                db, message, prepared.query_embedding, clean_reply
            )
    await session_service.append_exchange(
        db, prepared.session_id, message, clean_reply, cached=False
    )
    return clean_reply
