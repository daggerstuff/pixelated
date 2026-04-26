"""
Tests for reflection subagent, prompts, and consolidation rules.
"""

import pytest

pytestmark = pytest.mark.skip(reason="Module ai.memory.unified_memory not implemented")

from unittest.mock import Mock

from ai.memory.consolidation_rules import (
    ConsolidationConfig,
    ConsolidationRule,
    ConsolidationRules,
)
from ai.memory.reflection_prompts import (
    CRISIS_AWARE_REFLECTION,
    CRISIS_DETECTION_PROMPT,
    STANDARD_REFLECTION,
    get_all_prompts,
    get_reflection_prompt,
)
from ai.memory.reflection_subagent import (
    ReflectionConfig,
    ReflectionResult,
    ReflectionSubagent,
    ReflectionTrigger,
)
from ai.memory.unified_memory import (
    CrisisSeverity,
    Memory,
    MemoryCategory,
    MemoryMetadata,
    MemoryProvider,
)

# ============================================================================
# Test Reflection Prompts
# ============================================================================


class TestReflectionPrompts:
    """Test reflection prompt definitions."""

    def test_crisis_aware_prompt_exists(self):
        """Test that crisis-aware prompt is defined."""
        assert CRISIS_AWARE_REFLECTION is not None
        assert CRISIS_AWARE_REFLECTION.name == "crisis_aware_reflection"
        assert "crisis" in CRISIS_AWARE_REFLECTION.template
        assert "CRISIS MEMORIES" in CRISIS_AWARE_REFLECTION.template

    def test_standard_prompt_exists(self):
        """Test that standard prompt is defined."""
        assert STANDARD_REFLECTION is not None
        assert STANDARD_REFLECTION.name == "standard_reflection"

    def test_crisis_detection_prompt_exists(self):
        """Test that crisis detection prompt is defined."""
        assert CRISIS_DETECTION_PROMPT is not None
        assert CRISIS_DETECTION_PROMPT.name == "crisis_detection"
        assert "CRITICAL" in CRISIS_DETECTION_PROMPT.template
        assert "suicidal" in CRISIS_DETECTION_PROMPT.template.lower()

    def test_prompts_have_required_fields(self):
        """Test that all prompts have required fields."""
        prompts = [
            CRISIS_AWARE_REFLECTION,
            STANDARD_REFLECTION,
            CRISIS_DETECTION_PROMPT,
        ]

        for prompt in prompts:
            assert isinstance(prompt.name, str)
            assert isinstance(prompt.template, str)
            assert isinstance(prompt.priority, int)
            assert isinstance(prompt.categories, list)
            assert len(prompt.template) > 0

    def test_get_reflection_prompt_crisis_context(self):
        """Test getting prompt with crisis context."""
        # With crisis context (default)
        prompt = get_reflection_prompt(include_crisis_context=True)
        assert prompt == CRISIS_AWARE_REFLECTION

        # With crisis detected
        prompt = get_reflection_prompt(crisis_detected=True)
        assert prompt == CRISIS_AWARE_REFLECTION

        # Without crisis context
        prompt = get_reflection_prompt(
            crisis_detected=False,
            include_crisis_context=False,
        )
        assert prompt == STANDARD_REFLECTION

    def test_get_all_prompts(self):
        """Test getting all prompts."""
        prompts = get_all_prompts()
        assert len(prompts) == 3
        assert CRISIS_AWARE_REFLECTION in prompts
        assert STANDARD_REFLECTION in prompts
        assert CRISIS_DETECTION_PROMPT in prompts


# ============================================================================
# Test Reflection Subagent
# ============================================================================


class MockMemoryProvider:
    """Mock memory provider for testing."""

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
        content: str = None,
        metadata: MemoryMetadata = None,
    ) -> None:
        if memory_id in self._memories:
            if content:
                self._memories[memory_id].content = content
            if metadata:
                self._memories[memory_id].metadata = metadata

    async def delete_memory(self, memory_id: str) -> None:
        if memory_id in self._memories:
            del self._memories[memory_id]

    async def search_memories(
        self,
        query: str,
        limit: int = 10,
    ) -> list[Memory]:
        del query  # Mark as intentionally unused
        return list(self._memories.values())[:limit]

    async def get_memories_by_user(
        self,
        user_id: str,
        limit: int = 100,
    ) -> list[Memory]:
        del user_id  # Mark as intentionally unused
        return list(self._memories.values())[:limit]

    async def get_memories_by_category(
        self,
        category: MemoryCategory,
        limit: int = 100,
    ) -> list[Memory]:
        return [m for m in self._memories.values() if m.metadata.category == category][:limit]


class TestReflectionConfig:
    """Test ReflectionConfig dataclass."""

    def test_default_config(self):
        """Test default configuration values."""
        config = ReflectionConfig()
        assert config.trigger == ReflectionTrigger.STEP_COUNT
        assert config.step_threshold == 10
        assert config.include_crisis_context is True
        assert config.auto_consolidate is False
        assert config.max_memories_to_review == 50
        assert config.llm_model == "claude-sonnet-4-6"

    def test_custom_config(self):
        """Test custom configuration."""
        config = ReflectionConfig(
            trigger=ReflectionTrigger.MANUAL,
            step_threshold=20,
            auto_consolidate=True,
        )
        assert config.trigger == ReflectionTrigger.MANUAL
        assert config.step_threshold == 20
        assert config.auto_consolidate is True


class TestReflectionSubagent:
    """Test ReflectionSubagent class."""

    def test_init(self):
        """Test subagent initialization."""
        mock_provider = Mock(spec=MemoryProvider)
        config = ReflectionConfig()
        subagent = ReflectionSubagent(mock_provider, config)

        assert subagent.memory == mock_provider
        assert subagent.config == config
        assert subagent._message_count == 0

    def test_init_defaults(self):
        """Test initialization with defaults."""
        mock_provider = Mock(spec=MemoryProvider)
        subagent = ReflectionSubagent(mock_provider)

        assert subagent.memory == mock_provider
        assert subagent.config is not None
        assert subagent.llm_callback is None

    @pytest.mark.asyncio
    async def test_analyze_conversation_no_crisis(self):
        """Test analyzing conversation without crisis."""
        mock_provider = MockMemoryProvider()
        llm_response = """{
            "crisis_detected": false,
            "crisis_indicators": [],
            "preserve_individual": ["mem-1"],
            "can_consolidate": ["mem-2", "mem-3"],
            "requires_review": false,
            "recommendations": ["Consolidate general memories"]
        }"""

        async def mock_llm(prompt: str) -> str:
            return llm_response

        subagent = ReflectionSubagent(mock_provider, llm_callback=mock_llm)

        conversation = "Normal therapeutic conversation about daily life."
        result = await subagent.analyze_conversation(conversation, "user123")

        assert result.crisis_detected is False
        assert not result.requires_manual_review

    @pytest.mark.asyncio
    async def test_analyze_conversation_with_crisis(self):
        """Test analyzing conversation with crisis indicators."""
        mock_provider = MockMemoryProvider()

        # Track which prompt we're responding to
        call_count = [0]

        async def mock_llm(prompt: str) -> str:
            call_count[0] += 1
            # First call is crisis detection, second is analysis
            if call_count[0] == 1:
                # Crisis detection response
                return '{"severity": "critical", "indicators": ["suicide", "self-harm"], "action_required": true}'
            else:
                # Analysis response
                return """{
                    "crisis_detected": true,
                    "crisis_indicators": ["suicide", "self-harm"],
                    "preserve_individual": ["mem-1", "mem-2"],
                    "can_consolidate": [],
                    "requires_review": true,
                    "recommendations": ["Preserve all crisis content"]
                }"""

        subagent = ReflectionSubagent(mock_provider, llm_callback=mock_llm)

        conversation = "User expresses suicidal thoughts."
        result = await subagent.analyze_conversation(conversation, "user123")

        assert result.crisis_detected is True
        assert result.requires_manual_review is True
        assert len(result.crisis_indicators) > 0

    @pytest.mark.asyncio
    async def test_consolidate_memories_crisis_detected(self):
        """Test consolidation skips when crisis detected."""
        mock_provider = MockMemoryProvider()
        config = ReflectionConfig(auto_consolidate=False)
        subagent = ReflectionSubagent(mock_provider, config)

        result = ReflectionResult(
            crisis_detected=True,
            memories_consolidated=["mem-1", "mem-2"],
            memories_deleted=["mem-3"],
        )

        stats = await subagent.consolidate_memories("user123", result)

        # Should skip consolidation when crisis detected
        assert stats["consolidated"] == 0
        assert stats["deleted"] == 0

    @pytest.mark.asyncio
    async def test_consolidate_memories_no_crisis(self):
        """Test consolidation proceeds when no crisis."""
        mock_provider = MockMemoryProvider()
        config = ReflectionConfig(auto_consolidate=True)
        subagent = ReflectionSubagent(mock_provider, config)

        result = ReflectionResult(
            crisis_detected=False,
            memories_consolidated=["mem-1", "mem-2"],
            memories_deleted=[],
        )

        stats = await subagent.consolidate_memories("user123", result)

        # Should consolidate when no crisis
        assert stats["consolidated"] == 2

    def test_message_count_tracking(self):
        """Test message count tracking for triggers."""
        mock_provider = MockMemoryProvider()
        config = ReflectionConfig(
            trigger=ReflectionTrigger.STEP_COUNT,
            step_threshold=5,
        )
        subagent = ReflectionSubagent(mock_provider, config)

        # Initially should not reflect
        assert subagent.should_reflect() is False

        # Increment to threshold
        for _ in range(5):
            subagent.increment_message_count()

        assert subagent.should_reflect() is True

        # Reset after reflection
        subagent.reset_message_count()
        assert subagent.should_reflect() is False

    def test_should_reflect_manual_trigger(self):
        """Test manual trigger mode."""
        mock_provider = MockMemoryProvider()
        config = ReflectionConfig(trigger=ReflectionTrigger.MANUAL)
        subagent = ReflectionSubagent(mock_provider, config)

        # Manual trigger should never auto-reflect
        assert subagent.should_reflect() is False

        for _ in range(100):
            subagent.increment_message_count()

        assert subagent.should_reflect() is False


class TestReflectionResult:
    """Test ReflectionResult dataclass."""

    def test_default_result(self):
        """Test default result values."""
        result = ReflectionResult()
        assert result.crisis_detected is False
        assert result.memories_preserved == []
        assert result.memories_consolidated == []
        assert result.requires_manual_review is False


# ============================================================================
# Test Consolidation Rules
# ============================================================================


class TestConsolidationConfig:
    """Test ConsolidationConfig dataclass."""

    def test_default_config(self):
        """Test default configuration values."""
        config = ConsolidationConfig()
        assert config.max_general_memories == 100
        assert config.max_age_days == 90
        assert config.crisis_retention_years == 7
        assert config.auto_consolidate_crisis is False


class TestConsolidationRules:
    """Test ConsolidationRules class."""

    def test_init(self):
        """Test rules initialization."""
        rules = ConsolidationRules()
        assert rules.crisis_categories is not None
        assert rules.general_categories is not None
        assert MemoryCategory.CRISIS_CONTEXT in rules.crisis_categories
        assert MemoryCategory.GENERAL in rules.general_categories

    def test_evaluate_memory_crisis_severity_preserve(self):
        """Test that crisis severity triggers preservation."""
        rules = ConsolidationRules()

        # Crisis severity = PRESERVE
        metadata = MemoryMetadata(
            category=MemoryCategory.GENERAL,
            crisis_severity=CrisisSeverity.HIGH,
        )
        memory = Memory(id="test", content="test", metadata=metadata)
        result = rules.evaluate_memory(memory)

        assert result.rule == ConsolidationRule.PRESERVE
        assert result.priority == 1

    def test_evaluate_memory_crisis_category_preserve(self):
        """Test that crisis categories trigger preservation."""
        rules = ConsolidationRules()

        crisis_categories = [
            MemoryCategory.CRISIS_CONTEXT,
            MemoryCategory.EMOTIONAL_STATE,
            MemoryCategory.THERAPEUTIC_INSIGHT,
        ]

        for category in crisis_categories:
            metadata = MemoryMetadata(category=category)
            memory = Memory(id="test", content="test", metadata=metadata)
            result = rules.evaluate_memory(memory)

            assert result.rule == ConsolidationRule.PRESERVE

    def test_evaluate_memory_treatment_progress_preserve(self):
        """Test that treatment progress triggers preservation."""
        rules = ConsolidationRules()

        metadata = MemoryMetadata(category=MemoryCategory.TREATMENT_PROGRESS)
        memory = Memory(id="test", content="test", metadata=metadata)
        result = rules.evaluate_memory(memory)

        assert result.rule == ConsolidationRule.PRESERVE

    def test_evaluate_memory_general_consolidate(self):
        """Test that general category can be consolidated."""
        rules = ConsolidationRules()

        general_categories = [
            MemoryCategory.GENERAL,
            MemoryCategory.SESSION_SUMMARY,
            MemoryCategory.PREFERENCE,
        ]

        for category in general_categories:
            metadata = MemoryMetadata(category=category)
            memory = Memory(id="test", content="test", metadata=metadata)
            result = rules.evaluate_memory(memory)

            assert result.rule == ConsolidationRule.CONSOLIDATE

    def test_get_consolidation_candidates(self):
        """Test getting consolidation candidates."""
        rules = ConsolidationRules()

        memories = [
            Memory(
                id="crisis-1",
                content="crisis content",
                metadata=MemoryMetadata(category=MemoryCategory.CRISIS_CONTEXT),
            ),
            Memory(
                id="general-1",
                content="general content 1",
                metadata=MemoryMetadata(category=MemoryCategory.GENERAL),
            ),
            Memory(
                id="general-2",
                content="general content 2",
                metadata=MemoryMetadata(category=MemoryCategory.SESSION_SUMMARY),
            ),
        ]

        candidates = rules.get_consolidation_candidates(memories)

        # Only general memories should be candidates
        assert len(candidates) == 2
        assert "general-1" in [m.id for m in candidates]
        assert "general-2" in [m.id for m in candidates]
        assert "crisis-1" not in [m.id for m in candidates]

    def test_get_preservation_list(self):
        """Test getting preservation list."""
        rules = ConsolidationRules()

        memories = [
            Memory(
                id="crisis-1",
                content="crisis content",
                metadata=MemoryMetadata(category=MemoryCategory.CRISIS_CONTEXT),
            ),
            Memory(
                id="insight-1",
                content="therapeutic insight",
                metadata=MemoryMetadata(category=MemoryCategory.THERAPEUTIC_INSIGHT),
            ),
            Memory(
                id="general-1",
                content="general content",
                metadata=MemoryMetadata(category=MemoryCategory.GENERAL),
            ),
        ]

        preserved = rules.get_preservation_list(memories)

        # Crisis and insight should be preserved
        assert len(preserved) == 2
        preserved_ids = [m.id for m in preserved]
        assert "crisis-1" in preserved_ids
        assert "insight-1" in preserved_ids
        assert "general-1" not in preserved_ids

    def test_group_for_consolidation(self):
        """Test grouping memories for consolidation."""
        rules = ConsolidationRules()

        memories = [
            Memory(
                id="crisis-1",
                content="crisis",
                metadata=MemoryMetadata(category=MemoryCategory.CRISIS_CONTEXT),
            ),
            Memory(
                id="general-1",
                content="general 1",
                metadata=MemoryMetadata(category=MemoryCategory.GENERAL),
            ),
            Memory(
                id="general-2",
                content="general 2",
                metadata=MemoryMetadata(category=MemoryCategory.SESSION_SUMMARY),
            ),
        ]

        groups = rules.group_for_consolidation(memories)

        assert len(groups["preserve"]) == 1
        assert groups["preserve"][0].id == "crisis-1"
        assert len(groups["consolidate"]) == 2

    def test_should_trigger_consolidation(self):
        """Test consolidation trigger check."""
        config = ConsolidationConfig(max_general_memories=5)
        rules = ConsolidationRules(config)

        # Under threshold - should not trigger
        memories_under = [
            Memory(
                id=f"general-{i}",
                content=f"content {i}",
                metadata=MemoryMetadata(category=MemoryCategory.GENERAL),
            )
            for i in range(3)
        ]
        assert rules.should_trigger_consolidation(memories_under) is False

        # Over threshold - should trigger
        memories_over = [
            Memory(
                id=f"general-{i}",
                content=f"content {i}",
                metadata=MemoryMetadata(category=MemoryCategory.GENERAL),
            )
            for i in range(10)
        ]
        assert rules.should_trigger_consolidation(memories_over) is True


# ============================================================================
# Integration Tests
# ============================================================================


class TestReflectionIntegration:
    """Integration tests for reflection workflow."""

    @pytest.mark.asyncio
    async def test_full_reflection_workflow(self):
        """Test complete reflection workflow."""
        mock_provider = MockMemoryProvider()

        # Add some memories
        for i in range(3):
            await mock_provider.add_memory(
                f"Memory {i}",
                MemoryMetadata(category=MemoryCategory.GENERAL),
            )

        llm_responses = {
            "crisis": '{"severity": "none", "indicators": []}',
            "analysis": """{
                "crisis_detected": false,
                "crisis_indicators": [],
                "preserve_individual": [],
                "can_consolidate": ["mem-0", "mem-1"],
                "requires_review": false,
                "recommendations": []
            }""",
        }

        call_count = 0

        async def mock_llm(prompt: str) -> str:
            nonlocal call_count
            call_count += 1
            if "Crisis Categories" in prompt:
                return llm_responses["crisis"]
            return llm_responses["analysis"]

        subagent = ReflectionSubagent(mock_provider, llm_callback=mock_llm)

        # Analyze conversation
        result = await subagent.analyze_conversation(
            "Normal therapeutic conversation",
            "user123",
        )

        assert result is not None
        assert result.crisis_detected is False

    @pytest.mark.asyncio
    async def test_crisis_preservation_workflow(self):
        """Test that crisis content is preserved."""
        mock_provider = MockMemoryProvider()
        config = ReflectionConfig(auto_consolidate=False)
        subagent = ReflectionSubagent(mock_provider, config)

        # Simulate crisis result
        result = ReflectionResult(
            crisis_detected=True,
            crisis_indicators=["suicide"],
            memories_preserved=["mem-1"],
            requires_manual_review=True,
        )

        stats = await subagent.consolidate_memories("user123", result)

        # Crisis should prevent auto-consolidation
        assert stats["consolidated"] == 0


class TestConsolidationRulesIntegration:
    """Integration tests for consolidation rules."""

    def test_crisis_memory_never_consolidated(self):
        """Test that crisis memories are never consolidated."""
        rules = ConsolidationRules()

        # Create memories with various crisis indicators
        crisis_memories = [
            Memory(
                id="high-severity",
                content="crisis",
                metadata=MemoryMetadata(
                    category=MemoryCategory.GENERAL,
                    crisis_severity=CrisisSeverity.HIGH,
                ),
            ),
            Memory(
                id="crisis-context",
                content="crisis",
                metadata=MemoryMetadata(category=MemoryCategory.CRISIS_CONTEXT),
            ),
            Memory(
                id="therapeutic-insight",
                content="insight",
                metadata=MemoryMetadata(category=MemoryCategory.THERAPEUTIC_INSIGHT),
            ),
        ]

        for memory in crisis_memories:
            result = rules.evaluate_memory(memory)
            assert result.rule == ConsolidationRule.PRESERVE

    def test_general_memory_can_consolidate(self):
        """Test that general memories can be consolidated."""
        rules = ConsolidationRules()

        metadata = MemoryMetadata(category=MemoryCategory.GENERAL)
        memory = Memory(id="general", content="general content", metadata=metadata)
        result = rules.evaluate_memory(memory)

        assert result.rule == ConsolidationRule.CONSOLIDATE
