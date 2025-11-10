#!/usr/bin/env python3
"""
Normalize transcript filenames in .notes/transcripts/

Transformations:
1. Remove playlist IDs (e.g., PLpvbEN3KkqoLN7UfGKJJxFJhvvys8Sfv4_NA_)
2. Remove "cleaned_" prefix from filenames
3. Convert to lowercase
4. Replace spaces with underscores
5. Remove special characters (keep only alphanumeric, underscores, hyphens, dots)
6. Normalize unicode characters
"""

import re
import unicodedata
from pathlib import Path
from typing import Tuple

def normalize_filename(filename: str) -> str:
    """Normalize a filename according to rules."""

    # Remove "cleaned_" prefix if present
    if filename.startswith("cleaned_"):
        filename = filename[8:]

    # Remove playlist IDs (pattern: PLxxxxx_NA_ or similar)
    filename = re.sub(r'^PL[a-zA-Z0-9_]+_NA_', '', filename)

    # Normalize unicode (decompose accented characters)
    filename = unicodedata.normalize('NFKD', filename)
    filename = filename.encode('ascii', 'ignore').decode('ascii')

    # Convert to lowercase
    filename = filename.lower()

    # Replace common special characters with underscores or remove them
    # Keep: alphanumeric, underscores, hyphens, dots
    filename = re.sub(r'[^\w\-\.]', '_', filename)

    # Replace multiple underscores with single underscore
    filename = re.sub(r'_+', '_', filename)

    # Remove leading/trailing underscores
    filename = filename.strip('_')

    # Remove underscores before file extension
    if '.' in filename:
        name, ext = filename.rsplit('.', 1)
        name = name.rstrip('_')
        filename = f"{name}.{ext}"

    return filename

def process_directory(root_dir: str, dry_run: bool = True) -> Tuple[int, int]:
    """
    Process all files in directory recursively.

    Returns: (total_files, renamed_files)
    """
    root_path = Path(root_dir)
    total_files = 0
    renamed_files = 0

    for file_path in root_path.rglob('*.txt'):
        total_files += 1
        old_name = file_path.name
        new_name = normalize_filename(old_name)

        if old_name != new_name:
            renamed_files += 1
            new_path = file_path.parent / new_name

            if dry_run:
                print(f"[DRY RUN] {old_name}")
                print(f"       -> {new_name}")
            else:
                # Check if target already exists
                if new_path.exists():
                    print(f"⚠️  SKIP (exists): {old_name} -> {new_name}")
                else:
                    file_path.rename(new_path)
                    print(f"✅ RENAMED: {old_name}")
                    print(f"        -> {new_name}")

    return total_files, renamed_files

def main():
    import sys

    transcript_dir = ".notes/transcripts"

    # Check if directory exists
    if not Path(transcript_dir).exists():
        print(f"❌ Directory not found: {transcript_dir}")
        sys.exit(1)

    print("=" * 80)
    print("  📝 TRANSCRIPT FILENAME NORMALIZATION")
    print("=" * 80)
    print()

    # First pass: dry run
    print("🔍 DRY RUN - Showing what would be changed:")
    print()
    total, to_rename = process_directory(transcript_dir, dry_run=True)

    print()
    print("=" * 80)
    print("📊 SUMMARY:")
    print(f"   Total files: {total}")
    print(f"   Files to rename: {to_rename}")
    print("=" * 80)
    print()

    # Ask for confirmation
    if to_rename > 0:
        response = input("✅ Proceed with renaming? (yes/no): ").strip().lower()
        if response in ('yes', 'y'):
            print()
            print("🔄 EXECUTING RENAMES...")
            print()
            total, renamed = process_directory(transcript_dir, dry_run=False)
            print()
            print("=" * 80)
            print("✅ COMPLETE!")
            print(f"   Renamed: {renamed} files")
            print("=" * 80)
        else:
            print("❌ Cancelled.")
    else:
        print("✅ No files need renaming!")

if __name__ == "__main__":
    main()

