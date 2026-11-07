from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.core.security import UserContext, get_user_context

router = APIRouter()


@router.get("/sessions")
async def list_sessions(user: UserContext = Depends(get_user_context)):
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/sessions/{session_id}")
async def get_session(session_id: UUID, user: UserContext = Depends(get_user_context)):
    raise HTTPException(status_code=501, detail="Not implemented")


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(session_id: UUID, user: UserContext = Depends(get_user_context)):
    raise HTTPException(status_code=501, detail="Not implemented")

