#!/usr/bin/env python3
"""
Universal Transcript Cleaner v2 - Updated for reorganized transcripts2 directory
Processes all transcript files with standardized cleaning patterns.
"""

import logging
import re
from pathlib import Path

import chardet

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("universal_cleaner_v2")

class UniversalTranscriptCleaner:
    def __init__(self, base_path: str):
        self.base_path = Path(base_path)
        self.stats = {
            "total_files": 0,
            "processed_files": 0,
            "failed_files": 0,
            "total_words_before": 0,
            "total_words_after": 0,
            "directories_processed": 0
        }

        # Enhanced cleaning patterns
        self.cleaning_patterns = [
            # Timestamps and time markers
            (r"\b\d{1,2}:\d{2}(?::\d{2})?\b", ""),
            (r"\[\d{1,2}:\d{2}(?::\d{2})?\]", ""),
            (r"\(\d{1,2}:\d{2}(?::\d{2})?\)", ""),

            # Speaker labels and identifiers
            (r"^[A-Z][a-z]*\s*:", ""),
            (r"^Speaker\s*\d*\s*:", ""),
            (r"^Host\s*:", ""),
            (r"^Guest\s*:", ""),
            (r"^Interviewer\s*:", ""),
            (r"^Narrator\s*:", ""),

            # Transcription artifacts
            (r"\[inaudible\]", ""),
            (r"\[unclear\]", ""),
            (r"\[crosstalk\]", ""),
            (r"\[overlapping\]", ""),
            (r"\[music\]", ""),
            (r"\[applause\]", ""),
            (r"\[laughter\]", ""),
            (r"\[pause\]", ""),
            (r"\[silence\]", ""),
            (r"\[background noise\]", ""),
            (r"\[phone ringing\]", ""),
            (r"\[door closing\]", ""),

            # Filler words and sounds
            (r"\b(?:um|uh|ah|er|hmm|mm|mhm|yeah|yep|okay|ok|right|well|so|like|you know)\b", ""),
            (r"\b(?:ums|uhs|ahs|ers|hmms|mms|mhms|yeahs|yeps|okays|oks|rights|wells|sos|likes)\b", ""),

            # Repetitive patterns
            (r"\b(\w+)\s+\1\b", r"\1"),  # Remove immediate word repetitions
            (r"\s+", " "),  # Multiple spaces to single space

            # Special characters and formatting
            (r'[^\w\s\.\,\!\?\;\:\'\"\-\(\)]', ""),  # Keep only basic punctuation
            (r"\.{2,}", "."),  # Multiple dots to single dot
            (r"\,{2,}", ","),  # Multiple commas to single comma
            (r"\!{2,}", "!"),  # Multiple exclamations to single
            (r"\?{2,}", "?"),  # Multiple questions to single

            # Line breaks and formatting
            (r"\n\s*\n", "\n"),  # Multiple line breaks to single
            (r"^\s+", ""),  # Leading whitespace
            (r"\s+$", ""),  # Trailing whitespace
        ]

    def detect_encoding(self, file_path: Path) -> str:
        """Detect file encoding safely."""
        try:
            with open(file_path, "rb") as f:
                raw_data = f.read(10000)  # Read first 10KB
                result = chardet.detect(raw_data)
                return result["encoding"] or "utf-8"
        except Exception:
            return "utf-8"

    def read_file_safely(self, file_path: Path) -> str | None:
        """Read file with encoding detection and error handling."""
        encodings = [self.detect_encoding(file_path), "utf-8", "latin-1", "cp1252"]

        for encoding in encodings:
            try:
                with open(file_path, encoding=encoding, errors="ignore") as f:
                    return f.read()
            except Exception as e:
                logger.debug(f"Failed to read {file_path} with {encoding}: {e}")
                continue

        logger.error(f"Could not read file: {file_path}")
        return None

    def clean_text(self, text: str) -> str:
        """Apply all cleaning patterns to text."""
        if not text:
            return ""

        # Count words before cleaning
        words_before = len(text.split())

        # Apply cleaning patterns
        cleaned = text
        for pattern, replacement in self.cleaning_patterns:
            cleaned = re.sub(pattern, replacement, cleaned, flags=re.IGNORECASE | re.MULTILINE)

        # Final cleanup
        cleaned = re.sub(r"\s+", " ", cleaned)  # Normalize whitespace
        cleaned = cleaned.strip()

        # Count words after cleaning
        words_after = len(cleaned.split())

        # Update stats
        self.stats["total_words_before"] += words_before
        self.stats["total_words_after"] += words_after

        return cleaned

    def process_file(self, file_path: Path) -> bool:
        """Process a single transcript file."""
        try:
            logger.info(f"Processing: {file_path}")

            # Read original content
            original_content = self.read_file_safely(file_path)
            if original_content is None:
                self.stats["failed_files"] += 1
                return False

            # Clean the content
            cleaned_content = self.clean_text(original_content)

            # Skip if content is too short after cleaning
            if len(cleaned_content.split()) < 10:
                logger.warning(f"Skipping {file_path}: too short after cleaning")
                self.stats["failed_files"] += 1
                return False

            # Write cleaned content back
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(cleaned_content)

            self.stats["processed_files"] += 1
            logger.info(f"Successfully processed: {file_path}")
            return True

        except Exception as e:
            logger.error(f"Error processing {file_path}: {e}")
            self.stats["failed_files"] += 1
            return False

    def process_directory(self, directory: Path) -> list[Path]:
        """Process all .txt files in a directory."""
        processed_files = []

        if not directory.is_dir():
            logger.warning(f"Not a directory: {directory}")
            return processed_files

        txt_files = list(directory.glob("*.txt"))
        if not txt_files:
            logger.info(f"No .txt files found in: {directory}")
            return processed_files

        logger.info(f"Processing {len(txt_files)} files in: {directory}")

        for file_path in txt_files:
            self.stats["total_files"] += 1
            if self.process_file(file_path):
                processed_files.append(file_path)

        return processed_files

    def process_all_directories(self) -> dict[str, list[Path]]:
        """Process all directories in the base path."""
        results = {}

        if not self.base_path.exists():
            logger.error(f"Base path does not exist: {self.base_path}")
            return results

        # Get all subdirectories
        directories = [d for d in self.base_path.iterdir() if d.is_dir()]

        if not directories:
            logger.warning(f"No directories found in: {self.base_path}")
            return results

        logger.info(f"Found {len(directories)} directories to process")

        for directory in sorted(directories):
            logger.info(f"Processing directory: {directory.name}")
            processed_files = self.process_directory(directory)
            results[directory.name] = processed_files
            self.stats["directories_processed"] += 1

        return results

    def print_summary(self, results: dict[str, list[Path]]):
        """Print processing summary."""
        print("\n" + "="*60)
        print("UNIVERSAL TRANSCRIPT CLEANER V2 - SUMMARY")
        print("="*60)

        print(f"Directories processed: {self.stats['directories_processed']}")
        print(f"Total files found: {self.stats['total_files']}")
        print(f"Successfully processed: {self.stats['processed_files']}")
        print(f"Failed files: {self.stats['failed_files']}")

        if self.stats["total_words_before"] > 0:
            reduction = ((self.stats["total_words_before"] - self.stats["total_words_after"]) /
                        self.stats["total_words_before"]) * 100
            print(f"Words before cleaning: {self.stats['total_words_before']:,}")
            print(f"Words after cleaning: {self.stats['total_words_after']:,}")
            print(f"Word reduction: {reduction:.1f}%")

        print("\nFiles processed by directory:")
        for directory, files in results.items():
            print(f"  {directory}: {len(files)} files")

        print("="*60)

def main():
    """Main function to run the universal cleaner."""
    base_path = "/root/pixelated/.notes/transcripts2"

    logger.info("Starting Universal Transcript Cleaner v2")
    logger.info(f"Base path: {base_path}")

    cleaner = UniversalTranscriptCleaner(base_path)
    results = cleaner.process_all_directories()
    cleaner.print_summary(results)

    logger.info("Universal transcript cleaning completed")

if __name__ == "__main__":
    main()
