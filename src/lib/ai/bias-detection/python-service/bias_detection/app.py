"""
FastAPI application for bias detection service
"""

import structlog
import time
from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import Counter, Histogram, generate_latest
from pydantic import ValidationError

from .config import settings
from .models import (
    BiasAnalysisRequest,
    BiasAnalysisResponse,
    HealthResponse,
)
from .services import BiasDetectionService, cache_service
from .services.database_service import DatabaseService, database_service

# Type cast to help type checker understand this is an instance, not a module
database_service = cast(DatabaseService, database_service)

# Prometheus metrics
request_count = Counter(
    "bias_detection_requests_total",
    "Total number of bias detection requests",
    ["method", "endpoint", "status"],
)

request_duration = Histogram(
    "bias_detection_request_duration_seconds",
    "Request duration in seconds",
    ["method", "endpoint"],
)

analysis_count = Counter(
    "bias_analysis_total",
    "Total number of bias analyses performed",
    ["status", "bias_types"],
)

analysis_duration = Histogram(
    "bias_analysis_duration_seconds",
    "Analysis duration in seconds",
    ["model_framework"],
)

# Global service instance
bias_detection_service = BiasDetectionService()

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer(),
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger(__name__)


def create_app() -> FastAPI:
    """Create FastAPI application"""

    app = FastAPI(
        title="Bias Detection Service",
        description="AI-powered bias detection service with TensorFlow/PyTorch integration",
        version=settings.app_version,
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
        openapi_url="/openapi.json" if settings.debug else None,
    )

    # Add middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Configure appropriately for production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.add_middleware(GZipMiddleware, minimum_size=1000)

    # Request ID middleware
    @app.middleware("http")
    async def add_request_id(request: Request, call_next):
        """Add request ID to all requests"""
        request_id = request.headers.get("X-Request-ID", str(time.time()))

        # Add request ID to response headers
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id

        return response

    # Request timing middleware
    @app.middleware("http")
    async def add_process_time_header(request: Request, call_next):
        """Add processing time to response headers"""
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time

        response.headers["X-Process-Time"] = str(process_time)

        # Record metrics
        request_count.labels(
            method=request.method,
            endpoint=request.url.path,
            status=response.status_code,
        ).inc()

        request_duration.labels(
            method=request.method, endpoint=request.url.path
        ).observe(process_time)

        return response

    # Exception handlers
    @app.exception_handler(ValidationError)
    async def validation_exception_handler(request: Request, exc: ValidationError):
        """Handle Pydantic validation errors"""
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": "validation_error",
                "message": "Request validation failed",
                "details": exc.errors(),
                "request_id": request.headers.get("X-Request-ID"),
            },
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        """Handle HTTP exceptions"""
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": "http_error",
                "message": exc.detail,
                "request_id": request.headers.get("X-Request-ID"),
            },
        )

    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        """Handle general exceptions"""
        logger.error(
            "Unhandled exception",
            error=str(exc),
            request_id=request.headers.get("X-Request-ID"),
            method=request.method,
            url=str(request.url),
        )

        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "internal_server_error",
                "message": "An internal server error occurred",
                "request_id": request.headers.get("X-Request-ID"),
            },
        )

    # Startup and shutdown events
    @app.on_event("startup")
    async def startup_event():
        """Initialize services on startup"""
        logger.info("Starting bias detection service", version=settings.app_version)

        # Initialize bias detection service
        initialized = await bias_detection_service.initialize()
        if not initialized:
            logger.error("Failed to initialize bias detection service")
            raise RuntimeError("Service initialization failed")

        logger.info("Bias detection service started successfully")

    @app.on_event("shutdown")
    async def shutdown_event():
        """Cleanup on shutdown"""
        logger.info("Shutting down bias detection service")

        # Shutdown bias detection service
        await bias_detection_service.shutdown()

        logger.info("Bias detection service shutdown completed")

    # Health check endpoint
    @app.get("/health", response_model=HealthResponse)
    async def health_check():
        """Health check endpoint"""
        health_status = await bias_detection_service.get_health_status()

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

    # Readiness check endpoint
    @app.get("/ready")
    async def readiness_check():
        """Readiness check endpoint"""
        health_status = await bias_detection_service.get_health_status()

        if health_status["status"] == "healthy":
            return {"status": "ready"}
        else:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Service not ready",
            )

    # Liveness check endpoint
    @app.get("/live")
    async def liveness_check():
        """Liveness check endpoint"""
        return {"status": "alive", "timestamp": time.time()}

    # Metrics endpoint
    @app.get("/metrics")
    async def metrics():
        """Prometheus metrics endpoint"""
        return Response(content=generate_latest(), media_type="text/plain")

    # Main API endpoints
    @app.post("/api/bias-analysis/analyze", response_model=BiasAnalysisResponse)
    async def analyze_bias(request: BiasAnalysisRequest, response: Response):
        """Analyze text for bias"""
        request_id = response.headers.get("X-Request-ID", str(time.time()))

        try:
            # Check rate limiting
            if request.user_id:
                rate_limit_count = await cache_service.get_rate_limit_counter(
                    f"user:{request.user_id}"
                )
                if rate_limit_count >= settings.rate_limit_per_minute:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="Rate limit exceeded",
                    )

            # Perform analysis
            analysis_start = time.time()
            result = await bias_detection_service.analyze_bias(request, request_id)
            analysis_time = time.time() - analysis_start

            # Record metrics
            analysis_count.labels(
                status="success", bias_types=len(result.bias_scores)
            ).inc()

            analysis_duration.labels(model_framework="ensemble").observe(analysis_time)

            # Update rate limiting
            if request.user_id:
                await cache_service.increment_rate_limit_counter(
                    f"user:{request.user_id}"
                )

            # Track API usage
            await database_service.track_api_usage(
                user_id=request.user_id,
                session_id=request.session_id,
                endpoint="/api/bias-analysis/analyze",
                method="POST",
                status_code=status.HTTP_200_OK,
                response_time_ms=int(analysis_time * 1000),
            )

            return result

        except Exception as e:
            # Record error metrics
            analysis_count.labels(status="error", bias_types=0).inc()

            # Track API usage for error
            await database_service.track_api_usage(
                user_id=request.user_id,
                session_id=request.session_id,
                endpoint="/api/bias-analysis/analyze",
                method="POST",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                response_time_ms=int((time.time() - analysis_start) * 1000),
            )

            logger.error("Analysis failed", request_id=request_id, error=str(e))
            raise

    @app.get("/api/bias-analysis/{analysis_id}", response_model=BiasAnalysisResponse)
    async def get_analysis(analysis_id: str, response: Response):
        """Get analysis by ID"""
        request_id = response.headers.get("X-Request-ID")

        try:
            # Get from database
            analysis = await database_service.get_analysis_by_id(analysis_id)

            if not analysis:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="Analysis not found"
                )

            # Convert to response model
            return BiasAnalysisResponse(**analysis)

        except Exception as e:
            logger.error(
                "Failed to get analysis",
                analysis_id=analysis_id,
                request_id=request_id,
                error=str(e),
            )
            raise

    @app.get("/api/bias-analysis/user/{user_id}")
    async def get_user_analyses(
        user_id: str, response: Response, limit: int = 100, offset: int = 0
    ):
        """Get analyses for a user"""
        request_id = response.headers.get("X-Request-ID")

        try:
            # Validate pagination parameters
            if limit > 1000:
                limit = 1000
            if offset < 0:
                offset = 0

            # Get user analyses
            analyses = await database_service.get_user_analyses(
                user_id=user_id, limit=limit, offset=offset
            )

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

    @app.get("/api/analytics/summary")
    async def get_analytics_summary(response: Response, days: int = 30):
        """Get analytics summary"""
        request_id = response.headers.get("X-Request-ID")

        try:
            # Validate days parameter
            if days < 1 or days > 365:
                days = 30

            # Get analytics summary
            summary = await database_service.get_analytics_summary(days=days)

            return summary

        except Exception as e:
            logger.error(
                "Failed to get analytics summary",
                days=days,
                request_id=request_id,
                error=str(e),
            )
            raise

    @app.get("/api/models/info")
    async def get_models_info():
        """Get information about loaded models"""
        try:
            model_info = bias_detection_service.model_service.get_ensemble_info()
            return model_info

        except Exception as e:
            logger.error("Failed to get models info", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get model information",
            )

    # Error endpoints for testing
    @app.get("/api/errors/400")
    async def test_400_error():
        """Test 400 error"""
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Bad request test"
        )

    @app.get("/api/errors/404")
    async def test_404_error():
        """Test 404 error"""
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Not found test"
        )

    @app.get("/api/errors/500")
    async def test_500_error():
        """Test 500 error"""
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error test",
        )

    return app


# Create the application instance
app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "bias_detection.app:app",
        host=settings.host,
        port=settings.port,
        workers=settings.workers,
        reload=settings.debug,
        log_level=settings.log_level.lower(),
    )
