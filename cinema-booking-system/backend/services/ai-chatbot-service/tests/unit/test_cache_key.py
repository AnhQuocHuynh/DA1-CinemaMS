import pytest

from app.services import cache_service


class FakeRedis:
    def __init__(self, fail: bool = False) -> None:
        self.store: dict[str, object] = {}
        self.ttls: dict[str, int] = {}
        self.fail = fail

    async def get(self, key: str):
        if self.fail:
            raise ConnectionError("redis down")
        return self.store.get(key)

    async def setex(self, key: str, ttl: int, value: str) -> None:
        if self.fail:
            raise ConnectionError("redis down")
        self.store[key] = value
        self.ttls[key] = ttl


class _FakeMappings:
    def __init__(self, row):
        self._row = row

    def first(self):
        return self._row


class _FakeResult:
    def __init__(self, row=None):
        self._row = row

    def mappings(self):
        return _FakeMappings(self._row)


class FakeAsyncSession:
    def __init__(self, row=None, fail: bool = False) -> None:
        self.row = row
        self.fail = fail
        self.calls: list[tuple[str, dict]] = []
        self.commits = 0

    async def execute(self, stmt, params=None):
        if self.fail:
            raise RuntimeError("db error")
        self.calls.append((str(stmt), params or {}))
        if "SELECT id, response_text" in str(stmt):
            return _FakeResult(self.row)
        return _FakeResult(None)

    async def commit(self) -> None:
        self.commits += 1


def test_normalizer_produces_same_key():
    assert cache_service.exact_key("What is refund policy?") == cache_service.exact_key(
        "what is refund policy"
    )
    assert cache_service.exact_key("Xin chào chính sách hoàn vé?") == cache_service.exact_key(
        "chính sách hoàn vé"
    )


def test_bypass_keywords():
    assert cache_service.should_bypass("movies tonight?")
    assert cache_service.should_bypass("Lịch chiếu phim hôm nay?")
    assert cache_service.should_bypass("Rạp còn ghế không?")
    assert not cache_service.should_bypass("refund policy")
    assert not cache_service.should_bypass("chính sách hoàn vé")


def test_vector_literal_formatting():
    assert cache_service.vector_literal([0.5, -0.25]) == "[0.50000000,-0.25000000]"


@pytest.mark.asyncio
async def test_exact_cache_get_and_set():
    redis = FakeRedis()
    saved = await cache_service.set_exact(
        redis, "What is refund policy?", "60 min cutoff", ttl_seconds=120
    )
    assert saved is True
    assert redis.ttls[cache_service.exact_key("What is refund policy?")] == 120
    assert await cache_service.get_exact(redis, "Hello, what is refund policy?") == "60 min cutoff"

    redis.store[cache_service.exact_key("seat classes")] = b"Standard and VIP"
    assert await cache_service.get_exact(redis, "seat classes") == "Standard and VIP"


@pytest.mark.asyncio
async def test_exact_cache_skips_bypass_and_fails_open():
    redis = FakeRedis()
    assert await cache_service.set_exact(redis, "What movies are playing today?", "Avatar") is False
    assert redis.store == {}
    assert await cache_service.get_exact(redis, "What movies are playing today?") is None

    broken = FakeRedis(fail=True)
    assert await cache_service.set_exact(broken, "refund policy", "ok") is False
    assert await cache_service.get_exact(broken, "refund policy") is None


@pytest.mark.asyncio
async def test_semantic_cache_hit_increments_counter():
    db = FakeAsyncSession(row={"id": 42, "response_text": "Cached policy", "similarity": 0.96})
    hit = await cache_service.get_semantic(
        db, [0.1, 0.2, 0.3], text="How do I cancel a ticket?"
    )
    assert hit == "Cached policy"
    assert db.commits == 1
    assert len(db.calls) == 2
    assert "UPDATE semantic_cache SET hit_count = hit_count + 1" in db.calls[1][0]
    assert db.calls[1][1] == {"id": 42}


@pytest.mark.asyncio
async def test_semantic_cache_miss_bypass_and_set():
    db = FakeAsyncSession(row=None)
    assert await cache_service.get_semantic(db, [0.1, 0.2], text="refund policy") is None
    assert await cache_service.get_semantic(db, [0.1, 0.2], text="seats left now") is None
    assert len(db.calls) == 1

    assert await cache_service.set_semantic(db, "seats left tonight", [0.1, 0.2], "5") is False
    ok = await cache_service.set_semantic(
        db, "Can I get a refund?", [0.1, 0.2], "Yes, up to 60m before showtime.", ttl_days=7
    )
    assert ok is True
    assert db.commits == 1
    insert_sql, insert_params = db.calls[-1]
    assert "INSERT INTO semantic_cache" in insert_sql
    assert insert_params["ttl_days"] == 7
    assert insert_params["embedding"] == "[0.10000000,0.20000000]"
