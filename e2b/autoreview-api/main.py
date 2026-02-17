"""
AutoReview AI — FastAPI Application.

Main entry point with CORS, auth middleware,
and route mounts.
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from middleware import AuthMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("autoreview")


def create_app() -> FastAPI:
    """Application factory."""
    settings = get_settings()

    application = FastAPI(
        title=settings.app_name,
        description=("Backend API for AutoReview AI — autonomous PR review and fixing SaaS."),
        version="0.1.0",
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
    )

    # ── CORS ─────────────────────────────────────
    application.add_middleware(
        CORSMiddleware,
        allow_origins=[
            settings.frontend_url,
            "http://localhost:8765",
            "http://localhost:3000",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Auth Middleware ───────────────────────────
    application.add_middleware(AuthMiddleware)

    # ── Routes ───────────────────────────────────
    from routes.auth import router as auth_router
    from routes.billing import router as billing_router
    from routes.github_app import router as github_router
    from routes.usage import router as usage_router

    application.include_router(auth_router, prefix="/auth", tags=["auth"])
    application.include_router(billing_router, prefix="/billing", tags=["billing"])
    application.include_router(github_router, prefix="/github", tags=["github"])
    application.include_router(usage_router, prefix="/usage", tags=["usage"])

    # ── Health Check ─────────────────────────────
    @application.get("/health")
    async def health():
        return {
            "status": "ok",
            "service": settings.app_name,
            "environment": settings.environment,
        }

    @application.get("/")
    async def root():
        return {
            "name": settings.app_name,
            "docs": "/docs",
        }

    logger.info(
        "AutoReview AI API ready (%s)",
        settings.environment,
    )
    return application


app = create_app()

if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.debug,
    )
