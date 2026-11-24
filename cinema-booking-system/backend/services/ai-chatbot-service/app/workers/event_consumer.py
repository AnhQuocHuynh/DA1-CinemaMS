import asyncio
import json
import logging
from typing import Any

import aio_pika
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.services import downstream_client
from app.services.catalog_indexer import upsert_movie

logger = logging.getLogger("cinebot.consumer")

EXCHANGE = "catalog.events"
ROUTING_KEYS = ("movie.created", "movie.updated")


async def process_catalog_event(
    raw_body: bytes | str | dict[str, Any],
    db: AsyncSession | None = None,
) -> bool:
    """Parse catalog movie event, enrich via catalog-service, embed, and upsert."""
    if isinstance(raw_body, bytes):
        envelope = json.loads(raw_body.decode("utf-8"))
    elif isinstance(raw_body, str):
        envelope = json.loads(raw_body)
    else:
        envelope = raw_body

    if not isinstance(envelope, dict):
        return False

    payload = envelope.get("payload")
    if not isinstance(payload, dict):
        payload = envelope

    movie_id = payload.get("movieId") or payload.get("id")
    if movie_id is None:
        logger.warning("Skipping catalog event without movieId: %s", envelope)
        return False

    movie_id_int = int(movie_id)
    movie = await downstream_client.get_movie_by_id(movie_id_int) or {}
    merged = {k: v for k, v in payload.items() if v is not None}
    merged.update({k: v for k, v in movie.items() if v is not None})
    merged["id"] = movie_id_int
    if not merged.get("genres"):
        merged["genres"] = payload.get("genreNames") or []
    return await upsert_movie(merged, db)


async def run_consumer() -> None:
    """Consume catalog events and upsert movie_embeddings."""
    while True:
        try:
            connection = await aio_pika.connect_robust(settings.RABBITMQ_URL)
            async with connection:
                channel = await connection.channel()
                exchange = await channel.declare_exchange(
                    EXCHANGE, aio_pika.ExchangeType.TOPIC, durable=True
                )
                queue = await channel.declare_queue("ai-chatbot.catalog-sync", durable=True)
                for key in ROUTING_KEYS:
                    await queue.bind(exchange, routing_key=key)
                async with queue.iterator() as it:
                    async for message in it:
                        async with message.process():
                            try:
                                await process_catalog_event(message.body)
                            except Exception:
                                logger.exception("Failed processing catalog event")
        except asyncio.CancelledError:
            logger.info("Catalog event consumer stopped")
            raise
        except Exception:
            logger.warning("RabbitMQ consumer error; retrying in 5s", exc_info=True)
            await asyncio.sleep(5)
