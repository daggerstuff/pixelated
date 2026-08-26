"""
Lazy loading proxy for optional or environment-sensitive torch imports
inside the multimodal bias detection service.
"""

from __future__ import annotations

from importlib import import_module
from types import ModuleType
from typing import Any

_torch_module: ModuleType | None = None
_torch_import_error: Exception | None = None


def _load_torch() -> ModuleType:
    global _torch_module
    global _torch_import_error

    if _torch_module is not None:
        return _torch_module

    if _torch_import_error is not None:
        raise _torch_import_error

    try:
        _torch_module = import_module("torch")
        return _torch_module
    except Exception as exc:
        _torch_import_error = RuntimeError(
            "torch is unavailable in this environment; loading is intentionally deferred."
        )
        _torch_import_error.__cause__ = exc
        raise _torch_import_error


class _TorchModuleProxy:
    """Proxy object for :mod:`torch` that defers import until first attribute access."""

    def __getattr__(self, name: str) -> Any:
        return getattr(_load_torch(), name)

    def __dir__(self) -> list[str]:
        try:
            return dir(_load_torch())
        except Exception:
            return []


class _TorchAttrProxy:
    """Proxy for an attribute on the lazily imported torch module."""

    def __init__(self, attribute: str) -> None:
        self._attribute = attribute

    def __getattr__(self, name: str) -> Any:
        return getattr(getattr(_load_torch(), self._attribute), name)

    def __call__(self, *args: Any, **kwargs: Any) -> Any:
        return self._getattr_callable()(*args, **kwargs)

    def _getattr_callable(self) -> Any:
        return getattr(_load_torch(), self._attribute)


nn = _TorchAttrProxy("nn")
torch = _TorchModuleProxy()
