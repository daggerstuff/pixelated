"""
Task management API endpoints for MCP server.

This module provides REST API endpoints for task creation, submission,
assignment, completion, and monitoring.
"""

from datetime import datetime
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from ..auth.dependencies import get_current_agent
from ..exceptions import ConflictError, ResourceNotFoundError, ValidationError
from ..models.agent import Agent
from ..models.task import (
    TaskCreationRequest,
    TaskFilter,
    TaskPriority,
    TaskResult,
    TaskStatus,
)
from ..services.agent import AgentService, get_agent_service
from ..services.task import TaskService, get_task_service

logger = structlog.get_logger(__name__)


router = APIRouter(prefix="/api/v1/tasks", tags=["tasks"])


class TaskResponse(BaseModel):
    """Task response model."""

    id: str
    type: str
    status: TaskStatus
    priority: TaskPriority
    created_at: datetime
    updated_at: datetime
    assigned_agent_id: str | None = None
    result: dict[str, Any] | None = None
    metadata: dict[str, Any]


class TaskListResponse(BaseModel):
    """Task list response model."""

    tasks: list[TaskResponse]
    total: int
    page: int
    page_size: int
    has_next: bool


class TaskSubmissionResponse(BaseModel):
    """Task submission response model."""

    task_id: str
    status: TaskStatus
    queue_position: int | None = None
    estimated_wait_time_seconds: float | None = None


class TaskCompletionRequest(BaseModel):
    """Task completion request model."""

    result: dict[str, Any]
    execution_time_seconds: float | None = None
    memory_usage_mb: float | None = None
    logs: list[str] | None = None


class TaskFailureRequest(BaseModel):
    """Task failure request model."""

    error_message: str
    error_type: str | None = None
    can_retry: bool = True
    execution_time_seconds: float | None = None


class QueueStatsResponse(BaseModel):
    """Queue statistics response model."""

    total_queued: int
    by_priority: dict[str, int]
    oldest_task_age_seconds: float | None
    average_queue_time_seconds: float | None
    queue_depth_by_priority: dict[str, int]
    service_status: str
    timestamp: str


class AssignmentRecommendationResponse(BaseModel):
    """Assignment recommendation response model."""

    task_id: str
    recommended_agent_id: str | None
    scores: list[dict[str, Any]]
    strategy_used: str
    reasoning: str


@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    request: TaskCreationRequest,
    current_agent: Agent = Depends(get_current_agent),
    task_service: TaskService = Depends(get_task_service)
) -> TaskResponse:
    """
    Create a new task.
    
    Args:
        request: Task creation request
        current_agent: Currently authenticated agent
        task_service: Task service
        
    Returns:
        Created task
        
    Raises:
        HTTPException: If creation fails
    """
    try:
        task = await task_service.create_task(request, current_agent.id)

        return TaskResponse(
            id=task.id,
            type=task.type,
            status=task.status,
            priority=task.priority,
            created_at=task.created_at,
            updated_at=task.updated_at,
            assigned_agent_id=task.assigned_agent_id,
            result=task.result,
            metadata=task.metadata
        )

    except ValidationError as e:
        logger.error("Task creation validation failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error("Task creation failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post("/{task_id}/submit", response_model=TaskSubmissionResponse)
async def submit_task(
    task_id: str,
    current_agent: Agent = Depends(get_current_agent),
    task_service: TaskService = Depends(get_task_service)
) -> TaskSubmissionResponse:
    """
    Submit a task to the queue.
    
    Args:
        task_id: Task ID
        current_agent: Currently authenticated agent
        task_service: Task service
        
    Returns:
        Submission response with queue information
        
    Raises:
        HTTPException: If submission fails
    """
    try:
        # Get task (this would need to be implemented to fetch from storage)
        # For now, we'll create a mock task for demonstration
        from ..models.task import Task
        task = Task(
            id=task_id,
            type="analysis",
            priority=TaskPriority.NORMAL,
            payload={},
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            metadata={}
        )

        success = await task_service.submit_task(task)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to submit task to queue"
            )

        # Get queue position and stats
        queue_position = await task_service.queue_service.get_task_queue_position(task_id)
        queue_stats = await task_service.get_queue_stats()

        # Estimate wait time based on queue stats
        estimated_wait_time = None
        if queue_stats.get("average_queue_time_seconds"):
            estimated_wait_time = queue_stats["average_queue_time_seconds"]

        return TaskSubmissionResponse(
            task_id=task_id,
            status=TaskStatus.QUEUED,
            queue_position=queue_position,
            estimated_wait_time_seconds=estimated_wait_time
        )

    except ConflictError as e:
        logger.error("Task submission conflict", task_id=task_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except ValidationError as e:
        logger.error("Task submission validation failed", task_id=task_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error("Task submission failed", task_id=task_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/{task_id}/status", response_model=TaskResponse)
async def get_task_status(
    task_id: str,
    current_agent: Agent = Depends(get_current_agent),
    task_service: TaskService = Depends(get_task_service)
) -> TaskResponse:
    """
    Get task status and details.
    
    Args:
        task_id: Task ID
        current_agent: Currently authenticated agent
        task_service: Task service
        
    Returns:
        Task details
        
    Raises:
        HTTPException: If task not found
    """
    try:
        # Get task status (this would need to be implemented to fetch from storage)
        # For now, we'll create a mock task for demonstration
        from ..models.task import Task
        task = Task(
            id=task_id,
            type="analysis",
            status=TaskStatus.PENDING,
            priority=TaskPriority.NORMAL,
            payload={},
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            metadata={}
        )

        return TaskResponse(
            id=task.id,
            type=task.type,
            status=task.status,
            priority=task.priority,
            created_at=task.created_at,
            updated_at=task.updated_at,
            assigned_agent_id=task.assigned_agent_id,
            result=task.result,
            metadata=task.metadata
        )

    except ResourceNotFoundError as e:
        logger.error("Task not found", task_id=task_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error("Failed to get task status", task_id=task_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post("/{task_id}/complete", response_model=TaskResponse)
async def complete_task(
    task_id: str,
    request: TaskCompletionRequest,
    current_agent: Agent = Depends(get_current_agent),
    task_service: TaskService = Depends(get_task_service)
) -> TaskResponse:
    """
    Complete a task with result.
    
    Args:
        task_id: Task ID
        request: Completion request with result
        current_agent: Currently authenticated agent
        task_service: Task service
        
    Returns:
        Updated task
        
    Raises:
        HTTPException: If completion fails
    """
    try:
        # Create result object
        result = TaskResult(
            success=True,
            data=request.result,
            execution_time_seconds=request.execution_time_seconds,
            memory_usage_mb=request.memory_usage_mb,
            logs=request.logs or []
        )

        success = await task_service.complete_task(task_id, result.dict())

        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to complete task"
            )

        # Get updated task (this would need to be implemented to fetch from storage)
        # For now, we'll create a mock task for demonstration
        from ..models.task import Task
        task = Task(
            id=task_id,
            type="analysis",
            status=TaskStatus.COMPLETED,
            priority=TaskPriority.NORMAL,
            payload={},
            result=result.dict(),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            assigned_agent_id=current_agent.id,
            metadata={}
        )

        return TaskResponse(
            id=task.id,
            type=task.type,
            status=task.status,
            priority=task.priority,
            created_at=task.created_at,
            updated_at=task.updated_at,
            assigned_agent_id=task.assigned_agent_id,
            result=task.result,
            metadata=task.metadata
        )

    except ValidationError as e:
        logger.error("Task completion validation failed", task_id=task_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except ResourceNotFoundError as e:
        logger.error("Task not found for completion", task_id=task_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error("Task completion failed", task_id=task_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post("/{task_id}/fail", response_model=TaskResponse)
async def fail_task(
    task_id: str,
    request: TaskFailureRequest,
    current_agent: Agent = Depends(get_current_agent),
    task_service: TaskService = Depends(get_task_service)
) -> TaskResponse:
    """
    Mark a task as failed.
    
    Args:
        task_id: Task ID
        request: Failure request with error details
        current_agent: Currently authenticated agent
        task_service: Task service
        
    Returns:
        Updated task
        
    Raises:
        HTTPException: If failure marking fails
    """
    try:
        success = await task_service.fail_task(
            task_id,
            request.error_message,
            request.can_retry
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to mark task as failed"
            )

        # Get updated task (this would need to be implemented to fetch from storage)
        # For now, we'll create a mock task for demonstration
        from ..models.task import Task
        task = Task(
            id=task_id,
            type="analysis",
            status=TaskStatus.FAILED,
            priority=TaskPriority.NORMAL,
            payload={},
            result={
                "success": False,
                "error": request.error_message,
                "can_retry": request.can_retry,
                "error_type": request.error_type,
                "execution_time_seconds": request.execution_time_seconds
            },
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            assigned_agent_id=current_agent.id,
            metadata={}
        )

        return TaskResponse(
            id=task.id,
            type=task.type,
            status=task.status,
            priority=task.priority,
            created_at=task.created_at,
            updated_at=task.updated_at,
            assigned_agent_id=task.assigned_agent_id,
            result=task.result,
            metadata=task.metadata
        )

    except ResourceNotFoundError as e:
        logger.error("Task not found for failure", task_id=task_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error("Task failure marking failed", task_id=task_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post("/{task_id}/cancel", response_model=TaskResponse)
async def cancel_task(
    task_id: str,
    current_agent: Agent = Depends(get_current_agent),
    task_service: TaskService = Depends(get_task_service)
) -> TaskResponse:
    """
    Cancel a task.
    
    Args:
        task_id: Task ID
        current_agent: Currently authenticated agent
        task_service: Task service
        
    Returns:
        Updated task
        
    Raises:
        HTTPException: If cancellation fails
    """
    try:
        success = await task_service.cancel_task(task_id)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to cancel task or task not found in queue"
            )

        # Get updated task (this would need to be implemented to fetch from storage)
        # For now, we'll create a mock task for demonstration
        from ..models.task import Task
        task = Task(
            id=task_id,
            type="analysis",
            status=TaskStatus.CANCELLED,
            priority=TaskPriority.NORMAL,
            payload={},
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            assigned_agent_id=None,
            metadata={}
        )

        return TaskResponse(
            id=task.id,
            type=task.type,
            status=task.status,
            priority=task.priority,
            created_at=task.created_at,
            updated_at=task.updated_at,
            assigned_agent_id=task.assigned_agent_id,
            result=task.result,
            metadata=task.metadata
        )

    except Exception as e:
        logger.error("Task cancellation failed", task_id=task_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/", response_model=TaskListResponse)
async def list_tasks(
    status: TaskStatus | None = Query(None, description="Filter by task status"),
    priority: TaskPriority | None = Query(None, description="Filter by priority"),
    type: str | None = Query(None, description="Filter by task type"),
    agent_id: str | None = Query(None, description="Filter by assigned agent"),
    pipeline_id: str | None = Query(None, description="Filter by pipeline ID"),
    created_after: datetime | None = Query(None, description="Filter tasks created after this time"),
    created_before: datetime | None = Query(None, description="Filter tasks created before this time"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size"),
    current_agent: Agent = Depends(get_current_agent),
    task_service: TaskService = Depends(get_task_service)
) -> TaskListResponse:
    """
    List tasks with filtering and pagination.
    
    Args:
        status: Optional status filter
        priority: Optional priority filter
        type: Optional type filter
        agent_id: Optional assigned agent filter
        pipeline_id: Optional pipeline filter
        created_after: Optional creation time filter
        created_before: Optional creation time filter
        page: Page number
        page_size: Page size
        current_agent: Currently authenticated agent
        task_service: Task service
        
    Returns:
        Paginated list of tasks
    """
    try:
        # Create filter
        task_filter = TaskFilter(
            status=status,
            priority=priority,
            type=type,
            agent_id=agent_id,
            pipeline_id=pipeline_id,
            created_after=created_after,
            created_before=created_before,
            page=page,
            page_size=page_size
        )

        # This would need to be implemented to fetch from storage
        # For now, we'll return mock data for demonstration
        mock_tasks = []
        total = 0

        # Mock implementation - in production this would query the database
        if status == TaskStatus.PENDING or status is None:
            from ..models.task import Task
            mock_task = Task(
                id="mock-task-1",
                type="analysis",
                status=TaskStatus.PENDING,
                priority=TaskPriority.NORMAL,
                payload={},
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
                metadata={}
            )

            mock_tasks.append(TaskResponse(
                id=mock_task.id,
                type=mock_task.type,
                status=mock_task.status,
                priority=mock_task.priority,
                created_at=mock_task.created_at,
                updated_at=mock_task.updated_at,
                assigned_agent_id=mock_task.assigned_agent_id,
                result=mock_task.result,
                metadata=mock_task.metadata
            ))
            total = 1

        return TaskListResponse(
            tasks=mock_tasks,
            total=total,
            page=page,
            page_size=page_size,
            has_next=False
        )

    except ValidationError as e:
        logger.error("Task listing validation failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error("Task listing failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/stats", response_model=QueueStatsResponse)
async def get_queue_stats(
    current_agent: Agent = Depends(get_current_agent),
    task_service: TaskService = Depends(get_task_service)
) -> QueueStatsResponse:
    """
    Get queue statistics.
    
    Args:
        current_agent: Currently authenticated agent
        task_service: Task service
        
    Returns:
        Queue statistics
    """
    try:
        stats = await task_service.get_queue_stats()

        return QueueStatsResponse(
            total_queued=stats.get("total_queued", 0),
            by_priority=stats.get("by_priority", {}),
            oldest_task_age_seconds=stats.get("oldest_task_age_seconds"),
            average_queue_time_seconds=stats.get("average_queue_time_seconds"),
            queue_depth_by_priority=stats.get("queue_depth_by_priority", {}),
            service_status=stats.get("service_status", "unknown"),
            timestamp=stats.get("timestamp", datetime.utcnow().isoformat())
        )

    except Exception as e:
        logger.error("Failed to get queue stats", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/{task_id}/assignments", response_model=AssignmentRecommendationResponse)
async def get_assignment_recommendations(
    task_id: str,
    current_agent: Agent = Depends(get_current_agent),
    task_service: TaskService = Depends(get_task_service),
    agent_service: AgentService = Depends(get_agent_service)
) -> AssignmentRecommendationResponse:
    """
    Get assignment recommendations for a task.
    
    Args:
        task_id: Task ID
        current_agent: Currently authenticated agent
        task_service: Task service
        agent_service: Agent service
        
    Returns:
        Assignment recommendations
        
    Raises:
        HTTPException: If recommendation generation fails
    """
    try:
        # Get task (this would need to be implemented to fetch from storage)
        # For now, we'll create a mock task for demonstration
        from ..models.task import Task
        task = Task(
            id=task_id,
            type="analysis",
            priority=TaskPriority.NORMAL,
            payload={},
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            metadata={}
        )

        # Get available agents
        available_agents = await agent_service.list_agents(status="available")

        # Get assignment recommendations
        recommendations = await task_service.get_assignment_recommendations(
            task, available_agents
        )

        if not recommendations:
            return AssignmentRecommendationResponse(
                task_id=task_id,
                recommended_agent_id=None,
                scores=[],
                strategy_used="none",
                reasoning="No suitable agents found"
            )

        # Use the first recommendation (best one)
        best_recommendation = recommendations[0]

        return AssignmentRecommendationResponse(
            task_id=task_id,
            recommended_agent_id=best_recommendation.get("recommended_agent_id"),
            scores=best_recommendation.get("scores", []),
            strategy_used=best_recommendation.get("strategy_used", "unknown"),
            reasoning=best_recommendation.get("reasoning", "")
        )

    except ResourceNotFoundError as e:
        logger.error("Task not found for assignment recommendations", task_id=task_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error("Assignment recommendation failed", task_id=task_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post("/{task_id}/retry", response_model=TaskResponse)
async def retry_task(
    task_id: str,
    current_agent: Agent = Depends(get_current_agent),
    task_service: TaskService = Depends(get_task_service)
) -> TaskResponse:
    """
    Retry a failed task.
    
    Args:
        task_id: Task ID
        current_agent: Currently authenticated agent
        task_service: Task service
        
    Returns:
        Updated task
        
    Raises:
        HTTPException: If retry fails
    """
    try:
        success = await task_service.retry_task(task_id)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Task cannot be retried or retry failed"
            )

        # Get updated task (this would need to be implemented to fetch from storage)
        # For now, we'll create a mock task for demonstration
        from ..models.task import Task
        task = Task(
            id=task_id,
            type="analysis",
            status=TaskStatus.PENDING,
            priority=TaskPriority.NORMAL,
            payload={},
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            metadata={}
        )

        return TaskResponse(
            id=task.id,
            type=task.type,
            status=task.status,
            priority=task.priority,
            created_at=task.created_at,
            updated_at=task.updated_at,
            assigned_agent_id=task.assigned_agent_id,
            result=task.result,
            metadata=task.metadata
        )

    except ValidationError as e:
        logger.error("Task retry validation failed", task_id=task_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except ResourceNotFoundError as e:
        logger.error("Task not found for retry", task_id=task_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error("Task retry failed", task_id=task_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )
