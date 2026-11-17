from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    sessionId: UUID | None = None
    message: str = Field(min_length=1)


class SourceSchema(BaseModel):
    type: str
    id: int | str | None = None
    title: str
    snippet: str = ""
    similarity: float | None = None


class ChatResponse(BaseModel):
    sessionId: UUID | None = None
    reply: str
    cached: bool = False
    suggestedFollowUps: list[str] = []
    sources: list[SourceSchema] = []


class ChatMessageSchema(BaseModel):
    id: int
    role: str
    content: str
    cached: bool = False
    createdAt: datetime | str | None = None


class ChatSessionSummarySchema(BaseModel):
    id: UUID
    title: str | None = None
    createdAt: datetime | str | None = None
    updatedAt: datetime | str | None = None


class ChatSessionDetailSchema(ChatSessionSummarySchema):
    messages: list[ChatMessageSchema] = []
