from dataclasses import dataclass, field
import inspect
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

_GUEST_FAQ_FOLLOW_UPS: list[str] = [
    "What is the ticket cancellation and refund policy?",
    "What seat classes and screening room types are available?",
]

_GUEST_FAQ_FOLLOW_UPS_VI: list[str] = [
    "Chính sách hủy và hoàn vé như thế nào?",
    "Rạp có những loại ghế và phòng chiếu nào?",
]


def get_redis(request: Request) -> Any:
    app = getattr(request, "app", None)
    state = getattr(app, "state", None)
    return getattr(state, "redis", None)


def suggested_follow_ups(
    intent: str | None, lang: str = "en", authenticated: bool = True
) -> list[str]:
    if not authenticated:
        if intent in (None, "OFF_TOPIC", "ADVERSARIAL"):
            return []
        return list(_GUEST_FAQ_FOLLOW_UPS_VI if lang == "vi" else _GUEST_FAQ_FOLLOW_UPS)
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
    session_id: UUID | None = None
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
    lang: str = "en"


async def _prepare_guest_faq_turn(
    message: str,
    db: AsyncSession | None,
    redis: Any,
    preferred_lang: str | None = None,
) -> PreparedChatTurn:
    """Handle anonymous visitors in stateless Direct RAG FAQ mode without LLM generation."""
    lang = guardrails.detect_language(message, preferred_lang=preferred_lang)
    guest_follow_ups = suggested_follow_ups("CINEMA_FAQ", lang=lang, authenticated=False)

    if guardrails.is_injection(message):
        return PreparedChatTurn(
            session_id=None,
            immediate_reply=guardrails.get_refusal_message(message, preferred_lang=lang),
            cached=False,
            intent="ADVERSARIAL",
            lang=lang,
        )

    small_talk = guardrails.match_small_talk(
        message, authenticated=False, preferred_lang=lang
    )
    if small_talk is not None:
        return PreparedChatTurn(
            session_id=None,
            immediate_reply=small_talk,
            cached=False,
            intent="CINEMA_FAQ",
            follow_ups=guest_follow_ups,
            lang=lang,
        )

    intent = guardrails.classify_intent_heuristic(message)
    if intent in ("ORDER_QUERY", "SHOWTIME_QUERY", "MOVIE_QUERY"):
        return PreparedChatTurn(
            session_id=None,
            immediate_reply=guardrails.get_guest_login_required_message(
                message, preferred_lang=lang
            ),
            cached=False,
            intent=intent,
            follow_ups=guest_follow_ups,
            lang=lang,
        )

    if intent in ("OFF_TOPIC", "ADVERSARIAL"):
        return PreparedChatTurn(
            session_id=None,
            immediate_reply=guardrails.get_refusal_message(message, preferred_lang=lang),
            cached=False,
            intent=intent,
            lang=lang,
        )

    cached_faq = await cache_service.get_faq_exact(redis, message)
    if cached_faq is not None:
        cached_reply, cached_sources = cached_faq
        return PreparedChatTurn(
            session_id=None,
            immediate_reply=sanitizer.sanitize_output(cached_reply),
            cached=True,
            intent="CINEMA_FAQ",
            sources=cached_sources,
            follow_ups=guest_follow_ups,
            lang=lang,
        )

    query_embedding = await llm_client.embed(message)
    raw_faqs = await rag_service.search_faqs(query_embedding, limit=2, db=db)
    faqs = rag_service.select_faqs_for_language(raw_faqs, lang)
    if not faqs:
        return PreparedChatTurn(
            session_id=None,
            immediate_reply=guardrails.get_guest_faq_not_found_message(
                message, preferred_lang=lang
            ),
            cached=False,
            intent="CINEMA_FAQ",
            query_embedding=query_embedding,
            follow_ups=guest_follow_ups,
            lang=lang,
        )

    direct_reply = sanitizer.sanitize_output(rag_service.format_direct_faq_reply(faqs))
    sources = rag_service.faq_sources(faqs)
    await cache_service.set_faq_exact(redis, message, direct_reply, sources=sources)
    return PreparedChatTurn(
        session_id=None,
        immediate_reply=direct_reply,
        cached=False,
        intent="CINEMA_FAQ",
        query_embedding=query_embedding,
        sources=sources,
        follow_ups=guest_follow_ups,
        lang=lang,
    )


async def prepare_chat_turn(
    message: str,
    user: UserContext,
    db: AsyncSession | None,
    redis: Any,
    session_id: UUID | None = None,
    preferred_lang: str | None = None,
) -> PreparedChatTurn:
    """Run guardrails, L1/L2 cache checks, intent routing, and prompt assembly."""
    guardrails.validate_length(message)
    if not user.is_authenticated:
        return await _prepare_guest_faq_turn(
            message, db=db, redis=redis, preferred_lang=preferred_lang
        )
    lang = guardrails.detect_language(message, preferred_lang=preferred_lang)
    resolved_session_id = await session_service.ensure_session(
        db, user, session_id=session_id, title_hint=message[:80]
    )

    if guardrails.is_injection(message):
        refusal = guardrails.get_refusal_message(message, preferred_lang=lang)
        await session_service.append_exchange(
            db, resolved_session_id, message, refusal, cached=False
        )
        return PreparedChatTurn(
            session_id=resolved_session_id,
            immediate_reply=refusal,
            cached=False,
            intent="ADVERSARIAL",
            lang=lang,
        )

    small_talk = guardrails.match_small_talk(
        message, authenticated=True, preferred_lang=lang
    )
    if small_talk is not None:
        await session_service.append_exchange(
            db, resolved_session_id, message, small_talk, cached=False
        )
        return PreparedChatTurn(
            session_id=resolved_session_id,
            immediate_reply=small_talk,
            cached=False,
            intent="CINEMA_FAQ",
            follow_ups=suggested_follow_ups("CINEMA_FAQ", lang=lang),
            lang=lang,
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
            lang=lang,
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
            lang=lang,
        )

    intent = await guardrails.classify_intent(message)
    if intent in ("OFF_TOPIC", "ADVERSARIAL"):
        refusal = guardrails.get_refusal_message(message, preferred_lang=lang)
        await session_service.append_exchange(
            db, resolved_session_id, message, refusal, cached=False
        )
        return PreparedChatTurn(
            session_id=resolved_session_id,
            immediate_reply=refusal,
            cached=False,
            intent=intent,
            lang=lang,
        )

    context_kwargs: dict[str, Any] = {
        "user": user,
        "db": db,
        "query_embedding": query_embedding,
    }
    sig_params = inspect.signature(intent_router.build_context_and_sources).parameters
    if "preferred_lang" in sig_params or any(
        p.kind == inspect.Parameter.VAR_KEYWORD for p in sig_params.values()
    ):
        context_kwargs["preferred_lang"] = lang
    knowledge, sources = await intent_router.build_context_and_sources(
        intent,
        message,
        **context_kwargs,
    )
    if intent in ("CINEMA_FAQ", "MOVIE_QUERY") and not knowledge:
        refusal = guardrails.get_refusal_message(message, preferred_lang=lang)
        await session_service.append_exchange(
            db, resolved_session_id, message, refusal, cached=False
        )
        return PreparedChatTurn(
            session_id=resolved_session_id,
            immediate_reply=refusal,
            cached=False,
            intent=intent,
            query_embedding=query_embedding,
            lang=lang,
        )

    history = await session_service.get_recent_history(db, resolved_session_id)
    history_text = " ".join(
        str(item.get("content") or "") for item in history if item.get("content")
    )
    prompt = prompt_builder.build_prompt(
        message, knowledge=knowledge, history=history, preferred_lang=lang
    )
    return PreparedChatTurn(
        session_id=resolved_session_id,
        intent=intent,
        query_embedding=query_embedding,
        knowledge=knowledge,
        sources=sources,
        prompt=prompt,
        follow_ups=suggested_follow_ups(intent, lang=lang),
        history_text=history_text,
        lang=lang,
    )


async def finalize_chat_turn(
    prepared: PreparedChatTurn,
    message: str,
    raw_reply: str,
    db: AsyncSession | None,
    redis: Any,
    preferred_lang: str | None = None,
) -> str:
    """Sanitize, guard, cache (L1/L2), and persist a newly generated assistant reply."""
    lang = guardrails.detect_language(message, preferred_lang=preferred_lang or prepared.lang)
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
        refusal = guardrails.get_refusal_message(message, preferred_lang=lang)
        guarded_reply = answer_guard.guard_answer(reply, allowed_text, titles, refusal)
        if guarded_reply == refusal:
            prepared.guarded = True
            prepared.sources = []
            if prepared.session_id is not None:
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
    if prepared.session_id is not None:
        await session_service.append_exchange(
            db, prepared.session_id, message, clean_reply, cached=False
        )
    return clean_reply
