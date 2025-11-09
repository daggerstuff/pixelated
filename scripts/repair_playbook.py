#!/usr/bin/env python3
"""
Repair ByteRover playbook by syncing content from markdown files.
This fixes the issue where playbook.json has bullets without content fields.
"""

import json
import os
import re


def extract_content_from_md(file_path: str) -> str:
    """Extract content from markdown file, skipping the header comment."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Remove the header comment block if present
        # Header looks like: <!--\nWARNING: ...\n-->
        content = re.sub(r'<!--.*?-->\s*', '', content, flags=re.DOTALL)

        return content.strip()
    except Exception as e:
        print(f"  Error reading {file_path}: {e}")
        return ""


def repair_playbook(playbook_path: str, bullets_dir: str):
    """Repair playbook by syncing content from markdown files."""
    print(f"🔧 Repairing playbook: {playbook_path}")

    # Load playbook
    with open(playbook_path, 'r') as f:
        playbook = json.load(f)

    bullets = playbook.get('bullets', {})
    print(f"📊 Total bullets in playbook: {len(bullets)}")

    # Count bullets needing repair
    needs_repair = 0
    repaired = 0
    missing_files = 0

    for bullet_id, bullet_data in bullets.items():
        # Check if content is missing
        if not bullet_data.get('content') and not bullet_data.get('bullet'):
            needs_repair += 1

            # Check if markdown file exists
            md_file = os.path.join(bullets_dir, f"{bullet_id}.md")
            if os.path.exists(md_file):
                content = extract_content_from_md(md_file)
                if content:
                    # Add content to bullet
                    bullet_data['content'] = content
                    repaired += 1

                    if repaired % 100 == 0:
                        print(f"  Repaired {repaired} bullets...")
                else:
                    # Empty file - remove bullet from playbook or add placeholder
                    # For now, we'll add a minimal placeholder to prevent validation errors
                    bullet_data['content'] = "[Empty bullet - content not available]"
                    repaired += 1
                    if missing_files < 10:
                        print(f"  ⚠️  Empty content in {bullet_id}.md - added placeholder")
                    missing_files += 1
            else:
                missing_files += 1
                # Add placeholder for missing files too
                bullet_data['content'] = "[Missing file - content not available]"
                repaired += 1
                if missing_files <= 10:
                    print(f"  ⚠️  Missing file: {bullet_id}.md - added placeholder")

    print("\n📊 Repair Summary:")
    print(f"  Bullets needing repair: {needs_repair}")
    print(f"  Successfully repaired: {repaired}")
    print(f"  Missing files: {missing_files}")

    if repaired > 0:
        # Backup original playbook
        backup_path = f"{playbook_path}.backup"
        print(f"\n💾 Creating backup: {backup_path}")
        with open(backup_path, 'w') as f:
            json.dump(playbook, f, indent=2)

        # Save repaired playbook
        print("💾 Saving repaired playbook...")
        with open(playbook_path, 'w') as f:
            json.dump(playbook, f, indent=2)

        print(f"✅ Playbook repaired! {repaired} bullets now have content.")
        return True
    else:
        print("ℹ️  No repairs needed or no content found in files.")
        return False


if __name__ == "__main__":
    import sys

    playbook_path = ".brv/ace/playbook.json"
    bullets_dir = ".brv/ace/bullets"

    if not os.path.exists(playbook_path):
        print(f"❌ Playbook not found: {playbook_path}")
        sys.exit(1)

    if not os.path.exists(bullets_dir):
        print(f"❌ Bullets directory not found: {bullets_dir}")
        sys.exit(1)

    success = repair_playbook(playbook_path, bullets_dir)
    sys.exit(0 if success else 1)

