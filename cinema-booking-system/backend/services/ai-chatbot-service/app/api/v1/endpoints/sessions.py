from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import UserContext, get_user_context
from app.db.session import get_db
from app.schemas.chat import ChatSessionDetailSchema, ChatSessionSummarySchema
from app.services import session_service

router = APIRouter()


@router.get("/sessions", response_model=list[ChatSessionSummarySchema])
async def list_sessions(
    user: UserContext = Depends(get_user_context),
    db: AsyncSession = Depends(get_db),
):
    return await session_service.list_user_sessions(db, user)


@router.get("/sessions/{session_id}", response_model=ChatSessionDetailSchema)
async def get_session(
    session_id: UUID,
    user: UserContext = Depends(get_user_context),
    db: AsyncSession = Depends(get_db),
):
    detail = await session_service.get_session_detail(db, session_id, user)
    if detail is None:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return detail


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(
    session_id: UUID,
    user: UserContext = Depends(get_user_context),
    db: AsyncSession = Depends(get_db),
):
    deleted = await session_service.delete_user_session(db, session_id, user)
    if not deleted:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return None
