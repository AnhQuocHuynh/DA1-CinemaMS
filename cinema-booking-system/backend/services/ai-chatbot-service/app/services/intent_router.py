import re

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import UserContext
from app.services import answer_guard, downstream_client, guardrails, llm_client, rag_service

_ORDER_PHRASES = (
    "my order",
    "my orders",
    "my ticket",
    "my tickets",
    "my booking",
    "my bookings",
    "order status",
    "order history",
    "ve cua toi",
    "ve cua minh",
    "ve da dat",
    "don hang",
    "don dat ve",
    "lich su dat ve",
    "ma don",
)

_BK_ID_RE = re.compile(r"(?:^|[\s,(])#?bk-?(\d+)\b")
_KEYWORD_ORDER_ID_RE = re.compile(
    r"\b(?:order|booking|don(?:\s+hang|\s+dat\s+ve)?|ma\s+don(?:\s+hang)?|ma\s+dat\s+ve)"
    r"\s*(?:id|no\.?|number|so)?\s*#?\s*(\d+)\b"
)
_HASH_CONTEXT_RE = re.compile(
    r"\b(?:order|orders|booking|bookings|ticket|tickets|status|payment"
    r"|don|ve|trang\s+thai|thanh\s+toan|kiem\s+tra|check)\b"
)
_HASH_ID_RE = re.compile(r"(?:^|[\s,(])#(\d+)\b")

_STOP_WORDS = {
    "what",
    "time",
    "times",
    "is",
    "are",
    "showing",
    "playing",
    "today",
    "tonight",
    "now",
    "showtime",
    "showtimes",
    "schedule",
    "for",
    "movie",
    "movies",
    "film",
    "films",
    "tell",
    "me",
    "about",
    "the",
    "a",
    "an",
    "at",
    "in",
    "on",
    "of",
    "recommend",
    "recommended",
    "suggest",
    "suggestion",
    "please",
    "any",
    "when",
    "where",
    "can",
    "you",
    "find",
    "lịch",
    "suất",
    "chiếu",
    "phim",
    "bộ",
    "hôm",
    "nay",
    "tối",
    "bây",
    "giờ",
    "mấy",
    "có",
    "những",
    "nào",
    "đang",
    "ở",
    "tại",
    "rạp",
    "cho",
    "tôi",
    "mình",
    "bạn",
    "hỏi",
    "về",
    "của",
    "là",
    "gì",
    "như",
    "thế",
    "hãy",
    "gợi",
    "ý",
    "đề",
    "xuất",
    "nội",
    "dung",
    "tóm",
    "tắt",
    "kể",
}


def _extract_movie_keyword(message: str) -> str:
    cleaned = re.sub(r"[^\w\s]", " ", message)
    tokens = [tok for tok in cleaned.split() if tok.lower() not in _STOP_WORDS]
    return " ".join(tokens).strip()


def _format_showtimes(showtimes: list[dict]) -> str:
    if not showtimes:
        return (
            "No active showtimes were found for that query. "
            "Invite the user to check live schedules at [Browse Movies](/movies)."
        )
    lines = ["Available showtimes:"]
    for st in showtimes:
        title = st.get("displayTitle") or st.get("eventName") or "Movie"
        start = st.get("startTime") or "TBD"
        cinema = st.get("cinemaName") or "Cinema"
        room = st.get("roomName") or f"Room {st.get('roomId', '')}".strip()
        price = st.get("basePrice")
        price_part = f", Price: {price}" if price is not None else ""
        sid = st.get("id")
        link = f"[Book Now](/booking/showtimes/{sid})" if sid is not None else ""
        lines.append(f"- {title}: {start} ({cinema} - {room}{price_part}) {link}".strip())
    return "\n".join(lines)


def _format_release_date(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, (list, tuple)) and len(value) >= 3:
        try:
            return f"{int(value[0]):04d}-{int(value[1]):02d}-{int(value[2]):02d}"
        except (TypeError, ValueError):
            return ""
    if hasattr(value, "isoformat"):
        return str(value.isoformat())
    return str(value).strip()


def _movie_details(m: dict) -> str:
    parts: list[str] = []
    director = str(m.get("director") or "").strip()
    if director:
        parts.append(f"Director: {director}")

    raw_actors = m.get("actors")
    if isinstance(raw_actors, list):
        actors_text = ", ".join(str(a).strip() for a in raw_actors if str(a).strip())
    else:
        actors_text = str(raw_actors or "").strip()
    if actors_text:
        parts.append(f"Cast: {rag_service.clip_snippet(actors_text, max_len=200)}")

    raw_imdb = m.get("imdb_rating")
    if raw_imdb is None:
        raw_imdb = m.get("imdbRating")
    if raw_imdb is not None and not isinstance(raw_imdb, bool):
        try:
            parts.append(f"IMDb: {float(raw_imdb):g}/10")
        except (TypeError, ValueError):
            pass

    raw_release = m.get("release_date")
    if raw_release is None:
        raw_release = m.get("releaseDate")
    release_str = _format_release_date(raw_release)
    if release_str:
        parts.append(f"Released: {release_str}")

    region = str(m.get("region") or "").strip()
    if region:
        parts.append(f"Region: {region}")

    language = str(m.get("language") or "").strip()
    if language:
        parts.append(f"Language: {language}")

    raw_duration = m.get("duration_minutes")
    if raw_duration is None:
        raw_duration = m.get("durationMinutes")
    if raw_duration is not None and not isinstance(raw_duration, bool):
        try:
            parts.append(f"Runtime: {int(raw_duration)} min")
        except (TypeError, ValueError):
            pass

    return " | ".join(parts)


def _format_movies(movies: list[dict], recs: list[dict]) -> str | None:
    sections: list[str] = []
    if movies:
        lines = ["Matching movies:"]
        for m in movies:
            title = m.get("title") or "Untitled"
            genres = m.get("genres")
            if isinstance(genres, list):
                genres = ", ".join(str(g) for g in genres)
            rating = m.get("ageRating") or m.get("age_rating") or ""
            synopsis = m.get("synopsis") or m.get("aiSummary") or m.get("description") or ""
            meta = " | ".join(part for part in (genres, rating) if part)
            header = f"- {title} ({meta})" if meta else f"- {title}"
            lines.append(f"{header}: {synopsis}".strip(": "))
            details = _movie_details(m)
            if details:
                lines.append(f"  Details: {details}")
        sections.append("\n".join(lines))

    if recs:
        lines = ["Recommended movies:"]
        for r in recs:
            title = r.get("title") or "Movie"
            reason = r.get("reason") or ""
            score = r.get("relevanceScore")
            detail = f" — {reason}" if reason else ""
            if score is not None and not detail:
                detail = f" (score: {score})"
            lines.append(f"- {title}{detail}")
        sections.append("\n".join(lines))

    return "\n\n".join(sections) if sections else None


def extract_order_ids(message: str, *, max_ids: int = 5) -> list[int]:
    """Extract deduplicated positive booking/order IDs mentioned in message."""
    folded = answer_guard.fold(message)
    if not folded or max_ids <= 0:
        return []

    matches: list[tuple[int, int]] = []
    for pattern in (_BK_ID_RE, _KEYWORD_ORDER_ID_RE):
        for match in pattern.finditer(folded):
            matches.append((match.start(1), int(match.group(1))))

    if _HASH_CONTEXT_RE.search(folded):
        for match in _HASH_ID_RE.finditer(folded):
            matches.append((match.start(1), int(match.group(1))))

    matches.sort(key=lambda item: item[0])
    seen: set[int] = set()
    ordered_ids: list[int] = []
    for _, oid in matches:
        if oid <= 0 or oid in seen:
            continue
        seen.add(oid)
        ordered_ids.append(oid)
        if len(ordered_ids) >= max_ids:
            break
    return ordered_ids


def wants_orders(message: str) -> bool:
    """Return True if the user message asks about their personal ticket orders or bookings."""
    folded = answer_guard.fold(message)
    if not folded:
        return False
    return any(phrase in folded for phrase in _ORDER_PHRASES) or bool(
        extract_order_ids(message)
    )


def _format_orders(
    orders: list[dict],
    lang: str = "en",
    missing_ids: list[int] | None = None,
) -> str:
    missing = [oid for oid in (missing_ids or []) if oid > 0]
    if not orders:
        if missing:
            missing_list = ", ".join(f"#{oid}" for oid in missing)
            if lang == "vi":
                return (
                    "Không tìm thấy đơn đặt vé phù hợp thuộc tài khoản của bạn cho: "
                    f"{missing_list}."
                )
            return (
                "No matching ticket order was found under your account for: "
                f"{missing_list}."
            )
        if lang == "vi":
            return "Bạn hiện chưa có đơn đặt vé nào trong hệ thống."
        return "You currently have no ticket orders on file."

    header = "Đơn đặt vé của bạn:" if lang == "vi" else "Your ticket orders:"
    lines = [header]
    for order in orders:
        oid = order.get("id")
        title = (
            order.get("displayTitle")
            or order.get("movieTitle")
            or order.get("eventTitle")
            or ("Vé xem phim" if lang == "vi" else "Ticket Order")
        )
        start = order.get("startTime") or "TBD"
        cinema = order.get("cinemaName") or ""
        room = order.get("roomName") or ""
        status = order.get("status") or "UNKNOWN"
        seat_labels = order.get("seatLabels")
        if isinstance(seat_labels, list):
            seats = ", ".join(str(s) for s in seat_labels if s)
        else:
            seats = str(seat_labels or "")
        final_amount = order.get("finalAmount")

        venue = " - ".join(part for part in (cinema, room) if part)
        details: list[str] = [f"{title} ({start})"]
        if venue:
            details.append(venue)
        if seats:
            details.append(f"Ghế: {seats}" if lang == "vi" else f"Seats: {seats}")
        details.append(f"Trạng thái: {status}" if lang == "vi" else f"Status: {status}")
        if final_amount is not None:
            details.append(f"Tổng: {final_amount}" if lang == "vi" else f"Total: {final_amount}")
        prefix = f"- Đơn #{oid}: " if lang == "vi" else f"- Order #{oid}: "
        lines.append(prefix + " | ".join(details))
    if missing:
        missing_list = ", ".join(f"#{oid}" for oid in missing)
        if lang == "vi":
            lines.append(
                f"Không tìm thấy đơn hàng thuộc tài khoản của bạn: {missing_list}."
            )
        else:
            lines.append(f"Orders not found under your account: {missing_list}.")
    return "\n".join(lines)


async def _fetch_orders_for_message(
    message: str, user: UserContext
) -> tuple[list[dict], list[int]]:
    requested_ids = extract_order_ids(message)
    if requested_ids:
        found: list[dict] = []
        missing: list[int] = []
        for oid in requested_ids:
            order = await downstream_client.get_order_by_id(
                oid, user_id=user.user_id, auth_token=user.raw_token
            )
            if isinstance(order, dict):
                found.append(order)
            else:
                missing.append(oid)
        return found, missing

    orders = await downstream_client.get_user_orders(
        user.user_id, auth_token=user.raw_token
    )
    return orders, []


async def build_context_and_sources(
    intent: str,
    message: str,
    user: UserContext | None = None,
    db: AsyncSession | None = None,
    query_embedding: list[float] | None = None,
    preferred_lang: str | None = None,
) -> tuple[str | None, list[dict]]:
    """Assemble grounded <retrieved_knowledge> context and citation sources."""
    lang = guardrails.detect_language(message, preferred_lang=preferred_lang)

    if intent == "ORDER_QUERY":
        if user is None or not user.can_lookup_bookings:
            msg = (
                "Vui lòng đăng nhập để kiểm tra đơn hàng và vé của bạn."
                if lang == "vi"
                else "Please sign in to view your ticket orders and booking status."
            )
            return msg, []
        orders, missing_ids = await _fetch_orders_for_message(message, user)
        return _format_orders(orders, lang=lang, missing_ids=missing_ids), []

    ctx: str | None = None
    sources: list[dict] = []

    if intent == "CINEMA_FAQ":
        emb = query_embedding or await llm_client.embed(message)
        faqs = await rag_service.search_faqs(emb, limit=2, db=db)
        if faqs:
            ctx = rag_service.format_faq_context(faqs)
            sources = rag_service.faq_sources(faqs)

    elif intent == "SHOWTIME_QUERY":
        keyword = _extract_movie_keyword(message)
        if keyword:
            movies = await downstream_client.search_movies(keyword)
            if not movies or movies[0].get("id") is None:
                ctx = _format_showtimes([])
            else:
                showtimes = await downstream_client.get_today_showtimes(
                    movie_id=movies[0]["id"]
                )
                ctx = _format_showtimes(showtimes)
        else:
            showtimes = await downstream_client.get_today_showtimes(movie_id=None)
            ctx = _format_showtimes(showtimes)

    elif intent == "MOVIE_QUERY":
        emb = query_embedding or await llm_client.embed(message)
        vector_movies = await rag_service.search_movies_vector(emb, limit=3, db=db)
        if vector_movies:
            movies = vector_movies
            sources = rag_service.movie_sources(vector_movies)
        else:
            keyword = _extract_movie_keyword(message)
            movies = await downstream_client.search_movies(keyword)
            sources = [
                {
                    "type": "movie",
                    "id": m.get("id"),
                    "title": m.get("title") or "",
                    "snippet": rag_service.clip_snippet(
                        m.get("description") or m.get("synopsis") or m.get("aiSummary") or ""
                    ),
                    "similarity": None,
                }
                for m in movies
            ]

        lowered = message.lower()
        recs: list[dict] = []
        if any(term in lowered for term in ("recommend", "suggest", "gợi ý", "đề xuất")):
            recs = await downstream_client.get_user_recommendations(
                user.user_id if user else None,
                auth_token=user.raw_token if user else None,
            )
        ctx = _format_movies(movies, recs)

    if wants_orders(message) and user is not None and user.can_lookup_bookings:
        orders, missing_ids = await _fetch_orders_for_message(message, user)
        if orders or missing_ids:
            orders_text = _format_orders(orders, lang=lang, missing_ids=missing_ids)
            ctx = f"{ctx}\n\n{orders_text}" if ctx else orders_text

    return ctx, sources


async def build_context(
    intent: str,
    message: str,
    user: UserContext | None = None,
    db: AsyncSession | None = None,
    query_embedding: list[float] | None = None,
    preferred_lang: str | None = None,
) -> str | None:
    """Assemble grounded <retrieved_knowledge> context based on classified intent."""
    context, _ = await build_context_and_sources(
        intent,
        message,
        user=user,
        db=db,
        query_embedding=query_embedding,
        preferred_lang=preferred_lang,
    )
    return context
