"""Source discovery and loading for the fresh training corpus builder."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .model import CorpusSource
from .source_inventory import discover_approved_sources


def discover_sources(registry_path: Path) -> list[CorpusSource]:
    return list(discover_approved_sources(registry_path))


def load_records(source: CorpusSource) -> list[dict[str, Any]]:
    suffix = source.locator.suffix.lower()
    if suffix == ".jsonl":
        rows: list[dict[str, Any]] = []
        with open(source.locator, encoding="utf-8") as handle:
            for line in handle:
                stripped = line.strip()
                if not stripped:
                    continue
                raw = json.loads(stripped)
                if isinstance(raw, dict):
                    rows.append(raw)
        return rows

    if suffix == ".json":
        with open(source.locator, encoding="utf-8") as handle:
            payload = json.load(handle)
        if isinstance(payload, list):
            return [item for item in payload if isinstance(item, dict)]
        if isinstance(payload, dict):
            for key in ("records", "conversations", "items", "data"):
                value = payload.get(key)
                if isinstance(value, list):
                    return [item for item in value if isinstance(item, dict)]
            return [payload]

    return []
