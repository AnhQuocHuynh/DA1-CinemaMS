import aio_pika

from app.core.config import settings

EXCHANGE = "catalog.events"
ROUTING_KEYS = ("movie.created", "movie.updated")


async def run_consumer() -> None:
    """Consume catalog events and upsert movie_embeddings."""
    connection = await aio_pika.connect_robust(settings.RABBITMQ_URL)
    channel = await connection.channel()
    exchange = await channel.declare_exchange(EXCHANGE, aio_pika.ExchangeType.TOPIC, durable=True)
    queue = await channel.declare_queue("ai-chatbot.catalog-sync", durable=True)
    for key in ROUTING_KEYS:
        await queue.bind(exchange, routing_key=key)
    async with queue.iterator() as it:
        async for message in it:
            async with message.process():
                pass  # TODO: embed synopsis and upsert into movie_embeddings

