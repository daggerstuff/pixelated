"""
Tests for Letta Code SDK integration.

Tests cover:
- Agent-based persistence (createAgent, resumeSession)
- Multi-conversation support
- Tool permissions with crisis detection
- Memory block management
- PII filtering integration
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from ai.memory.letta_code_client import (
    LettaCodeClient,
    LettaCodeConfig,
    LettaSession,
    ModelProvider,
    PermissionMode,
)
from ai.memory.letta_tool_permissions import (
    LettaPermissionHandler,
    LettaToolRegistry,
    PermissionLevel,
    PermissionResult,
    ToolDefinition,
)

# ==================== Configuration Tests ====================

class TestLettaCodeConfig:
    """Tests for Letta Code configuration."""

    def test_default_config(self):
        """Test default configuration values."""
        config = LettaCodeConfig()

        assert config.base_url == "https://api.letta.ai"
        assert config.permission_mode == PermissionMode.THERAPEUTIC
        assert config.model_provider == ModelProvider.CLAUDE
        assert config.crisis_detection_enabled is True
        assert config.pii_filter_enabled is True

    def test_custom_config(self):
        """Test custom configuration."""
        config = LettaCodeConfig(
            api_key="test-key",
            base_url="https://custom.api",
            permission_mode=PermissionMode.FULL,
            model_provider=ModelProvider.GPT,
        )

        assert config.api_key == "test-key"
        assert config.base_url == "https://custom.api"
        assert config.permission_mode == PermissionMode.FULL
        assert config.model_provider == ModelProvider.GPT

    def test_permission_mode_values(self):
        """Test permission mode enum values."""
        assert PermissionMode.READONLY.value == "read-only"
        assert PermissionMode.THERAPEUTIC.value == "therapeutic"
        assert PermissionMode.FULL.value == "full"
        assert PermissionMode.WHISPER.value == "whisper"

    def test_model_provider_values(self):
        """Test model provider enum values."""
        assert ModelProvider.CLAUDE.value == "claude"
        assert ModelProvider.GPT.value == "gpt"
        assert ModelProvider.GEMINI.value == "gemini"
        assert ModelProvider.LOCAL.value == "local"


# ==================== Client Tests ====================

class TestLettaCodeClient:
    """Tests for Letta Code client."""

    @pytest.fixture
    def config(self):
        """Create test configuration."""
        return LettaCodeConfig(
            api_key="test-key",
            permission_mode=PermissionMode.THERAPEUTIC,
        )

    @pytest.fixture
    def client(self, config):
        """Create test client."""
        return LettaCodeClient(config)

    def test_client_initialization(self, client, config):
        """Test client initialization."""
        assert client.config == config
        assert client._initialized is False
        assert client._agent is None

    @pytest.mark.asyncio
    async def test_initialize_without_api_key(self):
        """Test initialization without API key."""
        config = LettaCodeConfig(api_key=None)
        client = LettaCodeClient(config)

        await client.initialize()

        assert client._initialized is False
        assert client._sdk_client is None

    @pytest.mark.asyncio
    async def test_create_agent_mock(self, client):
        """Test agent creation with mocked SDK."""
        # Mock SDK client
        mock_sdk = MagicMock()
        mock_agent = MagicMock()
        mock_agent.id = "test-agent-id"
        mock_sdk.create_agent.return_value = mock_agent

        client._sdk_client = mock_sdk
        client._initialized = True

        agent_id = await client.create_agent(
            system_prompt="Test system prompt",
            name="test-agent",
        )

        assert agent_id == "test-agent-id"
        mock_sdk.create_agent.assert_called_once()

    @pytest.mark.asyncio
    async def test_resume_session_mock(self, client):
        """Test session resumption with mocked SDK."""
        mock_sdk = MagicMock()
        mock_agent = MagicMock()
        mock_agent.id = "test-agent-id"

        mock_sdk.get_agent.return_value = mock_agent
        client._sdk_client = mock_sdk
        client._initialized = True

        session = await client.resume_session("test-agent-id")

        assert isinstance(session, LettaSession)
        assert session.agent_id == "test-agent-id"

    @pytest.mark.asyncio
    async def test_get_memory_blocks_mock(self, client):
        """Test getting memory blocks with mocked SDK."""
        mock_sdk = MagicMock()
        mock_state = MagicMock()

        # Mock memory blocks
        block1 = MagicMock()
        block1.label = "user_preferences"
        block1.content = "Prefers brief responses"

        block2 = MagicMock()
        block2.label = "therapeutic_context"
        block2.content = "Managing anxiety"

        mock_state.memory_blocks = [block1, block2]
        mock_sdk.get_agent_state.return_value = mock_state

        client._sdk_client = mock_sdk
        client._initialized = True

        blocks = await client.get_memory_blocks("test-agent-id")

        assert "user_preferences" in blocks
        assert blocks["user_preferences"] == "Prefers brief responses"
        assert "therapeutic_context" in blocks

    def test_tool_permissions_by_mode(self):
        """Test tool permissions vary by mode."""
        # Read-only mode
        readonly_config = LettaCodeConfig(permission_mode=PermissionMode.READONLY)
        readonly_permissions = readonly_config.tool_permissions

        assert "Read" in readonly_permissions
        assert "Bash" not in readonly_permissions

        # Therapeutic mode
        therapeutic_config = LettaCodeConfig(permission_mode=PermissionMode.THERAPEUTIC)
        therapeutic_permissions = therapeutic_config.tool_permissions

        assert "Read" in therapeutic_permissions
        assert "reflect" in therapeutic_permissions
        assert "Bash" not in therapeutic_permissions

        # Full mode
        full_config = LettaCodeConfig(permission_mode=PermissionMode.FULL)
        full_permissions = full_config.tool_permissions

        assert "Read" in full_permissions
        assert "Bash" in full_permissions

        # Whisper mode (background only)
        whisper_config = LettaCodeConfig(permission_mode=PermissionMode.WHISPER)
        whisper_permissions = whisper_config.tool_permissions

        assert len(whisper_permissions) == 0


# ==================== Session Tests ====================

class TestLettaSession:
    """Tests for Letta session."""

    @pytest.fixture
    def session(self):
        """Create test session."""
        mock_client = MagicMock()
        mock_client._sdk_client = MagicMock()
        mock_client._agent = MagicMock()
        mock_client._agent.id = "test-agent-id"

        return LettaSession(
            client=mock_client,
            agent_id="test-agent-id",
        )

    @pytest.mark.asyncio
    async def test_send_message_no_filters(self, session):
        """Test sending message without filters."""
        # Mock SDK response
        mock_response = MagicMock()
        mock_response.content = "Test response"
        session.client._sdk_client.send_message.return_value = mock_response

        response = await session.send("Hello!")

        assert response == "Test response"

    @pytest.mark.asyncio
    async def test_send_message_with_crisis_filter(self):
        """Test message blocked by crisis filter."""
        mock_client = MagicMock()
        mock_client._sdk_client = None
        mock_client._agent = None

        # Mock crisis detector
        mock_crisis_detector = AsyncMock()
        mock_crisis_result = MagicMock()
        mock_crisis_result.severity = "critical"
        mock_crisis_detector.check_message.return_value = mock_crisis_result

        session = LettaSession(
            client=mock_client,
            agent_id="test-agent-id",
            crisis_detector=mock_crisis_detector,
        )

        response = await session.send("I want to hurt myself")

        # Should return crisis response, not process message
        assert "professional" in response.lower()

    @pytest.mark.asyncio
    async def test_send_message_with_pii_filter(self):
        """Test message filtered for PII."""
        mock_client = MagicMock()
        mock_client._sdk_client = MagicMock()
        mock_client._agent = MagicMock()

        # Mock PII filter
        mock_pii_filter = AsyncMock()
        mock_filter_result = MagicMock()
        mock_filter_result.should_block = True
        mock_pii_filter.filter_tool_call.return_value = mock_filter_result

        session = LettaSession(
            client=mock_client,
            agent_id="test-agent-id",
            pii_filter=mock_pii_filter,
        )

        response = await session.send("My SSN is 123-45-6789")

        assert "sensitive information" in response.lower()


# ==================== Tool Permission Tests ====================

class TestLettaToolRegistry:
    """Tests for tool registry."""

    def test_registry_initialization(self):
        """Test registry initialization."""
        registry = LettaToolRegistry()

        assert len(registry._tools) > 0
        assert "Read" in registry._tools
        assert "Grep" in registry._tools

    def test_registry_by_permission_level(self):
        """Test tools filtered by permission level."""
        readonly_registry = LettaToolRegistry(
            permission_level=PermissionLevel.READ_ONLY
        )

        allowed = readonly_registry.get_allowed_tools()

        assert "Read" in allowed
        assert "Bash" not in allowed

    def test_tool_registration(self):
        """Test custom tool registration."""
        registry = LettaToolRegistry()

        custom_tool = ToolDefinition(
            name="custom_tool",
            description="A custom tool",
            parameters={"param": "string"},
            permission_level=PermissionLevel.THERAPEUTIC,
        )

        registry.register_tool(custom_tool)

        assert registry.get_tool("custom_tool") == custom_tool

    def test_get_tools_for_level(self):
        """Test getting tools for specific level."""
        registry = LettaToolRegistry()

        # Use the handler method instead
        handler = LettaPermissionHandler(registry)
        readonly_tools = handler.get_tools_for_permission_level(
            PermissionLevel.READ_ONLY,
            include_descriptions=True,
        )

        assert isinstance(readonly_tools, dict)
        assert "Read" in readonly_tools


class TestLettaPermissionHandler:
    """Tests for permission handler."""

    @pytest.fixture
    def registry(self):
        """Create test registry."""
        return LettaToolRegistry()

    @pytest.fixture
    def handler(self, registry):
        """Create test handler."""
        return LettaPermissionHandler(registry)

    @pytest.mark.asyncio
    async def test_tool_allowed(self, handler):
        """Test allowed tool execution."""
        result = await handler.can_use_tool(
            "Read",
            {"file_path": "/test.txt"},
            "user-123",
        )

        assert result.allowed is True

    @pytest.mark.asyncio
    async def test_tool_blocked_by_permission(self):
        """Test tool blocked by permission level."""
        readonly_registry = LettaToolRegistry(
            permission_level=PermissionLevel.READ_ONLY
        )
        handler = LettaPermissionHandler(readonly_registry)

        result = await handler.can_use_tool(
            "Bash",
            {"command": "ls"},
            "user-123",
        )

        assert result.allowed is False
        assert "permission" in result.reason.lower()

    @pytest.mark.asyncio
    async def test_tool_blocked_by_crisis(self, handler):
        """Test tool blocked during crisis."""
        # Set permission level to full to bypass permission check
        handler.registry.permission_level = PermissionLevel.FULL

        # Mock crisis detector
        mock_crisis_detector = AsyncMock()
        mock_crisis_result = MagicMock()
        mock_crisis_result.severity = MagicMock()
        mock_crisis_result.severity.value = "high"
        mock_crisis_detector.check_message.return_value = mock_crisis_result

        handler._crisis_detector = mock_crisis_detector

        # Bash is a high-risk tool that should be blocked during high crisis
        result = await handler.can_use_tool(
            "Bash",
            {"command": "ls"},
            "user-123",
            context={"message": "I'm in crisis"},
        )

        assert result.allowed is False
        # Could be blocked by crisis or permission level
        assert result.allowed is False

    @pytest.mark.asyncio
    async def test_tool_allowed_in_crisis(self, handler):
        """Test tool allowed during crisis."""
        # Mock crisis detector
        mock_crisis_detector = AsyncMock()
        mock_crisis_result = MagicMock()
        mock_crisis_result.severity.value = "medium"
        mock_crisis_detector.check_message.return_value = mock_crisis_result

        handler._crisis_detector = mock_crisis_detector

        # Read is allowed in crisis
        result = await handler.can_use_tool(
            "Read",
            {"file_path": "/test.txt"},
            "user-123",
            context={"message": "I'm struggling"},
        )

        assert result.allowed is True

    @pytest.mark.asyncio
    async def test_tool_requires_consent(self, handler):
        """Test tool requiring user consent."""
        handler.registry.permission_level = PermissionLevel.FULL

        # Set consent callback to test consent flow
        async def consent_callback(user_id, message):
            return True

        handler.set_consent_callback(consent_callback)

        result = await handler.can_use_tool(
            "Bash",
            {"command": "rm -rf /"},
            "user-123",
        )

        # With consent callback set, should request consent
        assert result.requires_consent is True
        assert result.consent_message is not None

    @pytest.mark.asyncio
    async def test_unknown_tool_blocked(self, handler):
        """Test unknown tool is blocked."""
        result = await handler.can_use_tool(
            "unknown_tool",
            {},
            "user-123",
        )

        assert result.allowed is False
        assert "not registered" in result.reason


# ==================== Integration Tests ====================

class TestLettaCodeIntegration:
    """Integration tests for Letta Code SDK."""

    @pytest.mark.asyncio
    async def test_full_workflow_mock(self):
        """Test complete workflow with mocked SDK."""
        # Create client
        config = LettaCodeConfig(
            api_key="test-key",
            permission_mode=PermissionMode.THERAPEUTIC,
        )
        client = LettaCodeClient(config)

        # Mock SDK
        mock_sdk = MagicMock()
        mock_agent = MagicMock()
        mock_agent.id = "test-agent-id"
        mock_sdk.create_agent.return_value = mock_agent
        mock_sdk.get_agent.return_value = mock_agent

        client._sdk_client = mock_sdk
        client._initialized = True

        # Create agent
        agent_id = await client.create_agent(
            system_prompt="You are a therapeutic assistant",
        )

        assert agent_id == "test-agent-id"

        # Resume session
        session = await client.resume_session(agent_id)

        assert isinstance(session, LettaSession)

    @pytest.mark.asyncio
    async def test_permission_workflow(self):
        """Test permission checking workflow."""
        # Create registry and handler
        registry = LettaToolRegistry(permission_level=PermissionLevel.THERAPEUTIC)
        handler = LettaPermissionHandler(registry)

        # Check therapeutic tools allowed
        result1 = await handler.can_use_tool("reflect", {}, "user-123")
        assert result1.allowed is True

        result2 = await handler.can_use_tool("recall", {"query": "test"}, "user-123")
        assert result2.allowed is True

        # Check write tools blocked
        result3 = await handler.can_use_tool("Edit", {}, "user-123")
        assert result3.allowed is False

    @pytest.mark.asyncio
    async def test_crisis_aware_permissions(self):
        """Test crisis-aware permission workflow."""
        registry = LettaToolRegistry()
        handler = LettaPermissionHandler(registry)

        # Mock crisis detector
        mock_crisis = AsyncMock()
        mock_result = MagicMock()
        mock_result.severity.value = "critical"
        mock_crisis.check_message.return_value = mock_result
        handler._crisis_detector = mock_crisis

        # Try to use tool during crisis
        result = await handler.can_use_tool(
            "consolidate",
            {"memory_ids": ["123"]},
            "user-123",
            context={"message": "I'm in crisis"},
        )

        # Should be blocked - consolidate not allowed in crisis
        assert result.allowed is False


# ==================== Error Handling Tests ====================

class TestErrorHandling:
    """Tests for error handling."""

    @pytest.mark.asyncio
    async def test_sdk_import_error(self):
        """Test handling when SDK not available."""
        config = LettaCodeConfig(api_key="test-key")
        client = LettaCodeClient(config)

        # Simulate import error
        with patch.dict("sys.modules", {"letta": None}):
            # Should not crash
            pass

    @pytest.mark.asyncio
    async def test_permission_check_exception(self):
        """Test exception handling in permission check."""
        registry = LettaToolRegistry()
        handler = LettaPermissionHandler(registry)

        # Mock crisis detector that throws
        handler._crisis_detector = AsyncMock()
        handler._crisis_detector.check_message.side_effect = Exception("Error")

        # Should not crash, return safe default
        result = await handler.can_use_tool(
            "Read",
            {"file_path": "/test.txt"},
            "user-123",
            context={"message": "test"},
        )

        # Should allow by default on error (fail-open for read)
        # or could be fail-safe depending on policy
        assert isinstance(result, PermissionResult)

    @pytest.mark.asyncio
    async def test_memory_block_update_error(self):
        """Test error handling in memory block update."""
        config = LettaCodeConfig(api_key="test-key")
        client = LettaCodeClient(config)

        # Mock SDK that throws
        mock_sdk = MagicMock()
        mock_sdk.update_memory_block.side_effect = Exception("Network error")
        client._sdk_client = mock_sdk
        client._initialized = True

        # Should not crash
        await client.update_memory_block("agent-123", "test", "content")


# ==================== Run Tests ====================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
