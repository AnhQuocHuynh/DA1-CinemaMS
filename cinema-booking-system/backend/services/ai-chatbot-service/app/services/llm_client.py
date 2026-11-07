from collections.abc import AsyncIterator


async def generate(prompt: str) -> str:
    """TODO: call Gemini/OpenAI based on settings.AI_PROVIDER."""
    raise NotImplementedError


async def stream(prompt: str) -> AsyncIterator[str]:
    raise NotImplementedError
    yield  # pragma: no cover


async def embed(text: str) -> list[float]:
    """TODO: 768-dim embedding via settings.EMBEDDING_MODEL."""
    raise NotImplementedError

