from collections.abc import AsyncIterator
import hashlib
import logging
import math
import struct

from app.core.config import settings

logger = logging.getLogger("cinebot.llm")

EMBEDDING_DIM = 768
OFFLINE_FALLBACK_MESSAGE = (
    "I'm currently operating in offline mode. "
    "Please check our FAQs or contact cinema staff for urgent inquiries."
)
OFFLINE_FALLBACK_MESSAGE_VI = (
    "Hiện tôi đang hoạt động ở chế độ ngoại tuyến. "
    "Vui lòng xem mục Câu hỏi thường gặp (FAQ) hoặc liên hệ nhân viên rạp để được hỗ trợ khẩn cấp."
)


def _deterministic_embedding(text: str, dim: int = EMBEDDING_DIM) -> list[float]:
    """Produce a deterministic, L2-normalized embedding for offline/test fallback."""
    values: list[float] = []
    seed = 0
    while len(values) < dim:
        digest = hashlib.sha256(f"{seed}:{text}".encode("utf-8")).digest()
        for idx in range(0, len(digest), 4):
            if len(values) >= dim:
                break
            chunk = struct.unpack(">I", digest[idx : idx + 4])[0]
            values.append((chunk / 0xFFFFFFFF) * 2.0 - 1.0)
        seed += 1
    norm = math.sqrt(sum(v * v for v in values)) or 1.0
    return [v / norm for v in values]


def _provider_order() -> tuple[str, str]:
    if (settings.AI_PROVIDER or "").strip().lower() == "openai":
        return ("openai", "gemini")
    return ("gemini", "openai")


def _has_key(provider: str) -> bool:
    if provider == "gemini":
        return bool((settings.GEMINI_API_KEY or "").strip())
    if provider == "openai":
        return bool((settings.OPENAI_API_KEY or "").strip())
    return False


async def _gemini_generate(
    prompt: str, temperature: float = 0.2, max_tokens: int | None = None
) -> str:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    config = types.GenerateContentConfig(
        temperature=temperature,
        max_output_tokens=max_tokens,
    )
    resp = await client.aio.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=prompt,
        config=config,
    )
    return (getattr(resp, "text", None) or "").strip()


async def _openai_generate(
    prompt: str, temperature: float = 0.2, max_tokens: int | None = None
) -> str:
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    resp = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return (resp.choices[0].message.content or "").strip()


async def _gemini_stream(prompt: str, temperature: float = 0.2) -> AsyncIterator[str]:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    config = types.GenerateContentConfig(temperature=temperature)
    stream_resp = await client.aio.models.generate_content_stream(
        model=settings.GEMINI_MODEL,
        contents=prompt,
        config=config,
    )
    async for chunk in stream_resp:
        text = getattr(chunk, "text", None)
        if text:
            yield text


async def _openai_stream(prompt: str, temperature: float = 0.2) -> AsyncIterator[str]:
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    stream_resp = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
        stream=True,
    )
    async for chunk in stream_resp:
        choices = getattr(chunk, "choices", None) or []
        if not choices:
            continue
        delta = getattr(choices[0].delta, "content", None)
        if delta:
            yield delta


async def _gemini_embed(text: str) -> list[float]:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    resp = await client.aio.models.embed_content(
        model=settings.EMBEDDING_MODEL,
        contents=text,
        config=types.EmbedContentConfig(output_dimensionality=EMBEDDING_DIM),
    )
    return [float(x) for x in resp.embeddings[0].values]


async def _openai_embed(text: str) -> list[float]:
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    resp = await client.embeddings.create(
        model="text-embedding-3-small",
        input=text,
        dimensions=EMBEDDING_DIM,
    )
    return [float(x) for x in resp.data[0].embedding]


async def generate(
    prompt: str, *, temperature: float = 0.2, max_tokens: int | None = None
) -> str:
    """Generate a response using the primary provider with fallback and offline safety."""
    generators = {"gemini": _gemini_generate, "openai": _openai_generate}
    for provider in _provider_order():
        if not _has_key(provider):
            continue
        try:
            text = await generators[provider](prompt, temperature, max_tokens)
            if text:
                return text
        except Exception:
            logger.warning("LLM provider %s failed during generate", provider, exc_info=True)

    logger.warning("All LLM providers unavailable; returning offline fallback message")
    return OFFLINE_FALLBACK_MESSAGE


async def stream(prompt: str, *, temperature: float = 0.2) -> AsyncIterator[str]:
    """Stream token chunks from the primary provider with fallback before first chunk."""
    streamers = {"gemini": _gemini_stream, "openai": _openai_stream}
    for provider in _provider_order():
        if not _has_key(provider):
            continue
        yielded = False
        try:
            async for chunk in streamers[provider](prompt, temperature):
                yielded = True
                yield chunk
            if yielded:
                return
        except Exception:
            logger.warning("LLM provider %s failed during stream", provider, exc_info=True)
            if yielded:
                return

    logger.warning("All LLM providers unavailable; yielding offline fallback message")
    yield OFFLINE_FALLBACK_MESSAGE


async def embed(text: str) -> list[float]:
    """Generate a 768-dimensional embedding with provider fallback and deterministic offline mode."""
    embedders = {"gemini": _gemini_embed, "openai": _openai_embed}
    for provider in _provider_order():
        if not _has_key(provider):
            continue
        try:
            vec = await embedders[provider](text)
            if vec:
                return vec
        except Exception:
            logger.warning("Embedding provider %s failed; falling back", provider, exc_info=True)

    return _deterministic_embedding(text, EMBEDDING_DIM)
