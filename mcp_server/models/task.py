"""
Task models for MCP server task delegation and queue management.

This module defines the data models for tasks, task results, and task-related
enumerations following the Pixelated platform's patterns and HIPAA compliance requirements.
"""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, validator


class TaskStatus(str, Enum):
    """Task status enumeration."""

    PENDING = "pending"
    QUEUED = "queued"
    ASSIGNED = "assigned"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"


class TaskPriority(int, Enum):
    """Task priority levels with numerical values for sorting."""

    LOW = 1
    NORMAL = 5
    HIGH = 10
    CRITICAL = 20


class TaskType(str, Enum):
    """Task type enumeration."""

    DATA_PROCESSING = "data_processing"
    AI_ANALYSIS = "ai_analysis"
    BIAS_DETECTION = "bias_detection"
    PIPELINE_EXECUTION = "pipeline_execution"
    VALIDATION = "validation"
    TRANSFORMATION = "transformation"
    REPORT_GENERATION = "report_generation"


class TaskResult(BaseModel):
    """Task execution result model."""

    success: bool = Field(..., description="Whether the task completed successfully")
    data: dict[str, Any] | None = Field(None, description="Result data")
    error_message: str | None = Field(None, description="Error message if failed")
    error_code: str | None = Field(None, description="Error code for categorization")
    execution_time_seconds: float | None = Field(None, description="Execution time in seconds")
    memory_usage_mb: float | None = Field(None, description="Peak memory usage in MB")
    logs: list[str] | None = Field(None, description="Execution logs")
    artifacts: dict[str, Any] | None = Field(None, description="Additional result artifacts")

    class Config:
        """Pydantic configuration."""
        extra = "allow"  # Allow additional fields


class Task(BaseModel):
    """Main task model for MCP server."""

    id: str = Field(..., description="Unique task identifier")
    pipeline_id: str = Field(..., description="Associated pipeline ID")
    agent_id: str | None = Field(None, description="Assigned agent ID")
    type: TaskType = Field(..., description="Task type")
    name: str = Field(..., min_length=1, max_length=200, description="Task name")
    description: str | None = Field(None, max_length=1000, description="Task description")
    priority: TaskPriority = Field(TaskPriority.NORMAL, description="Task priority")
    status: TaskStatus = Field(TaskStatus.PENDING, description="Current task status")

    # Task configuration
    max_retries: int = Field(3, ge=0, le=10, description="Maximum retry attempts")
    timeout_seconds: int = Field(300, ge=30, le=3600, description="Task timeout in seconds")
    estimated_duration_seconds: int | None = Field(None, description="Estimated execution time")
    memory_requirements_mb: int | None = Field(None, description="Memory requirements in MB")

    # Task data
    input_data: dict[str, Any] = Field(default_factory=dict, description="Task input data")
    output_data: dict[str, Any] | None = Field(None, description="Task output data")
    result: TaskResult | None = Field(None, description="Task execution result")

    # Requirements and constraints
    required_capabilities: list[str] = Field(default_factory=list, description="Required agent capabilities")
    constraints: dict[str, Any] | None = Field(None, description="Task-specific constraints")

    # Metadata
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    tags: list[str] = Field(default_factory=list, description="Task tags for categorization")

    # Timestamps
    created_at: datetime = Field(..., description="Task creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    queued_at: datetime | None = Field(None, description="When task was queued")
    assigned_at: datetime | None = Field(None, description="When task was assigned")
    started_at: datetime | None = Field(None, description="When task execution started")
    completed_at: datetime | None = Field(None, description="When task was completed")

    # Retry information
    retry_count: int = Field(0, ge=0, description="Current retry count")
    last_error: str | None = Field(None, description="Last error message")

    class Config:
        """Pydantic configuration."""
        use_enum_values = True
        extra = "allow"  # Allow additional fields for flexibility

    @validator("name")
    def validate_name(cls, v):
        """Validate task name."""
        if not v or not v.strip():
            raise ValueError("Task name cannot be empty")
        return v.strip()

    @validator("timeout_seconds")
    def validate_timeout(cls, v):
        """Validate timeout is reasonable."""
        if v < 30:
            raise ValueError("Timeout must be at least 30 seconds")
        if v > 3600:
            raise ValueError("Timeout cannot exceed 1 hour")
        return v

    def is_retryable(self) -> bool:
        """Check if task can be retried."""
        return (self.status == TaskStatus.FAILED and
                self.retry_count < self.max_retries)

    def get_execution_time(self) -> float | None:
        """Get task execution time in seconds."""
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None

    def get_queue_time(self) -> float | None:
        """Get time spent in queue in seconds."""
        if self.queued_at and self.assigned_at:
            return (self.assigned_at - self.queued_at).total_seconds()
        return None


class TaskQueueItem(BaseModel):
    """Task queue item for Redis-based queue management."""

    task_id: str = Field(..., description="Task ID")
    priority: int = Field(..., description="Task priority value")
    created_at: datetime = Field(..., description="Queue entry timestamp")
    agent_constraints: dict[str, Any] | None = Field(None, description="Agent selection constraints")

    class Config:
        """Pydantic configuration."""
        extra = "allow"


class TaskAssignment(BaseModel):
    """Task assignment model."""

    task_id: str = Field(..., description="Task ID")
    agent_id: str = Field(..., description="Assigned agent ID")
    assignment_score: float = Field(..., description="Assignment suitability score")
    assignment_reason: str = Field(..., description="Reason for assignment")
    assigned_at: datetime = Field(..., description="Assignment timestamp")
    expected_completion_time: datetime | None = Field(None, description="Expected completion time")

    class Config:
        """Pydantic configuration."""
        extra = "allow"


class TaskFilter(BaseModel):
    """Task filter model for querying tasks."""

    pipeline_id: str | None = Field(None, description="Filter by pipeline ID")
    agent_id: str | None = Field(None, description="Filter by assigned agent ID")
    type: TaskType | None = Field(None, description="Filter by task type")
    status: TaskStatus | None = Field(None, description="Filter by task status")
    priority: TaskPriority | None = Field(None, description="Filter by minimum priority")
    tags: list[str] | None = Field(None, description="Filter by tags")
    created_after: datetime | None = Field(None, description="Filter tasks created after this time")
    created_before: datetime | None = Field(None, description="Filter tasks created before this time")

    class Config:
        """Pydantic configuration."""
        use_enum_values = True


class TaskStats(BaseModel):
    """Task statistics model."""

    total_tasks: int = Field(0, description="Total number of tasks")
    pending_tasks: int = Field(0, description="Number of pending tasks")
    queued_tasks: int = Field(0, description="Number of queued tasks")
    running_tasks: int = Field(0, description="Number of running tasks")
    completed_tasks: int = Field(0, description="Number of completed tasks")
    failed_tasks: int = Field(0, description="Number of failed tasks")
    cancelled_tasks: int = Field(0, description="Number of cancelled tasks")

    # Priority distribution
    low_priority_tasks: int = Field(0, description="Number of low priority tasks")
    normal_priority_tasks: int = Field(0, description="Number of normal priority tasks")
    high_priority_tasks: int = Field(0, description="Number of high priority tasks")
    critical_priority_tasks: int = Field(0, description="Number of critical priority tasks")

    # Timing statistics
    average_queue_time_seconds: float | None = Field(None, description="Average time in queue")
    average_execution_time_seconds: float | None = Field(None, description="Average execution time")

    # Queue statistics
    queue_depth: int = Field(0, description="Current queue depth")
    queue_oldest_task_seconds: float | None = Field(None, description="Age of oldest queued task")


class TaskCreateRequest(BaseModel):
    """Request model for creating tasks."""

    pipeline_id: str = Field(..., description="Associated pipeline ID")
    type: TaskType = Field(..., description="Task type")
    name: str = Field(..., min_length=1, max_length=200, description="Task name")
    description: str | None = Field(None, max_length=1000, description="Task description")
    priority: TaskPriority = Field(TaskPriority.NORMAL, description="Task priority")

    # Task configuration
    max_retries: int = Field(3, ge=0, le=10, description="Maximum retry attempts")
    timeout_seconds: int = Field(300, ge=30, le=3600, description="Task timeout in seconds")
    estimated_duration_seconds: int | None = Field(None, description="Estimated execution time")
    memory_requirements_mb: int | None = Field(None, description="Memory requirements in MB")

    # Task data
    input_data: dict[str, Any] = Field(default_factory=dict, description="Task input data")

    # Requirements and constraints
    required_capabilities: list[str] = Field(default_factory=list, description="Required agent capabilities")
    constraints: dict[str, Any] | None = Field(None, description="Task-specific constraints")

    # Metadata
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    tags: list[str] = Field(default_factory=list, description="Task tags for categorization")

    class Config:
        """Pydantic configuration."""
        use_enum_values = True

    @validator("name")
    def validate_name(cls, v):
        """Validate task name."""
        if not v or not v.strip():
            raise ValueError("Task name cannot be empty")
        return v.strip()


class TaskSubmitRequest(BaseModel):
    """Request model for submitting tasks to queue."""

    priority: TaskPriority | None = Field(None, description="Override task priority")
    agent_constraints: dict[str, Any] | None = Field(None, description="Agent selection constraints")


class TaskUpdateRequest(BaseModel):
    """Backward-compatible minimal TaskUpdateRequest used by routers/tests."""
    name: str | None = Field(None, description="Optional new name")
    description: str | None = Field(None, description="Optional new description")
    priority: TaskPriority | None = Field(None, description="Optional new priority")
    timeout_seconds: int | None = Field(None, description="Optional new timeout")



class TaskCompleteRequest(BaseModel):
    """Request model for completing tasks."""

    success: bool = Field(..., description="Whether the task completed successfully")
    result_data: dict[str, Any] | None = Field(None, description="Task result data")
    error_message: str | None = Field(None, description="Error message if failed")
    error_code: str | None = Field(None, description="Error code for categorization")
    execution_time_seconds: float | None = Field(None, description="Execution time in seconds")
    memory_usage_mb: float | None = Field(None, description="Peak memory usage in MB")
    logs: list[str] | None = Field(None, description="Execution logs")
    artifacts: dict[str, Any] | None = Field(None, description="Additional result artifacts")


class TaskFailRequest(BaseModel):
    """Request model for failing tasks."""

    error_message: str = Field(..., description="Error message")
    error_code: str | None = Field(None, description="Error code for categorization")
    logs: list[str] | None = Field(None, description="Execution logs")
    retry_eligible: bool = Field(True, description="Whether task is eligible for retry")


# Helper functions
def create_task_id() -> str:
    """Create a unique task ID."""
    from uuid import uuid4
    return f"task_{uuid4().hex}"


def get_priority_value(priority: TaskPriority) -> int:
    """Get numerical priority value for sorting."""
    return priority.value


def is_valid_status_transition(current_status: TaskStatus, new_status: TaskStatus) -> bool:
    """Check if a status transition is valid."""
    valid_transitions = {
        TaskStatus.PENDING: [TaskStatus.QUEUED, TaskStatus.CANCELLED],
        TaskStatus.QUEUED: [TaskStatus.ASSIGNED, TaskStatus.CANCELLED],
        TaskStatus.ASSIGNED: [TaskStatus.RUNNING, TaskStatus.QUEUED, TaskStatus.CANCELLED],
        TaskStatus.RUNNING: [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED, TaskStatus.TIMEOUT],
        TaskStatus.COMPLETED: [],  # Terminal state
        TaskStatus.FAILED: [TaskStatus.QUEUED],  # Can be retried
        TaskStatus.CANCELLED: [],  # Terminal state
        TaskStatus.TIMEOUT: [TaskStatus.QUEUED],  # Can be retried
    }

    return new_status in valid_transitions.get(current_status, [])


# Backwards-compatible aliases expected by older tests/modules
# Some tests import `TaskCreationRequest`; provide an alias to the
# current `TaskCreateRequest` to avoid ImportError during collection.
TaskCreationRequest = TaskCreateRequest
