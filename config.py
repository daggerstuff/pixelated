"""Compatibility shim for tests that import `config` at top-level.

This module lazily re-exports MCPConfig, get_config, and settings from
`mcp_server.config` to avoid duplicating configuration logic.
"""
from importlib import import_module
from types import ModuleType
from typing import Any


def _load() -> ModuleType:
    return import_module("mcp_server.config")


def __getattr__(name: str) -> Any:
    mod = _load()
    return getattr(mod, name)


def __dir__() -> list[str]:
    mod = _load()
    return sorted([*dir(mod)])
