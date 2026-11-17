import logging
import re

from fastapi import HTTPException

from app.core.config import settings
from app.services import llm_client

logger = logging.getLogger("cinebot.guardrails")

INJECTION_PATTERN = re.compile(
    r"(ignore\s+(all\s+)?previous\s+instructions|system\s+prompt|dan\s+mode|jailbreak"
    r"|you\s+are\s+now|developer\s+mode|bypass\s+rules"
    r"|bỏ\s+qua\s+(tất\s+cả\s+|mọi\s+)?(các\s+)?(hướng\s+dẫn|chỉ\s+thị)(\s+trước(\s+đó)?)?"
    r"|(bỏ\s+qua|vượt\s+qua)\s+quy\s+tắc"
    r"|(hiển\s+thị|tiết\s+lộ)\s+(system\s+prompt|hướng\s+dẫn\s+hệ\s+thống)"
    r"|chế\s+độ\s+nhà\s+phát\s+triển|bây\s+giờ\s+bạn\s+là)",
    re.IGNORECASE,
)

REFUSAL_MESSAGE = (
    "I am CineBot, your cinema assistant. I can only assist with movie information, "
    "showtimes, cinema policies, and ticket booking inquiries. "
    "How can I help you with our movies today?"
)

REFUSAL_MESSAGE_VI = (
    "Tôi là CineBot, trợ lý rạp chiếu phim của bạn. Tôi chỉ có thể hỗ trợ thông tin về phim, "
    "lịch chiếu, chính sách rạp và đặt vé. "
    "Hôm nay tôi có thể giúp gì cho bạn về các bộ phim của chúng tôi?"
)

INTENTS = ("CINEMA_FAQ", "MOVIE_QUERY", "SHOWTIME_QUERY", "OFF_TOPIC", "ADVERSARIAL")

_VI_CHAR_RE = re.compile(
    r"[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]",
    re.IGNORECASE,
)
_VI_ASCII_WORDS_RE = re.compile(
    r"\b(xin\s+chao|lich\s+chieu|suat\s+chieu|hoan\s+ve|huy\s+ve|dat\s+ve|ghe\s+doi|bap\s+nuoc)\b",
    re.IGNORECASE,
)

_SHOWTIME_RE = re.compile(
    r"\b(showtimes?|showing|schedules?|what\s+time|playing\s+today|playing\s+tonight"
    r"|times\s+for|time\s+is"
    r"|lịch\s+chiếu|suất\s+chiếu|chiếu\s+hôm\s+nay|chiếu\s+tối\s+nay|mấy\s+giờ\s+chiếu|giờ\s+chiếu)\b",
    re.IGNORECASE,
)
_POLICY_FAQ_RE = re.compile(
    r"\b(refund\w*|cancel\w*|polic\w*|vip|couple|imax|seats?|pric\w*|payments?"
    r"|stripe|paypal|vnpay|cash|popcorn|snacks?|food|drinks?|concessions?"
    r"|age\s+ratings?|t13|t16|t18|rentals?|rent(?:ing|ed)?|how\s+do\s+i\s+book|book(?:ing)?\s+tickets?"
    r"|hoàn\s+vé|hoàn\s+tiền|hủy\s+vé|đổi\s+vé|chính\s+sách|quy\s+định"
    r"|ghế\s+vip|ghế\s+đôi|ghế\s+thường|giá\s+vé|thanh\s+toán|tiền\s+mặt"
    r"|bắp\s+nước|đồ\s+ăn|thức\s+ăn|nước\s+uống|độ\s+tuổi|phân\s+loại\s+tuổi"
    r"|thuê\s+phòng|cách\s+đặt\s+vé|làm\s+sao\s+(để\s+)?đặt\s+vé)\b",
    re.IGNORECASE,
)
_MOVIE_RE = re.compile(
    r"\b(movies?|films?|recommend\w*|suggest\w*|synops\w*|plots?|storylines?|genres?|actors?|directors?|watch(?:ing)?"
    r"|bộ\s+phim|phim|gợi\s+ý|đề\s+xuất|nội\s+dung|cốt\s+truyện|tóm\s+tắt|thể\s+loại|diễn\s+viên|đạo\s+diễn)\b",
    re.IGNORECASE,
)
_GENERAL_FAQ_RE = re.compile(
    r"\b(cinemas?|tickets?|book(?:ing)?|hello|hi|hey|help"
    r"|rạp(\s+chiếu)?|đặt\s+vé|giá\s+vé|xin\s+chào|chào\s+bạn|trợ\s+giúp)\b",
    re.IGNORECASE,
)


def detect_language(text: str) -> str:
    """Detect whether text is Vietnamese ('vi') or English ('en')."""
    if _VI_CHAR_RE.search(text) or _VI_ASCII_WORDS_RE.search(text):
        return "vi"
    return "en"


def get_refusal_message(text: str) -> str:
    """Return the localized scope-refusal message matching the user's language."""
    return REFUSAL_MESSAGE_VI if detect_language(text) == "vi" else REFUSAL_MESSAGE


def validate_length(message: str) -> None:
    if len(message) > settings.MAX_MESSAGE_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Message exceeds {settings.MAX_MESSAGE_LENGTH} characters",
        )


def is_injection(message: str) -> bool:
    return bool(INJECTION_PATTERN.search(message))


def _heuristic_intent(message: str) -> str:
    if is_injection(message):
        return "ADVERSARIAL"
    if _SHOWTIME_RE.search(message):
        return "SHOWTIME_QUERY"
    if _POLICY_FAQ_RE.search(message):
        return "CINEMA_FAQ"
    if _MOVIE_RE.search(message):
        return "MOVIE_QUERY"
    if _GENERAL_FAQ_RE.search(message):
        return "CINEMA_FAQ"
    return "OFF_TOPIC"


async def classify_intent(message: str) -> str:
    """Classify user intent via fast LLM call, with deterministic heuristic fallback."""
    if is_injection(message):
        return "ADVERSARIAL"

    prompt = (
        "Classify the user message into exactly ONE category from: "
        f"{', '.join(INTENTS)}.\n"
        "Reply with the category name only.\n"
        f"User input: {message}\n"
        "Category:"
    )
    try:
        raw = await llm_client.generate(prompt, temperature=0.0, max_tokens=20)
        if raw and raw != llm_client.OFFLINE_FALLBACK_MESSAGE:
            upper = raw.strip().upper()
            for label in INTENTS:
                if label in upper:
                    return label
    except Exception:
        logger.warning("Intent classification LLM call failed; using heuristic", exc_info=True)

    return _heuristic_intent(message)
