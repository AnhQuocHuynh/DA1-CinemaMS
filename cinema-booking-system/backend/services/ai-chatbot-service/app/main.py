import asyncio
from contextlib import asynccontextmanager, suppress
import logging

import redis.asyncio as aioredis
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.endpoints.internal import router as internal_router
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.logging_filters import configure_access_log_filters
from app.db.session import engine, init_db
from app.services import downstream_client
from app.services.catalog_indexer import reindex_catalog
from app.workers.event_consumer import run_consumer

logger = logging.getLogger("cinebot")
configure_access_log_filters()


async def _safe_reindex() -> None:
    """Run startup catalog backfill without crashing application startup."""
    try:
        summary = await reindex_catalog()
        logger.info("Startup catalog reindex finished: %s", summary)
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.warning("Startup catalog reindex failed", exc_info=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_access_log_filters()
    await init_db()
    app.state.redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    if settings.REINDEX_ON_STARTUP:
        app.state.reindex_task = asyncio.create_task(_safe_reindex())
    app.state.consumer_task = asyncio.create_task(run_consumer())
    try:
        yield
    finally:
        reindex_task = getattr(app.state, "reindex_task", None)
        if reindex_task is not None:
            reindex_task.cancel()
            with suppress(asyncio.CancelledError):
                await reindex_task
        consumer_task = getattr(app.state, "consumer_task", None)
        if consumer_task is not None:
            consumer_task.cancel()
            with suppress(asyncio.CancelledError):
                await consumer_task
        await app.state.redis.aclose()
        await engine.dispose()


app = FastAPI(title="CineBot AI Chatbot Service", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error")
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "circuits": downstream_client.get_circuit_breaker_states(),
    }


app.include_router(api_router, prefix="/api/chat")
app.include_router(internal_router, prefix="/internal/chat")
