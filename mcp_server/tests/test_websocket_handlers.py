"""
Unit tests for WebSocket event handlers.
"""

from datetime import datetime
from unittest.mock import AsyncMock, Mock, patch

import pytest

from mcp_server.config import MCPConfig, WebSocketConfig
from mcp_server.exceptions import AuthenticationError
from mcp_server.services.websocket_asgi import SocketIOEventHandlers
from mcp_server.services.websocket_manager import ConnectionInfo, WebSocketManager


class TestSocketIOEventHandlers:
    """Test cases for SocketIOEventHandlers class."""

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
    def event_handlers(self, websocket_manager):
        """Create SocketIOEventHandlers instance for testing."""
        return SocketIOEventHandlers(websocket_manager)

    @pytest.fixture
    def mock_socket(self):
        """Create mock socket for testing."""
        socket = Mock()
        socket.sid = "test_sid"
        socket.request = Mock()
        socket.request.headers = {"authorization": "Bearer test_token"}
        socket.request.sid = "test_sid"
        socket.emit = AsyncMock()
        socket.disconnect = AsyncMock()
        return socket

    @pytest.mark.asyncio
    async def test_register_handlers(self, event_handlers):
        """Test event handler registration."""
        # Mock the socketio server
        with patch("mcp_server.services.websocket_asgi.socketio") as mock_socketio:
            mock_server = Mock()
            mock_socketio.AsyncServer.return_value = mock_server

            event_handlers.register_handlers()

            # Verify handlers were registered
            mock_server.on.assert_any_call("connect", event_handlers.on_connect)
            mock_server.on.assert_any_call("disconnect", event_handlers.on_disconnect)
            mock_server.on.assert_any_call("authenticate", event_handlers.on_authenticate)
            mock_server.on.assert_any_call("task_request", event_handlers.on_task_request)
            mock_server.on.assert_any_call("task_progress", event_handlers.on_task_progress)
            mock_server.on.assert_any_call("task_completed", event_handlers.on_task_completed)
            mock_server.on.assert_any_call("task_failed", event_handlers.on_task_failed)
            mock_server.on.assert_any_call("agent_register", event_handlers.on_agent_register)
            mock_server.on.assert_any_call("agent_unregister", event_handlers.on_agent_unregister)
            mock_server.on.assert_any_call("agent_status_update", event_handlers.on_agent_status_update)
            mock_server.on.assert_any_call("heartbeat", event_handlers.on_heartbeat)
            mock_server.on.assert_any_call("subscribe", event_handlers.on_subscribe)
            mock_server.on.assert_any_call("unsubscribe", event_handlers.on_unsubscribe)

    @pytest.mark.asyncio
    async def test_on_connect_success(self, event_handlers, mock_socket):
        """Test successful connection."""
        with patch.object(event_handlers.websocket_manager, "add_connection", new_callable=AsyncMock) as mock_add:
            mock_add.return_value = True

            result = await event_handlers.on_connect("test_sid", mock_socket.request)

            assert result is True
            mock_add.assert_called_once_with(
                socket=mock_socket,
                user_id=None,
                auth_token="test_token",
                metadata={}
            )

    @pytest.mark.asyncio
    async def test_on_connect_failure(self, event_handlers, mock_socket):
        """Test failed connection."""
        with patch.object(event_handlers.websocket_manager, "add_connection", new_callable=AsyncMock) as mock_add:
            mock_add.return_value = False

            result = await event_handlers.on_connect("test_sid", mock_socket.request)

            assert result is False

    @pytest.mark.asyncio
    async def test_on_disconnect(self, event_handlers, mock_socket):
        """Test disconnection."""
        with patch.object(event_handlers.websocket_manager, "remove_connection", new_callable=AsyncMock) as mock_remove:
            mock_remove.return_value = True

            await event_handlers.on_disconnect("test_sid")

            mock_remove.assert_called_once_with("test_sid")

    @pytest.mark.asyncio
    async def test_on_authenticate_success(self, event_handlers, mock_socket):
        """Test successful authentication."""
        auth_data = {"token": "valid_token", "user_id": "test_user"}

        with patch.object(event_handlers.websocket_manager, "update_connection_auth", new_callable=AsyncMock) as mock_update:
            mock_update.return_value = True

            result = await event_handlers.on_authenticate("test_sid", auth_data)

            assert result is True
            mock_update.assert_called_once_with("test_sid", "test_user", "valid_token")

    @pytest.mark.asyncio
    async def test_on_authenticate_failure(self, event_handlers, mock_socket):
        """Test failed authentication."""
        auth_data = {"token": "invalid_token", "user_id": "test_user"}

        with patch.object(event_handlers.websocket_manager, "update_connection_auth", new_callable=AsyncMock) as mock_update:
            mock_update.side_effect = AuthenticationError("Invalid token")

            result = await event_handlers.on_authenticate("test_sid", auth_data)

            assert result is False

    @pytest.mark.asyncio
    async def test_on_task_request_success(self, event_handlers, mock_socket):
        """Test successful task request."""
        task_data = {
            "task_id": "task_123",
            "task_type": "analysis",
            "parameters": {"data": "test_data"}
        }

        with patch.object(event_handlers.websocket_manager, "get_connection_info") as mock_get_info:
            mock_get_info.return_value = ConnectionInfo(
                sid="test_sid",
                user_id="test_user",
                connected_at=datetime.utcnow(),
                last_heartbeat=datetime.utcnow(),
                auth_token="test_token",
                metadata={"role": "agent"},
                socket=mock_socket
            )

            with patch.object(event_handlers.websocket_manager, "publish_event", new_callable=AsyncMock) as mock_publish:
                result = await event_handlers.on_task_request("test_sid", task_data)

                assert result is True
                mock_publish.assert_called_once()
                call_args = mock_publish.call_args[0]
                assert call_args[0] == "task_requested"
                assert call_args[1]["task_id"] == "task_123"

    @pytest.mark.asyncio
    async def test_on_task_request_invalid_data(self, event_handlers, mock_socket):
        """Test task request with invalid data."""
        task_data = {"invalid": "data"}

        result = await event_handlers.on_task_request("test_sid", task_data)

        assert result is False

    @pytest.mark.asyncio
    async def test_on_task_progress(self, event_handlers, mock_socket):
        """Test task progress update."""
        progress_data = {
            "task_id": "task_123",
            "progress": 50,
            "status": "in_progress",
            "message": "Processing data"
        }

        with patch.object(event_handlers.websocket_manager, "get_connection_info") as mock_get_info:
            mock_get_info.return_value = ConnectionInfo(
                sid="test_sid",
                user_id="test_user",
                connected_at=datetime.utcnow(),
                last_heartbeat=datetime.utcnow(),
                auth_token="test_token",
                metadata={"role": "agent"},
                socket=mock_socket
            )

            with patch.object(event_handlers.websocket_manager, "publish_event", new_callable=AsyncMock) as mock_publish:
                result = await event_handlers.on_task_progress("test_sid", progress_data)

                assert result is True
                mock_publish.assert_called_once()
                call_args = mock_publish.call_args[0]
                assert call_args[0] == "task_progress"
                assert call_args[1]["task_id"] == "task_123"
                assert call_args[1]["progress"] == 50

    @pytest.mark.asyncio
    async def test_on_task_completed(self, event_handlers, mock_socket):
        """Test task completion."""
        completion_data = {
            "task_id": "task_123",
            "result": {"analysis": "completed"},
            "duration": 120.5
        }

        with patch.object(event_handlers.websocket_manager, "get_connection_info") as mock_get_info:
            mock_get_info.return_value = ConnectionInfo(
                sid="test_sid",
                user_id="test_user",
                connected_at=datetime.utcnow(),
                last_heartbeat=datetime.utcnow(),
                auth_token="test_token",
                metadata={"role": "agent"},
                socket=mock_socket
            )

            with patch.object(event_handlers.websocket_manager, "publish_event", new_callable=AsyncMock) as mock_publish:
                result = await event_handlers.on_task_completed("test_sid", completion_data)

                assert result is True
                mock_publish.assert_called_once()
                call_args = mock_publish.call_args[0]
                assert call_args[0] == "task_completed"
                assert call_args[1]["task_id"] == "task_123"
                assert call_args[1]["result"]["analysis"] == "completed"

    @pytest.mark.asyncio
    async def test_on_task_failed(self, event_handlers, mock_socket):
        """Test task failure."""
        failure_data = {
            "task_id": "task_123",
            "error": "Analysis failed",
            "error_code": "ANALYSIS_ERROR"
        }

        with patch.object(event_handlers.websocket_manager, "get_connection_info") as mock_get_info:
            mock_get_info.return_value = ConnectionInfo(
                sid="test_sid",
                user_id="test_user",
                connected_at=datetime.utcnow(),
                last_heartbeat=datetime.utcnow(),
                auth_token="test_token",
                metadata={"role": "agent"},
                socket=mock_socket
            )

            with patch.object(event_handlers.websocket_manager, "publish_event", new_callable=AsyncMock) as mock_publish:
                result = await event_handlers.on_task_failed("test_sid", failure_data)

                assert result is True
                mock_publish.assert_called_once()
                call_args = mock_publish.call_args[0]
                assert call_args[0] == "task_failed"
                assert call_args[1]["task_id"] == "task_123"
                assert call_args[1]["error"] == "Analysis failed"

    @pytest.mark.asyncio
    async def test_on_agent_register(self, event_handlers, mock_socket):
        """Test agent registration."""
        agent_data = {
            "agent_id": "agent_123",
            "agent_type": "analysis",
            "capabilities": ["text_analysis", "sentiment_analysis"],
            "status": "available"
        }

        with patch.object(event_handlers.websocket_manager, "get_connection_info") as mock_get_info:
            mock_get_info.return_value = ConnectionInfo(
                sid="test_sid",
                user_id="test_user",
                connected_at=datetime.utcnow(),
                last_heartbeat=datetime.utcnow(),
                auth_token="test_token",
                metadata={"role": "agent"},
                socket=mock_socket
            )

            with patch.object(event_handlers.websocket_manager, "publish_event", new_callable=AsyncMock) as mock_publish:
                result = await event_handlers.on_agent_register("test_sid", agent_data)

                assert result is True
                mock_publish.assert_called_once()
                call_args = mock_publish.call_args[0]
                assert call_args[0] == "agent_registered"
                assert call_args[1]["agent_id"] == "agent_123"
                assert call_args[1]["agent_type"] == "analysis"

    @pytest.mark.asyncio
    async def test_on_agent_unregister(self, event_handlers, mock_socket):
        """Test agent unregistration."""
        agent_data = {"agent_id": "agent_123"}

        with patch.object(event_handlers.websocket_manager, "get_connection_info") as mock_get_info:
            mock_get_info.return_value = ConnectionInfo(
                sid="test_sid",
                user_id="test_user",
                connected_at=datetime.utcnow(),
                last_heartbeat=datetime.utcnow(),
                auth_token="test_token",
                metadata={"role": "agent"},
                socket=mock_socket
            )

            with patch.object(event_handlers.websocket_manager, "publish_event", new_callable=AsyncMock) as mock_publish:
                result = await event_handlers.on_agent_unregister("test_sid", agent_data)

                assert result is True
                mock_publish.assert_called_once()
                call_args = mock_publish.call_args[0]
                assert call_args[0] == "agent_unregistered"
                assert call_args[1]["agent_id"] == "agent_123"

    @pytest.mark.asyncio
    async def test_on_agent_status_update(self, event_handlers, mock_socket):
        """Test agent status update."""
        status_data = {
            "agent_id": "agent_123",
            "status": "busy",
            "current_task": "task_456",
            "load": 75
        }

        with patch.object(event_handlers.websocket_manager, "get_connection_info") as mock_get_info:
            mock_get_info.return_value = ConnectionInfo(
                sid="test_sid",
                user_id="test_user",
                connected_at=datetime.utcnow(),
                last_heartbeat=datetime.utcnow(),
                auth_token="test_token",
                metadata={"role": "agent"},
                socket=mock_socket
            )

            with patch.object(event_handlers.websocket_manager, "publish_event", new_callable=AsyncMock) as mock_publish:
                result = await event_handlers.on_agent_status_update("test_sid", status_data)

                assert result is True
                mock_publish.assert_called_once()
                call_args = mock_publish.call_args[0]
                assert call_args[0] == "agent_status_updated"
                assert call_args[1]["agent_id"] == "agent_123"
                assert call_args[1]["status"] == "busy"

    @pytest.mark.asyncio
    async def test_on_heartbeat(self, event_handlers, mock_socket):
        """Test heartbeat handling."""
        with patch.object(event_handlers.websocket_manager, "update_heartbeat", new_callable=AsyncMock) as mock_update:
            mock_update.return_value = True

            result = await event_handlers.on_heartbeat("test_sid", {})

            assert result is True
            mock_update.assert_called_once_with("test_sid")

    @pytest.mark.asyncio
    async def test_on_subscribe(self, event_handlers, mock_socket):
        """Test event subscription."""
        subscribe_data = {
            "event_type": "task_progress",
            "filters": {"task_id": "task_123"}
        }

        with patch.object(event_handlers.websocket_manager, "subscribe_to_event", new_callable=AsyncMock) as mock_subscribe:
            mock_subscribe.return_value = True

            result = await event_handlers.on_subscribe("test_sid", subscribe_data)

            assert result is True
            mock_subscribe.assert_called_once_with(
                "test_sid",
                "task_progress",
                {"task_id": "task_123"}
            )

    @pytest.mark.asyncio
    async def test_on_unsubscribe(self, event_handlers, mock_socket):
        """Test event unsubscription."""
        unsubscribe_data = {
            "event_type": "task_progress"
        }

        with patch.object(event_handlers.websocket_manager, "unsubscribe_from_event", new_callable=AsyncMock) as mock_unsubscribe:
            mock_unsubscribe.return_value = True

            result = await event_handlers.on_unsubscribe("test_sid", unsubscribe_data)

            assert result is True
            mock_unsubscribe.assert_called_once_with(
                "test_sid",
                "task_progress"
            )

    @pytest.mark.asyncio
    async def test_event_handler_with_no_connection_info(self, event_handlers, mock_socket):
        """Test event handler when connection info is not available."""
        with patch.object(event_handlers.websocket_manager, "get_connection_info") as mock_get_info:
            mock_get_info.return_value = None

            result = await event_handlers.on_task_request("test_sid", {"task_id": "123"})

            assert result is False

    @pytest.mark.asyncio
    async def test_event_handler_with_validation_error(self, event_handlers, mock_socket):
        """Test event handler with validation error."""
        with patch.object(event_handlers.websocket_manager, "get_connection_info") as mock_get_info:
            mock_get_info.return_value = ConnectionInfo(
                sid="test_sid",
                user_id="test_user",
                connected_at=datetime.utcnow(),
                last_heartbeat=datetime.utcnow(),
                auth_token="test_token",
                metadata={"role": "agent"},
                socket=mock_socket
            )

            # Test with invalid data that should trigger validation error
            result = await event_handlers.on_task_request("test_sid", {})

            assert result is False


class TestSocketIOEventHandlersErrorHandling:
    """Test error handling in SocketIOEventHandlers."""

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
    def event_handlers(self, websocket_manager):
        """Create SocketIOEventHandlers instance for testing."""
        return SocketIOEventHandlers(websocket_manager)

    @pytest.fixture
    def mock_socket(self):
        """Create mock socket for testing."""
        socket = Mock()
        socket.sid = "test_sid"
        socket.request = Mock()
        socket.request.headers = {"authorization": "Bearer test_token"}
        socket.request.sid = "test_sid"
        socket.emit = AsyncMock()
        socket.disconnect = AsyncMock()
        return socket

    @pytest.mark.asyncio
    async def test_event_handler_with_exception(self, event_handlers, mock_socket):
        """Test handling exceptions in event handlers."""
        with patch.object(event_handlers.websocket_manager, "get_connection_info") as mock_get_info:
            mock_get_info.side_effect = Exception("Database error")

            result = await event_handlers.on_task_request("test_sid", {"task_id": "123"})

            assert result is False

    @pytest.mark.asyncio
    async def test_publish_event_with_exception(self, event_handlers, mock_socket):
        """Test handling exceptions during event publishing."""
        with patch.object(event_handlers.websocket_manager, "get_connection_info") as mock_get_info:
            mock_get_info.return_value = ConnectionInfo(
                sid="test_sid",
                user_id="test_user",
                connected_at=datetime.utcnow(),
                last_heartbeat=datetime.utcnow(),
                auth_token="test_token",
                metadata={"role": "agent"},
                socket=mock_socket
            )

            with patch.object(event_handlers.websocket_manager, "publish_event", new_callable=AsyncMock) as mock_publish:
                mock_publish.side_effect = Exception("Publish error")

                result = await event_handlers.on_task_progress("test_sid", {
                    "task_id": "123",
                    "progress": 50
                })

                assert result is True  # Should not fail due to publish error

    @pytest.mark.asyncio
    async def test_heartbeat_with_exception(self, event_handlers, mock_socket):
        """Test handling exceptions during heartbeat."""
        with patch.object(event_handlers.websocket_manager, "update_heartbeat", new_callable=AsyncMock) as mock_update:
            mock_update.side_effect = Exception("Heartbeat error")

            result = await event_handlers.on_heartbeat("test_sid", {})

            assert result is False
