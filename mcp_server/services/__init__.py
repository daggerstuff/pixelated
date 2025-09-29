"""Lightweight services package initializer.

Avoid importing submodules at package import time because many service
modules pull in optional heavy dependencies (redis, motor, socketio, etc.).
Tests import individual service modules directly (for example
``from services.integration_manager import IntegrationManager``) so
we keep this __init__ minimal to make package import-safe during test
collection.
"""

__all__ = []


def _lazy_import(name: str):
    # Import submodule on demand using absolute path so callers can still do
    # `import mcp_server.services` and then access submodules lazily.
    module_name = f"mcp_server.services.{name}"
    module = __import__(module_name, fromlist=[name])
    return module


def __getattr__(name: str):
    try:
        return _lazy_import(name)
    except Exception as e:
        raise AttributeError(f"module 'mcp_server.services' has no attribute '{name}'") from e
