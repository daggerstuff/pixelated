#!/usr/bin/env python3
"""Auto-close Linear tickets when GitHub PRs merge with ticket IDs in the commit message.

Called by ``.github/workflows/linear-auto-close.yml`` after a PR is merged
into the default branch.

Scans the PR title, body, head branch name, and merge-commit message for
Linear issue keys (e.g. ``PIX-1234``, ``PAL-42``), then transitions each
matching issue to a "Done" workflow state and posts a comment linking back
to the merged PR.

Usage
-----
.. code-block:: bash

    uv run python scripts/task_sync/auto_close_from_merge.py \\
        --pr-data /tmp/pr-data.json \\
        --target-status Done

Environment
-----------
LINEAR_API_KEY
    Required. Linear personal API token (the GitHub secret
    ``LINEAR_AGENT_ACCESS_TOKEN`` is mapped to this env var by the workflow).
"""

from __future__ import annotations

import argparse
import contextlib
import json
import os
import re
import subprocess
import sys
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

LINEAR_API_URL = "https://api.linear.app/graphql"

# Matches Linear-style keys: 2-5 uppercase letters, dash, 1+ digits.
ISSUE_KEY_RE = re.compile(r"\b([A-Z]{2,5}-\d{1,6})\b")

# ---------------------------------------------------------------------------
# GraphQL helpers
# ---------------------------------------------------------------------------


def _gql(api_key: str, query: str, variables: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = json.dumps({"query": query, "variables": variables or {}}).encode("utf-8")
    auth = api_key if api_key.startswith("lin_api_") else f"Bearer {api_key}"
    req = Request(
        LINEAR_API_URL,
        data=payload,
        headers={
            "Authorization": auth,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Linear HTTP {exc.code}: {body}") from exc
    except URLError as exc:
        raise RuntimeError(f"Linear connection error: {exc.reason}") from exc


def _search_issue(api_key: str, key: str) -> dict[str, Any] | None:
    """Search Linear for a single issue by its identifier (e.g. PIX-1234)."""
    query = """
        query($query: String!) {
          issueSearch(query: $query, first: 1) {
            nodes {
              id
              identifier
              title
              state { id name type }
              team { id key states { nodes { id name type } } }
            }
          }
        }
    """
    data = _gql(api_key, query, {"query": key})
    nodes = data.get("data", {}).get("issueSearch", {}).get("nodes") or []
    return nodes[0] if nodes else None


def _find_done_state(issue: dict[str, Any]) -> str | None:
    """Return the state ID for the first ``done``-type state in the issue's team."""
    team = issue.get("team") or {}
    states_container = team.get("states") or {}
    for state in states_container.get("nodes") or []:
        if isinstance(state, dict) and state.get("type") == "completed":
            return state["id"]
    return None


def _transition_issue(api_key: str, issue_id: str, state_id: str) -> dict[str, Any]:
    """Transition an issue to a new workflow state."""
    mutation = """
        mutation($id: String!, $input: IssueUpdateInput!) {
          issueUpdate(id: $id, input: $input) {
            success
            issue { id identifier state { id name } }
          }
        }
    """
    data = _gql(api_key, mutation, {"id": issue_id, "input": {"stateId": state_id}})
    container = data.get("data", {}).get("issueUpdate") or {}
    if not container.get("success"):
        raise RuntimeError(f"Linear state transition failed: {data.get('errors', 'unknown')}")
    return container.get("issue") or {}


def _add_comment(api_key: str, issue_id: str, body: str) -> None:
    """Post a comment on a Linear issue."""
    mutation = """
        mutation($input: CommentCreateInput!) {
          commentCreate(input: $input) { success }
        }
    """
    _gql(api_key, mutation, {"input": {"issueId": issue_id, "body": body}})


# ---------------------------------------------------------------------------
# PR data extraction
# ---------------------------------------------------------------------------


def _extract_issue_keys(text: str) -> set[str]:
    """Return all unique Linear issue keys found in *text*."""
    return {m[0] for m in ISSUE_KEY_RE.finditer(text)}


def _merge_commit_message(merge_sha: str) -> str:
    """Return the full commit message for a SHA via ``git log`` (best-effort)."""
    try:
        result = subprocess.run(
            ["git", "log", "--format=%B", "-1", merge_sha],
            capture_output=True,
            text=True,
            check=False,
            timeout=15,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except (subprocess.SubprocessError, FileNotFoundError):
        pass
    return ""


def _collect_ids(pr_data: dict[str, Any], merge_sha: str) -> set[str]:
    """Collect all Linear issue keys from PR metadata and the merge commit."""
    ids: set[str] = set()

    # PR title
    title = pr_data.get("title") or ""
    ids.update(_extract_issue_keys(title))

    # PR body
    body = pr_data.get("body") or ""
    ids.update(_extract_issue_keys(body))

    # Head branch name (commonly includes ticket key)
    head = pr_data.get("head", {}) or {}
    ref = head.get("ref") or ""
    ids.update(_extract_issue_keys(ref))

    # Merge commit message
    msg = _merge_commit_message(merge_sha)
    ids.update(_extract_issue_keys(msg))

    return ids


def _build_comment(pr_data: dict[str, Any]) -> str:
    """Build a Linear comment body linking to the merged PR."""
    repo = os.environ.get("GITHUB_REPOSITORY", "unknown/unknown")
    with contextlib.suppress(KeyError, TypeError):
        repo = pr_data["base"]["repo"]["full_name"]
    number = pr_data.get("number", "?")
    pr_title = (pr_data.get("title") or "").strip()
    pr_url = pr_data.get("html_url") or f"https://github.com/{repo}/pull/{number}"

    lines = [
        f"✅ **PR #{number} merged** — [{pr_title}]({pr_url})",
        "",
        f"Repository: `{repo}`",
        f"Branch: `{pr_data.get('head', {}).get('ref', '?')}` → `{pr_data.get('base', {}).get('ref', '?')}`",
        "",
        "This issue was automatically closed when the PR was merged.",
        "",
        "---",
        "🤖 Automated via `auto_close_from_merge.py`",
    ]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Auto-close Linear tickets when a PR with ticket IDs in its metadata merges.",
    )
    parser.add_argument(
        "--pr-data",
        required=True,
        help="Path to a JSON file containing the GitHub pull_request event payload.",
    )
    parser.add_argument(
        "--target-status",
        default="Done",
        help="Linear workflow state name to transition issues into (default: Done).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Scan and resolve issue keys, but do not modify Linear.",
    )
    args = parser.parse_args(argv)

    api_key = (os.getenv("LINEAR_API_KEY") or "").strip()
    if not api_key:
        print("ERROR: LINEAR_API_KEY is not set.", file=sys.stderr)
        return 1

    # Load PR event data ------------------------------------------------
    try:
        with open(args.pr_data, encoding="utf-8") as fh:
            pr_data: dict[str, Any] = json.load(fh)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"ERROR: failed to read --pr-data '{args.pr_data}': {exc}", file=sys.stderr)
        return 1

    merge_sha = (pr_data.get("merge_commit_sha") or "").strip()
    if not merge_sha:
        print("WARNING: no merge_commit_sha in PR data; skipping merge-commit scan.", file=sys.stderr)

    # Extract issue keys ------------------------------------------------
    keys = _collect_ids(pr_data, merge_sha)
    if not keys:
        print("No Linear issue keys found in PR title, body, branch, or merge commit.")
        return 0

    print(f"Found {len(keys)} potential Linear key(s): {', '.join(sorted(keys))}")

    # Process each key --------------------------------------------------
    success_count = 0
    fail_count = 0
    comment_body = _build_comment(pr_data)

    for key in sorted(keys):
        print(f"\n  Processing {key}...", end=" ", flush=True)

        try:
            issue = _search_issue(api_key, key)
            if not issue:
                print("NOT FOUND (skipping)")
                continue

            identifier = issue.get("identifier") or key
            title = (issue.get("title") or "").strip()
            print(f"→ {identifier}: {title[:60]}{'…' if len(title) > 60 else ''}", end=" ")

            if args.dry_run:
                print("[DRY RUN — no changes made]")
                success_count += 1
                continue

            # Transition to Done
            done_state_id = _find_done_state(issue)
            if not done_state_id:
                print("NO DONE STATE FOUND (skipping transition)")
            else:
                _transition_issue(api_key, issue["id"], done_state_id)
                print("→ Done", end=" ")

            # Post comment
            _add_comment(api_key, issue["id"], comment_body)
            print("+ comment")
            success_count += 1

        except RuntimeError as exc:
            print(f"ERROR: {exc}")
            fail_count += 1

    print(f"\nDone. {success_count} issue(s) updated, {fail_count} failure(s).")
    return 0 if fail_count == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
