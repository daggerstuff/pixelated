"""
Analytics API endpoints.
"""

import structlog
from bias_detection.deps import get_database_service
from fastapi import APIRouter, Depends, Response

router = APIRouter(prefix="/api/analytics", tags=["analytics"])
logger = structlog.get_logger(__name__)

_DEP_DATABASE = Depends(get_database_service)


@router.get("/summary")
async def get_analytics_summary(
    response: Response,
    days: int = 30,
    db=_DEP_DATABASE,
):
    """Get analytics summary."""
    request_id = response.headers.get("X-Request-ID")
    if days < 1 or days > 365:
        days = 30
    try:
        return await db.get_analytics_summary(days=days)
    except Exception as e:
        logger.error(
            "Failed to get analytics summary",
            days=days,
            request_id=request_id,
            error=str(e),
        )
        raise
