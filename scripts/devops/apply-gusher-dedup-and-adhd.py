#!/usr/bin/env python3
"""Dedup beads after gusher→ADHD migration and rewrite Jira refs to ADHD-*.

Uses gusher-pix.json (slimshadyme PIX export) and exports/pix-to-adhd-key-map.json.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
GUSHER_JSON = REPO_ROOT / "gusher-pix.json"
KEY_MAP = REPO_ROOT / "exports" / "pix-to-adhd-key-map.json"
JIRA_SITE = "https://russianvodka.atlassian.net"

MIGRATION_MARKER = "Migrated from slimshadyme"
SOURCE_PIX_RE = re.compile(r"Migrated from slimshadyme (PIX-\d+)", re.IGNORECASE)
JIRA_LINE_RE = re.compile(r"^jira:\s*(PIX-\d+)\s*$", re.MULTILINE)
SOURCE_ID_RE = re.compile(r"^source-id:\s*(PIX-\d+)\s*$", re.MULTILINE)


def run_bd(args: list[str], *, dry_run: bool) -> bool:
    if dry_run:
        return True
    completed = subprocess.run(
        ["bd", *args],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        pass
    return completed.returncode == 0


def load_migration_dupes() -> list[tuple[str, str | None]]:
    """Beads issues created as slimshadyme migration copies (safe to close)."""
    dupes: list[tuple[str, str | None]] = []
    for line in (REPO_ROOT / ".beads/issues.jsonl").read_text().splitlines():
        if not line.strip():
            continue
        issue = json.loads(line)
        if issue.get("_type") != "issue":
            continue
        body = issue.get("description") or ""
        if MIGRATION_MARKER not in body:
            continue
        match = SOURCE_PIX_RE.search(body)
        dupes.append((issue["id"], match.group(1) if match else None))
    return dupes


def load_sync_key_dupes() -> list[tuple[str, str]]:
    """Stale beads IDs to close (canonical_id, stale_id) via tri_sync grouping."""
    return []


def rewrite_jira_refs(body: str, key_map: dict[str, str]) -> str | None:
    """Replace jira:/source-id PIX-* with ADHD-* where mapped. Returns new body or None."""
    updated = body
    changed = False

    def repl_jira(match: re.Match[str]) -> str:
        nonlocal changed
        pix = match.group(1)
        adhd = key_map.get(pix)
        if not adhd:
            return match.group(0)
        changed = True
        return f"jira: {adhd}"

    updated = JIRA_LINE_RE.sub(repl_jira, updated)

    def repl_source(match: re.Match[str]) -> str:
        nonlocal changed
        pix = match.group(1)
        adhd = key_map.get(pix)
        if not adhd:
            return match.group(0)
        changed = True
        return f"source-id: {adhd}"

    updated = SOURCE_ID_RE.sub(repl_source, updated)
    return updated if changed else None


def load_jira_ref_updates(key_map: dict[str, str]) -> list[tuple[str, str]]:
    updates: list[tuple[str, str]] = []
    for line in (REPO_ROOT / ".beads/issues.jsonl").read_text().splitlines():
        if not line.strip():
            continue
        issue = json.loads(line)
        if issue.get("_type") != "issue":
            continue
        if issue.get("status") == "closed":
            continue
        body = issue.get("description") or ""
        new_body = rewrite_jira_refs(body, key_map)
        if new_body:
            updates.append((issue["id"], new_body))
    return updates


def merge_jira_import_dupes(
    issues: list[dict],
    key_map: dict[str, str],
) -> tuple[list[dict], int, int]:
    """Close beads created by jira pull when a Linear-linked canonical exists."""
    adhd_to_pix = {adhd: pix for pix, adhd in key_map.items()}
    issues_by_id = {issue["id"]: issue for issue in issues}
    by_linear_pix: dict[str, str] = {}
    by_title: dict[str, str] = {}
    for issue in issues:
        ref = issue.get("external_ref") or ""
        if "russianvodka.atlassian.net" in ref:
            continue
        match = re.search(r"PIX-(\d+)", ref)
        if match and "linear.app" in ref:
            pix = f"PIX-{match.group(1)}"
            # Prefer open canonical; fall back to any Linear-linked issue.
            existing = by_linear_pix.get(pix)
            if not existing or (
                issue.get("status") != "closed" and issues_by_id.get(existing, {}).get("status") == "closed"
            ):
                by_linear_pix[pix] = issue["id"]
        title = (issue.get("title") or "").strip().lower()
        if title:
            existing = by_title.get(title)
            if not existing or (
                issue.get("status") != "closed" and issues_by_id.get(existing, {}).get("status") == "closed"
            ):
                by_title[title] = issue["id"]

    closed = 0
    linked = 0
    for issue in issues:
        ref = issue.get("external_ref") or ""
        if "russianvodka.atlassian.net" not in ref:
            continue
        adhd_match = re.search(r"ADHD-(\d+)", ref)
        if not adhd_match:
            continue
        adhd_key = f"ADHD-{adhd_match.group(1)}"
        pix_key = adhd_to_pix.get(adhd_key)
        canonical_id = by_linear_pix.get(pix_key) if pix_key else None
        if not canonical_id:
            title = (issue.get("title") or "").strip().lower()
            canonical_id = by_title.get(title)
        if not canonical_id or canonical_id == issue["id"]:
            continue
        issue["status"] = "closed"
        closed += 1
        for target in issues:
            if target["id"] != canonical_id:
                continue
            body = target.get("description") or ""
            new_body = rewrite_jira_refs(body, {pix_key or "": adhd_key}) if pix_key else None
            if not new_body and pix_key:
                # Ensure jira line exists in sync block
                if "jira:" not in body:
                    new_body = body + f"\n\n<!-- pixelated-sync\njira: {adhd_key}\n-->"
                else:
                    new_body = re.sub(
                        r"^jira:\s*PIX-\d+\s*$",
                        f"jira: {adhd_key}",
                        body,
                        flags=re.MULTILINE,
                    )
            if new_body:
                target["description"] = new_body
                linked += 1
            break
    return issues, closed, linked


def apply_jsonl_batch(
    *,
    dry_run: bool,
    skip_migration_close: bool,
    skip_synckey_close: bool,
    skip_jira_ref_update: bool,
    merge_jira_imports: bool,
    key_map: dict[str, str],
) -> int:
    """Single-pass JSONL edit + one bd import (avoids per-issue Dolt round-trips)."""
    jsonl_path = REPO_ROOT / ".beads/issues.jsonl"
    lines = jsonl_path.read_text().splitlines()
    issue_rows: list[dict] = []
    other_lines: list[str] = []
    for line in lines:
        if not line.strip():
            continue
        row = json.loads(line)
        if row.get("_type") == "issue":
            issue_rows.append(row)
        else:
            other_lines.append(line)

    migration_ids = {issue_id for issue_id, _ in load_migration_dupes()}
    sync_close: set[str] = set()
    if not skip_synckey_close:
        for _canonical, stale_id in load_sync_key_dupes():
            if stale_id not in migration_ids:
                sync_close.add(stale_id)

    migration_closed = 0
    sync_closed = 0
    ref_updated = 0

    for issue in issue_rows:
        issue_id = issue["id"]

        if not skip_migration_close and issue_id in migration_ids and issue.get("status") != "closed":
            issue["status"] = "closed"
            migration_closed += 1

        if not skip_synckey_close and issue_id in sync_close and issue.get("status") != "closed":
            issue["status"] = "closed"
            sync_closed += 1

        if not skip_jira_ref_update and issue.get("status") != "closed":
            body = issue.get("description") or ""
            new_body = rewrite_jira_refs(body, key_map)
            if new_body:
                issue["description"] = new_body
                ref_updated += 1

    if merge_jira_imports:
        issue_rows, _jira_import_closed, _jira_linked = merge_jira_import_dupes(issue_rows, key_map)

    if dry_run:
        return 0

    out_lines = other_lines + [json.dumps(issue, ensure_ascii=False) for issue in issue_rows]
    jsonl_path.write_text("\n".join(out_lines) + "\n")
    completed = subprocess.run(
        ["bd", "import"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        return 1
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Execute changes (default: dry-run)")
    parser.add_argument(
        "--jsonl-batch",
        action="store_true",
        help="Edit .beads/issues.jsonl once and bd import (fast path)",
    )
    parser.add_argument(
        "--merge-jira-imports",
        action="store_true",
        help="With --jsonl-batch: close duplicate ADHD Jira imports from bd jira sync --pull",
    )
    parser.add_argument("--skip-migration-close", action="store_true")
    parser.add_argument("--skip-synckey-close", action="store_true")
    parser.add_argument("--skip-jira-ref-update", action="store_true")
    parser.add_argument("--batch-size", type=int, default=25)
    args = parser.parse_args()
    dry_run = not args.apply

    if not GUSHER_JSON.is_file():
        return 1
    if not KEY_MAP.is_file():
        return 1

    len(json.loads(GUSHER_JSON.read_text()))
    key_map: dict[str, str] = json.loads(KEY_MAP.read_text())

    if args.jsonl_batch:
        return apply_jsonl_batch(
            dry_run=dry_run,
            skip_migration_close=args.skip_migration_close,
            skip_synckey_close=args.skip_synckey_close,
            skip_jira_ref_update=args.skip_jira_ref_update,
            merge_jira_imports=args.merge_jira_imports,
            key_map=key_map,
        )

    failed = 0

    if not args.skip_migration_close:
        migration_dupes = load_migration_dupes()
        for index, (issue_id, source_pix) in enumerate(migration_dupes, start=1):
            if index % args.batch_size == 1:
                pass
            if not run_bd(
                ["close", issue_id, "--reason", f"Duplicate of gusher {source_pix or 'PIX'} → ADHD migration"],
                dry_run=dry_run,
            ):
                failed += 1

    if not args.skip_synckey_close:
        sync_dupes = load_sync_key_dupes()
        # Skip IDs already closed in step 1
        migration_ids = {i for i, _ in load_migration_dupes()}
        sync_dupes = [(c, s) for c, s in sync_dupes if s not in migration_ids]
        for index, (_canonical, stale_id) in enumerate(sync_dupes, start=1):
            if index % args.batch_size == 1:
                pass
            if not run_bd(["close", stale_id, "--reason", "sync-key duplicate"], dry_run=dry_run):
                failed += 1
            if not dry_run:
                run_bd(
                    ["dep", "add", stale_id, _canonical, "--type", "related"],
                    dry_run=False,
                )

    if not args.skip_jira_ref_update:
        ref_updates = load_jira_ref_updates(key_map)
        for index, (issue_id, new_body) in enumerate(ref_updates, start=1):
            if index % args.batch_size == 1:
                pass
            if not run_bd(["update", issue_id, "--description", new_body], dry_run=dry_run):
                failed += 1

    if dry_run:
        pass
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
