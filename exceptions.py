"""Compatibility shim re-exporting exceptions from `mcp_server.exceptions`.

Tests import `exceptions` at top-level; re-export common exception names lazily.
"""
from importlib import import_module
from types import ModuleType
from typing import Any


def _load() -> ModuleType:
    return import_module('mcp_server.exceptions')


def __getattr__(name: str) -> Any:
    mod = _load()
    return getattr(mod, name)


def __dir__() -> list[str]:
    mod = _load()
    return sorted([*dir(mod)])
