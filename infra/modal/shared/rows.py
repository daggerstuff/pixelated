"""Canonical JSONL row handling shared by the Modal workloads.

The repo's corpora come in two shapes:

* `{"messages": [{"role": ..., "content": ...}, ...]}` — chat rows, the shape
  `dataset/final_dataset.jsonl` uses and the one SFT training wants.
* `{"text": ...}` (or `{"content": ...}`) — plain completion rows.

Everything the dataset and training apps read goes through `normalize_row`, so a
corpus may mix both shapes and the remote job still sees one canonical form.
The helpers are pure and import nothing heavy: the offline tests exercise them
without a Modal account, and the container-side code imports them unchanged.
"""

from __future__ import annotations

import json
import random
from collections.abc import Sequence
from pathlib import Path
from typing import Any

CHAT_KEY = "messages"

TEXT_KEYS = ("text", "content")


def _normalize_message(message: Any) -> dict[str, str] | None:
    """Return `{"role", "content"}` for a usable message, else None."""
    if not isinstance(message, dict):
        return None
    role = str(message.get("role") or "").strip()
    content = str(message.get("content") or "").strip()
    if not role or not content:
        return None
    return {"role": role, "content": content}


def normalize_row(payload: Any) -> dict[str, Any] | None:
    """Return a canonical row for `payload`, or None when it carries no content.

    Chat rows keep their messages (dropping unusable ones); text rows collapse
    to `{"text": ...}`. Anything else — a bare string, an empty object, a row
    whose content is whitespace — is skipped by the caller.
    """
    if not isinstance(payload, dict):
        return None

    messages = payload.get(CHAT_KEY)
    if isinstance(messages, list):
        cleaned = [_normalize_message(message) for message in messages]
        usable = [message for message in cleaned if message is not None]
        if usable:
            return {CHAT_KEY: usable}

    for key in TEXT_KEYS:
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return {"text": value.strip()}
    return None


def parse_jsonl(text: str) -> list[dict[str, Any]]:
    """Parse JSONL text into canonical rows.

    Blank lines are ignored. A malformed line fails loudly with its number, so a
    corrupt corpus surfaces at the start of a job instead of silently shrinking
    the dataset.
    """
    rows: list[dict[str, Any]] = []
    for number, raw in enumerate(text.splitlines(), start=1):
        entry = raw.strip()
        if not entry:
            continue
        try:
            payload = json.loads(entry)
        except json.JSONDecodeError as error:
            raise ValueError(f"line {number}: invalid JSON ({error.msg})") from error
        row = normalize_row(payload)
        if row is not None:
            rows.append(row)
    return rows


def read_rows(path: Path) -> list[dict[str, Any]]:
    """Read a JSONL corpus from disk, raising a path-specific error if absent."""
    if not path.is_file():
        raise FileNotFoundError(f"dataset not found: {path}")
    return parse_jsonl(path.read_text(encoding="utf-8"))


def row_key(row: dict[str, Any]) -> str:
    """Return a stable key so equal rows dedupe regardless of key order."""
    return json.dumps(row, sort_keys=True, ensure_ascii=False)


def dedupe(rows: Sequence[dict[str, Any]]) -> list[dict[str, Any]]:
    """Drop repeated rows, keeping first-seen order."""
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for row in rows:
        key = row_key(row)
        if key in seen:
            continue
        seen.add(key)
        unique.append(row)
    return unique


def render_text(row: dict[str, Any]) -> str:
    """Render a canonical row to the plain text a training job consumes."""
    messages = row.get(CHAT_KEY)
    if isinstance(messages, list) and messages:
        return "\n".join(f"{message['role']}: {message['content']}" for message in messages)
    return str(row.get("text", "")).strip()


def filter_min_chars(rows: Sequence[dict[str, Any]], minimum: int) -> list[dict[str, Any]]:
    """Keep rows whose rendered text is at least `minimum` characters long."""
    return [row for row in rows if len(render_text(row)) >= minimum]


def split_rows(
    rows: Sequence[dict[str, Any]],
    *,
    val_fraction: float = 0.0,
    seed: int = 13,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Split rows into `(train, val)` deterministically.

    `val_fraction` of 0 keeps everything for training. A split always leaves at
    least one training row, so a tiny corpus cannot produce an empty train set.
    """
    if not 0.0 <= val_fraction < 1.0:
        raise ValueError("val_fraction must be in [0, 1)")

    shuffled = list(rows)
    if val_fraction == 0.0 or len(shuffled) < 2:
        return shuffled, []

    random.Random(seed).shuffle(shuffled)
    size = min(max(1, round(len(shuffled) * val_fraction)), len(shuffled) - 1)
    return shuffled[size:], shuffled[:size]


def write_jsonl(rows: Sequence[dict[str, Any]], path: Path) -> int:
    """Write canonical rows as JSONL and return the row count."""
    path.parent.mkdir(parents=True, exist_ok=True)
    body = "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows)
    path.write_text(body, encoding="utf-8")
    return len(rows)
