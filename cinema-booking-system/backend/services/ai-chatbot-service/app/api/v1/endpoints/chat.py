from fastapi import APIRouter, Depends, HTTPException

from app.core.security import UserContext, get_user_context
from app.schemas.chat import ChatRequest, ChatResponse
from app.services import guardrails

router = APIRouter()


@router.post("/message", response_model=ChatResponse)
async def send_message(req: ChatRequest, user: UserContext = Depends(get_user_context)):
    guardrails.validate_length(req.message)
    if guardrails.is_injection(req.message):
        return ChatResponse(
            sessionId=req.sessionId, reply=guardrails.REFUSAL_MESSAGE, cached=False
        )
    # TODO: cache lookup -> intent -> RAG / downstream -> LLM -> sanitize -> persist
    raise HTTPException(status_code=501, detail="Not implemented")

