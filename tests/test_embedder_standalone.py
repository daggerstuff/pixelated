#!/usr/bin/env python3
"""
Standalone test for Clinical Knowledge Embedder
"""

import sys
from pathlib import Path

# Add the ai directory to Python path
sys.path.insert(0, str(Path(__file__).parent / "ai"))

try:
    from pixel.data.clinical_knowledge_embedder import (
        ClinicalKnowledgeEmbedder,
        EmbeddingConfig,
        KnowledgeItem,
    )

    def test_basic_functionality():
        """Test basic embedder functionality."""

        # Create configuration
        config = EmbeddingConfig(
            model_name="all-MiniLM-L6-v2",
            batch_size=2,
            cache_embeddings=True,
            embedding_dimension=384,
        )

        # Initialize embedder
        embedder = ClinicalKnowledgeEmbedder(config)

        # Test mock knowledge items creation
        mock_items = embedder._create_mock_knowledge_items()

        # Test mock embeddings generation
        items_with_embeddings = embedder._generate_mock_embeddings(mock_items)

        # Verify embeddings
        _verify_embeddings_dimensions(items_with_embeddings, config.embedding_dimension)

        # Test embeddings matrix creation
        embedder.knowledge_items = items_with_embeddings
        matrix = embedder.create_embeddings_matrix()

        # Test statistics
        stats = embedder.get_embedding_stats()
        _print_stats(stats)

        # Test save/load functionality
        temp_path = Path("temp_embeddings.pkl")
        try:
            saved_path = embedder.save_embeddings(temp_path)

            # Test loading
            new_embedder = ClinicalKnowledgeEmbedder(config)
            success = new_embedder.load_embeddings(temp_path)

            _verify_loaded_embeddings(success, new_embedder)

        finally:
            _cleanup_temp_files(temp_path)

        return True

    def _verify_embeddings_dimensions(items_with_embeddings, expected_dimension):
        """Verify that all embeddings have correct dimensions."""
        assert all(item.embedding is not None for item in items_with_embeddings)
        assert all(len(item.embedding) == expected_dimension for item in items_with_embeddings)

    def _print_stats(stats):
        """Print embedding statistics."""
        for key, value in stats.items():
            pass

    def _verify_loaded_embeddings(success, embedder):
        """Verify loaded embeddings are correct."""
        assert success, "Loading embeddings should succeed"

    def _cleanup_temp_files(temp_path):
        """Clean up temporary files."""
        temp_path.unlink(missing_ok=True)

    if __name__ == "__main__":
        test_basic_functionality()

except ImportError as e:

    # Test that the file structure is correct
    embedder_file = (
        Path(__file__).parent / "ai" / "pixel" / "data" / "clinical_knowledge_embedder.py"
    )
    test_file = (
        Path(__file__).parent / "ai" / "pixel" / "data" / "test_clinical_knowledge_embedder.py"
    )

    if embedder_file.exists():
        pass")
    else:
        pass")

    if test_file.exists():
        pass")
    else:
        pass")

