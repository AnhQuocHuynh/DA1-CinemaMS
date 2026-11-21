from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import UserContext, ensure_authenticated_user, require_authenticated_user
from app.db.session import get_db
from app.schemas.chat import (
    ChatSessionDetailSchema,
    ChatSessionSummarySchema,
    CreateSessionRequest,
    RenameSessionRequest,
)
from app.services import session_service

router = APIRouter()


@router.get("/sessions", response_model=list[ChatSessionSummarySchema])
async def list_sessions(
    user: UserContext = Depends(require_authenticated_user),
    db: AsyncSession = Depends(get_db),
):
    user = ensure_authenticated_user(user)
    return await session_service.list_user_sessions(db, user)


@router.post("/sessions", response_model=ChatSessionSummarySchema)
async def create_session(
    req: CreateSessionRequest | None = Body(default=None),
    user: UserContext = Depends(require_authenticated_user),
    db: AsyncSession = Depends(get_db),
):
    user = ensure_authenticated_user(user)
    title = req.title if req is not None else None
    return await session_service.create_user_session(db, user, title=title)


@router.get("/sessions/{session_id}", response_model=ChatSessionDetailSchema)
async def get_session(
    session_id: UUID,
    user: UserContext = Depends(require_authenticated_user),
    db: AsyncSession = Depends(get_db),
):
    user = ensure_authenticated_user(user)
    detail = await session_service.get_session_detail(db, session_id, user)
    if detail is None:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return detail


@router.patch("/sessions/{session_id}", response_model=ChatSessionSummarySchema)
async def rename_session(
    session_id: UUID,
    req: RenameSessionRequest,
    user: UserContext = Depends(require_authenticated_user),
    db: AsyncSession = Depends(get_db),
):
    user = ensure_authenticated_user(user)
    updated = await session_service.rename_user_session(db, session_id, user, req.title)
    if updated is None:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return updated


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(
    session_id: UUID,
    user: UserContext = Depends(require_authenticated_user),
    db: AsyncSession = Depends(get_db),
):
    user = ensure_authenticated_user(user)
    deleted = await session_service.delete_user_session(db, session_id, user)
    if not deleted:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return None
