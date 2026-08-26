#!/usr/bin/env python3
"""
Analyze ``issues.json`` for Linear workspace hygiene.

v2 — Linear MCP flat-shape compatibility
========================================

This analyzer consumes the **flat shape** written by ``fetch_issues.py`` (and
produced by the Linear MCP ``linear_list_issues`` tool). It no longer walks
nested ``state`` / ``assignee`` / ``project`` / ``labels.nodes`` paths.

Flat-shape fields used here (see ``docs/linear-audit/linear_audit.md``):

- ``status`` (str)        — e.g. "Done" (was ``state.name``)
- ``statusType`` (str)    — "completed" | "started" | ... (was ``state.type``)
- ``assignee`` (str|None) — display name (was ``assignee.name``)
- ``assigneeId`` (str|None)
- ``description`` (str)
- ``estimate`` ({value,name}|None)
- ``project`` (str|None)  — project *name* (was ``project.name``)
- ``projectId`` (str|None)
- ``archivedAt`` (str|None)
- ``id``                  — the human identifier, e.g. "PIX-1873"

Checks performed:
  - Duplicate detection (Done-Done pairs with similar titles)
  - Unassigned issues
  - Issues missing descriptions
  - Estimate coverage
  - Project status review (flat project-name keyed)
  - Archived completeness (completed issues not archived are flagged)

Saves results to ``audit_results.json``.

Usage:
    python3 run_audit.py [--input issues.json] [--output audit_results.json]
"""

import argparse
import json
import sys
from collections import Counter
from difflib import SequenceMatcher
from pathlib import Path

INPUT_FILE = Path(__file__).parent / "issues.json"
OUTPUT_FILE = Path(__file__).parent / "audit_results.json"

# Similarity threshold for duplicate detection
SIMILARITY_THRESHOLD = 0.85


def load_issues(filepath: str) -> list[dict]:
    with open(filepath) as f:
        data = json.load(f)
    return data.get("issues", data)


def normalize_title(title: str) -> str:
    """Normalize a title for comparison."""
    return title.lower().strip()


def title_similarity(a: str, b: str) -> float:
    """Calculate the similarity ratio between two titles."""
    return SequenceMatcher(None, normalize_title(a), normalize_title(b)).ratio()


def detect_duplicates(issues: list[dict]) -> list[dict]:
    """Detect Done-Done duplicate pairs by comparing titles.

    Uses the flat ``statusType == 'completed'`` filter (was
    ``state.type == 'completed'``) and the flat ``id`` (identifier).
    """
    done_issues = [i for i in issues if i.get("statusType") == "completed"]
    duplicates = []

    for i, a in enumerate(done_issues):
        for b in done_issues[i + 1 :]:
            sim = title_similarity(a["title"], b["title"])
            if sim >= SIMILARITY_THRESHOLD:
                desc_a = (a.get("description") or "").lower().strip()
                desc_b = (b.get("description") or "").lower().strip()
                desc_sim = SequenceMatcher(None, desc_a, desc_b).ratio() if desc_a and desc_b else 0.5

                duplicates.append(
                    {
                        "issue_a": {
                            "id": a["id"],
                            "identifier": a["id"],
                            "title": a["title"],
                            "url": a.get("url"),
                        },
                        "issue_b": {
                            "id": b["id"],
                            "identifier": b["id"],
                            "title": b["title"],
                            "url": b.get("url"),
                        },
                        "title_similarity": round(sim, 3),
                        "description_similarity": round(desc_sim, 3),
                    }
                )

    return duplicates


def find_unassigned(issues: list[dict]) -> list[dict]:
    """Find issues without an assignee using the flat ``assignee`` / ``assigneeId``."""
    return [
        {
            "id": i["id"],
            "identifier": i["id"],
            "title": i["title"],
            "status": i.get("status"),
            "statusType": i.get("statusType"),
            "url": i.get("url"),
        }
        for i in issues
        if (i.get("assignee") is None or i.get("assigneeId") is None) and not i.get("archivedAt")
    ]


def find_missing_descriptions(issues: list[dict]) -> list[dict]:
    """Find issues without descriptions (flat ``description`` key)."""
    return [
        {
            "id": i["id"],
            "identifier": i["id"],
            "title": i["title"],
            "status": i.get("status"),
            "statusType": i.get("statusType"),
            "assignee": i.get("assignee"),
            "url": i.get("url"),
        }
        for i in issues
        if not (i.get("description") or "").strip() and not i.get("archivedAt")
    ]


def check_estimate_coverage(issues: list[dict]) -> dict:
    """Check estimate coverage across active issues.

    Uses the flat ``estimate`` object (``{"value": N, "name": "N"}`` or ``None``).
    """
    active = [i for i in issues if not i.get("archivedAt")]
    with_estimate = [i for i in active if i.get("estimate") is not None]
    without_estimate = [
        {
            "id": i["id"],
            "identifier": i["id"],
            "title": i["title"],
            "status": i.get("status"),
            "assignee": i.get("assignee"),
        }
        for i in active
        if i.get("estimate") is None
    ]

    coverage = len(with_estimate) / len(active) * 100 if active else 0
    return {
        "total_active": len(active),
        "with_estimate": len(with_estimate),
        "without_estimate": len(without_estimate),
        "coverage_pct": round(coverage, 1),
        "missing": without_estimate,
    }


def review_projects(issues: list[dict]) -> tuple[list[dict], list[dict]]:
    """Review project completeness, keyed on the flat ``project`` (name) field.

    The v2 flat shape carries only the project *name* and ``projectId`` plus the
    *issue-level* ``description`` (no nested project ``description`` / ``state``),
    so this review now keys on project name and tracks per-project issue stats
    rather than inspecting the project entity's own description.
    """
    projects: dict[str, dict] = {}
    for i in issues:
        proj_name = i.get("project")
        if not proj_name:
            continue
        pid = i.get("projectId") or proj_name  # fall back to name when id absent
        if pid not in projects:
            projects[pid] = {
                "id": pid,
                "name": proj_name,
                "description": "",  # flat shape has no project.description
                "state": None,  # flat shape has no project.state
                "issue_count": 0,
                "completed_count": 0,
                "archived_count": 0,
                "descriptions_filled": 0,
            }
        projects[pid]["issue_count"] += 1
        if i.get("statusType") == "completed":
            projects[pid]["completed_count"] += 1
        if i.get("archivedAt"):
            projects[pid]["archived_count"] += 1
        if (i.get("description") or "").strip():
            projects[pid]["descriptions_filled"] += 1

    # Flag projects where all issues are completed but the project isn't archived.
    flagged = []
    for p in projects.values():
        flags = []
        if p["issue_count"] > 0 and p["completed_count"] == p["issue_count"]:
            flags.append("all_issues_completed")
        if flags:
            p["flags"] = flags
            flagged.append(p)

    return list(projects.values()), flagged


def check_archived_completeness(issues: list[dict]) -> dict:
    """Check if completed issues are archived.

    Uses the flat ``statusType == 'completed'`` and ``archivedAt`` fields.
    Issues with ``statusType == 'completed'`` but ``archivedAt is None`` are
    flagged for archival.
    """
    completed = [i for i in issues if i.get("statusType") == "completed"]
    archived = [i for i in completed if i.get("archivedAt")]
    not_archived = [
        {
            "id": i["id"],
            "identifier": i["id"],
            "title": i["title"],
            "completedAt": i.get("completedAt"),
            "url": i.get("url"),
        }
        for i in completed
        if not i.get("archivedAt")
    ]
    return {
        "total_completed": len(completed),
        "archived": len(archived),
        "not_archived": len(not_archived),
        "not_archived_list": not_archived,
    }


def run_audit(issues: list[dict]) -> dict:
    """Run all audit checks against flat-shape issues."""
    duplicates = detect_duplicates(issues)
    unassigned = find_unassigned(issues)
    missing_desc = find_missing_descriptions(issues)
    estimate = check_estimate_coverage(issues)
    all_projects, flagged_projects = review_projects(issues)
    archived = check_archived_completeness(issues)

    # Status distribution (flat fields)
    status_dist = Counter(i.get("status") or "Unknown" for i in issues)
    status_type_dist = Counter(i.get("statusType") or "unknown" for i in issues)

    return {
        "summary": {
            "total_issues": len(issues),
            "duplicates_found": len(duplicates),
            "unassigned_count": len(unassigned),
            "missing_descriptions": len(missing_desc),
            "estimate_coverage_pct": estimate["coverage_pct"],
            "flagged_projects": len(flagged_projects),
            "completed_not_archived": archived["not_archived"],
            "status_distribution": dict(status_dist),
            "status_type_distribution": dict(status_type_dist),
        },
        "duplicates": duplicates,
        "unassigned": unassigned,
        "missing_descriptions": missing_desc,
        "estimate_coverage": estimate,
        "projects": all_projects,
        "flagged_projects": flagged_projects,
        "archived_completeness": archived,
        "targets": {
            "duplicates": 0,
            "unassigned": 0,
            "missing_descriptions": 0,
            "estimate_coverage_pct": 80,
        },
        "acceptance_criteria_met": {
            "all_issues_have_descriptions": len(missing_desc) == 0,
            "all_issues_assigned": len(unassigned) == 0,
            "no_done_done_duplicates": len(duplicates) == 0,
            "estimate_coverage_gt_80": estimate["coverage_pct"] > 80,
            "completed_project_issues_archived": archived["not_archived"] == 0,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Linear workspace audit (v2 MCP flat shape)")
    parser.add_argument("--input", default=str(INPUT_FILE), help="Input issues.json path")
    parser.add_argument("--output", default=str(OUTPUT_FILE), help="Output audit_results.json path")
    args = parser.parse_args()

    if not Path(args.input).exists():
        sys.exit(f"ERROR: {args.input} not found. Run fetch_issues.py first.")

    issues = load_issues(args.input)
    print(f"Loaded {len(issues)} issues from {args.input}", file=sys.stderr)

    results = run_audit(issues)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(results, f, indent=2)

    # Print summary
    s = results["summary"]
    print(f"\n{'=' * 60}", file=sys.stderr)
    print(f"LINEAR WORKSPACE AUDIT RESULTS (v2 MCP flat shape)", file=sys.stderr)
    print(f"{'=' * 60}", file=sys.stderr)
    print(f"Total issues:           {s['total_issues']}", file=sys.stderr)
    print(f"Duplicate pairs:        {s['duplicates_found']}", file=sys.stderr)
    print(f"Unassigned issues:      {s['unassigned_count']}", file=sys.stderr)
    print(f"Missing descriptions:   {s['missing_descriptions']}", file=sys.stderr)
    print(f"Estimate coverage:      {s['estimate_coverage_pct']}%", file=sys.stderr)
    print(f"Flagged projects:       {s['flagged_projects']}", file=sys.stderr)
    print(f"Completed not archived: {s['completed_not_archived']}  (flag for archival)", file=sys.stderr)
    print(f"{'=' * 60}", file=sys.stderr)

    ac = results["acceptance_criteria_met"]
    print(f"\nAcceptance Criteria:", file=sys.stderr)
    for k, v in ac.items():
        status = "PASS" if v else "FAIL"
        print(f"  [{status}] {k}: {v}", file=sys.stderr)

    print(f"\nResults saved to {output_path}", file=sys.stderr)
    print("Ready for MCP flat-shape consumption (v2) — audit_results.json written.", file=sys.stderr)


if __name__ == "__main__":
    main()
