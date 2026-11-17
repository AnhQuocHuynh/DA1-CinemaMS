import re

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import UserContext
from app.services import downstream_client, llm_client, rag_service

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


async def build_context_and_sources(
    intent: str,
    message: str,
    user: UserContext | None = None,
    db: AsyncSession | None = None,
    query_embedding: list[float] | None = None,
) -> tuple[str | None, list[dict]]:
    """Assemble grounded <retrieved_knowledge> context and citation sources."""
    if intent == "CINEMA_FAQ":
        emb = query_embedding or await llm_client.embed(message)
        faqs = await rag_service.search_faqs(emb, limit=2, db=db)
        if not faqs:
            return None, []
        return rag_service.format_faq_context(faqs), rag_service.faq_sources(faqs)

    if intent == "SHOWTIME_QUERY":
        keyword = _extract_movie_keyword(message)
        if keyword:
            movies = await downstream_client.search_movies(keyword)
            if not movies or movies[0].get("id") is None:
                return _format_showtimes([]), []
            showtimes = await downstream_client.get_today_showtimes(movie_id=movies[0]["id"])
        else:
            showtimes = await downstream_client.get_today_showtimes(movie_id=None)
        return _format_showtimes(showtimes), []

    if intent == "MOVIE_QUERY":
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
                user.user_id if user else None
            )
        return _format_movies(movies, recs), sources

    return None, []


async def build_context(
    intent: str,
    message: str,
    user: UserContext | None = None,
    db: AsyncSession | None = None,
    query_embedding: list[float] | None = None,
) -> str | None:
    """Assemble grounded <retrieved_knowledge> context based on classified intent."""
    context, _ = await build_context_and_sources(
        intent,
        message,
        user=user,
        db=db,
        query_embedding=query_embedding,
    )
    return context
