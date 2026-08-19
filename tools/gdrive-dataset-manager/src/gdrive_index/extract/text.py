from __future__ import annotations

from pathlib import Path

from . import truncate


def extract_text_file(path: Path) -> str:
    raw = path.read_bytes()
    return truncate(raw.decode("utf-8", errors="replace"))
