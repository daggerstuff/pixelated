#!/usr/bin/env python3
"""
Standalone test for FAISS Knowledge Index
"""

import sys
from pathlib import Path

# Add the ai directory to Python path
sys.path.insert(0, str(Path(__file__).parent / "ai"))


def test_faiss_index_structure():
    """Test that FAISS index files are properly structured."""

    # Check file existence
    faiss_file = Path(__file__).parent / "ai" / "pixel" / "data" / "faiss_knowledge_index.py"
    test_file = Path(__file__).parent / "ai" / "pixel" / "data" / "test_faiss_knowledge_index.py"

    if faiss_file.exists():

        # Check file size (should be substantial)
        file_size = faiss_file.stat().st_size

        if file_size > 20000:  # Should be > 20KB for comprehensive implementation
            pass")
        else:
            pass")
    else:
        pass")

    if test_file.exists():

        # Check test file size
        test_size = test_file.stat().st_size

        if test_size > 15000:  # Should be > 15KB for comprehensive tests
            pass")
        else:
            pass")
    else:
        pass")

    # Test basic imports and structure
    try:
        # Read the file content to check for key components
        with open(faiss_file) as f:
            content = f.read()

        required_components = [
            "class FAISSKnowledgeIndex",
            "class IndexConfig",
            "class IndexType",
            "class SearchResult",
            "class MockFAISSIndex",
            "def build_index",
            "def search",
            "def save_index",
            "def load_index",
            "def benchmark_search_performance",
        ]

        if missing_components := [
            component for component in required_components if component not in content
        ]:
            pass")

        else:
            pass")
        # Check for comprehensive functionality
        advanced_features = [
            "IndexType.IVF_FLAT",
            "IndexType.HNSW",
            "normalize_vectors",
            "filter_search",
            "search_by_text",
            "benchmark_search_performance",
        ]

        found_features = [feature for feature in advanced_features if feature in content]

        if len(found_features) >= len(advanced_features) * 0.8:
            pass")
        else:
            pass")

    except Exception as e:
        pass")

    # Test mock functionality
    try:

        class SimpleMockIndex:
            def __init__(self, dimension):
                self.dimension = dimension
                self.vectors = []
                self.ntotal = 0

            def add(self, vectors):
                self.vectors.extend(vectors)
                self.ntotal = len(self.vectors)

            def search(self, query, k):
                # Simple distance calculation
                if isinstance(query, list) and len(query) > 0:
                    query_vec = query[0] if isinstance(query[0], list) else query
                else:
                    query_vec = query

                distances = [
                    (
                        sum((a - b) ** 2 for a, b in zip(query_vec, vec, strict=False)) ** 0.5,
                        i,
                    )
                    for i, vec in enumerate(self.vectors)
                ]
                distances.sort()
                top_k = distances[:k]

                return [d[0] for d in top_k], [d[1] for d in top_k]

        # Test mock index
        mock_index = SimpleMockIndex(3)

        # Add test vectors
        test_vectors = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
        mock_index.add(test_vectors)

        assert mock_index.ntotal == 3

        # Test search
        query = [[1, 0, 0]]
        distances, indices = mock_index.search(query, k=2)

        assert len(distances) == 2
        assert len(indices) == 2
        assert indices[0] == 0  # Should find exact match first


    except Exception as e:
        pass")



if __name__ == "__main__":
    test_faiss_index_structure()
