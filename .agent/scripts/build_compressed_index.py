#!/usr/bin/env python3
"""
Build the compressed skills index for low-token startup context.

What this script does:
- Scans `.agents/skills/*/SKILL.md`
- Extracts a concise summary and category per skill
- Writes `.agents/skills-index-compressed.json` with deterministic ordering
- Emits stable startup metadata for lazy-loading flows

Design goals:
- Repo-relative paths (no hardcoded absolute machine paths)
- Deterministic output (stable key ordering + fixed generation mode)
- Safe defaults when files are missing or partially populated
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def discover_repo_root() -> Path:
    """
    Resolve repository root robustly using this script location:
    <repo>/.agent/scripts/build_compressed_index.py
    """
    return Path(__file__).resolve().parents[2]


REPO_ROOT = discover_repo_root()
AGENT_ROOT = REPO_ROOT / ".agent"
SKILLS_DIR = AGENT_ROOT / "skills"
COMPRESSED_INDEX = AGENT_ROOT / "skills-index-compressed.json"
GENERATOR = "pixelated/.agent/scripts/build_compressed_index.py"
SCHEMA_VERSION = "2.0"


CATEGORY_PATTERNS: dict[str, list[str]] = {
    "frontend": [
        "frontend",
        "ui",
        "ux",
        "react",
        "nextjs",
        "tailwind",
        "web-design",
        "radix",
        "wcag",
        "accessibility",
    ],
    "backend": [
        "backend",
        "api",
        "fastapi",
        "nodejs",
        "auth",
        "service",
    ],
    "devops": [
        "devops",
        "ci",
        "cd",
        "docker",
        "kubernetes",
        "k8s",
        "terraform",
        "deploy",
        "workflow",
        "vercel",
        "monorepo",
    ],
    "security": [
        "security",
        "audit",
        "compliance",
        "sast",
        "hardening",
        "xss",
        "penetration",
        "pentest",
    ],
    "testing": [
        "test",
        "testing",
        "playwright",
        "e2e",
        "tdd",
        "verification",
        "debug",
    ],
    "ai": [
        "ai",
        "agent",
        "rag",
        "langchain",
        "langgraph",
        "ml",
        "mlops",
        "prompt",
        "memory",
        "vector",
    ],
    "data": [
        "database",
        "postgres",
        "sql",
        "nosql",
        "analytics",
        "observability",
        "prometheus",
        "grafana",
    ],
    "automation": [
        "automation",
        "orchestration",
        "mcp",
        "subagent",
        "parallel",
        "n8n",
        "zapier",
    ],
    "documentation": [
        "documentation",
        "documenter",
        "readme",
        "mermaid",
        "planning",
    ],
    "language": [
        "python",
        "typescript",
        "javascript",
        "bash",
        "shell",
    ],
}


def guess_category(skill_name: str) -> str:
    name = skill_name.lower()
    for category, patterns in CATEGORY_PATTERNS.items():
        for pat in patterns:
            if pat in name:
                return category
    return "general"


def strip_frontmatter(content: str) -> tuple[dict[str, str], str]:
    """
    Naive YAML frontmatter parser for simple key:value fields.
    Returns (frontmatter_dict, remaining_content).
    """
    if not content.startswith("---\n"):
        return {}, content

    match = re.match(r"^---\n(.*?)\n---\n?", content, flags=re.DOTALL)
    if not match:
        return {}, content

    raw = match.group(1)
    rest = content[match.end() :]

    data: dict[str, str] = {}
    for line in raw.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or ":" not in line:
            continue
        key, value = line.split(":", 1)
        data[key.strip()] = value.strip().strip('"').strip("'")
    return data, rest


def extract_summary(skill_file: Path) -> tuple[str, dict[str, str]]:
    """
    Extract a one-line summary from SKILL.md with frontmatter preference.
    """
    if not skill_file.exists():
        return "No SKILL.md file found.", {}

    try:
        content = skill_file.read_text(encoding="utf-8")
    except Exception as exc:
        return f"Error reading SKILL.md: {exc}", {}

    frontmatter, body = strip_frontmatter(content)

    # 1) Prefer explicit description in frontmatter
    desc = frontmatter.get("description", "").strip()
    if desc:
        return truncate(desc, 140), frontmatter

    # 2) First meaningful non-heading, non-list line
    for line in body.splitlines():
        s = line.strip()
        if not s:
            continue
        if s.startswith("#") or s.startswith("-") or s.startswith(">"):
            continue
        if len(s) < 20:
            continue
        return truncate(s, 140), frontmatter

    return "Skill content not yet documented.", frontmatter


def truncate(text: str, max_len: int) -> str:
    if len(text) <= max_len:
        return text
    return text[: max_len - 3].rstrip() + "..."


def stable_now_utc() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def list_skill_dirs() -> list[Path]:
    if not SKILLS_DIR.exists():
        return []
    return sorted([p for p in SKILLS_DIR.iterdir() if p.is_dir()], key=lambda p: p.name)


def scan_skills() -> tuple[dict[str, Any], dict[str, int]]:
    skills: dict[str, Any] = {}
    totals = {"total": 0, "populated": 0, "missing": 0, "errors": 0}

    for skill_dir in list_skill_dirs():
        totals["total"] += 1
        skill_name = skill_dir.name
        skill_file = skill_dir / "SKILL.md"

        summary, frontmatter = extract_summary(skill_file)
        category = guess_category(skill_name)
        rel_path = (
            skill_file.relative_to(REPO_ROOT).as_posix()
            if skill_file.exists()
            else (skill_dir / "SKILL.md").relative_to(REPO_ROOT).as_posix()
        )

        status = "populated"
        if not skill_file.exists():
            status = "missing"
            totals["missing"] += 1
        else:
            try:
                size = skill_file.stat().st_size
                if size < 80:
                    status = "sparse"
                totals["populated"] += 1
            except Exception:
                status = "error"
                totals["errors"] += 1

        entry = {
            "name": skill_name,
            "summary": summary,
            "category": category,
            "path": rel_path,
            "status": status,
        }

        # Preserve lightweight useful frontmatter keys if present
        for k in ("version", "model", "trigger", "description"):
            if frontmatter.get(k):
                entry[k] = frontmatter[k]

        skills[skill_name] = entry

    return skills, totals


def build_index() -> dict[str, Any]:
    skills, totals = scan_skills()

    categories: dict[str, int] = {}
    for item in skills.values():
        c = str(item.get("category", "general"))
        categories[c] = categories.get(c, 0) + 1
    categories = dict(sorted(categories.items(), key=lambda kv: kv[0]))

    # deterministic snapshot fingerprint input (stable because keys sorted)
    skills_json = json.dumps(skills, ensure_ascii=False, sort_keys=True)
    char_count = len(skills_json)
    token_estimate = max(1, char_count // 4) if skills else 0

    index: dict[str, Any] = {
        "$schema": "https://json-schema.org/draft-07/schema",
        "version": SCHEMA_VERSION,
        "generated_at_utc": stable_now_utc(),
        "generator": GENERATOR,
        "repo_root": REPO_ROOT.as_posix(),
        "description": "Compressed skill metadata for low-token startup context. Load full SKILL.md on-demand.",
        "startup": {
            "mode": "lazy",
            "default_load": [".agents/skills-index-compressed.json"],
            "defer_load": [".agents/skills/*/SKILL.md"],
            "target_startup_tokens_max": 20000,
            "estimated_index_tokens": token_estimate,
            "within_target": token_estimate <= 20000,
        },
        "stats": {
            "total": totals["total"],
            "populated": totals["populated"],
            "missing": totals["missing"],
            "errors": totals["errors"],
            "categories": categories,
        },
        "skills": dict(sorted(skills.items(), key=lambda kv: kv[0])),
    }

    return index


def write_index(index: dict[str, Any]) -> None:
    AGENT_ROOT.mkdir(parents=True, exist_ok=True)
    COMPRESSED_INDEX.write_text(
        json.dumps(index, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    if not SKILLS_DIR.exists():
        print(f"Error: skills directory not found: {SKILLS_DIR}")
        return 1

    index = build_index()
    write_index(index)

    stats = index.get("stats", {})
    startup = index.get("startup", {})

    print(f"Repo root: {REPO_ROOT}")
    print(f"Skills dir: {SKILLS_DIR}")
    print(f"Wrote: {COMPRESSED_INDEX}")
    print(
        "Stats: total={total}, populated={populated}, missing={missing}, errors={errors}".format(
            total=stats.get("total", 0),
            populated=stats.get("populated", 0),
            missing=stats.get("missing", 0),
            errors=stats.get("errors", 0),
        )
    )
    print(
        "Startup tokens estimate: {tok} (target <= {target}) | within_target={ok}".format(
            tok=startup.get("estimated_index_tokens", 0),
            target=startup.get("target_startup_tokens_max", 20000),
            ok=startup.get("within_target", False),
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
