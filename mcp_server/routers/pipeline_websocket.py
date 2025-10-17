"""
Enhanced WebSocket Router for Pipeline Orchestration

Provides WebSocket endpoints for real-time 6-stage pipeline orchestration,
integrating with Flask service and providing live progress updates.
"""

from datetime import datetime
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Path, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from ..exceptions import ValidationError
from ..middleware.auth import get_current_user
from ..services.flask_integration import FlaskIntegrationService
from ..services.integration_manager import IntegrationEventType, IntegrationManager

logger = structlog.get_logger(__name__)


# Pydantic models for request/response
class PipelineExecutionRequest(BaseModel):
    """Request model for pipeline execution."""
    pipeline_config: dict[str, Any] = Field(..., description="Pipeline configuration")
    execution_mode: str = Field(default="standard", description="Execution mode")
    quality_threshold: float = Field(default=0.8, ge=0.0, le=1.0, description="Quality threshold")
    enable_bias_detection: bool = Field(default=True, description="Enable bias detection")
    metadata: dict[str, Any] | None = Field(default=None, description="Additional metadata")


class PipelineStatusResponse(BaseModel):
    """Response model for pipeline status."""
    execution_id: str
    status: str
    current_stage: str | None
    overall_progress: float
    quality_score: float | None
    stage_results: dict[str, Any]
    start_time: str
    end_time: str | None
    error_message: str | None
    estimated_completion: str | None


class PipelineProgressUpdate(BaseModel):
    """Pipeline progress update data."""
    execution_id: str = Field(..., description="Pipeline execution ID")
    overall_progress: float = Field(..., ge=0, le=100, description="Overall progress percentage")
    current_stage: str | None = Field(None, description="Current pipeline stage")
    stage_progress: dict[str, Any] | None = Field(None, description="Stage-specific progress")
    estimated_completion: str | None = Field(None, description="Estimated completion time")
    message: str | None = Field(None, description="Progress message")


class PipelineStageRequest(BaseModel):
    """Request model for individual pipeline stage execution."""
    stage_name: str = Field(..., description="Pipeline stage name")
    input_data: dict[str, Any] = Field(..., description="Input data for the stage")
    execution_id: str | None = Field(None, description="Parent execution ID")


class PipelineCancelRequest(BaseModel):
    """Request model for pipeline cancellation."""
    reason: str | None = Field(None, description="Cancellation reason")


# Create router
router = APIRouter()


def get_flask_integration_service(request: Request) -> FlaskIntegrationService:
    """
    Get Flask integration service from application state.
    
    Args:
        request: FastAPI request object
        
    Returns:
        FlaskIntegrationService instance
        
    Raises:
        HTTPException: If service is not available
    """
    flask_service = getattr(request.app.state, "flask_integration_service", None)
    if not flask_service:
        raise HTTPException(
            status_code=503,
            detail="Pipeline service unavailable"
        )
    return flask_service


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


@router.post("/execute", response_model=dict[str, Any])
async def execute_pipeline(
    request: PipelineExecutionRequest,
    flask_service: FlaskIntegrationService = Depends(get_flask_integration_service),
    current_user: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """
    Execute 6-stage pipeline with real-time WebSocket updates.
    
    Args:
        request: Pipeline execution request
        flask_service: Flask integration service
        current_user: Current authenticated user
        
    Returns:
        Execution ID and status information
        
    Raises:
        HTTPException: If execution fails or user lacks permissions
    """
    try:
        user_id = current_user.get("user_id")

        # Validate pipeline configuration
        _validate_pipeline_config(request.pipeline_config)

        # Execute pipeline
        execution_id = await flask_service.execute_pipeline(
            request.pipeline_config,
            user_id
        )

        # Publish pipeline start event via integration manager
        integration_manager = get_integration_manager(Request)
        await integration_manager.publish_integration_event(
            IntegrationEventType.PIPELINE_STAGE_START,
            pipeline_id=execution_id,
            user_id=user_id,
            data={
                "stage_name": "initialization",
                "stage_number": 0,
                "execution_mode": request.execution_mode,
                "quality_threshold": request.quality_threshold,
                "enable_bias_detection": request.enable_bias_detection
            }
        )

        logger.info(
            "Pipeline execution initiated via WebSocket API",
            execution_id=execution_id,
            user_id=user_id,
            execution_mode=request.execution_mode
        )

        return {
            "status": "success",
            "execution_id": execution_id,
            "message": "Pipeline execution started successfully",
            "timestamp": datetime.utcnow().isoformat(),
            "estimated_duration": "30-60 seconds"
        }

    except ValidationError as e:
        logger.warning("Pipeline validation failed", user_id=current_user.get("user_id"), error=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Error initiating pipeline execution", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to initiate pipeline execution")


@router.get("/status/{execution_id}", response_model=PipelineStatusResponse)
async def get_pipeline_status(
    execution_id: str = Path(..., description="Pipeline execution ID"),
    flask_service: FlaskIntegrationService = Depends(get_flask_integration_service),
    current_user: dict[str, Any] = Depends(get_current_user)
) -> PipelineStatusResponse:
    """
    Get current pipeline execution status with WebSocket integration.
    
    Args:
        execution_id: Pipeline execution ID
        flask_service: Flask integration service
        current_user: Current authenticated user
        
    Returns:
        Current execution status and progress
        
    Raises:
        HTTPException: If execution not found or access denied
    """
    try:
        user_id = current_user.get("user_id")

        # Get execution status
        status_data = await flask_service.get_execution_status(execution_id, user_id)

        # Publish status query event
        integration_manager = get_integration_manager(Request)
        await integration_manager.publish_integration_event(
            IntegrationEventType.PIPELINE_PROGRESS,
            pipeline_id=execution_id,
            user_id=user_id,
            data={
                "status_query": True,
                "current_progress": status_data.get("overall_progress", 0),
                "current_stage": status_data.get("current_stage")
            }
        )

        logger.debug(
            "Pipeline status retrieved",
            execution_id=execution_id,
            user_id=user_id,
            status=status_data.get("status")
        )

        return PipelineStatusResponse(**status_data)

    except ValidationError as e:
        logger.warning("Pipeline status access denied", execution_id=execution_id, user_id=user_id, error=str(e))
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error("Error getting pipeline status", execution_id=execution_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve pipeline status")


@router.post("/{execution_id}/cancel", response_model=dict[str, Any])
async def cancel_pipeline(
    request: PipelineCancelRequest,
    execution_id: str = Path(..., description="Pipeline execution ID"),
    flask_service: FlaskIntegrationService = Depends(get_flask_integration_service),
    current_user: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """
    Cancel pipeline execution with WebSocket notification.
    
    Args:
        request: Cancellation request
        execution_id: Pipeline execution ID
        flask_service: Flask integration service
        current_user: Current authenticated user
        
    Returns:
        Cancellation result
        
    Raises:
        HTTPException: If cancellation fails or access denied
    """
    try:
        user_id = current_user.get("user_id")

        # Cancel execution
        success = await flask_service.cancel_execution(execution_id, user_id)

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
                "Pipeline execution cancelled",
                execution_id=execution_id,
                user_id=user_id,
                reason=request.reason
            )

            return {
                "status": "success",
                "message": "Pipeline execution cancelled successfully",
                "execution_id": execution_id,
                "timestamp": datetime.utcnow().isoformat()
            }
        raise HTTPException(status_code=400, detail="Failed to cancel pipeline execution")

    except ValidationError as e:
        logger.warning("Pipeline cancellation failed", execution_id=execution_id, error=str(e))
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error("Error cancelling pipeline execution", execution_id=execution_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to cancel pipeline execution")


@router.post("/{execution_id}/progress", response_model=dict[str, Any])
async def update_pipeline_progress(
    progress_update: PipelineProgressUpdate,
    execution_id: str = Path(..., description="Pipeline execution ID"),
    integration_manager: IntegrationManager = Depends(get_integration_manager),
    current_user: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """
    Update pipeline progress via WebSocket (for internal use by pipeline stages).
    
    Args:
        progress_update: Progress update data
        execution_id: Pipeline execution ID
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
                detail="Insufficient permissions to update pipeline progress"
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
                "estimated_completion": progress_update.estimated_completion,
                "message": progress_update.message
            }
        )

        logger.debug(
            "Pipeline progress updated via WebSocket API",
            execution_id=execution_id,
            progress=progress_update.overall_progress,
            current_stage=progress_update.current_stage
        )

        return {
            "status": "success",
            "message": "Pipeline progress updated successfully",
            "execution_id": execution_id,
            "timestamp": datetime.utcnow().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating pipeline progress", execution_id=execution_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to update pipeline progress")


@router.get("/active", response_model=list[dict[str, Any]])
async def get_active_executions(
    flask_service: FlaskIntegrationService = Depends(get_flask_integration_service),
    current_user: dict[str, Any] = Depends(get_current_user)
) -> list[dict[str, Any]]:
    """
    Get list of active pipeline executions.
    
    Args:
        flask_service: Flask integration service
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
            for execution_id, execution in flask_service.active_executions.items():
                if execution.status == PipelineStatus.RUNNING:
                    executions.append({
                        "execution_id": execution_id,
                        "user_id": execution.user_id,
                        "status": execution.status.value,
                        "current_stage": execution.current_stage.value if execution.current_stage else None,
                        "overall_progress": execution.overall_progress,
                        "start_time": execution.start_time.isoformat()
                    })
        else:
            # Regular users can only see their own executions
            executions = []
            for execution_id, execution in flask_service.active_executions.items():
                if execution.user_id == user_id and execution.status == PipelineStatus.RUNNING:
                    executions.append({
                        "execution_id": execution_id,
                        "status": execution.status.value,
                        "current_stage": execution.current_stage.value if execution.current_stage else None,
                        "overall_progress": execution.overall_progress,
                        "start_time": execution.start_time.isoformat()
                    })

        logger.info(
            "Active pipeline executions retrieved",
            user_id=user_id,
            role=user_role,
            count=len(executions)
        )

        return executions

    except Exception as e:
        logger.error("Error retrieving active executions", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve active executions")


@router.get("/health", response_model=dict[str, Any])
async def get_pipeline_service_health(
    flask_service: FlaskIntegrationService = Depends(get_flask_integration_service)
) -> dict[str, Any]:
    """
    Get pipeline service health status.
    
    Args:
        flask_service: Flask integration service
        
    Returns:
        Health status information
    """
    try:
        health_status = await flask_service.get_service_health()

        logger.debug("Pipeline service health retrieved", status=health_status.get("status"))

        return health_status

    except Exception as e:
        logger.error("Error getting pipeline service health", error=str(e))
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


# WebSocket-specific endpoints for real-time communication
@router.websocket("/ws/{execution_id}")
async def websocket_pipeline_updates(
    execution_id: str,
    websocket_manager=Depends(get_websocket_manager),
    current_user: dict[str, Any] = Depends(get_current_user)
):
    """
    WebSocket endpoint for real-time pipeline updates.
    
    Args:
        execution_id: Pipeline execution ID
        websocket_manager: WebSocket manager
        current_user: Current authenticated user
        
    Returns:
        WebSocket connection for real-time updates
    """
    # This would be implemented with WebSocket support
    # For now, return a placeholder response
    return {
        "message": "WebSocket endpoint for pipeline updates",
        "execution_id": execution_id,
        "user_id": current_user.get("user_id")
    }


# Utility functions
def _validate_pipeline_config(config: dict[str, Any]) -> None:
    """Validate pipeline configuration."""
    required_fields = ["source_format", "target_format", "input_data"]
    missing_fields = [field for field in required_fields if field not in config]

    if missing_fields:
        raise ValidationError(f"Missing required pipeline configuration fields: {missing_fields}")

    supported_formats = ["csv", "json", "jsonl", "parquet", "txt"]
    if config["source_format"] not in supported_formats:
        raise ValidationError(f"Unsupported source format: {config['source_format']}")

    if config["target_format"] not in supported_formats:
        raise ValidationError(f"Unsupported target format: {config['target_format']}")


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
        "Unhandled pipeline WebSocket router exception",
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
