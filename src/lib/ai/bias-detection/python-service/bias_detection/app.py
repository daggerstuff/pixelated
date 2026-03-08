"""
FastAPI application for bias detection service.
Composes middleware, exception handlers, and routers.
"""

import os

import structlog
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import ValidationError

from . import app_exceptions, deps, middleware as app_middleware
from .config import settings
from .routers import (
    analytics_router,
    bias_analysis_router,
    errors_router,
    health_router,
    models_router,
)
from .sentry_metrics import init_sentry

# Initialize Sentry early (no-op if SENTRY_DSN not set)
init_sentry(
    dsn=os.environ.get("SENTRY_DSN"),
    environment=os.environ.get("SENTRY_ENVIRONMENT", "bias-detection-service"),
    release=os.environ.get("SENTRY_RELEASE", settings.app_version),
)

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer(),
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger(__name__)


def create_app() -> FastAPI:
    """Create FastAPI application with middleware, exception handlers, and routers."""
    app = FastAPI(
        title="Bias Detection Service",
        description="AI-powered bias detection service with TensorFlow/PyTorch integration",
        version=settings.app_version,
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
        openapi_url="/openapi.json" if settings.debug else None,
    )

    # Middleware (order: last added = outermost)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    app_middleware.register(app)

    # Exception handlers
    app.add_exception_handler(ValidationError, app_exceptions.validation_exception_handler)
    app.add_exception_handler(HTTPException, app_exceptions.http_exception_handler)
    app.add_exception_handler(Exception, app_exceptions.general_exception_handler)

    # Routers
    app.include_router(health_router)
    app.include_router(bias_analysis_router)
    app.include_router(analytics_router)
    app.include_router(models_router)
    app.include_router(errors_router)

    # Lifecycle
    @app.on_event("startup")
    async def startup_event():
        logger.info("Starting bias detection service", version=settings.app_version)
        initialized = await deps.bias_detection_service.initialize()
        if not initialized:
            logger.error("Failed to initialize bias detection service")
            raise RuntimeError("Service initialization failed")
        logger.info("Bias detection service started successfully")

    @app.on_event("shutdown")
    async def shutdown_event():
        logger.info("Shutting down bias detection service")
        await deps.bias_detection_service.shutdown()
        logger.info("Bias detection service shutdown completed")

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "bias_detection.app:app",
        host=settings.host,
        port=settings.port,
        workers=settings.workers,
        reload=settings.debug,
        log_level=settings.log_level.lower(),
    )
