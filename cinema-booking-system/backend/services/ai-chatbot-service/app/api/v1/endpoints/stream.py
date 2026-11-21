import json
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import UserContext, get_user_context
from app.db.session import get_db
from app.schemas.chat import ChatRequest
from app.services import chat_pipeline, guardrails, llm_client, sanitizer

router = APIRouter()


async def _event_stream(
    prepared: chat_pipeline.PreparedChatTurn,
    message: str,
    db: AsyncSession | None,
    redis: Any,
    preferred_lang: str | None = None,
) -> AsyncIterator[str]:
    if prepared.immediate_reply is not None:
        yield f"data: {json.dumps({'chunk': prepared.immediate_reply, 'done': False})}\n\n"
        done_payload = {
            "chunk": "",
            "done": True,
            "cached": prepared.cached,
            "sessionId": str(prepared.session_id) if prepared.session_id is not None else None,
            "sources": prepared.sources,
        }
        yield f"data: {json.dumps(done_payload)}\n\n"
        return

    lang = prepared.lang or guardrails.detect_language(message, preferred_lang=preferred_lang)
    raw_chunks: list[str] = []
    async for chunk in llm_client.stream(prepared.prompt or message):
        raw_chunks.append(chunk)
        if chunk == llm_client.OFFLINE_FALLBACK_MESSAGE:
            emitted = sanitizer.sanitize_output(
                chat_pipeline.offline_grounded_reply(prepared.knowledge, lang=lang)
            )
        else:
            emitted = sanitizer.sanitize_output(chunk)
        yield f"data: {json.dumps({'chunk': emitted, 'done': False})}\n\n"

    full_raw = "".join(raw_chunks) or llm_client.OFFLINE_FALLBACK_MESSAGE
    final_reply = await chat_pipeline.finalize_chat_turn(
        prepared,
        message,
        full_raw,
        db=db,
        redis=redis,
        preferred_lang=preferred_lang,
    )
    done_payload: dict[str, Any] = {
        "chunk": "",
        "done": True,
        "cached": False,
        "sessionId": str(prepared.session_id) if prepared.session_id is not None else None,
        "sources": prepared.sources if not prepared.guarded else [],
    }
    if prepared.guarded:
        done_payload["replacement"] = final_reply
    yield f"data: {json.dumps(done_payload)}\n\n"


@router.post("/stream")
async def stream_message(
    req: ChatRequest,
    user: UserContext = Depends(get_user_context),
    db: AsyncSession = Depends(get_db),
    redis: Any = Depends(chat_pipeline.get_redis),
):
    prepared = await chat_pipeline.prepare_chat_turn(
        req.message,
        user=user,
        db=db,
        redis=redis,
        session_id=req.sessionId,
        preferred_lang=req.language,
    )
    return StreamingResponse(
        _event_stream(
            prepared,
            req.message,
            db=db,
            redis=redis,
            preferred_lang=req.language,
        ),
        media_type="text/event-stream",
    )
