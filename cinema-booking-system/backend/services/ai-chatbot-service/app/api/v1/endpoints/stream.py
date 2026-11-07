import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.core.security import UserContext, get_user_context
from app.schemas.chat import ChatRequest
from app.services import guardrails

router = APIRouter()


async def _event_stream(req: ChatRequest) -> AsyncIterator[str]:
    # TODO: replace with real LLM token streaming
    text = guardrails.REFUSAL_MESSAGE if guardrails.is_injection(req.message) else "Not implemented"
    yield f"data: {json.dumps({'chunk': text, 'done': False})}\n\n"
    yield f"data: {json.dumps({'chunk': '', 'done': True})}\n\n"


@router.post("/stream")
async def stream_message(req: ChatRequest, user: UserContext = Depends(get_user_context)):
    guardrails.validate_length(req.message)
    return StreamingResponse(_event_stream(req), media_type="text/event-stream")

