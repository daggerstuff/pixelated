"""
Unit Tests for Clinical Similarity Search

Tests advanced similarity search functionality for clinical knowledge retrieval.
"""

import shutil
import tempfile
from pathlib import Path
from unittest.mock import Mock

import pytest

from .clinical_knowledge_embedder import KnowledgeItem
from .clinical_similarity_search import (
    ClinicalSimilaritySearch,
    EnhancedSearchResult,
    RelevanceType,
    SearchContext,
    SearchQuery,
)
from .faiss_knowledge_index import SearchResult


class TestSearchContext:
    """Test search context enumeration."""

    def test_search_contexts(self):
        """Test all search contexts are available."""
        assert SearchContext.TRAINING.value == "training"
        assert SearchContext.INFERENCE.value == "inference"
        assert SearchContext.VALIDATION.value == "validation"
        assert SearchContext.RESEARCH.value == "research"


class TestRelevanceType:
    """Test relevance type enumeration."""

    def test_relevance_types(self):
        """Test all relevance types are available."""
        assert RelevanceType.DIAGNOSTIC.value == "diagnostic"
        assert RelevanceType.THERAPEUTIC.value == "therapeutic"
        assert RelevanceType.ASSESSMENT.value == "assessment"
        assert RelevanceType.THEORETICAL.value == "theoretical"
        assert RelevanceType.CASE_STUDY.value == "case_study"


class TestSearchQuery:
    """Test search query data structure."""

    def test_default_search_query(self):
        """Test creating a search query with defaults."""
        query = SearchQuery(text="depression symptoms")

        assert query.text == "depression symptoms"
        assert query.context == SearchContext.TRAINING
        assert query.relevance_types == []
        assert query.knowledge_types == []
        assert query.clinical_domains == []
        assert query.modalities == []
        assert query.severity_levels == []
        assert query.max_results == 10
        assert query.min_relevance_score == 0.5
        assert query.include_metadata is True

    def test_custom_search_query(self):
        """Test creating a search query with custom parameters."""
        query = SearchQuery(
            text="anxiety treatment",
            context=SearchContext.INFERENCE,
            relevance_types=[RelevanceType.THERAPEUTIC, RelevanceType.DIAGNOSTIC],
            knowledge_types=["dsm5", "pdm2"],
            clinical_domains=["anxiety", "depression"],
            modalities=["cbt", "dbt"],
            severity_levels=["moderate", "severe"],
            max_results=20,
            min_relevance_score=0.7,
            include_metadata=False,
        )

        assert query.text == "anxiety treatment"
        assert query.context == SearchContext.INFERENCE
        assert RelevanceType.THERAPEUTIC in query.relevance_types
        assert RelevanceType.DIAGNOSTIC in query.relevance_types
        assert "dsm5" in query.knowledge_types
        assert "anxiety" in query.clinical_domains
        assert "cbt" in query.modalities
        assert "moderate" in query.severity_levels
        assert query.max_results == 20
        assert query.min_relevance_score == 0.7
        assert query.include_metadata is False


class TestEnhancedSearchResult:
    """Test enhanced search result data structure."""

    def test_enhanced_search_result_creation(self):
        """Test creating an enhanced search result."""
        knowledge_item = KnowledgeItem(
            id="test_item", content="Test content about depression", knowledge_type="dsm5"
        )

        result = EnhancedSearchResult(
            knowledge_item=knowledge_item,
            similarity_score=0.85,
            relevance_score=0.75,
            combined_score=0.80,
            rank=0,
            relevance_explanation="High clinical relevance",
            clinical_domains=["depression"],
            therapeutic_relevance=0.6,
            diagnostic_relevance=0.8,
            metadata={"test": "value"},
        )

        assert result.knowledge_item == knowledge_item
        assert result.similarity_score == 0.85
        assert result.relevance_score == 0.75
        assert result.combined_score == 0.80
        assert result.rank == 0
        assert result.relevance_explanation == "High clinical relevance"
        assert "depression" in result.clinical_domains
        assert result.therapeutic_relevance == 0.6
        assert result.diagnostic_relevance == 0.8
        assert result.metadata["test"] == "value"


class TestClinicalSimilaritySearch:
    """Test clinical similarity search functionality."""

    def setup_method(self):
        """Set up test environment."""
        self.temp_dir = Path(tempfile.mkdtemp())

        # Create mock FAISS index
        self.mock_faiss_index = Mock()
        self.mock_faiss_index.search_by_text.return_value = self._create_mock_search_results()
        self.mock_faiss_index.search.return_value = self._create_mock_search_results()

        # Create mock embedder
        self.mock_embedder = Mock()
        self.mock_embedder.embedding_model = Mock()
        self.mock_embedder.embedding_model.encode.return_value = [[0.1] * 384]

    def teardown_method(self):
        """Clean up test environment."""
        if self.temp_dir.exists():
            shutil.rmtree(self.temp_dir)

    def _create_mock_search_results(self) -> List[SearchResult]:
        """Create mock search results for testing."""
        knowledge_items = [
            KnowledgeItem(
                id="depression_item",
                content="Major depressive disorder is characterized by persistent sadness and loss of interest",
                knowledge_type="dsm5",
                metadata={"category": "mood_disorders"},
            ),
            KnowledgeItem(
                id="anxiety_item",
                content="Generalized anxiety disorder involves excessive worry and anxiety",
                knowledge_type="dsm5",
                metadata={"category": "anxiety_disorders"},
            ),
            KnowledgeItem(
                id="therapy_item",
                content="Cognitive behavioral therapy is effective for treating depression and anxiety",
                knowledge_type="therapeutic_technique",
                metadata={"modality": "cbt"},
            ),
        ]

        return [
            SearchResult(
                knowledge_item=item,
                score=0.9 - i * 0.1,
                distance=0.1 + i * 0.1,
                rank=i,
                metadata={"search_time_ms": 10},
            )
            for i, item in enumerate(knowledge_items)
        ]

    def test_clinical_similarity_search_initialization(self):
        """Test initialization of clinical similarity search."""
        search_system = ClinicalSimilaritySearch(
            faiss_index=self.mock_faiss_index,
            embedder=self.mock_embedder,
            project_root=self.temp_dir,
        )

        assert search_system.faiss_index == self.mock_faiss_index
        assert search_system.embedder == self.mock_embedder
        assert search_system.project_root == self.temp_dir
        assert search_system.clinical_terms is not None
        assert search_system.diagnostic_keywords is not None
        assert search_system.therapeutic_keywords is not None

    def test_load_clinical_terms(self):
        """Test loading of clinical terms."""
        search_system = ClinicalSimilaritySearch(
            faiss_index=self.mock_faiss_index, embedder=self.mock_embedder
        )

        clinical_terms = search_system.clinical_terms

        assert "depression" in clinical_terms
        assert "anxiety" in clinical_terms
        assert "trauma" in clinical_terms
        assert "personality" in clinical_terms
        assert "psychosis" in clinical_terms

        # Check specific terms
        assert "major depressive disorder" in clinical_terms["depression"]
        assert "generalized anxiety disorder" in clinical_terms["anxiety"]
        assert "post-traumatic stress disorder" in clinical_terms["trauma"]

    def test_load_diagnostic_keywords(self):
        """Test loading of diagnostic keywords."""
        search_system = ClinicalSimilaritySearch(
            faiss_index=self.mock_faiss_index, embedder=self.mock_embedder
        )

        diagnostic_keywords = search_system.diagnostic_keywords

        assert "diagnosis" in diagnostic_keywords
        assert "symptoms" in diagnostic_keywords
        assert "disorder" in diagnostic_keywords
        assert "assessment" in diagnostic_keywords
        assert "criteria" in diagnostic_keywords

    def test_load_therapeutic_keywords(self):
        """Test loading of therapeutic keywords."""
        search_system = ClinicalSimilaritySearch(
            faiss_index=self.mock_faiss_index, embedder=self.mock_embedder
        )

        therapeutic_keywords = search_system.therapeutic_keywords

        assert "therapy" in therapeutic_keywords
        assert "treatment" in therapeutic_keywords
        assert "intervention" in therapeutic_keywords
        assert "cbt" in therapeutic_keywords
        assert "dbt" in therapeutic_keywords

    def test_basic_search_string_query(self):
        """Test basic search with string query."""
        search_system = ClinicalSimilaritySearch(
            faiss_index=self.mock_faiss_index, embedder=self.mock_embedder
        )

        results = search_system.search("depression symptoms")

        assert isinstance(results, list)
        assert len(results) > 0
        assert all(isinstance(result, EnhancedSearchResult) for result in results)

        # Check that FAISS index was called
        self.mock_embedder.embedding_model.encode.assert_called_once()
        self.mock_faiss_index.search.assert_called_once()

    def test_search_with_structured_query(self):
        """Test search with structured query object."""
        search_system = ClinicalSimilaritySearch(
            faiss_index=self.mock_faiss_index, embedder=self.mock_embedder
        )

        query = SearchQuery(
            text="anxiety treatment",
            context=SearchContext.TRAINING,
            relevance_types=[RelevanceType.THERAPEUTIC],
            max_results=5,
        )

        results = search_system.search(query)

        assert isinstance(results, list)
        assert len(results) <= 5  # Should respect max_results
        assert all(isinstance(result, EnhancedSearchResult) for result in results)

    def test_search_without_faiss_index(self):
        """Test search behavior when FAISS index is not available."""
        search_system = ClinicalSimilaritySearch(faiss_index=None, embedder=self.mock_embedder)

        results = search_system.search("test query")

        assert results == []  # Should return empty list

    def test_generate_mock_embedding(self):
        """Test mock embedding generation."""
        search_system = ClinicalSimilaritySearch(
            faiss_index=self.mock_faiss_index, embedder=self.mock_embedder
        )

        embedding = search_system._generate_mock_embedding("test text")

        assert isinstance(embedding, list)
        assert len(embedding) == 384
        assert all(isinstance(val, float) for val in embedding)
        assert all(0 <= val <= 1 for val in embedding)

    def test_extract_clinical_domains(self):
        """Test extraction of clinical domains from content."""
        search_system = ClinicalSimilaritySearch(
            faiss_index=self.mock_faiss_index, embedder=self.mock_embedder
        )

        content = "Patient presents with major depressive disorder and generalized anxiety disorder"
        domains = search_system._extract_clinical_domains(content)

        assert "depression" in domains
        assert "anxiety" in domains

    def test_calculate_clinical_relevance(self):
        """Test clinical relevance calculation."""
        search_system = ClinicalSimilaritySearch(
            faiss_index=self.mock_faiss_index, embedder=self.mock_embedder
        )

        knowledge_item = KnowledgeItem(
            id="test",
            content="Major depressive disorder symptoms include persistent sadness and loss of interest",
            knowledge_type="dsm5",
        )

        query = SearchQuery(text="depression symptoms diagnosis")

        relevance_score, explanation = search_system._calculate_clinical_relevance(
            knowledge_item, query
        )

        assert 0 <= relevance_score <= 1
        assert isinstance(explanation, str)
        assert len(explanation) > 0

    def test_calculate_therapeutic_relevance(self):
        """Test therapeutic relevance calculation."""
        search_system = ClinicalSimilaritySearch(
            faiss_index=self.mock_faiss_index, embedder=self.mock_embedder
        )

        content = "Cognitive behavioral therapy is an effective treatment intervention"
        query = "therapy treatment intervention"

        relevance = search_system._calculate_therapeutic_relevance(content, query)

        assert 0 <= relevance <= 1
        assert relevance > 0  # Should find therapeutic keywords

    def test_calculate_diagnostic_relevance(self):
        """Test diagnostic relevance calculation."""
        search_system = ClinicalSimilaritySearch(
            faiss_index=self.mock_faiss_index, embedder=self.mock_embedder
        )

        content = "Diagnostic criteria for disorder include specific symptoms and assessment"
        query = "diagnosis symptoms assessment"

        relevance = search_system._calculate_diagnostic_relevance(content, query)

        assert 0 <= relevance <= 1
        assert relevance > 0  # Should find diagnostic keywords

    def test_combine_scores_different_contexts(self):
        """Test score combination for different contexts."""
        search_system = ClinicalSimilaritySearch(
            faiss_index=self.mock_faiss_index, embedder=self.mock_embedder
        )

        similarity_score = 0.8
        relevance_score = 0.6

        # Test different contexts
        training_score = search_system._combine_scores(
            similarity_score, relevance_score, SearchContext.TRAINING
        )
        inference_score = search_system._combine_scores(
            similarity_score, relevance_score, SearchContext.INFERENCE
        )
        validation_score = search_system._combine_scores(
            similarity_score, relevance_score, SearchContext.VALIDATION
        )
        research_score = search_system._combine_scores(
            similarity_score, relevance_score, SearchContext.RESEARCH
        )

        # All scores should be between 0 and 1
        assert 0 <= training_score <= 1
        assert 0 <= inference_score <= 1
        assert 0 <= validation_score <= 1
        assert 0 <= research_score <= 1

        # Training should prioritize relevance more
        assert (
            training_score < validation_score
        )  # Training prioritizes relevance, validation prioritizes similarity

    def test_apply_filters(self):
        """Test application of filters to search results."""
        search_system = ClinicalSimilaritySearch(
            faiss_index=self.mock_faiss_index, embedder=self.mock_embedder
        )

        # Create test results
        results = [
            EnhancedSearchResult(
                knowledge_item=KnowledgeItem(id="1", content="test", knowledge_type="dsm5"),
                similarity_score=0.9,
                relevance_score=0.8,
                combined_score=0.85,
                rank=0,
                relevance_explanation="test",
                clinical_domains=["depression"],
                diagnostic_relevance=0.7,
            ),
            EnhancedSearchResult(
                knowledge_item=KnowledgeItem(id="2", content="test", knowledge_type="pdm2"),
                similarity_score=0.7,
                relevance_score=0.3,  # Below threshold
                combined_score=0.5,
                rank=1,
                relevance_explanation="test",
                clinical_domains=["anxiety"],
            ),
        ]

        query = SearchQuery(text="test", knowledge_types=["dsm5"], min_relevance_score=0.6)

        filtered_results = search_system._apply_filters(results, query)

        assert len(filtered_results) == 1  # Only first result should pass filters
        assert filtered_results[0].knowledge_item.id == "1"

    def test_rerank_results(self):
        """Test re-ranking of results by combined score."""
        search_system = ClinicalSimilaritySearch(
            faiss_index=self.mock_faiss_index, embedder=self.mock_embedder
        )

        # Create results with different combined scores
        results = [
            EnhancedSearchResult(
                knowledge_item=KnowledgeItem(id="1", content="test"),
                similarity_score=0.5,
                relevance_score=0.5,
                combined_score=0.5,
                rank=0,
                relevance_explanation="test",
            ),
            EnhancedSearchResult(
                knowledge_item=KnowledgeItem(id="2", content="test"),
                similarity_score=0.9,
                relevance_score=0.9,
                combined_score=0.9,
                rank=1,
                relevance_explanation="test",
            ),
        ]

        query = SearchQuery(text="test", max_results=10)

        reranked_results = search_system._rerank_results(results, query)

        assert len(reranked_results) == 2
        assert reranked_results[0].knowledge_item.id == "2"  # Higher score should be first
        assert reranked_results[0].rank == 0  # Rank should be updated
        assert reranked_results[1].rank == 1

    def test_search_by_clinical_domain(self):
        """Test search by clinical domain."""
        search_system = ClinicalSimilaritySearch(
            faiss_index=self.mock_faiss_index, embedder=self.mock_embedder
        )

        results = search_system.search_by_clinical_domain("depression")

        assert isinstance(results, list)
        # Should have called the main search method
        self.mock_embedder.embedding_model.encode.assert_called()

    def test_search_by_unknown_domain(self):
        """Test search by unknown clinical domain."""
        search_system = ClinicalSimilaritySearch(
            faiss_index=self.mock_faiss_index, embedder=self.mock_embedder
        )

        results = search_system.search_by_clinical_domain("unknown_domain")

        assert results == []  # Should return empty list for unknown domain

    def test_search_for_training_examples(self):
        """Test search for training examples."""
        search_system = ClinicalSimilaritySearch(
            faiss_index=self.mock_faiss_index, embedder=self.mock_embedder
        )

        results = search_system.search_for_training_examples("panic attacks", "cbt")

        assert isinstance(results, list)
        # Should have called the main search method
        self.mock_embedder.embedding_model.encode.assert_called()

    def test_get_search_suggestions(self):
        """Test search suggestions generation."""
        search_system = ClinicalSimilaritySearch(
            faiss_index=self.mock_faiss_index, embedder=self.mock_embedder
        )

        suggestions = search_system.get_search_suggestions("depr")

        assert isinstance(suggestions, list)
        assert len(suggestions) <= 10  # Should limit to 10 suggestions

        # Should include depression-related suggestions
        depression_suggestions = [s for s in suggestions if "depression" in s.lower()]
        assert depression_suggestions

    def test_get_search_suggestions_partial_match(self):
        """Test search suggestions with partial matches."""
        search_system = ClinicalSimilaritySearch(
            faiss_index=self.mock_faiss_index, embedder=self.mock_embedder
        )

        suggestions = search_system.get_search_suggestions("cogn")

        assert isinstance(suggestions, list)

        # Should include cognitive-related suggestions
        cognitive_suggestions = [s for s in suggestions if "cognitive" in s.lower()]
        assert cognitive_suggestions


class TestIntegration:
    """Integration tests for clinical similarity search."""

    def setup_method(self):
        """Set up integration test environment."""
        self.temp_dir = Path(tempfile.mkdtemp())

    def teardown_method(self):
        """Clean up integration test environment."""
        if self.temp_dir.exists():
            shutil.rmtree(self.temp_dir)

    def test_end_to_end_search_workflow(self):
        """Test complete search workflow."""
        # Create mock components
        mock_faiss_index = Mock()
        mock_embedder = Mock()

        # Setup mock returns
        mock_knowledge_items = [
            KnowledgeItem(
                id="depression_dsm5",
                content="Major depressive disorder diagnostic criteria include depressed mood",
                knowledge_type="dsm5",
            ),
            KnowledgeItem(
                id="cbt_therapy",
                content="Cognitive behavioral therapy techniques for depression treatment",
                knowledge_type="therapeutic_technique",
            ),
        ]

        mock_search_results = [
            SearchResult(knowledge_item=item, score=0.9 - i * 0.1, distance=0.1 + i * 0.1, rank=i)
            for i, item in enumerate(mock_knowledge_items)
        ]

        mock_faiss_index.search.return_value = mock_search_results
        mock_embedder.embedding_model = Mock()
        mock_embedder.embedding_model.encode.return_value = [[0.1] * 384]

        # Initialize search system
        search_system = ClinicalSimilaritySearch(
            faiss_index=mock_faiss_index, embedder=mock_embedder, project_root=self.temp_dir
        )

        # Perform comprehensive search
        query = SearchQuery(
            text="depression diagnosis and treatment",
            context=SearchContext.TRAINING,
            relevance_types=[RelevanceType.DIAGNOSTIC, RelevanceType.THERAPEUTIC],
            knowledge_types=["dsm5", "therapeutic_technique"],
            max_results=5,
            min_relevance_score=0.3,
        )

        results = search_system.search(query)

        # Verify results
        assert isinstance(results, list)
        assert len(results) <= 5
        assert all(isinstance(result, EnhancedSearchResult) for result in results)

        # Verify that all results meet minimum relevance score
        assert all(result.combined_score >= 0.3 for result in results)

        # Verify that results are ranked properly
        for i in range(len(results) - 1):
            assert results[i].combined_score >= results[i + 1].combined_score


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
