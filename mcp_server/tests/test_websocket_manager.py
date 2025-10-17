"""
Unit tests for WebSocket manager functionality.
"""

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, Mock, patch

import pytest

from mcp_server.config import MCPConfig, WebSocketConfig
from mcp_server.services.websocket_manager import (
    ConnectionInfo,
    EventSubscription,
    WebSocketManager,
)


class TestWebSocketManager:
    """Test cases for WebSocketManager class."""

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

    @pytest.mark.asyncio
    async def test_initialization(self, mock_config, mock_database, mock_redis):
        """Test WebSocket manager initialization."""
        manager = WebSocketManager(mock_config, mock_database, mock_redis)

        await manager.initialize()

        assert manager.config == mock_config
        assert manager.database == mock_database
        assert manager.redis_client == mock_redis
        assert manager.connections == {}
        assert manager.event_subscriptions == {}
        assert manager.is_initialized is True

    @pytest.mark.asyncio
    async def test_shutdown(self, websocket_manager):
        """Test WebSocket manager shutdown."""
        # Add a mock connection
        mock_connection = Mock()
        mock_connection.disconnect = AsyncMock()
        websocket_manager.connections["test_sid"] = ConnectionInfo(
            sid="test_sid",
            user_id="test_user",
            connected_at=datetime.utcnow(),
            last_heartbeat=datetime.utcnow(),
            auth_token="test_token",
            metadata={"test": "data"},
            socket=mock_connection
        )

        await websocket_manager.shutdown()

        assert websocket_manager.is_initialized is False
        mock_connection.disconnect.assert_called_once()

    @pytest.mark.asyncio
    async def test_add_connection_success(self, websocket_manager):
        """Test successful connection addition."""
        mock_socket = Mock()
        mock_socket.sid = "test_sid"

        result = await websocket_manager.add_connection(
            socket=mock_socket,
            user_id="test_user",
            auth_token="test_token",
            metadata={"role": "agent"}
        )

        assert result is True
        assert "test_sid" in websocket_manager.connections
        connection = websocket_manager.connections["test_sid"]
        assert connection.sid == "test_sid"
        assert connection.user_id == "test_user"
        assert connection.auth_token == "test_token"

    @pytest.mark.asyncio
    async def test_add_connection_max_limit(self, websocket_manager):
        """Test connection addition when max limit is reached."""
        # Fill up to max connections
        websocket_manager.connections = {
            f"sid_{i}": ConnectionInfo(
                sid=f"sid_{i}",
                user_id=f"user_{i}",
                connected_at=datetime.utcnow(),
                last_heartbeat=datetime.utcnow(),
                auth_token=f"token_{i}",
                metadata={},
                socket=Mock()
            )
            for i in range(100)  # Max connections from config
        }

        mock_socket = Mock()
        mock_socket.sid = "new_sid"

        result = await websocket_manager.add_connection(
            socket=mock_socket,
            user_id="new_user",
            auth_token="new_token"
        )

        assert result is False

    @pytest.mark.asyncio
    async def test_remove_connection_success(self, websocket_manager):
        """Test successful connection removal."""
        # Add a connection first
        mock_socket = Mock()
        mock_socket.sid = "test_sid"
        mock_socket.disconnect = AsyncMock()

        await websocket_manager.add_connection(
            socket=mock_socket,
            user_id="test_user",
            auth_token="test_token"
        )

        result = await websocket_manager.remove_connection("test_sid")

        assert result is True
        assert "test_sid" not in websocket_manager.connections
        mock_socket.disconnect.assert_called_once()

    @pytest.mark.asyncio
    async def test_remove_connection_not_found(self, websocket_manager):
        """Test connection removal when connection doesn't exist."""
        result = await websocket_manager.remove_connection("nonexistent_sid")

        assert result is False

    @pytest.mark.asyncio
    async def test_update_heartbeat(self, websocket_manager):
        """Test heartbeat update functionality."""
        # Add a connection
        mock_socket = Mock()
        mock_socket.sid = "test_sid"

        await websocket_manager.add_connection(
            socket=mock_socket,
            user_id="test_user",
            auth_token="test_token"
        )

        # Update heartbeat
        await websocket_manager.update_heartbeat("test_sid")

        connection = websocket_manager.connections["test_sid"]
        assert connection.last_heartbeat <= datetime.utcnow()

    @pytest.mark.asyncio
    async def test_get_connection_info(self, websocket_manager):
        """Test getting connection information."""
        # Add a connection
        mock_socket = Mock()
        mock_socket.sid = "test_sid"

        await websocket_manager.add_connection(
            socket=mock_socket,
            user_id="test_user",
            auth_token="test_token"
        )

        info = websocket_manager.get_connection_info("test_sid")

        assert info is not None
        assert info.sid == "test_sid"
        assert info.user_id == "test_user"

    @pytest.mark.asyncio
    async def test_get_connection_info_not_found(self, websocket_manager):
        """Test getting connection info when connection doesn't exist."""
        info = websocket_manager.get_connection_info("nonexistent_sid")

        assert info is None

    @pytest.mark.asyncio
    async def test_get_user_connections(self, websocket_manager):
        """Test getting all connections for a user."""
        # Add multiple connections for the same user
        for i in range(3):
            mock_socket = Mock()
            mock_socket.sid = f"test_sid_{i}"

            await websocket_manager.add_connection(
                socket=mock_socket,
                user_id="test_user",
                auth_token=f"test_token_{i}"
            )

        connections = websocket_manager.get_user_connections("test_user")

        assert len(connections) == 3
        for conn in connections:
            assert conn.user_id == "test_user"

    @pytest.mark.asyncio
    async def test_subscribe_to_event(self, websocket_manager):
        """Test event subscription functionality."""
        # Add a connection
        mock_socket = Mock()
        mock_socket.sid = "test_sid"

        await websocket_manager.add_connection(
            socket=mock_socket,
            user_id="test_user",
            auth_token="test_token"
        )

        # Subscribe to event
        result = await websocket_manager.subscribe_to_event(
            "test_sid",
            "task_progress",
            {"task_id": "123"}
        )

        assert result is True
        assert "test_sid" in websocket_manager.event_subscriptions
        assert "task_progress" in websocket_manager.event_subscriptions["test_sid"]

    @pytest.mark.asyncio
    async def test_unsubscribe_from_event(self, websocket_manager):
        """Test event unsubscription functionality."""
        # Add connection and subscribe to event
        mock_socket = Mock()
        mock_socket.sid = "test_sid"

        await websocket_manager.add_connection(
            socket=mock_socket,
            user_id="test_user",
            auth_token="test_token"
        )

        await websocket_manager.subscribe_to_event(
            "test_sid",
            "task_progress",
            {"task_id": "123"}
        )

        # Unsubscribe from event
        result = await websocket_manager.unsubscribe_from_event(
            "test_sid",
            "task_progress"
        )

        assert result is True
        assert "task_progress" not in websocket_manager.event_subscriptions.get("test_sid", {})

    @pytest.mark.asyncio
    async def test_publish_event(self, websocket_manager):
        """Test event publishing functionality."""
        # Add connection and subscribe to event
        mock_socket = Mock()
        mock_socket.sid = "test_sid"
        mock_socket.emit = AsyncMock()

        await websocket_manager.add_connection(
            socket=mock_socket,
            user_id="test_user",
            auth_token="test_token"
        )

        await websocket_manager.subscribe_to_event(
            "test_sid",
            "task_progress",
            {"task_id": "123"}
        )

        # Publish event
        await websocket_manager.publish_event(
            "task_progress",
            {"task_id": "123", "progress": 50},
            {"task_id": "123"}
        )

        mock_socket.emit.assert_called_once_with(
            "task_progress",
            {"task_id": "123", "progress": 50}
        )

    @pytest.mark.asyncio
    async def test_publish_event_no_subscribers(self, websocket_manager):
        """Test event publishing when no subscribers exist."""
        # Publish event without subscribers
        await websocket_manager.publish_event(
            "task_progress",
            {"task_id": "123", "progress": 50},
            {"task_id": "123"}
        )

        # Should not raise any errors
        assert True

    @pytest.mark.asyncio
    async def test_broadcast_event(self, websocket_manager):
        """Test event broadcasting to all connections."""
        # Add multiple connections
        for i in range(3):
            mock_socket = Mock()
            mock_socket.sid = f"test_sid_{i}"
            mock_socket.emit = AsyncMock()

            await websocket_manager.add_connection(
                socket=mock_socket,
                user_id=f"test_user_{i}",
                auth_token=f"test_token_{i}"
            )

        # Broadcast event
        await websocket_manager.broadcast_event(
            "system_notification",
            {"message": "Test notification"}
        )

        # Verify all connections received the event
        for i in range(3):
            connection = websocket_manager.connections[f"test_sid_{i}"]
            connection.socket.emit.assert_called_once_with(
                "system_notification",
                {"message": "Test notification"}
            )

    @pytest.mark.asyncio
    async def test_cleanup_expired_connections(self, websocket_manager):
        """Test cleanup of expired connections."""
        # Add connection with old heartbeat
        mock_socket = Mock()
        mock_socket.sid = "test_sid"
        mock_socket.disconnect = AsyncMock()

        await websocket_manager.add_connection(
            socket=mock_socket,
            user_id="test_user",
            auth_token="test_token"
        )

        # Manually set old heartbeat
        connection = websocket_manager.connections["test_sid"]
        connection.last_heartbeat = datetime.utcnow() - timedelta(minutes=10)

        # Cleanup expired connections
        await websocket_manager.cleanup_expired_connections()

        # Connection should be removed
        assert "test_sid" not in websocket_manager.connections
        mock_socket.disconnect.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_connection_stats(self, websocket_manager):
        """Test getting connection statistics."""
        # Add some connections
        for i in range(5):
            mock_socket = Mock()
            mock_socket.sid = f"test_sid_{i}"

            await websocket_manager.add_connection(
                socket=mock_socket,
                user_id=f"test_user_{i}",
                auth_token=f"test_token_{i}"
            )

        stats = websocket_manager.get_connection_stats()

        assert stats["total_connections"] == 5
        assert stats["unique_users"] == 5
        assert "test_user_0" in stats["users"]

    @pytest.mark.asyncio
    async def test_validate_connection_limit(self, websocket_manager):
        """Test connection limit validation."""
        # Fill up to max connections minus 1
        for i in range(99):
            mock_socket = Mock()
            mock_socket.sid = f"test_sid_{i}"

            await websocket_manager.add_connection(
                socket=mock_socket,
                user_id=f"test_user_{i}",
                auth_token=f"test_token_{i}"
            )

        # Should allow one more connection
        mock_socket = Mock()
        mock_socket.sid = "test_sid_99"

        result = await websocket_manager.add_connection(
            socket=mock_socket,
            user_id="test_user_99",
            auth_token="test_token_99"
        )

        assert result is True

        # Should reject next connection
        mock_socket = Mock()
        mock_socket.sid = "test_sid_100"

        result = await websocket_manager.add_connection(
            socket=mock_socket,
            user_id="test_user_100",
            auth_token="test_token_100"
        )

        assert result is False

    @pytest.mark.asyncio
    async def test_connection_info_dataclass(self):
        """Test ConnectionInfo dataclass."""
        connection_info = ConnectionInfo(
            sid="test_sid",
            user_id="test_user",
            connected_at=datetime.utcnow(),
            last_heartbeat=datetime.utcnow(),
            auth_token="test_token",
            metadata={"role": "agent"},
            socket=Mock()
        )

        assert connection_info.sid == "test_sid"
        assert connection_info.user_id == "test_user"
        assert connection_info.auth_token == "test_token"
        assert connection_info.metadata["role"] == "agent"

    @pytest.mark.asyncio
    async def test_event_subscription_dataclass(self):
        """Test EventSubscription dataclass."""
        subscription = EventSubscription(
            event_type="task_progress",
            filters={"task_id": "123"},
            subscribed_at=datetime.utcnow()
        )

        assert subscription.event_type == "task_progress"
        assert subscription.filters["task_id"] == "123"


class TestWebSocketManagerErrorHandling:
    """Test error handling in WebSocketManager."""

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

    @pytest.mark.asyncio
    async def test_add_connection_with_exception(self, websocket_manager):
        """Test handling exceptions during connection addition."""
        mock_socket = Mock()
        mock_socket.sid = "test_sid"

        # Mock an exception during connection setup
        with patch.object(websocket_manager, "_validate_connection", side_effect=Exception("Validation error")):
            result = await websocket_manager.add_connection(
                socket=mock_socket,
                user_id="test_user",
                auth_token="test_token"
            )

            assert result is False

    @pytest.mark.asyncio
    async def test_remove_connection_with_disconnect_exception(self, websocket_manager):
        """Test handling exceptions during connection removal."""
        # Add a connection
        mock_socket = Mock()
        mock_socket.sid = "test_sid"
        mock_socket.disconnect = AsyncMock(side_effect=Exception("Disconnect error"))

        await websocket_manager.add_connection(
            socket=mock_socket,
            user_id="test_user",
            auth_token="test_token"
        )

        # Should handle disconnect exception gracefully
        result = await websocket_manager.remove_connection("test_sid")

        assert result is True
        assert "test_sid" not in websocket_manager.connections

    @pytest.mark.asyncio
    async def test_publish_event_with_emit_exception(self, websocket_manager):
        """Test handling exceptions during event publishing."""
        # Add connection and subscribe to event
        mock_socket = Mock()
        mock_socket.sid = "test_sid"
        mock_socket.emit = AsyncMock(side_effect=Exception("Emit error"))

        await websocket_manager.add_connection(
            socket=mock_socket,
            user_id="test_user",
            auth_token="test_token"
        )

        await websocket_manager.subscribe_to_event(
            "test_sid",
            "task_progress",
            {"task_id": "123"}
        )

        # Should handle emit exception gracefully
        await websocket_manager.publish_event(
            "task_progress",
            {"task_id": "123", "progress": 50},
            {"task_id": "123"}
        )

        # Connection should still exist despite emit error
        assert "test_sid" in websocket_manager.connections

    @pytest.mark.asyncio
    async def test_cleanup_expired_connections_with_exception(self, websocket_manager):
        """Test handling exceptions during connection cleanup."""
        # Add connection
        mock_socket = Mock()
        mock_socket.sid = "test_sid"
        mock_socket.disconnect = AsyncMock(side_effect=Exception("Disconnect error"))

        await websocket_manager.add_connection(
            socket=mock_socket,
            user_id="test_user",
            auth_token="test_token"
        )

        # Manually set old heartbeat
        connection = websocket_manager.connections["test_sid"]
        connection.last_heartbeat = datetime.utcnow() - timedelta(minutes=10)

        # Should handle disconnect exception gracefully
        await websocket_manager.cleanup_expired_connections()

        # Connection should be removed despite disconnect error
        assert "test_sid" not in websocket_manager.connections
