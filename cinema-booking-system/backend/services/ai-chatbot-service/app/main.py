import logging
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.db.session import engine, init_db

logger = logging.getLogger("cinebot")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    app.state.redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    # TODO: start app.workers.event_consumer as a background task
    yield
    await app.state.redis.aclose()
    await engine.dispose()


app = FastAPI(title="CineBot AI Chatbot Service", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error")
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/health")
async def health():
    return {"status": "ok"}


app.include_router(api_router, prefix="/api/chat")

