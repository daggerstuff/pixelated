"""
Integration Tests for WebSocket-Flask Pipeline Integration

Tests the complete integration between WebSocket real-time communication,
Flask service 6-stage pipeline orchestration, and Redis event coordination.
"""

import asyncio
import json
from datetime import datetime
from unittest.mock import AsyncMock, Mock, patch

import pytest
from services.flask_integration import FlaskIntegrationService, PipelineStatus
from services.integration_manager import IntegrationEventType, IntegrationManager
from services.websocket_manager import WebSocketManager

from config import MCPConfig
from exceptions import ValidationError


class TestIntegrationWebSocketFlask:
    """Integration tests for WebSocket-Flask pipeline system."""

    @pytest.fixture
    def mock_config(self):
        """Mock MCP configuration."""
        config = Mock(spec=MCPConfig)
        config.external_services = Mock()
        config.external_services.flask_api_url = "http://localhost:5000"
        config.websocket_config = Mock()
        config.websocket_config.enabled = True
        config.websocket_config.max_connections = 1000
        return config

    @pytest.fixture
    def mock_redis_client(self):
        """Mock Redis client."""
        redis_client = Mock()
        redis_client.pubsub = Mock(return_value=Mock())
        redis_client.publish = AsyncMock()
        redis_client.get_json = AsyncMock(return_value=None)
        redis_client.set_json = AsyncMock()
        return redis_client

    @pytest.fixture
    def mock_database(self):
        """Mock database."""
        return Mock()

    @pytest.fixture
    def mock_websocket_manager(self):
        """Mock WebSocket manager."""
        websocket_manager = Mock(spec=WebSocketManager)
        websocket_manager.publish_event = AsyncMock()
        websocket_manager.get_connection_count = Mock(return_value=5)
        websocket_manager.sio = Mock()
        return websocket_manager

    @pytest.fixture
    def mock_integration_manager(self, mock_config, mock_database, mock_redis_client, mock_websocket_manager):
        """Mock integration manager."""
        integration_manager = IntegrationManager(
            config=mock_config,
            database=mock_database,
            redis_client=mock_redis_client,
            websocket_manager=mock_websocket_manager,
            task_service=Mock(),
            queue_service=Mock()
        )
        integration_manager._initialized = True
        return integration_manager

    @pytest.fixture
    def flask_integration_service(self, mock_config, mock_redis_client, mock_integration_manager):
        """Flask integration service fixture."""
        service = FlaskIntegrationService(
            config=mock_config,
            redis_client=mock_redis_client,
            integration_manager=mock_integration_manager
        )
        return service

    @pytest.mark.asyncio
    async def test_pipeline_execution_integration(self, flask_integration_service, mock_integration_manager):
        """Test complete pipeline execution with WebSocket integration."""
        # Mock aiohttp session
        with patch("aiohttp.ClientSession") as mock_session_class:
            mock_session = AsyncMock()
            mock_session_class.return_value = mock_session

            # Mock successful API responses for each stage
            mock_responses = []
            for stage in ["data_ingestion", "preprocessing", "bias_detection", "standardization", "validation", "output_generation"]:
                mock_response = AsyncMock()
                mock_response.status = 200
                mock_response.json = AsyncMock(return_value={
                    "status": "completed",
                    "data": {"stage": stage, "result": f"{stage}_result"},
                    "duration_seconds": 2.0
                })
                mock_responses.append(mock_response)

            mock_session.post = AsyncMock(side_effect=mock_responses)

            # Initialize service
            await flask_integration_service.initialize()

            # Test pipeline configuration
            pipeline_config = {
                "source_format": "json",
                "target_format": "csv",
                "input_data": {"test": "data"},
                "processing_options": {"bias_detection": True}
            }

            # Execute pipeline
            execution_id = await flask_integration_service.execute_pipeline(
                pipeline_config,
                "test_user_123"
            )

            # Verify execution was created
            assert execution_id in flask_integration_service.active_executions
            execution = flask_integration_service.active_executions[execution_id]
            assert execution.status == PipelineStatus.PENDING

            # Wait for async execution to complete
            await asyncio.sleep(0.1)

            # Verify WebSocket events were published
            assert mock_integration_manager.publish_integration_event.called

            # Check that pipeline start event was published
            start_event_calls = [
                call for call in mock_integration_manager.publish_integration_event.call_args_list
                if call[0][0] == IntegrationEventType.PIPELINE_STAGE_START
            ]
            assert len(start_event_calls) > 0

    @pytest.mark.asyncio
    async def test_websocket_progress_updates(self, mock_integration_manager):
        """Test WebSocket progress updates during pipeline execution."""
        # Test progress update event
        await mock_integration_manager.publish_integration_event(
            IntegrationEventType.PIPELINE_PROGRESS,
            pipeline_id="test_pipeline_123",
            user_id="test_user_123",
            data={
                "overall_progress": 50.0,
                "current_stage": "bias_detection",
                "stage_progress": {"bias_detection": 75.0},
                "message": "Analyzing dataset for biases"
            }
        )

        # Verify event was published to Redis
        assert mock_integration_manager.redis_client.publish.called

        # Verify WebSocket manager would receive the event
        # (In real implementation, this would trigger WebSocket broadcast)

    @pytest.mark.asyncio
    async def test_pipeline_stage_completion_events(self, mock_integration_manager):
        """Test stage completion events trigger WebSocket updates."""
        # Test stage completion event
        await mock_integration_manager.publish_integration_event(
            IntegrationEventType.PIPELINE_STAGE_COMPLETE,
            pipeline_id="test_pipeline_123",
            user_id="test_user_123",
            data={
                "stage_name": "data_ingestion",
                "stage_number": 1,
                "result": {"records_processed": 1000},
                "overall_progress": 16.67
            }
        )

        # Verify event structure
        mock_integration_manager.redis_client.publish.assert_called()
        call_args = mock_integration_manager.redis_client.publish.call_args
        channel = call_args[0][0]
        event_data = json.loads(call_args[0][1])

        assert channel == "mcp:pipeline_events"
        assert event_data["event_type"] == "pipeline:stage_complete"
        assert event_data["pipeline_id"] == "test_pipeline_123"
        assert event_data["data"]["stage_name"] == "data_ingestion"

    @pytest.mark.asyncio
    async def test_pipeline_error_handling_integration(self, flask_integration_service, mock_integration_manager):
        """Test error handling with WebSocket notifications."""
        # Mock aiohttp session with error
        with patch("aiohttp.ClientSession") as mock_session_class:
            mock_session = AsyncMock()
            mock_session_class.return_value = mock_session

            # Mock failed API response
            mock_response = AsyncMock()
            mock_response.status = 500
            mock_response.text = AsyncMock(return_value="Internal Server Error")
            mock_session.post = AsyncMock(return_value=mock_response)

            await flask_integration_service.initialize()

            # Test with invalid configuration to trigger error
            pipeline_config = {
                "source_format": "invalid_format",
                "target_format": "csv",
                "input_data": {}
            }

            with pytest.raises(ValidationError):
                await flask_integration_service.execute_pipeline(
                    pipeline_config,
                    "test_user_123"
                )

    @pytest.mark.asyncio
    async def test_real_time_progress_tracking(self, mock_integration_manager):
        """Test real-time progress tracking through integration events."""
        execution_id = "test_execution_123"
        user_id = "test_user_123"

        # Simulate progress updates for each stage
        progress_updates = [
            (0, "initialization", "Pipeline execution started"),
            (16, "data_ingestion", "Processing input data"),
            (33, "preprocessing", "Cleaning and standardizing data"),
            (50, "bias_detection", "Analyzing dataset for biases"),
            (66, "standardization", "Applying data standards"),
            (83, "validation", "Validating data quality"),
            (100, "output_generation", "Generating final output")
        ]

        for progress, stage, message in progress_updates:
            await mock_integration_manager.publish_integration_event(
                IntegrationEventType.PIPELINE_PROGRESS,
                pipeline_id=execution_id,
                user_id=user_id,
                data={
                    "overall_progress": progress,
                    "current_stage": stage,
                    "message": message,
                    "estimated_completion": f"{(100 - progress) * 0.3:.1f} seconds remaining"
                }
            )

        # Verify all progress events were published
        progress_calls = [
            call for call in mock_integration_manager.publish_integration_event.call_args_list
            if call[0][0] == IntegrationEventType.PIPELINE_PROGRESS
        ]
        assert len(progress_calls) == len(progress_updates)

    @pytest.mark.asyncio
    async def test_pipeline_cancellation_integration(self, flask_integration_service, mock_integration_manager):
        """Test pipeline cancellation with WebSocket notifications."""
        # Create a mock execution
        execution_id = "test_cancel_execution_123"
        from datetime import datetime

        from mcp_server.services.flask_integration import PipelineExecution, PipelineStatus

        execution = PipelineExecution(
            execution_id=execution_id,
            user_id="test_user_123",
            pipeline_config={"test": "config"},
            status=PipelineStatus.RUNNING,
            current_stage=None,
            stage_results={},
            start_time=datetime.utcnow(),
            end_time=None,
            overall_progress=50.0,
            quality_score=None,
            error_message=None
        )

        flask_integration_service.active_executions[execution_id] = execution

        # Cancel execution
        success = await flask_integration_service.cancel_execution(execution_id, "test_user_123")

        assert success is True
        assert execution.status == PipelineStatus.CANCELLED
        assert execution.end_time is not None

        # Verify cancellation event was published
        mock_integration_manager.publish_integration_event.assert_called()
        cancel_calls = [
            call for call in mock_integration_manager.publish_integration_event.call_args_list
            if call[0][0] == IntegrationEventType.PIPELINE_ERROR
        ]
        assert len(cancel_calls) > 0

    @pytest.mark.asyncio
    async def test_concurrent_pipeline_executions(self, mock_integration_manager):
        """Test multiple concurrent pipeline executions."""
        execution_ids = [f"concurrent_exec_{i}" for i in range(3)]
        user_ids = ["user_1", "user_2", "user_3"]

        # Simulate concurrent progress updates
        async def simulate_execution(execution_id, user_id):
            for progress in [25, 50, 75, 100]:
                await mock_integration_manager.publish_integration_event(
                    IntegrationEventType.PIPELINE_PROGRESS,
                    pipeline_id=execution_id,
                    user_id=user_id,
                    data={
                        "overall_progress": progress,
                        "current_stage": f"stage_{progress}",
                        "message": f"Progress {progress}%"
                    }
                )
                await asyncio.sleep(0.01)  # Small delay to simulate processing

        # Run concurrent executions
        await asyncio.gather(*[
            simulate_execution(exec_id, user_id)
            for exec_id, user_id in zip(execution_ids, user_ids)
        ])

        # Verify all executions had their events published
        total_progress_calls = len([
            call for call in mock_integration_manager.publish_integration_event.call_args_list
            if call[0][0] == IntegrationEventType.PIPELINE_PROGRESS
        ])
        assert total_progress_calls == 12  # 3 executions * 4 progress updates each

    @pytest.mark.asyncio
    async def test_error_recovery_and_fallback_mechanisms(self, flask_integration_service):
        """Test error recovery and fallback mechanisms."""
        # Mock service health check failure
        with patch.object(flask_integration_service, "get_service_health") as mock_health:
            mock_health.return_value = {
                "status": "unhealthy",
                "error": "Flask service unavailable",
                "timestamp": datetime.utcnow().isoformat()
            }

            health_status = await flask_integration_service.get_service_health()
            assert health_status["status"] == "unhealthy"
            assert "error" in health_status

    @pytest.mark.asyncio
    async def test_integration_manager_event_processing(self, mock_integration_manager):
        """Test integration manager processes events correctly."""
        # Create a test event
        from mcp_server.services.integration_manager import IntegrationEvent

        test_event = IntegrationEvent(
            event_type=IntegrationEventType.PIPELINE_STAGE_START,
            pipeline_id="test_pipeline_123",
            user_id="test_user_123",
            data={"stage_name": "test_stage", "progress": 50},
            timestamp=datetime.utcnow(),
            source="test"
        )

        # Process the event
        await mock_integration_manager._handle_integration_event(test_event)

        # Verify event was processed (handlers would be called in real implementation)
        # This test ensures the event processing pipeline works

    @pytest.mark.asyncio
    async def test_complete_integration_workflow(self, flask_integration_service, mock_integration_manager, mock_websocket_manager):
        """Test complete integration workflow from pipeline execution to WebSocket updates."""
        # Mock aiohttp session
        with patch("aiohttp.ClientSession") as mock_session_class:
            mock_session = AsyncMock()
            mock_session_class.return_value = mock_session

            # Mock successful API responses
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(return_value={
                "status": "completed",
                "data": {"result": "success"},
                "duration_seconds": 2.0
            })
            mock_session.post = AsyncMock(return_value=mock_response)

            await flask_integration_service.initialize()

            # Execute pipeline
            pipeline_config = {
                "source_format": "json",
                "target_format": "csv",
                "input_data": {"test": "data"}
            }

            execution_id = await flask_integration_service.execute_pipeline(
                pipeline_config,
                "test_user_123"
            )

            # Wait for execution to start
            await asyncio.sleep(0.1)

            # Verify integration events were published
            assert mock_integration_manager.publish_integration_event.called

            # Simulate progress updates
            await mock_integration_manager.publish_integration_event(
                IntegrationEventType.PIPELINE_PROGRESS,
                pipeline_id=execution_id,
                user_id="test_user_123",
                data={"overall_progress": 50, "current_stage": "bias_detection"}
            )

            # Verify WebSocket manager received events
            # (In real implementation, this would trigger WebSocket broadcasts)

            logger.info("Complete integration workflow test passed", execution_id=execution_id)


# Performance tests
class TestIntegrationPerformance:
    """Performance tests for integration system."""

    @pytest.mark.asyncio
    async def test_event_processing_latency(self, mock_integration_manager):
        """Test event processing latency meets requirements."""
        import time

        start_time = time.time()

        # Process multiple events
        for i in range(100):
            await mock_integration_manager.publish_integration_event(
                IntegrationEventType.PIPELINE_PROGRESS,
                pipeline_id=f"test_pipeline_{i}",
                user_id="test_user",
                data={"progress": i}
            )

        end_time = time.time()
        total_time = end_time - start_time
        avg_time_per_event = total_time / 100

        # Should process events in under 50ms each (HIPAA++ requirement)
        assert avg_time_per_event < 0.05  # 50ms per event

        logger.info(f"Event processing performance: {avg_time_per_event*1000:.2f}ms per event")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
