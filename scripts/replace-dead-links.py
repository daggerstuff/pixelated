#!/usr/bin/env python3
"""
replace-dead-links.py
Reads the mapping produced by archive-planning-docs.sh (mapping.tsv) and
replaces any markdown links pointing to archived paths with a standardised
deprecation notice.

Usage:
    python3 scripts/replace-dead-links.py [--mapping PATH] [--repo REPO_ROOT] [--dry-run]

Defaults:
    --mapping  ~/.agent/internal/ARCHIVED/mapping.tsv
    --repo     git repo root (auto-detected)
"""

import argparse
import re
import subprocess
import sys
from pathlib import Path

REPLACEMENT = "[Reference deprecated: Refer to Linear for current status]"

# Matches both inline and reference-style markdown links
#   [text](path)  OR  [text]: path
LINK_RE = re.compile(
    r"(\[(?:[^\]]*)\]\()([^)]+)(\))"  # inline
    r"|"
    r"(\[(?:[^\]]*)\]:\s*)(\S+)",  # reference-style
    re.MULTILINE,
)


def repo_root() -> Path:
    try:
        root = (
            subprocess.check_output(["git", "rev-parse", "--show-toplevel"], stderr=subprocess.DEVNULL).decode().strip()
        )
        return Path(root)
    except Exception:
        return Path.cwd()


def load_mapping(mapping_path: Path) -> set[str]:
    """Returns a set of original (archived) absolute paths."""
    archived: set[str] = set()
    if not mapping_path.exists():
        sys.exit(f"Mapping file not found: {mapping_path}")
    with mapping_path.open() as f:
        next(f)  # skip header
        for line in f:
            line = line.strip()
            if not line:
                continue
            old, *_ = line.split("\t")
            archived.add(old)
    return archived


def is_archived(link_target: str, archived_paths: set[str], base_dir: Path) -> bool:
    """Resolve a relative or absolute link against base_dir and check mapping."""
    target = link_target.split("#", maxsplit=1)[0].split("?", maxsplit=1)[0].strip()
    if not target:
        return False
    p = Path(target)
    resolved = (base_dir / p).resolve() if not p.is_absolute() else p.resolve()
    return str(resolved) in archived_paths


def replace_in_file(path: Path, archived_paths: set[str], dry_run: bool) -> int:
    """Returns number of replacements made."""
    original = path.read_text(encoding="utf-8", errors="replace")
    replacements = 0
    base_dir = path.parent

    def replacer(m: re.Match) -> str:
        nonlocal replacements
        if m.group(2):  # inline link: [text](target)
            target = m.group(2)
            if is_archived(target, archived_paths, base_dir):
                replacements += 1
                return REPLACEMENT
        elif m.group(5):  # reference-style: [text]: target
            target = m.group(5)
            if is_archived(target, archived_paths, base_dir):
                replacements += 1
                return REPLACEMENT
        return m.group(0)

    updated = LINK_RE.sub(replacer, original)

    if replacements and not dry_run:
        path.write_text(updated, encoding="utf-8")

    return replacements


def find_markdown_files(root: Path) -> list[Path]:
    excludes = {".git", "node_modules", ".venv", ".pytest_cache"}
    results = []
    for p in root.rglob("*.md"):
        parts = set(p.parts)
        if parts.isdisjoint(excludes):
            results.append(p)
    return results


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mapping", default=str(Path.home() / ".agent/internal/ARCHIVED/mapping.tsv"))
    parser.add_argument("--repo", default=None)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    root = Path(args.repo) if args.repo else repo_root()
    mapping_path = Path(args.mapping)
    archived_paths = load_mapping(mapping_path)

    if args.dry_run:
        pass

    total_files = total_replacements = 0
    for md_file in find_markdown_files(root):
        count = replace_in_file(md_file, archived_paths, args.dry_run)
        if count:
            total_files += 1
            total_replacements += count


if __name__ == "__main__":
    main()
