"""
Orchestrates bias analysis: business logic (analysis) and persistence (metrics, usage tracking).
Rate limiting is handled by the FastAPI dependency require_rate_limit before the handler runs.
"""

import time

from fastapi import status

from .. import metrics as app_metrics
from ..models import BiasAnalysisRequest, BiasAnalysisResponse
from .bias_detection_service import BiasDetectionService
from .cache_service import cache_service
from .database_service import DatabaseService

ANALYZE_ENDPOINT = "/api/bias-analysis/analyze"


class AnalysisOrchestrator:
    """Runs analysis (business) and records metrics/usage (persistence)."""

    def __init__(
        self,
        bias_service: BiasDetectionService,
        database_service: DatabaseService,
    ):
        self.bias_service = bias_service
        self.database_service = database_service

    async def run_analysis(
        self,
        request: BiasAnalysisRequest,
        request_id: str,
    ) -> BiasAnalysisResponse:
        """
        Run analysis (business) then record success (metrics, rate-limit counter, usage).
        Rate limiting is enforced by the route's Depends(require_rate_limit).
        """
        analysis_start = time.time()
        result = await self.bias_service.analyze_bias(request, request_id)
        analysis_time = time.time() - analysis_start
        await self._record_analysis_success(request, result, analysis_time)
        return result

    async def _record_analysis_success(
        self,
        request: BiasAnalysisRequest,
        result: BiasAnalysisResponse,
        analysis_time: float,
    ) -> None:
        """Record successful analysis: metrics, rate-limit counter, and API usage."""
        app_metrics.analysis_count.labels(
            status="success", bias_types=len(result.bias_scores)
        ).inc()
        app_metrics.analysis_duration.labels(model_framework="ensemble").observe(
            analysis_time
        )
        # Rate-limit counter is incremented in require_rate_limit dependency (atomic check).
        await self.database_service.track_api_usage(
            user_id=request.user_id,
            session_id=request.session_id,
            endpoint=ANALYZE_ENDPOINT,
            method="POST",
            status_code=status.HTTP_200_OK,
            response_time_ms=int(analysis_time * 1000),
        )

    async def record_analysis_error(
        self,
        request: BiasAnalysisRequest,
        status_code: int,
        analysis_start: float,
    ) -> None:
        """Record error metrics and usage for a failed analysis."""
        app_metrics.analysis_count.labels(status="error", bias_types=0).inc()
        response_time_ms = int((time.time() - analysis_start) * 1000)
        await self.database_service.track_api_usage(
            user_id=request.user_id,
            session_id=request.session_id,
            endpoint=ANALYZE_ENDPOINT,
            method="POST",
            status_code=status_code,
            response_time_ms=response_time_ms,
        )
