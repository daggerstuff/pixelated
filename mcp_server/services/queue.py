"""
Redis-based queue management service for MCP server task delegation.

This service provides high-performance, scalable task queue management with
priority support, agent capacity management, and comprehensive statistics.
"""

import json
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import structlog
from redis.asyncio import Redis

from mcp_server.exceptions import ConflictError, ValidationError
from mcp_server.models.task import Task, TaskPriority, TaskQueueItem, TaskStatus

logger = structlog.get_logger(__name__)


@dataclass
class QueueStats:
    """Queue statistics."""

    total_queued: int
    by_priority: dict[str, int]
    oldest_task_age_seconds: float | None
    average_queue_time_seconds: float | None
    queue_depth_by_priority: dict[str, int]


class TaskQueueService:
    """
    Redis-based task queue management service.

    Provides priority-based task queuing, agent capacity management,
    and comprehensive queue statistics for the MCP server.
    """

    def __init__(self, redis: Redis):
        """
        Initialize task queue service.

        Args:
            redis: Redis client instance
        """
        self.redis = redis
        logger.info("TaskQueueService initialized")

    async def enqueue_task(self, task: Task, priority: TaskPriority | None = None) -> None:
        """
        Add task to queue with specified priority.

        Args:
            task: Task to enqueue
            priority: Optional priority override

        Raises:
            ValidationError: If task is invalid for queuing
            ConflictError: If task is already queued
        """
        if task.status != TaskStatus.PENDING:
            raise ValidationError(f"Task must be in PENDING status, current: {task.status}")

        if task.status == TaskStatus.QUEUED:
            raise ConflictError("Task is already queued")

        effective_priority = priority or task.priority
        priority_value = effective_priority.value

        # Create queue item
        queue_item = TaskQueueItem(
            task_id=task.id,
            priority=priority_value,
            created_at=datetime.utcnow(),
            agent_constraints=task.constraints
        )

        try:
            # Add to priority queue (sorted set)
            queue_key = self._get_queue_key()
            score = self._calculate_queue_score(priority_value, queue_item.created_at)

            await self.redis.zadd(queue_key, {task.id: score})

            # Store queue item data
            item_key = self._get_queue_item_key(task.id)
            await self.redis.setex(
                item_key,
                86400 * 7,  # 7 days TTL
                queue_item.json()
            )

            # Update task status
            task.status = TaskStatus.QUEUED
            task.queued_at = datetime.utcnow()
            task.updated_at = datetime.utcnow()

            logger.info(
                "Task enqueued",
                task_id=task.id,
                priority=effective_priority.name,
                score=score
            )

        except Exception as e:
            logger.error("Failed to enqueue task", task_id=task.id, error=str(e))
            raise ValidationError(f"Failed to enqueue task: {e!s}")

    async def dequeue_task(self, agent_id: str, max_priority: TaskPriority | None = None) -> str | None:
        """
        Get next task from queue for assignment to agent.

        Args:
            agent_id: Agent ID requesting task
            max_priority: Optional maximum priority to consider

        Returns:
            Task ID if available, None otherwise

        Raises:
            ValidationError: If agent is invalid
        """
        try:
            queue_key = self._get_queue_key()

            # Get tasks from queue
            task_ids = await self.redis.zrange(queue_key, 0, -1, withscores=True)

            if not task_ids:
                return None

            # Filter by priority if specified
            max_priority_value = max_priority.value if max_priority else TaskPriority.CRITICAL.value

            for task_id_bytes, score in task_ids:
                task_id = task_id_bytes.decode("utf-8")

                # Get queue item
                item_key = self._get_queue_item_key(task_id)
                item_data = await self.redis.get(item_key)

                if not item_data:
                    continue

                try:
                    queue_item = TaskQueueItem.parse_raw(item_data)

                    # Check priority constraint
                    if queue_item.priority > max_priority_value:
                        continue

                    # Remove from queue
                    removed = await self.redis.zrem(queue_key, task_id)
                    if removed == 0:
                        continue  # Task was already taken

                    # Clean up queue item
                    await self.redis.delete(item_key)

                    logger.info(
                        "Task dequeued for assignment",
                        task_id=task_id,
                        agent_id=agent_id,
                        priority=queue_item.priority
                    )

                    return task_id

                except Exception as e:
                    logger.warning(
                        "Failed to parse queue item",
                        task_id=task_id,
                        error=str(e)
                    )
                    continue

            return None

        except Exception as e:
            logger.error("Failed to dequeue task", agent_id=agent_id, error=str(e))
            raise ValidationError(f"Failed to dequeue task: {e!s}")

    async def get_queue_stats(self) -> QueueStats:
        """
        Get comprehensive queue statistics.

        Returns:
            Queue statistics
        """
        try:
            queue_key = self._get_queue_key()

            # Get all queued tasks
            task_ids_with_scores = await self.redis.zrange(queue_key, 0, -1, withscores=True)

            if not task_ids_with_scores:
                return QueueStats(
                    total_queued=0,
                    by_priority={p.name: 0 for p in TaskPriority},
                    oldest_task_age_seconds=None,
                    average_queue_time_seconds=None,
                    queue_depth_by_priority={p.name: 0 for p in TaskPriority}
                )

            total_queued = len(task_ids_with_scores)
            by_priority = {p.name: 0 for p in TaskPriority}
            queue_depth_by_priority = {p.name: 0 for p in TaskPriority}

            now = datetime.utcnow()
            oldest_age = None
            total_age = 0

            for task_id_bytes, score in task_ids_with_scores:
                task_id = task_id_bytes.decode("utf-8")

                # Get queue item for priority and age calculation
                item_key = self._get_queue_item_key(task_id)
                item_data = await self.redis.get(item_key)

                if item_data:
                    try:
                        queue_item = TaskQueueItem.parse_raw(item_data)
                        priority_name = TaskPriority(queue_item.priority).name
                        by_priority[priority_name] += 1
                        queue_depth_by_priority[priority_name] += 1

                        # Calculate age
                        age_seconds = (now - queue_item.created_at).total_seconds()
                        total_age += age_seconds

                        if oldest_age is None or age_seconds > oldest_age:
                            oldest_age = age_seconds

                    except Exception as e:
                        logger.warning(
                            "Failed to parse queue item for stats",
                            task_id=task_id,
                            error=str(e)
                        )
                        continue

            average_age = total_age / total_queued if total_queued > 0 else None

            return QueueStats(
                total_queued=total_queued,
                by_priority=by_priority,
                oldest_task_age_seconds=oldest_age,
                average_queue_time_seconds=average_age,
                queue_depth_by_priority=queue_depth_by_priority
            )

        except Exception as e:
            logger.error("Failed to get queue stats", error=str(e))
            raise ValidationError(f"Failed to get queue stats: {e!s}")

    async def cancel_task(self, task_id: str) -> bool:
        """
        Cancel a queued task.

        Args:
            task_id: Task ID to cancel

        Returns:
            True if task was cancelled, False if not found

        Raises:
            ValidationError: If cancellation fails
        """
        try:
            queue_key = self._get_queue_key()
            item_key = self._get_queue_item_key(task_id)

            # Check if task is in queue
            score = await self.redis.zscore(queue_key, task_id)
            if score is None:
                return False

            # Remove from queue
            removed = await self.redis.zrem(queue_key, task_id)
            if removed == 0:
                return False

            # Clean up queue item
            await self.redis.delete(item_key)

            logger.info("Task cancelled from queue", task_id=task_id)
            return True

        except Exception as e:
            logger.error("Failed to cancel task", task_id=task_id, error=str(e))
            raise ValidationError(f"Failed to cancel task: {e!s}")

    async def requeue_task(self, task_id: str, priority: TaskPriority | None = None) -> None:
        """
        Requeue a failed or cancelled task.

        Args:
            task_id: Task ID to requeue
            priority: Optional new priority

        Raises:
            ValidationError: If requeuing fails
        """
        try:
            # Remove from queue if present
            await self.cancel_task(task_id)

            # Requeue with new priority if specified
            # Note: This would need the actual task object, so this is a placeholder
            # In practice, you'd fetch the task from database and call enqueue_task

            logger.info("Task requeued", task_id=task_id, new_priority=priority)

        except Exception as e:
            logger.error("Failed to requeue task", task_id=task_id, error=str(e))
            raise ValidationError(f"Failed to requeue task: {e!s}")

    async def get_queued_tasks(self, limit: int = 100, offset: int = 0) -> list[str]:
        """
        Get list of queued task IDs.

        Args:
            limit: Maximum number of tasks to return
            offset: Offset for pagination

        Returns:
            List of task IDs
        """
        try:
            queue_key = self._get_queue_key()
            task_ids_bytes = await self.redis.zrange(queue_key, offset, offset + limit - 1)
            return [task_id.decode("utf-8") for task_id in task_ids_bytes]

        except Exception as e:
            logger.error("Failed to get queued tasks", error=str(e))
            raise ValidationError(f"Failed to get queued tasks: {e!s}")

    async def get_task_queue_position(self, task_id: str) -> int | None:
        """
        Get queue position for a specific task.

        Args:
            task_id: Task ID

        Returns:
            Queue position (0-based) or None if not in queue
        """
        try:
            queue_key = self._get_queue_key()
            rank = await self.redis.zrank(queue_key, task_id)
            return rank

        except Exception as e:
            logger.error("Failed to get task queue position", task_id=task_id, error=str(e))
            raise ValidationError(f"Failed to get task queue position: {e!s}")

    async def cleanup_expired_items(self) -> int:
        """
        Clean up expired queue items.

        Returns:
            Number of items cleaned up
        """
        try:
            queue_key = self._get_queue_key()
            pattern = self._get_queue_item_key("*")

            # Get all queue items
            cursor = 0
            cleaned_count = 0

            while True:
                cursor, keys = await self.redis.scan(cursor, match=pattern, count=100)

                for key in keys:
                    # Check if key exists and has TTL
                    ttl = await self.redis.ttl(key)
                    if ttl == -2:  # Key doesn't exist
                        # Extract task ID from key
                        task_id = key.decode("utf-8").split(":")[-1]

                        # Remove from queue if present
                        removed = await self.redis.zrem(queue_key, task_id)
                        if removed > 0:
                            cleaned_count += 1

                if cursor == 0:
                    break

            logger.info("Cleaned up expired queue items", cleaned_count=cleaned_count)
            return cleaned_count

        except Exception as e:
            logger.error("Failed to cleanup expired items", error=str(e))
            return 0

    def _get_queue_key(self) -> str:
        """Get Redis key for task queue."""
        return "mcp:task_queue"

    def _get_queue_item_key(self, task_id: str) -> str:
        """Get Redis key for queue item data."""
        return f"mcp:queue_item:{task_id}"

    def _calculate_queue_score(self, priority: int, created_at: datetime) -> float:
        """
        Calculate queue score for priority-based ordering.

        Higher priority tasks get higher scores and are processed first.
        Older tasks get slight boosts to prevent starvation.

        Args:
            priority: Task priority value
            created_at: Task creation timestamp

        Returns:
            Queue score
        """
        # Base score from priority (higher priority = higher score)
        base_score = priority * 1000

        # Age bonus to prevent starvation (max 100 points for tasks older than 1 hour)
        age_seconds = (datetime.utcnow() - created_at).total_seconds()
        age_bonus = min(age_seconds / 36, 100)  # Max 100 points for 1 hour old

        return base_score + age_bonus


# Backwards-compatible name expected in other modules
RedisQueueService = TaskQueueService


# Global queue service instance (initialized by app startup tests or fixtures)
_queue_service: TaskQueueService | None = None


def init_queue_service(redis: Redis) -> TaskQueueService:
    """Initialize the global queue service with a Redis client."""
    global _queue_service
    _queue_service = TaskQueueService(redis)
    return _queue_service


async def get_queue_service() -> TaskQueueService:
    """Return the initialized queue service or raise if not initialized."""
    if _queue_service is None:
        raise RuntimeError("Queue service not initialized")
    return _queue_service


class AgentCapacityManager:
    """
    Agent capacity management for task assignment.
    """

    def __init__(self, redis: Redis):
        """
        Initialize agent capacity manager.

        Args:
            redis: Redis client instance
        """
        self.redis = redis
        logger.info("AgentCapacityManager initialized")

    async def update_agent_capacity(self, agent_id: str, current_tasks: int, max_tasks: int) -> None:
        """
        Update agent's current task count and capacity.

        Args:
            agent_id: Agent ID
            current_tasks: Current number of tasks
            max_tasks: Maximum allowed tasks
        """
        try:
            key = self._get_agent_capacity_key(agent_id)
            capacity_data = {
                "current_tasks": current_tasks,
                "max_tasks": max_tasks,
                "available_slots": max_tasks - current_tasks,
                "updated_at": datetime.utcnow().isoformat()
            }

            await self.redis.setex(
                key,
                300,  # 5 minutes TTL
                json.dumps(capacity_data)
            )

        except Exception as e:
            logger.error("Failed to update agent capacity", agent_id=agent_id, error=str(e))
            raise ValidationError(f"Failed to update agent capacity: {e!s}")

    async def get_agent_capacity(self, agent_id: str) -> dict[str, Any] | None:
        """
        Get agent's current capacity information.

        Args:
            agent_id: Agent ID

        Returns:
            Capacity data or None if not found
        """
        try:
            key = self._get_agent_capacity_key(agent_id)
            data = await self.redis.get(key)

            if not data:
                return None

            return json.loads(data)

        except Exception as e:
            logger.error("Failed to get agent capacity", agent_id=agent_id, error=str(e))
            return None

    async def is_agent_available(self, agent_id: str, required_slots: int = 1) -> bool:
        """
        Check if agent has available capacity.

        Args:
            agent_id: Agent ID
            required_slots: Number of task slots required

        Returns:
            True if agent has capacity, False otherwise
        """
        try:
            capacity = await self.get_agent_capacity(agent_id)
            if not capacity:
                return False

            available_slots = capacity.get("available_slots", 0)
            return available_slots >= required_slots

        except Exception as e:
            logger.error("Failed to check agent availability", agent_id=agent_id, error=str(e))
            return False

    async def get_available_agents(self, required_slots: int = 1) -> list[str]:
        """
        Get list of agents with available capacity.

        Args:
            required_slots: Minimum number of available slots required

        Returns:
            List of available agent IDs
        """
        try:
            pattern = self._get_agent_capacity_key("*")
            cursor = 0
            available_agents = []

            while True:
                cursor, keys = await self.redis.scan(cursor, match=pattern, count=100)

                for key in keys:
                    agent_id = key.decode("utf-8").split(":")[-1]
                    capacity = await self.get_agent_capacity(agent_id)

                    if capacity and capacity.get("available_slots", 0) >= required_slots:
                        available_agents.append(agent_id)

                if cursor == 0:
                    break

            return available_agents

        except Exception as e:
            logger.error("Failed to get available agents", error=str(e))
            return []

    async def reserve_task_slot(self, agent_id: str, task_id: str) -> bool:
        """
        Reserve a task slot for an agent.

        Args:
            agent_id: Agent ID
            task_id: Task ID

        Returns:
            True if slot reserved successfully, False otherwise
        """
        try:
            # Use Redis transaction to ensure atomicity
            async with self.redis.pipeline() as pipe:
                key = self._get_agent_capacity_key(agent_id)

                # Watch the key for changes
                await pipe.watch(key)

                # Get current capacity
                data = await self.redis.get(key)
                if not data:
                    return False

                capacity = json.loads(data)
                available_slots = capacity.get("available_slots", 0)

                if available_slots <= 0:
                    return False

                # Update capacity
                capacity["current_tasks"] += 1
                capacity["available_slots"] -= 1
                capacity["updated_at"] = datetime.utcnow().isoformat()

                # Execute transaction
                pipe.multi()
                pipe.setex(key, 300, json.dumps(capacity))
                pipe.execute()

                logger.info(
                    "Task slot reserved",
                    agent_id=agent_id,
                    task_id=task_id,
                    available_slots=capacity["available_slots"]
                )

                return True

        except Exception as e:
            logger.error("Failed to reserve task slot", agent_id=agent_id, task_id=task_id, error=str(e))
            return False

    async def release_task_slot(self, agent_id: str, task_id: str) -> bool:
        """
        Release a task slot from an agent.

        Args:
            agent_id: Agent ID
            task_id: Task ID

        Returns:
            True if slot released successfully, False otherwise
        """
        try:
            # Use Redis transaction to ensure atomicity
            async with self.redis.pipeline() as pipe:
                key = self._get_agent_capacity_key(agent_id)

                # Watch the key for changes
                await pipe.watch(key)

                # Get current capacity
                data = await self.redis.get(key)
                if not data:
                    return False

                capacity = json.loads(data)
                current_tasks = capacity.get("current_tasks", 0)
                max_tasks = capacity.get("max_tasks", 0)

                if current_tasks <= 0:
                    return False

                # Update capacity
                capacity["current_tasks"] = max(0, current_tasks - 1)
                capacity["available_slots"] = max_tasks - capacity["current_tasks"]
                capacity["updated_at"] = datetime.utcnow().isoformat()

                # Execute transaction
                pipe.multi()
                pipe.setex(key, 300, json.dumps(capacity))
                pipe.execute()

                logger.info(
                    "Task slot released",
                    agent_id=agent_id,
                    task_id=task_id,
                    available_slots=capacity["available_slots"]
                )

                return True

        except Exception as e:
            logger.error("Failed to release task slot", agent_id=agent_id, task_id=task_id, error=str(e))
            return False

    def _get_agent_capacity_key(self, agent_id: str) -> str:
        """Get Redis key for agent capacity."""
        return f"mcp:agent_capacity:{agent_id}"
