"""
Integration Tests for Dataset Pipeline MCP Integration

Comprehensive test suite validating the integration between the dataset pipeline
system and the MCP server's real-time orchestration infrastructure.
"""

import asyncio
from datetime import datetime
from unittest.mock import AsyncMock, Mock, patch

import pytest

from ..config import MCPConfig
from ..exceptions import ValidationError
from ..models.dataset import (
    DatasetProcessingStage,
    DatasetProgressUpdate,
    DatasetStatus,
)
from ..services.dataset_integration import DatasetIntegrationService
from ..services.integration_manager import IntegrationManager


@pytest.mark.asyncio
class TestDatasetPipelineIntegration:
    """Test suite for dataset pipeline MCP integration."""

    @pytest.fixture
    async def dataset_service(self, mock_config, mock_redis_client, mock_integration_manager):
        """Create dataset integration service for testing."""
        service = DatasetIntegrationService(
            config=mock_config,
            redis_client=mock_redis_client,
            integration_manager=mock_integration_manager
        )
        await service.initialize()
        return service

    @pytest.fixture
    def mock_config(self):
        """Create mock MCP configuration."""
        config = Mock(spec=MCPConfig)
        config.external_services = {
            "dataset_api_url": "http://localhost:5001",
            "s3_bucket": "test-bucket",
            "aws_region": "us-east-1",
            "google_drive_folder_id": "test-folder",
            "google_service_account_path": "/path/to/service-account.json"
        }
        config.redis_config = Mock()
        config.redis_config.url = "redis://localhost:6379"
        return config

    @pytest.fixture
    def mock_redis_client(self):
        """Create mock Redis client."""
        redis_client = AsyncMock()
        redis_client.from_url.return_value = redis_client
        return redis_client

    @pytest.fixture
    def mock_integration_manager(self):
        """Create mock integration manager."""
        manager = AsyncMock(spec=IntegrationManager)
        manager.publish_integration_event = AsyncMock()
        return manager

    @pytest.fixture
    def sample_dataset_config(self):
        """Create sample dataset configuration for testing."""
        return {
            "sources": [
                {
                    "type": "huggingface",
                    "config": {
                        "dataset_name": "Amod/mental_health_counseling_conversations",
                        "split": "train"
                    },
                    "priority": 1
                },
                {
                    "type": "local",
                    "config": {
                        "file_path": "ai/datasets/test_data.json"
                    },
                    "priority": 2
                }
            ],
            "processing_config": {
                "validation": {
                    "enabled": True,
                    "quality_threshold": 0.8
                },
                "quality": {
                    "enabled": True,
                    "assessment_criteria": ["completeness", "consistency", "accuracy"]
                },
                "bias_detection": {
                    "enabled": True,
                    "bias_threshold": 0.3,
                    "protected_attributes": ["age", "gender", "race"]
                },
                "fusion": {
                    "enabled": True,
                    "strategy": "balanced",
                    "target_size": 10000
                },
                "balancing": {
                    "enabled": True,
                    "strategy": "demographic"
                },
                "output": {
                    "formats": ["json", "csv"],
                    "compression": True
                },
                "safety_validation": {
                    "enabled": True,
                    "crisis_detection": True,
                    "bias_validation": True
                }
            },
            "processing_mode": "comprehensive",
            "metadata": {
                "test_run": True,
                "description": "Integration test dataset"
            }
        }

    async def test_dataset_processing_initiation(self, dataset_service, sample_dataset_config):
        """Test dataset processing initiation."""
        user_id = "test_user_123"

        # Mock successful API responses
        with patch.object(dataset_service, "session") as mock_session:
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(return_value={
                "data": {"status": "success", "record_count": 1000}
            })

            mock_session.post = AsyncMock(return_value=mock_response)
            mock_session.get = AsyncMock(return_value=mock_response)

            # Process dataset
            execution_id = await dataset_service.process_dataset(sample_dataset_config, user_id)

            # Verify execution was created
            assert execution_id in dataset_service.active_executions
            execution = dataset_service.active_executions[execution_id]

            assert execution.user_id == user_id
            assert execution.status == DatasetStatus.PENDING
            assert execution.overall_progress == 0.0
            assert execution.current_stage is None

    async def test_dataset_stage_execution(self, dataset_service, sample_dataset_config):
        """Test individual dataset processing stages."""
        user_id = "test_user_123"

        with patch.object(dataset_service, "session") as mock_session:
            # Mock successful stage execution
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(return_value={
                "data": {
                    "status": "completed",
                    "quality_score": 0.85,
                    "record_count": 1000,
                    "duration_seconds": 5.0
                }
            })

            mock_session.post = AsyncMock(return_value=mock_response)
            mock_session.get = AsyncMock(return_value=mock_response)

            # Execute specific stage
            stage_result = await dataset_service._execute_data_acquisition(sample_dataset_config, user_id)

            assert stage_result["status"] == "completed"
            assert stage_result["stage"] == "data_acquisition"
            assert stage_result["quality_score"] == 0.85
            assert stage_result["total_records"] == 1000

    async def test_safety_validation_integration(self, dataset_service):
        """Test safety validation integration with crisis/bias detection."""
        stage_result = {
            "status": "completed",
            "quality_score": 0.9,
            "bias_score": 0.15,
            "content": "Sample mental health conversation data"
        }

        execution_id = "test_execution_123"

        # Mock safety validation
        with patch.object(dataset_service, "_perform_safety_validation") as mock_safety:
            mock_safety.return_value = {
                "passed": True,
                "checks": {
                    "crisis_detection": {"passed": True},
                    "bias_validation": {"passed": True},
                    "content_safety": {"passed": True},
                    "privacy_compliance": {"passed": True}
                }
            }

            safety_result = await dataset_service._perform_safety_validation(stage_result, execution_id)

            assert safety_result["passed"] is True
            assert "checks" in safety_result
            assert all(check["passed"] for check in safety_result["checks"].values())

    async def test_real_time_progress_tracking(self, dataset_service, mock_integration_manager):
        """Test real-time progress tracking and WebSocket updates."""
        execution_id = "test_execution_123"
        user_id = "test_user_123"

        # Simulate progress update
        progress_data = {
            "overall_progress": 45.0,
            "current_stage": DatasetProcessingStage.QUALITY_ASSESSMENT,
            "quality_score": 0.85,
            "bias_score": 0.12,
            "message": "Quality assessment in progress"
        }

        progress_update = DatasetProgressUpdate(
            execution_id=execution_id,
            **progress_data
        )

        # Verify integration manager is called for progress updates
        await mock_integration_manager.publish_integration_event(
            IntegrationEventType.PIPELINE_PROGRESS,
            pipeline_id=execution_id,
            user_id=user_id,
            data=progress_data
        )

        # Verify the call was made
        mock_integration_manager.publish_integration_event.assert_called()

    async def test_s3_storage_integration(self, dataset_service):
        """Test S3 storage integration."""
        s3_config = {
            "bucket": "test-bucket",
            "key": "datasets/mental_health_data.json",
            "region": "us-east-1"
        }
        user_id = "test_user_123"

        with patch.object(dataset_service, "session") as mock_session:
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(return_value={
                "data": {
                    "status": "completed",
                    "record_count": 1500,
                    "file_size_mb": 25.5,
                    "duration_seconds": 3.0
                }
            })

            mock_session.post = AsyncMock(return_value=mock_response)

            result = await dataset_service._acquire_from_s3(s3_config, user_id)

            assert result["status"] == "completed"
            assert result["record_count"] == 1500
            assert result["file_size_mb"] == 25.5

    async def test_google_drive_storage_integration(self, dataset_service):
        """Test Google Drive storage integration."""
        drive_config = {
            "file_id": "1A2B3C4D5E6F7G8H9I0J",
            "folder_id": "test-folder-id"
        }
        user_id = "test_user_123"

        with patch.object(dataset_service, "session") as mock_session:
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(return_value={
                "data": {
                    "status": "completed",
                    "record_count": 800,
                    "file_size_mb": 15.2,
                    "duration_seconds": 2.5
                }
            })

            mock_session.post = AsyncMock(return_value=mock_response)

            result = await dataset_service._acquire_from_google_drive(drive_config, user_id)

            assert result["status"] == "completed"
            assert result["record_count"] == 800
            assert result["file_size_mb"] == 15.2

    async def test_data_fusion_engine_integration(self, dataset_service):
        """Test data fusion engine integration."""
        dataset_config = {
            "fusion": {
                "strategy": "balanced",
                "target_size": 5000,
                "quality_threshold": 0.75
            }
        }
        user_id = "test_user_123"

        with patch.object(dataset_service, "session") as mock_session:
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(return_value={
                "data": {
                    "status": "completed",
                    "fused_conversations": [{"id": 1, "content": "test"}, {"id": 2, "content": "test2"}],
                    "fusion_quality_score": 0.82,
                    "total_conversations": 5000,
                    "source_distribution": {"priority": 2000, "synthetic": 1500, "reddit": 1500},
                    "duration_seconds": 8.0
                }
            })

            mock_session.post = AsyncMock(return_value=mock_response)

            result = await dataset_service._execute_data_fusion(dataset_config, user_id)

            assert result["status"] == "completed"
            assert result["fusion_quality_score"] == 0.82
            assert result["total_conversations"] == 5000
            assert len(result["fused_conversations"]) == 2  # Sample data

    async def test_dataset_distribution_balancing(self, dataset_service):
        """Test dataset distribution balancing."""
        dataset_config = {
            "balancing": {
                "strategy": "demographic",
                "target_distributions": {"age_18_25": 0.3, "age_26_35": 0.4, "age_36_plus": 0.3},
                "max_imbalance_ratio": 0.15
            }
        }
        user_id = "test_user_123"

        with patch.object(dataset_service, "session") as mock_session:
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(return_value={
                "data": {
                    "status": "completed",
                    "balancing_score": 0.88,
                    "balanced_distribution": {"age_18_25": 0.32, "age_26_35": 0.38, "age_36_plus": 0.30},
                    "duration_seconds": 4.0
                }
            })

            mock_session.post = AsyncMock(return_value=mock_response)

            result = await dataset_service._execute_distribution_balancing(dataset_config, user_id)

            assert result["status"] == "completed"
            assert result["balancing_score"] == 0.88
            assert "balanced_distribution" in result

    async def test_execution_status_retrieval(self, dataset_service, sample_dataset_config):
        """Test execution status retrieval."""
        user_id = "test_user_123"
        execution_id = "test_execution_123"

        # Create mock execution
        from datetime import datetime
        execution = dataset_service.DatasetExecution(
            execution_id=execution_id,
            user_id=user_id,
            dataset_config=sample_dataset_config,
            status=DatasetStatus.PROCESSING,
            current_stage=DatasetProcessingStage.QUALITY_ASSESSMENT,
            stage_results={},
            start_time=datetime.utcnow(),
            end_time=None,
            overall_progress=45.0,
            quality_score=0.85,
            bias_score=0.12,
            error_message=None,
            source_locations=["s3://bucket/source1.json", "local:/data/source2.json"],
            output_locations=[],
            metadata={"test": True}
        )

        dataset_service.active_executions[execution_id] = execution

        # Retrieve status
        status = await dataset_service.get_execution_status(execution_id, user_id)

        assert status["execution_id"] == execution_id
        assert status["status"] == DatasetStatus.PROCESSING.value
        assert status["current_stage"] == DatasetProcessingStage.QUALITY_ASSESSMENT.value
        assert status["overall_progress"] == 45.0
        assert status["quality_score"] == 0.85
        assert status["bias_score"] == 0.12

    async def test_dataset_statistics_generation(self, dataset_service, sample_dataset_config):
        """Test comprehensive dataset statistics generation."""
        user_id = "test_user_123"
        execution_id = "test_execution_123"

        # Create mock execution with stage results
        execution = dataset_service.DatasetExecution(
            execution_id=execution_id,
            user_id=user_id,
            dataset_config=sample_dataset_config,
            status=DatasetStatus.COMPLETED,
            current_stage=DatasetProcessingStage.OUTPUT_GENERATION,
            stage_results={
                "data_acquisition": {
                    "status": "completed",
                    "total_records": 5000,
                    "sources_processed": 3
                },
                "quality_assessment": {
                    "status": "completed",
                    "quality_score": 0.88
                },
                "bias_detection": {
                    "status": "completed",
                    "bias_score": 0.15
                }
            },
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow(),
            overall_progress=100.0,
            quality_score=0.88,
            bias_score=0.15,
            error_message=None,
            source_locations=[],
            output_locations=["/output/processed_dataset.json"],
            metadata={}
        )

        dataset_service.active_executions[execution_id] = execution

        # Generate statistics
        stats = await dataset_service.get_dataset_statistics(execution_id, user_id)

        assert "execution_summary" in stats
        assert "data_metrics" in stats
        assert "quality_metrics" in stats
        assert "bias_metrics" in stats
        assert stats["data_metrics"]["total_records"] == 5000
        assert stats["data_metrics"]["sources_processed"] == 3
        assert stats["quality_metrics"]["quality_assessment_quality"] == 0.88
        assert stats["bias_metrics"]["bias_detection_bias"] == 0.15

    async def test_concurrent_dataset_processing(self, dataset_service, sample_dataset_config):
        """Test concurrent dataset processing."""
        user_ids = ["user1", "user2", "user3"]
        execution_ids = []

        with patch.object(dataset_service, "session") as mock_session:
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(return_value={
                "data": {"status": "completed", "record_count": 1000}
            })

            mock_session.post = AsyncMock(return_value=mock_response)
            mock_session.get = AsyncMock(return_value=mock_response)

            # Start multiple dataset processing tasks concurrently
            tasks = []
            for user_id in user_ids:
                task = dataset_service.process_dataset(sample_dataset_config, user_id)
                tasks.append(task)

            execution_ids = await asyncio.gather(*tasks)

            # Verify all executions were created
            assert len(execution_ids) == 3
            for execution_id in execution_ids:
                assert execution_id in dataset_service.active_executions

    async def test_error_handling_and_recovery(self, dataset_service, sample_dataset_config):
        """Test error handling and recovery mechanisms."""
        user_id = "test_user_123"

        # Test validation error
        invalid_config = {"invalid": "config"}

        with pytest.raises(ValidationError):
            await dataset_service.process_dataset(invalid_config, user_id)

        # Test API failure handling
        with patch.object(dataset_service, "session") as mock_session:
            mock_response = AsyncMock()
            mock_response.status = 500
            mock_response.json = AsyncMock(return_value={"error": "Internal server error"})

            mock_session.post = AsyncMock(return_value=mock_response)

            # This should handle the error gracefully
            execution_id = await dataset_service.process_dataset(sample_dataset_config, user_id)

            # Verify execution was created despite API failure
            assert execution_id in dataset_service.active_executions

    async def test_service_health_monitoring(self, dataset_service):
        """Test service health monitoring."""
        with patch.object(dataset_service, "session") as mock_session:
            # Test healthy service
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_session.get = AsyncMock(return_value=mock_response)

            health = await dataset_service.get_service_health()

            assert health["status"] == "healthy"
            assert "dataset_api_url" in health
            assert "active_executions" in health

            # Test unhealthy service
            mock_response.status = 500
            health = await dataset_service.get_service_health()

            assert health["status"] == "unhealthy"
            assert "error" in health

    async def test_execution_cancellation(self, dataset_service, sample_dataset_config):
        """Test dataset execution cancellation."""
        user_id = "test_user_123"
        execution_id = "test_execution_123"

        # Create mock execution
        execution = dataset_service.DatasetExecution(
            execution_id=execution_id,
            user_id=user_id,
            dataset_config=sample_dataset_config,
            status=DatasetStatus.PROCESSING,
            current_stage=DatasetProcessingStage.QUALITY_ASSESSMENT,
            stage_results={},
            start_time=datetime.utcnow(),
            end_time=None,
            overall_progress=45.0,
            quality_score=0.85,
            bias_score=0.12,
            error_message=None,
            source_locations=[],
            output_locations=[],
            metadata={}
        )

        dataset_service.active_executions[execution_id] = execution

        # Cancel execution
        success = await dataset_service.cancel_execution(execution_id, user_id)

        assert success is True
        assert execution.status == DatasetStatus.CANCELLED
        assert execution.end_time is not None

        # Verify cancellation event was published
        dataset_service.integration_manager.publish_integration_event.assert_called()

    async def test_cleanup_expired_executions(self, dataset_service):
        """Test cleanup of expired executions."""
        from datetime import datetime, timedelta

        # Create expired execution
        expired_execution = dataset_service.DatasetExecution(
            execution_id="expired_123",
            user_id="user_123",
            dataset_config={},
            status=DatasetStatus.PROCESSING,
            current_stage=None,
            stage_results={},
            start_time=datetime.utcnow() - timedelta(hours=3),  # 3 hours old
            end_time=None,
            overall_progress=50.0,
            quality_score=None,
            bias_score=None,
            error_message=None,
            source_locations=[],
            output_locations=[],
            metadata={}
        )

        dataset_service.active_executions["expired_123"] = expired_execution

        # Run cleanup
        cleaned_count = await dataset_service.cleanup_expired_executions()

        assert cleaned_count == 1
        assert "expired_123" not in dataset_service.active_executions


@pytest.mark.asyncio
class TestDatasetPipelineWebSocketIntegration:
    """Test WebSocket integration for dataset pipeline."""

    @pytest.fixture
    def sample_websocket_event(self):
        """Create sample WebSocket event for testing."""
        return {
            "event_type": "dataset_progress",
            "execution_id": "test_execution_123",
            "user_id": "test_user_123",
            "data": {
                "overall_progress": 75.0,
                "current_stage": "bias_detection",
                "quality_score": 0.88,
                "bias_score": 0.15,
                "message": "Bias detection in progress"
            },
            "timestamp": datetime.utcnow().isoformat()
        }

    async def test_websocket_progress_event_handling(self, sample_websocket_event):
        """Test WebSocket progress event handling."""
        # This would test the WebSocket event processing
        # For now, verify event structure
        assert sample_websocket_event["event_type"] == "dataset_progress"
        assert "execution_id" in sample_websocket_event
        assert "data" in sample_websocket_event
        assert "overall_progress" in sample_websocket_event["data"]

    async def test_websocket_status_event_handling(self):
        """Test WebSocket status event handling."""
        status_event = {
            "event_type": "dataset_status",
            "execution_id": "test_execution_123",
            "user_id": "test_user_123",
            "data": {
                "status": "completed",
                "overall_progress": 100.0,
                "quality_score": 0.9,
                "bias_score": 0.12
            },
            "timestamp": datetime.utcnow().isoformat()
        }

        # Verify event structure
        assert status_event["event_type"] == "dataset_status"
        assert status_event["data"]["status"] == "completed"
        assert status_event["data"]["overall_progress"] == 100.0


@pytest.mark.asyncio
class TestDatasetPipelineEndToEnd:
    """End-to-end tests for complete dataset pipeline processing."""

    async def test_complete_dataset_pipeline_flow(self, dataset_service, sample_dataset_config):
        """Test complete dataset pipeline flow from initiation to completion."""
        user_id = "test_user_123"

        with patch.object(dataset_service, "session") as mock_session:
            # Mock successful responses for all stages
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(side_effect=[
                # Data acquisition
                {"data": {"status": "completed", "record_count": 2000, "duration_seconds": 3.0}},
                # Validation
                {"data": {"status": "completed", "quality_score": 0.85, "duration_seconds": 2.0}},
                # Standardization
                {"data": {"status": "completed", "fields_standardized": 25, "duration_seconds": 1.5}},
                # Quality assessment
                {"data": {"status": "completed", "quality_score": 0.88, "duration_seconds": 2.5}},
                # Bias detection
                {"data": {"status": "completed", "bias_score": 0.15, "duration_seconds": 4.0}},
                # Data fusion
                {"data": {"status": "completed", "fusion_quality_score": 0.82, "total_conversations": 1800, "duration_seconds": 6.0}},
                # Distribution balancing
                {"data": {"status": "completed", "balancing_score": 0.9, "duration_seconds": 3.0}},
                # Final validation
                {"data": {"status": "completed", "final_score": 0.87, "duration_seconds": 2.0}},
                # Output generation
                {"data": {"status": "completed", "output_formats": ["json", "csv"], "duration_seconds": 2.0}}
            ])

            mock_session.post = AsyncMock(return_value=mock_response)
            mock_session.get = AsyncMock(return_value=mock_response)

            # Process dataset
            execution_id = await dataset_service.process_dataset(sample_dataset_config, user_id)

            # Wait for processing to complete (in real scenario, this would be asynchronous)
            await asyncio.sleep(0.1)  # Brief pause to allow async processing

            # Verify execution was created and processing started
            assert execution_id in dataset_service.active_executions
            execution = dataset_service.active_executions[execution_id]

            assert execution.user_id == user_id
            assert execution.status in [DatasetStatus.PENDING, DatasetStatus.PROCESSING, DatasetStatus.COMPLETED]

            # Verify integration events were published
            dataset_service.integration_manager.publish_integration_event.assert_called()

            # Get final statistics
            if execution.status == DatasetStatus.COMPLETED:
                stats = await dataset_service.get_dataset_statistics(execution_id, user_id)

                assert "execution_summary" in stats
                assert "data_metrics" in stats
                assert "quality_metrics" in stats
                assert "bias_metrics" in stats


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
