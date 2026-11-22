import re

_PATTERNS = [
    (re.compile(r"local-dev-internal-token"), "[REDACTED]"),
    (re.compile(r"\b(?:\d[ -]?){13,19}\b"), "[REDACTED_CARD]"),
    (re.compile(r"eyJ[\w-]+\.[\w-]+\.[\w-]+"), "[REDACTED_JWT]"),
    (re.compile(r"Traceback \(most recent call last\):[\s\S]*"), "[REDACTED_TRACE]"),
]


def sanitize_output(text: str) -> str:
    for pattern, repl in _PATTERNS:
        text = pattern.sub(repl, text)
    return text

