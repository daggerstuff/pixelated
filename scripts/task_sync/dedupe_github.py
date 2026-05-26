#!/usr/bin/env python3
"""Deduplicate GitHub issues in daggerstuff/pixelated.

Categorizes duplicate groups:
  1. True duplicates: same Linear sync ID → multiple GitHub issues. Keep best, close rest.
  2. No-metadata duplicates: same title, no sync metadata. Keep oldest, close rest.
  3. Title collisions: same title, different Linear IDs. Leave untouched.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
from collections import defaultdict
from pathlib import Path

SYNC_LINE_RE = re.compile(r"(?im)^\s*(?P<key>[a-z0-9_.-]+)\s*:\s*(?P<value>.+?)\s*$")
SYNC_BLOCK_START = "<!-- pixelated-sync"
CLOSE_REASON = "not planned"
RATE_LIMIT_DELAY = 0.5  # seconds between API calls
BATCH_SIZE = 50


def extract_metadata(body: str) -> dict[str, str]:
    if SYNC_BLOCK_START not in body:
        return {}
    _, _, after = body.partition(SYNC_BLOCK_START)
    block_text, _, _ = after.partition("-->")
    block_text = block_text.replace("<br>", "\n").replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
    metadata: dict[str, str] = {}
    for line in block_text.splitlines():
        m = SYNC_LINE_RE.match(line)
        if m:
            metadata[m.group("key").strip()] = m.group("value").strip()
    return metadata


def fetch_all_issues(repo: str) -> list[dict]:
    """Fetch all issues from the repo using gh CLI."""
    all_issues: list[dict] = []
    limit = 100
    page = 0
    while True:
        page += 1
        offset = (page - 1) * limit
        result = subprocess.run(
            [
                "gh",
                "issue",
                "list",
                "--repo",
                repo,
                "--state",
                "all",
                "--limit",
                str(limit + 1),
                "--json",
                "number,title,state,body,createdAt",
                "-S",
                f"updated:<=2099-12-31 sort:created-asc",
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode != 0:
            print(f"Error fetching page {page}: {result.stderr[:200]}", file=sys.stderr)
            break

        data = json.loads(result.stdout)
        if not data:
            break

        # gh CLI returns at most --limit items, but doesn't support --page directly.
        # We use --limit to get a batch and rely on the fact that default sort is
        # creation-asc. However, this approach hits issues with large repos.
        # Instead, use the REST API directly here.
        all_issues.extend(data)
        print(f"  Fetched {len(data)} issues (page {page}, total {len(all_issues)})", file=sys.stderr)
        if len(data) < limit:
            break

    return all_issues


def fetch_all_issues_via_api(repo: str, token: str) -> list[dict]:
    """Fetch all issues via GitHub REST API (reliable pagination)."""
    import urllib.request

    owner, repo_name = repo.split("/")
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "pixelated-dedup",
    }

    all_issues: list[dict] = []
    page = 1
    while True:
        url = (
            f"https://api.github.com/repos/{owner}/{repo_name}/issues"
            f"?state=all&per_page=100&page={page}&sort=created&direction=asc"
        )
        req = urllib.request.Request(url, headers=headers)
        try:
            resp = urllib.request.urlopen(req)
            raw = resp.read()
            data = json.loads(raw.decode())
        except Exception as e:
            print(f"  API error on page {page}: {e}", file=sys.stderr)
            # Try to recover with retry
            time.sleep(5)
            try:
                resp = urllib.request.urlopen(req)
                raw = resp.read()
                data = json.loads(raw.decode())
            except Exception as e2:
                print(f"  Retry failed: {e2}", file=sys.stderr)
                break

        if not isinstance(data, list) or not data:
            break

        for item in data:
            if "pull_request" not in item:
                all_issues.append(
                    {
                        "number": item["number"],
                        "title": item["title"],
                        "state": item["state"],
                        "body": item.get("body") or "",
                        "created_at": item["created_at"],
                    }
                )

        print(f"  Page {page}: {len(data)} items ({len(all_issues)} total issues)", file=sys.stderr)
        if len(data) < 100:
            break
        page += 1

    return all_issues


def close_issue(repo: str, issue_number: int) -> bool:
    """Close an issue with 'not planned' reason."""
    wait = RATE_LIMIT_DELAY

    for attempt in range(3):
        result = subprocess.run(
            ["gh", "issue", "close", str(issue_number), "--repo", repo, "--reason", CLOSE_REASON],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode == 0:
            return True

        err = result.stderr.lower()

        if "was submitted too quickly" in err or "rate limit" in err:
            print(f"  Rate limited on #{issue_number}, retrying in {wait:.1f}s...", file=sys.stderr)
            time.sleep(wait)
            wait *= 2
            continue

            print(f"  Failed to close #{issue_number}: {result.stderr[:120]}", file=sys.stderr)
        return False

    return False


def classify_and_plan(issues: list[dict]) -> dict:
    """Classify duplicate groups and build close plan."""
    # Group by title
    by_title: dict[str, list[dict]] = defaultdict(list)
    for issue in issues:
        by_title[issue["title"]].append(issue)

    singles = 0
    true_dup_groups = 0
    true_dup_closes: list[tuple[int, int, str]] = []  # (close_num, keep_num, linear_id)
    no_meta_groups = 0
    no_meta_closes: list[tuple[int, int]] = []  # (close_num, keep_num)
    collision_groups = 0
    collision_closes: list[tuple[int, int]] = []  # (close_num, keep_num)

    for title, group in by_title.items():
        if len(group) == 1:
            singles += 1
            continue

        # Extract sync metadata
        linear_map: dict[str, list[dict]] = defaultdict(list)
        no_meta: list[dict] = []
        for issue in group:
            meta = extract_metadata(issue["body"])
            lid = meta.get("linear", "")
            if lid:
                linear_map[lid].append(issue)
            else:
                no_meta.append(issue)

        # True duplicates: same Linear ID
        for lid, lid_group in linear_map.items():
            if len(lid_group) > 1:
                true_dup_groups += 1
                # Keep the one with the best body (longest), or if same, earliest
                sorted_group = sorted(
                    lid_group,
                    key=lambda x: (
                        -(len(x.get("body", "") or "")),
                        x.get("created_at", ""),
                        x["number"],
                    ),
                )
                keep = sorted_group[0]
                for dup in sorted_group[1:]:
                    true_dup_closes.append((dup["number"], keep["number"], lid))

        # No-metadata duplicates
        if len(no_meta) > 1:
            no_meta_groups += 1
            sorted_no_meta = sorted(no_meta, key=lambda x: (x.get("created_at", ""), x["number"]))
            keep = sorted_no_meta[0]
            for dup in sorted_no_meta[1:]:
                no_meta_closes.append((dup["number"], keep["number"]))

        if len(linear_map) > 1 and len(no_meta) == 0:
            collision_groups += 1
            sorted_group = sorted(
                group,
                key=lambda x: (
                    -(len(x.get("body", "") or "")),
                    x.get("created_at", ""),
                    x["number"],
                ),
            )
            keep = sorted_group[0]
            for dup in sorted_group[1:]:
                collision_closes.append((dup["number"], keep["number"]))

    return {
        "singles": singles,
        "true_dup_groups": true_dup_groups,
        "true_dup_closes": true_dup_closes,
        "no_meta_groups": no_meta_groups,
        "no_meta_closes": no_meta_closes,
        "collision_groups": collision_groups,
        "collision_closes": collision_closes,
    }


def plan_summary(plan: dict) -> str:
    total = len(plan["true_dup_closes"]) + len(plan["no_meta_closes"]) + len(plan["collision_closes"])
    lines = [
        f"  Single-issue titles:       {plan['singles']}",
        f"  Title collision groups:     {plan['collision_groups']}",
        f"  Title collision issues → close: {len(plan['collision_closes'])}",
        f"",
        f"  True duplicate groups:      {plan['true_dup_groups']}",
        f"  True duplicate issues → close: {len(plan['true_dup_closes'])}",
        f"",
        f"  No-metadata duplicate groups: {plan['no_meta_groups']}",
        f"  No-metadata issues → close:    {len(plan['no_meta_closes'])}",
        f"",
        f"  TOTAL TO CLOSE:            {total}",
    ]
    return "\n".join(lines)


def main():
    repo = os.environ.get("GITHUB_REPO", "")
    owner = os.environ.get("GITHUB_OWNER", "")
    token = os.environ.get("GITHUB_TOKEN", "")

    if not repo or not owner:
        print("GITHUB_OWNER and GITHUB_REPO must be set")
        return 1

    full_repo = f"{owner}/{repo}"

    # Load cached issues if available, else fetch fresh
    cached_path = Path("/tmp/gh_issues_for_dedup.json")
    if cached_path.exists():
        print(f"Loading {cached_path.stat().st_size} bytes from cache...", file=sys.stderr)
        issues = json.loads(cached_path.read_text())
    else:
        print("Fetching all GitHub issues via API...", file=sys.stderr)
        issues = fetch_all_issues_via_api(full_repo, token)
        cached_path.write_text(json.dumps(issues, indent=2))
        print(f"Cached to {cached_path}", file=sys.stderr)

    print(f"\nLoaded {len(issues)} issues total.", file=sys.stderr)

    plan = classify_and_plan(issues)
    print(f"\n=== CLEANUP PLAN ===", file=sys.stderr)
    print(plan_summary(plan), file=sys.stderr)

    total_to_close = len(plan["true_dup_closes"]) + len(plan["no_meta_closes"]) + len(plan["collision_closes"])
    if total_to_close == 0:
        print("\nNothing to close. Exiting.", file=sys.stderr)
        return 0

    # Execute close plan
    print(f"\n=== CLOSING {total_to_close} ISSUES ===", file=sys.stderr)
    all_closes = []

    for close_num, keep_num, lid in plan["true_dup_closes"]:
        all_closes.append(
            {
                "issue": close_num,
                "keep": keep_num,
                "reason": f"True duplicate of #{keep_num} (Linear: {lid[:12]}...)",
            }
        )

    for close_num, keep_num in plan["no_meta_closes"]:
        all_closes.append(
            {
                "issue": close_num,
                "keep": keep_num,
                "reason": f"No-metadata duplicate of #{keep_num}",
            }
        )

    for close_num, keep_num in plan["collision_closes"]:
        all_closes.append(
            {
                "issue": close_num,
                "keep": keep_num,
                "reason": f"Title-collision duplicate of #{keep_num}",
            }
        )

    # Sort by issue number ascending
    all_closes.sort(key=lambda x: x["issue"])

    results = {"closed": 0, "failed": 0, "skipped": []}
    batch_num = 0

    for i, item in enumerate(all_closes):
        issue_num = item["issue"]
        keep_num = item["keep"]

        if i % BATCH_SIZE == 0:
            batch_num += 1
            print(f"\nBatch {batch_num} (issues {i + 1}-{min(i + BATCH_SIZE, len(all_closes))})...")

        success = close_issue(full_repo, issue_num)
        if success:
            results["closed"] += 1
        else:
            results["failed"] += 1
            results["skipped"].append(issue_num)

        sys.stdout.write(f"  #{issue_num} → close (keep #{keep_num}): {'OK' if success else 'FAIL'}\n")
        sys.stdout.flush()
        time.sleep(RATE_LIMIT_DELAY)

    print(f"\n=== RESULTS ===", file=sys.stderr)
    print(f"  Closed:  {results['closed']}", file=sys.stderr)
    print(f"  Failed:  {results['failed']}", file=sys.stderr)
    if results["failed"] > 0:
        print(f"  Failed issues: {results['skipped']}", file=sys.stderr)

    # Summary JSON to stdout for parsing
    print(json.dumps(results))
    return 0 if results["failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
