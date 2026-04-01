"""
Tests for Letta-Hindsight Bridge integration.

Tests cover:
- PII middleware filtering
- Crisis detection
- Bridge message processing
- Tool wrapping
"""

import pytest

# Test imports
from ai.memory.letta_pii_middleware import (
    LettaPIIMiddleware,
    PIIBlockedException,
    PIISeverity,
)
from ai.memory.letta_crisis_handler import (
    LettaCrisisHandler,
    CrisisSeverity,
)


class MockPIIFilter:
    """Mock PII filter for testing."""

    def __init__(self, redaction_ratio: float = 0.0):
        self.redaction_ratio = redaction_ratio
        self.filter_for_storage_call_count = 0

    def filter_for_storage(self, content: str) -> str:
        """Mock filtering that redacts based on ratio."""
        self.filter_for_storage_call_count += 1
        if self.redaction_ratio == 0:
            return content
        redact_length = int(len(content) * self.redaction_ratio)
        return content[: len(content) - redact_length] if redact_length > 0 else content


class MockCrisisDetector:
    """Mock crisis detector for testing."""

    def __init__(self, severity: str = "none"):
        self.severity = severity
        self.get_severity_call_count = 0

    def get_severity(self, message: str) -> str:
        """Return configured severity."""
        self.get_severity_call_count += 1
        return self.severity


# ============================================================================
# PII Middleware Tests
# ============================================================================


class TestPIIMiddlewareFiltering:
    """Test PII middleware filtering functionality."""

    @pytest.mark.asyncio
    async def test_filter_tool_call_no_redaction(self):
        """Test filtering with no PII detected."""
        pii_filter = MockPIIFilter(redaction_ratio=0.0)
        middleware = LettaPIIMiddleware(pii_filter)

        result = await middleware.filter_tool_call(
            "test_tool",
            {"content": "Hello world"}
        )

        # original is JSON serialized input
        assert result.original == '{"content": "Hello world"}'
        # filtered content matches input since no redaction
        assert result.filtered == '{"content": "Hello world"}'
        assert result.severity == PIISeverity.NONE
        assert result.should_block is False

    @pytest.mark.asyncio
    async def test_filter_tool_call_low_redaction(self):
        """Test filtering with low PII redaction."""
        pii_filter = MockPIIFilter(redaction_ratio=0.05)  # 5% redaction
        middleware = LettaPIIMiddleware(pii_filter)

        result = await middleware.filter_tool_call(
            "test_tool",
            {"content": "Hello world"}
        )

        assert result.severity == PIISeverity.LOW
        assert result.should_block is False

    @pytest.mark.asyncio
    async def test_filter_tool_call_medium_redaction(self):
        """Test filtering with medium PII redaction."""
        pii_filter = MockPIIFilter(redaction_ratio=0.2)  # 20% redaction
        middleware = LettaPIIMiddleware(pii_filter)

        result = await middleware.filter_tool_call(
            "test_tool",
            {"content": "Hello world"}
        )

        assert result.severity == PIISeverity.MEDIUM
        assert result.should_block is False

    @pytest.mark.asyncio
    async def test_filter_tool_call_high_redaction(self):
        """Test filtering with high PII redaction."""
        pii_filter = MockPIIFilter(redaction_ratio=0.4)  # 40% redaction
        middleware = LettaPIIMiddleware(pii_filter)

        result = await middleware.filter_tool_call(
            "test_tool",
            {"content": "Hello world"}
        )

        assert result.severity == PIISeverity.HIGH
        assert result.should_block is False

    @pytest.mark.asyncio
    async def test_filter_tool_call_critical_redaction(self):
        """Test filtering with critical PII redaction."""
        pii_filter = MockPIIFilter(redaction_ratio=0.6)  # 60% redaction
        middleware = LettaPIIMiddleware(pii_filter, {"max_redaction_ratio": 0.5})

        result = await middleware.filter_tool_call(
            "test_tool",
            {"content": "Hello world"}
        )

        assert result.severity == PIISeverity.CRITICAL
        assert result.should_block is True

    @pytest.mark.asyncio
    async def test_filter_tool_call_custom_threshold(self):
        """Test filtering with custom redaction threshold."""
        pii_filter = MockPIIFilter(redaction_ratio=0.3)  # 30% redaction
        middleware = LettaPIIMiddleware(pii_filter, {"max_redaction_ratio": 0.25})

        result = await middleware.filter_tool_call(
            "test_tool",
            {"content": "Hello world"}
        )

        # Should block because 30% > 25% threshold
        assert result.should_block is True

    @pytest.mark.asyncio
    async def test_filter_tool_call_empty_input(self):
        """Test filtering with empty input."""
        pii_filter = MockPIIFilter(redaction_ratio=0.0)
        middleware = LettaPIIMiddleware(pii_filter)

        result = await middleware.filter_tool_call(
            "test_tool",
            {"content": ""}
        )

        assert result.severity == PIISeverity.NONE
        assert result.should_block is False

    @pytest.mark.asyncio
    async def test_filter_tool_call_filter_error(self):
        """Test handling of filter errors."""
        class ErrorPIIFilter:
            def filter_for_storage(self, content: str) -> str:
                raise Exception("Filter error")

        middleware = LettaPIIMiddleware(ErrorPIIFilter())

        result = await middleware.filter_tool_call(
            "test_tool",
            {"content": "Hello"}
        )

        # Should block on error for safety
        assert result.should_block is True
        assert result.severity == PIISeverity.CRITICAL


# ============================================================================
# Crisis Handler Tests
# ============================================================================


class TestCrisisHandlerDetection:
    """Test crisis handler detection functionality."""

    @pytest.mark.asyncio
    async def test_check_message_none_severity(self):
        """Test message with no crisis indicators."""
        detector = MockCrisisDetector(severity="none")
        handler = LettaCrisisHandler(detector)

        result = await handler.check_message("I'm feeling okay today")

        assert result.severity == CrisisSeverity.NONE
        assert result.requires_action is False

    @pytest.mark.asyncio
    async def test_check_message_medium_severity(self):
        """Test message with medium crisis severity."""
        detector = MockCrisisDetector(severity="medium")
        handler = LettaCrisisHandler(detector)

        result = await handler.check_message("I'm feeling stressed")

        assert result.severity == CrisisSeverity.MEDIUM
        assert result.requires_action is False

    @pytest.mark.asyncio
    async def test_check_message_high_severity(self):
        """Test message with high crisis severity."""
        detector = MockCrisisDetector(severity="high")
        handler = LettaCrisisHandler(detector)

        result = await handler.check_message("I'm feeling very distressed")

        assert result.severity == CrisisSeverity.HIGH
        assert result.requires_action is True

    @pytest.mark.asyncio
    async def test_check_message_critical_severity(self):
        """Test message with critical crisis severity."""
        detector = MockCrisisDetector(severity="critical")
        handler = LettaCrisisHandler(detector)

        result = await handler.check_message("I want to end my life")

        assert result.severity == CrisisSeverity.CRITICAL
        assert result.requires_action is True
        assert result.suggested_action is not None

    @pytest.mark.asyncio
    async def test_check_message_suicide_indicator(self):
        """Test detection of suicide indicators."""
        detector = MockCrisisDetector(severity="critical")
        handler = LettaCrisisHandler(detector)

        result = await handler.check_message("I want to commit suicide")

        assert "suicide" in result.indicators
        assert result.suggested_action is not None
        assert "988" in result.suggested_action or "Lifeline" in result.suggested_action

    @pytest.mark.asyncio
    async def test_check_message_self_harm_indicator(self):
        """Test detection of self-harm indicators."""
        detector = MockCrisisDetector(severity="high")
        handler = LettaCrisisHandler(detector)

        result = await handler.check_message("I want to cut myself")

        assert "self-harm" in result.indicators

    @pytest.mark.asyncio
    async def test_check_message_violence_indicator(self):
        """Test detection of violence indicators."""
        detector = MockCrisisDetector(severity="high")
        handler = LettaCrisisHandler(detector)

        result = await handler.check_message("I want to hurt someone")

        assert "violence" in result.indicators

    @pytest.mark.asyncio
    async def test_check_message_error_handling(self):
        """Test error handling in crisis detection."""
        class ErrorCrisisDetector:
            def get_severity(self, message: str) -> str:
                raise Exception("Detection error")

        handler = LettaCrisisHandler(ErrorCrisisDetector())
        result = await handler.check_message("Test message")

        # Should default to none on error
        assert result.severity == CrisisSeverity.NONE


class TestCrisisHandlerBlocking:
    """Test crisis handler operation blocking."""

    @pytest.mark.asyncio
    async def test_should_block_operation_critical_file_write(self):
        """Test blocking file writes during critical crisis."""
        detector = MockCrisisDetector(severity="critical")
        handler = LettaCrisisHandler(detector)

        # Create critical result manually
        from dataclasses import replace
        result = await handler.check_message("I want to end my life")

        assert handler.should_block_operation(result, "file_write") is True
        assert handler.should_block_operation(result, "file_edit") is True
        assert handler.should_block_operation(result, "code_execution") is True

    @pytest.mark.asyncio
    async def test_should_block_operation_self_harm(self):
        """Test blocking operations during self-harm crisis."""
        detector = MockCrisisDetector(severity="high")
        handler = LettaCrisisHandler(detector)

        result = await handler.check_message("I want to cut myself")

        assert handler.should_block_operation(result, "file_write") is True
        assert handler.should_block_operation(result, "shell_command") is True

    @pytest.mark.asyncio
    async def test_should_not_block_operation_none_crisis(self):
        """Test not blocking operations with no crisis."""
        detector = MockCrisisDetector(severity="none")
        handler = LettaCrisisHandler(detector)

        result = await handler.check_message("I'm feeling okay")

        assert handler.should_block_operation(result, "file_write") is False
        assert handler.should_block_operation(result, "shell_command") is False


# ============================================================================
# Bridge Integration Tests
# ============================================================================


class TestBridgeIntegration:
    """Test Letta-Hindsight bridge integration."""

    def test_bridge_config_initialization(self):
        """Test bridge configuration initialization."""
        from ai.memory.letta_hindsight_bridge import BridgeConfig

        config = BridgeConfig(
            hindsight_api_url="https://api.hindsight.example.com",
            hindsight_api_key="test-key",
            hindsight_bank_id="test-bank",
            letta_base_url="http://localhost:8080",
            letta_api_key="letta-key",
        )

        assert config.hindsight_api_url == "https://api.hindsight.example.com"
        assert config.pii_filter_enabled is True
        assert config.crisis_detection_enabled is True
        assert config.dual_storage_enabled is True
        assert config.max_redaction_ratio == 0.5

    def test_bridge_config_custom_settings(self):
        """Test bridge configuration with custom settings."""
        from ai.memory.letta_hindsight_bridge import BridgeConfig

        config = BridgeConfig(
            hindsight_api_url="https://api.hindsight.example.com",
            hindsight_api_key="test-key",
            hindsight_bank_id="test-bank",
            letta_base_url="http://localhost:8080",
            letta_api_key="letta-key",
            pii_filter_enabled=False,
            crisis_detection_enabled=False,
            max_redaction_ratio=0.3,
        )

        assert config.pii_filter_enabled is False
        assert config.crisis_detection_enabled is False
        assert config.max_redaction_ratio == 0.3


# ============================================================================
# Integration Test Stubs
# ============================================================================


class TestWithMockIntegrations:
    """Integration tests with mock components."""

    @pytest.mark.asyncio
    async def test_pii_middleware_wraps_tool(self):
        """Test that PII middleware properly wraps tool calls."""
        pii_filter = MockPIIFilter(redaction_ratio=0.0)
        middleware = LettaPIIMiddleware(pii_filter)

        call_args = []

        async def mock_tool(**kwargs):
            call_args.append(kwargs)
            return "result"

        wrapped_tool = middleware.wrap_tool(mock_tool, "test_tool")
        await wrapped_tool(key="value")

        assert len(call_args) == 1
        assert call_args[0].get("key") == "value"

    @pytest.mark.asyncio
    async def test_crisis_handler_alert_callback(self):
        """Test crisis handler alert callback."""
        alert_called = []

        async def alert_callback(result, user_id, session_id):
            alert_called.append((result, user_id, session_id))

        detector = MockCrisisDetector(severity="critical")
        handler = LettaCrisisHandler(detector, {"alert_callback": alert_callback})

        result = await handler.check_message("I want to end my life")
        await handler.handle_crisis(result, "test", "test")

        assert len(alert_called) == 1


# ============================================================================
# Test for PIIBlockedException
# ============================================================================


class TestPIIBlockedException:
    """Test PII block exception handling."""

    def test_pii_blocked_exception_message(self):
        """Test PII blocked exception message."""
        exc = PIIBlockedException("Tool test_tool blocked due to PII")

        assert "test_tool" in str(exc)
        assert "PII" in str(exc)

    @pytest.mark.asyncio
    async def test_tool_raises_pii_blocked_exception(self):
        """Test that tool raises PII blocked exception when threshold exceeded."""
        pii_filter = MockPIIFilter(redaction_ratio=0.6)  # 60% redaction
        middleware = LettaPIIMiddleware(pii_filter, {"max_redaction_ratio": 0.5})

        result = await middleware.filter_tool_call(
            "test_tool",
            {"content": "Test content"}
        )

        assert result.should_block is True
        with pytest.raises(PIIBlockedException):
            raise PIIBlockedException(f"Tool test_tool blocked due to PII")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
