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
from .services.model_service import _load_transformers, _transformer_available

configure()
logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Startup and shutdown lifecycle (replaces deprecated on_event)."""
    logger.info("Starting bias detection service", version=settings.app_version)
    # Eagerly check that `transformers` is importable so any environment
    # misconfiguration (e.g. missing native libs for the `tokenizers` Rust
    # extension) is surfaced immediately at startup, not lazily on first request.
    _load_transformers()
    if not _transformer_available():
        raise RuntimeError(
            "transformers is not importable — check that libgomp1/libstdc++6 are "
            "installed and that the transformers package is present in the environment. "
            "See logged warnings above for the exact import error."
        )
    initialized = await deps.bias_detection_service.initialize()
    if not initialized:
        logger.warning(
            "Bias detection service initialized with degraded functionality "
            "(some components failed). Health endpoints will report details."
        )
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
    # Explicit origin allow-list required when allow_credentials=True (wildcard "*" is insecure)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allowed_origins,
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
