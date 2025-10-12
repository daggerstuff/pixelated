#!/usr/bin/env python3
"""
Reorganize and standardize transcript folder and file names.
- Convert to lowercase
- Replace spaces with underscores
- Remove special characters
- Maintain consistent naming convention
"""

import os
import re
import shutil
from pathlib import Path
from typing import Dict, List, Tuple

def sanitize_name(name: str) -> str:
    """
    Sanitize folder/file names by:
    - Converting to lowercase
    - Replacing spaces with underscores
    - Removing or replacing special characters
    - Removing multiple consecutive underscores
    """
    # Convert to lowercase
    name = name.lower()
    
    # Replace spaces with underscores
    name = name.replace(' ', '_')
    
    # Replace common special characters
    replacements = {
        '：': '_',
        '？': '',
        '｜': '_',
        '&': 'and',
        '@': 'at',
        '#': '',
        '%': 'percent',
        '+': 'plus',
        '=': 'equals',
        '(': '',
        ')': '',
        '[': '',
        ']': '',
        '{': '',
        '}': '',
        '<': '',
        '>': '',
        '"': '',
        "'": '',
        '`': '',
        '~': '',
        '!': '',
        '$': '',
        '^': '',
        '*': '',
        ',': '',
        '.': '_',
        ';': '',
        ':': '_',
        '?': '',
        '/': '_',
        '\\': '_',
        '|': '_',
        '-': '_',
        '–': '_',
        '—': '_',
        '⧸': '_',
        '＂': '',
        '＇': '',
        '％': 'percent',
        '＆': 'and',
        '＃': '',
        '＠': 'at',
        '＋': 'plus',
        '＝': 'equals',
        '（': '',
        '）': '',
        '［': '',
        '］': '',
        '｛': '',
        '｝': '',
        '＜': '',
        '＞': '',
        '，': '',
        '．': '_',
        '；': '',
        '：': '_',
        '？': '',
        '／': '_',
        '＼': '_',
        '｜': '_',
        '－': '_',
        '～': '',
        '！': '',
        '＄': '',
        '＾': '',
        '＊': '',
    }
    
    for old, new in replacements.items():
        name = name.replace(old, new)
    
    # Remove any remaining non-alphanumeric characters except underscores
    name = re.sub(r'[^a-z0-9_]', '', name)
    
    # Replace multiple consecutive underscores with single underscore
    name = re.sub(r'_+', '_', name)
    
    # Remove leading/trailing underscores
    name = name.strip('_')
    
    # Ensure name is not empty
    if not name:
        name = 'unnamed'
    
    return name

def get_folder_mapping(base_path: Path) -> Dict[str, str]:
    """Get mapping of old folder names to new standardized names."""
    mapping = {}
    
    for folder in base_path.iterdir():
        if folder.is_dir():
            old_name = folder.name
            new_name = sanitize_name(old_name)
            mapping[old_name] = new_name
    
    return mapping

def get_file_mapping(folder_path: Path) -> Dict[str, str]:
    """Get mapping of old file names to new standardized names."""
    mapping = {}
    
    for file in folder_path.iterdir():
        if file.is_file() and file.suffix == '.txt':
            old_name = file.name
            # Remove .txt extension, sanitize, then add back
            name_without_ext = file.stem
            new_name_without_ext = sanitize_name(name_without_ext)
            new_name = f"{new_name_without_ext}.txt"
            mapping[old_name] = new_name
    
    return mapping

def rename_folders(base_path: Path, dry_run: bool = True) -> List[Tuple[str, str]]:
    """Rename all folders to standardized names."""
    folder_mapping = get_folder_mapping(base_path)
    renamed_folders = []
    
    print(f"{'DRY RUN: ' if dry_run else ''}Renaming folders...")
    
    for old_name, new_name in folder_mapping.items():
        if old_name != new_name:
            old_path = base_path / old_name
            new_path = base_path / new_name
            
            print(f"  {old_name} -> {new_name}")
            
            if not dry_run:
                if new_path.exists():
                    print(f"    WARNING: Target folder {new_name} already exists!")
                    continue
                old_path.rename(new_path)
            
            renamed_folders.append((old_name, new_name))
        else:
            print(f"  {old_name} (no change needed)")
    
    return renamed_folders

def rename_files_in_folder(folder_path: Path, dry_run: bool = True) -> List[Tuple[str, str]]:
    """Rename all files in a folder to standardized names."""
    file_mapping = get_file_mapping(folder_path)
    renamed_files = []
    
    for old_name, new_name in file_mapping.items():
        if old_name != new_name:
            old_path = folder_path / old_name
            new_path = folder_path / new_name
            
            print(f"    {old_name} -> {new_name}")
            
            if not dry_run:
                if new_path.exists():
                    print(f"      WARNING: Target file {new_name} already exists!")
                    continue
                old_path.rename(new_path)
            
            renamed_files.append((old_name, new_name))
    
    return renamed_files

def rename_all_files(base_path: Path, dry_run: bool = True) -> Dict[str, List[Tuple[str, str]]]:
    """Rename all files in all folders."""
    all_renamed_files = {}
    
    print(f"{'DRY RUN: ' if dry_run else ''}Renaming files...")
    
    for folder in base_path.iterdir():
        if folder.is_dir():
            folder_name = folder.name
            print(f"  Processing folder: {folder_name}")
            
            renamed_files = rename_files_in_folder(folder, dry_run)
            if renamed_files:
                all_renamed_files[folder_name] = renamed_files
            else:
                print(f"    No files need renaming in {folder_name}")
    
    return all_renamed_files

def main():
    """Main function to reorganize transcripts."""
    base_path = Path("/root/pixelated/.notes/transcripts2")
    
    if not base_path.exists():
        print(f"Error: Base path {base_path} does not exist!")
        return
    
    print("=== TRANSCRIPT REORGANIZATION ===")
    print(f"Base path: {base_path}")
    print()
    
    # First, do a dry run to show what would be changed
    print("=== DRY RUN - SHOWING PROPOSED CHANGES ===")
    print()
    
    # Show folder renames
    renamed_folders = rename_folders(base_path, dry_run=True)
    print()
    
    # Show file renames (using current folder names)
    renamed_files = rename_all_files(base_path, dry_run=True)
    print()
    
    # Summary
    total_folder_renames = len(renamed_folders)
    total_file_renames = sum(len(files) for files in renamed_files.values())
    
    print("=== SUMMARY ===")
    print(f"Folders to rename: {total_folder_renames}")
    print(f"Files to rename: {total_file_renames}")
    print()
    
    # Ask for confirmation
    response = input("Proceed with actual renaming? (y/N): ").strip().lower()
    
    if response == 'y':
        print()
        print("=== EXECUTING RENAMES ===")
        print()
        
        # Rename folders first
        renamed_folders = rename_folders(base_path, dry_run=False)
        print()
        
        # Then rename files (using new folder names)
        renamed_files = rename_all_files(base_path, dry_run=False)
        print()
        
        print("=== REORGANIZATION COMPLETE ===")
        print(f"Renamed {len(renamed_folders)} folders")
        print(f"Renamed {sum(len(files) for files in renamed_files.values())} files")
    else:
        print("Operation cancelled.")

if __name__ == "__main__":
    main()
