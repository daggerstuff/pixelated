"""
HTTP middleware: request ID, process time header, and Prometheus request metrics.
"""

import time

from fastapi import FastAPI, Request

from . import metrics


async def add_request_id(request: Request, call_next):
    """Add request ID to all requests and responses."""
    request_id = request.headers.get("X-Request-ID", str(time.time()))
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


async def add_process_time_and_metrics(request: Request, call_next):
    """Add X-Process-Time header and record request count/duration metrics."""
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    metrics.request_count.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code,
    ).inc()
    metrics.request_duration.labels(
        method=request.method, endpoint=request.url.path
    ).observe(process_time)
    return response


def register(app: FastAPI) -> None:
    """Register HTTP middleware on the app. Request-id is outermost; process-time/metrics inner."""
    app.middleware("http")(add_request_id)
    app.middleware("http")(add_process_time_and_metrics)
