"""
Task management service for MCP server.

This module provides the main task management service that integrates
queue management, assignment algorithms, and task lifecycle management.
"""


import asyncio
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import contextlib

import structlog

from mcp_server.models.task import Task, TaskStatus, TaskPriority
try:
    from mcp_server.models.task import TaskCreationRequest, TaskUpdateRequest
except Exception:
    # Backwards/alternate naming
    try:
        from mcp_server.models.task import TaskCreateRequest as TaskCreationRequest
        TaskUpdateRequest = None
    except Exception:
        TaskCreationRequest = None
        TaskUpdateRequest = None

from mcp_server.models.agent import Agent
from mcp_server.exceptions import (
    ResourceNotFoundError,
    ValidationError,
    ConflictError,
    AuthorizationError
)
from mcp_server.services.queue import RedisQueueService, get_queue_service
from mcp_server.services.assignment import TaskAssignmentService, get_assignment_service


logger = structlog.get_logger(__name__)


class TaskService:
    """Main task management service."""

    def __init__(self, queue_service: RedisQueueService, assignment_service: TaskAssignmentService):
        """
        Initialize task service.

        Args:
            queue_service: Redis queue service
            assignment_service: Task assignment service
        """
        self.queue_service = queue_service
        self.assignment_service = assignment_service
        self._monitoring_task: Optional[asyncio.Task] = None

    async def start(self) -> None:
        """Start task service."""
        logger.info("Starting task service")

        # Start monitoring task
        self._monitoring_task = asyncio.create_task(self._monitor_tasks())

        logger.info("Task service started successfully")

    async def stop(self) -> None:
        """Stop task service."""
        logger.info("Stopping task service")

        if self._monitoring_task:
            self._monitoring_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._monitoring_task

        logger.info("Task service stopped")

    async def create_task(self, request: TaskCreationRequest, creator_agent_id: Optional[str] = None) -> Task:
        """
        Create a new task.

        Args:
            request: Task creation request
            creator_agent_id: Optional ID of agent creating the task

        Returns:
            Created task

        Raises:
            ValidationError: If request is invalid
        """
        try:
            # Generate task ID
            task_id = str(uuid.uuid4())

            # Create task
            task = Task(
                id=task_id,
                type=request.type,
                priority=request.priority,
                payload=request.payload,
                config=request.config,
                requirements=request.requirements,
                parent_task_id=request.parent_task_id,
                max_retries=request.max_retries,
                timeout_seconds=request.timeout_seconds,
                metadata={
                    **request.metadata,
                    'created_by': creator_agent_id,
                    'created_at': datetime.utcnow().isoformat()
                }
            )

            # Validate task requirements
            self._validate_task_requirements(task)

            logger.info("Task created successfully", task_id=task_id, type=request.type)
            return task

        except Exception as e:
            logger.error("Failed to create task", error=str(e))
            raise

    async def submit_task(self, task: Task) -> bool:
        """
        Submit a task to the queue.

        Args:
            task: Task to submit

        Returns:
            True if task was submitted successfully

        Raises:
            ValidationError: If task is invalid
            ConflictError: If task is already submitted
        """
        try:
            # Validate task can be submitted
            if not task.is_pending():
                raise ValidationError(f"Task {task.id} is not in pending status")

            # Enqueue task
            success = await self.queue_service.enqueue_task(task)

            if success:
                logger.info("Task submitted to queue", task_id=task.id, type=task.type)

            return success

        except Exception as e:
            logger.error("Failed to submit task", task_id=task.id, error=str(e))
            raise

    async def assign_task(self, task: Task, available_agents: List[Agent]) -> Optional[str]:
        """
        Assign a task to an agent.

        Args:
            task: Task to assign
            available_agents: List of available agents

        Returns:
            Agent ID if assignment successful, None otherwise

        Raises:
            ResourceNotFoundError: If no suitable agent found
        """
        try:
            # Get assignment recommendation
            assignment_result = await self.assignment_service.assign_task(task, available_agents)

            if assignment_result.agent_id:
                logger.info(
                    "Task assigned successfully",
                    task_id=task.id,
                    agent_id=assignment_result.agent_id,
                    strategy=assignment_result.strategy.value,
                    score=assignment_result.score
                )
                return assignment_result.agent_id

            logger.warning("No suitable agent found for task", task_id=task.id)
            return None

        except Exception as e:
            logger.error("Failed to assign task", task_id=task.id, error=str(e))
            raise

    async def dequeue_task_for_agent(self, agent: Agent, task_types: Optional[List[str]] = None) -> Optional[Task]:
        """
        Dequeue a task for an agent.

        Args:
            agent: Agent to dequeue task for
            task_types: Optional list of task types to filter by

        Returns:
            Task if available, None otherwise

        Raises:
            ValidationError: If agent is invalid
        """
        try:
            task = await self.queue_service.dequeue_task(agent, task_types)

            if task:
                logger.info(
                    "Task dequeued for agent",
                    task_id=task.id,
                    agent_id=agent.id,
                    type=task.type
                )

            return task

        except Exception as e:
            logger.error("Failed to dequeue task for agent", agent_id=agent.id, error=str(e))
            raise

    async def update_task_status(self, task_id: str, status: TaskStatus,
                                result: Optional[Dict[str, Any]] = None) -> bool:
        """
        Update task status.

        Args:
            task_id: Task identifier
            status: New status
            result: Optional task result

        Returns:
            True if updated successfully

        Raises:
            ResourceNotFoundError: If task not found
        """
        try:
            success = await self.queue_service.update_task_status(task_id, status, result)

            if success:
                logger.info("Task status updated", task_id=task_id, status=status.value)

            return success

        except Exception as e:
            logger.error("Failed to update task status", task_id=task_id, error=str(e))
            raise

    async def complete_task(self, task_id: str, result: Dict[str, Any]) -> bool:
        """
        Complete a task with result.

        Args:
            task_id: Task identifier
            result: Task result

        Returns:
            True if completed successfully

        Raises:
            ResourceNotFoundError: If task not found
            ValidationError: If result is invalid
        """
        try:
            # Validate result
            if not isinstance(result, dict):
                raise ValidationError("Task result must be a dictionary")

            success = await self.update_task_status(task_id, TaskStatus.COMPLETED, result)

            if success:
                logger.info("Task completed successfully", task_id=task_id)

            return success

        except Exception as e:
            logger.error("Failed to complete task", task_id=task_id, error=str(e))
            raise

    async def fail_task(self, task_id: str, error_message: str,
                       can_retry: bool = True) -> bool:
        """
        Fail a task with error message.

        Args:
            task_id: Task identifier
            error_message: Error message
            can_retry: Whether task can be retried

        Returns:
            True if failed successfully

        Raises:
            ResourceNotFoundError: If task not found
        """
        try:
            result = {
                'success': False,
                'error': error_message,
                'can_retry': can_retry
            }

            success = await self.update_task_status(task_id, TaskStatus.FAILED, result)

            if success:
                logger.warning("Task failed", task_id=task_id, error=error_message)

            return success

        except Exception as e:
            logger.error("Failed to fail task", task_id=task_id, error=str(e))
            raise

    async def cancel_task(self, task_id: str) -> bool:
        """
        Cancel a task.

        Args:
            task_id: Task identifier

        Returns:
            True if cancelled successfully

        Raises:
            ResourceNotFoundError: If task not found
        """
        try:
            success = await self.queue_service.cancel_task(task_id)

            if success:
                logger.info("Task cancelled", task_id=task_id)

            return success

        except Exception as e:
            logger.error("Failed to cancel task", task_id=task_id, error=str(e))
            raise

    async def retry_task(self, task_id: str) -> bool:
        """
        Retry a failed task.

        Args:
            task_id: Task identifier

        Returns:
            True if task can be retried and was resubmitted

        Raises:
            ResourceNotFoundError: If task not found
            ValidationError: If task cannot be retried
        """
        try:
            # Get current task status
            current_status = await self.queue_service.get_task_status(task_id)

            if not current_status:
                raise ResourceNotFoundError(f"Task {task_id} not found")

            if current_status not in [TaskStatus.FAILED, TaskStatus.TIMEOUT]:
                raise ValidationError(f"Task {task_id} is not in a retryable status")

            # Check if task can be retried (this would need to be implemented in queue service)
            # For now, we'll assume it can be retried and resubmit it

            # Create a new task with the same parameters
            # This is a simplified implementation - in production you'd want to clone the original task
            logger.info("Task retry requested", task_id=task_id)

            # For now, just return False as we need the original task data
            # In a full implementation, we'd fetch the original task and resubmit it
            return False

        except Exception as e:
            logger.error("Failed to retry task", task_id=task_id, error=str(e))
            raise

    async def get_task_status(self, task_id: str) -> Optional[TaskStatus]:
        """
        Get task status.

        Args:
            task_id: Task identifier

        Returns:
            Task status if found, None otherwise
        """
        try:
            return await self.queue_service.get_task_status(task_id)

        except Exception as e:
            logger.error("Failed to get task status", task_id=task_id, error=str(e))
            return None

    async def get_queue_stats(self) -> Dict[str, Any]:
        """
        Get queue statistics.

        Returns:
            Queue statistics
        """
        try:
            stats = await self.queue_service.get_queue_stats()

            return {
                **stats.dict(),
                'service_status': 'active',
                'timestamp': datetime.utcnow().isoformat(),
            }
        except Exception as e:
            logger.error("Failed to get queue stats", error=str(e))
            return {
                'error': str(e),
                'service_status': 'error',
                'timestamp': datetime.now(timezone.utc).isoformat(),
            }

    async def get_assignment_recommendations(self, task: Task,
                                           available_agents: List[Agent]) -> List[Dict[str, Any]]:
        """
        Get assignment recommendations for a task.

        Args:
            task: Task to get recommendations for
            available_agents: List of available agents

        Returns:
            List of assignment recommendations
        """
        try:
            recommendations = await self.assignment_service.get_assignment_recommendations(
                task, available_agents
            )

            return [rec.dict() for rec in recommendations]

        except Exception as e:
            logger.error("Failed to get assignment recommendations", error=str(e))
            return []

    def _validate_task_requirements(self, task: Task) -> None:
        """
        Validate task requirements.

        Args:
            task: Task to validate

        Raises:
            ValidationError: If requirements are invalid
        """
        # Validate memory requirements
        required_memory = task.requirements.get('memory_mb')
        if required_memory is not None and (not isinstance(required_memory, int) or required_memory <= 0):
            raise ValidationError("Memory requirement must be a positive integer")

        # Validate CPU requirements
        required_cpu = task.requirements.get('cpu_cores')
        if required_cpu is not None and (not isinstance(required_cpu, (int, float)) or required_cpu <= 0):
            raise ValidationError("CPU requirement must be a positive number")

        # Validate timeout
        if task.timeout_seconds <= 0:
            raise ValidationError("Task timeout must be positive")

        # Validate max retries
        if task.max_retries < 0:
            raise ValidationError("Max retries must be non-negative")

    async def _monitor_tasks(self) -> None:
        """Monitor tasks and handle timeouts."""
        while True:
            try:
                await asyncio.sleep(60)  # Check every minute

                # This would implement timeout handling
                # For now, just log that monitoring is active
                logger.debug("Task monitoring cycle completed")

            except asyncio.CancelledError:
                logger.info("Task monitoring stopped")
                break
            except Exception as e:
                logger.error("Error in task monitoring", error=str(e))
                # Continue monitoring even if there's an error


# Dependency injection function
async def get_task_service() -> TaskService:
    """Get task service instance."""
    queue_service = await get_queue_service()
    assignment_service = get_assignment_service()

    service = TaskService(queue_service, assignment_service)
    await service.start()

    return service
