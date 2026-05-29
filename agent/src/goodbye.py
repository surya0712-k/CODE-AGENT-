"""Detect when the user wants to end the voice call."""

from __future__ import annotations

import re

# Explicit hang-up phrases.
_EXPLICIT_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p, re.IGNORECASE)
    for p in (
        r"\b(end\s+(the\s+)?call|hang\s*up|hangup|disconnect|leave\s+(the\s+)?call)\b",
        r"\b(good\s*bye|goodbye|bye\s*bye)\b",
        r"\b(see\s+you|talk\s+to\s+you\s+later|catch\s+you\s+later)\b",
        r"\b(that'?s\s+all|i'?m\s+done|we'?re\s+done|stop\s+(the\s+)?call)\b",
        r"\b(close\s+(the\s+)?call|quit\s+(the\s+)?call|exit\s+(the\s+)?call)\b",
    )
)

_SHORT_EXACT = frozenset(
    {
        "bye",
        "goodbye",
        "good bye",
        "end call",
        "hang up",
        "see you",
        "thanks bye",
        "ok bye",
        "okay bye",
    }
)

_FAREWELL_EDGE = re.compile(
    r"(?:^|\b)(?:bye|goodbye|good\s*bye)(?:\s*!?\s*)$",
    re.IGNORECASE,
)


def looks_like_goodbye(text: str) -> bool:
    """Return True if the user transcript is likely a request to end the call."""
    normalized = re.sub(r"[^\w\s']", " ", text.strip().lower())
    normalized = re.sub(r"\s+", " ", normalized).strip()
    if not normalized:
        return False
    if normalized in _SHORT_EXACT:
        return True
    if _FAREWELL_EDGE.search(normalized):
        return True
    return any(pattern.search(normalized) for pattern in _EXPLICIT_PATTERNS)
