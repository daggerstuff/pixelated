"""
Unit tests for WebSocket router functionality.
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime
from typing import Dict, Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from mcp_server.routers.websocket import router, get_websocket_manager, get_connection_stats
from mcp_server.services.websocket_manager import WebSocketManager
from mcp_server.config import MCPConfig, WebSocketConfig
from mcp_server.exceptions import ValidationError, NotFoundError


class TestWebSocketRouter:
    """Test cases for WebSocket router."""
    
    @pytest.fixture
    def mock_config(self):
        """Create mock configuration for testing."""
        config = Mock(spec=MCPConfig)
        config.websocket_config = Mock(spec=WebSocketConfig)
        config.websocket_config.enabled = True
        config.websocket_config.max_connections = 100
        config.websocket_config.heartbeat_interval = 30
        config.websocket_config.connection_timeout = 60
        config.websocket_config.compression = True
        config.websocket_config.cors_origins = ["*"]
        config.websocket_config.auth_required = True
        config.websocket_config.rate_limit = 100
        config.websocket_config.rate_limit_window = 60
        return config
    
    @pytest.fixture
    def mock_database(self):
        """Create mock database for testing."""
        return Mock()
    
    @pytest.fixture
    def mock_redis(self):
        """Create mock Redis client for testing."""
        redis = AsyncMock()
        redis.get = AsyncMock(return_value=None)
        redis.set = AsyncMock()
        redis.delete = AsyncMock()
        redis.expire = AsyncMock()
        return redis
    
    @pytest.fixture
    async def websocket_manager(self, mock_config, mock_database, mock_redis):
        """Create WebSocketManager instance for testing."""
        manager = WebSocketManager(mock_config, mock_database, mock_redis)
        await manager.initialize()
        yield manager
        await manager.shutdown()
    
    @pytest.fixture
    def app(self, websocket_manager):
        """Create FastAPI test application."""
        app = FastAPI()
        app.state.websocket_manager = websocket_manager
        
        # Add dependency override
        app.dependency_overrides[get_websocket_manager] = lambda: websocket_manager
        
        app.include_router(router, prefix="/api/v1/websocket")
        return app
    
    @pytest.fixture
    def client(self, app):
        """Create test client."""
        return TestClient(app)
    
    def test_get_websocket_stats_success(self, client, websocket_manager):
        """Test getting WebSocket statistics."""
        # Add some connections
        for i in range(3):
            mock_socket = Mock()
            mock_socket.sid = f"test_sid_{i}"
            
            asyncio.run(websocket_manager.add_connection(
                socket=mock_socket,
                user_id=f"test_user_{i}",
                auth_token=f"test_token_{i}"
            ))
        
        response = client.get("/api/v1/websocket/stats")
        
        assert response.status_code == 200
        data = response.json()
        assert data["total_connections"] == 3
        assert data["unique_users"] == 3
        assert "test_user_0" in data["users"]
    
    def test_get_websocket_stats_no_connections(self, client):
        """Test getting WebSocket statistics with no connections."""
        response = client.get("/api/v1/websocket/stats")
        
        assert response.status_code == 200
        data = response.json()
        assert data["total_connections"] == 0
        assert data["unique_users"] == 0
        assert data["users"] == []
    
    def test_get_connection_info_success(self, client, websocket_manager):
        """Test getting connection information."""
        # Add a connection
        mock_socket = Mock()
        mock_socket.sid = "test_sid"
        
        asyncio.run(websocket_manager.add_connection(
            socket=mock_socket,
            user_id="test_user",
            auth_token="test_token",
            metadata={"role": "agent"}
        ))
        
        response = client.get("/api/v1/websocket/connections/test_sid")
        
        assert response.status_code == 200
        data = response.json()
        assert data["sid"] == "test_sid"
        assert data["user_id"] == "test_user"
        assert data["metadata"]["role"] == "agent"
    
    def test_get_connection_info_not_found(self, client):
        """Test getting connection information for non-existent connection."""
        response = client.get("/api/v1/websocket/connections/nonexistent_sid")
        
        assert response.status_code == 404
        data = response.json()
        assert "Connection not found" in data["detail"]
    
    def test_get_user_connections_success(self, client, websocket_manager):
        """Test getting user connections."""
        # Add multiple connections for the same user
        for i in range(2):
            mock_socket = Mock()
            mock_socket.sid = f"test_sid_{i}"
            
            asyncio.run(websocket_manager.add_connection(
                socket=mock_socket,
                user_id="test_user",
                auth_token=f"test_token_{i}"
            ))
        
        response = client.get("/api/v1/websocket/users/test_user/connections")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["connections"]) == 2
        assert data["total"] == 2
        for conn in data["connections"]:
            assert conn["user_id"] == "test_user"
    
    def test_get_user_connections_no_connections(self, client):
        """Test getting user connections when user has no connections."""
        response = client.get("/api/v1/websocket/users/nonexistent_user/connections")
        
        assert response.status_code == 200
        data = response.json()
        assert data["connections"] == []
        assert data["total"] == 0
    
    def test_broadcast_event_success(self, client, websocket_manager):
        """Test broadcasting event to all connections."""
        # Add some connections
        for i in range(2):
            mock_socket = Mock()
            mock_socket.sid = f"test_sid_{i}"
            mock_socket.emit = AsyncMock()
            
            asyncio.run(websocket_manager.add_connection(
                socket=mock_socket,
                user_id=f"test_user_{i}",
                auth_token=f"test_token_{i}"
            ))
        
        event_data = {
            "event_type": "system_notification",
            "data": {"message": "Test broadcast"}
        }
        
        response = client.post("/api/v1/websocket/broadcast", json=event_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Event broadcasted successfully"
        assert data["recipients"] == 2
    
    def test_broadcast_event_no_connections(self, client):
        """Test broadcasting event when no connections exist."""
        event_data = {
            "event_type": "system_notification",
            "data": {"message": "Test broadcast"}
        }
        
        response = client.post("/api/v1/websocket/broadcast", json=event_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Event broadcasted successfully"
        assert data["recipients"] == 0
    
    def test_broadcast_event_missing_data(self, client):
        """Test broadcasting event with missing data."""
        event_data = {"event_type": "system_notification"}
        
        response = client.post("/api/v1/websocket/broadcast", json=event_data)
        
        assert response.status_code == 422
    
    def test_cleanup_expired_connections_success(self, client, websocket_manager):
        """Test cleaning up expired connections."""
        response = client.post("/api/v1/websocket/cleanup")
        
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Cleanup completed successfully"
        assert "cleaned_up" in data
    
    def test_get_websocket_config_success(self, client, websocket_manager):
        """Test getting WebSocket configuration."""
        response = client.get("/api/v1/websocket/config")
        
        assert response.status_code == 200
        data = response.json()
        assert data["enabled"] is True
        assert data["max_connections"] == 100
        assert data["heartbeat_interval"] == 30
    
    def test_health_check_success(self, client, websocket_manager):
        """Test WebSocket health check."""
        response = client.get("/api/v1/websocket/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "websocket"
        assert "connections" in data
        assert "uptime" in data
    
    def test_websocket_disabled(self, client, mock_config, mock_database, mock_redis):
        """Test endpoints when WebSocket is disabled."""
        # Create manager with disabled WebSocket
        mock_config.websocket_config.enabled = False
        manager = WebSocketManager(mock_config, mock_database, mock_redis)
        
        app = FastAPI()
        app.state.websocket_manager = manager
        app.dependency_overrides[get_websocket_manager] = lambda: manager
        app.include_router(router, prefix="/api/v1/websocket")
        
        client = TestClient(app)
        
        response = client.get("/api/v1/websocket/stats")
        
        assert response.status_code == 503
        data = response.json()
        assert "WebSocket support is disabled" in data["detail"]


class TestWebSocketRouterErrorHandling:
    """Test error handling in WebSocket router."""
    
    @pytest.fixture
    def mock_config(self):
        """Create mock configuration for testing."""
        config = Mock(spec=MCPConfig)
        config.websocket_config = Mock(spec=WebSocketConfig)
        config.websocket_config.enabled = True
        config.websocket_config.max_connections = 100
        config.websocket_config.heartbeat_interval = 30
        config.websocket_config.connection_timeout = 60
        config.websocket_config.compression = True
        config.websocket_config.cors_origins = ["*"]
        config.websocket_config.auth_required = True
        config.websocket_config.rate_limit = 100
        config.websocket_config.rate_limit_window = 60
        return config
    
    @pytest.fixture
    def mock_database(self):
        """Create mock database for testing."""
        return Mock()
    
    @pytest.fixture
    def mock_redis(self):
        """Create mock Redis client for testing."""
        redis = AsyncMock()
        redis.get = AsyncMock(return_value=None)
        redis.set = AsyncMock()
        redis.delete = AsyncMock()
        redis.expire = AsyncMock()
        return redis
    
    @pytest.fixture
    async def websocket_manager(self, mock_config, mock_database, mock_redis):
        """Create WebSocketManager instance for testing."""
        manager = WebSocketManager(mock_config, mock_database, mock_redis)
        await manager.initialize()
        yield manager
        await manager.shutdown()
    
    @pytest.fixture
    def app(self, websocket_manager):
        """Create FastAPI test application."""
        app = FastAPI()
        app.state.websocket_manager = websocket_manager
        app.dependency_overrides[get_websocket_manager] = lambda: websocket_manager
        app.include_router(router, prefix="/api/v1/websocket")
        return app
    
    @pytest.fixture
    def client(self, app):
        """Create test client."""
        return TestClient(app)
    
    def test_get_connection_info_with_exception(self, client, websocket_manager):
        """Test getting connection info when exception occurs."""
        with patch.object(websocket_manager, 'get_connection_info') as mock_get_info:
            mock_get_info.side_effect = Exception("Database error")
            
            response = client.get("/api/v1/websocket/connections/test_sid")
            
            assert response.status_code == 500
            data = response.json()
            assert "Internal server error" in data["detail"]
    
    def test_broadcast_event_with_exception(self, client, websocket_manager):
        """Test broadcasting event when exception occurs."""
        with patch.object(websocket_manager, 'broadcast_event', new_callable=AsyncMock) as mock_broadcast:
            mock_broadcast.side_effect = Exception("Broadcast error")
            
            event_data = {
                "event_type": "system_notification",
                "data": {"message": "Test broadcast"}
            }
            
            response = client.post("/api/v1/websocket/broadcast", json=event_data)
            
            assert response.status_code == 500
            data = response.json()
            assert "Failed to broadcast event" in data["detail"]
    
    def test_cleanup_expired_connections_with_exception(self, client, websocket_manager):
        """Test cleanup when exception occurs."""
        with patch.object(websocket_manager, 'cleanup_expired_connections', new_callable=AsyncMock) as mock_cleanup:
            mock_cleanup.side_effect = Exception("Cleanup error")
            
            response = client.post("/api/v1/websocket/cleanup")
            
            assert response.status_code == 500
            data = response.json()
            assert "Cleanup failed" in data["detail"]
    
    def test_get_websocket_manager_dependency_not_initialized(self, client):
        """Test get_websocket_manager dependency when manager is not initialized."""
        app = FastAPI()
        
        # Create manager but don't initialize it
        mock_config = Mock()
        mock_config.websocket_config.enabled = True
        manager = WebSocketManager(mock_config, Mock(), Mock())
        # Don't initialize it
        
        app.state.websocket_manager = manager
        app.dependency_overrides[get_websocket_manager] = lambda: manager
        app.include_router(router, prefix="/api/v1/websocket")
        
        client = TestClient(app)
        
        response = client.get("/api/v1/websocket/stats")
        
        assert response.status_code == 503
        data = response.json()
        assert "WebSocket manager not initialized" in data["detail"]


class TestWebSocketRouterValidation:
    """Test input validation in WebSocket router."""
    
    @pytest.fixture
    def mock_config(self):
        """Create mock configuration for testing."""
        config = Mock(spec=MCPConfig)
        config.websocket_config = Mock(spec=WebSocketConfig)
        config.websocket_config.enabled = True
        config.websocket_config.max_connections = 100
        config.websocket_config.heartbeat_interval = 30
        config.websocket_config.connection_timeout = 60
        config.websocket_config.compression = True
        config.websocket_config.cors_origins = ["*"]
        config.websocket_config.auth_required = True
        config.websocket_config.rate_limit = 100
        config.websocket_config.rate_limit_window = 60
        return config
    
    @pytest.fixture
    def mock_database(self):
        """Create mock database for testing."""
        return Mock()
    
    @pytest.fixture
    def mock_redis(self):
        """Create mock Redis client for testing."""
        redis = AsyncMock()
        redis.get = AsyncMock(return_value=None)
        redis.set = AsyncMock()
        redis.delete = AsyncMock()
        redis.expire = AsyncMock()
        return redis
    
    @pytest.fixture
    async def websocket_manager(self, mock_config, mock_database, mock_redis):
        """Create WebSocketManager instance for testing."""
        manager = WebSocketManager(mock_config, mock_database, mock_redis)
        await manager.initialize()
        yield manager
        await manager.shutdown()
    
    @pytest.fixture
    def app(self, websocket_manager):
        """Create FastAPI test application."""
        app = FastAPI()
        app.state.websocket_manager = websocket_manager
        app.dependency_overrides[get_websocket_manager] = lambda: websocket_manager
        app.include_router(router, prefix="/api/v1/websocket")
        return app
    
    @pytest.fixture
    def client(self, app):
        """Create test client."""
        return TestClient(app)
    
    def test_broadcast_event_invalid_event_type(self, client):
        """Test broadcasting event with invalid event type."""
        event_data = {
            "event_type": "",  # Empty event type
            "data": {"message": "Test broadcast"}
        }
        
        response = client.post("/api/v1/websocket/broadcast", json=event_data)
        
        assert response.status_code == 422
    
    def test_broadcast_event_missing_event_type(self, client):
        """Test broadcasting event with missing event type."""
        event_data = {
            "data": {"message": "Test broadcast"}
        }
        
        response = client.post("/api/v1/websocket/broadcast", json=event_data)
        
        assert response.status_code == 422
    
    def test_broadcast_event_invalid_data_format(self, client):
        """Test broadcasting event with invalid data format."""
        event_data = {
            "event_type": "system_notification",
            "data": "invalid_data_type"  # Should be dict
        }
        
        response = client.post("/api/v1/websocket/broadcast", json=event_data)
        
        assert response.status_code == 422