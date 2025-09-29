"""
WebSocket Router for MCP Server

Provides HTTP endpoints for WebSocket management and real-time communication.
"""

from typing import Dict, Any, Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Path, Request
from fastapi import Body
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import structlog

from ..config import MCPConfig, get_config
from ..services.websocket_manager import WebSocketManager
from ..middleware.auth import get_current_user
from ..exceptions import ValidationError, AuthenticationError, ServiceUnavailableError

logger = structlog.get_logger(__name__)

# Pydantic models for request/response
class WebSocketConnectionInfo(BaseModel):
    """WebSocket connection information."""
    sid: str
    agent_id: Optional[str] = None
    user_id: Optional[str] = None
    status: str
    connected_at: datetime
    last_heartbeat: datetime
    metadata: Dict[str, Any]
    subscribed_events: List[str]


class WebSocketStats(BaseModel):
    """WebSocket server statistics."""
    total_connections: int
    authenticated_connections: int
    active_agents: int
    uptime_seconds: float
    messages_sent: int
    messages_received: int


class TaskProgressUpdate(BaseModel):
    """Task progress update data."""
    task_id: str = Field(..., description="Task ID")
    progress: float = Field(..., ge=0, le=100, description="Progress percentage")
    status: Optional[str] = Field(None, description="Task status")
    message: Optional[str] = Field(None, description="Progress message")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")


class AgentStatusUpdate(BaseModel):
    """Agent status update data."""
    agent_id: str = Field(..., description="Agent ID")
    status: str = Field(..., description="Agent status")
    capabilities: Optional[List[str]] = Field(None, description="Agent capabilities")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")


class CoordinationMessage(BaseModel):
    """Coordination message data."""
    room: str = Field(..., description="Coordination room name")
    message: Dict[str, Any] = Field(..., description="Message data")
    event_type: str = Field(..., description="Event type")


class WebSocketAuthRequest(BaseModel):
    """WebSocket authentication request."""
    token: str = Field(..., description="Authentication token")


class SubscriptionRequest(BaseModel):
    """Event subscription request."""
    events: List[str] = Field(..., description="List of events to subscribe to")


# Create router
router = APIRouter()


def get_websocket_manager(request: Request) -> WebSocketManager:
    """
    Get WebSocket manager from application state.

    Args:
        request: FastAPI request object

    Returns:
        WebSocketManager instance

    Raises:
        HTTPException: If WebSocket manager is not available
    """
    websocket_manager = getattr(request.app.state, 'websocket_manager', None)
    if not websocket_manager:
        raise HTTPException(
            status_code=503,
            detail="WebSocket service unavailable"
        )
    return websocket_manager


@router.get("/connections", response_model=List[WebSocketConnectionInfo])
async def get_connections(
    websocket_manager: WebSocketManager = Depends(get_websocket_manager),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> List[WebSocketConnectionInfo]:
    """
    Get list of active WebSocket connections.

    Returns:
        List of connection information

    Raises:
        HTTPException: If user lacks required permissions
    """
    try:
        connections = websocket_manager.get_active_connections()

        # Filter connections based on user permissions
        user_id = current_user.get('user_id')
        user_role = current_user.get('role', 'user')

        if user_role != 'admin':
            # Regular users can only see their own connections
            connections = [
                conn for conn in connections
                if conn.user_id == user_id
            ]

        return [
            WebSocketConnectionInfo(
                sid=conn.sid,
                agent_id=conn.agent_id,
                user_id=conn.user_id,
                status=conn.status.value,
                connected_at=conn.connected_at,
                last_heartbeat=conn.last_heartbeat,
                metadata=conn.metadata,
                subscribed_events=list(conn.subscribed_events)
            )
            for conn in connections
        ]

    except Exception as e:
        logger.error("Error getting connections", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve connections")


@router.get("/stats", response_model=WebSocketStats)
async def get_websocket_stats(
    websocket_manager: WebSocketManager = Depends(get_websocket_manager),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> WebSocketStats:
    """
    Get WebSocket server statistics.

    Returns:
        WebSocket statistics

    Raises:
        HTTPException: If user lacks required permissions
    """
    try:
        # Calculate statistics
        connections = websocket_manager.get_active_connections()
        authenticated_connections = len([c for c in connections if c.status.value == 'authenticated'])
        active_agents = len(set([c.agent_id for c in connections if c.agent_id]))

        # Get server start time (placeholder - should be tracked properly)
        server_start_time = datetime.utcnow()  # This should be stored in app state

        stats = WebSocketStats(
            total_connections=len(connections),
            authenticated_connections=authenticated_connections,
            active_agents=active_agents,
            uptime_seconds=(datetime.utcnow() - server_start_time).total_seconds(),
            messages_sent=0,  # TODO: Track message statistics
            messages_received=0  # TODO: Track message statistics
        )

        return stats

    except Exception as e:
        logger.error("Error getting WebSocket stats", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve statistics")


@router.post("/broadcast")
async def broadcast_message(
    event: str = Query(..., description="Event name"),
    data: Dict[str, Any] = Body(..., description="Event data"),
    room: Optional[str] = Query(None, description="Target room"),
    websocket_manager: WebSocketManager = Depends(get_websocket_manager),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Broadcast a message to WebSocket clients.

    Args:
        event: Event name
        data: Event data
        room: Target room (optional)

    Returns:
        Success response

    Raises:
        HTTPException: If broadcasting fails or user lacks permissions
    """
    try:
        # Check permissions
        user_role = current_user.get('role', 'user')
        if user_role not in ['admin', 'system']:
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions to broadcast messages"
            )

        # Broadcast the message
        await websocket_manager.publish_event(event, data, room=room)

        return {
            "status": "success",
            "message": f"Message broadcast to {room or 'all clients'}",
            "timestamp": datetime.utcnow().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error broadcasting message", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to broadcast message")


@router.post("/task/{task_id}/progress")
async def update_task_progress(
    progress_update: TaskProgressUpdate,
    task_id: str = Path(..., description="Task ID"),
    websocket_manager: WebSocketManager = Depends(get_websocket_manager),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Update task progress via WebSocket.

    Args:
        task_id: Task ID
        progress_update: Progress update data

    Returns:
        Success response

    Raises:
        HTTPException: If update fails or user lacks permissions
    """
    try:
        # Prepare progress data
        progress_data = {
            'task_id': task_id,
            'progress': progress_update.progress,
            'status': progress_update.status,
            'message': progress_update.message,
            'metadata': progress_update.metadata or {},
            'updated_by': current_user.get('user_id'),
            'updated_at': datetime.utcnow().isoformat()
        }

        # Broadcast progress update
        await websocket_manager.publish_event(
            'task:progress',
            progress_data,
            room=f"task:{task_id}"
        )

        return {
            "status": "success",
            "message": "Task progress updated",
            "task_id": task_id,
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error("Error updating task progress", task_id=task_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to update task progress")


@router.post("/agent/{agent_id}/status")
async def update_agent_status(
    status_update: AgentStatusUpdate,
    agent_id: str = Path(..., description="Agent ID"),
    websocket_manager: WebSocketManager = Depends(get_websocket_manager),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Update agent status via WebSocket.

    Args:
        agent_id: Agent ID
        status_update: Status update data

    Returns:
        Success response

    Raises:
        HTTPException: If update fails or user lacks permissions
    """
    try:
        # Check permissions - users can only update their own agents unless admin
        user_role = current_user.get('role', 'user')
        user_id = current_user.get('user_id')

        if user_role != 'admin' and status_update.agent_id != agent_id:
            # Check if this is the user's own agent
            # TODO: Implement proper agent ownership check
            pass

        # Prepare status data
        status_data = {
            'agent_id': agent_id,
            'status': status_update.status,
            'capabilities': status_update.capabilities,
            'metadata': status_update.metadata or {},
            'updated_by': user_id,

            'updated_at': datetime.utcnow().isoformat()
        }

        # Broadcast status update
        await websocket_manager.publish_event(
            'agent:status_updated',
            status_data,
            room=f"agent:{agent_id}"
        )

        return {
            "status": "success",
            "message": "Agent status updated",
            "agent_id": agent_id,
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error("Error updating agent status", agent_id=agent_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to update agent status")


# Backwards-compatible alias expected by tests
get_connection_stats = get_websocket_stats


@router.post("/coordination/broadcast")
async def broadcast_coordination_message(
    message: CoordinationMessage,
    websocket_manager: WebSocketManager = Depends(get_websocket_manager),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Broadcast a coordination message to a room.

    Args:
        message: Coordination message data

    Returns:
        Success response

    Raises:
        HTTPException: If broadcasting fails or user lacks permissions
    """
    try:
        # Check permissions
        user_role = current_user.get('role', 'user')
        if user_role not in ['admin', 'agent', 'system']:
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions for coordination messages"
            )

        # Prepare coordination message
        coord_data = {
            'room': message.room,
            'event_type': message.event_type,
            'message': message.message,
            'sender_id': current_user.get('user_id'),
            'sender_agent_id': current_user.get('agent_id'),
            'timestamp': datetime.utcnow().isoformat()
        }

        # Broadcast to coordination room
        await websocket_manager.publish_event(
            'coordination:message',
            coord_data,
            room=f"coordination:{message.room}"
        )

        return {
            "status": "success",
            "message": "Coordination message broadcast",
            "room": message.room,
            "timestamp": datetime.utcnow().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error broadcasting coordination message", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to broadcast coordination message")


@router.get("/health")
async def get_websocket_health(
    websocket_manager: WebSocketManager = Depends(get_websocket_manager)
) -> Dict[str, Any]:
    """
    Get WebSocket service health status.

    Returns:
        Health status information
    """
    try:
        connection_count = websocket_manager.get_connection_count()

        return {
            "status": "healthy",
            "service": "websocket",
            "connections": connection_count,
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error("Error getting WebSocket health", error=str(e))
        return {
            "status": "unhealthy",
            "service": "websocket",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


# Error handlers
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


async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions."""
    logger.error(
        "Unhandled WebSocket router exception",
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

# Register exception handlers on the router when supported. Some FastAPI
# versions don't expose add_exception_handler on APIRouter; guard the call
# to avoid raising during import (tests import this module during collection).
if hasattr(router, 'add_exception_handler'):
    router.add_exception_handler(HTTPException, http_exception_handler)
    router.add_exception_handler(Exception, general_exception_handler)
else:
    # Fallback: attach handler functions to the router object so tests or
    # application setup code can register them on the FastAPI app if needed.
    setattr(router, 'http_exception_handler', http_exception_handler)
    setattr(router, 'general_exception_handler', general_exception_handler)
