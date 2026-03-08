"""
FastAPI application for bias detection service.
Composes middleware, exception handlers, and routers.
"""

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from . import app_exceptions, deps, middleware as app_middleware
from .bootstrap import configure
from .config import settings
from .routers import (
    analytics_router,
    bias_analysis_router,
    errors_router,
    health_router,
    models_router,
)

configure()
logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Startup and shutdown lifecycle (replaces deprecated on_event)."""
    logger.info("Starting bias detection service", version=settings.app_version)
    initialized = await deps.bias_detection_service.initialize()
    if not initialized:
        logger.error("Failed to initialize bias detection service")
        raise RuntimeError("Service initialization failed")
    logger.info("Bias detection service started successfully")
    try:
        yield
    finally:
        logger.info("Shutting down bias detection service")
        await deps.bias_detection_service.shutdown()
        logger.info("Bias detection service shutdown completed")


def create_app() -> FastAPI:
    """Create FastAPI application with middleware, exception handlers, and routers."""
    app = FastAPI(
        title="Bias Detection Service",
        description="AI-powered bias detection service with TensorFlow/PyTorch integration",
        version=settings.app_version,
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
        openapi_url="/openapi.json" if settings.debug else None,
        lifespan=lifespan,
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

    app_exceptions.register_exception_handlers(app)

    # Routers
    app.include_router(health_router)
    app.include_router(bias_analysis_router)
    app.include_router(analytics_router)
    app.include_router(models_router)
    app.include_router(errors_router)

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
