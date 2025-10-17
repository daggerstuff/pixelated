"""
Minimal logging middleware shim for tests.

Provides a pass-through BaseHTTPMiddleware compatible middleware so tests
and app initialization can import and register it without pulling in
heavy logging dependencies.
"""
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class LoggingMiddleware(BaseHTTPMiddleware):
    """Simple no-op logging middleware for test compatibility.

    The middleware accepts a `config` object during construction (as the
    real implementation would) but does not perform any logging. It simply
    delegates to the next ASGI app.
    """

    def __init__(self, app, config: Any = None):
        super().__init__(app)
        self.config = config

    async def dispatch(self, request: Request, call_next) -> Response:
        # No-op: forward the request to the next handler
        return await call_next(request)


__all__ = ["LoggingMiddleware"]
