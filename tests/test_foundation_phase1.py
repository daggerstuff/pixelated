"""
Phase 1 Foundation validation tests.

Tests for:
- Development environment initialization
- NeMo microservices availability
- Therapeutic data pipeline bootstrap
"""

import pytest

from ai.foundation.dev_environment import DevEnvironmentConfig
from ai.foundation.nemo_orchestration import NeMoMicroservicesManager
from ai.foundation.therapeutic_data_pipeline import (
    ConversationRole,
    ConversationTurn,
    TherapeuticConversation,
    TherapeuticDataPipeline,
    TherapeuticTechnique,
)


class TestDevEnvironment:
    """Test development environment setup."""

    def test_dev_environment_config_initialization(self):
        """Test DevEnvironmentConfig initializes without errors."""
        config = DevEnvironmentConfig()
        assert config.python_version is not None
        assert config.torch_version is not None

    def test_dev_environment_validation(self):
        """Test environment validation runs."""
        config = DevEnvironmentConfig()
        checks = config.validate()
        self._extracted_from_test_dev_environment_summary_5(
            "python_3_11_plus", checks, "torch_installed", "nemo_downloaded"
        )

    def test_dev_environment_summary(self):
        """Test environment summary generation."""
        config = DevEnvironmentConfig()
        summary = config.summary()
        self._extracted_from_test_dev_environment_summary_5(
            "PyTorch", summary, "CUDA", "NeMo"
        )

    # TODO Rename this here and in `test_dev_environment_validation` and `test_dev_environment_summary`
    def _extracted_from_test_dev_environment_summary_5(self, arg0, arg1, arg2, arg3):
        assert arg0 in arg1
        assert arg2 in arg1
        assert arg3 in arg1


class TestNeMoMicroservices:
    """Test NeMo microservices configuration."""

    def test_nemo_manager_initialization(self):
        """Test NeMoMicroservicesManager initializes."""
        manager = NeMoMicroservicesManager()
        assert manager.quickstart_path is not None

    def test_nemo_installation_validation(self):
        """Test NeMo installation validation."""
        manager = NeMoMicroservicesManager()
        checks = manager.validate_installation()
        assert "quickstart_path_exists" in checks
        assert "docker_compose_exists" in checks

    def test_nemo_services_listing(self):
        """Test available services can be listed."""
        manager = NeMoMicroservicesManager()
        services = manager.list_available_services()
        assert isinstance(services, list)


class TestTherapeuticDataPipeline:
    """Test therapeutic data pipeline."""

    def test_pipeline_initialization(self):
        """Test pipeline initializes."""
        pipeline = TherapeuticDataPipeline()
        pipeline.initialize()
        assert pipeline.data_dir.exists()

    def test_conversation_creation(self):
        """Test creating a therapeutic conversation."""
        turns = [
            ConversationTurn(
                speaker=ConversationRole.THERAPIST,
                text="How are you feeling today?",
            ),
            ConversationTurn(speaker=ConversationRole.PATIENT, text="I've been anxious lately."),
        ]

        conv = TherapeuticConversation(
            session_id="test_001",
            turns=turns,
            technique=TherapeuticTechnique.CBT,
            mental_health_focus="anxiety",
        )

        assert conv.session_id == "test_001"
        assert len(conv.turns) == 2
        assert conv.technique == TherapeuticTechnique.CBT

    def test_conversation_validation(self):
        """Test conversation validation."""
        pipeline = TherapeuticDataPipeline()

        valid_conv = TherapeuticConversation(
            session_id="valid_001",
            turns=[
                ConversationTurn(speaker=ConversationRole.THERAPIST, text="Hello"),
                ConversationTurn(speaker=ConversationRole.PATIENT, text="Hi"),
            ],
        )

        assert pipeline.validate_conversation(valid_conv) is True

    def test_invalid_conversation(self):
        """Test validation rejects invalid conversations."""
        pipeline = TherapeuticDataPipeline()

        invalid_conv = TherapeuticConversation(
            session_id="",
            turns=[],  # Empty session_id and turns
        )

        assert pipeline.validate_conversation(invalid_conv) is False

    def test_pipeline_status_reporting(self):
        """Test pipeline generates status report."""
        pipeline = TherapeuticDataPipeline()
        pipeline.initialize()
        status = pipeline.status()
        assert "Therapeutic Data Pipeline Status" in status
        assert "Data Directory" in status


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
