"""
Integration Manager for WebSocket-Task Delegation System

Provides seamless integration between WebSocket real-time communication,
task delegation system, Redis queue operations, and Flask service pipeline orchestration.
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List, Callable
from dataclasses import dataclass
from enum import Enum

import structlog
from redis.asyncio import Redis
from motor.motor_asyncio import AsyncIOMotorDatabase

from mcp_server.config import MCPConfig
from mcp_server.models.task import Task, TaskStatus, TaskPriority
from mcp_server.models.agent import Agent
from mcp_server.exceptions import IntegrationError, ValidationError, ResourceNotFoundError
from .websocket_manager import WebSocketManager
from .task import TaskService
from .queue import RedisQueueService

logger = structlog.get_logger(__name__)


class IntegrationEventType(Enum):
    """Integration event types for WebSocket-task coordination."""
    TASK_CREATED = "task:created"
    TASK_ASSIGNED = "task:assigned"
    TASK_PROGRESS = "task:progress"
    TASK_COMPLETED = "task:completed"
    TASK_FAILED = "task:failed"
    TASK_CANCELLED = "task:cancelled"
    PIPELINE_STAGE_START = "pipeline:stage_start"
    PIPELINE_STAGE_COMPLETE = "pipeline:stage_complete"
    PIPELINE_PROGRESS = "pipeline:progress"
    PIPELINE_COMPLETE = "pipeline:complete"
    PIPELINE_ERROR = "pipeline:error"
    AGENT_STATUS_UPDATE = "agent:status_update"
    QUEUE_STATUS_UPDATE = "queue:status_update"


@dataclass
class IntegrationEvent:
    """Integration event data structure."""
    event_type: str
    task_id: Optional[str]
    pipeline_id: Optional[str]
    agent_id: Optional[str]
    user_id: Optional[str]
    data: Dict[str, Any]
    timestamp: datetime
    source: str
    target: Optional[str] = None


class IntegrationManager:
    """
    Central integration manager that coordinates WebSocket events with task delegation,
    Redis queue operations, and Flask service pipeline orchestration.
    """

    def __init__(self, config: MCPConfig, database: AsyncIOMotorDatabase,
                 redis_client: Redis, websocket_manager: WebSocketManager,
                 task_service: TaskService, queue_service: RedisQueueService):
        """
        Initialize integration manager.

        Args:
            config: MCP configuration
            database: MongoDB database instance
            redis_client: Redis client instance
            websocket_manager: WebSocket manager instance
            task_service: Task service instance
            queue_service: Redis queue service instance
        """
        self.config = config
        self.database = database
        self.redis_client = redis_client
        self.websocket_manager = websocket_manager
        self.task_service = task_service
        self.queue_service = queue_service
        self.logger = structlog.get_logger(__name__)

        # Integration channels
        self.task_channel = "mcp:task_events"
        self.pipeline_channel = "mcp:pipeline_events"
        self.agent_channel = "mcp:agent_events"
        self.queue_channel = "mcp:queue_events"

        # Event handlers
        self.event_handlers: Dict[str, List[Callable]] = {}
        self._initialized = False

    async def initialize(self) -> None:
        """Initialize integration manager and start event listeners."""
        try:
            self.logger.info("Initializing integration manager")

            # Register event handlers
            self._register_event_handlers()

            # Start Redis pub/sub listeners
            await self._start_redis_listeners()

            self._initialized = True
            self.logger.info("Integration manager initialized successfully")

        except Exception as e:
            self.logger.error("Failed to initialize integration manager", error=str(e))
            raise IntegrationError(f"Integration manager initialization failed: {str(e)}")

    def _register_event_handlers(self) -> None:
        """Register event handlers for integration events."""
        # Task event handlers
        self.event_handlers[IntegrationEventType.TASK_CREATED.value] = [
            self._handle_task_created
        ]
        self.event_handlers[IntegrationEventType.TASK_ASSIGNED.value] = [
            self._handle_task_assigned
        ]
        self.event_handlers[IntegrationEventType.TASK_PROGRESS.value] = [
            self._handle_task_progress
        ]
        self.event_handlers[IntegrationEventType.TASK_COMPLETED.value] = [
            self._handle_task_completed
        ]
        self.event_handlers[IntegrationEventType.TASK_FAILED.value] = [
            self._handle_task_failed
        ]

        # Pipeline event handlers
        self.event_handlers[IntegrationEventType.PIPELINE_STAGE_START.value] = [
            self._handle_pipeline_stage_start
        ]
        self.event_handlers[IntegrationEventType.PIPELINE_STAGE_COMPLETE.value] = [
            self._handle_pipeline_stage_complete
        ]
        self.event_handlers[IntegrationEventType.PIPELINE_PROGRESS.value] = [
            self._handle_pipeline_progress
        ]
        self.event_handlers[IntegrationEventType.PIPELINE_COMPLETE.value] = [
            self._handle_pipeline_complete
        ]

        # Agent event handlers
        self.event_handlers[IntegrationEventType.AGENT_STATUS_UPDATE.value] = [
            self._handle_agent_status_update
        ]

        # Queue event handlers
        self.event_handlers[IntegrationEventType.QUEUE_STATUS_UPDATE.value] = [
            self._handle_queue_status_update
        ]

        self.logger.debug("Event handlers registered")

    async def _start_redis_listeners(self) -> None:
        """Start Redis pub/sub listeners for integration events."""
        try:
            # Create pub/sub clients
            self.pubsub_client = self.redis_client.pubsub()

            # Subscribe to channels
            await self.pubsub_client.subscribe(
                self.task_channel,
                self.pipeline_channel,
                self.agent_channel,
                self.queue_channel
            )

            # Start listener task
            asyncio.create_task(self._redis_message_listener())

            self.logger.info("Redis pub/sub listeners started")

        except Exception as e:
            self.logger.error("Failed to start Redis listeners", error=str(e))
            raise IntegrationError(f"Redis listener setup failed: {str(e)}")

    async def _redis_message_listener(self) -> None:
        """Listen for Redis pub/sub messages and process them."""
        try:
            async for message in self.pubsub_client.listen():
                if message['type'] == 'message':
                    channel = message['channel'].decode('utf-8')
                    data = json.loads(message['data'].decode('utf-8'))

                    await self._process_redis_message(channel, data)

        except Exception as e:
            self.logger.error("Error in Redis message listener", error=str(e))

    async def _process_redis_message(self, channel: str, data: Dict[str, Any]) -> None:
        """Process incoming Redis message."""
        try:
            event_type = data.get('event_type')
            if not event_type:
                return

            # Create integration event
            event = IntegrationEvent(
                event_type=event_type,
                task_id=data.get('task_id'),
                pipeline_id=data.get('pipeline_id'),
                agent_id=data.get('agent_id'),
                user_id=data.get('user_id'),
                data=data.get('data', {}),
                timestamp=datetime.fromisoformat(data.get('timestamp', datetime.utcnow().isoformat())),
                source=data.get('source', 'redis'),
                target=data.get('target')
            )

            # Handle event
            await self._handle_integration_event(event)

        except Exception as e:
            self.logger.error("Error processing Redis message", channel=channel, error=str(e))

    async def _handle_integration_event(self, event: IntegrationEvent) -> None:
        """Handle integration event."""
        try:
            handlers = self.event_handlers.get(event.event_type, [])

            for handler in handlers:
                try:
                    await handler(event)
                except Exception as e:
                    self.logger.error(
                        "Error in event handler",
                        event_type=event.event_type,
                        handler=handler.__name__,
                        error=str(e)
                    )

        except Exception as e:
            self.logger.error("Error handling integration event", event_type=event.event_type, error=str(e))

    # Task Event Handlers
    async def _handle_task_created(self, event: IntegrationEvent) -> None:
        """Handle task created event."""
        try:
            task_id = event.task_id
            if not task_id:
                return

            # Broadcast to WebSocket clients
            await self.websocket_manager.publish_event(
                'task:created',
                {
                    'task_id': task_id,
                    'task_type': event.data.get('task_type'),
                    'status': 'created',
                    'created_at': event.timestamp.isoformat(),
                    'metadata': event.data.get('metadata', {})
                },
                room=f"task:{task_id}"
            )

            self.logger.info(
                "Task created event processed",
                task_id=task_id,
                task_type=event.data.get('task_type')
            )

        except Exception as e:
            self.logger.error("Error handling task created event", task_id=event.task_id, error=str(e))

    async def _handle_task_assigned(self, event: IntegrationEvent) -> None:
        """Handle task assigned event."""
        try:
            task_id = event.task_id
            agent_id = event.agent_id

            if not task_id or not agent_id:
                return

            # Broadcast to WebSocket clients
            await self.websocket_manager.publish_event(
                'task:assigned',
                {
                    'task_id': task_id,
                    'agent_id': agent_id,
                    'assigned_at': event.timestamp.isoformat(),
                    'metadata': event.data.get('metadata', {})
                },
                room=f"task:{task_id}"
            )

            # Also notify the agent
            await self.websocket_manager.publish_event(
                'task:assigned_to_you',
                {
                    'task_id': task_id,
                    'task_details': event.data.get('task_details', {})
                },
                room=f"agent:{agent_id}"
            )

            self.logger.info(
                "Task assigned event processed",
                task_id=task_id,
                agent_id=agent_id
            )

        except Exception as e:
            self.logger.error("Error handling task assigned event", task_id=event.task_id, error=str(e))

    async def _handle_task_progress(self, event: IntegrationEvent) -> None:
        """Handle task progress event."""
        try:
            task_id = event.task_id
            if not task_id:
                return

            progress_data = {
                'task_id': task_id,
                'progress': event.data.get('progress', 0),
                'status': event.data.get('status'),
                'message': event.data.get('message', ''),
                'metadata': event.data.get('metadata', {}),
                'updated_at': event.timestamp.isoformat()
            }

            # Broadcast to task subscribers
            await self.websocket_manager.publish_event(
                'task:progress',
                progress_data,
                room=f"task:{task_id}"
            )

            self.logger.debug(
                "Task progress event processed",
                task_id=task_id,
                progress=event.data.get('progress', 0)
            )

        except Exception as e:
            self.logger.error("Error handling task progress event", task_id=event.task_id, error=str(e))

    async def _handle_task_completed(self, event: IntegrationEvent) -> None:
        """Handle task completed event."""
        try:
            task_id = event.task_id
            if not task_id:
                return

            # Broadcast completion to WebSocket clients
            await self.websocket_manager.publish_event(
                'task:completed',
                {
                    'task_id': task_id,
                    'result': event.data.get('result', {}),
                    'completed_at': event.timestamp.isoformat(),
                    'duration_seconds': event.data.get('duration_seconds', 0)
                },
                room=f"task:{task_id}"
            )

            self.logger.info(
                "Task completed event processed",
                task_id=task_id,
                duration_seconds=event.data.get('duration_seconds', 0)
            )

        except Exception as e:
            self.logger.error("Error handling task completed event", task_id=event.task_id, error=str(e))

    async def _handle_task_failed(self, event: IntegrationEvent) -> None:
        """Handle task failed event."""
        try:
            task_id = event.task_id
            if not task_id:
                return

            # Broadcast failure to WebSocket clients
            await self.websocket_manager.publish_event(
                'task:failed',
                {
                    'task_id': task_id,
                    'error': event.data.get('error', 'Unknown error'),
                    'error_type': event.data.get('error_type'),
                    'failed_at': event.timestamp.isoformat()
                },
                room=f"task:{task_id}"
            )

            self.logger.warning(
                "Task failed event processed",
                task_id=task_id,
                error_type=event.data.get('error_type')
            )

        except Exception as e:
            self.logger.error("Error handling task failed event", task_id=event.task_id, error=str(e))

    # Pipeline Event Handlers
    async def _handle_pipeline_stage_start(self, event: IntegrationEvent) -> None:
        """Handle pipeline stage start event."""
        try:
            pipeline_id = event.pipeline_id
            if not pipeline_id:
                return

            stage_name = event.data.get('stage_name')

            await self.websocket_manager.publish_event(
                'pipeline:stage_start',
                {
                    'pipeline_id': pipeline_id,
                    'stage_name': stage_name,
                    'stage_number': event.data.get('stage_number'),
                    'started_at': event.timestamp.isoformat()
                },
                room=f"pipeline:{pipeline_id}"
            )

            self.logger.info(
                "Pipeline stage start event processed",
                pipeline_id=pipeline_id,
                stage_name=stage_name
            )

        except Exception as e:
            self.logger.error("Error handling pipeline stage start event", pipeline_id=event.pipeline_id, error=str(e))

    async def _handle_pipeline_stage_complete(self, event: IntegrationEvent) -> None:
        """Handle pipeline stage complete event."""
        try:
            pipeline_id = event.pipeline_id
            if not pipeline_id:
                return

            stage_name = event.data.get('stage_name')

            await self.websocket_manager.publish_event(
                'pipeline:stage_complete',
                {
                    'pipeline_id': pipeline_id,
                    'stage_name': stage_name,
                    'stage_number': event.data.get('stage_number'),
                    'result': event.data.get('result', {}),
                    'completed_at': event.timestamp.isoformat()
                },
                room=f"pipeline:{pipeline_id}"
            )

            self.logger.info(
                "Pipeline stage complete event processed",
                pipeline_id=pipeline_id,
                stage_name=stage_name
            )

        except Exception as e:
            self.logger.error("Error handling pipeline stage complete event", pipeline_id=event.pipeline_id, error=str(e))

    async def _handle_pipeline_progress(self, event: IntegrationEvent) -> None:
        """Handle pipeline progress event."""
        try:
            pipeline_id = event.pipeline_id
            if not pipeline_id:
                return

            progress_data = {
                'pipeline_id': pipeline_id,
                'overall_progress': event.data.get('overall_progress', 0),
                'current_stage': event.data.get('current_stage'),
                'stage_progress': event.data.get('stage_progress', {}),
                'estimated_completion': event.data.get('estimated_completion'),
                'updated_at': event.timestamp.isoformat()
            }

            await self.websocket_manager.publish_event(
                'pipeline:progress',
                progress_data,
                room=f"pipeline:{pipeline_id}"
            )

            self.logger.debug(
                "Pipeline progress event processed",
                pipeline_id=pipeline_id,
                overall_progress=event.data.get('overall_progress', 0)
            )

        except Exception as e:
            self.logger.error("Error handling pipeline progress event", pipeline_id=event.pipeline_id, error=str(e))

    async def _handle_pipeline_complete(self, event: IntegrationEvent) -> None:
        """Handle pipeline complete event."""
        try:
            pipeline_id = event.pipeline_id
            if not pipeline_id:
                return

            await self.websocket_manager.publish_event(
                'pipeline:complete',
                {
                    'pipeline_id': pipeline_id,
                    'status': 'completed',
                    'results': event.data.get('results', {}),
                    'overall_quality_score': event.data.get('overall_quality_score'),
                    'total_duration_seconds': event.data.get('total_duration_seconds'),
                    'completed_at': event.timestamp.isoformat()
                },
                room=f"pipeline:{pipeline_id}"
            )

            self.logger.info(
                "Pipeline complete event processed",
                pipeline_id=pipeline_id,
                total_duration_seconds=event.data.get('total_duration_seconds')
            )

        except Exception as e:
            self.logger.error("Error handling pipeline complete event", pipeline_id=event.pipeline_id, error=str(e))

    # Agent Event Handlers
    async def _handle_agent_status_update(self, event: IntegrationEvent) -> None:
        """Handle agent status update event."""
        try:
            agent_id = event.agent_id
            if not agent_id:
                return

            await self.websocket_manager.publish_event(
                'agent:status_updated',
                {
                    'agent_id': agent_id,
                    'status': event.data.get('status'),
                    'capabilities': event.data.get('capabilities', []),
                    'current_tasks': event.data.get('current_tasks', 0),
                    'max_tasks': event.data.get('max_tasks', 0),
                    'updated_at': event.timestamp.isoformat()
                },
                room=f"agent:{agent_id}"
            )

            self.logger.info(
                "Agent status update event processed",
                agent_id=agent_id,
                status=event.data.get('status')
            )

        except Exception as e:
            self.logger.error("Error handling agent status update event", agent_id=event.agent_id, error=str(e))

    # Queue Event Handlers
    async def _handle_queue_status_update(self, event: IntegrationEvent) -> None:
        """Handle queue status update event."""
        try:
            queue_data = event.data.get('queue_stats', {})

            await self.websocket_manager.publish_event(
                'queue:status_updated',
                {
                    'total_queued': queue_data.get('total_queued', 0),
                    'by_priority': queue_data.get('by_priority', {}),
                    'average_queue_time_seconds': queue_data.get('average_queue_time_seconds'),
                    'updated_at': event.timestamp.isoformat()
                }
            )

            self.logger.debug(
                "Queue status update event processed",
                total_queued=queue_data.get('total_queued', 0)
            )

        except Exception as e:
            self.logger.error("Error handling queue status update event", error=str(e))

    # Public API Methods
    async def create_pipeline_task(self, pipeline_config: Dict[str, Any],
                                 user_id: str) -> str:
        """
        Create a pipeline task and initiate WebSocket notifications.

        Args:
            pipeline_config: Pipeline configuration
            user_id: User ID

        Returns:
            Task ID
        """
        try:
            # Generate task ID
            task_id = f"pipeline_task_{int(datetime.utcnow().timestamp())}"

            # Create task data
            task_data = {
                'task_id': task_id,
                'task_type': 'pipeline_execution',
                'pipeline_config': pipeline_config,
                'user_id': user_id,
                'created_at': datetime.utcnow().isoformat()
            }

            # Publish task created event
            await self.publish_integration_event(
                IntegrationEventType.TASK_CREATED,
                task_id=task_id,
                user_id=user_id,
                data=task_data
            )

            self.logger.info(
                "Pipeline task created via integration",
                task_id=task_id,
                user_id=user_id
            )

            return task_id

        except Exception as e:
            self.logger.error("Error creating pipeline task", error=str(e))
            raise IntegrationError(f"Failed to create pipeline task: {str(e)}")

    async def update_task_progress(self, task_id: str, progress: float,
                                 status: str, message: str = "") -> None:
        """
        Update task progress and broadcast via WebSocket.

        Args:
            task_id: Task ID
            progress: Progress percentage (0-100)
            status: Task status
            message: Optional progress message
        """
        try:
            progress_data = {
                'progress': progress,
                'status': status,
                'message': message
            }

            await self.publish_integration_event(
                IntegrationEventType.TASK_PROGRESS,
                task_id=task_id,
                data=progress_data
            )

        except Exception as e:
            self.logger.error("Error updating task progress", task_id=task_id, error=str(e))
            raise IntegrationError(f"Failed to update task progress: {str(e)}")

    async def publish_integration_event(self, event_type: IntegrationEventType,
                                      task_id: Optional[str] = None,
                                      pipeline_id: Optional[str] = None,
                                      agent_id: Optional[str] = None,
                                      user_id: Optional[str] = None,
                                      data: Optional[Dict[str, Any]] = None) -> None:
        """
        Publish integration event to Redis and WebSocket.

        Args:
            event_type: Event type
            task_id: Optional task ID
            pipeline_id: Optional pipeline ID
            agent_id: Optional agent ID
            user_id: Optional user ID
            data: Event data
        """
        try:
            event_data = {
                'event_type': event_type.value,
                'task_id': task_id,
                'pipeline_id': pipeline_id,
                'agent_id': agent_id,
                'user_id': user_id,
                'data': data or {},
                'timestamp': datetime.utcnow().isoformat(),
                'source': 'integration_manager'
            }

            # Determine target channel
            if pipeline_id:
                channel = self.pipeline_channel
            elif task_id:
                channel = self.task_channel
            elif agent_id:
                channel = self.agent_channel
            else:
                channel = self.queue_channel

            # Publish to Redis
            await self.redis_client.publish(channel, json.dumps(event_data))

            self.logger.debug(
                "Integration event published",
                event_type=event_type.value,
                channel=channel
            )

        except Exception as e:
            self.logger.error("Error publishing integration event", event_type=event_type.value, error=str(e))
            raise IntegrationError(f"Failed to publish integration event: {str(e)}")

    async def get_integration_status(self) -> Dict[str, Any]:
        """Get integration manager status."""
        try:
            return {
                'status': 'active' if self._initialized else 'inactive',
                'websocket_connections': self.websocket_manager.get_connection_count(),
                'event_handlers_registered': len(self.event_handlers),
                'channels': {
                    'task': self.task_channel,
                    'pipeline': self.pipeline_channel,
                    'agent': self.agent_channel,
                    'queue': self.queue_channel
                },
                'timestamp': datetime.utcnow().isoformat()
            }

        except Exception as e:
            self.logger.error("Error getting integration status", error=str(e))
            return {
                'status': 'error',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }

    async def shutdown(self) -> None:
        """Shutdown integration manager."""
        try:
            self.logger.info("Shutting down integration manager")

            # Unsubscribe from Redis channels
            if hasattr(self, 'pubsub_client'):
                await self.pubsub_client.unsubscribe()
                await self.pubsub_client.close()

            self._initialized = False
            self.logger.info("Integration manager shutdown completed")

        except Exception as e:
            self.logger.error("Error during integration manager shutdown", error=str(e))
