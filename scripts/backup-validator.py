#!/usr/bin/env python3
"""
Memory Backup Content Validator

This script validates memory backup content to ensure only genuine memory data is stored.
It checks for indicators of error pages, placeholders, or invalid content before saving.
"""

import argparse
import json
import re
import logging
from pathlib import Path
from typing import Dict, List, Any, Tuple, Optional
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


class BackupContentValidator:
    """Validates memory backup content for integrity and authenticity"""

    # Patterns that indicate invalid content (error pages, placeholders, ads)
    INVALID_CONTENT_PATTERNS = [
        # Ad-block detection and parking pages
        r"adblockkey",
        r"window\.park\s*=",
        r"data-adblockkey",
        r"park\-domain",
        r"parked\-domain",
        # Common error page indicators
        r"<!DOCTYPE html>",
        r"<html[^>]*>",
        r"<head>",
        r"<body>",
        r"<script[^>]*>",
        r"<div[^>]*>",
        # Parking/placeholder page content
        r"domain.*parked",
        r"page.*under.*construction",
        r"temporarily.*unavailable",
        r"404.*not.*found",
        r"500.*internal.*server.*error",
        r"503.*service.*unavailable",
        # JavaScript/HTML injection
        r"<script[^>]*src\s*=",
        r"window\.[a-zA-Z_$][a-zA-Z0-9_$]*\s*=",
        r"document\.getElementById",
        r"addEventListener",
        # Generic placeholder content
        r"placeholder.*content",
        r"lorem\s+ipsum",
        r"test.*data",
        r"dummy.*content",
        # Domain parking services
        r"sedo\.com",
        r"godaddy\.com.*parking",
        r"namecheap.*parking",
        r"domain.*for.*sale",
        # Common error responses
        r"access.*denied",
        r"permission.*denied",
        r"unauthorized.*access",
        r"forbidden.*request",
        # Empty or minimal responses
        r"^\s*$",  # Empty content
        r"^null$",  # Null response
        r"^undefined$",  # Undefined response
    ]

    # Patterns that indicate valid memory content
    VALID_MEMORY_PATTERNS = [
        r'"content"\s*:\s*"[^"]*"',  # JSON with content field
        r'"memory_id"\s*:\s*"[^"]*"',  # Memory ID field
        r'"created_at"\s*:\s*"[^"]*"',  # Timestamp field
        r'"metadata"\s*:\s*\{',  # Metadata object
        r'"source"\s*:\s*"[^"]*"',  # Source field
    ]

    # Minimum content requirements
    MIN_CONTENT_LENGTH = 10  # Minimum character length for valid content
    MIN_MEMORY_FIELDS = 2  # Minimum number of expected fields in memory record

    def __init__(self):
        self.validation_stats = {
            "total_checked": 0,
            "valid_memories": 0,
            "invalid_memories": 0,
            "error_patterns_found": [],
            "validation_errors": [],
        }

    def is_html_content(self, content: str) -> bool:
        """Check if content appears to be HTML"""
        html_indicators = [
            r"<!DOCTYPE\s+html",
            r"<html[^>]*>",
            r"<head[^>]*>",
            r"<body[^>]*>",
            r"<script[^>]*>",
            r"<div[^>]*>",
            r"<meta[^>]*>",
            r"<link[^>]*>",
        ]

        content_lower = content.lower()
        return any(re.search(pattern, content_lower, re.IGNORECASE) for pattern in html_indicators)

    def is_ad_block_content(self, content: str) -> bool:
        """Check if content contains ad-block detection or parking page indicators"""
        ad_block_patterns = [
            r"adblockkey",
            r"window\.park\s*=",
            r"data-adblockkey",
            r"park\-domain",
            r"parked.*domain",
            r"domain.*parking",
            r"/bVNwubFKv\.js",  # Specific pattern from the user's example
        ]

        return any(re.search(pattern, content, re.IGNORECASE) for pattern in ad_block_patterns)

    def is_error_page_content(self, content: str) -> bool:
        """Check if content appears to be an error page"""
        error_patterns = [
            r"404.*not.*found",
            r"500.*internal.*server.*error",
            r"503.*service.*unavailable",
            r"502.*bad.*gateway",
            r"access.*denied",
            r"forbidden.*request",
            r"unauthorized.*access",
        ]

        return any(re.search(pattern, content, re.IGNORECASE) for pattern in error_patterns)

    def validate_memory_structure(self, memory_data: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """Validate that memory data has the expected structure"""
        errors = []

        # Check for required fields
        required_fields = ["content"]
        optional_fields = ["id", "memory_id", "created_at", "metadata", "source"]

        errors.extend(
            f"Missing required field: {field}"
            for field in required_fields
            if field not in memory_data
        )
        # Check content field specifically
        if "content" in memory_data:
            content = memory_data["content"]

            # Check content length
            if len(str(content)) < self.MIN_CONTENT_LENGTH:
                errors.append(f"Content too short: {len(str(content))} characters")

            # Check if content is HTML
            if self.is_html_content(str(content)):
                errors.append("Content appears to be HTML")

            # Check for ad-block content
            if self.is_ad_block_content(str(content)):
                errors.append("Content contains ad-block or parking page indicators")

            # Check for error page content
            if self.is_error_page_content(str(content)):
                errors.append("Content appears to be an error page")

        # Check for suspicious patterns in any field
        content_str = json.dumps(memory_data)
        for pattern in self.INVALID_CONTENT_PATTERNS:
            if re.search(pattern, content_str, re.IGNORECASE):
                errors.append(f"Found invalid pattern: {pattern}")
                break

        return not errors, errors

    def validate_backup_file(self, file_path: Path) -> Tuple[bool, Dict[str, Any]]:
        """Validate an entire backup file"""
        results = {
            "file_path": str(file_path),
            "is_valid": False,
            "total_memories": 0,
            "valid_memories": 0,
            "invalid_memories": 0,
            "errors": [],
            "invalid_memory_details": [],
        }

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            if not isinstance(data, list):
                results["errors"].append("Backup file should contain a list of memories")
                return False, results

            results["total_memories"] = len(data)

            for i, memory in enumerate(data):
                self.validation_stats["total_checked"] += 1

                if not isinstance(memory, dict):
                    results["invalid_memories"] += 1
                    results["invalid_memory_details"].append(
                        {
                            "index": i,
                            "error": "Memory is not a dictionary",
                            "content_preview": str(memory)[:100],
                        }
                    )
                    continue

                is_valid, errors = self.validate_memory_structure(memory)

                if is_valid:
                    results["valid_memories"] += 1
                    self.validation_stats["valid_memories"] += 1
                else:
                    results["invalid_memories"] += 1
                    self.validation_stats["invalid_memories"] += 1
                    results["invalid_memory_details"].append(
                        {
                            "index": i,
                            "errors": errors,
                            "content_preview": str(memory.get("content", ""))[:100],
                        }
                    )

            # File is valid if it has at least one valid memory and less than 50% invalid
            has_valid_memories = results["valid_memories"] > 0
            invalid_ratio = results["invalid_memories"] / max(results["total_memories"], 1)
            results["is_valid"] = has_valid_memories and invalid_ratio < 0.5

        except json.JSONDecodeError as e:
            results["errors"].append(f"Invalid JSON: {e}")
        except Exception as e:
            results["errors"].append(f"Error reading file: {e}")

        return results["is_valid"], results

    def create_cleaned_backup(self, source_file: Path, target_file: Path) -> Dict[str, Any]:
        """Create a cleaned backup file with only valid memories"""
        results = {
            "source_file": str(source_file),
            "target_file": str(target_file),
            "original_count": 0,
            "cleaned_count": 0,
            "removed_count": 0,
            "errors": [],
        }

        try:
            with open(source_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            if not isinstance(data, list):
                results["errors"].append("Source file should contain a list of memories")
                return results

            results["original_count"] = len(data)
            valid_memories = []

            for memory in data:
                if isinstance(memory, dict):
                    is_valid, _ = self.validate_memory_structure(memory)
                    if is_valid:
                        valid_memories.append(memory)

            results["cleaned_count"] = len(valid_memories)
            results["removed_count"] = results["original_count"] - results["cleaned_count"]

            # Save cleaned backup
            with open(target_file, "w", encoding="utf-8") as f:
                json.dump(valid_memories, f, indent=2, ensure_ascii=False)

            logger.info(f"Created cleaned backup: {target_file}")
            logger.info(
                f"Original: {results['original_count']}, Cleaned: {results['cleaned_count']}, Removed: {results['removed_count']}"
            )

        except Exception as e:
            results["errors"].append(f"Error creating cleaned backup: {e}")

        return results

    def scan_backup_directory(self, backup_dir: Path) -> Dict[str, Any]:
        """Scan all backup files in a directory"""
        results = {
            "directory": str(backup_dir),
            "total_files": 0,
            "valid_files": 0,
            "invalid_files": 0,
            "file_results": [],
            "summary": {},
        }

        if not backup_dir.exists():
            results["errors"] = [f"Backup directory does not exist: {backup_dir}"]
            return results

        backup_files = list(backup_dir.glob("combined_memories_*.json"))
        results["total_files"] = len(backup_files)

        for backup_file in backup_files:
            is_valid, file_results = self.validate_backup_file(backup_file)

            if is_valid:
                results["valid_files"] += 1
            else:
                results["invalid_files"] += 1

            results["file_results"].append(file_results)

        # Generate summary
        results["summary"] = {
            "validation_stats": self.validation_stats.copy(),
            "recommendations": self._generate_recommendations(results),
        }

        return results

    def _generate_recommendations(self, scan_results: Dict[str, Any]) -> List[str]:
        """Generate recommendations based on scan results"""
        recommendations = []

        if scan_results["invalid_files"] > 0:
            recommendations.append(
                f"Found {scan_results['invalid_files']} invalid backup files. "
                "Consider regenerating these backups or cleaning them."
            )

        if self.validation_stats["invalid_memories"] > 0:
            recommendations.append(
                f"Found {self.validation_stats['invalid_memories']} invalid memory records. "
                "Check the source API for data quality issues."
            )

        if scan_results["invalid_files"] / max(scan_results["total_files"], 1) > 0.3:
            recommendations.append(
                "High rate of invalid backups detected. "
                "Consider implementing pre-backup validation in the memory sync process."
            )

        return recommendations


class BackupValidationCLI:
    """Command-line interface for backup validation operations."""

    def __init__(self):
        self.validator = BackupContentValidator()

    def create_parser(self):
        """Create and configure argument parser."""
        parser = argparse.ArgumentParser(description="Validate memory backup files")
        parser.add_argument(
            "--backup-dir",
            type=Path,
            default=Path("/home/vivi/pixel/memory_backups"),
            help="Directory containing backup files",
        )
        parser.add_argument("--validate-file", type=Path, help="Validate a specific backup file")
        parser.add_argument(
            "--clean-file", type=Path, help="Create cleaned version of a backup file"
        )
        parser.add_argument(
            "--output-dir",
            type=Path,
            default=Path("/home/vivi/pixel/memory_backups/cleaned"),
            help="Directory for cleaned backup files",
        )
        return parser

    def validate_single_file(self, file_path: Path) -> bool:
        """Validate a single backup file and display results."""
        logger.info(f"Validating file: {file_path}")
        is_valid, results = self.validator.validate_backup_file(file_path)

        print(f"\nValidation Results for {file_path}:")
        print(f"Valid: {is_valid}")
        print(f"Total memories: {results['total_memories']}")
        print(f"Valid memories: {results['valid_memories']}")
        print(f"Invalid memories: {results['invalid_memories']}")

        if results["errors"]:
            print(f"Errors: {results['errors']}")

        if results["invalid_memory_details"]:
            print("\nInvalid memory details:")
            for detail in results["invalid_memory_details"][:5]:
                print(
                    f"  Index {detail['index']}: {detail.get('errors', detail.get('error', 'Unknown error'))}"
                )
                print(f"    Preview: {detail['content_preview']}")

        return is_valid

    def clean_single_file(self, source_file: Path, output_dir: Path) -> bool:
        """Clean a single backup file and display results."""
        output_dir.mkdir(parents=True, exist_ok=True)
        cleaned_file = output_dir / f"cleaned_{source_file.name}"

        logger.info(f"Cleaning file: {source_file}")
        results = self.validator.create_cleaned_backup(source_file, cleaned_file)

        print(f"\nCleaning Results:")
        print(f"Source: {results['source_file']}")
        print(f"Target: {results['target_file']}")
        print(f"Original count: {results['original_count']}")
        print(f"Cleaned count: {results['cleaned_count']}")
        print(f"Removed count: {results['removed_count']}")

        if results["errors"]:
            print(f"Errors: {results['errors']}")

        return True

    def scan_backup_directory(self, backup_dir: Path) -> bool:
        """Scan entire backup directory and display results."""
        logger.info(f"Scanning backup directory: {backup_dir}")
        results = self.validator.scan_backup_directory(backup_dir)

        print(f"\nBackup Directory Scan Results:")
        print(f"Directory: {results['directory']}")
        print(f"Total files: {results['total_files']}")
        print(f"Valid files: {results['valid_files']}")
        print(f"Invalid files: {results['invalid_files']}")

        print(f"\nValidation Statistics:")
        stats = results["summary"]["validation_stats"]
        print(f"Total memories checked: {stats['total_checked']}")
        print(f"Valid memories: {stats['valid_memories']}")
        print(f"Invalid memories: {stats['invalid_memories']}")

        if results["summary"]["recommendations"]:
            print(f"\nRecommendations:")
            for rec in results["summary"]["recommendations"]:
                print(f"  • {rec}")

        if invalid_files := [f for f in results["file_results"] if not f["is_valid"]]:
            print(f"\nInvalid Files Details:")
            for file_result in invalid_files[:3]:
                print(f"  {file_result['file_path']}:")
                print(
                    f"    Total: {file_result['total_memories']}, Valid: {file_result['valid_memories']}, Invalid: {file_result['invalid_memories']}"
                )
                if file_result["errors"]:
                    print(f"    Errors: {file_result['errors']}")

        return True

    def run(self):
        """Run the CLI application."""
        parser = self.create_parser()
        args = parser.parse_args()

        try:
            if args.validate_file:
                return self.validate_single_file(args.validate_file)
            elif args.clean_file:
                return self.clean_single_file(args.clean_file, args.output_dir)
            else:
                return self.scan_backup_directory(args.backup_dir)
        except Exception as e:
            logger.error(f"Error: {e}")
            print(f"Error: {e}")
            return False


def main():
    """Main entry point for the backup validation CLI."""
    import argparse

    cli = BackupValidationCLI()
    cli.run()


if __name__ == "__main__":
    main()
