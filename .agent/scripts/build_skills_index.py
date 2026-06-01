#!/usr/bin/env python3
"""
Build a central skills-index.md from .agents/skills/ directory.
Generates a hub-and-spoke memory pattern for lazy loading.
"""

import re
from datetime import datetime
from pathlib import Path

SKILLS_DIR = Path(".agents/skills")
INDEX_FILE = Path(".agents/skills-index.md")


def extract_yaml_frontmatter(content):
    """Extract YAML frontmatter from SKILL.md content."""
    yaml_match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
    if not yaml_match:
        return None
    yaml_text = yaml_match.group(1)
    metadata = {}
    for line in yaml_text.split("\n"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" in line:
            key, value = line.split(":", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            metadata[key] = value
    return metadata


def extract_short_description(content, max_length=120):
    """Extract a concise description from the skill content."""
    # Try getting from YAML description first
    yaml_meta = extract_yaml_frontmatter(content)
    if yaml_meta and "description" in yaml_meta:
        desc = yaml_meta["description"]
        if len(desc) > max_length:
            desc = desc[: max_length - 3] + "..."
        return desc

    # Fallback: get first paragraph after frontmatter
    after_frontmatter = re.sub(r"^---\n.*?\n---\n", "", content, flags=re.DOTALL)
    paragraphs = [p.strip() for p in after_frontmatter.split("\n\n") if p.strip()]
    for para in paragraphs:
        if not para.startswith("#") and len(para) > 20:
            if len(para) > max_length:
                para = para[: max_length - 3] + "..."
            return para

    return "No description available."


def scan_skills():
    """Scan all skill directories and collect metadata."""
    skills = []
    total_dirs = 0
    populated = 0

    if not SKILLS_DIR.exists():
        print(f"Error: {SKILLS_DIR} does not exist")
        return skills, total_dirs, populated

    for skill_dir in sorted(SKILLS_DIR.iterdir()):
        if not skill_dir.is_dir():
            continue
        total_dirs += 1
        skill_name = skill_dir.name
        skill_file = skill_dir / "SKILL.md"

        if skill_file.exists():
            try:
                content = skill_file.read_text()
                if len(content.strip()) < 10:
                    # Empty or near-empty file
                    skills.append(
                        {
                            "name": skill_name,
                            "description": "Skill content not yet documented.",
                            "path": f".agents/skills/{skill_name}/SKILL.md",
                            "status": "empty",
                        }
                    )
                    continue

                metadata = extract_yaml_frontmatter(content)
                description = extract_short_description(content)

                skills.append(
                    {
                        "name": skill_name,
                        "description": description,
                        "path": f".agents/skills/{skill_name}/SKILL.md",
                        "status": "populated",
                        "yaml": metadata,
                    }
                )
                populated += 1
            except Exception as e:
                skills.append(
                    {
                        "name": skill_name,
                        "description": f"Error reading: {e}",
                        "path": f".agents/skills/{skill_name}/SKILL.md",
                        "status": "error",
                    }
                )
        else:
            skills.append(
                {
                    "name": skill_name,
                    "description": "No SKILL.md file found.",
                    "path": f".agents/skills/{skill_name}/",
                    "status": "missing",
                }
            )

    return skills, total_dirs, populated


def generate_index(skills, total_dirs, populated):
    """Generate the skills-index.md content."""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    total_skills = len(skills)

    lines = [
        "# Skills Index (Hub-and-Spoke Lazy Loading)",
        "",
        f"*Generated: {now}*",
        f"*Total skills: {total_skills} | Populated: {populated} | Empty/missing: {total_skills - populated}*",
        "",
        "## Purpose",
        "",
        "This index enables **lazy loading** of skill definitions. Instead of loading all skill files at startup (which consumes 70-100K tokens), only this lightweight index is loaded initially. Individual skill details are loaded on-demand when referenced.",
        "",
        "## Lazy Loading Directive",
        "",
        "**When a skill is invoked:**",
        "1. Check this index for the skill name and path",
        "2. Load only THAT skill's SKILL.md file (typical: ~2-5K tokens)",
        "3. Cache the loaded skill for session reuse",
        "",
        "**Expected token reduction:**",
        "- Startup: Index only (~5-10K tokens) vs all skills (~70-100K tokens)",
        "- Savings: **60-70% reduction** in initial context consumption",
        "",
        "## Skills Catalog",
        "",
    ]

    # Group by status
    populated_skills = [s for s in skills if s["status"] == "populated"]
    empty_skills = [s for s in skills if s["status"] != "populated"]

    if populated_skills:
        lines.append("### Populated Skills (with documentation)")
        lines.append("")
        for skill in populated_skills:
            meta = skill.get("yaml", {})
            model = meta.get("model", "unspecified")
            version = meta.get("version", "unversioned")
            lines.append(f"- **{skill['name']}** (`{model}` · v{version})")
            lines.append(f"  > {skill['description']}")
            lines.append(f"  > Path: `{skill['path']}`")
            lines.append("")

    if empty_skills:
        lines.append("### Placeholder Skills (need documentation)")
        lines.append("")
        for skill in empty_skills:
            lines.append(f"- **{skill['name']}**")
            lines.append(f"  > {skill['description']}")
            lines.append(f"  > Path: `{skill['path']}`")
            lines.append("")

    lines.extend(
        [
            "## Implementation Notes",
            "",
            "This index replaces the eager loading pattern in `START_HERE.md`. The startup sequence should:",
            "1. Load ONLY this index file (12-15KB maximum)",
            "2. When a skill is requested via `task(load_skills=[...])` or `skill` tool, load the specific SKILL.md files from the paths listed",
            "3. Cache loaded skills in memory for the session duration",
            "4. If a skill is not in this index, fall back to scanning the directory (rare; for new skills not yet indexed)",
            "",
            "**No changes required** to individual SKILL.md files — this index is the hub, the SKILL.md files are the spokes.",
            "",
            "---",
            "",
            "*End of Skills Index*",
        ]
    )

    return "\n".join(lines)


def main():
    print("Scanning .agents/skills/ directory...")
    skills, total_dirs, populated = scan_skills()
    print(f"Found {total_dirs} skill directories, {populated} populated")

    index_content = generate_index(skills, total_dirs, populated)
    INDEX_FILE.write_text(index_content)
    print(f"Wrote skills index to {INDEX_FILE}")
    print(f"Index size: {len(index_content):,} characters (~{len(index_content) // 4:,} tokens)")
    return True


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
