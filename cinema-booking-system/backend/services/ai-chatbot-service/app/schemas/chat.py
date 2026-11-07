from uuid import UUID

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    sessionId: UUID | None = None
    message: str = Field(min_length=1)


class ChatResponse(BaseModel):
    sessionId: UUID | None = None
    reply: str
    cached: bool = False
    suggestedFollowUps: list[str] = []

