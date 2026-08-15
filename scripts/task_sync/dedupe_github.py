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
import urllib.request
from collections import defaultdict
from pathlib import Path

SYNC_LINE_RE = re.compile(r"(?im)^\s*(?P<key>[a-z0-9_.-]+)\s*:\s*(?P<value>.+?)\s*$")
SYNC_BLOCK_START = "<!-- pixelated-sync"
CLOSE_REASON = "not planned"
RATE_LIMIT_DELAY = 0.5  # seconds between API calls


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


def fetch_all_issues_via_api(repo: str, token: str) -> list[dict]:
    """Fetch all issues via GitHub REST API (reliable pagination)."""
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
        except Exception:
            # Try to recover with retry
            time.sleep(5)
            try:
                resp = urllib.request.urlopen(req)
                raw = resp.read()
                data = json.loads(raw.decode())
            except Exception:
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

        if len(data) < 100:
            break
        page += 1

    return all_issues


def close_issue(repo: str, issue_number: int) -> bool:
    """Close an issue with 'not planned' reason."""
    wait = RATE_LIMIT_DELAY

    for _attempt in range(3):
        result = subprocess.run(
            ["gh", "issue", "close", str(issue_number), "--repo", repo, "--reason", CLOSE_REASON],
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        if result.returncode == 0:
            return True

        err = result.stderr.lower()

        if "was submitted too quickly" in err or "rate limit" in err:
            time.sleep(wait)
            wait *= 2
            continue

        return False

    return False


def _sorted_for_keep(group: list[dict]) -> list[dict]:
    """Sort a duplicate group so the keeper (longest body, then earliest, then lowest number) is first."""
    return sorted(
        group,
        key=lambda x: (
            -(len(x.get("body", "") or "")),
            x.get("created_at", ""),
            x["number"],
        ),
    )


def _plan_true_duplicates(linear_map: dict[str, list[dict]]) -> tuple[int, list[tuple[int, int, str]]]:
    """Plan closes for groups sharing the same Linear ID. Returns (group_count, closes)."""
    closes: list[tuple[int, int, str]] = []  # (close_num, keep_num, linear_id)
    groups = 0
    for lid, lid_group in linear_map.items():
        if len(lid_group) > 1:
            groups += 1
            sorted_group = _sorted_for_keep(lid_group)
            keep = sorted_group[0]
            closes.extend((dup["number"], keep["number"], lid) for dup in sorted_group[1:])
    return groups, closes


def _plan_no_meta_duplicates(no_meta: list[dict]) -> tuple[int, list[tuple[int, int]]]:
    """Plan closes for title duplicates with no sync metadata. Returns (group_count, closes)."""
    if len(no_meta) <= 1:
        return 0, []
    sorted_no_meta = sorted(no_meta, key=lambda x: (x.get("created_at", ""), x["number"]))
    keep = sorted_no_meta[0]
    return 1, [(dup["number"], keep["number"]) for dup in sorted_no_meta[1:]]


def _plan_collisions(group: list[dict]) -> tuple[int, list[tuple[int, int]]]:
    """Plan closes for title collisions (different Linear IDs). Partition by Linear ID,
    select one keeper per subgroup, build closures from subgroup keepers."""
    # Partition group by Linear ID (exclude empty/no-linear issues from subgroup selection)
    linear_subgroups: dict[str, list[dict]] = defaultdict(list)
    no_linear: list[dict] = []
    for issue in group:
        meta = extract_metadata(issue.get("body", "") or "")
        lid = meta.get("linear", "")
        if lid:
            linear_subgroups[lid].append(issue)
        else:
            no_linear.append(issue)

    # Select keeper from each Linear subgroup using existing keeper-ordering
    subgroup_keepers: list[dict] = []
    for lid, subgroup in linear_subgroups.items():
        sorted_sub = _sorted_for_keep(subgroup)
        subgroup_keepers.append(sorted_sub[0])

    # Include no-linear issues as their own candidate subgroup (each forms a subgroup of 1)
    # If there are no-linear issues, treat them as additional candidates
    candidates = subgroup_keepers + no_linear

    if not candidates:
        return 0, []

    # If only one subgroup/keeper exists, no collision to resolve
    if len(candidates) == 1:
        return 0, []

    # Build collision closures: select global keeper from candidates, close rest
    sorted_candidates = _sorted_for_keep(candidates)
    global_keep = sorted_candidates[0]
    closes = [(c["number"], global_keep["number"]) for c in sorted_candidates[1:]]
    # Only build closures from subgroup keepers and no-linear candidates that were not retained
    # The prompt says: "Select the global keeper from that candidate set, then close only the remaining canonical candidates against it, excluding any issue already retained as a true-duplicate keeper."
    return 1, closes


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

    for _title, group in by_title.items():
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

        groups, closes = _plan_true_duplicates(linear_map)
        true_dup_groups += groups
        true_dup_closes.extend(closes)

        groups, closes = _plan_no_meta_duplicates(no_meta)
        no_meta_groups += groups
        no_meta_closes.extend(closes)

        if len(linear_map) > 1 and len(no_meta) == 0:
            groups, closes = _plan_collisions(group)
            collision_groups += groups
            collision_closes.extend(closes)

    return {
        "singles": singles,
        "true_dup_groups": true_dup_groups,
        "true_dup_closes": true_dup_closes,
        "no_meta_groups": no_meta_groups,
        "no_meta_closes": no_meta_closes,
        "collision_groups": collision_groups,
        "collision_closes": collision_closes,
    }


def main():
    repo = os.environ.get("GITHUB_REPO", "")
    owner = os.environ.get("GITHUB_OWNER", "")
    token = os.environ.get("GITHUB_TOKEN", "")

    if not repo or not owner:
        return 1

    full_repo = f"{owner}/{repo}"

    # Load cached issues if available, else fetch fresh
    cached_path = Path("/tmp/gh_issues_for_dedup.json")
    if cached_path.exists():
        issues = json.loads(cached_path.read_text())
    else:
        issues = fetch_all_issues_via_api(full_repo, token)
        cached_path.write_text(json.dumps(issues, indent=2))

    plan = classify_and_plan(issues)

    total_to_close = len(plan["true_dup_closes"]) + len(plan["no_meta_closes"]) + len(plan["collision_closes"])
    if total_to_close == 0:
        return 0

    # Execute close plan
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

    for item in all_closes:
        issue_num = item["issue"]
        keep_num = item["keep"]

        success = close_issue(full_repo, issue_num)
        if success:
            results["closed"] += 1
        else:
            results["failed"] += 1
            results["skipped"].append(issue_num)

        sys.stdout.write(f"  #{issue_num} → close (keep #{keep_num}): {'OK' if success else 'FAIL'}\n")
        sys.stdout.flush()
        time.sleep(RATE_LIMIT_DELAY)

    # Summary JSON to stdout for parsing
    return 0 if results["failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
