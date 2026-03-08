"""
Health, readiness, liveness, and metrics endpoints.
"""

import time

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from prometheus_client import generate_latest

from bias_detection.config import settings
from bias_detection.deps import get_bias_service
from bias_detection.models import HealthResponse

router = APIRouter(tags=["health"])

_DEP_BIAS_SERVICE = Depends(get_bias_service)


@router.get("/health", response_model=HealthResponse)
async def health_check(
    bias_service=_DEP_BIAS_SERVICE,
):
    """Health check endpoint."""
    health_status = await bias_service.get_health_status()
    return HealthResponse(
        status="healthy" if health_status["status"] == "healthy" else "unhealthy",
        version=settings.app_version,
        dependencies={
            "model_service": health_status["model_service"]["status"],
            "cache_service": health_status["cache_service"]["status"],
            "database_service": health_status["database_service"]["status"],
        },
        metrics={
            "service_initialized": health_status["initialized"],
            "timestamp": time.time(),
        },
    )


@router.get("/ready")
async def readiness_check(
    bias_service=_DEP_BIAS_SERVICE,
):
    """Readiness check endpoint."""
    health_status = await bias_service.get_health_status()
    if health_status["status"] == "healthy":
        return {"status": "ready"}
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Service not ready",
    )


@router.get("/live")
async def liveness_check():
    """Liveness check endpoint."""
    return {"status": "alive", "timestamp": time.time()}


@router.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint."""
    return Response(content=generate_latest(), media_type="text/plain")


@router.get("/sentry-debug")
async def sentry_debug():
    """Trigger a test error for Sentry verification."""
    1 / 0  # noqa: B018
