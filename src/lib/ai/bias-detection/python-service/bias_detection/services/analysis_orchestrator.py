"""
Orchestrates bias analysis: rate limiting, core analysis, metrics, and usage tracking.
Keeps HTTP route handlers thin by centralizing business and infrastructure concerns.
"""

import time

from fastapi import HTTPException, status

from .. import metrics as app_metrics
from ..config import settings
from ..models import BiasAnalysisRequest, BiasAnalysisResponse
from .bias_detection_service import BiasDetectionService
from .cache_service import cache_service
from .database_service import DatabaseService

ANALYZE_ENDPOINT = "/api/bias-analysis/analyze"


class AnalysisOrchestrator:
    """Handles rate limiting, analysis execution, metrics, and usage tracking."""

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
        Execute bias analysis with rate limiting, metrics, and usage tracking.
        Raises HTTPException for rate limit; propagates other exceptions.
        """
        analysis_start = time.time()

        if request.user_id:
            await self._enforce_rate_limit(request.user_id)

        result = await self.bias_service.analyze_bias(request, request_id)
        analysis_time = time.time() - analysis_start

        app_metrics.analysis_count.labels(
            status="success", bias_types=len(result.bias_scores)
        ).inc()
        app_metrics.analysis_duration.labels(model_framework="ensemble").observe(
            analysis_time
        )

        if request.user_id:
            await cache_service.increment_rate_limit_counter(f"user:{request.user_id}")

        await self.database_service.track_api_usage(
            user_id=request.user_id,
            session_id=request.session_id,
            endpoint=ANALYZE_ENDPOINT,
            method="POST",
            status_code=status.HTTP_200_OK,
            response_time_ms=int(analysis_time * 1000),
        )

        return result

    async def _enforce_rate_limit(self, user_id: str) -> None:
        """Raise HTTP 429 if user has exceeded rate limit."""
        count = await cache_service.get_rate_limit_counter(f"user:{user_id}")
        if count >= settings.rate_limit_per_minute:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded",
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
