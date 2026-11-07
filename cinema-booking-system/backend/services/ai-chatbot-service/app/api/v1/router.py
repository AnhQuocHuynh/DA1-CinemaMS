from fastapi import APIRouter

from app.api.v1.endpoints import chat, sessions, stream

api_router = APIRouter()
api_router.include_router(chat.router)
api_router.include_router(stream.router)
api_router.include_router(sessions.router)

