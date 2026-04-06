"""
Bias analysis API endpoints.
"""

import time

import structlog
from fastapi import APIRouter, Depends, Response, status

from bias_detection.deps import (
    AuthenticatedUser,
    get_analysis_orchestrator,
    get_database_service,
    require_rate_limit,
)
from bias_detection.models import BiasAnalysisRequest, BiasAnalysisResponse

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
    current_user: AuthenticatedUser = Depends(AuthenticatedUser),
):
    """Get analysis by ID. Authentication required."""
    from fastapi import HTTPException

    # current_user is guaranteed by AuthenticatedUser dependency
    current_user_id = current_user.get("user_id")

    analysis = await db.get_analysis_by_id(analysis_id)
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found"
        )

    # Authorization check: user must own the analysis
    analysis_user_id = analysis.get("user_id")
    if analysis_user_id and analysis_user_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this analysis"
        )

    return BiasAnalysisResponse(**analysis)


@router.get("/user/{user_id}")
async def get_user_analyses(
    user_id: str,
    response: Response,
    limit: int = 100,
    offset: int = 0,
    db=_DEP_DATABASE,
    current_user: AuthenticatedUser = Depends(AuthenticatedUser),
):
    """Get analyses for a user. Authentication required; users can only access their own analyses."""
    from fastapi import HTTPException

    # current_user is guaranteed by AuthenticatedUser dependency
    current_user_id = current_user.get("user_id")

    # Authorization check: user can only access their own analyses
    if current_user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this user's analyses"
        )

    limit = min(limit, 1000)
    offset = max(offset, 0)

    analyses = await db.get_user_analyses(user_id=user_id, limit=limit, offset=offset)
    return {
        "analyses": analyses,
        "total": len(analyses),
        "limit": limit,
        "offset": offset,
    }
