#!/usr/bin/env python3
"""Update Linear issues based on recent git commits.

This script scans recent commit messages for Linear-style issue keys
(e.g. PIX-535), then:

1. Finds the matching issues in Linear via GraphQL.
2. Optionally moves them to a target status.
3. Posts a short progress comment summarizing the commits.

Usage (from any git repo in this workspace):

  uv run python scripts/task_sync/update_linear_progress.py \\
    --target-status Done \\
    --branch staging \\
    --max-commits 50

Environment:
  LINEAR_API_KEY   - required, personal API key for Linear.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ISSUE_KEY_RE = re.compile(r"\b[A-Z]{2,5}-\d+\b")
LINEAR_API_URL = "https://api.linear.app/graphql"


@dataclass
class CommitInfo:
    sha: str
    summary: str


def _run_git_log(max_commits: int) -> list[CommitInfo]:
    result = subprocess.run(
        ["git", "log", f"-n{max_commits}", "--pretty=format:%H%x09%s"],
        check=True,
        capture_output=True,
        text=True,
    )
    commits: list[CommitInfo] = []
    for line in result.stdout.splitlines():
        if not line.strip():
            continue
        sha, _, summary = line.partition("\t")
        if not sha or not summary:
            continue
        commits.append(CommitInfo(sha=sha, summary=summary.strip()))
    return commits


def _extract_issue_keys(commits: Iterable[CommitInfo]) -> dict[str, list[CommitInfo]]:
    mapping: dict[str, list[CommitInfo]] = {}
    for commit in commits:
        for match in ISSUE_KEY_RE.findall(commit.summary):
            mapping.setdefault(match, []).append(commit)
    return mapping


def _post_graphql(api_key: str, payload: dict[str, Any]) -> dict[str, Any]:
    body = json.dumps(payload).encode("utf-8")
    req = Request(
        LINEAR_API_URL,
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(req, timeout=15) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw)
    except HTTPError as exc:  # pragma: no cover - network failure path
        text = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Linear HTTP error {exc.code}: {text}") from exc
    except URLError as exc:  # pragma: no cover - network failure path
        raise RuntimeError(f"Linear connection error: {exc.reason}") from exc


def _find_issue_by_key(api_key: str, key: str) -> dict[str, Any] | None:
    query = """
        query SearchIssueByKey($query: String!) {
          issueSearch(query: $query, first: 1) {
            nodes {
              id
              identifier
              title
              state { id name }
              team {
                id
                key
                states {
                  id
                  name
                }
              }
            }
          }
        }
    """
    payload = {"query": query, "variables": {"query": key}}
    data = _post_graphql(api_key, payload)
    nodes = data.get("data", {}).get("issueSearch", {}).get("nodes", []) or []
    return nodes[0] if nodes else None


def _update_issue_state(
    api_key: str,
    issue: dict[str, Any],
    target_status: str,
) -> dict[str, Any] | None:
    team = issue.get("team") or {}
    states = team.get("states") or []
    target_state = None
    for state in states:
        if state.get("name") == target_status:
            target_state = state
            break
    if not target_state:
        return None

    mutation = """
        mutation UpdateIssueState($id: String!, $input: IssueUpdateInput!) {
          issueUpdate(id: $id, input: $input) {
            success
            issue {
              id
              identifier
              state { id name }
            }
          }
        }
    """
    variables = {
        "id": issue["id"],
        "input": {"stateId": target_state["id"]},
    }
    data = _post_graphql(api_key, {"query": mutation, "variables": variables})
    container = data.get("data", {}).get("issueUpdate", {}) or {}
    if not container.get("success"):
        return None
    return container.get("issue")


def _create_comment(
    api_key: str,
    issue_id: str,
    body: str,
) -> None:
    mutation = """
        mutation CreateComment($input: CommentCreateInput!) {
          commentCreate(input: $input) {
            success
            comment { id }
          }
        }
    """
    variables = {"input": {"issueId": issue_id, "body": body}}
    _post_graphql(api_key, {"query": mutation, "variables": variables})


def _build_comment_body(
    repo_name: str,
    branch: str,
    commits: list[CommitInfo],
) -> str:
    lines = [
        f"Automated update from `{repo_name}` branch `{branch}`.",
        "",
        "Related commits:",
    ]
    for commit in commits[:10]:
        short_sha = commit.sha[:8]
        lines.append(f"- `{short_sha}` {commit.summary}")
    if len(commits) > 10:
        lines.append(f"- … and {len(commits) - 10} more commits")
    lines.append("")
    lines.append(
        f"Updated at {datetime.now(timezone.utc).isoformat()} via `update_linear_progress.py`.",
    )
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Update Linear issues based on recent git commits.",
    )
    parser.add_argument(
        "--target-status",
        required=True,
        help="Exact Linear workflow state name to move issues into (e.g. 'In Progress', 'Done').",
    )
    parser.add_argument(
        "--max-commits",
        type=int,
        default=50,
        help="Number of most recent commits to scan for issue keys.",
    )
    parser.add_argument(
        "--branch",
        default="staging",
        help="Branch name for context in the progress comment (default: staging).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Scan commits and resolve issues, but do not modify Linear.",
    )

    args = parser.parse_args(argv)

    api_key = os.getenv("LINEAR_API_KEY", "").strip()
    if not api_key:
        print("ERROR: LINEAR_API_KEY environment variable is not set.", file=sys.stderr)
        return 1

    repo_name = os.path.basename(os.getcwd())
    commits = _run_git_log(args.max_commits)
    issue_map = _extract_issue_keys(commits)

    if not issue_map:
        print("No Linear-style issue keys found in recent commit messages.")
        return 0

    print(f"Found {len(issue_map)} unique issue key(s) in last {len(commits)} commits.")

    for key, related_commits in issue_map.items():
        print(f"- Resolving {key} ...", end="", flush=True)
        issue = _find_issue_by_key(api_key, key)
        if not issue:
            print(" not found in Linear, skipping.")
            continue

        if args.dry_run:
            print(
                f" would move to '{args.target_status}' and add comment "
                f"(current state: {issue.get('state', {}).get('name')!r}).",
            )
            continue

        updated = _update_issue_state(api_key, issue, args.target_status)
        if not updated:
            print(
                f" could not find state '{args.target_status}' for team "
                f"{issue.get('team', {}).get('key')!r}, skipping state change.",
            )
        else:
            print(
                f" moved state to '{updated.get('state', {}).get('name')}'.",
                end="",
            )

        comment_body = _build_comment_body(repo_name, args.branch, related_commits)
        _create_comment(api_key, issue["id"], comment_body)
        if not args.dry_run:
            print(" Comment added.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
