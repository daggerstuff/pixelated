"""
Shared service instances and FastAPI dependency getters.
Set in create_app() before including routers.
"""

from typing import cast

from fastapi import HTTPException, status

from .config import settings
from .models import BiasAnalysisRequest
from .services import BiasDetectionService, DatabaseService, database_service
from .services.analysis_orchestrator import AnalysisOrchestrator
from .services.cache_service import cache_service

# Populated in create_app()
bias_detection_service: BiasDetectionService = BiasDetectionService()
database_service_instance: DatabaseService = cast(DatabaseService, database_service)
analysis_orchestrator: AnalysisOrchestrator = AnalysisOrchestrator(
    bias_detection_service, database_service_instance
)


def get_bias_service() -> BiasDetectionService:
    return bias_detection_service


def get_database_service() -> DatabaseService:
    return database_service_instance


def get_analysis_orchestrator() -> AnalysisOrchestrator:
    return analysis_orchestrator


async def require_rate_limit(request: BiasAnalysisRequest) -> None:
    """
    FastAPI dependency: enforce per-user rate limit for analyze endpoint.
    Uses atomic increment-then-check so concurrent requests cannot bypass the limit.
    FastAPI injects the same parsed BiasAnalysisRequest for this dependency and the
    route handler, so the body is not read twice.
    """
    if not request.user_id:
        return
    key = f"user:{request.user_id}"
    count = await cache_service.increment_rate_limit_counter(key)
    if count > settings.rate_limit_per_minute:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded",
        )
