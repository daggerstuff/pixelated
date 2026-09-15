"""Optional request profiling middleware for the pe service.

When enabled, each profiled request is recorded with cProfile and written
as a pstats file that `python -m pstats` (or snakeviz / speedscope) can
read. Profiling is disabled unless explicitly requested, so production
runs pay zero overhead:

- set PE_PROFILING_ENABLED=true to profile every request, or
- send X-Profile-Request: true to profile a single request (works with a
  short-lived debug port-forward even when the env var is off).

Files are written to PE_PROFILING_DIR (default: .profiles/) named by
request id + timestamp; the response carries X-Profile: <filename>.
"""

import contextlib
import cProfile
import itertools
import os
import time
from pathlib import Path
from typing import Any

import structlog
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

logger = structlog.get_logger(__name__)


class ProfilingMiddleware(BaseHTTPMiddleware):
    """cProfile-backed request profiler, opt-in via env or request header."""

    def __init__(self, app: Any) -> None:
        super().__init__(app)
        self.enabled = os.environ.get("PE_PROFILING_ENABLED", "").lower() in {"1", "true", "yes"}
        self.output_dir = Path(os.environ.get("PE_PROFILING_DIR", ".profiles"))
        self._sequence = itertools.count(1)

    def _should_profile(self, request: Request) -> bool:
        if self.enabled:
            return True
        return request.headers.get("x-profile-request", "").lower() in {"1", "true", "yes"}

    async def dispatch(self, request: Request, call_next: Any) -> Any:
        if not self._should_profile(request):
            return await call_next(request)

        self.output_dir.mkdir(parents=True, exist_ok=True)
        request_id = request.headers.get("X-Request-ID", request.url.path.strip("/").replace("/", "_") or "root")
        filename = f"{request.method.lower()}_{request_id}_{time.strftime('%Y%m%dT%H%M%S')}_{next(self._sequence)}.prof"
        profile = cProfile.Profile()
        profile.enable()
        try:
            response = await call_next(request)
        finally:
            profile.disable()
            profile.dump_stats(str(self.output_dir / filename))
            logger.info(
                "request_profiled",
                method=request.method,
                path=request.url.path,
                profile_file=filename,
            )
        with contextlib.suppress(RuntimeError):
            # streaming response already started; the file is still written
            response.headers["X-Profile"] = filename
        return response
