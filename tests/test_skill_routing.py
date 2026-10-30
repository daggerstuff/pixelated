"""Skill spec & routing validation tests.

Validates that every SKILL.md file under the repository root ``skills/``
directory defines valid frontmatter, required keys, and unique names —
mirroring the routing definitions the local assistant depends on.

Also exercises the parser against the shipped fixtures in
``tests/fixtures/sample_skills/`` (a well-formed skill must pass, the
deliberately broken one must fail the required-key check).

Run with: ``pytest tests/test_skill_routing.py -v``
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

SKILLS_DIR = Path(__file__).resolve().parent.parent / "skills"
FIXTURE_SKILLS_DIR = Path(__file__).resolve().parent / "fixtures" / "sample_skills"

REQUIRED_FRONTMATTER_KEYS = frozenset({"name", "description", "triggers"})

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---", re.DOTALL)
# A top-level frontmatter mapping entry: starts at column 0, ends before the
# first comment (a trailing ``# ...`` never starts a new key).
TOP_LEVEL_KEY_RE = re.compile(r"^([A-Za-z_][A-Za-z0-9_-]*)\s*:")


def parse_skill_metadata(skill_path: Path) -> dict:
    """Extract the top-level frontmatter keys of a SKILL.md file.

    Scalar values are returned trimmed; block-list values (e.g. the
    ``triggers`` list) are joined with newlines so the raw list stays
    iterable line-by-line.
    """
    content = skill_path.read_text(encoding="utf-8")
    frontmatter_match = FRONTMATTER_RE.match(content)
    assert frontmatter_match, f"Missing YAML frontmatter in {skill_path}"

    meta: dict[str, str] = {}
    current_key: str | None = None
    for line in frontmatter_match.group(1).splitlines():
        key_match = TOP_LEVEL_KEY_RE.match(line)
        if key_match:
            key = key_match.group(1)
            raw_value = line[key_match.end() :].split("#", 1)[0].strip()
            meta[key] = raw_value.strip("\"'")
            # A key with an empty inline value opens a block list.
            current_key = key if not raw_value else None
            continue
        # Indented block-list item (e.g. '  - write unit tests') attaches
        # to the most recent key that had an empty inline value.
        item_match = re.match(r"^\s+-\s+(.*)$", line)
        if item_match and current_key is not None:
            value = item_match.group(1).split("#", 1)[0].strip().strip("\"'")
            if value:
                meta[current_key] = f"{meta[current_key]}\n{value}" if meta[current_key] else value
    return meta


def _required_key_error(meta: dict) -> str | None:
    missing = REQUIRED_FRONTMATTER_KEYS - meta.keys()
    if missing:
        return f"missing required keys: {sorted(missing)}"
    return None


def _parse_fixture_skill(relative: str) -> dict:
    path = FIXTURE_SKILLS_DIR / relative
    assert path.exists(), f"Fixture missing: {path}"
    return parse_skill_metadata(path)


# ── Repository skills/ directory ────────────────────────────


@pytest.fixture(scope="session")
def all_skill_files() -> list[Path]:
    skills = sorted(SKILLS_DIR.glob("**/SKILL.md"))
    assert skills, f"No SKILL.md files located under {SKILLS_DIR}"
    return skills


def test_skill_required_frontmatter(all_skill_files: list[Path]) -> None:
    for skill in all_skill_files:
        meta = parse_skill_metadata(skill)
        error = _required_key_error(meta)
        assert error is None, f"{skill}: {error}"


def test_skill_name_uniqueness(all_skill_files: list[Path]) -> None:
    seen: dict[str, Path] = {}
    for skill in all_skill_files:
        name = parse_skill_metadata(skill).get("name")
        assert name, f"{skill}: frontmatter 'name' is empty"
        duplicate = seen.get(name)
        assert duplicate is None, f"Duplicate skill name detected: {name!r} in {skill} (already defined in {duplicate})"
        seen[name] = skill


def test_skill_names_match_directories(all_skill_files: list[Path]) -> None:
    """A skill name should match its directory so router targets stay stable."""
    for skill in all_skill_files:
        name = parse_skill_metadata(skill).get("name")
        assert name == skill.parent.name, (
            f"{skill}: frontmatter name {name!r} does not match directory {skill.parent.name!r}"
        )


# ── Shipped fixtures (parser behaviour) ─────────────────────


def test_valid_fixture_skill_passes_required_keys() -> None:
    meta = _parse_fixture_skill("valid_skill/SKILL.md")
    error = _required_key_error(meta)
    assert error is None, f"valid_skill fixture unexpectedly failed: {error}"
    assert meta["name"] == "fixture-valid-skill"


def test_invalid_fixture_skill_fails_required_keys() -> None:
    meta = _parse_fixture_skill("invalid_skill/SKILL.md")
    assert _required_key_error(meta) is not None, "invalid_skill fixture must be missing description/triggers"
