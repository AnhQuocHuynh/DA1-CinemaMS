from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import UserContext, get_user_context
from app.db.session import get_db
from app.schemas.chat import ChatRequest, ChatResponse
from app.services import chat_pipeline, llm_client

router = APIRouter()


@router.post("/message", response_model=ChatResponse)
async def send_message(
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
    if prepared.immediate_reply is not None:
        return ChatResponse(
            sessionId=prepared.session_id,
            reply=prepared.immediate_reply,
            cached=prepared.cached,
            suggestedFollowUps=prepared.follow_ups,
            sources=prepared.sources,
        )

    raw_reply = await llm_client.generate(prepared.prompt or req.message)
    final_reply = await chat_pipeline.finalize_chat_turn(
        prepared,
        req.message,
        raw_reply,
        db=db,
        redis=redis,
        preferred_lang=req.language,
    )
    return ChatResponse(
        sessionId=prepared.session_id,
        reply=final_reply,
        cached=False,
        suggestedFollowUps=prepared.follow_ups,
        sources=prepared.sources if not prepared.guarded else [],
    )
