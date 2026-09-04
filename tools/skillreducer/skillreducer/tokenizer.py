from __future__ import annotations

import tiktoken

_ENCODER: tiktoken.Encoding | None = None


def get_encoder() -> tiktoken.Encoding:
    global _ENCODER
    if _ENCODER is None:
        _ENCODER = tiktoken.get_encoding("cl100k_base")
    return _ENCODER


def count_tokens(text: str) -> int:
    if not text:
        return 0
    return len(get_encoder().encode(text))
