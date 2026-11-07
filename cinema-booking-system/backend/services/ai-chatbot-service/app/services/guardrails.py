import re

from fastapi import HTTPException

from app.core.config import settings

INJECTION_PATTERN = re.compile(
    r"(ignore\s+(all\s+)?previous\s+instructions|system\s+prompt|dan\s+mode|jailbreak"
    r"|you\s+are\s+now|developer\s+mode|bypass\s+rules)",
    re.IGNORECASE,
)

REFUSAL_MESSAGE = (
    "I am CineBot, your cinema assistant. I can only assist with movie information, "
    "showtimes, cinema policies, and ticket booking inquiries. "
    "How can I help you with our movies today?"
)

INTENTS = ("CINEMA_FAQ", "MOVIE_QUERY", "SHOWTIME_QUERY", "OFF_TOPIC", "ADVERSARIAL")


def validate_length(message: str) -> None:
    if len(message) > settings.MAX_MESSAGE_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Message exceeds {settings.MAX_MESSAGE_LENGTH} characters",
        )


def is_injection(message: str) -> bool:
    return bool(INJECTION_PATTERN.search(message))


async def classify_intent(message: str) -> str:
    """TODO: call fast LLM (temperature 0, max 20 tokens) to classify intent."""
    raise NotImplementedError

