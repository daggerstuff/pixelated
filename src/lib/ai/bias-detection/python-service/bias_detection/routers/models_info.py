"""
Model information endpoints.
"""

import structlog
from bias_detection.deps import get_bias_service
from fastapi import APIRouter, Depends, HTTPException, status

router = APIRouter(prefix="/api/models", tags=["models"])
logger = structlog.get_logger(__name__)

_DEP_BIAS_SERVICE = Depends(get_bias_service)


@router.get("/info")
async def get_models_info(bias_service=_DEP_BIAS_SERVICE):
    """Get information about loaded models."""
    try:
        return bias_service.model_service.get_ensemble_info()
    except Exception as e:
        logger.error("Failed to get models info", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get model information",
        ) from e
