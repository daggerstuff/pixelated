#!/usr/bin/env python3
"""
Script to standardize file extensions from .md to .txt for transcript files.
This script will rename all .md files to .txt files in the specified directory.
"""

import os
import sys
import shutil
from pathlib import Path

def standardize_extensions(directory_path):
    """
    Standardize file extensions from .md to .txt in the given directory.
    
    Args:
        directory_path (str): Path to the directory to process
    """
    directory = Path(directory_path)
    
    if not directory.exists():
        print(f"Error: Directory {directory_path} does not exist")
        return False
    
    if not directory.is_dir():
        print(f"Error: {directory_path} is not a directory")
        return False
    
    # Find all .md files recursively
    md_files = list(directory.rglob("*.md"))
    
    if not md_files:
        print(f"No .md files found in {directory_path}")
        return True
    
    print(f"Found {len(md_files)} .md files to convert")
    
    converted_count = 0
    error_count = 0
    
    for md_file in md_files:
        try:
            # Create new filename with .txt extension
            txt_file = md_file.with_suffix('.txt')
            
            # Check if target file already exists
            if txt_file.exists():
                print(f"Warning: Target file already exists, skipping: {txt_file}")
                continue
            
            # Rename the file
            md_file.rename(txt_file)
            print(f"Converted: {md_file} -> {txt_file}")
            converted_count += 1
            
        except Exception as e:
            print(f"Error converting {md_file}: {e}")
            error_count += 1
    
    print(f"\nConversion complete:")
    print(f"  Successfully converted: {converted_count} files")
    print(f"  Errors: {error_count} files")
    
    return error_count == 0

def main():
    """Main function to handle command line arguments."""
    if len(sys.argv) != 2:
        print("Usage: python standardize_extensions.py <directory_path>")
        print("Example: python standardize_extensions.py .notes/transcripts/")
        sys.exit(1)
    
    directory_path = sys.argv[1]
    success = standardize_extensions(directory_path)
    
    if not success:
        sys.exit(1)

if __name__ == "__main__":
    main()