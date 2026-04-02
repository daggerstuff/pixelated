#!/usr/bin/env python3
"""
PIX-2: Books-to-Training Extraction Script for Therapeutic Content

This script extracts text from therapeutic books (PDF/EPUB format), detects
therapeutic content, applies safety filtering, and converts to training format.

Features:
- PDF/EPUB text extraction with chapter segmentation
- Therapeutic content detection and classification
- Safety filtering with ProductionCrisisDetector (100% sensitivity)
- Training format conversion to JSONL
- S3 upload support for pipeline integration

Usage:
    # Extract from a single book
    python scripts/data/extract_books.py --input books/therapy_book.pdf

    # Process all books in directory
    python scripts/data/extract_books.py --input books/ --output data/books_extracted.jsonl

    # Process EPUB with chapter segmentation
    python scripts/data/extract_books.py --input books/guide.epub --format epub

    # Upload to S3
    python scripts/data/extract_books.py --input books/ --upload-s3 --s3-prefix books_extracted/
"""

import re
import sys
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import argparse
import json
import logging
import os

# PDF processing
try:
    from pypdf2 import PdfReader

    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False

# EPUB processing
try:
    from ebooklib import epub

    EPUB_AVAILABLE = True
except ImportError:
    EPUB_AVAILABLE = False

# Pipeline components
try:
    from ai.pipelines.design.hybrid_classifier import HybridTaxonomyClassifier
    from ai.safety.crisis_detection.production_crisis_detector import CrisisDetector

    PIPELINE_COMPONENTS_AVAILABLE = True
except ImportError:
    PIPELINE_COMPONENTS_AVAILABLE = False

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("books_extractor")


# === Configuration ===


@dataclass
class BooksExtractionConfig:
    """Configuration for books extraction."""

    input_path: str | None = None
    output_format: str = "jsonl"
    apply_safety_filter: bool = True
    apply_classification: bool = True
    min_content_length: int = 500  # Minimum characters for a segment
    chapter_detection: bool = True
    max_pages: int | None = None  # Limit pages per book (None = all)
    proxy_url: str | None = None  # For fetching from external sources


@dataclass
class BookSegment:
    """A segment of text extracted from a book."""

    source_id: str  # Unique identifier (book_title + chapter + page)
    title: str
    author: str
    content_text: str
    chapter: str = ""
    section: str = ""
    page_number: int = 0
    therapeutic_category: str = ""
    crisis_flag: bool = False
    quality_score: float = 0.0
    extraction_timestamp: str = ""
    source: str = "books"
    file_format: str = ""  # pdf, epub, txt
    word_count: int = 0
    language: str = "en"


# === Therapeutic Keywords ===

THERAPEUTIC_KEYWORDS = [
    "therapy",
    "therapist",
    "counseling",
    "counselor",
    "mental health",
    "psychology",
    "psychiatrist",
    "anxiety",
    "depression",
    "ptsd",
    "trauma",
    "cptsd",
    "borderline",
    "bpd",
    "narcissist",
    "narcissism",
    "emotional",
    "feelings",
    "healing",
    "recovery",
    "mindfulness",
    "meditation",
    "self-care",
    "childhood",
    "attachment",
    "abuse",
    "neglect",
    "cbt",
    "cognitive behavioral",
    "dialectical behavior",
    "dbt",
    "psychodynamic",
    "trauma-informed",
    "inner child",
    "shadow work",
    "somatic",
    "breathwork",
    "regulation",
    "nervous system",
    "polyvagal",
    "dissociation",
    "flashbacks",
    "triggers",
    "grounding",
]

# Chapter detection patterns
CHAPTER_PATTERNS = [
    r"^chapter\s+\d+",
    r"^chapter\s+[ivxlc]+",
    r"^\d+\.\s+[A-Z]",
    r"^part\s+\d+",
    r"^part\s+[ivxlc]+",  # Added: matches "Part I", "Part II", etc.
    r"^section\s+\d+",
    r"^unit\s+\d+",
]


class BooksExtractor:
    """Extract therapeutic content from books (PDF/EPUB/TXT)."""

    def __init__(self, config: BooksExtractionConfig):
        self.config = config
        self.crisis_detector = None
        self.classifier = None

        # Initialize pipeline components
        if PIPELINE_COMPONENTS_AVAILABLE:
            if config.apply_safety_filter:
                self.crisis_detector = CrisisDetector()
                logger.info("✅ Crisis detector initialized (100% sensitivity)")

            if config.apply_classification:
                self.classifier = HybridTaxonomyClassifier(enable_llm=False)
                logger.info("✅ Taxonomy classifier initialized")
        else:
            logger.warning("⚠️ Pipeline components not available - safety filtering disabled")

    def extract_from_pdf(self, file_path: Path) -> list[BookSegment]:
        """Extract text segments from a PDF file."""
        if not PDF_AVAILABLE:
            logger.error("❌ pypdf2 not available - cannot process PDF files")
            return []

        segments = []
        try:
            reader = PdfReader(str(file_path))
            total_pages = len(reader.pages)

            if self.config.max_pages:
                total_pages = min(total_pages, self.config.max_pages)

            logger.info(f"📖 Processing PDF: {file_path.name} ({total_pages} pages)")

            # Extract book metadata from first pages
            book_title = file_path.stem
            author = "Unknown"
            current_chapter = ""

            # Try to extract title/author from first page
            if total_pages > 0:
                first_page_text = reader.pages[0].extract_text() or ""
                title_author = self._extract_book_metadata(first_page_text)
                if title_author.get("title"):
                    book_title = title_author["title"]
                if title_author.get("author"):
                    author = title_author["author"]

            # Process pages
            full_text_by_chapter: dict[str, list[tuple[int, str]]] = {}
            current_chapter_pages: list[tuple[int, str]] = []

            for page_num in range(total_pages):
                page = reader.pages[page_num]
                page_text = page.extract_text() or ""

                if not page_text.strip():
                    continue

                # Check for chapter markers
                detected_chapter = self._detect_chapter(page_text)

                if detected_chapter and detected_chapter != current_chapter:
                    # Save previous chapter
                    if current_chapter_pages:
                        full_text_by_chapter[current_chapter] = current_chapter_pages

                    current_chapter = detected_chapter
                    current_chapter_pages = [(page_num + 1, page_text)]
                else:
                    current_chapter_pages.append((page_num + 1, page_text))

            # Save last chapter
            if current_chapter_pages:
                full_text_by_chapter[current_chapter] = current_chapter_pages

            # Create segments from chapters
            source_id_base = self._create_source_id(book_title)

            for chapter_name, pages in full_text_by_chapter.items():
                combined_text = "\n\n".join(text for _, text in pages)
                page_numbers = [p for p, _ in pages]

                if len(combined_text) < self.config.min_content_length:
                    continue

                segment = BookSegment(
                    source_id=f"{source_id_base}_{chapter_name or 'intro'}".replace(" ", "_").lower(),
                    title=book_title,
                    author=author,
                    content_text=self._clean_text(combined_text),
                    chapter=chapter_name,
                    page_number=page_numbers[0] if page_numbers else 0,
                    file_format="pdf",
                    extraction_timestamp=datetime.now(timezone.utc).isoformat(),
                )

                segments.append(segment)

        except Exception as e:
            logger.error(f"Error processing PDF {file_path}: {e}")

        logger.info(f"✅ Extracted {len(segments)} segments from PDF")
        return segments

    def extract_from_epub(self, file_path: Path) -> list[BookSegment]:
        """Extract text segments from an EPUB file."""
        if not EPUB_AVAILABLE:
            logger.error("❌ ebooklib not available - cannot process EPUB files")
            return []

        segments = []
        try:
            book = epub.read_epub(str(file_path))
            logger.info(f"📖 Processing EPUB: {file_path.name}")

            # Extract metadata
            book_title = file_path.stem
            author = "Unknown"

            for item in book.get_metadata("DC", "title"):
                book_title = item[0]
                break

            for item in book.get_metadata("DC", "creator"):
                author = item[0]
                break

            # Process chapters/items
            source_id_base = self._create_source_id(book_title)
            chapter_num = 0

            for item in book.get_items():
                if item.get_type() == 9:  # ITEM_DOCUMENT
                    chapter_num += 1
                    content = item.get_content().decode("utf-8", errors="ignore")

                    # Extract text from HTML
                    text = self._html_to_text(content)

                    if len(text) < self.config.min_content_length:
                        continue

                    # Detect chapter name from content
                    chapter_name = self._detect_chapter(text) or f"Chapter_{chapter_num}"

                    segment = BookSegment(
                        source_id=f"{source_id_base}_{chapter_name}".replace(" ", "_").lower(),
                        title=book_title,
                        author=author,
                        content_text=self._clean_text(text),
                        chapter=chapter_name,
                        page_number=chapter_num,  # EPUB doesn't have fixed pages
                        file_format="epub",
                        extraction_timestamp=datetime.now(timezone.utc).isoformat(),
                    )

                    segments.append(segment)

        except Exception as e:
            logger.error(f"Error processing EPUB {file_path}: {e}")

        logger.info(f"✅ Extracted {len(segments)} segments from EPUB")
        return segments

    def extract_from_txt(self, file_path: Path) -> list[BookSegment]:
        """Extract text segments from a plain text file."""
        segments = []
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                full_text = f.read()

            logger.info(f"📖 Processing TXT: {file_path.name}")

            # Try to detect title and author
            book_title = file_path.stem
            author = "Unknown"

            title_author = self._extract_book_metadata(full_text[:2000])
            if title_author.get("title"):
                book_title = title_author["title"]
            if title_author.get("author"):
                author = title_author["author"]

            # Split by chapters
            source_id_base = self._create_source_id(book_title)

            # Try chapter-based splitting
            chapter_splits = self._split_by_chapters(full_text)

            for i, (chapter_name, chapter_text) in enumerate(chapter_splits):
                if len(chapter_text) < self.config.min_content_length:
                    continue

                segment = BookSegment(
                    source_id=f"{source_id_base}_{chapter_name or f'section_{i}'}".replace(" ", "_").lower(),
                    title=book_title,
                    author=author,
                    content_text=self._clean_text(chapter_text),
                    chapter=chapter_name or f"Section {i + 1}",
                    page_number=i + 1,
                    file_format="txt",
                    extraction_timestamp=datetime.now(timezone.utc).isoformat(),
                )

                segments.append(segment)

        except Exception as e:
            logger.error(f"Error processing TXT {file_path}: {e}")

        logger.info(f"✅ Extracted {len(segments)} segments from TXT")
        return segments

    def _extract_book_metadata(self, text: str) -> dict[str, str]:
        """Extract book title and author from text."""
        metadata = {}

        # Common patterns for title/author
        title_patterns = [
            r"^Title:\s*(.+)$",
            r"^(.+)\s+by\s+.+$",
        ]

        author_patterns = [
            r"^Author:\s*(.+)$",
            r"by\s+(.+)$",
        ]

        lines = text.split("\n")[:20]  # Check first 20 lines

        for line in lines:
            line = line.strip()
            if not line:
                continue

            for pattern in title_patterns:
                match = re.match(pattern, line, re.IGNORECASE)
                if match:
                    metadata["title"] = match.group(1).strip()
                    break

            for pattern in author_patterns:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    author = match.group(1).strip()
                    # Clean up author name
                    author = re.sub(r"^(by|written by|author:?)\s*", "", author, flags=re.IGNORECASE)
                    if author:
                        metadata["author"] = author
                    break

        return metadata

    def _detect_chapter(self, text: str) -> str:
        """Detect chapter name from text."""
        lines = text.split("\n")[:10]  # Check first 10 lines

        for line in lines:
            line = line.strip()
            if not line:
                continue

            for pattern in CHAPTER_PATTERNS:
                match = re.match(pattern, line, re.IGNORECASE)
                if match:
                    return line

        return ""

    def _split_by_chapters(self, text: str) -> list[tuple[str, str]]:
        """Split text by chapter markers."""
        chapters = []

        # Find all chapter positions
        chapter_positions = []
        lines = text.split("\n")

        for i, line in enumerate(lines):
            if self._detect_chapter(line):
                chapter_positions.append(i)

        # If no chapters found, return single segment
        if not chapter_positions:
            return [("Full Text", text)]

        # Extract chapters
        for i, start_pos in enumerate(chapter_positions):
            end_pos = chapter_positions[i + 1] if i + 1 < len(chapter_positions) else len(lines)

            chapter_name = lines[start_pos].strip()
            chapter_text = "\n".join(lines[start_pos:end_pos])

            chapters.append((chapter_name, chapter_text))

        return chapters

    def _html_to_text(self, html_content: str) -> str:
        """Convert HTML content to plain text."""
        # Remove HTML tags
        text = re.sub(r"<[^>]+>", " ", html_content)

        # Decode HTML entities
        import html

        text = html.unescape(text)

        # Normalize whitespace
        text = re.sub(r"\s+", " ", text)

        return text.strip()

    def _clean_text(self, text: str) -> str:
        """Clean and normalize extracted text."""
        # Remove excessive whitespace
        text = re.sub(r"\n{3,}", "\n\n", text)
        text = re.sub(r" {2,}", " ", text)

        # Remove page numbers (standalone numbers)
        text = re.sub(r"\n\d+\n", "\n", text)

        # Remove headers/footers (repeated lines)
        lines = text.split("\n")
        cleaned_lines = []

        for line in lines:
            line = line.strip()
            if not line:
                cleaned_lines.append("")
                continue

            # Skip likely page numbers
            if line.isdigit() and len(line) <= 4:
                continue

            # Skip likely headers (all caps, short)
            if line.isupper() and len(line) < 50 and line.count(" ") <= 3:
                continue

            cleaned_lines.append(line)

        return "\n".join(cleaned_lines).strip()

    def _create_source_id(self, title: str) -> str:
        """Create a unique source ID from title."""
        # Normalize title
        normalized = re.sub(r"[^a-zA-Z0-9\s]", "", title.lower())
        normalized = re.sub(r"\s+", "_", normalized.strip())
        return normalized[:50]

    def is_therapeutic_content(self, text: str) -> bool:
        """Check if text contains therapeutic content."""
        text_lower = text.lower()

        # Check for therapeutic keywords
        keyword_count = sum(1 for kw in THERAPEUTIC_KEYWORDS if kw in text_lower)

        # Require at least 3 therapeutic keywords for relevance
        return keyword_count >= 3

    def process_segment(self, segment: BookSegment) -> BookSegment | None:
        """Process a segment with safety filtering and classification."""
        # Check for therapeutic content
        if not self.is_therapeutic_content(segment.content_text):
            logger.debug(f"Skipping non-therapeutic segment: {segment.source_id}")
            return None

        # Calculate word count
        segment.word_count = len(segment.content_text.split())

        # Apply safety filtering
        if self.crisis_detector and self.config.apply_safety_filter:
            crisis_result = self.crisis_detector.analyze_crisis(
                {"messages": [{"role": "user", "content": segment.content_text}]}
            )
            segment.crisis_flag = crisis_result.is_crisis

            if segment.crisis_flag:
                logger.warning(
                    f"⚠️ Crisis content detected in {segment.source_id}: "
                    f"{crisis_result.category.value if crisis_result.category else 'unknown'}"
                )

        # Apply classification
        if self.classifier and self.config.apply_classification:
            record = {"messages": [{"role": "user", "content": segment.content_text}]}
            classification = self.classifier.classify_record(record)
            segment.therapeutic_category = classification.category.value

        # Calculate quality score
        segment.quality_score = self._calculate_quality_score(segment)

        return segment

    def _calculate_quality_score(self, segment: BookSegment) -> float:
        """Calculate quality score for the segment."""
        score = 0.5  # Base score

        # Length bonus
        if segment.word_count > 500:
            score += 0.1
        if segment.word_count > 1500:
            score += 0.1
        if segment.word_count > 3000:
            score += 0.1

        # Has chapter information
        if segment.chapter:
            score += 0.05

        # Has therapeutic category
        if segment.therapeutic_category:
            score += 0.05

        # Crisis content penalty
        if segment.crisis_flag:
            score -= 0.2

        return min(1.0, max(0.0, score))

    def save_to_jsonl(self, records: list[BookSegment], output_path: Path) -> None:
        """Save records to JSONL format."""
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, "w", encoding="utf-8") as f:
            for record in records:
                f.write(json.dumps(asdict(record), ensure_ascii=False) + "\n")

        logger.info(f"✅ Saved {len(records)} records to {output_path}")

    def upload_to_s3(self, file_path: Path, s3_key: str) -> bool:
        """Upload file to S3 bucket.

        Requires OVH_S3_ACCESS_KEY and OVH_S3_SECRET_KEY environment variables.
        """
        try:
            import boto3
            from botocore.exceptions import ClientError

            # Get S3 credentials from environment
            endpoint_url = os.getenv("OVH_S3_ENDPOINT", "https://s3.us-east-va.io.cloud.ovh.us")
            access_key = os.getenv("OVH_S3_ACCESS_KEY") or os.getenv("AWS_ACCESS_KEY_ID")
            secret_key = os.getenv("OVH_S3_SECRET_KEY") or os.getenv("AWS_SECRET_ACCESS_KEY")
            region = os.getenv("OVH_S3_REGION", "us-east-va")
            bucket = os.getenv("OVH_S3_BUCKET", "pixel-data")

            if not access_key or not secret_key:
                logger.error(
                    "❌ S3 credentials not found. Set OVH_S3_ACCESS_KEY and OVH_S3_SECRET_KEY"
                )
                return False

            # Create S3 client
            s3_client = boto3.client(
                "s3",
                endpoint_url=endpoint_url,
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
                region_name=region,
            )

            # Upload file
            s3_client.upload_file(str(file_path), bucket, s3_key)
            logger.info(f"✅ Uploaded to S3: s3://{bucket}/{s3_key}")
            return True

        except ClientError as e:
            logger.error(f"❌ S3 upload failed: {e}")
            return False
        except Exception as e:
            logger.error(f"❌ S3 upload error: {e}")
            return False


def main():
    """Main entry point for books extraction."""
    parser = argparse.ArgumentParser(
        description="PIX-2: Extract therapeutic content from books (PDF/EPUB/TXT)"
    )

    parser.add_argument(
        "--input",
        type=Path,
        required=True,
        help="Input book file or directory containing books",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/books_extracted.jsonl"),
        help="Output JSONL file path",
    )
    parser.add_argument(
        "--format",
        choices=["pdf", "epub", "txt", "auto"],
        default="auto",
        help="Input file format (default: auto-detect)",
    )
    parser.add_argument(
        "--skip-safety",
        action="store_true",
        help="Skip crisis detection safety filtering",
    )
    parser.add_argument(
        "--skip-classification",
        action="store_true",
        help="Skip therapeutic category classification",
    )
    parser.add_argument(
        "--upload-s3",
        action="store_true",
        help="Upload output to S3 bucket (requires OVH_S3 credentials)",
    )
    parser.add_argument(
        "--s3-prefix",
        default="books_extracted/",
        help="S3 prefix for uploaded files (default: books_extracted/)",
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        help="Maximum pages to process per book (for PDFs)",
    )
    parser.add_argument(
        "--min-length",
        type=int,
        default=500,
        help="Minimum content length for a segment (characters)",
    )

    args = parser.parse_args()

    # Initialize configuration
    config = BooksExtractionConfig(
        apply_safety_filter=not args.skip_safety,
        apply_classification=not args.skip_classification,
        max_pages=args.max_pages,
        min_content_length=args.min_length,
    )

    # Initialize extractor
    extractor = BooksExtractor(config)

    # Collect input files
    input_files = []
    if args.input.is_file():
        input_files = [args.input]
    elif args.input.is_dir():
        # Find all book files in directory
        for ext in ["*.pdf", "*.epub", "*.txt"]:
            input_files.extend(args.input.glob(ext))
        input_files = sorted(set(input_files))
    else:
        logger.error(f"❌ Input path does not exist: {args.input}")
        return 1

    if not input_files:
        logger.error("❌ No book files found at input path")
        return 1

    logger.info(f"📚 Found {len(input_files)} book(s) to process")

    # Process all books
    all_segments = []

    for i, file_path in enumerate(input_files, 1):
        logger.info(f"Processing book {i}/{len(input_files)}: {file_path.name}")

        # Determine format
        file_format = args.format
        if file_format == "auto":
            suffix = file_path.suffix.lower()
            if suffix == ".pdf":
                file_format = "pdf"
            elif suffix == ".epub":
                file_format = "epub"
            elif suffix == ".txt":
                file_format = "txt"
            else:
                logger.warning(f"⚠️ Unknown format for {file_path}, skipping")
                continue

        # Extract based on format
        if file_format == "pdf":
            segments = extractor.extract_from_pdf(file_path)
        elif file_format == "epub":
            segments = extractor.extract_from_epub(file_path)
        elif file_format == "txt":
            segments = extractor.extract_from_txt(file_path)
        else:
            logger.warning(f"⚠️ Unsupported format: {file_format}")
            continue

        # Process each segment
        for segment in segments:
            processed = extractor.process_segment(segment)
            if processed:
                all_segments.append(processed)

        # Rate limiting
        time.sleep(0.5)

    # Save results
    if all_segments:
        extractor.save_to_jsonl(all_segments, args.output)

        # Upload to S3 if requested
        if args.upload_s3:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            s3_key = f"{args.s3_prefix}books_extracted_{timestamp}.jsonl"
            extractor.upload_to_s3(args.output, s3_key)

        # Print summary
        print("\n" + "=" * 80)
        print("📊 PIX-2 EXTRACTION SUMMARY")
        print("=" * 80)
        print(f"Total books processed: {len(input_files)}")
        print(f"Total segments extracted: {len(all_segments)}")
        print(f"Crisis-flagged segments: {sum(1 for s in all_segments if s.crisis_flag)}")
        print(f"Total words extracted: {sum(s.word_count for s in all_segments):,}")
        print(f"Output file: {args.output}")
        if args.upload_s3:
            print(f"S3 upload: {args.s3_prefix}")
        print("=" * 80)

        # Print category breakdown
        categories: dict[str, int] = {}
        for segment in all_segments:
            cat = segment.therapeutic_category or "uncategorized"
            categories[cat] = categories.get(cat, 0) + 1

        print("\nTherapeutic Categories:")
        for cat, count in sorted(categories.items(), key=lambda x: x[1], reverse=True):
            print(f" - {cat}: {count}")

        # Print book breakdown
        books: dict[str, int] = {}
        for segment in all_segments:
            books[segment.title] = books.get(segment.title, 0) + 1

        print("\nBooks Processed:")
        for book, count in sorted(books.items(), key=lambda x: x[1], reverse=True)[:10]:
            print(f" - {book}: {count} segments")

        if len(books) > 10:
            print(f"   ... and {len(books) - 10} more books")

    else:
        logger.warning("⚠️ No therapeutic content extracted")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
