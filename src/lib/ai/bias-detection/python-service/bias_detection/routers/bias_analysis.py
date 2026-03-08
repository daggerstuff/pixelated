"""
Bias analysis API endpoints.
"""

import time

import structlog
from bias_detection.deps import get_analysis_orchestrator, get_database_service, require_rate_limit
from bias_detection.models import BiasAnalysisRequest, BiasAnalysisResponse
from fastapi import APIRouter, Depends, HTTPException, Response, status

router = APIRouter(prefix="/api/bias-analysis", tags=["bias-analysis"])

# Module-level Depends() values to satisfy B008 (no function calls in default args)
_DEP_ORCHESTRATOR = Depends(get_analysis_orchestrator)
_DEP_DATABASE = Depends(get_database_service)
_DEP_RATE_LIMIT = Depends(require_rate_limit)
logger = structlog.get_logger(__name__)


@router.post("/analyze", response_model=BiasAnalysisResponse)
async def analyze_bias(
    request: BiasAnalysisRequest,
    response: Response,
    _rate_limit: None = _DEP_RATE_LIMIT,
    orchestrator=_DEP_ORCHESTRATOR,
):
    """Analyze text for bias. Rate limit enforced by Depends(require_rate_limit); orchestrator runs analysis and records metrics/usage."""
    request_id = response.headers.get("X-Request-ID", str(time.time()))
    analysis_start = time.time()

    try:
        return await orchestrator.run_analysis(request, request_id)
    except HTTPException:
        raise
    except Exception as e:
        await orchestrator.record_analysis_error(
            request,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            analysis_start=analysis_start,
        )
        logger.error("Analysis failed", request_id=request_id, error=str(e))
        raise


@router.get("/{analysis_id}", response_model=BiasAnalysisResponse)
async def get_analysis(
    analysis_id: str,
    response: Response,
    db=_DEP_DATABASE,
):
    """Get analysis by ID."""
    request_id = response.headers.get("X-Request-ID")
    try:
        analysis = await db.get_analysis_by_id(analysis_id)
        if not analysis:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Analysis not found"
            )
        return BiasAnalysisResponse(**analysis)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to get analysis",
            analysis_id=analysis_id,
            request_id=request_id,
            error=str(e),
        )
        raise


@router.get("/user/{user_id}")
async def get_user_analyses(
    user_id: str,
    response: Response,
    limit: int = 100,
    offset: int = 0,
    db=_DEP_DATABASE,
):
    """Get analyses for a user."""
    request_id = response.headers.get("X-Request-ID")
    limit = min(limit, 1000)
    offset = max(offset, 0)
    try:
        analyses = await db.get_user_analyses(user_id=user_id, limit=limit, offset=offset)
        return {
            "analyses": analyses,
            "total": len(analyses),
            "limit": limit,
            "offset": offset,
        }
    except Exception as e:
        logger.error(
            "Failed to get user analyses",
            user_id=user_id,
            request_id=request_id,
            error=str(e),
        )
        raise
