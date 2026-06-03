#!/usr/bin/env python3
"""
One-command .agent context refresh pipeline.

What it does:
1) Curates `.agents/skills` (optional second-pass overlap cleanup)
2) Curates `.agent/rules` to canonical set
3) Rebuilds compressed + human-readable skills indexes
4) Writes curation manifests and a run summary

Usage examples:
  python3 .agent/scripts/refresh_agent_context.py
  python3 .agent/scripts/refresh_agent_context.py --dry-run
  python3 .agent/scripts/refresh_agent_context.py --skip-skills --skip-rules
  python3 .agent/scripts/refresh_agent_context.py --no-second-pass
"""

from __future__ import annotations

import argparse
import json
import shutil
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

# ----------------------------
# Paths / constants
# ----------------------------

REPO_ROOT = Path(__file__).resolve().parents[2]
AGENT_ROOT = REPO_ROOT / ".agent"
SKILLS_DIR = AGENT_ROOT / "skills"
RULES_DIR = AGENT_ROOT / "rules"
SCRIPTS_DIR = AGENT_ROOT / "scripts"

SKILLS_REPORT_JSON = AGENT_ROOT / "skills-curation-report.json"
SKILLS_KEPT_TXT = AGENT_ROOT / "skills-curation-kept.txt"
SKILLS_REMOVED_TXT = AGENT_ROOT / "skills-curation-removed.txt"

RULES_REPORT_JSON = AGENT_ROOT / "rules-curation-report.json"
RULES_KEPT_TXT = AGENT_ROOT / "rules-curation-kept.txt"
RULES_REMOVED_TXT = AGENT_ROOT / "rules-curation-removed.txt"

RUN_REPORT_JSON = AGENT_ROOT / "refresh-agent-context-report.json"

COMPRESSED_INDEX_BUILDER = SCRIPTS_DIR / "build_compressed_index.py"
SKILLS_INDEX_BUILDER = SCRIPTS_DIR / "build_skills_index.py"


CANONICAL_RULES: set[str] = {
    "ai-prompt-engineer-agent.md",
    "cloud-architect.md",
    "code-migration-agent.md",
    "code-review-agent.md",
    "database-design-agent.md",
    "debugging-agent.md",
    "devops-cicd-agent.md",
    "llm-architect.md",
    "performance-optimization-agent.md",
    "python-pro.md",
    "refactoring-agent.md",
    "security-audit-agent.md",
    "strong-reasoner-planner-agent.md",
    "test-writing-agent.md",
    "typescript-pro.md",
}


# ----------------------------
# Helpers
# ----------------------------


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def list_skill_dirs() -> list[Path]:
    if not SKILLS_DIR.exists():
        return []
    return sorted([p for p in SKILLS_DIR.iterdir() if p.is_dir()], key=lambda p: p.name)


def write_lines(path: Path, lines: list[str]) -> None:
    path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")


def read_index_stats(index_path: Path) -> dict[str, int]:
    if not index_path.exists():
        return {"total": 0, "populated": 0, "missing": 0, "errors": 0}
    try:
        payload = json.loads(index_path.read_text(encoding="utf-8"))
        stats = payload.get("stats", {})
        return {
            "total": int(stats.get("total", 0)),
            "populated": int(stats.get("populated", 0)),
            "missing": int(stats.get("missing", 0)),
            "errors": int(stats.get("errors", 0)),
        }
    except Exception:
        return {"total": 0, "populated": 0, "missing": 0, "errors": 0}


def estimate_tokens_for_json(path: Path) -> int:
    if not path.exists():
        return 0
    text = path.read_text(encoding="utf-8")
    return max(0, len(text) // 4)


def build_indexes() -> dict[str, str]:
    # Import dynamically so the script works as a single command without shelling out.
    # These files are already in-repo and maintained here.
    import importlib.util

    results: dict[str, str] = {}

    # compressed index
    spec1 = importlib.util.spec_from_file_location("build_compressed_index", str(COMPRESSED_INDEX_BUILDER))
    if spec1 is None or spec1.loader is None:
        raise RuntimeError(f"Unable to load {COMPRESSED_INDEX_BUILDER}")
    mod1 = importlib.util.module_from_spec(spec1)
    spec1.loader.exec_module(mod1)  # type: ignore[attr-defined]
    exit_code = mod1.main()  # expected by our in-repo script
    if int(exit_code) != 0:
        raise RuntimeError("build_compressed_index.py failed")
    results["compressed_index"] = "ok"

    # human-readable index
    spec2 = importlib.util.spec_from_file_location("build_skills_index", str(SKILLS_INDEX_BUILDER))
    if spec2 is None or spec2.loader is None:
        raise RuntimeError(f"Unable to load {SKILLS_INDEX_BUILDER}")
    mod2 = importlib.util.module_from_spec(spec2)
    spec2.loader.exec_module(mod2)  # type: ignore[attr-defined]
    ok = mod2.main()
    if ok is False:
        raise RuntimeError("build_skills_index.py failed")
    results["skills_index"] = "ok"

    return results


# ----------------------------
# Skills curation logic
# ----------------------------


def family(name: str) -> str:
    n = name.lower()
    if n.startswith("cc-skill-"):
        return "cc-skill"
    if n.startswith("agent-orchestration"):
        return "agent-orchestration"
    if (
        n.startswith("api-documentation")
        or n.startswith("documentation-generation")
        or n.startswith("code-documentation")
    ):
        return "documentation"
    if n.startswith("code-review") or n in {"receiving-code-review", "requesting-code-review"}:
        return "code-review"
    if n.startswith("error-debugging") or n in {
        "debugger",
        "debugging-strategies",
        "systematic-debugging",
        "error-detective",
    }:
        return "debugging"
    if n.startswith("incident-response") or n == "incident-responder":
        return "incident-response"
    if n.startswith("observability-") or n in {
        "observability-engineer",
        "slo-implementation",
        "prometheus-configuration",
        "grafana-dashboards",
        "service-mesh-observability",
    }:
        return "observability"
    if n.startswith("prompt-"):
        return "prompt"
    if n.startswith("react-"):
        return "react"
    if n.startswith("nextjs-"):
        return "nextjs"
    if n.startswith("tdd-") or n in {"test-driven-development"}:
        return "tdd"
    if n.startswith("testing-") or n in {
        "test-automator",
        "test-fixing",
        "unit-testing-test-generate",
        "e2e-testing-patterns",
        "javascript-testing-patterns",
        "python-testing-patterns",
        "webapp-testing",
        "playwright-skill",
    }:
        return "testing"
    if n.startswith("terraform-"):
        return "terraform"
    if n.startswith("typescript-"):
        return "typescript"
    if n.startswith("workflow-") or n in {"cicd-automation-workflow-automate"}:
        return "workflow"
    if n.startswith("voice-ai-") or n == "voice-agents":
        return "voice"
    if n.startswith("memory-") or n in {
        "conversation-memory",
        "agent-memory-mcp",
        "agent-memory-systems",
        "memory-systems",
    }:
        return "memory"
    if n.startswith("python-") or n in {
        "fastapi-pro",
        "fastapi-templates",
        "uv-package-manager",
        "async-python-patterns",
        "temporal-python-pro",
        "temporal-python-testing",
    }:
        return "python"
    if n.startswith("security-") or n in {
        "security-auditor",
        "pci-compliance",
        "penetration-tester-master",
        "pentest-checklist",
        "pentest-commands",
        "sql-injection-testing",
        "sqlmap-database-pentesting",
        "frontend-mobile-security-xss-scan",
        "frontend-security-coder",
        "mobile-security-coder",
        "k8s-security-policies",
    }:
        return "security"
    if n.startswith("architecture") or n in {
        "software-architecture",
        "cloud-architect",
        "kubernetes-architect",
        "monorepo-architect",
        "database-architect",
        "event-sourcing-architect",
        "langchain-architecture",
        "multi-cloud-architecture",
    }:
        return "architecture"
    if n.startswith("database-") or n in {
        "postgresql",
        "postgres-best-practices",
        "neon-postgres",
        "nosql-expert",
        "sql-optimization-patterns",
    }:
        return "database"
    if n.startswith("agent-") or n in {
        "agents-sdk",
        "ai-agents-architect",
        "autonomous-agent-patterns",
        "parallel-agents",
        "dispatching-parallel-agents",
        "multi-agent-patterns",
        "multi-agent-brainstorming",
        "subagent-driven-development",
    }:
        return "agents"
    return n


HARD_REMOVE: set[str] = {
    "outreach-specialist",
    "pricing-strategist",
    "startup-business-analyst-financial-projections",
    "startup-financial-modeling",
    "seo-authority-builder",
    "slack-bot-builder",
    "swiftui-expert-skill",
    "xlsx-official",
    "web3-testing",
    "skill-rails-upgrade",
    "powershell-windows",
    "n8n-code-python",
    "zapier-make-patterns",
}

CANONICAL_BY_FAMILY: dict[str, set[str]] = {
    "cc-skill": {"agent-backend-patterns"},
    "agent-orchestration": {"agent-orchestration"},
    "documentation": {"api-documenter", "documentation-templates"},
    "code-review": {"code-review-checklist", "code-review-excellence"},
    "debugging": {"systematic-debugging", "debugging-strategies"},
    "incident-response": {"incident-responder"},
    "observability": {"observability-engineer", "prometheus-configuration", "grafana-dashboards", "slo-implementation"},
    "prompt": {"prompt-engineering", "prompt-caching"},
    "react": {"react-patterns", "react-state-management", "react-best-practices"},
    "nextjs": {"nextjs-best-practices", "nextjs-app-router-patterns"},
    "tdd": {"tdd-workflow"},
    "testing": {
        "testing-patterns",
        "playwright-skill",
        "e2e-testing-patterns",
        "test-fixing",
        "verification-before-completion",
    },
    "terraform": {"terraform-specialist"},
    "typescript": {"typescript-expert", "typescript-advanced-types"},
    "workflow": {"workflow-orchestration-patterns"},
    "voice": {"voice-ai-development"},
    "memory": {"agent-memory-mcp", "memory-systems"},
    "python": {
        "python-patterns",
        "python-testing-patterns",
        "python-performance-optimization",
        "fastapi-templates",
        "uv-package-manager",
    },
    "security": {
        "security-auditor",
        "security-scanning-security-sast",
        "security-scanning-security-dependencies",
        "security-scanning-security-hardening",
        "security-compliance-compliance-check",
        "security-requirement-extraction",
        "k8s-security-policies",
    },
    "architecture": {
        "architecture-patterns",
        "architecture-decision-records",
        "software-architecture",
        "monorepo-architect",
        "cloud-architect",
    },
    "database": {
        "database-design",
        "database-migration",
        "postgres-best-practices",
        "neon-postgres",
        "sql-optimization-patterns",
    },
    "agents": {
        "agent-manager-skill",
        "agent-orchestration",
        "agent-memory-mcp",
        "agent-tool-builder",
        "subagent-driven-development",
        "multi-agent-patterns",
        "agents-sdk",
    },
}


@dataclass
class SkillsCurationResult:
    before_count: int
    after_count: int
    removed: list[str]
    kept: list[str]


def curate_skills(second_pass: bool = True, dry_run: bool = False) -> SkillsCurationResult:
    before = [p.name for p in list_skill_dirs()]
    removed: list[str] = []
    kept: list[str] = []

    if second_pass:
        for n in sorted(before):
            if n in HARD_REMOVE:
                removed.append(n)
                continue
            fam = family(n)
            if fam in CANONICAL_BY_FAMILY:
                if n in CANONICAL_BY_FAMILY[fam]:
                    kept.append(n)
                else:
                    removed.append(n)
            else:
                kept.append(n)
    else:
        kept = sorted(before)

    if not dry_run:
        for name in removed:
            p = SKILLS_DIR / name
            if p.exists() and p.is_dir():
                shutil.rmtree(p)

    after = sorted([p.name for p in list_skill_dirs()]) if not dry_run else sorted(kept)

    report = {
        "timestamp_utc": utc_now(),
        "before_count": len(before),
        "after_count": len(after),
        "removed_count": len(removed),
        "kept_count": len(after),
        "removed_sorted": sorted(removed),
        "kept_sorted": after,
        "mode": "second_pass_overlap_cleanup" if second_pass else "no_second_pass",
        "dry_run": dry_run,
    }

    if not dry_run:
        SKILLS_REPORT_JSON.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        write_lines(SKILLS_REMOVED_TXT, sorted(removed))
        write_lines(SKILLS_KEPT_TXT, after)

    return SkillsCurationResult(
        before_count=len(before),
        after_count=len(after),
        removed=sorted(removed),
        kept=after,
    )


# ----------------------------
# Rules curation logic
# ----------------------------


@dataclass
class RulesCurationResult:
    before_count: int
    after_count: int
    removed: list[str]
    kept: list[str]


def curate_rules(dry_run: bool = False) -> RulesCurationResult:
    if not RULES_DIR.exists():
        return RulesCurationResult(0, 0, [], [])

    all_rule_files = sorted([p.name for p in RULES_DIR.glob("*.md") if p.name != "README.md"])
    removed: list[str] = []
    kept: list[str] = []

    for name in all_rule_files:
        if name in CANONICAL_RULES:
            kept.append(name)
        else:
            removed.append(name)

    if not dry_run:
        for name in removed:
            p = RULES_DIR / name
            if p.exists():
                p.unlink()

    after_files = sorted([p.name for p in RULES_DIR.glob("*.md") if p.name != "README.md"])
    after = after_files if not dry_run else sorted(kept)

    report = {
        "timestamp_utc": utc_now(),
        "before_count": len(all_rule_files),
        "after_count": len(after),
        "removed_count": len(removed),
        "kept_sorted": sorted(kept),
        "removed_sorted": sorted(removed),
        "dry_run": dry_run,
    }

    if not dry_run:
        RULES_REPORT_JSON.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        write_lines(RULES_KEPT_TXT, sorted(kept))
        write_lines(RULES_REMOVED_TXT, sorted(removed))

    return RulesCurationResult(
        before_count=len(all_rule_files),
        after_count=len(after),
        removed=sorted(removed),
        kept=sorted(kept),
    )


# ----------------------------
# CLI / pipeline
# ----------------------------


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Refresh .agent context: curation + index rebuild in one command.")
    p.add_argument(
        "--dry-run", action="store_true", help="Show planned changes without deleting files or writing manifests."
    )
    p.add_argument("--skip-skills", action="store_true", help="Skip skills curation.")
    p.add_argument("--skip-rules", action="store_true", help="Skip rules curation.")
    p.add_argument("--skip-index", action="store_true", help="Skip rebuilding skills indexes.")
    p.add_argument("--no-second-pass", action="store_true", help="Disable second-pass skills overlap cleanup.")
    return p.parse_args()


def main() -> int:
    args = parse_args()

    if not AGENT_ROOT.exists():
        raise SystemExit(f".agent directory not found at expected path: {AGENT_ROOT}")

    run_start = utc_now()
    summary: dict[str, object] = {
        "started_at_utc": run_start,
        "repo_root": str(REPO_ROOT),
        "agent_root": str(AGENT_ROOT),
        "dry_run": args.dry_run,
        "steps": {},
    }

    # Skills
    if args.skip_skills:
        summary["steps"]["skills"] = {"status": "skipped"}
    else:
        res = curate_skills(second_pass=not args.no_second_pass, dry_run=args.dry_run)
        summary["steps"]["skills"] = {
            "status": "ok",
            "before_count": res.before_count,
            "after_count": res.after_count,
            "removed_count": len(res.removed),
            "mode": "second_pass" if not args.no_second_pass else "no_second_pass",
        }

    # Rules
    if args.skip_rules:
        summary["steps"]["rules"] = {"status": "skipped"}
    else:
        res = curate_rules(dry_run=args.dry_run)
        summary["steps"]["rules"] = {
            "status": "ok",
            "before_count": res.before_count,
            "after_count": res.after_count,
            "removed_count": len(res.removed),
        }

    # Indexes
    if args.skip_index:
        summary["steps"]["indexes"] = {"status": "skipped"}
    elif args.dry_run:
        summary["steps"]["indexes"] = {"status": "skipped_dry_run"}
    else:
        idx = build_indexes()
        compressed_index = AGENT_ROOT / "skills-index-compressed.json"
        stats = read_index_stats(compressed_index)
        token_estimate = estimate_tokens_for_json(compressed_index)
        summary["steps"]["indexes"] = {
            "status": "ok",
            "built": idx,
            "compressed_index_stats": stats,
            "compressed_index_token_estimate": token_estimate,
            "startup_token_target": 20000,
            "within_target": token_estimate <= 20000,
        }

    summary["finished_at_utc"] = utc_now()

    if not args.dry_run:
        RUN_REPORT_JSON.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")

    # concise terminal output
    print("✅ refresh_agent_context completed")
    print(f"repo: {REPO_ROOT}")
    print(f"dry_run: {args.dry_run}")
    steps = summary["steps"]  # type: ignore[assignment]
    print(f"skills: {steps.get('skills')}")
    print(f"rules: {steps.get('rules')}")
    print(f"indexes: {steps.get('indexes')}")
    if not args.dry_run:
        print(f"run report: {RUN_REPORT_JSON}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
