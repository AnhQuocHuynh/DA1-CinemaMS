import math
import pytest

from app.services import llm_client


@pytest.mark.asyncio
async def test_generate_returns_offline_fallback_without_keys(monkeypatch):
    monkeypatch.setattr(llm_client.settings, "GEMINI_API_KEY", "")
    monkeypatch.setattr(llm_client.settings, "OPENAI_API_KEY", "")

    reply = await llm_client.generate("What is the refund policy?")
    assert reply == llm_client.OFFLINE_FALLBACK_MESSAGE


@pytest.mark.asyncio
async def test_generate_uses_gemini_primary_and_falls_back_to_openai(monkeypatch):
    monkeypatch.setattr(llm_client.settings, "AI_PROVIDER", "Gemini")
    monkeypatch.setattr(llm_client.settings, "GEMINI_API_KEY", "gem-key")
    monkeypatch.setattr(llm_client.settings, "OPENAI_API_KEY", "oai-key")

    async def ok_gemini(prompt, temperature, max_tokens):
        return "Gemini reply"

    async def fail_gemini(prompt, temperature, max_tokens):
        raise RuntimeError("429 quota")

    async def ok_openai(prompt, temperature, max_tokens):
        return "OpenAI fallback reply"

    monkeypatch.setattr(llm_client, "_gemini_generate", ok_gemini)
    monkeypatch.setattr(llm_client, "_openai_generate", ok_openai)
    assert await llm_client.generate("hi") == "Gemini reply"

    monkeypatch.setattr(llm_client, "_gemini_generate", fail_gemini)
    assert await llm_client.generate("hi") == "OpenAI fallback reply"


@pytest.mark.asyncio
async def test_generate_respects_openai_primary(monkeypatch):
    monkeypatch.setattr(llm_client.settings, "AI_PROVIDER", "OpenAI")
    monkeypatch.setattr(llm_client.settings, "GEMINI_API_KEY", "gem-key")
    monkeypatch.setattr(llm_client.settings, "OPENAI_API_KEY", "oai-key")

    async def ok_openai(prompt, temperature, max_tokens):
        return "OpenAI primary"

    async def ok_gemini(prompt, temperature, max_tokens):
        return "Gemini secondary"

    monkeypatch.setattr(llm_client, "_openai_generate", ok_openai)
    monkeypatch.setattr(llm_client, "_gemini_generate", ok_gemini)
    assert await llm_client.generate("hi") == "OpenAI primary"


@pytest.mark.asyncio
async def test_stream_falls_back_before_first_chunk_and_handles_offline(monkeypatch):
    monkeypatch.setattr(llm_client.settings, "AI_PROVIDER", "Gemini")
    monkeypatch.setattr(llm_client.settings, "GEMINI_API_KEY", "gem-key")
    monkeypatch.setattr(llm_client.settings, "OPENAI_API_KEY", "oai-key")

    async def failing_gemini_stream(prompt, temperature):
        raise RuntimeError("upstream error")
        yield ""

    async def ok_openai_stream(prompt, temperature):
        yield "Hello "
        yield "world"

    monkeypatch.setattr(llm_client, "_gemini_stream", failing_gemini_stream)
    monkeypatch.setattr(llm_client, "_openai_stream", ok_openai_stream)

    chunks = [chunk async for chunk in llm_client.stream("hi")]
    assert chunks == ["Hello ", "world"]

    monkeypatch.setattr(llm_client.settings, "GEMINI_API_KEY", "")
    monkeypatch.setattr(llm_client.settings, "OPENAI_API_KEY", "")
    offline_chunks = [chunk async for chunk in llm_client.stream("hi")]
    assert offline_chunks == [llm_client.OFFLINE_FALLBACK_MESSAGE]


@pytest.mark.asyncio
async def test_embed_deterministic_fallback_and_provider_routing(monkeypatch):
    monkeypatch.setattr(llm_client.settings, "GEMINI_API_KEY", "")
    monkeypatch.setattr(llm_client.settings, "OPENAI_API_KEY", "")

    vec1 = await llm_client.embed("refund policy")
    vec2 = await llm_client.embed("refund policy")
    vec3 = await llm_client.embed("imax screen")
    assert len(vec1) == 768
    assert vec1 == vec2
    assert vec1 != vec3
    norm = math.sqrt(sum(v * v for v in vec1))
    assert math.isclose(norm, 1.0, rel_tol=1e-6)

    monkeypatch.setattr(llm_client.settings, "AI_PROVIDER", "Gemini")
    monkeypatch.setattr(llm_client.settings, "GEMINI_API_KEY", "gem-key")

    async def ok_gemini_embed(text):
        return [0.25] * 768

    monkeypatch.setattr(llm_client, "_gemini_embed", ok_gemini_embed)
    assert await llm_client.embed("refund policy") == [0.25] * 768
