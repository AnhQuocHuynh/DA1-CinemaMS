import json
import math
import uuid

import pytest

from app.api.v1.endpoints.chat import send_message
from app.api.v1.endpoints.stream import stream_message
from app.core.security import UserContext
from app.schemas.chat import ChatRequest
from app.services import answer_guard, downstream_client, guardrails, llm_client


def _parse_vector(literal: str) -> list[float]:
    return [float(part) for part in literal.strip("[]").split(",") if part]


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)


class _FakeMappings:
    def __init__(self, rows):
        self._rows = rows

    def first(self):
        return self._rows[0] if self._rows else None

    def all(self):
        return self._rows


class _FakeResult:
    def __init__(self, rows=None):
        self._rows = rows or []

    def mappings(self):
        return _FakeMappings(self._rows)


class FakeRedis:
    def __init__(self) -> None:
        self.store: dict[str, str] = {}

    async def get(self, key: str):
        return self.store.get(key)

    async def setex(self, key: str, ttl: int, value: str):
        self.store[key] = value


class FakeGuardDb:
    """In-memory DB supporting FAQ/movie vector search, movie title listing, and caches."""

    def __init__(self) -> None:
        self.sessions: dict[str, dict] = {}
        self.messages: list[dict] = []
        self.faq_embeddings: list[dict] = []
        self.movie_embeddings: list[dict] = []
        self.semantic_cache: list[dict] = []
        self._next_msg_id = 1
        self._next_sem_id = 1

    async def execute(self, stmt, params=None):
        sql = str(stmt)
        params = params or {}

        if "SELECT id, user_id, session_token" in sql and "FROM chat_sessions" in sql:
            row = self.sessions.get(params["id"])
            return _ResultProxy.one_or_none(row)

        if "INSERT INTO chat_sessions" in sql:
            self.sessions[params["id"]] = {
                "id": uuid.UUID(params["id"]),
                "user_id": params["user_id"],
                "keycloak_id": params["keycloak_id"],
                "session_token": params["session_token"],
                "title": params["title"],
                "created_at": self._next_msg_id,
                "updated_at": self._next_msg_id,
            }
            return _FakeResult()

        if "INSERT INTO chat_messages" in sql:
            self.messages.append(
                {
                    "id": self._next_msg_id,
                    "session_id": params["session_id"],
                    "role": params["role"],
                    "content": params["content"],
                    "cached": params["cached"],
                }
            )
            self._next_msg_id += 1
            return _FakeResult()

        if "UPDATE chat_sessions SET updated_at" in sql:
            sid = params["session_id"]
            if sid in self.sessions:
                self.sessions[sid]["updated_at"] += 1
            return _FakeResult()

        if "FROM chat_messages" in sql and "ORDER BY created_at DESC" in sql:
            rows = [m for m in self.messages if m["session_id"] == params["session_id"]]
            rows.sort(key=lambda r: r["id"], reverse=True)
            return _FakeResult(rows[: params["limit"]])

        if "SELECT title FROM movie_embeddings" in sql:
            rows = [
                {"title": row["title"]}
                for row in self.movie_embeddings
                if row.get("title") is not None
            ]
            return _FakeResult(rows)

        if "FROM faq_embeddings" in sql:
            q_vec = _parse_vector(params["embedding"])
            threshold = float(params["threshold"])
            scored = []
            for row in self.faq_embeddings:
                sim = _cosine_similarity(q_vec, row["embedding"])
                if sim >= threshold:
                    scored.append({**row, "similarity": sim})
            scored.sort(key=lambda r: r["similarity"], reverse=True)
            return _FakeResult(scored[: int(params["limit"])])

        if "FROM movie_embeddings" in sql:
            q_vec = _parse_vector(params["embedding"])
            threshold = float(params["threshold"])
            scored = []
            for row in self.movie_embeddings:
                sim = _cosine_similarity(q_vec, row["embedding"])
                if sim >= threshold:
                    scored.append({**row, "similarity": sim})
            scored.sort(key=lambda r: r["similarity"], reverse=True)
            return _FakeResult(scored[: int(params["limit"])])

        if "FROM semantic_cache" in sql:
            q_vec = _parse_vector(params["embedding"])
            threshold = float(params["threshold"])
            scored = []
            for row in self.semantic_cache:
                sim = _cosine_similarity(q_vec, row["embedding"])
                if sim >= threshold:
                    scored.append({**row, "similarity": sim})
            scored.sort(key=lambda r: r["similarity"], reverse=True)
            return _FakeResult(scored[:1])

        if "INSERT INTO semantic_cache" in sql:
            self.semantic_cache.append(
                {
                    "id": self._next_sem_id,
                    "query_hash": params["query_hash"],
                    "query_text": params["query_text"],
                    "response_text": params["response_text"],
                    "embedding": _parse_vector(params["embedding"]),
                    "hit_count": 0,
                }
            )
            self._next_sem_id += 1
            return _FakeResult()

        return _FakeResult()

    async def commit(self) -> None:
        return None


class _ResultProxy:
    @staticmethod
    def one_or_none(row):
        return _FakeResult([row] if row else [])


def _parse_sse(raw_events: list[str]) -> list[dict]:
    events = []
    for raw in raw_events:
        assert raw.startswith("data: ")
        assert raw.endswith("\n\n")
        events.append(json.loads(raw[len("data: ") : -2]))
    return events


@pytest.mark.asyncio
async def test_faq_question_returns_sources_with_title_and_similarity(monkeypatch):
    db = FakeGuardDb()
    db.faq_embeddings.append(
        {
            "id": 10,
            "category": "REFUND",
            "question": "Are VIP tickets refundable?",
            "answer": "VIP and Couple seats are strictly non-refundable.",
            "metadata": {},
            "embedding": [1.0, 0.0, 0.0, 0.0],
        }
    )
    redis = FakeRedis()
    user = UserContext(user_id=1)

    async def fake_embed(text: str) -> list[float]:
        return [1.0, 0.0, 0.0, 0.0]

    async def fake_classify(message: str) -> str:
        return "CINEMA_FAQ"

    async def fake_generate(prompt: str, **kwargs) -> str:
        return "VIP and Couple seats are strictly non-refundable."

    monkeypatch.setattr(llm_client, "embed", fake_embed)
    monkeypatch.setattr(guardrails, "classify_intent", fake_classify)
    monkeypatch.setattr(llm_client, "generate", fake_generate)

    resp = await send_message(
        ChatRequest(message="Are VIP tickets refundable?"),
        user=user,
        db=db,
        redis=redis,
    )

    assert resp.reply == "VIP and Couple seats are strictly non-refundable."
    assert resp.cached is False
    assert len(resp.sources) == 1
    src = resp.sources[0]
    assert src.type == "faq"
    assert src.id == 10
    assert src.title == "Are VIP tickets refundable?"
    assert src.similarity == pytest.approx(1.0)
    assert src.snippet == "VIP and Couple seats are strictly non-refundable."


@pytest.mark.asyncio
async def test_hallucinated_foreign_movie_refused_with_empty_sources_and_no_cache(monkeypatch):
    db = FakeGuardDb()
    db.movie_embeddings.extend(
        [
            {
                "movie_id": 1,
                "title": "Dune",
                "genres": "Sci-Fi",
                "synopsis": "A desert planet epic.",
                "age_rating": "T13",
                "embedding": [1.0, 0.0, 0.0, 0.0],
            },
            {
                "movie_id": 2,
                "title": "Oppenheimer",
                "genres": "Drama",
                "synopsis": "Theoretical physicist biography.",
                "age_rating": "T16",
                "embedding": [0.0, 1.0, 0.0, 0.0],
            },
        ]
    )
    redis = FakeRedis()
    user = UserContext(user_id=2)

    async def fake_embed(text: str) -> list[float]:
        return [1.0, 0.0, 0.0, 0.0]

    async def fake_classify(message: str) -> str:
        return "MOVIE_QUERY"

    async def fake_generate(prompt: str, **kwargs) -> str:
        return "You should watch Oppenheimer tonight!"

    monkeypatch.setattr(llm_client, "embed", fake_embed)
    monkeypatch.setattr(guardrails, "classify_intent", fake_classify)
    monkeypatch.setattr(llm_client, "generate", fake_generate)

    resp = await send_message(
        ChatRequest(message="Tell me about sci-fi movies"),
        user=user,
        db=db,
        redis=redis,
    )

    assert resp.reply == guardrails.REFUSAL_MESSAGE
    assert resp.sources == []
    assert resp.cached is False
    assert redis.store == {}
    assert db.semantic_cache == []
    assert db.messages[-1]["role"] == "assistant"
    assert db.messages[-1]["content"] == guardrails.REFUSAL_MESSAGE


@pytest.mark.asyncio
async def test_allowed_movie_answer_passes_with_emoji_stripped(monkeypatch):
    db = FakeGuardDb()
    db.movie_embeddings.extend(
        [
            {
                "movie_id": 1,
                "title": "Dune",
                "genres": "Sci-Fi",
                "synopsis": "A desert planet epic.",
                "age_rating": "T13",
                "embedding": [1.0, 0.0, 0.0, 0.0],
            },
            {
                "movie_id": 2,
                "title": "Oppenheimer",
                "genres": "Drama",
                "synopsis": "Theoretical physicist biography.",
                "age_rating": "T16",
                "embedding": [0.0, 1.0, 0.0, 0.0],
            },
        ]
    )
    redis = FakeRedis()
    user = UserContext(user_id=3)

    async def fake_embed(text: str) -> list[float]:
        return [1.0, 0.0, 0.0, 0.0]

    async def fake_classify(message: str) -> str:
        return "MOVIE_QUERY"

    async def fake_generate(prompt: str, **kwargs) -> str:
        return "  You will enjoy Dune tonight 🎬🍿  "

    monkeypatch.setattr(llm_client, "embed", fake_embed)
    monkeypatch.setattr(guardrails, "classify_intent", fake_classify)
    monkeypatch.setattr(llm_client, "generate", fake_generate)

    resp = await send_message(
        ChatRequest(message="Tell me about sci-fi movies"),
        user=user,
        db=db,
        redis=redis,
    )

    assert resp.reply == "You will enjoy Dune tonight"
    assert len(resp.sources) == 1
    assert resp.sources[0].title == "Dune"
    assert len(redis.store) == 1
    assert len(db.semantic_cache) == 1


@pytest.mark.asyncio
async def test_empty_retrieval_refuses_localized_without_llm_or_caching(monkeypatch):
    db = FakeGuardDb()
    redis = FakeRedis()
    user = UserContext(user_id=4)
    llm_calls = 0

    async def fake_embed(text: str) -> list[float]:
        return [1.0, 0.0, 0.0, 0.0]

    async def fake_classify(message: str) -> str:
        return "MOVIE_QUERY" if "phim" in message.lower() else "CINEMA_FAQ"

    async def fake_generate(prompt: str, **kwargs) -> str:
        nonlocal llm_calls
        llm_calls += 1
        return "Should never be called"

    async def empty_search_movies(keyword: str):
        return []

    async def empty_recs(user_id=None, auth_token=None):
        return []

    monkeypatch.setattr(llm_client, "embed", fake_embed)
    monkeypatch.setattr(guardrails, "classify_intent", fake_classify)
    monkeypatch.setattr(llm_client, "generate", fake_generate)
    monkeypatch.setattr(downstream_client, "search_movies", empty_search_movies)
    monkeypatch.setattr(downstream_client, "get_user_recommendations", empty_recs)

    en_resp = await send_message(
        ChatRequest(message="What is the popcorn policy?"),
        user=user,
        db=db,
        redis=redis,
    )
    assert en_resp.reply == guardrails.REFUSAL_MESSAGE
    assert en_resp.sources == []
    assert en_resp.cached is False

    vi_resp = await send_message(
        ChatRequest(message="Kể về bộ phim bí ẩn"),
        user=user,
        db=db,
        redis=redis,
    )
    assert vi_resp.reply == guardrails.REFUSAL_MESSAGE_VI
    assert vi_resp.sources == []
    assert vi_resp.cached is False

    assert llm_calls == 0
    assert redis.store == {}
    assert db.semantic_cache == []


@pytest.mark.asyncio
async def test_streaming_done_event_carries_sources_and_guard_replacement(monkeypatch):
    db = FakeGuardDb()
    db.movie_embeddings.extend(
        [
            {
                "movie_id": 1,
                "title": "Dune",
                "genres": "Sci-Fi",
                "synopsis": "A desert planet epic.",
                "age_rating": "T13",
                "embedding": [1.0, 0.0, 0.0, 0.0],
            },
            {
                "movie_id": 2,
                "title": "Oppenheimer",
                "genres": "Drama",
                "synopsis": "Theoretical physicist biography.",
                "age_rating": "T16",
                "embedding": [0.0, 1.0, 0.0, 0.0],
            },
        ]
    )
    redis = FakeRedis()
    user = UserContext(user_id=5)

    async def fake_embed(text: str) -> list[float]:
        return [1.0, 0.0, 0.0, 0.0]

    async def fake_classify(message: str) -> str:
        return "MOVIE_QUERY"

    async def clean_stream(prompt: str, **kwargs):
        yield "Watch Dune "
        yield "tonight 🎬"

    monkeypatch.setattr(llm_client, "embed", fake_embed)
    monkeypatch.setattr(guardrails, "classify_intent", fake_classify)
    monkeypatch.setattr(llm_client, "stream", clean_stream)

    clean_resp = await stream_message(
        ChatRequest(message="Tell me about sci-fi movies"),
        user=user,
        db=db,
        redis=redis,
    )
    clean_events = _parse_sse([chunk async for chunk in clean_resp.body_iterator])
    assert clean_events[0] == {"chunk": "Watch Dune ", "done": False}
    assert clean_events[-1]["done"] is True
    assert clean_events[-1]["cached"] is False
    assert len(clean_events[-1]["sources"]) == 1
    assert clean_events[-1]["sources"][0]["title"] == "Dune"
    assert "replacement" not in clean_events[-1]

    # Guarded streaming run: fresh redis/query so cache isn't hit
    redis_guarded = FakeRedis()
    db.semantic_cache.clear()

    async def hallucinated_stream(prompt: str, **kwargs):
        yield "Try watching "
        yield "Oppenheimer instead."

    monkeypatch.setattr(llm_client, "stream", hallucinated_stream)

    guarded_resp = await stream_message(
        ChatRequest(message="Any other sci-fi movie?"),
        user=user,
        db=db,
        redis=redis_guarded,
    )
    guarded_events = _parse_sse([chunk async for chunk in guarded_resp.body_iterator])
    done_ev = guarded_events[-1]
    assert done_ev["done"] is True
    assert done_ev["sources"] == []
    assert done_ev["replacement"] == guardrails.REFUSAL_MESSAGE
    assert redis_guarded.store == {}
    assert db.semantic_cache == []
    assert db.messages[-1]["content"] == guardrails.REFUSAL_MESSAGE


@pytest.mark.asyncio
async def test_offline_faq_returns_grounded_text_and_sources_and_skips_guard(monkeypatch):
    monkeypatch.setattr(llm_client.settings, "GEMINI_API_KEY", "")
    monkeypatch.setattr(llm_client.settings, "OPENAI_API_KEY", "")

    db = FakeGuardDb()
    question = "What is the ticket cancellation and refund policy?"
    q_vec = await llm_client.embed(question)
    db.faq_embeddings.append(
        {
            "id": 21,
            "category": "REFUND",
            "question": question,
            "answer": "Standard tickets can be cancelled up to 60 minutes before showtime 🎬.",
            "metadata": {},
            "embedding": q_vec,
        }
    )
    redis = FakeRedis()
    user = UserContext(user_id=6)
    guard_called = False

    def spy_guard(*args, **kwargs):
        nonlocal guard_called
        guard_called = True
        return "UNEXPECTED"

    monkeypatch.setattr(answer_guard, "guard_answer", spy_guard)

    resp = await send_message(
        ChatRequest(message=question),
        user=user,
        db=db,
        redis=redis,
    )

    assert guard_called is False
    assert "offline mode" in resp.reply.lower()
    assert "60 minutes before showtime" in resp.reply
    assert "🎬" in resp.reply
    assert len(resp.sources) == 1
    assert resp.sources[0].type == "faq"
    assert resp.sources[0].title == question
    assert resp.sources[0].similarity == pytest.approx(1.0)
    assert redis.store == {}
    assert db.semantic_cache == []
