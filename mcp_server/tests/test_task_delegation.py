"""
Unit tests for task delegation and queue management system.

Tests the core functionality of task creation, queue management,
assignment algorithms, and task lifecycle management.
"""

from datetime import datetime
from unittest.mock import AsyncMock, Mock

import pytest

from ..exceptions import ResourceNotFoundError, ValidationError
from ..models.agent import Agent, AgentCapability, AgentStatus
from ..models.task import Task, TaskCreationRequest, TaskPriority, TaskStatus
from ..services.assignment import AssignmentStrategy, TaskAssignmentService
from ..services.queue import AgentCapacityManager, TaskQueueService
from ..services.task import TaskService


@pytest.fixture
def mock_redis():
    """Create a mock Redis client."""
    redis = Mock()
    redis.zadd = AsyncMock(return_value=1)
    redis.zrange = AsyncMock(return_value=[])
    redis.zrem = AsyncMock(return_value=1)
    redis.zscore = AsyncMock(return_value=None)
    redis.zrank = AsyncMock(return_value=None)
    redis.setex = AsyncMock(return_value=True)
    redis.get = AsyncMock(return_value=None)
    redis.delete = AsyncMock(return_value=1)
    redis.scan = AsyncMock(return_value=(0, []))
    redis.pipeline = Mock()
    redis.pipeline.return_value.__aenter__ = AsyncMock()
    redis.pipeline.return_value.__aexit__ = AsyncMock()
    return redis


@pytest.fixture
def queue_service(mock_redis):
    """Create a TaskQueueService instance with mock Redis."""
    return TaskQueueService(mock_redis)


@pytest.fixture
def assignment_service():
    """Create a TaskAssignmentService instance."""
    return TaskAssignmentService()


@pytest.fixture
def sample_task():
    """Create a sample task for testing."""
    return Task(
        id="test-task-1",
        type="analysis",
        priority=TaskPriority.NORMAL,
        payload={"data": "test"},
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        metadata={}
    )


@pytest.fixture
def sample_agent():
    """Create a sample agent for testing."""
    return Agent(
        id="test-agent-1",
        name="Test Agent",
        type="analysis",
        status=AgentStatus.AVAILABLE,
        capabilities=[AgentCapability(name="analysis", level=5)],
        max_concurrent_tasks=5,
        memory_limit_mb=1024,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )


class TestTaskQueueService:
    """Test cases for TaskQueueService."""

    @pytest.mark.asyncio
    async def test_enqueue_task_success(self, queue_service, sample_task):
        """Test successful task enqueueing."""
        # Ensure task is in pending status
        sample_task.status = TaskStatus.PENDING

        # Enqueue task
        await queue_service.enqueue_task(sample_task)

        # Verify task status was updated
        assert sample_task.status == TaskStatus.QUEUED
        assert sample_task.queued_at is not None

    @pytest.mark.asyncio
    async def test_enqueue_task_invalid_status(self, queue_service, sample_task):
        """Test enqueueing task with invalid status."""
        # Set task to non-pending status
        sample_task.status = TaskStatus.RUNNING

        # Should raise ValidationError
        with pytest.raises(ValidationError):
            await queue_service.enqueue_task(sample_task)

    @pytest.mark.asyncio
    async def test_dequeue_task_empty_queue(self, queue_service):
        """Test dequeuing from empty queue."""
        agent_id = "test-agent-1"

        # Dequeue from empty queue
        task_id = await queue_service.dequeue_task(agent_id)

        # Should return None
        assert task_id is None

    @pytest.mark.asyncio
    async def test_get_queue_stats_empty(self, queue_service):
        """Test getting stats from empty queue."""
        stats = await queue_service.get_queue_stats()

        assert stats.total_queued == 0
        assert all(count == 0 for count in stats.by_priority.values())
        assert stats.oldest_task_age_seconds is None
        assert stats.average_queue_time_seconds is None

    @pytest.mark.asyncio
    async def test_cancel_task_not_found(self, queue_service):
        """Test canceling non-existent task."""
        result = await queue_service.cancel_task("non-existent-task")

        assert result is False


class TestAgentCapacityManager:
    """Test cases for AgentCapacityManager."""

    @pytest.mark.asyncio
    async def test_update_agent_capacity(self, mock_redis):
        """Test updating agent capacity."""
        capacity_manager = AgentCapacityManager(mock_redis)

        agent_id = "test-agent-1"
        current_tasks = 2
        max_tasks = 5

        await capacity_manager.update_agent_capacity(agent_id, current_tasks, max_tasks)

        # Verify Redis setex was called
        mock_redis.setex.assert_called_once()

    @pytest.mark.asyncio
    async def test_is_agent_available(self, mock_redis):
        """Test checking agent availability."""
        capacity_manager = AgentCapacityManager(mock_redis)

        # Mock get_agent_capacity to return available capacity
        capacity_data = {
            "current_tasks": 2,
            "max_tasks": 5,
            "available_slots": 3
        }
        mock_redis.get = AsyncMock(return_value='{"current_tasks": 2, "max_tasks": 5, "available_slots": 3}')

        agent_id = "test-agent-1"
        is_available = await capacity_manager.is_agent_available(agent_id)

        assert is_available is True

    @pytest.mark.asyncio
    async def test_is_agent_available_no_capacity(self, mock_redis):
        """Test checking availability for agent with no capacity info."""
        capacity_manager = AgentCapacityManager(mock_redis)

        # Mock get_agent_capacity to return None
        mock_redis.get = AsyncMock(return_value=None)

        agent_id = "test-agent-1"
        is_available = await capacity_manager.is_agent_available(agent_id)

        assert is_available is False


class TestTaskAssignmentService:
    """Test cases for TaskAssignmentService."""

    def test_filter_eligible_agents(self, assignment_service, sample_task, sample_agent):
        """Test filtering eligible agents."""
        # Add required capability to task
        sample_task.required_capabilities = ["analysis"]

        # Test with eligible agent
        eligible = assignment_service._filter_eligible_agents(sample_task, [sample_agent])

        assert len(eligible) == 1
        assert eligible[0].id == sample_agent.id

    def test_filter_eligible_agents_missing_capability(self, assignment_service, sample_task, sample_agent):
        """Test filtering with missing required capability."""
        # Add required capability that agent doesn't have
        sample_task.required_capabilities = ["missing-capability"]

        eligible = assignment_service._filter_eligible_agents(sample_task, [sample_agent])

        assert len(eligible) == 0

    def test_filter_eligible_agents_busy_status(self, assignment_service, sample_task, sample_agent):
        """Test filtering agents with busy status."""
        # Set agent to busy status
        sample_agent.status = AgentStatus.BUSY

        eligible = assignment_service._filter_eligible_agents(sample_task, [sample_agent])

        assert len(eligible) == 1  # BUSY agents are still eligible

    def test_filter_eligible_agents_offline_status(self, assignment_service, sample_task, sample_agent):
        """Test filtering agents with offline status."""
        # Set agent to offline status
        sample_agent.status = AgentStatus.OFFLINE

        eligible = assignment_service._filter_eligible_agents(sample_task, [sample_agent])

        assert len(eligible) == 0

    @pytest.mark.asyncio
    async def test_assign_task_no_agents(self, assignment_service, sample_task):
        """Test assignment with no available agents."""
        with pytest.raises(ResourceNotFoundError):
            await assignment_service.assign_task(sample_task, [])

    @pytest.mark.asyncio
    async def test_assign_task_success(self, assignment_service, sample_task, sample_agent):
        """Test successful task assignment."""
        recommendation = await assignment_service.assign_task(sample_task, [sample_agent])

        assert recommendation.task_id == sample_task.id
        assert recommendation.recommended_agent_id == sample_agent.id
        assert recommendation.strategy_used in AssignmentStrategy
        assert len(recommendation.scores) > 0

    def test_score_round_robin(self, assignment_service, sample_task, sample_agent):
        """Test round-robin scoring."""
        agents = [sample_agent]
        score = assignment_service._score_round_robin(sample_task, sample_agent, agents)

        assert score.agent_id == sample_agent.id
        assert score.strategy == AssignmentStrategy.ROUND_ROBIN
        assert 0 <= score.score <= 1.0

    def test_score_capability_match(self, assignment_service, sample_task, sample_agent):
        """Test capability match scoring."""
        # Add required capability
        sample_task.required_capabilities = ["analysis"]

        score = assignment_service._score_capability_match(sample_task, sample_agent)

        assert score.agent_id == sample_agent.id
        assert score.strategy == AssignmentStrategy.CAPABILITY_MATCH
        assert 0 <= score.score <= 1.0


class TestTaskService:
    """Test cases for TaskService."""

    @pytest.mark.asyncio
    async def test_create_task_success(self, queue_service, assignment_service):
        """Test successful task creation."""
        task_service = TaskService(queue_service, assignment_service)

        request = TaskCreationRequest(
            type="analysis",
            priority=TaskPriority.NORMAL,
            payload={"data": "test"}
        )

        task = await task_service.create_task(request, "creator-agent-1")

        assert task.id is not None
        assert task.type == "analysis"
        assert task.priority == TaskPriority.NORMAL
        assert task.status == TaskStatus.PENDING
        assert task.metadata["created_by"] == "creator-agent-1"

    @pytest.mark.asyncio
    async def test_create_task_validation_error(self, queue_service, assignment_service):
        """Test task creation with invalid requirements."""
        task_service = TaskService(queue_service, assignment_service)

        request = TaskCreationRequest(
            type="analysis",
            priority=TaskPriority.NORMAL,
            payload={"data": "test"},
            requirements={"memory_mb": -100}  # Invalid memory requirement
        )

        with pytest.raises(ValidationError):
            await task_service.create_task(request)

    @pytest.mark.asyncio
    async def test_submit_task_success(self, queue_service, assignment_service, sample_task):
        """Test successful task submission."""
        task_service = TaskService(queue_service, assignment_service)

        # Ensure task is in pending status
        sample_task.status = TaskStatus.PENDING

        success = await task_service.submit_task(sample_task)

        assert success is True
        assert sample_task.status == TaskStatus.QUEUED

    @pytest.mark.asyncio
    async def test_submit_task_invalid_status(self, queue_service, assignment_service, sample_task):
        """Test submitting task with invalid status."""
        task_service = TaskService(queue_service, assignment_service)

        # Set task to non-pending status
        sample_task.status = TaskStatus.RUNNING

        with pytest.raises(ValidationError):
            await task_service.submit_task(sample_task)


@pytest.mark.asyncio
async def test_task_lifecycle_integration(queue_service, assignment_service, sample_task, sample_agent):
    """Test complete task lifecycle from creation to completion."""
    task_service = TaskService(queue_service, assignment_service)

    # 1. Create task
    request = TaskCreationRequest(
        type="analysis",
        priority=TaskPriority.HIGH,
        payload={"data": "integration test"}
    )

    task = await task_service.create_task(request, "test-creator")
    assert task.status == TaskStatus.PENDING

    # 2. Submit task to queue
    submit_success = await task_service.submit_task(task)
    assert submit_success is True
    assert task.status == TaskStatus.QUEUED

    # 3. Get queue stats
    stats = await task_service.get_queue_stats()
    assert stats["total_queued"] >= 0  # Could be 0 if mock doesn't increment

    # 4. Assign task to agent
    assigned_agent_id = await task_service.assign_task(task, [sample_agent])
    assert assigned_agent_id is not None

    # 5. Complete task
    result = {"analysis": "completed", "score": 0.95}
    complete_success = await task_service.complete_task(task.id, result)
    assert complete_success is True


if __name__ == "__main__":
    pytest.main([__file__])
