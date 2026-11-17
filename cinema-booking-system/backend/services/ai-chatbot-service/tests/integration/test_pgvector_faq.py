import pytest

from app.api.v1.endpoints.chat import send_message
from app.core.security import UserContext
from app.schemas.chat import ChatRequest
from app.services import guardrails, llm_client, rag_service


class InMemoryRedis:
    def __init__(self) -> None:
        self.data: dict[str, str] = {}

    async def get(self, key: str):
        return self.data.get(key)

    async def setex(self, key: str, ttl: int, value: str):
        self.data[key] = value


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


class FakePgVectorDb:
    def __init__(self) -> None:
        self.semantic_entries: list[dict] = []
        self.faqs = [
            {
                "id": 1,
                "category": "REFUND",
                "question": "Are VIP seats refundable?",
                "answer": "VIP and Couple seats are strictly non-refundable.",
                "metadata": {},
                "similarity": 0.92,
            }
        ]

    async def execute(self, stmt, params=None):
        sql = str(stmt)
        params = params or {}
        if "FROM faq_embeddings" in sql:
            return _FakeResult(self.faqs)
        if "FROM semantic_cache" in sql:
            if self.semantic_entries and params.get("embedding") == self.semantic_entries[0]["embedding"]:
                return _FakeResult([self.semantic_entries[0]])
            return _FakeResult([])
        if "INSERT INTO semantic_cache" in sql:
            self.semantic_entries.append(
                {
                    "id": 1,
                    "response_text": params["response_text"],
                    "embedding": params["embedding"],
                    "similarity": 0.99,
                }
            )
        return _FakeResult([])

    async def commit(self) -> None:
        return None


@pytest.mark.asyncio
async def test_pgvector_faq_rag_semantic_cache_and_sanitization(monkeypatch):
    db = FakePgVectorDb()
    redis = InMemoryRedis()
    user = UserContext(user_id=7)
    captured_prompts: list[str] = []

    async def fake_embed(text: str) -> list[float]:
        if "python" in text.lower():
            return [0.1] * 768
        return [0.5] * 768

    async def fake_classify(message: str) -> str:
        if "python" in message.lower():
            return "OFF_TOPIC"
        return "CINEMA_FAQ"

    async def fake_generate(prompt: str, **kwargs) -> str:
        captured_prompts.append(prompt)
        return "VIP seats are non-refundable (debug local-dev-internal-token)."

    monkeypatch.setattr(llm_client, "embed", fake_embed)
    monkeypatch.setattr(guardrails, "classify_intent", fake_classify)
    monkeypatch.setattr(llm_client, "generate", fake_generate)

    resp1 = await send_message(
        ChatRequest(message="Can I cancel a VIP seat?"),
        user=user,
        db=db,
        redis=redis,
    )
    assert resp1.cached is False
    assert "strictly non-refundable" in captured_prompts[0]
    assert "local-dev-internal-token" not in resp1.reply
    assert "[REDACTED]" in resp1.reply
    assert len(db.semantic_entries) == 1

    # Different wording -> misses L1 Redis, hits L2 pgvector semantic cache
    resp2 = await send_message(
        ChatRequest(message="Is it possible to get a refund for VIP tickets?"),
        user=user,
        db=db,
        redis=redis,
    )
    assert resp2.cached is True
    assert resp2.reply == resp1.reply
    assert len(captured_prompts) == 1

    # Off-topic query short-circuits without touching LLM generate
    off_topic = await send_message(
        ChatRequest(message="Write a Python script for me"),
        user=user,
        db=db,
        redis=redis,
    )
    assert off_topic.reply == guardrails.REFUSAL_MESSAGE
    assert len(captured_prompts) == 1


@pytest.mark.asyncio
async def test_offline_mode_returns_grounded_faq_without_caching(monkeypatch):
    db = FakePgVectorDb()
    redis = InMemoryRedis()
    user = UserContext(user_id=8)

    async def fake_embed(text: str) -> list[float]:
        return [0.25] * 768

    async def offline_generate(prompt: str, **kwargs) -> str:
        return llm_client.OFFLINE_FALLBACK_MESSAGE

    async def fake_classify(message: str) -> str:
        return "CINEMA_FAQ"

    monkeypatch.setattr(llm_client, "embed", fake_embed)
    monkeypatch.setattr(llm_client, "generate", offline_generate)
    monkeypatch.setattr(guardrails, "classify_intent", fake_classify)
    monkeypatch.setattr(rag_service, "search_faqs", rag_service.search_faqs)

    resp = await send_message(
        ChatRequest(message="Are VIP seats refundable?"),
        user=user,
        db=db,
        redis=redis,
    )
    assert "offline mode" in resp.reply.lower()
    assert "VIP and Couple seats are strictly non-refundable." in resp.reply
    assert redis.data == {}
    assert db.semantic_entries == []
