"""Seed cinema FAQ/policy entries with embeddings into faq_embeddings.

Run: python -m scripts.seed_faqs
"""
import asyncio

FAQS: list[dict] = [
    # TODO: refund rules, seat classes, concessions, payment methods, age ratings
]


async def main() -> None:
    raise NotImplementedError


if __name__ == "__main__":
    asyncio.run(main())

