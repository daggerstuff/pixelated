"""Pixelated Empathy — FastAPI Application Entry Point.

Multi-tenant clinical simulation platform backend.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

import structlog
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.pe.api import api_v1_router
from src.pe.config import settings
from src.pe.database import close_db, init_db
from src.pe.logging_config import setup_logging

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, Any]:
    """Application lifespan: startup and shutdown events."""
    # Startup
    setup_logging(settings.LOG_LEVEL)
    logger.info(
        "application_starting",
        name=settings.APP_NAME,
        debug=settings.DEBUG,
    )
    await init_db()

    yield

    logger.info("application_shutting_down", phase="drain")
    await close_db()
    logger.info("application_stopped")


app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    description="Multi-tenant clinical simulation platform. Zero-PHI by design.",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# ── Middleware ─────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next: Any) -> Any:
    """Log all HTTP requests."""
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(
        method=request.method,
        path=request.url.path,
        request_id=request.headers.get("X-Request-ID", "unknown"),
    )

    response = await call_next(request)

    logger.info(
        "request_completed",
        status_code=response.status_code,
    )
    return response


# ── Exception Handlers ────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all exception handler with error classification."""
    error_type = type(exc).__name__
    error_category = "internal_error"

    if isinstance(exc, (ValueError, TypeError)):
        error_category = "validation_error"
        status_code = 422
    elif isinstance(exc, (HTTPException,)):
        error_category = "http_error"
        status_code = exc.status_code if hasattr(exc, "status_code") else 500
    elif "timeout" in str(exc).lower() or "timed out" in str(exc).lower():
        error_category = "timeout_error"
        status_code = 504
    else:
        status_code = 500

    logger.error(
        "unhandled_exception",
        path=request.url.path,
        error=str(exc),
        error_type=error_type,
        error_category=error_category,
        exc_info=True,
    )

    detail_message = "Internal server error"
    if settings.DEBUG:
        detail_message = f"{error_category}: {exc!s}"

    return JSONResponse(
        status_code=status_code,
        content={"detail": detail_message, "error_category": error_category},
    )


# ── Routes ────────────────────────────────────────────────────────
app.include_router(api_v1_router)


@app.get("/")
async def root() -> dict:
    """Root endpoint — API information."""
    return {
        "name": settings.APP_NAME,
        "version": "0.1.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health() -> dict:
    """Health check endpoint."""
    return {"status": "ok", "name": settings.APP_NAME}
