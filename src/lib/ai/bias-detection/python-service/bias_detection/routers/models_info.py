"""
Model information endpoints.
"""

import structlog
from fastapi import APIRouter, Depends, HTTPException, status

from ..deps import get_bias_service

router = APIRouter(prefix="/api/models", tags=["models"])
logger = structlog.get_logger(__name__)


@router.get("/info")
async def get_models_info(bias_service=Depends(get_bias_service)):
    """Get information about loaded models."""
    try:
        return bias_service.model_service.get_ensemble_info()
    except Exception as e:
        logger.error("Failed to get models info", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get model information",
        )
