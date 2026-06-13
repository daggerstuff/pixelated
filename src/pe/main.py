"""Pixelated Empathy — FastAPI Application Entry Point.

Multi-tenant clinical simulation platform backend.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

import structlog
from fastapi import FastAPI, Request
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

    # Shutdown
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
    allow_methods=["*"],
    allow_headers=["*"],
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
    """Catch-all exception handler."""
    logger.error(
        "unhandled_exception",
        path=request.url.path,
        error=str(exc),
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
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
