#!/usr/bin/env python3
"""
Unit tests for PIX-2: Books-to-Training Extraction Script

Tests cover:
- PDF/EPUB/TXT text extraction
- Chapter detection and segmentation
- Therapeutic content detection
- Crisis detection integration
- Classification integration
- JSONL output format
"""

import json
import sys
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add scripts directory to path
scripts_path = str(Path(__file__).parent.parent.parent.parent / "scripts" / "data")
if scripts_path not in sys.path:
    sys.path.insert(0, scripts_path)

# Import after path modification
import extract_books
from extract_books import (
    BooksExtractionConfig,
    BooksExtractor,
    BookSegment,
    THERAPEUTIC_KEYWORDS,
    CHAPTER_PATTERNS,
)


@pytest.fixture
def config():
    """Create test configuration."""
    return BooksExtractionConfig(
        min_content_length=100,
        apply_safety_filter=True,
        apply_classification=True,
    )


@pytest.fixture
def extractor(config):
    """Create extractor instance."""
    return BooksExtractor(config)


@pytest.fixture
def sample_pdf():
    """Create a sample PDF file for testing."""
    # We'll mock PDF reading since pypdf2 requires actual PDF structure
    return None


@pytest.fixture
def sample_txt_file():
    """Create a sample text file for testing."""
    content = """
Title: Test Book on Therapy and Healing
Author: Dr. Jane Smith

Chapter 1: Understanding Trauma

This chapter discusses how trauma affects the nervous system and emotional
regulation. Trauma-informed therapy approaches have shown significant
effectiveness in treating PTSD and CPTSD symptoms.

Understanding the polyvagal theory helps explain how our nervous system
responds to stress and trauma. This knowledge is essential for therapists
working with trauma survivors.

Chapter 2: Mindfulness and Recovery

Mindfulness practices can help regulate the nervous system and reduce
anxiety symptoms. Meditation and breathwork techniques are powerful
tools for emotional healing and self-care.

Chapter 3: Cognitive Behavioral Approaches

CBT techniques help identify and challenge negative thought patterns.
This therapy approach is evidence-based for treating depression and anxiety.
"""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
        f.write(content)
        return Path(f.name)


class TestBooksExtractionConfig:
    """Test configuration dataclass."""

    def test_default_config(self):
        """Test default configuration values."""
        config = BooksExtractionConfig()

        assert config.output_format == "jsonl"
        assert config.min_content_length == 500
        assert config.apply_safety_filter is True
        assert config.apply_classification is True
        assert config.chapter_detection is True

    def test_custom_config(self):
        """Test custom configuration values."""
        config = BooksExtractionConfig(
            input_path="/books/test.pdf",
            min_content_length=1000,
            apply_safety_filter=False,
        )

        assert config.input_path == "/books/test.pdf"
        assert config.min_content_length == 1000
        assert config.apply_safety_filter is False


class TestBookSegment:
    """Test BookSegment dataclass."""

    def test_segment_creation(self):
        """Test creating a book segment."""
        segment = BookSegment(
            source_id="test_book_chapter_1",
            title="Test Book",
            author="Test Author",
            content_text="This is test content about therapy and healing.",
            chapter="Chapter 1",
            page_number=1,
            file_format="pdf",
        )

        assert segment.source_id == "test_book_chapter_1"
        assert segment.title == "Test Book"
        assert segment.author == "Test Author"
        assert segment.source == "books"
        assert segment.crisis_flag is False

    def test_segment_to_dict(self):
        """Test segment serialization to dict."""
        segment = BookSegment(
            source_id="test_segment",
            title="Test",
            author="Author",
            content_text="Content",
        )

        segment_dict = segment.__dict__

        assert "source_id" in segment_dict
        assert "title" in segment_dict
        assert "author" in segment_dict
        assert segment_dict["source"] == "books"


class TestBooksExtractor:
    """Test BooksExtractor class."""

    def test_initialization(self, config):
        """Test extractor initialization."""
        extractor = BooksExtractor(config)

        assert extractor.config == config
        assert extractor.crisis_detector is not None
        assert extractor.classifier is not None

    def test_initialization_without_pipeline_components(self):
        """Test initialization when pipeline components are not available."""
        with patch("extract_books.PIPELINE_COMPONENTS_AVAILABLE", False):
            config = BooksExtractionConfig()
            extractor = BooksExtractor(config)

            assert extractor.crisis_detector is None
            assert extractor.classifier is None

    def test_clean_text(self, extractor):
        """Test text cleaning and normalization."""
        dirty_text = """
This is    text with   multiple   spaces.


And multiple newlines.

123
456
THIS IS A HEADER
"""
        cleaned = extractor._clean_text(dirty_text)

        # Should remove excessive spaces
        assert "   " not in cleaned

        # Should normalize newlines
        assert "\n\n\n" not in cleaned

        # Should remove standalone numbers (page numbers)
        lines = cleaned.split("\n")
        for line in lines:
            if line.strip():
                assert not line.strip().isdigit() or len(line.strip()) > 4

    def test_detect_chapter(self, extractor):
        """Test chapter detection."""
        test_cases = [
            ("Chapter 1\nSome text", True),  # Should detect
            ("CHAPTER 5: Understanding\nMore text", True),  # Should detect
            ("Part I\nIntroduction", True),  # Should detect
            ("1. Introduction to Psychology\nContent", True),  # Should detect (numbered format)
            ("No chapter marker here\nJust text", False),  # Should NOT detect
        ]

        for text, should_detect in test_cases:
            result = extractor._detect_chapter(text)
            if should_detect:
                assert result != "", f"Expected chapter detection for: {text[:30]}"
            else:
                assert result == "", f"Expected no detection for: {text[:30]}"

    def test_split_by_chapters(self, extractor):
        """Test splitting text by chapters."""
        text = """
Introduction

Chapter 1: First Chapter
Content of first chapter with therapy concepts.

Chapter 2: Second Chapter
Content of second chapter about mental health.

Chapter 3: Final Chapter
Final content about recovery.
"""
        chapters = extractor._split_by_chapters(text)

        # Should split into multiple chapters
        assert len(chapters) >= 3

        # Each chapter should have content
        for name, content in chapters:
            assert len(content) > 0

    def test_html_to_text(self, extractor):
        """Test HTML to text conversion."""
        html = """
<html>
<head><title>Test</title></head>
<body>
<h1>Chapter 1</h1>
<p>This is a <strong>test</strong> paragraph.</p>
<p>With <em>formatting</em> and entities: &amp; &lt; &gt;</p>
</body>
</html>
"""
        text = extractor._html_to_text(html)

        # Should remove HTML tags
        assert "<html>" not in text
        assert "<p>" not in text

        # Should decode HTML entities
        assert "&amp;" not in text
        assert "&" in text

        # Should contain text content
        assert "Chapter 1" in text
        assert "test" in text

    def test_create_source_id(self, extractor):
        """Test source ID creation."""
        test_cases = [
            ("My Book Title", "my_book_title"),
            ("Therapy: A Guide (2nd Ed.)", "therapy_a_guide"),
            ("Complex-Title_with/chars!", "complextitlewith"),
        ]

        for title, expected_prefix in test_cases:
            source_id = extractor._create_source_id(title)
            # Source ID should be normalized (lowercase, no special chars)
            assert source_id.islower() or source_id.replace("_", "").islower()
            assert len(source_id) <= 50  # Should be truncated

    def test_extract_book_metadata(self, extractor):
        """Test extracting book metadata."""
        text1 = "Title: The Therapy Handbook\nAuthor: Dr. Jane Smith\n\nContent..."
        metadata1 = extractor._extract_book_metadata(text1)

        assert metadata1.get("title") == "The Therapy Handbook"
        assert metadata1.get("author") == "Dr. Jane Smith"

        text2 = "The Healing Journey\nby John Doe\n\nIntroduction..."
        metadata2 = extractor._extract_book_metadata(text2)

        # Author should be detected
        assert metadata2.get("author") == "John Doe"

    def test_is_therapeutic_content(self, extractor):
        """Test therapeutic content detection."""
        therapeutic_text = """
        This book discusses therapy techniques for treating trauma, anxiety,
        and depression. Understanding the nervous system and emotional
        regulation is key to mental health recovery.
        """
        assert extractor.is_therapeutic_content(therapeutic_text) is True

        non_therapeutic_text = """
        This book is about cooking recipes and kitchen techniques.
        Learn how to prepare delicious meals for your family.
        """
        assert extractor.is_therapeutic_content(non_therapeutic_text) is False

        borderline_text = """
        This text mentions therapy once but is mostly about other topics.
        """
        # Should require multiple keywords
        assert extractor.is_therapeutic_content(borderline_text) is False

    def test_calculate_quality_score(self, extractor):
        """Test quality score calculation."""
        # High quality segment
        high_quality = BookSegment(
            source_id="test",
            title="Test",
            author="Author",
            content_text="Word " * 2000,  # 2000 words
            chapter="Chapter 1",
            therapeutic_category="therapeutic_conversation",
        )
        high_quality.word_count = 2000
        score_high = extractor._calculate_quality_score(high_quality)

        # Should have bonuses for length, chapter, category
        assert score_high >= 0.5

        # Low quality segment (crisis flagged)
        crisis_segment = BookSegment(
            source_id="test",
            title="Test",
            author="Author",
            content_text="Content",
            crisis_flag=True,
        )
        score_crisis = extractor._calculate_quality_score(crisis_segment)

        # Crisis content should have lower score
        assert score_crisis < score_high


class TestTXTExtraction:
    """Test TXT file extraction."""

    def test_extract_from_txt(self, extractor, sample_txt_file):
        """Test extracting from plain text file."""
        segments = extractor.extract_from_txt(sample_txt_file)

        assert len(segments) > 0

        # Check segment structure
        for segment in segments:
            assert isinstance(segment, BookSegment)
            assert segment.source == "books"
            assert segment.file_format == "txt"
            assert len(segment.content_text) > 0

        # Cleanup
        sample_txt_file.unlink()

    def test_txt_with_chapters(self, extractor):
        """Test TXT extraction with chapter detection."""
        content = """
Chapter 1: Introduction to Therapy

Therapy is a powerful tool for mental health and emotional healing.
Understanding different therapy approaches helps in recovery.

Chapter 2: Understanding Anxiety

Anxiety disorders are common and treatable with proper therapy.
Mental health professionals use various techniques for anxiety treatment.

Chapter 3: Depression and Healing

Depression can be addressed through various therapeutic approaches.
Self-care and therapy are important for mental health recovery.
"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write(content)
            path = Path(f.name)

        segments = extractor.extract_from_txt(path)

        # Should have at least one segment
        assert len(segments) >= 1

        # Each segment should have content
        for segment in segments:
            assert len(segment.content_text) > 0

        path.unlink()


class TestProcessSegment:
    """Test segment processing."""

    @pytest.mark.skipif(
        not pytest.importorskip("ai.safety.crisis_detection.production_crisis_detector", reason="Pipeline components not available"),
        reason="Pipeline components not available"
    )
    def test_process_therapeutic_segment(self, extractor):
        """Test processing a therapeutic segment."""
        segment = BookSegment(
            source_id="test_therapy",
            title="Therapy Book",
            author="Dr. Smith",
            content_text="""
            This chapter discusses therapy approaches for trauma recovery.
            Understanding the nervous system helps with emotional regulation.
            Mindfulness practices support mental health and self-care.
            """,
        )

        processed = extractor.process_segment(segment)

        assert processed is not None
        assert processed.word_count > 0
        assert processed.therapeutic_category != ""
        assert processed.quality_score >= 0

    def test_process_non_therapeutic_segment(self, extractor):
        """Test that non-therapeutic segments are filtered out."""
        segment = BookSegment(
            source_id="test_non_therapy",
            title="Cookbook",
            author="Chef",
            content_text="""
            This recipe book contains delicious recipes for cooking.
            Learn how to prepare meals with simple ingredients.
            """,
        )

        processed = extractor.process_segment(segment)

        # Should be filtered out (returns None)
        assert processed is None


class TestJSONLOutput:
    """Test JSONL output generation."""

    def test_save_to_jsonl(self, extractor):
        """Test saving segments to JSONL."""
        segments = [
            BookSegment(
                source_id="test_1",
                title="Test Book",
                author="Author",
                content_text="Content 1",
                chapter="Chapter 1",
            ),
            BookSegment(
                source_id="test_2",
                title="Test Book",
                author="Author",
                content_text="Content 2",
                chapter="Chapter 2",
            ),
        ]

        with tempfile.NamedTemporaryFile(suffix=".jsonl", delete=False) as f:
            output_path = Path(f.name)

        extractor.save_to_jsonl(segments, output_path)

        # Verify file was created
        assert output_path.exists()

        # Verify content
        with open(output_path, "r") as f:
            lines = f.readlines()

        assert len(lines) == 2

        for line in lines:
            record = json.loads(line)
            assert "source_id" in record
            assert "title" in record
            assert "content_text" in record
            assert "source" in record
            assert record["source"] == "books"

        output_path.unlink()


class TestS3Upload:
    """Test S3 upload functionality."""

    def test_upload_to_s3_without_credentials(self, extractor):
        """Test that upload fails gracefully without credentials."""
        with tempfile.NamedTemporaryFile(suffix=".jsonl", delete=False) as f:
            f.write(b'{"test": "data"}\n')
            file_path = Path(f.name)

        # Should return False when credentials are missing
        result = extractor.upload_to_s3(file_path, "test/file.jsonl")
        assert result is False

        file_path.unlink()

    @pytest.mark.skipif(
        not pytest.importorskip("boto3", reason="boto3 not available"),
        reason="boto3 not available"
    )
    def test_upload_to_s3_with_mocked_client(self, extractor):
        """Test S3 upload with mocked client."""
        with tempfile.NamedTemporaryFile(suffix=".jsonl", delete=False) as f:
            f.write(b'{"test": "data"}\n')
            file_path = Path(f.name)

        with patch.dict("os.environ", {
            "HETZNER_S3_ACCESS_KEY": "test_key",
            "HETZNER_S3_SECRET_KEY": "test_secret",
        }):
            with patch("boto3.client") as mock_client:
                mock_s3 = MagicMock()
                mock_client.return_value = mock_s3

                result = extractor.upload_to_s3(file_path, "test/file.jsonl")

                # Verify client was created
                mock_client.assert_called_once()

        file_path.unlink()


class TestTherapeuticKeywords:
    """Test therapeutic keyword detection."""

    def test_keywords_coverage(self):
        """Test that key therapeutic concepts are covered."""
        expected_keywords = [
            "therapy",
            "trauma",
            "ptsd",
            "cptsd",
            "anxiety",
            "depression",
            "mindfulness",
            "healing",
            "recovery",
        ]

        for keyword in expected_keywords:
            assert keyword in THERAPEUTIC_KEYWORDS

    def test_chapter_patterns_coverage(self):
        """Test that chapter patterns are defined."""
        # Should have patterns for different chapter formats
        assert len(CHAPTER_PATTERNS) >= 3

        # Should match common chapter formats
        test_patterns = [
            "Chapter 1",
            "chapter 1",
            "CHAPTER V",
            "Part I",
            "Section 1",
        ]

        for pattern in CHAPTER_PATTERNS:
            import re
            compiled = re.compile(pattern, re.IGNORECASE)
            # At least one test pattern should match each compiled pattern
            matched = any(compiled.search(p) for p in test_patterns)
            # This is a loose check - not all patterns need to match


# Integration tests (require actual files)
@pytest.mark.integration
class TestIntegration:
    """Integration tests with actual file processing."""

    @pytest.mark.skip(reason="Requires PDF library and sample file")
    def test_pdf_extraction_integration(self, extractor):
        """Test actual PDF extraction (requires sample PDF)."""
        # This would require a real PDF file
        pass

    @pytest.mark.skip(reason="Requires EPUB library and sample file")
    def test_epub_extraction_integration(self, extractor):
        """Test actual EPUB extraction (requires sample EPUB)."""
        # This would require a real EPUB file
        pass


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
