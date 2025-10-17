"""
Dataset Pipeline WebSocket Router for MCP Server

Provides WebSocket endpoints for real-time dataset pipeline orchestration,
integrating with the comprehensive dataset processing infrastructure and
providing live progress updates with safety validation.
"""

from datetime import datetime
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from ..exceptions import ValidationError
from ..middleware.auth import get_current_user
from ..models.dataset import DatasetProcessingRequest, DatasetProgressUpdate, DatasetStatusResponse
from ..services.dataset_integration import (
    DatasetIntegrationService,
    get_dataset_integration_service,
)
from ..services.integration_manager import IntegrationEventType, IntegrationManager

logger = structlog.get_logger(__name__)


# Pydantic models for request/response
class DatasetProcessingRequest(BaseModel):
    """Request model for dataset processing."""
    dataset_config: dict[str, Any] = Field(..., description="Dataset processing configuration")
    processing_mode: str = Field(default="comprehensive", description="Processing mode")
    quality_threshold: float = Field(default=0.8, ge=0.0, le=1.0, description="Quality threshold")
    enable_bias_detection: bool = Field(default=True, description="Enable bias detection")
    enable_safety_validation: bool = Field(default=True, description="Enable safety validation")
    storage_config: dict[str, Any] | None = Field(default=None, description="Storage configuration")
    metadata: dict[str, Any] | None = Field(default=None, description="Additional metadata")


class DatasetStatusResponse(BaseModel):
    """Response model for dataset processing status."""
    execution_id: str
    status: str
    current_stage: str | None
    overall_progress: float
    quality_score: float | None
    bias_score: float | None
    stage_results: dict[str, Any]
    start_time: str
    end_time: str | None
    error_message: str | None
    estimated_completion: str | None
    source_locations: list[str]
    output_locations: list[str]


class DatasetProgressUpdate(BaseModel):
    """Dataset processing progress update."""
    execution_id: str = Field(..., description="Dataset execution ID")
    overall_progress: float = Field(..., ge=0, le=100, description="Overall progress percentage")
    current_stage: str | None = Field(None, description="Current processing stage")
    stage_progress: dict[str, Any] | None = Field(None, description="Stage-specific progress")
    quality_score: float | None = Field(None, description="Current quality score")
    bias_score: float | None = Field(None, description="Current bias score")
    estimated_completion: str | None = Field(None, description="Estimated completion time")
    message: str | None = Field(None, description="Progress message")


class DatasetStatisticsRequest(BaseModel):
    """Request model for dataset statistics."""
    execution_id: str = Field(..., description="Dataset execution ID")
    include_detailed_metrics: bool = Field(default=True, description="Include detailed metrics")
    metric_categories: list[str] | None = Field(default=None, description="Specific metric categories")


class DatasetCancelRequest(BaseModel):
    """Request model for dataset processing cancellation."""
    reason: str | None = Field(None, description="Cancellation reason")


# Create router
router = APIRouter()


def get_dataset_integration_service(request: Request) -> DatasetIntegrationService:
    """
    Get dataset integration service from application state.
    
    Args:
        request: FastAPI request object
        
    Returns:
        DatasetIntegrationService instance
        
    Raises:
        HTTPException: If service is not available
    """
    dataset_service = getattr(request.app.state, "dataset_integration_service", None)
    if not dataset_service:
        raise HTTPException(
            status_code=503,
            detail="Dataset processing service unavailable"
        )
    return dataset_service


def get_integration_manager(request: Request) -> IntegrationManager:
    """
    Get integration manager from application state.
    
    Args:
        request: FastAPI request object
        
    Returns:
        IntegrationManager instance
        
    Raises:
        HTTPException: If integration manager is not available
    """
    integration_manager = getattr(request.app.state, "integration_manager", None)
    if not integration_manager:
        raise HTTPException(
            status_code=503,
            detail="Integration service unavailable"
        )
    return integration_manager


@router.post("/process", response_model=dict[str, Any])
async def process_dataset(
    request: DatasetProcessingRequest,
    dataset_service: DatasetIntegrationService = Depends(get_dataset_integration_service),
    current_user: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """
    Process dataset through comprehensive pipeline with real-time WebSocket updates.
    
    Args:
        request: Dataset processing request
        dataset_service: Dataset integration service
        current_user: Current authenticated user
        
    Returns:
        Execution ID and status information
        
    Raises:
        HTTPException: If processing fails or user lacks permissions
    """
    try:
        user_id = current_user.get("user_id")

        # Validate dataset configuration
        _validate_dataset_config(request.dataset_config)

        # Process dataset
        execution_id = await dataset_service.process_dataset(
            request.dataset_config,
            user_id
        )

        # Publish dataset processing start event via integration manager
        integration_manager = get_integration_manager(Request)
        await integration_manager.publish_integration_event(
            IntegrationEventType.PIPELINE_STAGE_START,
            pipeline_id=execution_id,
            user_id=user_id,
            data={
                "stage_name": "initialization",
                "stage_number": 0,
                "processing_mode": request.processing_mode,
                "quality_threshold": request.quality_threshold,
                "enable_bias_detection": request.enable_bias_detection,
                "enable_safety_validation": request.enable_safety_validation,
                "source_count": len(request.dataset_config.get("sources", []))
            }
        )

        logger.info(
            "Dataset processing initiated via WebSocket API",
            execution_id=execution_id,
            user_id=user_id,
            processing_mode=request.processing_mode,
            source_count=len(request.dataset_config.get("sources", []))
        )

        return {
            "status": "success",
            "execution_id": execution_id,
            "message": "Dataset processing started successfully",
            "timestamp": datetime.utcnow().isoformat(),
            "estimated_duration": "5-15 minutes depending on dataset size"
        }

    except ValidationError as e:
        logger.warning("Dataset validation failed", user_id=current_user.get("user_id"), error=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Error initiating dataset processing", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to initiate dataset processing")


@router.get("/status/{execution_id}", response_model=DatasetStatusResponse)
async def get_dataset_status(
    execution_id: str = Path(..., description="Dataset execution ID"),
    dataset_service: DatasetIntegrationService = Depends(get_dataset_integration_service),
    current_user: dict[str, Any] = Depends(get_current_user)
) -> DatasetStatusResponse:
    """
    Get current dataset processing status with WebSocket integration.
    
    Args:
        execution_id: Dataset execution ID
        dataset_service: Dataset integration service
        current_user: Current authenticated user
        
    Returns:
        Current execution status and progress
        
    Raises:
        HTTPException: If execution not found or access denied
    """
    try:
        user_id = current_user.get("user_id")

        # Get execution status
        status_data = await dataset_service.get_execution_status(execution_id, user_id)

        # Publish status query event
        integration_manager = get_integration_manager(Request)
        await integration_manager.publish_integration_event(
            IntegrationEventType.PIPELINE_PROGRESS,
            pipeline_id=execution_id,
            user_id=user_id,
            data={
                "status_query": True,
                "current_progress": status_data.get("overall_progress", 0),
                "current_stage": status_data.get("current_stage"),
                "quality_score": status_data.get("quality_score"),
                "bias_score": status_data.get("bias_score")
            }
        )

        logger.debug(
            "Dataset status retrieved",
            execution_id=execution_id,
            user_id=user_id,
            status=status_data.get("status")
        )

        return DatasetStatusResponse(**status_data)

    except ValidationError as e:
        logger.warning("Dataset status access denied", execution_id=execution_id, user_id=user_id, error=str(e))
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error("Error getting dataset status", execution_id=execution_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve dataset status")


@router.post("/{execution_id}/cancel", response_model=dict[str, Any])
async def cancel_dataset_processing(
    request: DatasetCancelRequest,
    execution_id: str = Path(..., description="Dataset execution ID"),
    dataset_service: DatasetIntegrationService = Depends(get_dataset_integration_service),
    current_user: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """
    Cancel dataset processing with WebSocket notification.
    
    Args:
        request: Cancellation request
        execution_id: Dataset execution ID
        dataset_service: Dataset integration service
        current_user: Current authenticated user
        
    Returns:
        Cancellation result
        
    Raises:
        HTTPException: If cancellation fails or access denied
    """
    try:
        user_id = current_user.get("user_id")

        # Cancel execution
        success = await dataset_service.cancel_execution(execution_id, user_id)

        if success:
            # Publish cancellation event
            integration_manager = get_integration_manager(Request)
            await integration_manager.publish_integration_event(
                IntegrationEventType.PIPELINE_ERROR,
                pipeline_id=execution_id,
                user_id=user_id,
                data={
                    "status": "cancelled",
                    "reason": request.reason or "User requested cancellation",
                    "cancelled_at": datetime.utcnow().isoformat()
                }
            )

            logger.info(
                "Dataset processing cancelled",
                execution_id=execution_id,
                user_id=user_id,
                reason=request.reason
            )

            return {
                "status": "success",
                "message": "Dataset processing cancelled successfully",
                "execution_id": execution_id,
                "timestamp": datetime.utcnow().isoformat()
            }
        raise HTTPException(status_code=400, detail="Failed to cancel dataset processing")

    except ValidationError as e:
        logger.warning("Dataset cancellation failed", execution_id=execution_id, error=str(e))
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error("Error cancelling dataset processing", execution_id=execution_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to cancel dataset processing")


@router.post("/{execution_id}/progress", response_model=dict[str, Any])
async def update_dataset_progress(
    progress_update: DatasetProgressUpdate,
    execution_id: str = Path(..., description="Dataset execution ID"),
    integration_manager: IntegrationManager = Depends(get_integration_manager),
    current_user: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """
    Update dataset progress via WebSocket (for internal use by processing stages).
    
    Args:
        progress_update: Progress update data
        execution_id: Dataset execution ID
        integration_manager: Integration manager
        current_user: Current authenticated user (must be system/agent)
        
    Returns:
        Update confirmation
        
    Raises:
        HTTPException: If update fails or user lacks permissions
    """
    try:
        user_id = current_user.get("user_id")
        user_role = current_user.get("role", "user")

        # Check permissions - only system/agents can update progress
        if user_role not in ["system", "agent", "admin"]:
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions to update dataset progress"
            )

        # Publish progress update
        await integration_manager.publish_integration_event(
            IntegrationEventType.PIPELINE_PROGRESS,
            pipeline_id=execution_id,
            user_id=user_id,
            data={
                "overall_progress": progress_update.overall_progress,
                "current_stage": progress_update.current_stage,
                "stage_progress": progress_update.stage_progress,
                "quality_score": progress_update.quality_score,
                "bias_score": progress_update.bias_score,
                "estimated_completion": progress_update.estimated_completion,
                "message": progress_update.message
            }
        )

        logger.debug(
            "Dataset progress updated via WebSocket API",
            execution_id=execution_id,
            progress=progress_update.overall_progress,
            current_stage=progress_update.current_stage,
            quality_score=progress_update.quality_score,
            bias_score=progress_update.bias_score
        )

        return {
            "status": "success",
            "message": "Dataset progress updated successfully",
            "execution_id": execution_id,
            "timestamp": datetime.utcnow().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating dataset progress", execution_id=execution_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to update dataset progress")


@router.get("/active", response_model=list[dict[str, Any]])
async def get_active_dataset_executions(
    dataset_service: DatasetIntegrationService = Depends(get_dataset_integration_service),
    current_user: dict[str, Any] = Depends(get_current_user)
) -> list[dict[str, Any]]:
    """
    Get list of active dataset processing executions.
    
    Args:
        dataset_service: Dataset integration service
        current_user: Current authenticated user
        
    Returns:
        List of active executions
        
    Raises:
        HTTPException: If retrieval fails
    """
    try:
        user_id = current_user.get("user_id")
        user_role = current_user.get("role", "user")

        # Get all executions for admin, user-specific for regular users
        if user_role == "admin":
            # Admin can see all executions
            executions = []
            for execution_id, execution in dataset_service.active_executions.items():
                if execution.status == DatasetStatus.PROCESSING:
                    executions.append({
                        "execution_id": execution_id,
                        "user_id": execution.user_id,
                        "status": execution.status.value,
                        "current_stage": execution.current_stage.value if execution.current_stage else None,
                        "overall_progress": execution.overall_progress,
                        "quality_score": execution.quality_score,
                        "bias_score": execution.bias_score,
                        "start_time": execution.start_time.isoformat()
                    })
        else:
            # Regular users can only see their own executions
            executions = []
            for execution_id, execution in dataset_service.active_executions.items():
                if execution.user_id == user_id and execution.status == DatasetStatus.PROCESSING:
                    executions.append({
                        "execution_id": execution_id,
                        "status": execution.status.value,
                        "current_stage": execution.current_stage.value if execution.current_stage else None,
                        "overall_progress": execution.overall_progress,
                        "quality_score": execution.quality_score,
                        "bias_score": execution.bias_score,
                        "start_time": execution.start_time.isoformat()
                    })

        logger.info(
            "Active dataset executions retrieved",
            user_id=user_id,
            role=user_role,
            count=len(executions)
        )

        return executions

    except Exception as e:
        logger.error("Error retrieving active dataset executions", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve active dataset executions")


@router.get("/statistics/{execution_id}", response_model=dict[str, Any])
async def get_dataset_statistics(
    execution_id: str = Path(..., description="Dataset execution ID"),
    include_detailed: bool = Query(True, description="Include detailed metrics"),
    dataset_service: DatasetIntegrationService = Depends(get_dataset_integration_service),
    current_user: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """
    Get comprehensive dataset processing statistics.
    
    Args:
        execution_id: Dataset execution ID
        include_detailed: Whether to include detailed metrics
        dataset_service: Dataset integration service
        current_user: Current authenticated user
        
    Returns:
        Comprehensive statistics for the dataset execution
        
    Raises:
        HTTPException: If statistics retrieval fails or access denied
    """
    try:
        user_id = current_user.get("user_id")

        # Get dataset statistics
        statistics = await dataset_service.get_dataset_statistics(execution_id, user_id)

        # Add detailed metrics if requested
        if include_detailed:
            statistics["detailed_metrics"] = {
                "timestamp": datetime.utcnow().isoformat(),
                "metric_categories": ["data_metrics", "quality_metrics", "bias_metrics", "processing_metrics"],
                "data_quality_indicators": {
                    "completeness": statistics.get("quality_metrics", {}).get("final_validation_quality", 0.0),
                    "consistency": statistics.get("quality_metrics", {}).get("standardization_quality", 0.0),
                    "accuracy": statistics.get("quality_metrics", {}).get("validation_quality", 0.0)
                },
                "bias_indicators": {
                    "overall_bias_score": statistics.get("bias_metrics", {}).get("bias_detection_bias", 0.0),
                    "demographic_balance": statistics.get("bias_metrics", {}).get("distribution_balancing_bias", 0.0)
                }
            }

        logger.info(
            "Dataset statistics retrieved",
            execution_id=execution_id,
            user_id=user_id,
            detailed=include_detailed
        )

        return statistics

    except ValidationError as e:
        logger.warning("Dataset statistics access denied", execution_id=execution_id, user_id=user_id, error=str(e))
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error("Error getting dataset statistics", execution_id=execution_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve dataset statistics")


@router.get("/health", response_model=dict[str, Any])
async def get_dataset_service_health(
    dataset_service: DatasetIntegrationService = Depends(get_dataset_integration_service)
) -> dict[str, Any]:
    """
    Get dataset processing service health status.
    
    Args:
        dataset_service: Dataset integration service
        
    Returns:
        Health status information
    """
    try:
        health_status = await dataset_service.get_service_health()

        logger.debug("Dataset service health retrieved", status=health_status.get("status"))

        return health_status

    except Exception as e:
        logger.error("Error getting dataset service health", error=str(e))
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


# WebSocket-specific endpoints for real-time communication
@router.websocket("/ws/{execution_id}")
async def websocket_dataset_updates(
    execution_id: str,
    websocket_manager=Depends(get_websocket_manager),
    current_user: dict[str, Any] = Depends(get_current_user)
):
    """
    WebSocket endpoint for real-time dataset updates.
    
    Args:
        execution_id: Dataset execution ID
        websocket_manager: WebSocket manager
        current_user: Current authenticated user
        
    Returns:
        WebSocket connection for real-time updates
    """
    # This would be implemented with WebSocket support
    # For now, return a placeholder response
    return {
        "message": "WebSocket endpoint for dataset updates",
        "execution_id": execution_id,
        "user_id": current_user.get("user_id")
    }


# Utility functions
def _validate_dataset_config(config: dict[str, Any]) -> None:
    """Validate dataset processing configuration."""
    required_fields = ["sources", "processing_config"]
    missing_fields = [field for field in required_fields if field not in config]

    if missing_fields:
        raise ValidationError(f"Missing required dataset configuration fields: {missing_fields}")

    # Validate sources
    sources = config.get("sources", [])
    if not sources:
        raise ValidationError("At least one data source must be specified")

    for i, source in enumerate(sources):
        if "type" not in source:
            raise ValidationError(f"Source {i} missing required 'type' field")

        source_type = source["type"]
        supported_types = ["s3", "google_drive", "local", "huggingface"]
        if source_type not in supported_types:
            raise ValidationError(f"Unsupported source type: {source_type}")

    # Validate processing config
    processing_config = config.get("processing_config", {})
    if not isinstance(processing_config, dict):
        raise ValidationError("processing_config must be a dictionary")


# Error handlers
@router.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": f"HTTP_{exc.status_code}",
                "message": exc.detail,
                "timestamp": datetime.utcnow().isoformat()
            }
        }
    )


@router.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions."""
    logger.error(
        "Unhandled dataset WebSocket router exception",
        error=str(exc),
        error_type=type(exc).__name__,
        path=request.url.path
    )

    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An internal server error occurred",
                "timestamp": datetime.utcnow().isoformat()
            }
        }
    )
