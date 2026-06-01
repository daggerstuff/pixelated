#!/usr/bin/env python3
"""
Add cacheable: true to all populated skill SKILL.md files.
This enables prompt caching for static skill descriptions.
"""

from pathlib import Path

SKILLS_DIR = Path(".agents/skills")
updated = 0
skipped = 0
errors = 0


def update_skill_file(skill_path: Path):
    """Add cacheable: true to YAML frontmatter if not present."""
    try:
        content = skill_path.read_text()
        # Check if already has cacheable
        if "cacheable:" in content[:500]:
            return False, "already has cacheable"

        # Find YAML frontmatter
        if not content.startswith("---"):
            return False, "no frontmatter"

        # Find the end of frontmatter
        fm_end = content.find("\n---", 3)
        if fm_end == -1:
            return False, "invalid frontmatter"

        # Insert cacheable after version/name/description, before metadata if present
        # We'll add it right after the description line or after metadata if metadata appears first
        frontmatter = content[3:fm_end]
        lines = frontmatter.split("\n")

        # Find insertion point: after last metadata field but before closing ---
        # Strategy: insert at the end of frontmatter (just before closing ---)
        new_frontmatter = frontmatter.rstrip() + "\ncacheable: true"

        new_content = "---\n" + new_frontmatter + "\n---" + content[fm_end + 4 :]

        skill_path.write_text(new_content)
        return True, "updated"
    except Exception as e:
        return False, f"error: {e}"


print("Updating skill files with cacheable: true...")
for skill_dir in sorted(SKILLS_DIR.iterdir()):
    if not skill_dir.is_dir():
        continue
    skill_file = skill_dir / "SKILL.md"
    if not skill_file.exists():
        continue
    # Only update files with substantial content (populated)
    content = skill_file.read_text()
    if len(content.strip()) < 50:
        skipped += 1
        continue
    # Also skip if already has cacheable
    if "cacheable:" in content[:500]:
        skipped += 1
        continue

    updated_count, reason = update_skill_file(skill_file)
    if updated_count:
        updated += 1
        print(f"  ✓ {skill_dir.name}")
    else:
        errors += 1
        if errors <= 10:
            print(f"  ✗ {skill_dir.name}: {reason}")

print(f"\nComplete. Updated: {updated}, Skipped: {skipped}, Errors: {errors}")
