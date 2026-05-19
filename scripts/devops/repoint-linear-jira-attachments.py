#!/usr/bin/env python3
"""Repoint Linear Jira attachments from slimshadyme PIX-* to russianvodka ADHD-*.

Uses exports/pix-to-adhd-key-map.json (from gusher-pix.json migration).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import time
import urllib.error
import urllib.request
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
KEY_MAP_PATH = REPO_ROOT / "exports" / "pix-to-adhd-key-map.json"
TEAM_ID = "52861523-9089-49a3-8be5-4032d68cb55a"
JIRA_SITE = "https://russianvodka.atlassian.net"
SLIM_URL = re.compile(r"https?://slimshadyme\.atlassian\.net/browse/(PIX-\d+)", re.I)
RUSSIAN_URL = re.compile(r"https?://russianvodka\.atlassian\.net/browse/(ADHD-\d+)", re.I)
MIGRATION_MARKER = "Migrated from slimshadyme"
DUPLICATE_STATE_ID = "0b40a450-946c-48b0-9e85-d0676c800b76"


def gql(api_key: str, query: str, variables: dict | None = None) -> dict:
    body = json.dumps({"query": query, "variables": variables or {}}).encode()
    req = urllib.request.Request(
        "https://api.linear.app/graphql",
        data=body,
        headers={"Content-Type": "application/json", "Authorization": api_key},
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            payload = json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code}: {detail}") from exc
    if payload.get("errors"):
        raise RuntimeError(json.dumps(payload["errors"], indent=2))
    return payload["data"]


def fetch_all_issues(api_key: str) -> list[dict]:
    query = """
    query TeamIssues($teamId: String!, $after: String) {
      team(id: $teamId) {
        issues(first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            identifier
            title
            description
            state { type name }
            attachments {
              nodes { id title url sourceType }
            }
          }
        }
      }
    }
    """
    issues: list[dict] = []
    after = None
    while True:
        data = gql(api_key, query, {"teamId": TEAM_ID, "after": after})
        conn = data["team"]["issues"]
        issues.extend(conn["nodes"])
        if not conn["pageInfo"]["hasNextPage"]:
            break
        after = conn["pageInfo"]["endCursor"]
    return issues


def pix_sort_key(identifier: str) -> int:
    match = re.search(r"PIX-(\d+)$", identifier)
    return int(match.group(1)) if match else 10**9


def is_migration(issue: dict) -> bool:
    return MIGRATION_MARKER in (issue.get("description") or "")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--sleep", type=float, default=0.12, help="Delay between API calls")
    args = parser.parse_args()

    api_key = os.environ.get("LINEAR_API_KEY")
    if not api_key:
        print("LINEAR_API_KEY required", file=os.sys.stderr)
        return 1
    key_map: dict[str, str] = json.loads(KEY_MAP_PATH.read_text())

    issues = fetch_all_issues(api_key)
    print(f"Loaded {len(issues)} Linear issues")

    by_title: dict[str, list[dict]] = defaultdict(list)
    for issue in issues:
        title = (issue.get("title") or "").strip().lower()
        if title:
            by_title[title].append(issue)

    canonical_by_title: dict[str, dict] = {}
    for title, group in by_title.items():
        non_migration = [i for i in group if not is_migration(i)]
        pool = non_migration or group
        canonical_by_title[title] = min(pool, key=lambda i: pix_sort_key(i["identifier"]))

    slim_deletes: list[tuple[str, str, str]] = []
    migration_cancel: list[str] = []
    repoint: list[tuple[dict, str, str]] = []

    for issue in issues:
        ident = issue["identifier"]
        if is_migration(issue) and issue["state"]["type"] not in ("canceled", "completed"):
            migration_cancel.append(issue["id"])

        for att in issue["attachments"]["nodes"]:
            url = att.get("url") or ""
            slim = SLIM_URL.search(url)
            if slim:
                pix = slim.group(1).upper()
                adhd = key_map.get(pix)
                slim_deletes.append((ident, att["id"], pix))
                if adhd and not is_migration(issue):
                    repoint.append((issue, adhd, pix))

    print(f"slimshadyme attachments to delete: {len(slim_deletes)}")
    print(f"migration issues to mark Duplicate: {len(migration_cancel)}")
    print(f"canonical issues to link ADHD: {len(repoint)}")

    if not args.apply:
        print("Dry run only. Re-run with --apply.")
        return 0

    delete_mut = "mutation($id: String!) { attachmentDelete(id: $id) { success } }"
    cancel_mut = """
    mutation($id: String!, $stateId: String!) {
      issueUpdate(id: $id, input: { stateId: $stateId }) { success }
    }
    """
    link_mut = """
    mutation($issueId: String!, $jiraIssueId: String!, $title: String!) {
      attachmentLinkJiraIssue(issueId: $issueId, jiraIssueId: $jiraIssueId, title: $title) {
        success
        attachment { id url title }
      }
    }
    """
    desc_mut = """
    mutation($id: String!, $description: String!) {
      issueUpdate(id: $id, input: { description: $description }) { success }
    }
    """

    deleted = 0
    for ident, att_id, _pix in slim_deletes:
        try:
            gql(api_key, delete_mut, {"id": att_id})
            deleted += 1
        except RuntimeError as exc:
            if "Entity not found" not in str(exc):
                print(f"delete failed {ident} {att_id}: {exc}")
        time.sleep(args.sleep)

    canceled = 0
    for issue_id in migration_cancel:
        try:
            gql(api_key, cancel_mut, {"id": issue_id, "stateId": DUPLICATE_STATE_ID})
            canceled += 1
        except RuntimeError as exc:
            print(f"cancel failed {issue_id}: {exc}")
        time.sleep(args.sleep)

    linked = 0
    described = 0
    seen_adhd: set[str] = set()
    for issue, adhd, pix in repoint:
        if adhd in seen_adhd:
            continue
        ident = issue["identifier"]
        try:
            gql(
                api_key,
                link_mut,
                {"issueId": ident, "jiraIssueId": adhd, "title": adhd},
            )
            linked += 1
            seen_adhd.add(adhd)
        except RuntimeError as exc:
            msg = str(exc)
            if "already been linked" in msg or "already linked" in msg:
                described += 1
                body = issue.get("description") or ""
                link_line = f"\n\n**Jira:** [{adhd}]({JIRA_SITE}/browse/{adhd}) (migrated from slimshadyme {pix})"
                if adhd not in body:
                    gql(
                        api_key,
                        desc_mut,
                        {"id": issue["id"], "description": body + link_line},
                    )
            else:
                print(f"link failed {ident} -> {adhd}: {exc}")
        time.sleep(args.sleep)

    print(
        f"Done: deleted={deleted}, canceled_migration={canceled}, "
        f"jira_linked={linked}, description_fallback={described}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
