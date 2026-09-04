"""Parse LLM text responses into JSON (handles fences, prose wrappers, empty replies)."""

from __future__ import annotations

import json
import re
from typing import Any


def parse_llm_json(text: str) -> Any | None:
    """Extract and parse a JSON value from model output.

    Returns None when the response is empty or not valid JSON, so callers can
    fall back instead of crashing with JSONDecodeError.
    """
    if text is None:
        return None
    cleaned = text.strip()
    if not cleaned:
        return None

    # Strip markdown code fences: ```json ... ``` or ``` ... ```
    fence = re.match(r"^```(?:json|JSON)?\s*\n?(.*?)\n?```\s*$", cleaned, re.DOTALL)
    if fence:
        cleaned = fence.group(1).strip()
    else:
        cleaned = cleaned.removeprefix("```json").removeprefix("```JSON").removeprefix("```")
        cleaned = cleaned.removesuffix("```").strip()

    if not cleaned:
        return None

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Model often wraps JSON in prose — take first {...} or [...] block.
    for pattern in (r"\{[\s\S]*\}", r"\[[\s\S]*\]"):
        match = re.search(pattern, cleaned)
        if not match:
            continue
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            continue
    return None
