"""
Global exception handlers for the FastAPI application.
"""

import sentry_sdk
import structlog
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import ValidationError

logger = structlog.get_logger(__name__)


def register_exception_handlers(app: FastAPI) -> None:
    """Register all global exception handlers on the app."""
    app.add_exception_handler(ValidationError, validation_exception_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(Exception, general_exception_handler)


async def validation_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle Pydantic validation errors. Handler is registered for ValidationError only."""
    assert isinstance(exc, ValidationError)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "validation_error",
            "message": "Request validation failed",
            "details": exc.errors(),
            "request_id": request.headers.get("X-Request-ID"),
        },
    )


async def http_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle HTTP exceptions. Handler is registered for HTTPException only."""
    assert isinstance(exc, HTTPException)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "http_error",
            "message": exc.detail,
            "request_id": request.headers.get("X-Request-ID"),
        },
    )


async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle unhandled exceptions."""
    logger.error(
        "Unhandled exception",
        error=str(exc),
        request_id=request.headers.get("X-Request-ID"),
        method=request.method,
        url=str(request.url),
    )
    sentry_sdk.capture_exception(exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "internal_server_error",
            "message": "An internal server error occurred",
            "request_id": request.headers.get("X-Request-ID"),
        },
    )
