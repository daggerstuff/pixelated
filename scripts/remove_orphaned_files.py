#!/usr/bin/env python3
"""
Remove orphaned markdown files that don't have corresponding playbook entries.
"""

import json
import os
import sys
from pathlib import Path


def remove_orphaned_files(playbook_path: str, bullets_dir: str, dry_run: bool = False):
    """Remove markdown files that don't have playbook entries."""
    print(f"🔍 Analyzing playbook and markdown files...")

    # Load playbook
    with open(playbook_path, 'r') as f:
        playbook = json.load(f)

    playbook_ids = set(playbook['bullets'].keys())
    print(f"📊 Playbook bullets: {len(playbook_ids)}")

    # Get all markdown files
    md_files = [f for f in os.listdir(bullets_dir) if f.endswith('.md')]
    md_ids = {f.replace('.md', '') for f in md_files}
    print(f"📊 Markdown files: {len(md_ids)}")

    # Find orphaned files
    orphaned_ids = md_ids - playbook_ids
    print(f"⚠️  Orphaned markdown files: {len(orphaned_ids)}")

    if not orphaned_ids:
        print("✅ No orphaned files to remove!")
        return

    if dry_run:
        print(f"\n🔍 DRY RUN: Would remove {len(orphaned_ids)} orphaned files")
        print("\nSample orphaned files (first 20):")
        for bullet_id in list(orphaned_ids)[:20]:
            print(f"  - {bullet_id}.md")
        if len(orphaned_ids) > 20:
            print(f"  ... and {len(orphaned_ids) - 20} more")
        return

    # Remove orphaned files
    print(f"\n🗑️  Removing {len(orphaned_ids)} orphaned markdown files...")
    removed_count = 0
    errors = 0

    for bullet_id in orphaned_ids:
        md_file = os.path.join(bullets_dir, f"{bullet_id}.md")
        try:
            os.remove(md_file)
            removed_count += 1
            if removed_count <= 20:  # Show first 20
                print(f"  ✓ Removed: {bullet_id}.md")
        except Exception as e:
            errors += 1
            if errors <= 10:  # Show first 10 errors
                print(f"  ⚠️  Error removing {bullet_id}.md: {e}")

        # Progress indicator
        if removed_count > 0 and removed_count % 500 == 0:
            print(f"  Progress: {removed_count}/{len(orphaned_ids)} removed...")

    print(f"\n✅ Cleanup complete!")
    print(f"   Removed: {removed_count} orphaned files")
    if errors > 0:
        print(f"   Errors: {errors}")

    # Verify
    remaining_md = [f for f in os.listdir(bullets_dir) if f.endswith('.md')]
    print(f"   Remaining markdown files: {len(remaining_md)}")
    print(f"   Playbook bullets: {len(playbook_ids)}")

    if len(remaining_md) == len(playbook_ids):
        print("   ✅ All markdown files match playbook entries!")
    else:
        print(f"   ⚠️  Mismatch: {len(remaining_md)} files vs {len(playbook_ids)} bullets")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Remove orphaned markdown files")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be removed without making changes")
    parser.add_argument("--playbook", default=".brv/ace/playbook.json", help="Path to playbook.json")
    parser.add_argument("--bullets-dir", default=".brv/ace/bullets", help="Path to bullets directory")

    args = parser.parse_args()

    if not os.path.exists(args.playbook):
        print(f"❌ Playbook not found: {args.playbook}")
        sys.exit(1)

    if not os.path.exists(args.bullets_dir):
        print(f"❌ Bullets directory not found: {args.bullets_dir}")
        sys.exit(1)

    remove_orphaned_files(
        args.playbook,
        args.bullets_dir,
        dry_run=args.dry_run
    )

