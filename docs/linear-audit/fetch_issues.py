#!/usr/bin/env python3
"""
Fetch all issues from a Linear workspace via the GraphQL API and save
``issues.json`` in the **v2 Linear MCP flat shape** consumed by
``run_audit.py``.

v2 — Linear MCP flat-shape compatibility
========================================

This script still queries Linear's nested GraphQL API, then *transforms* each
issue into the flat shape returned by the Linear MCP ``linear_list_issues``
tool. The on-disk ``issues.json`` is therefore interchangeable with MCP output
and is consumed as-is by ``run_audit.py``.

Flat shape (per issue):

    {
      "id": "PIX-1873",                       # identifier, NOT UUID
      "title": "...",
      "description": "...",
      "priority": {"value": 1, "name": "Urgent"},
      "estimate": {"value": 2, "name": "2"} or null,
      "url": "https://...",
      "gitBranchName": "...",
      "createdAt": "...", "updatedAt": "...",
      "archivedAt": "..." or null, "completedAt": "..." or null,
      "startedAt": "..." or null, "canceledAt": "..." or null,
      "dueDate": "..." or null,
      "slaStartedAt": "...", "slaMediumRiskAt": "...",
      "slaHighRiskAt": "...", "slaBreachesAt": "...", "slaType": "...",
      "status": "Done",                        # STRING  (not nested state.name)
      "statusType": "completed",               # STRING  (not nested state.type)
      "labels": ["label1", ...],               # ARRAY OF STRINGS (not .nodes)
      "createdBy": "Chad",                     # STRING name
      "createdById": "uuid",
      "assignee": "Chad" or null,              # STRING name or null
      "assigneeId": "uuid" or null,
      "delegate": "..." or null, "delegateId": "uuid" or null,
      "project": "Project Name" or null,      # STRING name or null
      "projectId": "uuid" or null,
      "parentId": "PIX-XXXX" or null,
      "team": "Pixelated", "teamId": "uuid",
      "cycleId": "uuid" or null
    }

See ``docs/linear-audit/linear_audit.md`` for the shape reference.

Usage:
    LINEAR_API_KEY=lin_api_xxx python3 fetch_issues.py [--team TEAM_ID] [--limit N]

Requires: requests (pip install requests)
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

try:
    import requests
except ImportError:
    sys.exit("ERROR: requests not installed. Run: pip install requests")

LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql"
OUTPUT_FILE = Path(__file__).parent / "issues.json"

# Default team for the Pixelated workspace
DEFAULT_TEAM_ID = "52861523-9089-49a3-8be5-4032d68cb55a"

# GraphQL query returns Linear's nested shape; ``transform_to_flat`` converts
# each node to the v2 Linear MCP flat shape (see module docstring).
FETCH_ISSUES_QUERY = """
query FetchIssues($teamId: String!, $after: String, $first: Int) {
  team(id: $teamId) {
    id
    name
    key
    issues(first: $first, after: $after, includeArchived: true, orderBy: createdAt) {
      edges {
        node {
          id
          identifier
          title
          description
          state { id name type }
          assignee { id name email }
          creator { id name }
          project { id name description state }
          cycle { id }
          estimate
          priority
          labels { nodes { id name } }
          parent { id identifier }
          createdAt
          updatedAt
          startedAt
          completedAt
          canceledAt
          archivedAt
          dueDate
          slaStartedAt
          slaMediumRiskAt
          slaHighRiskAt
          slaBreachesAt
          slaType
          url
          branchName
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
}
"""


def _opt_str(value: str | None) -> str | None:
    """Pass through non-empty strings as-is; convert "" to None (flat shape)."""
    return value if value else None


def transform_to_flat(node: dict) -> dict:
    """Convert a nested GraphQL issue node to the v2 Linear MCP flat shape.

    See the module docstring for the full shape contract. Linear's GraphQL API
    still returns nested objects for ``state``, ``assignee``, ``creator``,
    ``project``, ``cycle``, ``labels`` and ``parent``; this helper flattens them
    to the scalar/array fields used by ``run_audit.py``.
    """
    state = node.get("state") or {}
    assignee = node.get("assignee") or {}
    creator = node.get("creator") or {}
    project = node.get("project") or {}
    parent = node.get("parent") or {}
    labels_conn = (node.get("labels") or {}).get("nodes") or []

    estimate = node.get("estimate")
    priority = node.get("priority")

    return {
        # V2: Linear MCP flat shape — see docs/linear-audit/linear_audit.md for shape reference
        "id": node.get("identifier") or node.get("id"),
        "title": node.get("title") or "",
        "description": node.get("description") or "",
        "priority": {"value": priority, "name": ""} if priority is not None else None,
        "estimate": {"value": estimate, "name": str(estimate)} if estimate is not None else None,
        "url": node.get("url"),
        "gitBranchName": node.get("gitBranchName"),
        "createdAt": node.get("createdAt"),
        "updatedAt": node.get("updatedAt"),
        "archivedAt": node.get("archivedAt"),
        "completedAt": node.get("completedAt"),
        "startedAt": node.get("startedAt"),
        "canceledAt": node.get("canceledAt"),
        "dueDate": node.get("dueDate"),
        "slaStartedAt": node.get("slaStartedAt"),
        "slaMediumRiskAt": node.get("slaMediumRiskAt"),
        "slaHighRiskAt": node.get("slaHighRiskAt"),
        "slaBreachesAt": node.get("slaBreachesAt"),
        "slaType": node.get("slaType"),
        "status": state.get("name"),
        "statusType": state.get("type"),
        "labels": [lbl.get("name") for lbl in labels_conn if lbl.get("name")],
        "createdBy": creator.get("name"),
        "createdById": creator.get("id"),
        "assignee": assignee.get("name") if assignee else None,
        "assigneeId": assignee.get("id") if assignee else None,
        "delegate": None,
        "delegateId": None,
        "project": project.get("name") if project else None,
        "projectId": project.get("id") if project else None,
        "parentId": parent.get("identifier") if parent else None,
        "team": None,  # populated by caller from the team wrapper
        "teamId": None,
        "cycleId": (node.get("cycle") or {}).get("id") if node.get("cycle") else None,
    }


def fetch_all_issues(api_key: str, team_id: str, page_size: int = 50) -> list[dict]:
    """Fetch all issues with pagination, returned as v2 flat-shape dicts."""
    # Linear API keys must NOT use the "Bearer" prefix — that prefix is
    # reserved for OAuth tokens. API keys go in the raw Authorization header
    # (or alternatively the `x-api-key` header).
    headers = {
        "Authorization": api_key,
        "Content-Type": "application/json",
    }
    all_issues: list[dict] = []
    cursor = None
    page = 0
    team_name: str | None = None

    while True:
        page += 1
        variables = {"teamId": team_id, "first": page_size, "after": cursor}
        resp = requests.post(
            LINEAR_GRAPHQL_URL,
            headers=headers,
            json={"query": FETCH_ISSUES_QUERY, "variables": variables},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()

        if "errors" in data:
            print(f"GraphQL errors: {data['errors']}", file=sys.stderr)
            break

        team_data = data.get("data", {}).get("team")
        if not team_data:
            print(f"Team not found: {team_id}", file=sys.stderr)
            break

        team_name = team_data.get("name")
        issues_conn = team_data["issues"]
        edges = issues_conn["edges"]
        for edge in edges:
            flat = transform_to_flat(edge["node"])
            flat["team"] = team_name
            flat["teamId"] = team_id
            all_issues.append(flat)

        page_info = issues_conn["pageInfo"]
        print(
            f"  Page {page}: fetched {len(edges)} issues (total: {len(all_issues)})",
            file=sys.stderr,
        )

        if not page_info["hasNextPage"]:
            break
        cursor = page_info["endCursor"]
        time.sleep(0.5)  # Rate-limit courtesy

    return all_issues


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch Linear issues for audit (v2 MCP flat shape)")
    parser.add_argument("--team", default=os.environ.get("LINEAR_TEAM_ID", DEFAULT_TEAM_ID), help="Linear team ID")
    parser.add_argument("--limit", type=int, default=50, help="Page size (default 50)")
    parser.add_argument("--output", default=str(OUTPUT_FILE), help="Output file path")
    args = parser.parse_args()

    api_key = os.environ.get("LINEAR_API_KEY")
    if not api_key:
        sys.exit("ERROR: LINEAR_API_KEY environment variable required")

    print(f"Fetching issues for team {args.team}...", file=sys.stderr)
    issues = fetch_all_issues(api_key, args.team, args.limit)
    print(f"\nTotal issues fetched: {len(issues)}", file=sys.stderr)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(
            {
                "shape": "linear_mcp_flat_v2",
                "team_id": args.team,
                "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "total_issues": len(issues),
                "issues": issues,
            },
            f,
            indent=2,
        )

    print(f"Saved {len(issues)} flat-shape issues to {output_path}", file=sys.stderr)
    print("Ready for MCP flat-shape consumption (v2) by run_audit.py", file=sys.stderr)


if __name__ == "__main__":
    main()
