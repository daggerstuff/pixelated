from __future__ import annotations

import re

from skillreducer.tokenizer import count_tokens


def remove_overlap(reference: str, body: str, min_tokens: int = 30) -> str | None:
    body_lines = {line.strip().lower() for line in body.splitlines() if line.strip()}
    kept: list[str] = []
    for line in reference.splitlines():
        normalized = line.strip()
        if not normalized:
            kept.append(line)
            continue
        if normalized.lower() in body_lines:
            continue
        if _line_overlap_ratio(normalized, body) > 0.85:
            continue
        kept.append(line)
    result = "\n".join(kept).strip()
    if count_tokens(result) < min_tokens:
        return None
    return result


def _line_overlap_ratio(line: str, body: str) -> float:
    words = set(re.findall(r"\w+", line.lower()))
    if not words:
        return 0.0
    body_words = set(re.findall(r"\w+", body.lower()))
    return len(words & body_words) / len(words)
