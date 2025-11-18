"""
FastAPI application for multi-modal bias detection service
"""

import time
from typing import Optional

import structlog
from fastapi import FastAPI, HTTPException, Request, Response, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import Counter, Histogram, generate_latest
from pydantic import ValidationError

from .config import settings
from .models import (
    ImageAnalysisRequest,
    AudioAnalysisRequest,
    MultimodalAnalysisRequest,
    MultimodalAnalysisResponse,
    HealthResponse,
    MediaType
)
from .services import VisionBiasDetector, AudioBiasDetector
from .services.multimodal_service import MultimodalBiasDetector

# Prometheus metrics
request_count = Counter(
    'multimodal_bias_detection_requests_total',
    'Total number of multi-modal bias detection requests',
    ['method', 'endpoint', 'status', 'media_type']
)

request_duration = Histogram(
    'multimodal_bias_detection_request_duration_seconds',
    'Request duration in seconds',
    ['method', 'endpoint', 'media_type']
)

analysis_count = Counter(
    'multimodal_bias_analysis_total',
    'Total number of multi-modal bias analyses performed',
    ['status', 'media_type', 'bias_types']
)

analysis_duration = Histogram(
    'multimodal_bias_analysis_duration_seconds',
    'Analysis duration in seconds',
    ['media_type', 'model_framework']
)

file_upload_count = Counter(
    'multimodal_file_uploads_total',
    'Total number of file uploads',
    ['media_type', 'status']
)

# Global service instances
vision_detector = VisionBiasDetector()
audio_detector = AudioBiasDetector()
multimodal_detector = MultimodalBiasDetector()

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
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger(__name__)


def _calculate_overall_score(bias_scores: List) -> float:
    """Calculate overall bias score"""
    if not bias_scores:
        return 0.0

    # Weighted average based on confidence
    total_weighted_score = 0.0
    total_confidence = 0.0

    for score in bias_scores:
        # Handle both dict and object access
        if isinstance(score, dict):
            score_value = score.get("score", 0.0)
            confidence_value = score.get("confidence", 0.0)
        else:
            score_value = getattr(score, "score", 0.0)
            confidence_value = getattr(score, "confidence", 0.0)

        total_weighted_score += score_value * confidence_value
        total_confidence += confidence_value

    return total_weighted_score / total_confidence if total_confidence > 0 else 0.0


def create_app() -> FastAPI:
    """Create FastAPI application for multi-modal bias detection"""

    app = FastAPI(
        title="Multi-Modal Bias Detection Service",
        description="AI-powered bias detection for images, audio, and video content",
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
        media_type = request.headers.get("X-Media-Type", "unknown")
        request_count.labels(
            method=request.method,
            endpoint=request.url.path,
            status=response.status_code,
            media_type=media_type
        ).inc()

        request_duration.labels(
            method=request.method,
            endpoint=request.url.path,
            media_type=media_type
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
                "request_id": request.headers.get("X-Request-ID")
            }
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        """Handle HTTP exceptions"""
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": "http_error",
                "message": exc.detail,
                "request_id": request.headers.get("X-Request-ID")
            }
        )

    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        """Handle general exceptions"""
        logger.error(
            "Unhandled exception",
            error=str(exc),
            request_id=request.headers.get("X-Request-ID"),
            method=request.method,
            url=str(request.url)
        )

        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "internal_server_error",
                "message": "An internal server error occurred",
                "request_id": request.headers.get("X-Request-ID")
            }
        )

    # Startup and shutdown events
    @app.on_event("startup")
    async def startup_event():
        """Initialize services on startup"""
        logger.info("Starting multi-modal bias detection service", version=settings.app_version)

        # Initialize vision models
        vision_loaded = await vision_detector.load_models()
        if not vision_loaded:
            logger.warning("Vision models failed to load, continuing without vision analysis")

        # Initialize audio models
        audio_loaded = await audio_detector.load_models()
        if not audio_loaded:
            logger.warning("Audio models failed to load, continuing without audio analysis")

        # Initialize multimodal service
        await multimodal_detector.initialize()

        logger.info("Multi-modal bias detection service started successfully")

    @app.on_event("shutdown")
    async def shutdown_event():
        """Cleanup on shutdown"""
        logger.info("Shutting down multi-modal bias detection service")

        # Shutdown services
        await multimodal_detector.shutdown()

        logger.info("Multi-modal bias detection service shutdown completed")

    # Health check endpoint
    @app.get("/health", response_model=HealthResponse)
    async def health_check():
        """Health check endpoint"""
        health_status = await multimodal_detector.get_health_status()

        return HealthResponse(
            status=health_status["status"],
            version=settings.app_version,
            modalities={
                "vision": health_status["vision_service"]["status"],
                "audio": health_status["audio_service"]["status"],
                "multimodal": health_status["multimodal_service"]["status"]
            },
            gpu_status=health_status.get("gpu_status", {}),
            dependencies=health_status.get("dependencies", {}),
            metrics=health_status.get("metrics", {})
        )

    # Readiness check endpoint
    @app.get("/ready")
    async def readiness_check():
        """Readiness check endpoint"""
        health_status = await multimodal_detector.get_health_status()

        if health_status["status"] == "healthy":
            return {"status": "ready"}
        else:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Service not ready"
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

    # Image analysis endpoints
    @app.post("/api/multimodal/image/analyze", response_model=MultimodalAnalysisResponse)
    async def analyze_image(
        request: ImageAnalysisRequest,
        response: Response
    ):
        """Analyze image for bias"""
        request_id = response.headers.get("X-Request-ID", str(time.time()))

        try:
            # Check rate limiting
            if request.user_id:
                rate_limit_count = await multimodal_detector.cache_service.get_rate_limit_counter(
                    f"user:{request.user_id}"
                )
                if rate_limit_count >= settings.rate_limit_per_minute:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="Rate limit exceeded"
                    )

            # Perform analysis
            analysis_start = time.time()
            result = await vision_detector.analyze_image(
                image_data=None,  # Will be handled by the service
                analysis_type=request.analysis_type,
                bias_types=request.bias_types,
                sensitivity=request.sensitivity
            )
            analysis_duration = time.time() - analysis_start

            # Record metrics
            analysis_count.labels(
                status="success",
                media_type="image",
                bias_types=len(result.get("bias_scores", []))
            ).inc()

            analysis_duration.labels(
                media_type="image",
                model_framework="transformers"
            ).observe(analysis_duration)

            # Update rate limiting
            if request.user_id:
                await multimodal_detector.cache_service.increment_rate_limit_counter(
                    f"user:{request.user_id}"
                )

            return MultimodalAnalysisResponse(
                request_id=request_id,
                status="completed",
                media_type=MediaType.IMAGE,
                overall_bias_score=_calculate_overall_score(result.get("bias_scores", [])),
                bias_scores=result.get("bias_scores", []),
                visual_analysis=result,
                processing_time_ms=int(analysis_duration * 1000),
                model_versions={"vision": "clip-vit-base-patch32"},
                modalities_analyzed=["visual"]
            )

        except Exception as e:
            # Record error metrics
            analysis_count.labels(
                status="error",
                media_type="image",
                bias_types=0
            ).inc()

            logger.error(
                "Image analysis failed",
                request_id=request_id,
                error=str(e)
            )
            raise

    # File upload endpoint for images
    @app.post("/api/multimodal/image/upload")
    async def upload_image(
        file: UploadFile = File(...),
        analysis_type: str = Form("comprehensive"),
        sensitivity: str = Form("medium"),
        user_id: Optional[str] = Form(None),
        session_id: Optional[str] = Form(None)
    ):
        """Upload and analyze image file"""
        try:
            # Validate file
            if not file.content_type or not file.content_type.startswith("image/"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="File must be an image"
                )

            # Check file size
            file_size = 0
            content = await file.read()
            file_size = len(content)

            if file_size > settings.max_image_size:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Image size {file_size} exceeds maximum {settings.max_image_size}"
                )

            # Record upload metrics
            file_upload_count.labels(
                media_type="image",
                status="success"
            ).inc()

            # Process the image
            result = await vision_detector.analyze_image(
                image_data=content,
                analysis_type=analysis_type,
                sensitivity=sensitivity
            )

            return {
                "filename": file.filename,
                "content_type": file.content_type,
                "size": file_size,
                "analysis_result": result
            }

        except Exception as e:
            file_upload_count.labels(
                media_type="image",
                status="error"
            ).inc()

            logger.error(
                "Image upload failed",
                filename=file.filename,
                error=str(e)
            )
            raise

    # Audio analysis endpoints
    @app.post("/api/multimodal/audio/analyze", response_model=MultimodalAnalysisResponse)
    async def analyze_audio(
        request: AudioAnalysisRequest,
        response: Response
    ):
        """Analyze audio for bias"""
        request_id = response.headers.get("X-Request-ID", str(time.time()))

        try:
            # Check rate limiting
            if request.user_id:
                rate_limit_count = await multimodal_detector.cache_service.get_rate_limit_counter(
                    f"user:{request.user_id}"
                )
                if rate_limit_count >= settings.rate_limit_per_minute:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="Rate limit exceeded"
                    )

            # Perform analysis
            analysis_start = time.time()
            result = await audio_detector.analyze_audio(
                audio_data=None,  # Will be handled by the service
                analysis_type=request.analysis_type,
                language=request.language,
                bias_types=request.bias_types,
                sensitivity=request.sensitivity
            )
            analysis_duration = time.time() - analysis_start

            # Record metrics
            analysis_count.labels(
                status="success",
                media_type="audio",
                bias_types=len(result.get("bias_scores", []))
            ).inc()

            analysis_duration.labels(
                media_type="audio",
                model_framework="transformers"
            ).observe(analysis_duration)

            # Update rate limiting
            if request.user_id:
                await multimodal_detector.cache_service.increment_rate_limit_counter(
                    f"user:{request.user_id}"
                )

            return MultimodalAnalysisResponse(
                request_id=request_id,
                status="completed",
                media_type=MediaType.AUDIO,
                overall_bias_score=_calculate_overall_score(result.get("bias_scores", [])),
                bias_scores=result.get("bias_scores", []),
                audio_analysis=result,
                processing_time_ms=int(analysis_duration * 1000),
                model_versions={"audio": "whisper-base"},
                modalities_analyzed=["audio"]
            )

        except Exception as e:
            # Record error metrics
            analysis_count.labels(
                status="error",
                media_type="audio",
                bias_types=0
            ).inc()

            logger.error(
                "Audio analysis failed",
                request_id=request_id,
                error=str(e)
            )
            raise

    # File upload endpoint for audio
    @app.post("/api/multimodal/audio/upload")
    async def upload_audio(
        file: UploadFile = File(...),
        analysis_type: str = Form("comprehensive"),
        language: str = Form("auto"),
        sensitivity: str = Form("medium"),
        user_id: Optional[str] = Form(None),
        session_id: Optional[str] = Form(None)
    ):
        """Upload and analyze audio file"""
        try:
            # Validate file
            if not file.content_type or not file.content_type.startswith("audio/"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="File must be an audio file"
                )

            # Check file size
            content = await file.read()
            file_size = len(content)

            if file_size > settings.max_audio_size:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Audio size {file_size} exceeds maximum {settings.max_audio_size}"
                )

            # Record upload metrics
            file_upload_count.labels(
                media_type="audio",
                status="success"
            ).inc()

            # Process the audio
            result = await audio_detector.analyze_audio(
                audio_data=content,
                analysis_type=analysis_type,
                language=language,
                sensitivity=sensitivity
            )

            return {
                "filename": file.filename,
                "content_type": file.content_type,
                "size": file_size,
                "analysis_result": result
            }

        except Exception as e:
            file_upload_count.labels(
                media_type="audio",
                status="error"
            ).inc()

            logger.error(
                "Audio upload failed",
                filename=file.filename,
                error=str(e)
            )
            raise

    # Multimodal analysis endpoint
    @app.post("/api/multimodal/analyze", response_model=MultimodalAnalysisResponse)
    async def analyze_multimodal(
        request: MultimodalAnalysisRequest,
        response: Response
    ):
        """Analyze multiple modalities for bias"""
        request_id = response.headers.get("X-Request-ID", str(time.time()))

        try:
            # Check rate limiting
            if request.user_id:
                rate_limit_count = await multimodal_detector.cache_service.get_rate_limit_counter(
                    f"user:{request.user_id}"
                )
                if rate_limit_count >= settings.rate_limit_per_minute:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="Rate limit exceeded"
                    )

            # Perform multimodal analysis
            analysis_start = time.time()
            result = await multimodal_detector.analyze_multimodal(request, request_id)
            analysis_duration = time.time() - analysis_start

            # Record metrics
            analysis_count.labels(
                status="success",
                media_type="multimodal",
                bias_types=len(result.bias_scores)
            ).inc()

            analysis_duration.labels(
                media_type="multimodal",
                model_framework="ensemble"
            ).observe(analysis_duration)

            # Update rate limiting
            if request.user_id:
                await multimodal_detector.cache_service.increment_rate_limit_counter(
                    f"user:{request.user_id}"
                )

            return result

        except Exception as e:
            # Record error metrics
            analysis_count.labels(
                status="error",
                media_type="multimodal",
                bias_types=0
            ).inc()

            logger.error(
                "Multimodal analysis failed",
                request_id=request_id,
                error=str(e)
            )
            raise

    # Models info endpoint
    @app.get("/api/multimodal/models/info")
    async def get_models_info():
        """Get information about loaded models"""
        try:
            vision_info = vision_detector.get_model_info()
            audio_info = audio_detector.get_model_info()
            multimodal_info = multimodal_detector.get_ensemble_info()

            return {
                "vision_models": vision_info,
                "audio_models": audio_info,
                "multimodal_ensemble": multimodal_info
            }

        except Exception as e:
            logger.error("Failed to get models info", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get model information"
            )

    return app


# Create the application instance
app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "multimodal_bias_detection.app:app",
        host=settings.host,
        port=settings.port,
        workers=settings.workers,
        reload=settings.debug,
        log_level=settings.log_level.lower()
    )
