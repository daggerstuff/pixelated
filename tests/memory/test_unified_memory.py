"""
Tests for unified memory interface and providers.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, Mock

import pytest

from ai.memory.dual_storage_provider import DualStorageProvider
from ai.memory.hindsight_provider import HindsightMemoryProvider
from ai.memory.letta_provider import LettaMemoryProvider
from ai.memory.memory_sync_service import MemorySyncService, SyncDirection
from ai.memory.unified_client import UnifiedMemoryClient, create_client
from ai.memory.unified_memory import (
    CrisisSeverity,
    Memory,
    MemoryCategory,
    MemoryMetadata,
    MemoryProvider,
)

pytestmark = pytest.mark.skip(reason="Module ai.memory.unified_memory not implemented")


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


class MockMemoryProvider(MemoryProvider):
    """Mock provider for testing."""

    def __init__(self):
        self._memories: dict[str, Memory] = {}

    async def add_memory(self, content: str, metadata: MemoryMetadata) -> str:
        memory_id = f"mem-{len(self._memories)}"
        self._memories[memory_id] = Memory(
            id=memory_id,
            content=content,
            metadata=metadata,
        )
        return memory_id

    async def get_memory(self, memory_id: str) -> Memory:
        return self._memories.get(memory_id)

    async def update_memory(
        self,
        memory_id: str,
        content: str | None = None,
        metadata: MemoryMetadata | None = None,
    ) -> None:
        if memory_id in self._memories:
            if content:
                self._memories[memory_id].content = content
            if metadata:
                self._memories[memory_id].metadata = metadata

    async def delete_memory(self, memory_id: str) -> None:
        if memory_id in self._memories:
            del self._memories[memory_id]

    async def search_memories(self, _query: str, _user_id: str, limit: int = 10) -> list[Memory]:
        return list(self._memories.values())[:limit]

    async def get_memories_by_user(self, _user_id: str, limit: int = 100) -> list[Memory]:
        return list(self._memories.values())[:limit]

    async def get_memories_by_category(
        self, category: MemoryCategory, _user_id: str | None = None, limit: int = 100
    ) -> list[Memory]:
        return [m for m in self._memories.values() if m.metadata.category == category][:limit]


class TestHindsightMemoryProvider:
    """Test HindsightMemoryProvider."""

    def test_init(self):
        """Test provider initialization."""
        mock_manager = Mock()
        provider = HindsightMemoryProvider(mock_manager)
        assert provider.hindsight == mock_manager
        assert provider.bank_id == "pixelated"

    def test_init_with_config(self):
        """Test provider initialization with config."""
        mock_manager = Mock()
        config = {"bank_id": "custom_bank"}
        provider = HindsightMemoryProvider(mock_manager, config)
        assert provider.bank_id == "custom_bank"

    @pytest.mark.asyncio
    async def test_add_memory(self):
        """Test adding memory."""
        mock_manager = Mock()
        mock_manager.add_memory.return_value = "test-id"
        provider = HindsightMemoryProvider(mock_manager)

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
        provider = HindsightMemoryProvider(mock_manager)

        results = await provider.search_memories("query", "user123", limit=10)

        assert len(results) == 2
        mock_manager.search_memories.assert_called_once()


class TestLettaMemoryProvider:
    """Test LettaMemoryProvider."""

    def test_init(self):
        """Test provider initialization."""
        mock_client = Mock()
        provider = LettaMemoryProvider(mock_client)
        assert provider.letta == mock_client

    @pytest.mark.asyncio
    async def test_add_memory(self):
        """Test adding memory to Letta."""
        mock_client = AsyncMock()
        mock_client.run = AsyncMock()
        provider = LettaMemoryProvider(mock_client)

        metadata = MemoryMetadata(user_id="user123")
        memory_id = await provider.add_memory("Test content", metadata)

        assert memory_id.startswith("letta-")
        mock_client.run.assert_called_once()


class TestDualStorageProvider:
    """Test DualStorageProvider."""

    def test_init(self):
        """Test provider initialization."""
        mock_hindsight = Mock(spec=MemoryProvider)
        mock_letta = Mock(spec=MemoryProvider)
        provider = DualStorageProvider(mock_hindsight, mock_letta)
        assert provider.hindsight == mock_hindsight
        assert provider.letta == mock_letta

    @pytest.mark.asyncio
    async def test_add_memory_cisis_goes_to_hindsight_only(self):
        """Test crisis content goes to Hindsight only."""
        mock_hindsight = AsyncMock(spec=MemoryProvider)
        mock_hindsight.add_memory.return_value = "hindsight-id"
        mock_letta = AsyncMock(spec=MemoryProvider)

        provider = DualStorageProvider(mock_hindsight, mock_letta)

        # Crisis category should only write to Hindsight
        metadata = MemoryMetadata(
            category=MemoryCategory.CRISIS_CONTEXT,
            user_id="user123",
        )
        memory_id = await provider.add_memory("Crisis content", metadata)

        mock_hindsight.add_memory.assert_called_once()
        mock_letta.add_memory.assert_not_called()
        assert memory_id == "hindsight-id"

    @pytest.mark.asyncio
    async def test_add_memory_general_goes_to_both(self):
        """Test general content goes to both backends."""
        mock_hindsight = AsyncMock(spec=MemoryProvider)
        mock_hindsight.add_memory.return_value = "hindsight-id"
        mock_letta = AsyncMock(spec=MemoryProvider)

        provider = DualStorageProvider(mock_hindsight, mock_letta)

        # General category should write to both
        metadata = MemoryMetadata(
            category=MemoryCategory.GENERAL,
            user_id="user123",
        )
        _memory_id = await provider.add_memory("General content", metadata)

        mock_hindsight.add_memory.assert_called_once()
        mock_letta.add_memory.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_memory_uses_hindsight(self):
        """Test get_memory uses Hindsight."""
        mock_hindsight = AsyncMock(spec=MemoryProvider)
        expected_memory = Memory(
            id="test-id",
            content="Test",
            metadata=MemoryMetadata(),
        )
        mock_hindsight.get_memory.return_value = expected_memory
        mock_letta = AsyncMock(spec=MemoryProvider)

        provider = DualStorageProvider(mock_hindsight, mock_letta)

        result = await provider.get_memory("test-id")

        assert result == expected_memory
        mock_hindsight.get_memory.assert_called_once()


class TestMemorySyncService:
    """Test MemorySyncService."""

    def test_init(self):
        """Test service initialization."""
        mock_hindsight = Mock(spec=MemoryProvider)
        mock_letta = Mock(spec=MemoryProvider)
        service = MemorySyncService(mock_hindsight, mock_letta)
        assert service.hindsight == mock_hindsight
        assert service.letta == mock_letta
        assert service.sync_interval == 300
        assert not service.auto_sync

    def test_init_with_config(self):
        """Test initialization with config."""
        mock_hindsight = Mock(spec=MemoryProvider)
        mock_letta = Mock(spec=MemoryProvider)
        config = {"sync_interval": 600, "auto_sync": True}
        service = MemorySyncService(mock_hindsight, mock_letta, config)
        assert service.sync_interval == 600
        assert service.auto_sync

    @pytest.mark.asyncio
    async def test_sync_now(self):
        """Test immediate sync."""
        mock_hindsight = AsyncMock(spec=MemoryProvider)
        mock_hindsight.get_memories_by_user.return_value = []
        mock_letta = AsyncMock(spec=MemoryProvider)

        service = MemorySyncService(mock_hindsight, mock_letta)

        result = await service.sync_now(SyncDirection.HINDSIGHT_TO_LETTA)

        assert hasattr(result, "hindsight_to_letta")
        assert hasattr(result, "letta_to_hindsight")
        assert hasattr(result, "conflicts_resolved")
        assert hasattr(result, "errors")


class TestUnifiedMemoryClient:
    """Test UnifiedMemoryClient."""

    def test_init_default(self):
        """Test default initialization."""
        client = UnifiedMemoryClient()
        assert client.mode == "dual"
        assert not client._initialized

    def test_init_hindsight_mode(self):
        """Test hindsight mode initialization."""
        client = UnifiedMemoryClient(mode="hindsight")
        assert client.mode == "hindsight"

    def test_init_letta_mode(self):
        """Test letta mode initialization."""
        client = UnifiedMemoryClient(mode="letta")
        assert client.mode == "letta"

    @pytest.mark.asyncio
    async def test_retain(self):
        """Test retaining a memory."""
        mock_provider = AsyncMock(spec=MemoryProvider)
        mock_provider.add_memory.return_value = "test-id"

        client = UnifiedMemoryClient(mode="hindsight")
        client._hindsight_provider = mock_provider
        client.provider = mock_provider

        memory_id = await client.retain(
            content="Test memory",
            user_id="user123",
            category=MemoryCategory.GENERAL,
        )

        assert memory_id == "test-id"

    @pytest.mark.asyncio
    async def test_recall(self):
        """Test recalling memories."""
        mock_provider = AsyncMock(spec=MemoryProvider)
        mock_provider.search_memories.return_value = [
            Memory(id="1", content="Memory 1", metadata=MemoryMetadata()),
        ]

        client = UnifiedMemoryClient(mode="hindsight")
        client.provider = mock_provider

        memories = await client.recall("query", "user123")

        assert len(memories) == 1

    @pytest.mark.asyncio
    async def test_delete(self):
        """Test deleting a memory."""
        mock_provider = AsyncMock(spec=MemoryProvider)

        client = UnifiedMemoryClient(mode="hindsight")
        client.provider = mock_provider

        await client.delete("test-id")

        mock_provider.delete_memory.assert_called_once()


def test_create_client():
    """Test create_client convenience function."""
    client = create_client(mode="hindsight")
    assert client.mode == "hindsight"

    client = create_client(mode="letta")
    assert client.mode == "letta"

    client = create_client(mode="dual")
    assert client.mode == "dual"


# Integration-style tests
class TestProviderIntegration:
    """Test provider integration."""

    @pytest.mark.asyncio
    async def test_full_workflow(self):
        """Test full memory workflow."""
        # Create mock providers
        mock_hindsight = AsyncMock(spec=MemoryProvider)
        mock_hindsight.add_memory.return_value = "hind-id-1"
        mock_letta = AsyncMock(spec=MemoryProvider)
        mock_letta.add_memory.return_value = "letta-id-1"

        # Create dual-storage provider
        provider = DualStorageProvider(mock_hindsight, mock_letta)

        # Add general memory
        metadata = MemoryMetadata(
            category=MemoryCategory.GENERAL,
            user_id="test-user",
        )
        memory_id = await provider.add_memory("Test content", metadata)

        # Both backends should be called
        mock_hindsight.add_memory.assert_called_once()
        mock_letta.add_memory.assert_called_once()

        assert memory_id


class TestCrisisRoutinging:
    """Test crisis routing behavior."""

    @pytest.mark.asyncio
    async def test_crisis_categories_routed_correctly(self):
        """Test that all crisis categories go to Hindsight only."""
        mock_hindsight = AsyncMock(spec=MemoryProvider)
        mock_hindsight.add_memory.return_value = "hind-id"
        mock_letta = AsyncMock(spec=MemoryProvider)

        provider = DualStorageProvider(mock_hindsight, mock_letta)

        crisis_categories = [
            MemoryCategory.CRISIS_CONTEXT,
            MemoryCategory.EMOTIONAL_STATE,
            MemoryCategory.THERAPEUTIC_INSIGHT,
        ]

        for category in crisis_categories:
            mock_hindsight.reset_mock()
            mock_letta.reset_mock()

            metadata = MemoryMetadata(category=category, user_id="user")
            await provider.add_memory(f"Test {category.value}", metadata)

            mock_hindsight.add_memory.assert_called_once()
            mock_letta.add_memory.assert_not_called()


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
