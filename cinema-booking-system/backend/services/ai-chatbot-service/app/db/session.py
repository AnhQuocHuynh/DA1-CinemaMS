from collections.abc import AsyncIterator
import logging
from pathlib import Path
from urllib.parse import urlparse

import asyncpg
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

logger = logging.getLogger("cinebot.db")

engine = create_async_engine(
    settings.POSTGRES_URL,
    pool_size=10,
    max_overflow=10,
    pool_pre_ping=True,
)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def init_db() -> None:
    """Ensure target database and schema exist so teammates with existing volumes need no manual SQL."""
    dsn = settings.POSTGRES_URL.replace("postgresql+asyncpg://", "postgresql://", 1)
    parsed = urlparse(dsn)
    target_db = (parsed.path or "/ai_chatbot_db").lstrip("/") or "ai_chatbot_db"
    admin_dsn = parsed._replace(path="/postgres").geturl()

    try:
        admin_conn = await asyncpg.connect(admin_dsn)
        try:
            exists = await admin_conn.fetchval(
                "SELECT 1 FROM pg_database WHERE datname = $1", target_db
            )
            if not exists:
                await admin_conn.execute(f'CREATE DATABASE "{target_db}"')
                logger.info("Created database %s", target_db)
        finally:
            await admin_conn.close()

        migration_path = Path(__file__).resolve().parents[2] / "migrations" / "001_init_schema.sql"
        if migration_path.exists():
            sql = migration_path.read_text(encoding="utf-8")
            conn = await asyncpg.connect(dsn)
            try:
                await conn.execute(sql)
                logger.info("Applied schema from %s", migration_path.name)
            finally:
                await conn.close()
    except Exception:
        logger.warning("Database auto-bootstrap skipped or failed", exc_info=True)


async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session

