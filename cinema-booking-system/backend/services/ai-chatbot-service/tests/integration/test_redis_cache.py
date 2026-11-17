import uuid
import pytest

from app.api.v1.endpoints.chat import send_message
from app.core.security import UserContext
from app.schemas.chat import ChatRequest
from app.services import cache_service, guardrails, intent_router, llm_client


class InMemoryRedis:
    def __init__(self) -> None:
        self.data: dict[str, str] = {}

    async def get(self, key: str):
        return self.data.get(key)

    async def setex(self, key: str, ttl: int, value: str):
        self.data[key] = value


class _EmptyMappings:
    def first(self):
        return None

    def all(self):
        return []


class _EmptyResult:
    def mappings(self):
        return _EmptyMappings()


class MinimalDb:
    def __init__(self) -> None:
        self.messages: list[tuple[str, str, bool]] = []

    async def execute(self, stmt, params=None):
        sql = str(stmt)
        if "INSERT INTO chat_messages" in sql and params:
            self.messages.append((params["role"], params["content"], params["cached"]))
        return _EmptyResult()

    async def commit(self) -> None:
        return None


@pytest.mark.asyncio
async def test_l1_redis_cache_hit_skips_llm_and_respects_bypass(monkeypatch):
    redis = InMemoryRedis()
    db = MinimalDb()
    user = UserContext(user_id=10, session_token="tok")
    llm_calls = 0

    async def fake_classify(message: str) -> str:
        return "SHOWTIME_QUERY" if "today" in message.lower() else "CINEMA_FAQ"

    async def fake_build_context_and_sources(
        intent, message, user=None, db=None, query_embedding=None
    ):
        return "Standard tickets are refundable up to 60 minutes before showtime.", []

    async def fake_generate(prompt: str, **kwargs) -> str:
        nonlocal llm_calls
        llm_calls += 1
        return "You can refund standard tickets up to 60 minutes before showtime."

    async def fake_embed(text: str) -> list[float]:
        return [0.1] * 768

    monkeypatch.setattr(guardrails, "classify_intent", fake_classify)
    monkeypatch.setattr(
        intent_router, "build_context_and_sources", fake_build_context_and_sources
    )
    monkeypatch.setattr(llm_client, "generate", fake_generate)
    monkeypatch.setattr(llm_client, "embed", fake_embed)

    sid = uuid.uuid4()
    first = await send_message(
        ChatRequest(sessionId=sid, message="What is your refund policy?"),
        user=user,
        db=db,
        redis=redis,
    )
    assert first.cached is False
    assert llm_calls == 1
    assert cache_service.exact_key("What is your refund policy?") in redis.data

    second = await send_message(
        ChatRequest(sessionId=sid, message="Hello, what is your refund policy??"),
        user=user,
        db=db,
        redis=redis,
    )
    assert second.cached is True
    assert second.reply == first.reply
    assert llm_calls == 1  # No second LLM call

    today_resp = await send_message(
        ChatRequest(sessionId=sid, message="What movies are playing today?"),
        user=user,
        db=db,
        redis=redis,
    )
    assert today_resp.cached is False
    assert llm_calls == 2
    assert cache_service.exact_key("What movies are playing today?") not in redis.data
