import re
import unicodedata


def _is_emoji_codepoint(cp: int) -> bool:
    return (
        cp == 0x200D
        or cp == 0xFE0F
        or 0x2600 <= cp <= 0x27BF
        or 0x1F000 <= cp <= 0x1FAFF
    )


def _word_pattern(folded_title: str) -> re.Pattern[str]:
    return re.compile(rf"(?<!\w){re.escape(folded_title)}(?!\w)")


def fold(text: str | None) -> str:
    """Lowercase, map Vietnamese đ/Đ to d, strip combining marks, and collapse whitespace."""
    if not text:
        return ""
    lowered = text.replace("Đ", "d").replace("đ", "d").lower()
    normalized = unicodedata.normalize("NFD", lowered)
    without_marks = "".join(
        ch for ch in normalized if not unicodedata.category(ch).startswith("M")
    )
    return " ".join(without_marks.split())


def has_letter_or_digit(text: str | None) -> bool:
    """Return True if text contains at least one alphanumeric character."""
    if not text:
        return False
    return any(ch.isalnum() for ch in text)


def strip_emoji(text: str | None) -> str:
    """Remove emoji/symbol code points and strip surrounding whitespace."""
    if not text:
        return ""
    return "".join(ch for ch in text if not _is_emoji_codepoint(ord(ch))).strip()


def clip_snippet(text: str | None, max_chars: int) -> str:
    """Trim text to at most max_chars, preferring a late newline boundary when available."""
    if not text or max_chars <= 0:
        return ""
    trimmed = text.strip()
    if not trimmed:
        return ""
    if len(trimmed) <= max_chars:
        return trimmed

    head = trimmed[:max_chars]
    nl = head.rfind("\n")
    if nl >= max_chars // 2:
        return head[:nl].rstrip()
    return head.rstrip()


def mentions_foreign_title(
    answer: str, allowed_text: str, catalog_titles: list[str]
) -> bool:
    """Return True if answer mentions a catalog title (>= 4 alnum chars) absent from allowed_text."""
    folded_answer = fold(answer)
    if not folded_answer or not catalog_titles:
        return False

    folded_allowed = fold(allowed_text)
    candidates: set[str] = set()
    for raw_title in catalog_titles:
        ft = fold(raw_title)
        if sum(1 for ch in ft if ch.isalnum()) >= 4:
            candidates.add(ft)
    sorted_titles = sorted(candidates, key=lambda t: (-len(t), t))

    remaining = folded_answer
    for title in sorted_titles:
        pattern = _word_pattern(title)
        if folded_allowed and pattern.search(folded_allowed):
            remaining = pattern.sub(" ", remaining)
        elif pattern.search(remaining):
            return True
    return False


def guard_answer(
    answer: str, allowed_text: str, catalog_titles: list[str], refusal: str
) -> str:
    """Strip emoji and return refusal if the answer is blank or names a foreign catalog title."""
    cleaned = strip_emoji(answer)
    if not cleaned or mentions_foreign_title(cleaned, allowed_text, catalog_titles):
        return refusal
    return cleaned
