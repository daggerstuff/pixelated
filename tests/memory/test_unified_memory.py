"""
Tests for the memory provider interface and the Foresight provider.
"""

from __future__ import annotations

from unittest.mock import Mock

import pytest

from ai.memory.foresight_provider import ForesightMemoryProvider
from ai.memory.unified_memory import (
    CrisisSeverity,
    Memory,
    MemoryCategory,
    MemoryMetadata,
)


class TestMemoryCategory:
    """Test MemoryCategory enum."""

    def test_categories_exist(self):
        """Test that all expected categories exist."""
        assert MemoryCategory.GENERAL.value == "general"
        assert MemoryCategory.CRISIS_CONTEXT.value == "crisis_context"
        assert MemoryCategory.EMOTIONAL_STATE.value == "emotional_state"
        assert MemoryCategory.THERAPEUTIC_INSIGHT.value == "therapeutic_insight"
        assert MemoryCategory.TREATMENT_PROGRESS.value == "treatment_progress"
        assert MemoryCategory.SESSION_SUMMARY.value == "session_summary"
        assert MemoryCategory.PREFERENCE.value == "preference"


class TestCrisisSeverity:
    """Test CrisisSeverity enum."""

    def test_severity_levels(self):
        """Test that all severity levels exist."""
        assert CrisisSeverity.NONE.value == "none"
        assert CrisisSeverity.MEDIUM.value == "medium"
        assert CrisisSeverity.HIGH.value == "high"
        assert CrisisSeverity.CRITICAL.value == "critical"


class TestMemoryMetadata:
    """Test MemoryMetadata dataclass."""

    def test_default_values(self):
        """Test default metadata values."""
        metadata = MemoryMetadata()
        assert metadata.category == MemoryCategory.GENERAL
        assert metadata.crisis_severity == CrisisSeverity.NONE
        assert metadata.user_id is None
        assert metadata.session_id is None
        assert metadata.tags == []

    def test_to_dict(self):
        """Test converting metadata to dictionary."""
        metadata = MemoryMetadata(
            category=MemoryCategory.CRISIS_CONTEXT,
            crisis_severity=CrisisSeverity.HIGH,
            user_id="user123",
            session_id="session456",
            tags=["test", "important"],
        )
        result = metadata.to_dict()
        assert result["category"] == "crisis_context"
        assert result["crisis_severity"] == "high"
        assert result["user_id"] == "user123"
        assert result["session_id"] == "session456"
        assert result["tags"] == ["test", "important"]

    def test_from_dict(self):
        """Test creating metadata from dictionary."""
        data = {
            "category": "emotional_state",
            "crisis_severity": "medium",
            "user_id": "user789",
            "session_id": "session012",
            "tags": ["tag1", "tag2"],
            "created_at": 1234567890.0,
        }
        metadata = MemoryMetadata.from_dict(data)
        assert metadata.category == MemoryCategory.EMOTIONAL_STATE
        assert metadata.crisis_severity == CrisisSeverity.MEDIUM
        assert metadata.user_id == "user789"
        assert metadata.tags == ["tag1", "tag2"]

    def test_from_dict_defaults(self):
        """Test from_dict handles missing fields with defaults."""
        data = {"category": "general"}
        metadata = MemoryMetadata.from_dict(data)
        assert metadata.category == MemoryCategory.GENERAL
        assert metadata.crisis_severity == CrisisSeverity.NONE
        assert metadata.tags == []


class TestMemory:
    """Test Memory dataclass."""

    def test_memory_creation(self):
        """Test creating a memory."""
        metadata = MemoryMetadata()
        memory = Memory(
            id="test-id",
            content="Test content",
            metadata=metadata,
        )
        assert memory.id == "test-id"
        assert memory.content == "Test content"
        assert memory.metadata == metadata
        assert memory.embedding is None


class TestForesightMemoryProvider:
    """Test ForesightMemoryProvider."""

    def test_init(self):
        """Test provider initialization."""
        mock_manager = Mock()
        provider = ForesightMemoryProvider(mock_manager)
        assert provider.foresight == mock_manager
        assert provider.bank_id == "pixelated"

    def test_init_with_config(self):
        """Test provider initialization with config."""
        mock_manager = Mock()
        config = {"bank_id": "custom_bank"}
        provider = ForesightMemoryProvider(mock_manager, config)
        assert provider.bank_id == "custom_bank"

    @pytest.mark.asyncio
    async def test_add_memory(self):
        """Test adding memory."""
        mock_manager = Mock()
        mock_manager.add_memory.return_value = "test-id"
        provider = ForesightMemoryProvider(mock_manager)

        metadata = MemoryMetadata(user_id="user123")
        memory_id = await provider.add_memory("Test content", metadata)

        assert memory_id == "test-id"
        mock_manager.add_memory.assert_called_once()

    @pytest.mark.asyncio
    async def test_search_memories(self):
        """Test searching memories."""
        mock_manager = Mock()
        mock_manager.search_memories.return_value = [
            {"id": "1", "content": "Memory 1", "metadata": {}},
            {"id": "2", "content": "Memory 2", "metadata": {}},
        ]
        provider = ForesightMemoryProvider(mock_manager)

        results = await provider.search_memories("query", "user123", limit=10)

        assert len(results) == 2
        mock_manager.search_memories.assert_called_once()


class TestMemoryMetadataSerialization:
    """Test metadata serialization."""

    def test_round_trip_serialization(self):
        """Test converting to and from dict preserves data."""
        original = MemoryMetadata(
            category=MemoryCategory.TREATMENT_PROGRESS,
            crisis_severity=CrisisSeverity.MEDIUM,
            user_id="user123",
            session_id="session456",
            tags=["tag1", "tag2"],
            created_at=1234567890.0,
            updated_at=1234567891.0,
        )

        data = original.to_dict()
        restored = MemoryMetadata.from_dict(data)

        assert restored.category == original.category
        assert restored.crisis_severity == original.crisis_severity
        assert restored.user_id == original.user_id
        assert restored.session_id == original.session_id
        assert restored.tags == original.tags
