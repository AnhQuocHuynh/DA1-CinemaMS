import hashlib
import re

BYPASS_KEYWORDS = ("today", "tonight", "now", "seats left", "order #", "booking")
_PREFIXES = re.compile(r"^(hi|hello|please tell me)\b\s*", re.IGNORECASE)


def normalize(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]", "", text)
    text = _PREFIXES.sub("", text)
    return re.sub(r"\s+", " ", text).strip()


def exact_key(text: str) -> str:
    return "cache:chat:exact:" + hashlib.sha256(normalize(text).encode()).hexdigest()


def should_bypass(text: str) -> bool:
    lowered = text.lower()
    return any(k in lowered for k in BYPASS_KEYWORDS)


# TODO: L1 Redis get/set (24h TTL); L2 pgvector semantic cache (>= 0.94, 7d TTL)

