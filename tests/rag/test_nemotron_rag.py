"""
Tests for NVIDIA Nemotron RAG Pipeline.

These tests validate the RAG pipeline components:
- Configuration validation
- Document ingestion
- Vector store operations
- Retrieval functionality
- Response generation

Note: Some tests require NVIDIA_API_KEY for live API calls.
These tests are skipped if the key is not available.
"""

import asyncio
import os
from unittest.mock import AsyncMock, MagicMock, patch

import numpy as np
import pytest

# Skip tests if NVIDIA_API_KEY not available
requires_nvidia_api_key = pytest.mark.skipif(
    not os.environ.get("NVIDIA_API_KEY"),
    reason="NVIDIA_API_KEY not found in environment"
)


class TestNemotronRAGConfig:
    """Tests for RAG configuration."""

    def test_default_config(self):
        """Test default configuration values."""
        from ai.rag.nemotron_rag import NemotronRAGConfig

        config = NemotronRAGConfig(api_key="test-key")

        assert config.api_key == "test-key"
        assert config.base_url == "https://integrate.api.nvidia.com/v1"
        assert config.embedding_model == "nvidia/llama-nemotron-embed-vl-1b-v2"
        assert config.generation_model == "nvidia/llama-3.3-nemotron-super-49b-v1.5"
        assert config.embedding_dimension == 2048
        assert config.retrieval_top_k == 20
        assert config.reranking_top_n == 5

    def test_custom_config(self):
        """Test custom configuration values."""
        from ai.rag.nemotron_rag import (
            IndexType,
            NemotronRAGConfig,
        )

        config = NemotronRAGConfig(
            api_key="test-key",
            retrieval_top_k=50,
            reranking_top_n=10,
            index_type=IndexType.HNSW,
            generation_temperature=0.5
        )

        assert config.retrieval_top_k == 50
        assert config.reranking_top_n == 10
        assert config.index_type == IndexType.HNSW
        assert config.generation_temperature == 0.5

    def test_env_var_api_key(self):
        """Test API key from environment variable."""
        from ai.rag.nemotron_rag import NemotronRAGConfig

        with patch.dict(os.environ, {"NVIDIA_API_KEY": "env-key"}):
            config = NemotronRAGConfig()
            assert config.api_key == "env-key"


class TestDocumentMetadata:
    """Tests for document metadata."""

    def test_metadata_creation(self):
        """Test creating document metadata."""
        from ai.rag.nemotron_rag import (
            DocumentMetadata,
            KnowledgeCategory,
        )

        metadata = DocumentMetadata(
            doc_id="test-001",
            category=KnowledgeCategory.TREATMENT_PROTOCOLS,
            source="APA Guidelines",
            title="Test Protocol",
            tags=["anxiety", "cbt"]
        )

        assert metadata.doc_id == "test-001"
        assert metadata.category == KnowledgeCategory.TREATMENT_PROTOCOLS
        assert metadata.source == "APA Guidelines"
        assert metadata.title == "Test Protocol"
        assert metadata.tags == ["anxiety", "cbt"]

    def test_metadata_auto_timestamps(self):
        """Test automatic timestamp generation."""
        from ai.rag.nemotron_rag import (
            DocumentMetadata,
            KnowledgeCategory,
        )

        metadata = DocumentMetadata(
            doc_id="test-002",
            category=KnowledgeCategory.PSYCHOEDUCATION,
            source="Test Source"
        )

        assert metadata.created_at is not None
        assert metadata.updated_at is not None


class TestRAGResponse:
    """Tests for RAG response model."""

    def test_response_creation(self):
        """Test creating RAG response."""
        from ai.rag.nemotron_rag import RAGResponse

        response = RAGResponse(
            response="Test response content",
            sources=[{"doc_id": "test-001", "source": "Test"}],
            model="nemotron-super-49b",
            retrieved_count=5,
            latency_ms=150.5,
            citations=["APA Guidelines"]
        )

        assert response.response == "Test response content"
        assert len(response.sources) == 1
        assert response.retrieved_count == 5
        assert response.latency_ms == 150.5
        assert response.citations == ["APA Guidelines"]


class TestTherapeuticRAGPipeline:
    """Tests for RAG pipeline operations."""

    @pytest.fixture
    def mock_config(self):
        """Create mock configuration."""
        from ai.rag.nemotron_rag import NemotronRAGConfig

        return NemotronRAGConfig(
            api_key="test-key",
            index_type="flat"  # Use flat for simpler testing
        )

    @pytest.fixture
    def mock_client(self):
        """Create mock OpenAI client."""
        mock = MagicMock()
        mock.embeddings = MagicMock()
        mock.embeddings.create = AsyncMock()
        mock.chat = MagicMock()
        mock.chat.completions = MagicMock()
        mock.chat.completions.create = AsyncMock()
        return mock

    def test_pipeline_initialization(self, mock_config):
        """Test pipeline initialization."""
        from ai.rag.nemotron_rag import TherapeuticRAGPipeline

        with patch("ai.rag.nemotron_rag.AsyncOpenAI"):
            pipeline = TherapeuticRAGPipeline(mock_config)

            assert pipeline.config == mock_config
            assert pipeline.store is not None
            assert len(pipeline.store) == 0

    @pytest.mark.asyncio
    async def test_document_ingestion(self, mock_config, mock_client):
        """Test document ingestion."""
        from ai.rag.nemotron_rag import TherapeuticRAGPipeline

        # Mock embedding response
        mock_embedding_response = MagicMock()
        mock_embedding_response.data = [MagicMock(embedding=[0.1] * 2048)]
        mock_client.embeddings.create.return_value = mock_embedding_response

        with patch("ai.rag.nemotron_rag.AsyncOpenAI", return_value=mock_client):
            pipeline = TherapeuticRAGPipeline(mock_config)

            doc_id = await pipeline.ingest_document(
                document="Test document content",
                metadata={
                    "category": "psychoeducation",
                    "source": "Test Source"
                }
            )

            assert doc_id is not None
            assert len(pipeline.store) == 1

    @pytest.mark.asyncio
    async def test_batch_ingestion(self, mock_config, mock_client):
        """Test batch document ingestion."""
        from ai.rag.nemotron_rag import TherapeuticRAGPipeline

        # Mock embedding responses
        mock_embedding_response = MagicMock()
        mock_embedding_response.data = [MagicMock(embedding=[0.1] * 2048)]
        mock_client.embeddings.create.return_value = mock_embedding_response

        with patch("ai.rag.nemotron_rag.AsyncOpenAI", return_value=mock_client):
            pipeline = TherapeuticRAGPipeline(mock_config)

            documents = [
                {
                    "document": "Document 1",
                    "metadata": {"category": "psychoeducation", "source": "Source 1"}
                },
                {
                    "document": "Document 2",
                    "metadata": {"category": "treatment_protocols", "source": "Source 2"}
                },
                {
                    "document": "Document 3",
                    "metadata": {"category": "crisis_protocols", "source": "Source 3"}
                }
            ]

            doc_ids = await pipeline.batch_ingest(documents)

            assert len(doc_ids) == 3
            assert len(pipeline.store) == 3

    def test_pipeline_stats(self, mock_config):
        """Test pipeline statistics."""
        from ai.rag.nemotron_rag import TherapeuticRAGPipeline

        with patch("ai.rag.nemotron_rag.AsyncOpenAI"):
            pipeline = TherapeuticRAGPipeline(mock_config)

            stats = pipeline.get_stats()

            assert "total_documents" in stats
            assert "index_type" in stats
            assert "categories" in stats
            assert stats["total_documents"] == 0


class TestVectorStore:
    """Tests for vector store operations."""

    def test_document_store_operations(self):
        """Test document store CRUD operations."""
        from ai.rag.nemotron_rag import (
            Document,
            DocumentMetadata,
            DocumentStore,
            KnowledgeCategory,
        )

        store = DocumentStore()

        # Create test document
        metadata = DocumentMetadata(
            doc_id="test-001",
            category=KnowledgeCategory.PSYCHOEDUCATION,
            source="Test"
        )
        doc = Document(
            doc_id="test-001",
            content="Test content",
            metadata=metadata,
            embedding=np.random.rand(1, 2048).astype(np.float32)
        )

        # Add document
        store.add(doc)
        assert len(store) == 1

        # Get document
        retrieved = store.get("test-001")
        assert retrieved is not None
        assert retrieved.content == "Test content"

        # Get non-existent document
        assert store.get("non-existent") is None




class TestQueryComplexity:
    """Tests for query complexity classification."""

    @pytest.fixture
    def mock_config(self):
        """Create mock config for testing."""
        from ai.rag.nemotron_rag import NemotronRAGConfig

        return NemotronRAGConfig(
            api_key="test-key",
            index_type="flat"
        )

    def test_simple_query_classification(self, mock_config):
        """Test simple query detection."""
        from ai.rag.nemotron_rag import QueryComplexity
        from unittest.mock import patch

        with patch("ai.rag.nemotron_rag.AsyncOpenAI"):
            from ai.rag.nemotron_rag import TherapeuticRAGPipeline
            pipeline = TherapeuticRAGPipeline(mock_config)

            # Simple factual queries
            assert pipeline._classify_query_complexity("What is CBT?") == QueryComplexity.SIMPLE
            assert pipeline._classify_query_complexity("Define anxiety") == QueryComplexity.SIMPLE
            assert pipeline._classify_query_complexity("List symptoms of depression") == QueryComplexity.SIMPLE

    def test_moderate_query_classification(self, mock_config):
        """Test moderate complexity query detection."""
        from ai.rag.nemotron_rag import QueryComplexity
        from unittest.mock import patch

        with patch("ai.rag.nemotron_rag.AsyncOpenAI"):
            from ai.rag.nemotron_rag import TherapeuticRAGPipeline
            pipeline = TherapeuticRAGPipeline(mock_config)

            # Multi-concept queries ("compare" triggers MODERATE)
            assert pipeline._classify_query_complexity("How does CBT compare to DBT?") == QueryComplexity.MODERATE
            assert pipeline._classify_query_complexity("What are the differences between therapy types?") == QueryComplexity.MODERATE

    def test_complex_query_classification(self, mock_config):
        """Test complex query detection."""
        from ai.rag.nemotron_rag import QueryComplexity
        from unittest.mock import patch

        with patch("ai.rag.nemotron_rag.AsyncOpenAI"):
            from ai.rag.nemotron_rag import TherapeuticRAGPipeline
            pipeline = TherapeuticRAGPipeline(mock_config)

            # Nuanced reasoning queries
            assert pipeline._classify_query_complexity("Why do I feel anxious in social situations?") == QueryComplexity.COMPLEX
            assert pipeline._classify_query_complexity("What is the underlying pattern in my thoughts?") == QueryComplexity.COMPLEX
            # " vs " triggers COMPLEX for treatment comparisons
            assert pipeline._classify_query_complexity("CBT vs DBT for anxiety treatment") == QueryComplexity.COMPLEX

    def test_crisis_query_classification(self, mock_config):
        """Test crisis query detection."""
        from ai.rag.nemotron_rag import QueryComplexity
        from unittest.mock import patch

        with patch("ai.rag.nemotron_rag.AsyncOpenAI"):
            from ai.rag.nemotron_rag import TherapeuticRAGPipeline
            pipeline = TherapeuticRAGPipeline(mock_config)

            # Crisis indicators
            assert pipeline._classify_query_complexity("I want to hurt myself") == QueryComplexity.CRISIS
            assert pipeline._classify_query_complexity("I'm thinking about suicide") == QueryComplexity.CRISIS
            assert pipeline._classify_query_complexity("I feel like ending my life") == QueryComplexity.CRISIS
            assert pipeline._classify_query_complexity("This is an emergency crisis") == QueryComplexity.CRISIS

    def test_model_selection_by_complexity(self, mock_config):
        """Test model selection based on complexity."""
        from ai.rag.nemotron_rag import QueryComplexity
        from unittest.mock import patch

        with patch("ai.rag.nemotron_rag.AsyncOpenAI"):
            from ai.rag.nemotron_rag import TherapeuticRAGPipeline
            pipeline = TherapeuticRAGPipeline(mock_config)

            # Verify model mapping
            assert pipeline.config.complexity_model_mapping[QueryComplexity.SIMPLE.value] == pipeline.config.fast_model
            assert pipeline.config.complexity_model_mapping[QueryComplexity.CRISIS.value] == pipeline.config.safety_model

class TestKnowledgeCategories:
    """Tests for knowledge categories."""

    def test_category_enum(self):
        """Test knowledge category enum values."""
        from ai.rag.nemotron_rag import KnowledgeCategory

        assert KnowledgeCategory.TREATMENT_PROTOCOLS.value == "treatment_protocols"
        assert KnowledgeCategory.CRISIS_PROTOCOLS.value == "crisis_protocols"
        assert KnowledgeCategory.PSYCHOEDUCATION.value == "psychoeducation"
        assert KnowledgeCategory.SESSION_HISTORY.value == "session_history"

    def test_therapeutic_knowledge_base(self):
        """Test therapeutic knowledge base configuration."""
        from ai.rag.nemotron_rag import (
            THERAPEUTIC_KNOWLEDGE_BASE,
            KnowledgeCategory,
        )

        assert KnowledgeCategory.TREATMENT_PROTOCOLS in THERAPEUTIC_KNOWLEDGE_BASE
        assert KnowledgeCategory.CRISIS_PROTOCOLS in THERAPEUTIC_KNOWLEDGE_BASE

        treatment = THERAPEUTIC_KNOWLEDGE_BASE[KnowledgeCategory.TREATMENT_PROTOCOLS]
        assert "description" in treatment
        assert "sources" in treatment
        assert "update_frequency" in treatment


class TestFactoryFunctions:
    """Tests for factory functions."""

    def test_create_rag_pipeline(self):
        """Test pipeline factory function."""
        from ai.rag.nemotron_rag import (
            IndexType,
            create_rag_pipeline,
        )

        with patch.dict(os.environ, {"NVIDIA_API_KEY": "test-key"}):
            pipeline = create_rag_pipeline(index_type=IndexType.FLAT)

            assert pipeline is not None
            assert pipeline.config.index_type == IndexType.FLAT

    def test_create_rag_pipeline_custom_config(self):
        """Test pipeline factory with custom config."""
        from ai.rag.nemotron_rag import create_rag_pipeline

        pipeline = create_rag_pipeline(
            api_key="custom-key",
            retrieval_top_k=100,
            reranking_top_n=20
        )

        assert pipeline.config.api_key == "custom-key"
        assert pipeline.config.retrieval_top_k == 100
        assert pipeline.config.reranking_top_n == 20


class TestConvenienceFunctions:
    """Tests for convenience functions."""

    @pytest.mark.asyncio
    @requires_nvidia_api_key
    async def test_embed_text_live(self):
        """Test live embedding generation (requires API key)."""
        from ai.rag.nemotron_rag import embed_text

        embedding = await embed_text("Test text for embedding")

        assert isinstance(embedding, np.ndarray)
        assert embedding.shape == (1, 2048)

    def test_cosine_similarity(self):
        """Test cosine similarity calculation."""
        from ai.rag.nemotron_rag import cosine_similarity

        a = np.array([[1, 0, 0]], dtype=np.float32)
        b = np.array([[1, 0, 0]], dtype=np.float32)
        c = np.array([[0, 1, 0]], dtype=np.float32)

        # Same vectors
        sim_ab = cosine_similarity(a, b)
        assert pytest.approx(sim_ab, 0.001) == 1.0

        # Orthogonal vectors
        sim_ac = cosine_similarity(a, c)
        assert pytest.approx(sim_ac, 0.001) == 0.0


class TestSystemPrompt:
    """Tests for system prompt generation."""

    @pytest.fixture
    def mock_config(self):
        """Create mock config for testing."""
        from ai.rag.nemotron_rag import NemotronRAGConfig

        return NemotronRAGConfig(
            api_key="test-key",
            index_type="flat"
        )

    def test_rag_system_prompt(self, mock_config):
        """Test RAG system prompt content."""
        from ai.rag.nemotron_rag import TherapeuticRAGPipeline

        with patch("ai.rag.nemotron_rag.AsyncOpenAI"):
            pipeline = TherapeuticRAGPipeline(mock_config)
            prompt = pipeline._get_rag_system_prompt()

            assert "Antigravity" in prompt
            assert "evidence-based" in prompt.lower()
            assert "professional consultation" in prompt.lower()
            assert "empathetic" in prompt.lower()
            assert "self-harm" in prompt.lower()


# Integration tests (require live API)
@requires_nvidia_api_key
class TestRAGPipelineIntegration:
    """Integration tests with live NVIDIA NIM API."""

    @pytest.fixture
    def live_config(self):
        """Create config with live API key."""
        from ai.rag.nemotron_rag import NemotronRAGConfig

        return NemotronRAGConfig(
            api_key=os.environ.get("NVIDIA_API_KEY"),
            index_type="flat"
        )

    @pytest.mark.asyncio
    async def test_live_ingestion_and_retrieval(self, live_config):
        """Test live document ingestion and retrieval."""
        from ai.rag.nemotron_rag import (
            KnowledgeCategory,
            TherapeuticRAGPipeline,
        )

        pipeline = TherapeuticRAGPipeline(live_config)

        # Ingest test document
        doc_id = await pipeline.ingest_document(
            document="Cognitive Behavioral Therapy (CBT) is an evidence-based "
                    "treatment for anxiety disorders. It focuses on identifying "
                    "and changing negative thought patterns.",
            metadata={
                "category": KnowledgeCategory.TREATMENT_PROTOCOLS,
                "source": "APA Guidelines",
                "title": "CBT for Anxiety"
            }
        )

        assert doc_id is not None
        assert len(pipeline.store) == 1

    @pytest.mark.asyncio
    async def test_live_query(self, live_config):
        """Test live RAG query."""
        from ai.rag.nemotron_rag import (
            KnowledgeCategory,
            TherapeuticRAGPipeline,
        )

        pipeline = TherapeuticRAGPipeline(live_config)

        # Ingest documents
        await pipeline.batch_ingest([
            {
                "document": "CBT helps identify negative thought patterns.",
                "metadata": {"category": "treatment_protocols", "source": "Guide"}
            },
            {
                "document": "Deep breathing exercises can help with anxiety.",
                "metadata": {"category": "psychoeducation", "source": "Resources"}
            }
        ])

        # Query
        response = await pipeline.query(
            "What techniques help with anxiety?"
        )

        assert response.response is not None
        assert len(response.response) > 0
        assert response.model == live_config.generation_model


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
