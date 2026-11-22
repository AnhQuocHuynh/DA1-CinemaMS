from collections.abc import AsyncIterator
from pathlib import Path

import pytest

testcontainers = pytest.importorskip("testcontainers")
pytest_asyncio = pytest.importorskip("pytest_asyncio")
try:
    from testcontainers.community.postgres import PostgresContainer  # noqa: E402
    from testcontainers.community.redis import RedisContainer  # noqa: E402
except ImportError:
    from testcontainers.postgres import PostgresContainer  # noqa: E402
    from testcontainers.redis import RedisContainer  # noqa: E402

MIGRATION_SQL_PATH = Path(__file__).resolve().parents[2] / "migrations" / "001_init_schema.sql"


@pytest.fixture(scope="session")
def pgvector_url() -> str:
    """Start a real PostgreSQL 18 + pgvector container for the test session."""
    with PostgresContainer("pgvector/pgvector:pg18", driver="asyncpg") as pg:
        url = pg.get_connection_url()
        yield url


@pytest.fixture(scope="session")
def redis_url() -> str:
    """Start a real Redis 7 container for the test session."""
    with RedisContainer("redis:7-alpine") as redis_box:
        host = redis_box.get_container_host_ip()
        port = redis_box.get_exposed_port(6379)
        yield f"redis://{host}:{port}/0"


@pytest_asyncio.fixture
async def live_db_and_redis(pgvector_url: str, redis_url: str) -> AsyncIterator[tuple]:
    """Provide a migrated AsyncSession, raw asyncpg DSN, and Redis client per test."""
    import asyncpg
    import redis.asyncio as aioredis
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    dsn = pgvector_url.replace("postgresql+asyncpg://", "postgresql://", 1)
    schema_sql = MIGRATION_SQL_PATH.read_text(encoding="utf-8")

    raw_conn = await asyncpg.connect(dsn)
    try:
        await raw_conn.execute(schema_sql)
        await raw_conn.execute(
            "TRUNCATE chat_messages, chat_sessions, faq_embeddings, "
            "movie_embeddings, semantic_cache RESTART IDENTITY CASCADE"
        )
    finally:
        await raw_conn.close()

    engine = create_async_engine(pgvector_url, pool_pre_ping=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    redis_client = aioredis.from_url(redis_url, decode_responses=True)
    await redis_client.flushdb()

    try:
        async with session_factory() as session:
            yield session, dsn, redis_client
    finally:
        await redis_client.aclose()
        await engine.dispose()
