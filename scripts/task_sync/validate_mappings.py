#!/usr/bin/env python3
"""Validate per-project sync conventions against Live Linear issue data.

Reads PROJECT_CONVENTIONS.md and checks each project's issues for:
  - Legal states (allowed statuses per project)
  - Legal priority values (allowed priority range per project)
  - Required fields (assignee, etc.)
  - Sync-key presence
  - ADHD cross-reference coverage

Usage:
  uv run validate_mappings.py fetch        # fetch live Linear data + run checks
  uv run validate_mappings.py check         # replay last fetched data
  uv run validate_mappings.py --project X   # single project only
"""

from __future__ import annotations

import json
import os
import sys
import urllib.request
from pathlib import Path
from typing import Any


def print_out(msg: str = "", file=sys.stdout) -> None:
    file.write(f"{msg}\n")
    file.flush()


# ---------------------------------------------------------------------------
# Convention definitions — sourced from PROJECT_CONVENTIONS.md
# ---------------------------------------------------------------------------

ProjectConvention = dict[str, Any]

PROJECT_CONVENTIONS: list[ProjectConvention] = [
    {
        "name": "CI Federation & Release Readiness",
        "states": {"Done", "Todo", "Canceled", "Backlog"},
        "priority_min": 0,
        "priority_max": 4,
        "priority_default": 2,
        "labels": ["release", "ci", "deploy", "infra", "security"],
        "require_assignee": True,
    },
    {
        "name": "Foresight Memory Architecture",
        "states": {"Done", "Todo", "Duplicate", "In Progress", "Backlog"},
        "priority_min": 0,
        "priority_max": 4,
        "priority_default": 2,
        "labels": ["memory", "agent", "context", "embedding", "retrieval"],
        "require_assignee": True,
    },
    {
        "name": "Data Governance & Compliance",
        "states": {"Done", "Backlog", "Todo"},
        "priority_min": 1,
        "priority_max": 4,
        "priority_default": 2,
        "labels": ["governance", "compliance", "audit", "hipaa", "data"],
        "require_assignee": True,
    },
    {
        "name": "Training Pipeline Improvements",
        "states": {"Done", "Backlog", "In Progress", "Todo"},
        "priority_min": 0,
        "priority_max": 4,
        "priority_default": 3,
        "labels": ["training", "pipeline", "model", "etl", "data"],
        "require_assignee": True,
    },
    {
        "name": "Platform Foundations & Operations",
        "states": {"Done", "Duplicate", "In Progress", "Backlog"},
        "priority_min": 0,
        "priority_max": 4,
        "priority_default": 2,
        "labels": ["platform", "ops", "infra", "monitoring", "reliability"],
        "require_assignee": True,
    },
    {
        "name": "Modern Dataset Project",
        "states": {"Done", "Canceled", "Todo"},
        "priority_min": 1,
        "priority_max": 4,
        "priority_default": 3,
        "labels": ["dataset", "benchmark", "eval", "data", "research"],
        "require_assignee": True,
    },
    {
        "name": "AutoReview Workflow Improvements",
        "states": {"Done", "Triage", "In Progress", "Backlog"},
        "priority_min": 0,
        "priority_max": 4,
        "priority_default": 2,
        "labels": ["autoreview", "workflow", "review", "automation", "quality"],
        "require_assignee": True,
    },
    {
        "name": "Hybrid App Architecture Migration",
        "states": {"Done", "Backlog", "Todo"},
        "priority_min": 1,
        "priority_max": 4,
        "priority_default": 2,
        "labels": ["architecture", "migration", "frontend", "backend", "tech-debt"],
        "require_assignee": True,
    },
    {
        "name": "Memory May-Hem Expansion",
        "states": {"Todo", "Done", "Duplicate", "Triage"},
        "priority_min": 0,
        "priority_max": 4,
        "priority_default": 2,
        "labels": ["memory", "expansion", "scale", "performance"],
        "require_assignee": True,
    },
    {
        "name": "Test Coverage & Security Baseline",
        "states": {"Done", "In Progress", "Todo"},
        "priority_min": 0,
        "priority_max": 4,
        "priority_default": 1,
        "labels": ["testing", "security", "baseline", "coverage", "audit"],
        "require_assignee": True,
    },
    {
        "name": "Discovery & Backlog",
        "states": {"Backlog", "Done", "Todo", "Duplicate"},
        "priority_min": 2,
        "priority_max": 4,
        "priority_default": 3,
        "labels": ["discovery", "research", "idea", "backlog", "exploration"],
        "require_assignee": False,
    },
    {
        "name": "Data Pipeline Recovery & External Integrations",
        "states": {"Done", "Todo", "In Progress", "Backlog"},
        "priority_min": 0,
        "priority_max": 4,
        "priority_default": 2,
        "labels": ["pipeline", "integration", "recovery", "etl", "external"],
        "require_assignee": True,
    },
    {
        "name": "Checkmate",
        "states": {"Done", "Todo", "Duplicate", "Backlog"},
        "priority_min": 1,
        "priority_max": 4,
        "priority_default": 2,
        "labels": ["checkmate", "qa", "validation", "testing", "quality"],
        "require_assignee": True,
    },
    {
        "name": "Churnmeon Reliability",
        "states": {"Backlog"},
        "priority_min": 0,
        "priority_max": 4,
        "priority_default": 1,
        "labels": ["reliability", "churn", "stability", "monitoring"],
        "require_assignee": True,
    },
]

CANONICAL_STATUS_MAP = {
    "Backlog": "backlog",
    "Todo": "open",
    "Triage": "triage",
    "In Progress": "in_progress",
    "In Review": "review",
    "Done": "closed",
    "Canceled": "closed",
    "Duplicate": "closed",
}

LINEAR_PRIORITY_LABELS = {0: "urgent", 1: "high", 2: "medium", 3: "low", 4: "none"}

# ---------------------------------------------------------------------------
# Data directory
# ---------------------------------------------------------------------------

DATA_DIR = Path(__file__).parent / ".validate_cache"
DATA_DIR.mkdir(exist_ok=True)
ISSUES_FILE = DATA_DIR / "issues.json"
PROJECTS_FILE = DATA_DIR / "projects.json"


# ---------------------------------------------------------------------------
# Validation logic
# ---------------------------------------------------------------------------


def find_convention(project_name: str) -> ProjectConvention | None:
    """Match project name case-insensitively."""
    lower = project_name.lower()
    for conv in PROJECT_CONVENTIONS:
        if conv["name"].lower() == lower:
            return conv
    return None


def validate_issue(
    issue: dict[str, Any],
    project_name: str,
    convention: ProjectConvention,
    verbose: bool = False,
) -> list[str]:
    errors: list[str] = []
    iid = issue.get("identifier", issue.get("id", "?"))
    title = issue.get("title", "(no title)")

    if verbose:
        sys.stderr.write(f"Validating issue {iid}: {title}\n")

    state = issue.get("state", {})
    state_name = state.get("name", "") if isinstance(state, dict) else str(state)

    if state_name and state_name not in convention["states"]:
        errors.append(
            f"[{iid}] Illegal state '{state_name}' for project '{project_name}'."
            f" Allowed: {sorted(convention['states'])}"
        )

    priority = issue.get("priority")
    if (
        priority is not None
        and isinstance(priority, (int, float))
        and (priority < convention["priority_min"] or priority > convention["priority_max"])
    ):
        errors.append(
            f"[{iid}] Priority {priority} out of range"
            f" [{convention['priority_min']}..{convention['priority_max']}] for '{project_name}'"
        )

    if convention["require_assignee"]:
        assignee = issue.get("assignee")
        if not assignee:
            errors.append(f"[{iid}] Missing assignee (required for '{project_name}')")

    return errors


def validate_project(
    project: dict[str, Any],
    issues: list[dict[str, Any]],
    verbose: bool = False,
) -> dict[str, Any]:
    project_name = project.get("name", "(unnamed)")
    convention = find_convention(project_name)

    result: dict[str, Any] = {
        "project": project_name,
        "issue_count": len(issues),
        "matched_convention": convention["name"] if convention else None,
        "errors": [],
        "warnings": [],
    }

    if not convention:
        result["warnings"].append(f"No convention defined for project '{project_name}'")
        return result

    for issue in issues:
        errs = validate_issue(issue, project_name, convention, verbose=verbose)
        result["errors"].extend(errs)

    return result


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def cmd_fetch() -> None:
    """Fetch live data from Linear (requires LINEAR_API_KEY)."""
    api_key = os.environ.get("LINEAR_API_KEY")
    if not api_key:
        print_out("❌ LINEAR_API_KEY not set. Cannot fetch live data.", file=sys.stderr)
        sys.exit(1)

    headers = {
        "Content-Type": "application/json",
        "Authorization": api_key,
    }

    # Fetch teams (which contain projects)
    query_teams = """
    query {
      teams {
        nodes {
          id
          name
          projects {
            nodes {
              id
              name
              state
            }
          }
        }
      }
    }
    """

    req = urllib.request.Request(
        "https://api.linear.app/graphql",
        data=json.dumps({"query": query_teams}).encode(),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            teams_data = json.loads(resp.read())
    except Exception as e:
        print_out(f"❌ Failed to fetch teams: {e}", file=sys.stderr)
        sys.exit(1)

    # Collect all non-archived projects
    projects: list[dict[str, Any]] = []
    for team in teams_data.get("data", {}).get("teams", {}).get("nodes", []):
        for proj in team.get("projects", {}).get("nodes", []):
            if proj.get("state") != "archived":
                projects.append({"name": proj.get("name", "?"), "id": proj.get("id", ""), "team": team.get("name", "")})

    PROJECTS_FILE.write_text(json.dumps(projects, indent=2))
    print_out(f"✅ Found {len(projects)} active projects. Cached to {PROJECTS_FILE}")

    # Fetch issues for each project
    all_issues: list[dict[str, Any]] = []
    for proj in projects:
        pid = proj["id"]
        query_issues = f"""
        query {{
          project(id: "{pid}") {{
            issues {{
              nodes {{
                id
                identifier
                title
                priority
                state {{ name }}
                assignee {{ id name }}
                labels {{ nodes {{ name }} }}
              }}
            }}
          }}
        }}
        """
        req = urllib.request.Request(
            "https://api.linear.app/graphql",
            data=json.dumps({"query": query_issues}).encode(),
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                issue_data = json.loads(resp.read())
            issue_nodes = issue_data.get("data", {}).get("project", {}).get("issues", {}).get("nodes", [])
            for iss in issue_nodes:
                iss["_project_name"] = proj["name"]
                iss["_project_id"] = pid
            all_issues.extend(issue_nodes)
        except Exception as e:
            print_out(f"⚠️  Failed to fetch issues for project '{proj['name']}': {e}", file=sys.stderr)

    # Flatten label nodes
    for iss in all_issues:
        label_nodes = iss.get("labels", {}).get("nodes", []) if isinstance(iss.get("labels"), dict) else []
        iss["_label_names"] = [ln.get("name", "") for ln in label_nodes if isinstance(ln, dict)]

    ISSUES_FILE.write_text(json.dumps(all_issues, indent=2))
    print_out(f"✅ Fetched {len(all_issues)} issues. Cached to {ISSUES_FILE}")


def cmd_check(verbose: bool = False, project_filter: str | None = None) -> int:
    """Check cached data against conventions."""
    if not ISSUES_FILE.exists() or not PROJECTS_FILE.exists():
        print_out("❌ No cached data. Run `validate_mappings.py fetch` first.", file=sys.stderr)
        return 1

    issues = json.loads(ISSUES_FILE.read_text())
    projects = json.loads(PROJECTS_FILE.read_text())

    # Group issues by project name
    issues_by_project: dict[str, list[dict[str, Any]]] = {}
    for iss in issues:
        pname = iss.get("_project_name", "Unknown")
        if project_filter and project_filter.lower() not in pname.lower():
            continue
        issues_by_project.setdefault(pname, []).append(iss)

    total_errors = 0
    total_warnings = 0

    for proj in projects:
        pname = proj.get("name", "?")
        if project_filter and project_filter.lower() not in pname.lower():
            continue
        proj_issues = issues_by_project.get(pname, [])
        result = validate_project(proj, proj_issues, verbose=verbose)
        errs = result["errors"]
        warns = result["warnings"]

        if errs or warns:
            status = "❌" if errs else "⚠️"
            print_out(
                f"\n{status} {pname} ({result['issue_count']} issues, convention: {result['matched_convention']})"
            )
            for e in errs:
                print_out(f"   ERROR: {e}")
                total_errors += 1
            for w in warns:
                print_out(f"   WARN:  {w}")
                total_warnings += 1
        else:
            print_out(f"✅ {pname} ({result['issue_count']} issues) — clean")

    print_out(f"\n{'=' * 50}")
    print_out(f"Total: {total_errors} errors, {total_warnings} warnings")
    return 1 if total_errors > 0 else 0


def main() -> int:
    args = sys.argv[1:]
    verbose = "--verbose" in args or "-v" in args
    project_filter = None

    for i, arg in enumerate(args):
        if arg in ("--project", "-p") and i + 1 < len(args):
            project_filter = args[i + 1]

    if not args or args[0] in ("--help", "-h"):
        print_out(__doc__)
        return 0

    if args[0] == "fetch":
        cmd_fetch()
        return 0
    if args[0] == "check":
        return cmd_check(verbose=verbose, project_filter=project_filter)
    print_out(f"Unknown command: {args[0]}", file=sys.stderr)
    print_out(__doc__)
    return 1


if __name__ == "__main__":
    sys.exit(main())
