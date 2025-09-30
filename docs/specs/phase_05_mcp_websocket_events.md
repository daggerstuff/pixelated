# Phase 05: MCP Server WebSocket Event Handling

## Overview

This document provides modular pseudocode for WebSocket event handling, real-time communication patterns, and event-driven architecture for the MCP server, including agent communication, task delegation events, and system notifications with comprehensive TDD anchors.

## WebSocket Server Architecture

### 1. WebSocket Connection Manager

```python
# mcp_server/websocket/connection_manager.py
"""
WebSocket Connection Manager
Handles connection lifecycle, authentication, and room management
"""

// TEST: Create connection manager with event support
// INPUT: Configuration and event publisher
// EXPECTED: Initialized connection manager
class WebSocketConnectionManager:
    """
    Manages WebSocket connections for real-time communication
    
    Handles connection authentication, room management, and event routing
    """
    
    def __init__(self, config: WebSocketConfig, event_publisher: EventPublisher):
        self.config = config
        self.event_publisher = event_publisher
        self.active_connections: Dict[str, WebSocketConnection] = {}
        self.agent_connections: Dict[str, str] = {}  // agent_id -> connection_id
        self.connection_rooms: Dict[str, Set[str]] = {}  // connection_id -> rooms
        self.heartbeat_interval = 30  // seconds
        self.connection_timeout = 120  // seconds
    
    // TEST: Accept new WebSocket connection
    // INPUT: WebSocket object and connection metadata
    // EXPECTED: Authenticated connection or rejection
    async def connect(
        self,
        websocket: WebSocket,
        client_info: Dict[str, Any]
    ) -> str:
        """
        Accept and authenticate new WebSocket connection
        
        Preconditions:
        - WebSocket must be in connecting state
        - Client info must include authentication data
        
        Postconditions:
        - Connection is authenticated and added to manager
        - Connection ID is returned
        - Heartbeat monitoring is started
        
        // TEST: Authenticate connection request
        // INPUT: Connection metadata with auth token
        // EXPECTED: Validated agent context or auth error
        """
        
        // TEST: Accept WebSocket connection
        try:
            await websocket.accept()
        except Exception as e:
            logger.error(f"Failed to accept WebSocket connection: {e}")
            raise ConnectionError("Failed to establish WebSocket connection")
        
        // TEST: Authenticate connection
        try:
            auth_result = await self._authenticate_connection(client_info)
            if not auth_result.success:
                // TEST: Send authentication error and close
                await self._send_auth_error(websocket, auth_result.error)
                await websocket.close(code=1008, reason="Authentication failed")
                raise AuthenticationError(auth_result.error)
            
            agent_context = auth_result.agent_context
            
        except AuthenticationError:
            await websocket.close(code=1008, reason="Authentication failed")
            raise
        except Exception as e:
            logger.error(f"Authentication error: {e}")
            await websocket.close(code=1011, reason="Internal server error")
            raise
        
        // TEST: Generate unique connection ID
        connection_id = generate_uuid()
        
        // TEST: Create connection object
        connection = WebSocketConnection(
            connection_id=connection_id,
            websocket=websocket,
            agent_id=agent_context.agent_id,
            agent_type=agent_context.agent_type,
            capabilities=agent_context.capabilities,
            connected_at=datetime.utcnow(),
            last_heartbeat=datetime.utcnow(),
            permissions=agent_context.permissions
        )
        
        // TEST: Register connection
        self.active_connections[connection_id] = connection
        self.agent_connections[agent_context.agent_id] = connection_id
        
        // TEST: Add to appropriate rooms
        await self._add_to_rooms(connection_id, agent_context)
        
        // TEST: Start heartbeat monitoring
        asyncio.create_task(self._monitor_connection_heartbeat(connection_id))
        
        // TEST: Send connection acknowledgment
        await self._send_connection_acknowledgment(connection, connection_id)
        
        // TEST: Publish connection event
        await self.event_publisher.publish_event(
            event_type="websocket:connected",
            payload={
                "connection_id": connection_id,
                "agent_id": agent_context.agent_id,
                "agent_type": agent_context.agent_type,
                "connected_at": connection.connected_at.isoformat()
            }
        )
        
        logger.info(f"WebSocket connection established: {connection_id}")
        return connection_id
    
    // TEST: Handle connection disconnection
    // INPUT: Connection ID and disconnect reason
    // EXPECTED: Clean disconnection with cleanup
    async def disconnect(self, connection_id: str, reason: str = "Client disconnected") -> None:
        """
        Handle connection disconnection and cleanup
        
        Preconditions:
        - Connection must exist in manager
        
        Postconditions:
        - Connection is removed from all tracking
        - WebSocket is closed if still open
        - Disconnection event is published
        """
        
        // TEST: Retrieve connection
        connection = self.active_connections.get(connection_id)
        if not connection:
            logger.warning(f"Disconnect called for unknown connection: {connection_id}")
            return
        
        // TEST: Remove from agent connections
        if connection.agent_id in self.agent_connections:
            del self.agent_connections[connection.agent_id]
        
        // TEST: Remove from all rooms
        await self._remove_from_all_rooms(connection_id)
        
        // TEST: Close WebSocket if still open
        try:
            if connection.websocket.client_state == WebSocketState.CONNECTED:
                await connection.websocket.close(code=1000, reason=reason)
        except Exception as e:
            logger.warning(f"Error closing WebSocket: {e}")
        
        // TEST: Remove from active connections
        del self.active_connections[connection_id]
        
        // TEST: Publish disconnection event
        await self.event_publisher.publish_event(
            event_type="websocket:disconnected",
            payload={
                "connection_id": connection_id,
                "agent_id": connection.agent_id,
                "reason": reason,
                "disconnected_at": datetime.utcnow().isoformat()
            }
        )
        
        logger.info(f"WebSocket connection disconnected: {connection_id}")
    
    // TEST: Send event to specific connection
    // INPUT: Connection ID and event data
    // EXPECTED: Event delivered or error
    async def send_to_connection(self, connection_id: str, event: WebSocketEvent) -> bool:
        """
        Send event to specific WebSocket connection
        
        Preconditions:
        - Connection must exist and be active
        - Event must be valid WebSocketEvent
        
        Postconditions:
        - Event is sent to connection
        - Delivery status is returned
        - Failed delivery triggers cleanup
        """
        
        // TEST: Retrieve connection
        connection = self.active_connections.get(connection_id)
        if not connection:
            logger.warning(f"Send to unknown connection: {connection_id}")
            return False
        
        // TEST: Validate connection state
        if connection.websocket.client_state != WebSocketState.CONNECTED:
            logger.warning(f"Connection {connection_id} is not connected")
            await self.disconnect(connection_id, "Connection not in connected state")
            return False
        
        // TEST: Send event
        try:
            await connection.websocket.send_text(event.json())
            
            // TEST: Update last activity timestamp
            connection.last_activity = datetime.utcnow()
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to send event to connection {connection_id}: {e}")
            await self.disconnect(connection_id, "Send error")
            return False
    
    // TEST: Broadcast event to multiple connections
    // INPUT: Event and filter criteria
    // EXPECTED: Event delivered to matching connections
    async def broadcast_event(
        self,
        event: WebSocketEvent,
        agent_types: Optional[List[str]] = None,
        capabilities: Optional[List[str]] = None,
        exclude_connection_id: Optional[str] = None
    ) -> int:
        """
        Broadcast event to multiple connections based on filters
        
        Preconditions:
        - Event must be valid
        - Filter criteria must be valid if provided
        
        Postconditions:
        - Event is sent to all matching connections
        - Returns count of successful deliveries
        - Failed deliveries are logged but don't stop broadcast
        """
        
        // TEST: Build recipient list
        recipient_connections = []
        
        for connection_id, connection in self.active_connections.items():
            // TEST: Skip excluded connection
            if connection_id == exclude_connection_id:
                continue
            
            // TEST: Filter by agent type
            if agent_types and connection.agent_type not in agent_types:
                continue
            
            // TEST: Filter by capabilities
            if capabilities:
                if not any(cap in connection.capabilities for cap in capabilities):
                    continue
            
            recipient_connections.append(connection_id)
        
        // TEST: Send to all recipients
        successful_deliveries = 0
        
        for connection_id in recipient_connections:
            if await self.send_to_connection(connection_id, event):
                successful_deliveries += 1
        
        logger.info(f"Broadcast event delivered to {successful_deliveries}/{len(recipient_connections)} connections")
        return successful_deliveries
    
    // TEST: Send task delegation event to agent
    // INPUT: Task delegation details
    // EXPECTED: Task delegated to appropriate agent
    async def delegate_task(self, task: Task, agent: Agent) -> bool:
        """
        Send task delegation event to specific agent
        
        Preconditions:
        - Task must be valid and ready for delegation
        - Agent must have active connection
        
        Postconditions:
        - Task delegation event is sent
        - Agent is notified of new task
        - Delegation is tracked for monitoring
        """
        
        // TEST: Find agent connection
        connection_id = self.agent_connections.get(agent.agent_id)
        if not connection_id:
            logger.warning(f"No active connection for agent {agent.agent_id}")
            return False
        
        // TEST: Create delegation event
        delegation_event = TaskDelegateEvent(
            event_type="task:delegate",
            task_id=task.task_id,
            task_type=task.task_type,
            parameters=task.parameters,
            deadline=task.deadline,
            priority=task.priority,
            pipeline_id=task.pipeline_id,
            stage=task.stage,
            metadata={
                "assigned_at": datetime.utcnow().isoformat(),
                "estimated_duration": task.estimated_duration
            }
        )
        
        // TEST: Send delegation event
        success = await self.send_to_connection(connection_id, delegation_event)
        
        if success:
            logger.info(f"Task {task.task_id} delegated to agent {agent.agent_id}")
            
            // TEST: Track delegation for monitoring
            await self._track_task_delegation(task.task_id, agent.agent_id)
        
        return success
    
    // TEST: Monitor connection heartbeat
    // INPUT: Connection ID
    // EXPECTED: Continuous heartbeat monitoring
    async def _monitor_connection_heartbeat(self, connection_id: str) -> None:
        """
        Monitor connection heartbeat and detect timeouts
        
        Preconditions:
        - Connection must exist
        
        Postconditions:
        - Connection is monitored for heartbeats
        - Timeout is detected and handled
        - Connection is cleaned up on timeout
        """
        
        while True:
            await asyncio.sleep(self.heartbeat_interval)
            
            // TEST: Check if connection still exists
            connection = self.active_connections.get(connection_id)
            if not connection:
                break
            
            // TEST: Check for heartbeat timeout
            time_since_heartbeat = datetime.utcnow() - connection.last_heartbeat
            
            if time_since_heartbeat > timedelta(seconds=self.connection_timeout):
                logger.warning(f"Connection {connection_id} heartbeat timeout")
                await self.disconnect(connection_id, "Heartbeat timeout")
                break
    
    // TEST: Authenticate WebSocket connection
    // INPUT: Client connection info
    // EXPECTED: Authentication result with agent context
    async def _authenticate_connection(self, client_info: Dict[str, Any]) -> AuthResult:
        """
        Authenticate WebSocket connection request
        
        Preconditions:
        - Client info must include authentication data
        - Authentication service must be available
        
        Postconditions:
        - Returns authentication result
        - Agent context is provided if successful
        """
        
        // TEST: Extract authentication token
        auth_token = client_info.get('auth_token') or client_info.get('token')
        if not auth_token:
            return AuthResult(success=False, error="Missing authentication token")
        
        // TEST: Validate token format
        if not auth_token.startswith('Bearer '):
            return AuthResult(success=False, error="Invalid authentication format")
        
        token = auth_token[7:]  // Remove 'Bearer ' prefix
        
        // TEST: Validate JWT token
        try:
            payload = jwt.decode(
                token,
                self.config.jwt_secret,
                algorithms=[self.config.jwt_algorithm]
            )
            
            // TEST: Extract agent information
            agent_context = AgentContext(
                agent_id=payload['sub'],
                agent_type=payload.get('agent_type'),
                capabilities=payload.get('capabilities', []),
                permissions=payload.get('permissions', [])
            )
            
            return AuthResult(success=True, agent_context=agent_context)
            
        except jwt.ExpiredSignatureError:
            return AuthResult(success=False, error="Authentication token expired")
        except jwt.InvalidTokenError as e:
            return AuthResult(success=False, error=f"Invalid authentication token: {str(e)}")
        except Exception as e:
            logger.error(f"Authentication error: {e}")
            return AuthResult(success=False, error="Authentication failed")
```

### 2. WebSocket Event Handlers

```python
# mcp_server/websocket/event_handlers.py
"""
WebSocket Event Handlers
Processes incoming WebSocket events and triggers appropriate actions
"""

// TEST: Create event handler registry
// INPUT: Service dependencies
// EXPECTED: Initialized event handler system
class WebSocketEventHandler:
    """
    Handles incoming WebSocket events from connected agents
    
    Routes events to appropriate handlers and manages responses
    """
    
    def __init__(self, task_service: TaskService, agent_service: AgentService, event_publisher: EventPublisher):
        self.task_service = task_service
        self.agent_service = agent_service
        self.event_publisher = event_publisher
        self.connection_manager = None  // Set by connection manager
        
        // TEST: Register event handlers
        self.event_handlers = {
            'agent:register': self.handle_agent_register,
            'agent:heartbeat': self.handle_agent_heartbeat,
            'agent:status_update': self.handle_agent_status_update,
            'task:result': self.handle_task_result,
            'task:progress': self.handle_task_progress,
            'task:failed': self.handle_task_failed,
            'task:accepted': self.handle_task_accepted,
            'task:rejected': self.handle_task_rejected,
            'system:health_check': self.handle_system_health_check
        }
    
    // TEST: Process incoming WebSocket event
    // INPUT: Connection ID and event data
    // EXPECTED: Event processed and response sent
    async def handle_event(self, connection_id: str, event_data: Dict[str, Any]) -> None:
        """
        Process incoming WebSocket event
        
        Preconditions:
        - Connection must be authenticated and active
        - Event data must be valid JSON
        - Event type must be recognized
        
        Postconditions:
        - Event is routed to appropriate handler
        - Response is sent if required
        - Errors are handled gracefully
        
        // TEST: Validate event structure
        // INPUT: Raw event data
        // EXPECTED: Validated event or error response
        """
        
        // TEST: Validate event structure
        if not self._validate_event_structure(event_data):
            await self._send_error_response(
                connection_id,
                "INVALID_EVENT",
                "Invalid event structure"
            )
            return
        
        event_type = event_data.get('type')
        event_payload = event_data.get('payload', {})
        
        // TEST: Check if event type is supported
        if event_type not in self.event_handlers:
            await self._send_error_response(
                connection_id,
                "UNSUPPORTED_EVENT",
                f"Event type '{event_type}' is not supported"
            )
            return
        
        // TEST: Get connection context
        connection = self.connection_manager.active_connections.get(connection_id)
        if not connection:
            logger.warning(f"Event from unknown connection: {connection_id}")
            return
        
        // TEST: Validate event permissions
        if not self._has_event_permission(connection, event_type):
            await self._send_error_response(
                connection_id,
                "INSUFFICIENT_PERMISSIONS",
                f"Agent does not have permission for event '{event_type}'"
            )
            return
        
        // TEST: Route to appropriate handler
        try:
            handler = self.event_handlers[event_type]
            await handler(connection_id, event_payload)
            
        except ValidationError as e:
            await self._send_error_response(
                connection_id,
                "VALIDATION_ERROR",
                str(e)
            )
        except BusinessLogicError as e:
            await self._send_error_response(
                connection_id,
                "BUSINESS_LOGIC_ERROR",
                str(e)
            )
        except Exception as e:
            logger.error(f"Error handling event {event_type}: {e}")
            await self._send_error_response(
                connection_id,
                "INTERNAL_ERROR",
                "An internal error occurred while processing the event"
            )
    
    // TEST: Handle agent registration event
    // INPUT: Connection ID and registration payload
    // EXPECTED: Agent registered and acknowledgment sent
    async def handle_agent_register(self, connection_id: str, payload: Dict[str, Any]) -> None:
        """
        Handle agent registration via WebSocket
        
        Preconditions:
        - Agent must not already be registered
        - Registration data must be valid
        
        Postconditions:
        - Agent is registered in system
        - Registration acknowledgment is sent
        - Agent capabilities are updated
        """
        
        // TEST: Validate registration payload
        try:
            registration_request = AgentRegistrationRequest(**payload)
        except ValidationError as e:
            raise ValidationError(f"Invalid registration data: {e}")
        
        // TEST: Get connection context
        connection = self.connection_manager.active_connections[connection_id]
        
        // TEST: Register agent through service
        try:
            registered_agent = await self.agent_service.register_agent(registration_request)
        except DuplicateAgentError as e:
            // TEST: Send registration error
            await self._send_event_response(
                connection_id,
                "agent:registration_failed",
                {"error": str(e)}
            )
            return
        
        // TEST: Send registration success
        await self._send_event_response(
            connection_id,
            "agent:registered",
            {
                "agent_id": registered_agent.agent_id,
                "status": registered_agent.status,
                "registered_at": registered_agent.registered_at.isoformat(),
                "permissions": registered_agent.permissions
            }
        )
        
        // TEST: Update connection with agent info
        connection.agent_id = registered_agent.agent_id
        connection.capabilities = registration_request.capabilities
        
        logger.info(f"Agent {registered_agent.agent_id} registered via WebSocket")
    
    // TEST: Handle task result submission
    // INPUT: Connection ID and task result payload
    // EXPECTED: Task completed and acknowledgment sent
    async def handle_task_result(self, connection_id: str, payload: Dict[str, Any]) -> None:
        """
        Handle task result submission from agent
        
        Preconditions:
        - Task must exist and be assigned to agent
        - Result must be valid for task type
        - Agent must have permission to submit results
        
        Postconditions:
        - Task is marked as completed
        - Result is stored and validated
        - Completion acknowledgment is sent
        - Next tasks are evaluated for assignment
        """
        
        // TEST: Validate result payload
        try:
            task_result = TaskResult(**payload)
        except ValidationError as e:
            raise ValidationError(f"Invalid task result: {e}")
        
        // TEST: Get connection and agent context
        connection = self.connection_manager.active_connections[connection_id]
        agent_id = connection.agent_id
        
        if not agent_id:
            raise BusinessLogicError("Agent not identified")
        
        // TEST: Complete task through service
        try:
            completed_task = await self.task_service.complete_task(
                task_result.task_id,
                task_result
            )
        except TaskNotFoundError:
            await self._send_event_response(
                connection_id,
                "task:completion_failed",
                {"error": "Task not found"}
            )
            return
        except TaskCompletionError as e:
            await self._send_event_response(
                connection_id,
                "task:completion_failed",
                {"error": str(e)}
            )
            return
        
        // TEST: Send completion acknowledgment
        await self._send_event_response(
            connection_id,
            "task:completed",
            {
                "task_id": completed_task.task_id,
                "status": completed_task.status,
                "completed_at": completed_task.completed_at.isoformat() if completed_task.completed_at else None
            }
        )
        
        // TEST: Notify pipeline of task completion
        if completed_task.pipeline_id:
            await self.event_publisher.publish_event(
                "pipeline:task_completed",
                {
                    "task_id": completed_task.task_id,
                    "pipeline_id": completed_task.pipeline_id,
                    "stage": completed_task.stage,
                    "agent_id": agent_id
                }
            )
        
        logger.info(f"Task {completed_task.task_id} completed by agent {agent_id}")
    
    // TEST: Handle task progress updates
    // INPUT: Connection ID and progress payload
    // EXPECTED: Progress updated and broadcast to subscribers
    async def handle_task_progress(self, connection_id: str, payload: Dict[str, Any]) -> None:
        """
        Handle task progress updates from agent
        
        Preconditions:
        - Task must exist and be assigned to agent
        - Progress data must be valid
        - Progress percentage must be between 0 and 100
        
        Postconditions:
        - Progress is updated and stored
        - Progress is broadcast to interested parties
        - Pipeline progress is updated if applicable
        """
        
        // TEST: Validate progress payload
        try:
            task_id = payload['task_id']
            progress = payload['progress']
            message = payload.get('message', '')
            
            if not isinstance(progress, (int, float)) or progress < 0 or progress > 100:
                raise ValidationError("Progress must be between 0 and 100")
                
        except (KeyError, ValidationError) as e:
            raise ValidationError(f"Invalid progress data: {e}")
        
        // TEST: Get connection and agent context
        connection = self.connection_manager.active_connections[connection_id]
        agent_id = connection.agent_id
        
        // TEST: Validate task assignment
        task = await self.task_service.get_task(task_id)
        if not task or task.assigned_agent_id != agent_id:
            raise BusinessLogicError("Agent not authorized to update this task")
        
        // TEST: Update task progress
        try:
            await self.task_service.update_task_progress(task_id, progress, message)
        except Exception as e:
            logger.error(f"Failed to update task progress: {e}")
            raise BusinessLogicError("Failed to update task progress")
        
        // TEST: Broadcast progress update
        progress_event = TaskProgressEvent(
            event_type="task:progress_updated",
            task_id=task_id,
            progress=progress,
            message=message,
            updated_at=datetime.utcnow().isoformat(),
            agent_id=agent_id
        )
        
        // TEST: Send to pipeline subscribers
        if task.pipeline_id:
            await self.connection_manager.broadcast_event(
                progress_event,
                pipeline_id=task.pipeline_id
            )
        
        // TEST: Send acknowledgment
        await self._send_event_response(
            connection_id,
            "task:progress_acknowledged",
            {"task_id": task_id, "progress": progress}
        )
    
    // TEST: Handle agent heartbeat
    // INPUT: Connection ID and heartbeat payload
    // EXPECTED: Heartbeat processed and acknowledgment sent
    async def handle_agent_heartbeat(self, connection_id: str, payload: Dict[str, Any]) -> None:
        """
        Handle agent heartbeat for connection health monitoring
        
        Preconditions:
        - Connection must be active
        - Heartbeat data must be valid
        
        Postconditions:
        - Agent heartbeat is processed
        - Connection health is updated
        - Heartbeat acknowledgment is sent
        """
        
        // TEST: Validate heartbeat payload
        try:
            heartbeat_data = HeartbeatData(**payload)
        except ValidationError as e:
            raise ValidationError(f"Invalid heartbeat data: {e}")
        
        // TEST: Get connection and agent context
        connection = self.connection_manager.active_connections[connection_id]
        agent_id = connection.agent_id
        
        if not agent_id:
            raise BusinessLogicError("Agent not identified")
        
        // TEST: Update connection heartbeat
        connection.last_heartbeat = datetime.utcnow()
        connection.current_tasks = heartbeat_data.current_tasks
        connection.system_metrics = heartbeat_data.system_metrics
        
        // TEST: Process agent heartbeat through service
        try:
            heartbeat_result = await self.agent_service.process_heartbeat(
                agent_id,
                heartbeat_data
            )
        except Exception as e:
            logger.error(f"Failed to process agent heartbeat: {e}")
            raise BusinessLogicError("Failed to process heartbeat")
        
        // TEST: Send heartbeat acknowledgment
        await self._send_event_response(
            connection_id,
            "agent:heartbeat_acknowledged",
            {
                "status": "acknowledged",
                "next_heartbeat": heartbeat_result.next_heartbeat.isoformat()
            }
        )
    
    // TEST: Send error response to connection
    // INPUT: Connection ID and error details
    // EXPECTED: Error event sent to connection
    async def _send_error_response(self, connection_id: str, error_code: str, error_message: str) -> None:
        """
        Send error response to WebSocket connection
        
        Preconditions:
        - Connection must exist and be active
        - Error details must be valid
        
        Postconditions:
        - Error event is sent to connection
        - Error is logged for monitoring
        """
        
        error_event = WebSocketEvent(
            event_type="error",
            payload={
                "code": error_code,
                "message": error_message,
                "timestamp": datetime.utcnow().isoformat()
            }
        )
        
        await self.connection_manager.send_to_connection(connection_id, error_event)
    
    // TEST: Send successful event response
    // INPUT: Connection ID and response data
    // EXPECTED: Success event sent to connection
    async def _send_event_response(self, connection_id: str, event_type: str, payload: Dict[str, Any]) -> None:
        """
        Send successful event response to WebSocket connection
        
        Preconditions:
        - Connection must exist and be active
        - Event type and payload must be valid
        
        Postconditions:
        - Success event is sent to connection
        - Response is logged for debugging
        """
        
        response_event = WebSocketEvent(
            event_type=event_type,
            payload=payload
        )
        
        await self.connection_manager.send_to_connection(connection_id, response_event)
```

### 3. Real-time Event System

```python
# mcp_server/websocket/event_system.py
"""
Real-time Event System
Manages event publishing, subscription, and delivery for WebSocket connections
"""

// TEST: Create event publisher with routing
// INPUT: Configuration and connection manager
// EXPECTED: Initialized event publisher
class EventPublisher:
    """
    Publishes events to WebSocket connections and external systems
    
    Supports topic-based routing and guaranteed delivery
    """
    
    def __init__(self, config: EventConfig, connection_manager: WebSocketConnectionManager):
        self.config = config
        self.connection_manager = connection_manager
        self.subscriptions: Dict[str, Set[str]] = {}  // event_type -> connection_ids
        self.event_history: Dict[str, List[EventRecord]] = {}  // event_type -> history
        self.max_history_size = 1000
    
    // TEST: Publish event to subscribers
    // INPUT: Event type and payload
    // EXPECTED: Event delivered to all subscribers
    async def publish_event(
        self,
        event_type: str,
        payload: Dict[str, Any],
        target_filters: Optional[Dict[str, Any]] = None
    ) -> int:
        """
        Publish event to all interested subscribers
        
        Preconditions:
        - Event type must be valid
        - Payload must be valid JSON-serializable data
        
        Postconditions:
        - Event is delivered to all matching subscribers
        - Event is stored in history
        - Delivery count is returned
        
        // TEST: Create event with metadata
        // INPUT: Event type and payload
        // EXPECTED: Valid event object with timestamp
        """
        
        // TEST: Create event object
        event = WebSocketEvent(
            event_type=event_type,
            payload=payload,
            timestamp=datetime.utcnow().isoformat(),
            event_id=generate_uuid()
        )
        
        // TEST: Store event in history
        await self._store_event_history(event)
        
        // TEST: Get target connections
        target_connections = await self._get_target_connections(event_type, target_filters)
        
        if not target_connections:
            return 0
        
        // TEST: Deliver to target connections
        successful_deliveries = 0
        
        for connection_id in target_connections:
            if await self.connection_manager.send_to_connection(connection_id, event):
                successful_deliveries += 1
        
        logger.info(f"Event {event_type} delivered to {successful_deliveries}/{len(target_connections)} connections")
        return successful_deliveries
    
    // TEST: Subscribe connection to event type
    // INPUT: Connection ID and subscription details
    // EXPECTED: Subscription established with filtering
    async def subscribe_connection(
        self,
        connection_id: str,
        event_type: str,
        filters: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Subscribe WebSocket connection to specific event types
        
        Preconditions:
        - Connection must exist and be active
        - Event type must be valid
        
        Postconditions:
        - Connection is added to subscription list
        - Subscription ID is returned
        - Filters are applied for selective delivery
        """
        
        // TEST: Validate connection
        if connection_id not in self.connection_manager.active_connections:
            raise ConnectionNotFoundError(f"Connection {connection_id} not found")
        
        // TEST: Create subscription
        subscription_id = generate_uuid()
        subscription_key = f"{event_type}:{connection_id}"
        
        // TEST: Add to subscriptions
        if event_type not in self.subscriptions:
            self.subscriptions[event_type] = set()
        
        self.subscriptions[event_type].add(connection_id)
        
        // TEST: Store subscription filters
        if filters:
            filter_key = f"subscription_filters:{subscription_id}"
            await self.connection_manager.redis.setex(
                filter_key,
                3600,  // 1 hour TTL
                json.dumps(filters)
            )
        
        logger.info(f"Connection {connection_id} subscribed to {event_type}")
        return subscription_id
    
    // TEST: Unsubscribe connection from events
    // INPUT: Subscription ID or connection details
    // EXPECTED: Subscription removed
    async def unsubscribe_connection(
        self,
        connection_id: str,
        event_type: Optional[str] = None
    ) -> None:
        """
        Unsubscribe WebSocket connection from event types
        
        Preconditions:
        - Connection must exist
        - Subscription must exist if event_type specified
        
        Postconditions:
        - Connection is removed from subscription lists
        - No further events are delivered
        """
        
        if event_type:
            // TEST: Unsubscribe from specific event type
            if event_type in self.subscriptions:
                self.subscriptions[event_type].discard(connection_id)
                if not self.subscriptions[event_type]:
                    del self.subscriptions[event_type]
        else:
            // TEST: Unsubscribe from all event types
            for event_type in list(self.subscriptions.keys()):
                self.subscriptions[event_type].discard(connection_id)
                if not self.subscriptions[event_type]:
                    del self.subscriptions[event_type]
        
        logger.info(f"Connection {connection_id} unsubscribed from events")
    
    // TEST: Broadcast pipeline event to subscribers
    // INPUT: Pipeline event and filtering criteria
    // EXPECTED: Event delivered to pipeline subscribers
    async def broadcast_pipeline_event(
        self,
        pipeline_id: str,
        event_type: str,
        payload: Dict[str, Any],
        stage: Optional[int] = None
    ) -> int:
        """
        Broadcast pipeline-specific events to interested subscribers
        
        Preconditions:
        - Pipeline must exist
        - Event type must be valid
        
        Postconditions:
        - Event is delivered to pipeline subscribers
        - Stage-specific filtering is applied
        - Delivery count is returned
        """
        
        // TEST: Create pipeline event
        pipeline_event = PipelineEvent(
            event_type=event_type,
            payload=payload,
            pipeline_id=pipeline_id,
            stage=stage,
            timestamp=datetime.utcnow().isoformat()
        )
        
        // TEST: Build target filters
        target_filters = {
            "pipeline_id": pipeline_id
        }
        
        if stage is not None:
            target_filters["stage"] = stage
        
        // TEST: Publish with pipeline filters
        return await self.publish_event(
            event_type=f"pipeline:{event_type}",
            payload=pipeline_event.dict(),
            target_filters=target_filters
        )
    
    // TEST: Send task delegation event
    // INPUT: Task and target agent
    // EXPECTED: Task delegation delivered to agent
    async def send_task_delegation(self, task: Task, agent: Agent) -> bool:
        """
        Send task delegation event to specific agent
        
        Preconditions:
        - Task must be ready for delegation
        - Agent must have required capabilities
        
        Postconditions:
        - Delegation event is sent to agent
        - Task assignment is tracked
        - Delivery status is returned
        """
        
        // TEST: Create delegation event
        delegation_event = TaskDelegateEvent(
            event_type="task:delegate",
            task_id=task.task_id,
            task_type=task.task_type,
            parameters=task.parameters,
            deadline=task.deadline,
            priority=task.priority,
            pipeline_id=task.pipeline_id,
            stage=task.stage,
            metadata={
                "assigned_at": datetime.utcnow().isoformat(),
                "estimated_duration": task.estimated_duration
            }
        )
        
        // TEST: Send to specific agent
        return await self.connection_manager.delegate_task(task, agent)
    
    // TEST: Get target connections for event
    // INPUT: Event type and filters
    // EXPECTED: List of connection IDs to receive event
    async def _get_target_connections(
        self,
        event_type: str,
        filters: Optional[Dict[str, Any]]
    ) -> List[str]:
        """
        Determine which connections should receive event
        
        Preconditions:
        - Event type must be valid
        - Filters must be valid if provided
        
        Postconditions:
        - Returns list of connection IDs
        - Filters are applied for selective delivery
        """
        
        // TEST: Get base subscribers
        subscribers = self.subscriptions.get(event_type, set())
        
        if not filters:
            return list(subscribers)
        
        // TEST: Apply filters to subscribers
        filtered_subscribers = []
        
        for connection_id in subscribers:
            // TEST: Check if connection matches filters
            if await self._connection_matches_filters(connection_id, filters):
                filtered_subscribers.append(connection_id)
        
        return filtered_subscribers
    
    // TEST: Store event in history for replay
    // INPUT: Event to store
    // EXPECTED: Event stored with retention management
    async def _store_event_history(self, event: WebSocketEvent) -> None:
        """
        Store event in history for replay and auditing
        
        Preconditions:
        - Event must be valid
        
        Postconditions:
        - Event is stored in history
        - History size is managed
        - Old events are removed
        """
        
        try:
            // TEST: Create event record
            event_record = EventRecord(
                event_id=event.event_id,
                event_type=event.event_type,
                payload=event.payload,
                timestamp=event.timestamp
            )
            
            // TEST: Add to history
            if event.event_type not in self.event_history:
                self.event_history[event.event_type] = []
            
            self.event_history[event.event_type].append(event_record)
            
            // TEST: Manage history size
            if len(self.event_history[event.event_type]) > self.max_history_size:
                self.event_history[event.event_type] = self.event_history[event.event_type][-self.max_history_size:]
            
        except Exception as e:
            logger.warning(f"Failed to store event history: {e}")
```

This comprehensive WebSocket event handling specification provides real-time communication patterns with extensive TDD anchors covering connection management, event routing, task delegation, and status updates. The design emphasizes reliability, scalability, and real-time performance while maintaining clear separation of concerns and comprehensive error handling.