#!/usr/bin/env python3
"""Delete GitHub Actions workflow runs and caches older than 7 days in batches."""

import json
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

OWNER = "daggerstuff"
REPO = "pixelated"
CUTOFF = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ")
PARALLEL = 10  # Reduced to avoid secondary rate limits
DRY_RUN = "--dry-run" in sys.argv
RUNS_ONLY = "--runs-only" in sys.argv
CACHES_ONLY = "--caches-only" in sys.argv


def gh(*args):
    """Run a gh CLI command and return parsed JSON or raw output."""
    cmd = ["gh", "api", *list(args)]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120, shell=False, check=False)
    if result.returncode != 0:
        return None
    return result.stdout.strip()


def fetch_run_ids():
    """Fetch all run IDs older than cutoff via paginated API."""
    all_ids = []
    page = 1
    while True:
        query = urlencode(
            {
                "created": f"<{CUTOFF}",
                "per_page": "100",
                "page": str(page),
            }
        )
        stdout = gh(
            f"/repos/{OWNER}/{REPO}/actions/runs?{query}",
            "--jq",
            ".workflow_runs[].id",
        )
        if not stdout:
            break
        ids = [int(line) for line in stdout.splitlines() if line.strip().isdigit()]
        if not ids:
            break
        all_ids.extend(ids)
        if len(ids) < 100:
            break
        page += 1
        if page > 10:
            break
    return all_ids


def delete_run(run_id):
    """Delete a single workflow run. Returns (run_id, success)."""
    result = subprocess.run(
        ["gh", "api", "--method", "DELETE", f"/repos/{OWNER}/{REPO}/actions/runs/{run_id}", "--silent"],
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    return (run_id, result.returncode == 0)


def get_remaining_count():
    """Get count of remaining old runs."""
    query = urlencode({"created": f"<{CUTOFF}", "per_page": "1"})
    stdout = gh(
        f"/repos/{OWNER}/{REPO}/actions/runs?{query}",
        "--jq",
        ".total_count",
    )
    if stdout and stdout.isdigit():
        return int(stdout)
    return -1


def fetch_cache_ids():
    """Fetch all cache IDs older than cutoff via paginated API.
    GitHub caches API doesn't support date filtering, so we sort ascending
    and stop when we hit items newer than cutoff."""
    all_ids = []
    page = 1
    while True:
        stdout = gh(
            f"/repos/{OWNER}/{REPO}/actions/caches",
            "-X",
            "GET",
            "-f",
            "per_page=100",
            "-f",
            f"page={page}",
            "-f",
            "sort=last_accessed_at",
            "-f",
            "direction=asc",
        )
        if not stdout:
            break
        try:
            data = json.loads(stdout)
            caches = data.get("actions_caches", [])
        except json.JSONDecodeError:
            break
        if not caches:
            break
        for cache in caches:
            accessed = cache.get("last_accessed_at") or ""
            # Treat missing/empty timestamp as expired (should never happen)
            if not accessed or accessed < CUTOFF:
                all_ids.append(cache["id"])
            else:
                # Since sorted ascending, stop when we hit a non-expired cache
                return all_ids
        if len(caches) < 100:
            break
        page += 1
        if page > 10:
            break
    return all_ids


def delete_cache(cache_id):
    """Delete a single cache. Returns (cache_id, success)."""
    result = subprocess.run(
        ["gh", "api", "--method", "DELETE", f"/repos/{OWNER}/{REPO}/actions/caches/{cache_id}", "--silent"],
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    return (cache_id, result.returncode == 0)


def get_remaining_cache_count():
    """Get count of caches older than cutoff."""
    total = 0
    page = 1
    while True:
        stdout = gh(
            f"/repos/{OWNER}/{REPO}/actions/caches",
            "-f",
            "per_page=100",
            "-f",
            f"page={page}",
            "-f",
            "sort=last_accessed_at",
            "-f",
            "direction=asc",
        )
        if not stdout:
            break
        try:
            data = json.loads(stdout)
            caches = data.get("actions_caches", [])
        except json.JSONDecodeError:
            break
        if not caches:
            break
        for cache in caches:
            accessed = cache.get("last_accessed_at") or ""
            # Treat missing/empty timestamp as expired
            if not accessed or accessed < CUTOFF:
                total += 1
            else:
                return total
        if len(caches) < 100:
            break
        page += 1
    return total


def main():
    do_runs = not CACHES_ONLY
    do_caches = not RUNS_ONLY

    # --- Workflow Runs ---
    if do_runs:
        remaining = get_remaining_count()

        if remaining != 0 and not DRY_RUN:
            while True:
                run_ids = fetch_run_ids()
                if not run_ids:
                    break
                with ThreadPoolExecutor(max_workers=PARALLEL) as executor:
                    futures = {executor.submit(delete_run, rid): rid for rid in run_ids}
                    results = [future.result() for future in as_completed(futures)]
                    for rid, ok in results:
                        if not ok:
                            print(f"Failed to delete run {rid}")
                remaining = get_remaining_count()
                if remaining == 0:
                    break
                time.sleep(15)

    # --- Caches ---
    if do_caches:
        remaining = get_remaining_cache_count()

        if remaining != 0 and not DRY_RUN:
            any_failure = False
            while True:
                cache_ids = fetch_cache_ids()
                if not cache_ids:
                    break
                deletion_failures = False
                with ThreadPoolExecutor(max_workers=PARALLEL) as executor:
                    futures = {executor.submit(delete_cache, cid): cid for cid in cache_ids}
                    for future in as_completed(futures):
                        cid, success = future.result()
                        if not success:
                            deletion_failures = True
                if deletion_failures:
                    any_failure = True
                remaining = get_remaining_cache_count()
                if remaining == 0:
                    break
                time.sleep(15)
            if any_failure:
                return 1


if __name__ == "__main__":
    main()
