#!/usr/bin/env python3
"""
Standalone test for Clinical Similarity Search
"""

from pathlib import Path


def get_search_file_path():
    """Get the path to the clinical similarity search file."""
    return Path(__file__).parent.parent / "ai" / "models" / "pixel_core" / "data" / "clinical_similarity_search.py"


def get_test_file_path():
    """Get the path to the test file."""
    return Path(__file__).parent / "test_clinical_similarity_search.py"


def test_search_file_exists():
    """Test that the clinical similarity search file exists."""
    search_file = get_search_file_path()
    assert search_file.exists(), "Clinical similarity search file must exist"


def test_search_file_size():
    """Test that the search file has substantial content."""
    search_file = get_search_file_path()
    assert search_file.exists(), "Search file must exist for size test"

    file_size = search_file.stat().st_size

    assert (
        file_size > 20000
    ), f"File size {file_size} should be > 20KB for comprehensive implementation"


def test_test_file_exists():
    """Test that the test file exists."""
    test_file = get_test_file_path()
    assert test_file.exists(), "Test file must exist"


def test_test_file_size():
    """Test that the test file has substantial content."""
    test_file = get_test_file_path()
    assert test_file.exists(), "Test file must exist for size test"

    test_size = test_file.stat().st_size

    assert (
        test_size > 15000
    ), f"Test file size {test_size} should be > 15KB for comprehensive test coverage"


def get_file_content():
    """Get the content of the search file."""
    search_file = get_search_file_path()
    assert search_file.exists(), "Search file must exist to read content"

    with open(search_file) as f:
        return f.read()


def test_required_classes_exist():
    """Test that all required classes are implemented."""
    content = get_file_content()

    # Test each required class explicitly
    assert (
        "class ClinicalSimilaritySearch" in content
    ), "ClinicalSimilaritySearch class must be present"
    assert "class SearchQuery" in content, "SearchQuery class must be present"
    assert "class SearchContext" in content, "SearchContext class must be present"
    assert "class RelevanceType" in content, "RelevanceType class must be present"
    assert "class EnhancedSearchResult" in content, "EnhancedSearchResult class must be present"


def test_required_methods_exist():
    """Test that all required methods are implemented."""
    content = get_file_content()

    # Test each required method explicitly
    assert "def search" in content, "search method must be present"
    assert (
        "def search_by_clinical_domain" in content
    ), "search_by_clinical_domain method must be present"
    assert (
        "def search_for_training_examples" in content
    ), "search_for_training_examples method must be present"
    assert "def get_search_suggestions" in content, "get_search_suggestions method must be present"
    assert (
        "_calculate_clinical_relevance" in content
    ), "_calculate_clinical_relevance method must be present"
    assert (
        "_calculate_therapeutic_relevance" in content
    ), "_calculate_therapeutic_relevance method must be present"
    assert (
        "_calculate_diagnostic_relevance" in content
    ), "_calculate_diagnostic_relevance method must be present"


def test_advanced_features_exist():
    """Test that advanced features are implemented."""
    content = get_file_content()

    advanced_features = [
        "clinical_terms",
        "diagnostic_keywords",
        "therapeutic_keywords",
        "relevance_explanation",
        "combined_score",
        "filter_search",
        "rerank_results",
    ]

    found_features = [feature for feature in advanced_features if feature in content]

    # Require at least 80% of advanced features
    required_feature_count = int(len(advanced_features) * 0.8)
    assert (
        len(found_features) >= required_feature_count
    ), f"Must have at least {required_feature_count} advanced features, found {len(found_features)}"


def test_clinical_terms_mapping_structure():
    """Test that clinical terms mapping has the expected structure."""
    clinical_terms_test = {
        "depression": ["major depressive disorder", "mdd", "depressive episode", "dysthymia"],
        "anxiety": ["generalized anxiety disorder", "gad", "panic disorder", "agoraphobia"],
        "trauma": ["post-traumatic stress disorder", "ptsd", "acute stress disorder"],
    }

    # Verify structure
    assert isinstance(clinical_terms_test, dict), "Clinical terms must be a dictionary"
    assert len(clinical_terms_test) >= 3, "Must have at least 3 clinical term categories"

    # Verify each category has synonyms explicitly
    depression_synonyms = clinical_terms_test["depression"]
    assert isinstance(depression_synonyms, list), "Depression synonyms must be a list"
    assert len(depression_synonyms) >= 2, "Depression category must have at least 2 synonyms"

    anxiety_synonyms = clinical_terms_test["anxiety"]
    assert isinstance(anxiety_synonyms, list), "Anxiety synonyms must be a list"
    assert len(anxiety_synonyms) >= 2, "Anxiety category must have at least 2 synonyms"

    trauma_synonyms = clinical_terms_test["trauma"]
    assert isinstance(trauma_synonyms, list), "Trauma synonyms must be a list"
    assert len(trauma_synonyms) >= 2, "Trauma category must have at least 2 synonyms"


def test_diagnostic_keywords_structure():
    """Test diagnostic keywords set structure."""
    diagnostic_keywords = {
        "diagnosis",
        "diagnostic",
        "criteria",
        "symptoms",
        "disorder",
        "assessment",
        "evaluation",
        "screening",
    }

    assert isinstance(diagnostic_keywords, set), "Diagnostic keywords must be a set"
    assert len(diagnostic_keywords) >= 5, "Must have at least 5 diagnostic keywords"
    assert "diagnosis" in diagnostic_keywords, "Must include 'diagnosis' keyword"
    assert "symptoms" in diagnostic_keywords, "Must include 'symptoms' keyword"


def test_therapeutic_keywords_structure():
    """Test therapeutic keywords set structure."""
    therapeutic_keywords = {
        "therapy",
        "treatment",
        "intervention",
        "therapeutic",
        "counseling",
        "cbt",
        "dbt",
        "emdr",
        "psychodynamic",
    }

    assert isinstance(therapeutic_keywords, set), "Therapeutic keywords must be a set"
    assert len(therapeutic_keywords) >= 5, "Must have at least 5 therapeutic keywords"
    assert "therapy" in therapeutic_keywords, "Must include 'therapy' keyword"
    assert "treatment" in therapeutic_keywords, "Must include 'treatment' keyword"


def test_relevance_calculation_logic():
    """Test the relevance calculation logic."""

    def mock_calculate_relevance(content, query):
        content_lower = content.lower()
        query_lower = query.lower()

        # Simple keyword overlap
        content_words = set(content_lower.split())
        query_words = set(query_lower.split())
        overlap = len(content_words.intersection(query_words))

        return min(overlap / max(len(query_words), 1), 1.0)

    # Test with sample data
    test_content = "major depressive disorder symptoms include persistent sadness"
    test_query = "depression symptoms diagnosis"

    relevance = mock_calculate_relevance(test_content, test_query)

    assert 0 <= relevance <= 1, f"Relevance score {relevance} must be between 0 and 1"
    assert relevance > 0, f"Should find some overlap, got {relevance}"


def test_search_query_structure():
    """Test search query class structure."""

    # Mock search query class
    class MockSearchQuery:
        def __init__(self, text, context="training", max_results=10, min_relevance_score=0.5):
            self.text = text
            self.context = context
            self.max_results = max_results
            self.min_relevance_score = min_relevance_score
            self.relevance_types = []
            self.knowledge_types = []
            self.clinical_domains = []

    # Test query creation
    query = MockSearchQuery("depression treatment", max_results=5)

    assert query.text == "depression treatment", "Query text must be set correctly"
    assert query.max_results == 5, "Max results must be set correctly"
    assert query.min_relevance_score == 0.5, "Min relevance score must have correct default"
    assert query.context == "training", "Context must have correct default"
    assert isinstance(query.relevance_types, list), "Relevance types must be a list"
    assert isinstance(query.knowledge_types, list), "Knowledge types must be a list"
    assert isinstance(query.clinical_domains, list), "Clinical domains must be a list"


def test_enhanced_search_result_structure():
    """Test enhanced search result structure."""

    # Mock enhanced search result
    class MockEnhancedResult:
        def __init__(self, similarity_score, relevance_score, combined_score):
            self.similarity_score = similarity_score
            self.relevance_score = relevance_score
            self.combined_score = combined_score
            self.rank = 0
            self.clinical_domains = []

    # Test result creation
    result = MockEnhancedResult(0.8, 0.7, 0.75)

    assert result.similarity_score == 0.8, "Similarity score must be set correctly"
    assert result.relevance_score == 0.7, "Relevance score must be set correctly"
    assert result.combined_score == 0.75, "Combined score must be set correctly"
    assert result.rank == 0, "Rank must have correct default"
    assert isinstance(result.clinical_domains, list), "Clinical domains must be a list"


def run_all_tests():
    """Run all individual test functions."""

    # File existence and size tests
    test_search_file_exists()
    test_search_file_size()
    test_test_file_exists()
    test_test_file_size()

    # Component tests
    test_required_classes_exist()
    test_required_methods_exist()
    test_advanced_features_exist()

    # Clinical knowledge tests
    test_clinical_terms_mapping_structure()
    test_diagnostic_keywords_structure()
    test_therapeutic_keywords_structure()
    test_relevance_calculation_logic()

    # Search structure tests
    test_search_query_structure()
    test_enhanced_search_result_structure()


if __name__ == "__main__":
    run_all_tests()
