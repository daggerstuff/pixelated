"""Shared configuration and persistence for task sync providers."""

from __future__ import annotations

import json
import os
from collections.abc import Mapping
from pathlib import Path
from typing import Any

DEFAULT_CONFIG_PATH = Path(".agent/internal/config.json")

def _strip_env(name: str) -> str:
    return os.getenv(name, "").strip()

def _load_internal_config(config_path: Path | None = None) -> dict[str, Any]:
    path = config_path or DEFAULT_CONFIG_PATH
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}

def _write_internal_config(payload: Mapping[str, Any], config_path: Path | None = None) -> None:
    path = config_path or DEFAULT_CONFIG_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    existing = _load_internal_config(path)
    existing.update(payload)
    path.write_text(json.dumps(existing, indent=2, sort_keys=True) + "\n", encoding="utf-8")
