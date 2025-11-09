#!/usr/bin/env python3
"""
Clean up placeholder bullets from ByteRover playbook.

Removes bullets with placeholder content like:
- [Empty bullet - content not available]
- [Missing file - content not available]
"""

import json
import os
import sys


def cleanup_placeholders(playbook_path: str, bullets_dir: str, dry_run: bool = False, remove_files: bool = False):
    """Remove placeholder bullets from playbook."""
    print(f"🔍 Analyzing playbook: {playbook_path}")

    # Load playbook
    with open(playbook_path, 'r') as f:
        playbook = json.load(f)

    bullets = playbook.get('bullets', {})
    print(f"📊 Total bullets: {len(bullets)}")

    # Find placeholder bullets
    placeholder_ids = []
    real_content_count = 0

    for bullet_id, bullet_data in bullets.items():
        content = bullet_data.get('content', '').strip()

        if not content:
            placeholder_ids.append(bullet_id)
        elif '[Empty bullet - content not available]' in content:
            placeholder_ids.append(bullet_id)
        elif '[Missing file - content not available]' in content:
            placeholder_ids.append(bullet_id)
        else:
            real_content_count += 1

    print(f"✅ Bullets with real content: {real_content_count}")
    print(f"⚠️  Placeholder bullets to remove: {len(placeholder_ids)}")

    if dry_run:
        print(f"\n🔍 DRY RUN: Would remove {len(placeholder_ids)} placeholder bullets")
        print("\nSample placeholder bullets (first 10):")
        for bullet_id in placeholder_ids[:10]:
            bullet = bullets[bullet_id]
            content_preview = bullet.get('content', '')[:60]
            print(f"  - {bullet_id}: {content_preview}...")
        if len(placeholder_ids) > 10:
            print(f"  ... and {len(placeholder_ids) - 10} more")
        return

    if not placeholder_ids:
        print("✅ No placeholder bullets to remove!")
        return

    # Remove placeholder bullets from playbook
    print(f"\n🗑️  Removing {len(placeholder_ids)} placeholder bullets...")

    removed_count = 0
    for bullet_id in placeholder_ids:
        if bullet_id in bullets:
            del bullets[bullet_id]
            removed_count += 1

            # Optionally remove markdown file
            if remove_files:
                md_file = os.path.join(bullets_dir, f"{bullet_id}.md")
                if os.path.exists(md_file):
                    try:
                        os.remove(md_file)
                        if removed_count <= 20:  # Only show for small batches
                            print(f"  ✓ Removed: {bullet_id}")
                    except Exception as e:
                        print(f"  ⚠️  Could not remove {md_file}: {e}")

        # Progress indicator for large batches
        if removed_count > 0 and removed_count % 500 == 0:
            print(f"  Progress: {removed_count}/{len(placeholder_ids)} removed...")

    print(f"  ✓ Removed {removed_count} placeholder bullets")

    # Create backup
    backup_path = f"{playbook_path}.backup.cleanup"
    print(f"\n💾 Creating backup: {backup_path}")
    with open(backup_path, 'w') as f:
        json.dump(playbook, f, indent=2)

    # Save cleaned playbook
    print("💾 Saving cleaned playbook...")
    with open(playbook_path, 'w') as f:
        json.dump(playbook, f, indent=2)

    print("\n✅ Cleanup complete!")
    print(f"   Removed: {len(placeholder_ids)} placeholder bullets")
    print(f"   Remaining: {len(bullets)} bullets with real content")
    if remove_files:
        print(f"   Markdown files removed: {len(placeholder_ids)}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Clean up placeholder bullets from ByteRover playbook")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be removed without making changes")
    parser.add_argument("--remove-files", action="store_true", help="Also remove corresponding markdown files")
    parser.add_argument("--playbook", default=".brv/ace/playbook.json", help="Path to playbook.json")
    parser.add_argument("--bullets-dir", default=".brv/ace/bullets", help="Path to bullets directory")

    args = parser.parse_args()

    if not os.path.exists(args.playbook):
        print(f"❌ Playbook not found: {args.playbook}")
        sys.exit(1)

    if not os.path.exists(args.bullets_dir):
        print(f"❌ Bullets directory not found: {args.bullets_dir}")
        sys.exit(1)

    cleanup_placeholders(
        args.playbook,
        args.bullets_dir,
        dry_run=args.dry_run,
        remove_files=args.remove_files
    )

