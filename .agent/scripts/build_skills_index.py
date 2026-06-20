#!/usr/bin/env python3
"""
Build a central skills-index.md from `.agent/skills/`,
`~/.agents/skills/`, and `~/.factory/skills/`.

Generates a hub-and-spoke memory pattern for lazy loading. The output
path defaults to `.agent/skills-index.md` so the project-local human
counterpart stays in lockstep with `.agent/skills-index-compressed.json`.
"""

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Repo's `.agent/skills/` is canonical; globals augment. Output mirrors
# the compressed JSON location so the human + machine indexes co-locate.
SKILLS_DIR = Path(".agent/skills")
LEGACY_SKILLS_DIR = Path(".agents/skills")  # backwards-compat read-only source
INDEX_FILE = Path(".agent/skills-index.md")
COMPRESSED_INDEX = Path(".agent/skills-index-compressed.json")

GLOBAL_SKILLS_DIR = Path.home() / ".agents" / "skills"
GLOBAL_RELAY_DIR = Path.home() / ".factory" / "skills"


def extract_yaml_frontmatter(content):
    """Extract YAML frontmatter from SKILL.md content."""
    yaml_match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
    if not yaml_match:
        return None
    yaml_text = yaml_match.group(1)
    metadata = {}
    lines = yaml_text.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            i += 1
            continue
        if ":" not in stripped:
            i += 1
            continue
        key, value = stripped.split(":", 1)
        key = key.strip()
        value = value.strip()
        # Folded scalar ">" — accumulate following indented lines.
        if value == ">":
            collected = []
            i += 1
            while i < len(lines):
                nxt = lines[i]
                if not nxt.strip():
                    i += 1
                    break
                if not nxt.startswith((" ", "\t")):
                    break
                collected.append(nxt.strip())
                i += 1
            metadata[key] = " ".join(collected).strip().strip('"').strip("'")
            continue
        # Plain key:value
        metadata[key] = value.strip('"').strip("'")
        i += 1
    return metadata


def extract_short_description(content, max_length=120):
    """Extract a concise description from the skill content."""
    # Try getting from YAML description first; support folded scalars (">").
    yaml_meta = extract_yaml_frontmatter(content)
    if yaml_meta and "description" in yaml_meta:
        desc = yaml_meta["description"].replace("\n", " ").strip()
        if desc:
            if len(desc) > max_length:
                desc = desc[: max_length - 3] + "..."
            return desc

    after_frontmatter = re.sub(r"^---\n.*?\n---\n", "", content, flags=re.DOTALL)
    paragraphs = [p.strip() for p in after_frontmatter.split("\n\n") if p.strip()]
    for para in paragraphs:
        if not para.startswith("#") and len(para) > 20:
            if len(para) > max_length:
                return para[: max_length - 3] + "..."
            return para

    return "No description available."


def _iter_skill_dirs(source: Path, dedupe: set | None = None) -> list[Path]:
    """Iterate skill directories under `source`, following symlinks safely.

    Returns dirs in name-sorted order. Symlinks/nested repos are resolved
    once and cached in `dedupe` to prevent cycles.
    """
    if dedupe is None:
        dedupe = set()
    if not source.exists():
        return []
    out: list[Path] = []
    for p in sorted(source.iterdir(), key=lambda q: q.name):
        if not p.is_dir() and not p.is_symlink():
            continue
        real = p.resolve()
        if real in dedupe or not real.exists() or not real.is_dir():
            continue
        dedupe.add(real)
        out.append(p)
    return out


def discover_repo_root() -> Path:
    """Resolve the repo root from this script's location."""
    return Path(__file__).resolve().parents[2]


def _scan_one(skill_dir: Path, scope: str, repo_root: Path) -> dict[str, Any] | None:
    """Inspect a single skill directory and return its metadata row."""
    skill_name = skill_dir.name
    skill_file = skill_dir / "SKILL.md"

    # Skip the nested skill-index subrepo (no SKILL.md, has package.json).
    if not skill_file.exists() and (skill_dir / "package.json").exists():
        return None

    if not skill_file.exists():
        try:
            rel = skill_file.relative_to(repo_root).as_posix()
        except ValueError:
            rel = str(skill_file)
        return {
            "name": skill_name,
            "description": "No SKILL.md file found.",
            "path": rel,
            "status": "missing",
            "scope": scope,
            "yaml": {},
        }

    try:
        content = skill_file.read_text(encoding="utf-8")
    except Exception as exc:
        try:
            rel = skill_file.relative_to(repo_root).as_posix()
        except ValueError:
            rel = str(skill_file)
        return {
            "name": skill_name,
            "description": f"Error reading: {exc}",
            "path": rel,
            "status": "error",
            "scope": scope,
            "yaml": {},
        }

    if len(content.strip()) < 10:
        try:
            rel = skill_file.relative_to(repo_root).as_posix()
        except ValueError:
            rel = str(skill_file)
        return {
            "name": skill_name,
            "description": "Skill content not yet documented.",
            "path": rel,
            "status": "empty",
            "scope": scope,
            "yaml": {},
        }

    metadata = extract_yaml_frontmatter(content) or {}
    description = extract_short_description(content)
    try:
        rel = skill_file.relative_to(repo_root).as_posix()
    except ValueError:
        rel = str(skill_file)

    return {
        "name": skill_name,
        "description": description,
        "path": rel,
        "status": "populated",
        "scope": scope,
        "yaml": metadata,
    }


def scan_skills():
    """Scan global + project-local skill stores with global-first precedence.

    Precedence (lowest -> highest):
        1. `~/.factory/skills/`          (relay)
        2. `~/.agents/skills/`           (canonical global)
        3. `.agents/skills/`             (legacy project-local)
        4. `.agent/skills/`              (current project-local)

    Globals always win. Project-local only fills a slot when no global
    exists with the same name. To intentionally diverge from the global
    install, place the customised SKILL.md in `~/.agents/skills/`.
    """
    repo_root = discover_repo_root()
    skills_by_name: dict[str, dict[str, Any]] = {}

    # Globals first (preferred default).
    for scope, path in (("global_relay", GLOBAL_RELAY_DIR), ("global", GLOBAL_SKILLS_DIR)):
        seen_real_paths: set = set()
        for skill_dir in _iter_skill_dirs(path, seen_real_paths):
            row = _scan_one(skill_dir, scope, repo_root)
            if row is None:
                continue
            skills_by_name[row["name"]] = row

    # Project-local only fills gaps; globals keep their seat.
    for scope, path in (("legacy_local", LEGACY_SKILLS_DIR), ("local", SKILLS_DIR)):
        seen_real_paths = set()
        for skill_dir in _iter_skill_dirs(path, seen_real_paths):
            row = _scan_one(skill_dir, scope, repo_root)
            if row is None:
                continue
            skills_by_name.setdefault(row["name"], row)

    skills = sorted(skills_by_name.values(), key=lambda s: s["name"])
    total_dirs = len(skills)
    populated = sum(1 for s in skills if s["status"] == "populated")
    return skills, total_dirs, populated


def _load_compressed_index() -> dict[str, Any] | None:
    """Best-effort read of the compressed index for cross-reference fields."""
    if not COMPRESSED_INDEX.exists():
        return None
    try:
        with COMPRESSED_INDEX.open(encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return None


def generate_index(skills, _total_dirs, populated):
    """Generate the skills-index.md content."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    total_skills = len(skills)

    # Pick up `workflow_skills_first` from the compressed index so the
    # human + machine indexes agree on the priority list.
    priority_names: list[str] = []
    compressed = _load_compressed_index()
    if isinstance(compressed, dict):
        priority_names = list(compressed.get("workflow_skills_first") or [])

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

    # Workflow-priority block: read from compressed index when available.
    skill_by_name = {s["name"]: s for s in skills}
    if priority_names:
        priority_rows = [s for s in (skill_by_name.get(n) for n in priority_names) if s]
        if priority_rows:
            lines.append("### Workflow Pillars (orchestrators load these first)")
            lines.append("")
            for s in priority_rows:
                lines.extend(_format_skill_row(s))
            lines.append("")

    # Group by status
    populated_skills = [s for s in skills if s["status"] == "populated" and s["name"] not in priority_names]
    empty_skills = [s for s in skills if s["status"] != "populated"]

    if populated_skills:
        lines.append("### Populated Skills (with documentation)")
        lines.append("")
        for skill in populated_skills:
            lines.extend(_format_skill_row(skill))
            lines.append("")

    if empty_skills:
        lines.append("### Placeholder Skills (need documentation)")
        lines.append("")
        for skill in empty_skills:
            lines.append(f"- **{skill['name']}**")
            lines.append(f"  > {skill['description']}")
            scope = skill.get("scope", "")
            if scope:
                lines.append(f"  > Scope: `{scope}`")
            lines.append(f"  > Path: `{skill['path']}`")
            lines.append("")

    lines.extend(
        [
            "## Sources",
            "",
            "Skills come from one of:",
            "- `local`: this repo's `.agent/skills/` (highest precedence)",
            "- `legacy_local`: this repo's `.agents/skills/`",
            "- `global`: `~/.agents/skills/` (canonical user-level catalog)",
            "- `global_relay`: `~/.factory/skills/` (symlink farm to global)",
            "",
            "## Implementation Notes",
            "",
            "This index replaces the eager loading pattern in `START_HERE.md`. The startup sequence should:",
            "1. Load ONLY this index file (and `.agent/skills-index-compressed.json` for machine reads)",
            "2. Preload any skill listed under **Workflow Pillars**",
            "3. When a skill is requested via `task(load_skills=[...])` or `skill` tool, load the specific SKILL.md files from the paths listed",
            "4. Cache loaded skills in memory for the session duration",
            "5. If a skill is not in this index, fall back to scanning the directory (rare; for new skills not yet indexed)",
            "",
            "**No changes required** to individual SKILL.md files — this index is the hub, the SKILL.md files are the spokes.",
            "",
            "---",
            "",
            "*End of Skills Index*",
        ]
    )

    return "\n".join(lines)


def _format_skill_row(skill: dict[str, Any]) -> list[str]:
    meta = skill.get("yaml", {}) or {}
    model = meta.get("model", "unspecified")
    version = meta.get("version", "unversioned")
    scope = skill.get("scope", "")
    scope_tag = f" · scope={scope}" if scope else ""
    desc = skill["description"].strip()
    # Collapse excessive whitespace so folded-scalar descriptions render as one line.
    desc = re.sub(r"\s+", " ", desc)
    return [
        f"- **{skill['name']}** (`{model}` · v{version}{scope_tag})",
        f"  > {desc}",
        f"  > Path: `{skill['path']}`",
    ]


def main():
    repo_root = discover_repo_root()
    sys.stdout.write(f"Repo root: {repo_root}\n")
    sources = ", ".join(
        f"{label}={path}"
        for label, path in [
            ("global_relay", GLOBAL_RELAY_DIR),
            ("global", GLOBAL_SKILLS_DIR),
            ("legacy_local", LEGACY_SKILLS_DIR),
            ("local", SKILLS_DIR),
        ]
    )
    sys.stdout.write(f"Sources: {sources}\n")
    sys.stdout.write("Scanning skill directories...\n")
    skills, total_dirs, populated = scan_skills()
    sys.stdout.write(f"Found {total_dirs} skill directories, {populated} populated\n")

    index_content = generate_index(skills, total_dirs, populated)
    INDEX_FILE.parent.mkdir(parents=True, exist_ok=True)
    INDEX_FILE.write_text(index_content, encoding="utf-8")
    sys.stdout.write(f"Wrote skills index to {INDEX_FILE}\n")
    sys.stdout.write(f"Index size: {len(index_content):,} characters (~{len(index_content) // 4:,} tokens)\n")
    return True


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
