"""Health check endpoint and API route registration."""

import structlog
from fastapi import APIRouter

from src.pe.database import check_connection

logger = structlog.get_logger(__name__)

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check():
    """Health check endpoint for load balancers and monitoring."""
    try:
        db_status = await check_connection()
        return {
            "status": "healthy",
            "version": "0.1.0",
            "database": db_status,
        }
    except Exception:
        logger.exception("Health check failed")
        return {
            "status": "degraded",
            "version": "0.1.0",
            "database": {"connected": False, "error": "Database connection failed"},
        }


@router.get("/health/ready")
async def readiness_check():
    """Readiness probe — verifies the service can accept traffic."""
    return {"status": "ready"}


@router.get("/health/live")
async def liveness_check():
    """Liveness probe — verifies the service is running."""
    return {"status": "alive"}
