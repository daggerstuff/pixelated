"""
WebSocket ASGI Application Wrapper

Provides ASGI application wrapper for Socket.IO integration with FastAPI.
"""

from typing import Dict, Any, Optional, Callable, Awaitable
import asyncio
import json
from datetime import datetime

import socketio
from fastapi import Request, Response
from starlette.types import ASGIApp, Scope, Receive, Send
import structlog

from ..config import MCPConfig
from .websocket_manager import WebSocketManager

logger = structlog.get_logger(__name__)


class WebSocketASGIApp:
    """
    ASGI application wrapper for Socket.IO integration.
    
    This class wraps the Socket.IO server to make it compatible with FastAPI
    and provides proper integration with the MCP server's middleware and
    authentication systems.
    """
    
    def __init__(self, websocket_manager: WebSocketManager, config: MCPConfig):
        """
        Initialize WebSocket ASGI application.
        
        Args:
            websocket_manager: WebSocket manager instance
            config: MCP configuration
        """
        self.websocket_manager = websocket_manager
        self.config = config
        self.sio = websocket_manager.sio
        
    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        """
        ASGI application entry point.
        
        Args:
            scope: ASGI scope
            receive: ASGI receive function
            send: ASGI send function
        """
        # Only handle WebSocket connections
        if scope["type"] != "websocket":
            await self._send_error_response(send, "WebSocket connections only")
            return
            
        try:
            # Extract authentication information from query parameters or headers
            auth_info = await self._extract_auth_info(scope)
            
            # Create a custom ASGI receive function that injects auth info
            async def custom_receive() -> Dict[str, Any]:
                message = await receive()
                if message["type"] == "websocket.connect":
                    # Inject authentication information into the message
                    message["auth_info"] = auth_info
                return message
            
            # Delegate to Socket.IO
            await self.sio.handle_request(scope, custom_receive, send)
            
        except Exception as e:
            logger.error("Error handling WebSocket request", error=str(e))
            await self._send_error_response(send, "Internal server error")
    
    async def _extract_auth_info(self, scope: Scope) -> Optional[Dict[str, Any]]:
        """
        Extract authentication information from the scope.
        
        Args:
            scope: ASGI scope
            
        Returns:
            Authentication information or None
        """
        try:
            # Extract query parameters
            query_string = scope.get("query_string", b"").decode("utf-8")
            query_params = self._parse_query_string(query_string)
            
            # Look for authentication token in query parameters
            auth_token = query_params.get("token")
            if not auth_token:
                # Check headers for authorization
                headers = dict(scope.get("headers", []))
                auth_header = headers.get(b"authorization", b"").decode("utf-8")
                if auth_header.startswith("Bearer "):
                    auth_token = auth_header[7:]
            
            if auth_token:
                # TODO: Implement proper token verification
                # For now, return a placeholder
                return {
                    "token": auth_token,
                    "user_id": "user_placeholder",
                    "agent_id": "agent_placeholder"
                }
            
            return None
            
        except Exception as e:
            logger.error("Error extracting auth info", error=str(e))
            return None
    
    def _parse_query_string(self, query_string: str) -> Dict[str, str]:
        """
        Parse query string into dictionary.
        
        Args:
            query_string: Query string
            
        Returns:
            Dictionary of query parameters
        """
        params = {}
        if query_string:
            for param in query_string.split("&"):
                if "=" in param:
                    key, value = param.split("=", 1)
                    params[key] = value
        return params
    
    async def _send_error_response(self, send: Send, message: str) -> None:
        """
        Send error response.
        
        Args:
            send: ASGI send function
            message: Error message
        """
        await send({
            "type": "websocket.close",
            "code": 1008,  # Policy violation
            "reason": message
        })


class WebSocketMiddleware:
    """
    Middleware for WebSocket request processing.
    
    This middleware handles WebSocket upgrade requests and integrates
    with the MCP server's authentication and middleware systems.
    """
    
    def __init__(self, app: ASGIApp, websocket_manager: WebSocketManager, config: MCPConfig):
        """
        Initialize WebSocket middleware.
        
        Args:
            app: Next ASGI application
            websocket_manager: WebSocket manager instance
            config: MCP configuration
        """
        self.app = app
        self.websocket_manager = websocket_manager
        self.config = config
        self.websocket_app = WebSocketASGIApp(websocket_manager, config)
        
    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        """
        Middleware entry point.
        
        Args:
            scope: ASGI scope
            receive: ASGI receive function
            send: ASGI send function
        """
        # Only process WebSocket requests
        if scope["type"] == "websocket":
            # Check if WebSocket is enabled
            if not self.config.websocket_config.enabled:
                await self._send_websocket_error(send, "WebSocket disabled")
                return
            
            # Check connection limits
            current_connections = self.websocket_manager.get_connection_count()
            max_connections = self.config.websocket_config.max_connections
            
            if current_connections >= max_connections:
                await self._send_websocket_error(send, "Connection limit exceeded")
                return
            
            # Handle WebSocket request
            await self.websocket_app(scope, receive, send)
        else:
            # Pass through to next application
            await self.app(scope, receive, send)
    
    async def _send_websocket_error(self, send: Send, message: str) -> None:
        """
        Send WebSocket error response.
        
        Args:
            send: ASGI send function
            message: Error message
        """
        await send({
            "type": "websocket.close",
            "code": 1008,  # Policy violation
            "reason": message
        })


# FastAPI dependency for WebSocket manager
async def get_websocket_manager(request: Request) -> WebSocketManager:
    """
    Get WebSocket manager from request.
    
    Args:
        request: FastAPI request
        
    Returns:
        WebSocketManager instance
        
    Raises:
        HTTPException: If WebSocket manager is not available
    """
    websocket_manager = getattr(request.app.state, 'websocket_manager', None)
    if not websocket_manager:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=503,
            detail="WebSocket service unavailable"
        )
    return websocket_manager


# Socket.IO event handlers for integration
class SocketIOEventHandlers:
    """
    Socket.IO event handlers for WebSocket integration.
    """
    
    def __init__(self, websocket_manager: WebSocketManager):
        """
        Initialize event handlers.
        
        Args:
            websocket_manager: WebSocket manager instance
        """
        self.websocket_manager = websocket_manager
        self.sio = websocket_manager.sio
        
    def register_handlers(self) -> None:
        """
        Register Socket.IO event handlers.
        """
        if not self.sio:
            return
            
        # Connection lifecycle
        self.sio.on('connect', self.on_connect)
        self.sio.on('disconnect', self.on_disconnect)
        
        # Authentication
        self.sio.on('authenticate', self.on_authenticate)
        
        # Task events
        self.sio.on('task:request', self.on_task_request)
        self.sio.on('task:progress', self.on_task_progress)
        self.sio.on('task:complete', self.on_task_complete)
        self.sio.on('task:failed', self.on_task_failed)
        
        # Agent events
        self.sio.on('agent:status', self.on_agent_status)
        self.sio.on('agent:register', self.on_agent_register)
        self.sio.on('agent:unregister', self.on_agent_unregister)
        
        # Coordination events
        self.sio.on('coordination:join', self.on_coordination_join)
        self.sio.on('coordination:leave', self.on_coordination_leave)
        self.sio.on('coordination:broadcast', self.on_coordination_broadcast)
        
        # Heartbeat
        self.sio.on('heartbeat', self.on_heartbeat)
        
        # Subscriptions
        self.sio.on('subscribe', self.on_subscribe)
        self.sio.on('unsubscribe', self.on_unsubscribe)
        
        logger.info("Socket.IO event handlers registered")
    
    async def on_connect(self, sid: str, environ: Dict[str, Any]) -> None:
        """Handle connection event."""
        await self.websocket_manager._handle_connect(sid, environ)
    
    async def on_disconnect(self, sid: str) -> None:
        """Handle disconnection event."""
        await self.websocket_manager._handle_disconnect(sid)
    
    async def on_authenticate(self, sid: str, data: Dict[str, Any]) -> None:
        """Handle authentication event."""
        await self.websocket_manager._handle_authenticate(sid, data)
    
    async def on_task_request(self, sid: str, data: Dict[str, Any]) -> None:
        """Handle task request event."""
        await self.websocket_manager._handle_task_request(sid, data)
    
    async def on_task_progress(self, sid: str, data: Dict[str, Any]) -> None:
        """Handle task progress event."""
        await self.websocket_manager._handle_task_progress(sid, data)
    
    async def on_task_complete(self, sid: str, data: Dict[str, Any]) -> None:
        """Handle task complete event."""
        await self.websocket_manager._handle_task_complete(sid, data)
    
    async def on_task_failed(self, sid: str, data: Dict[str, Any]) -> None:
        """Handle task failed event."""
        await self.websocket_manager._handle_task_failed(sid, data)
    
    async def on_agent_status(self, sid: str, data: Dict[str, Any]) -> None:
        """Handle agent status event."""
        await self.websocket_manager._handle_agent_status(sid, data)
    
    async def on_agent_register(self, sid: str, data: Dict[str, Any]) -> None:
        """Handle agent register event."""
        await self.websocket_manager._handle_agent_register(sid, data)
    
    async def on_agent_unregister(self, sid: str, data: Dict[str, Any]) -> None:
        """Handle agent unregister event."""
        await self.websocket_manager._handle_agent_unregister(sid, data)
    
    async def on_coordination_join(self, sid: str, data: Dict[str, Any]) -> None:
        """Handle coordination join event."""
        await self.websocket_manager._handle_coordination_join(sid, data)
    
    async def on_coordination_leave(self, sid: str, data: Dict[str, Any]) -> None:
        """Handle coordination leave event."""
        await self.websocket_manager._handle_coordination_leave(sid, data)
    
    async def on_coordination_broadcast(self, sid: str, data: Dict[str, Any]) -> None:
        """Handle coordination broadcast event."""
        await self.websocket_manager._handle_coordination_broadcast(sid, data)
    
    async def on_heartbeat(self, sid: str, data: Dict[str, Any]) -> None:
        """Handle heartbeat event."""
        await self.websocket_manager._handle_heartbeat(sid, data)
    
    async def on_subscribe(self, sid: str, data: Dict[str, Any]) -> None:
        """Handle subscribe event."""
        await self.websocket_manager._handle_subscribe(sid, data)
    
    async def on_unsubscribe(self, sid: str, data: Dict[str, Any]) -> None:
        """Handle unsubscribe event."""
        await self.websocket_manager._handle_unsubscribe(sid, data)


# Utility functions
def create_socketio_asgi_app(websocket_manager: WebSocketManager, config: MCPConfig) -> ASGIApp:
    """
    Create Socket.IO ASGI application.
    
    Args:
        websocket_manager: WebSocket manager instance
        config: MCP configuration
        
    Returns:
        ASGI application
    """
    return WebSocketASGIApp(websocket_manager, config)


def create_websocket_middleware(app: ASGIApp, websocket_manager: WebSocketManager, config: MCPConfig) -> ASGIApp:
    """
    Create WebSocket middleware.
    
    Args:
        app: Next ASGI application
        websocket_manager: WebSocket manager instance
        config: MCP configuration
        
    Returns:
        ASGI middleware application
    """
    return WebSocketMiddleware(app, websocket_manager, config)