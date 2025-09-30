"""Minimal rate_limit middleware shim used during test collection.

This file provides a tiny, import-safe `RateLimitMiddleware` to satisfy
imports in other modules. It intentionally contains no external dependencies
and performs no runtime side-effects.
"""
from typing import Callable, Any


class RateLimitMiddleware:
    """A no-op rate limiting middleware placeholder.

    Usage: used as a callable WSGI/ASGI middleware or middleware factory in
    tests/imports. It stores no state and simply passes through calls.
    """

    def __init__(self, app: Callable[..., Any] | None = None):
        self.app = app

    def __call__(self, *args, **kwargs):
        if self.app is None:
            # If used as a decorator/factory, return a callable that will call
            # the wrapped app when invoked.
            def _wrap(inner_app: Callable[..., Any]):
                def _wrapped(*a, **k):
                    return inner_app(*a, **k)

                return _wrapped

            return _wrap

        # If an app was provided, call it directly (pass-through).
        return self.app(*args, **kwargs)


__all__ = ["RateLimitMiddleware"]
