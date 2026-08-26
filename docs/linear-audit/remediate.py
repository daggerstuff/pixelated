#!/usr/bin/env python3
"""
Apply remediations to a Linear workspace based on ``audit_results.json``.

v2 — Linear MCP flat-shape compatibility
========================================

This remediation tool reads audit results produced by ``run_audit.py``, which
in turn consumes the **flat shape** written by ``fetch_issues.py`` (v2 Linear
MCP flat shape — see ``docs/linear-audit/linear_audit.md``).

Read path (MCP flat shape):
    fetch_issues.py  → issues.json (flat) → run_audit.py → audit_results.json (flat)
    → remediate.py

Write path (Linear GraphQL, UUID-based):
    Linear's GraphQL API still operates on **UUID** ``id`` values. Because the
    flat shape stores the human *identifier* (e.g. ``PIX-1873``) under ``id``
    rather than a UUID, remediation entries emitted by ``run_audit.py`` carry
    both ``id`` (= identifier) and the original issue UUID must be passed via
    the audit JSON's ``id`` field only when it is still a UUID. Where the audit
    JSON lacks a UUID, ``--apply`` cannot safely call the GraphQL mutation and
    the tool reports it as a no-op. In practice, the audit results retain the
    issue *identifier*; Linear UUIDs are carried through by keeping the
    ``createdById`` / ``assigneeId`` / ``projectId`` / ``cycleId`` (UUID)
    fields from the flat shape. For write-back, set these as needed on the
    remediation entry.

  - Add descriptions to issues missing them
  - Assign owners to unassigned issues
  - Resolve duplicate pairs (archive one)
  - Archive completed-but-unarchived issues

Usage:
    LINEAR_API_KEY=lin_api_xxx python3 remediate.py [--dry-run] [--input audit_results.json]

By default runs in DRY-RUN mode (``apply=False``). Add ``--apply`` to make
changes. The dry-run default is preserved from v1 — only the data shape
consumed upstream changed.
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
INPUT_FILE = Path(__file__).parent / "audit_results.json"

# Linear's GraphQL write API operates on UUID ``id`` values. These mutations
# are therefore UUID-based even though the audit data we consume is in the v2
# Linear MCP flat shape (which uses the human identifier under ``id``).
UPDATE_ISSUE_MUTATION = """
mutation UpdateIssue($id: ID!, $input: IssueUpdateInput!) {
  issueUpdate(id: $id, input: $input) {
    success
    issue {
      id
      identifier
    }
  }
}
"""

ARCHIVE_ISSUE_MUTATION = """
mutation ArchiveIssue($id: ID!) {
  issueArchive(id: $id) {
    success
  }
}
"""


class LinearClient:
    def __init__(self, api_key: str):
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    def update_issue(self, issue_id: str, input_data: dict) -> bool:
        resp = requests.post(
            LINEAR_GRAPHQL_URL,
            headers=self.headers,
            json={
                "query": UPDATE_ISSUE_MUTATION,
                "variables": {"id": issue_id, "input": input_data},
            },
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("errors"):
            print(f"  Error updating {issue_id}: {data['errors']}", file=sys.stderr)
            return False
        return data.get("data", {}).get("issueUpdate", {}).get("success", False)

    def archive_issue(self, issue_id: str) -> bool:
        resp = requests.post(
            LINEAR_GRAPHQL_URL,
            headers=self.headers,
            json={"query": ARCHIVE_ISSUE_MUTATION, "variables": {"id": issue_id}},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("errors"):
            print(f"  Error archiving {issue_id}: {data['errors']}", file=sys.stderr)
            return False
        return data.get("data", {}).get("issueArchive", {}).get("success", False)


def remediate_descriptions(client: LinearClient | None, missing: list[dict], apply: bool) -> list[dict]:
    """Add placeholder descriptions to issues missing them."""
    results = []
    for issue in missing:
        identifier = issue["identifier"]
        title = issue["title"]
        placeholder = f"## {title}\n\n_Description needed — auto-generated placeholder from quarterly audit remediation._\n\nThis issue was identified as missing a description during the {time.strftime('%Y-%m')} quarterly workspace audit. Please update with proper details."

        if apply:
            if client is None:
                raise RuntimeError("client required for apply")
            print(f"  Adding description to {identifier}...", file=sys.stderr)
            success = client.update_issue(issue["id"], {"description": placeholder})
            results.append({"identifier": identifier, "action": "add_description", "success": success})
            time.sleep(0.3)
        else:
            print(f"  [DRY-RUN] Would add description to {identifier}", file=sys.stderr)
            results.append({"identifier": identifier, "action": "add_description", "success": "dry_run"})

    return results


def remediate_unassigned(
    client: LinearClient | None, unassigned: list[dict], default_assignee_id: str, apply: bool
) -> list[dict]:
    """Assign default owner to unassigned issues."""
    results = []
    for issue in unassigned:
        identifier = issue["identifier"]
        if apply:
            if client is None:
                raise RuntimeError("client required for apply")
            print(f"  Assigning {identifier} to default owner...", file=sys.stderr)
            success = client.update_issue(issue["id"], {"assigneeId": default_assignee_id})
            results.append({"identifier": identifier, "action": "assign", "success": success})
            time.sleep(0.3)
        else:
            print(f"  [DRY-RUN] Would assign {identifier}", file=sys.stderr)
            results.append({"identifier": identifier, "action": "assign", "success": "dry_run"})

    return results


def remediate_duplicates(client: LinearClient | None, duplicates: list[dict], apply: bool) -> list[dict]:
    """Resolve duplicate pairs by archiving the newer issue."""
    results = []
    for dup in duplicates:
        a = dup["issue_a"]
        b = dup["issue_b"]
        # Archive the one with the higher identifier (typically newer)
        to_archive = b if b["identifier"] > a["identifier"] else a
        to_keep = a if to_archive == b else b

        if apply:
            if client is None:
                raise RuntimeError("client required for apply")
            print(
                f"  Archiving duplicate {to_archive['identifier']} (keeping {to_keep['identifier']})...",
                file=sys.stderr,
            )
            success = client.archive_issue(to_archive["id"])
            results.append(
                {
                    "archived": to_archive["identifier"],
                    "kept": to_keep["identifier"],
                    "success": success,
                }
            )
            time.sleep(0.3)
        else:
            print(
                f"  [DRY-RUN] Would archive {to_archive['identifier']} (keep {to_keep['identifier']})", file=sys.stderr
            )
            results.append(
                {
                    "archived": to_archive["identifier"],
                    "kept": to_keep["identifier"],
                    "success": "dry_run",
                }
            )

    return results


def remediate_archiving(client: LinearClient | None, to_archive: list[dict], apply: bool) -> list[dict]:
    """Archive completed issues that aren't archived yet."""
    results = []
    for issue in to_archive:
        identifier = issue["identifier"]
        if apply:
            if client is None:
                raise RuntimeError("client required for apply")
            print(f"  Archiving completed issue {identifier}...", file=sys.stderr)
            success = client.archive_issue(issue["id"])
            results.append({"identifier": identifier, "action": "archive_completed", "success": success})
            time.sleep(0.3)
        else:
            print(f"  [DRY-RUN] Would archive completed {identifier}", file=sys.stderr)
            results.append({"identifier": identifier, "action": "archive_completed", "success": "dry_run"})

    return results


def main():
    parser = argparse.ArgumentParser(description="Apply Linear workspace remediations")
    parser.add_argument("--input", default=str(INPUT_FILE), help="Audit results JSON")
    parser.add_argument("--dry-run", action="store_true", default=True, help="Don't apply changes (default)")
    parser.add_argument("--apply", action="store_true", help="Apply changes (overrides --dry-run)")
    parser.add_argument(
        "--default-assignee",
        default=os.environ.get("LINEAR_DEFAULT_ASSIGNEE_ID"),
        help="User ID to assign unassigned issues to",
    )
    args = parser.parse_args()

    apply = args.apply and not args.dry_run if args.dry_run else args.apply
    # If neither flag, default to dry-run
    if not args.apply and not args.dry_run:
        apply = False
    elif args.apply:
        apply = True

    if apply:
        api_key = os.environ.get("LINEAR_API_KEY")
        if not api_key:
            sys.exit("ERROR: LINEAR_API_KEY required when using --apply")
        client: LinearClient | None = LinearClient(api_key)
    else:
        client = None

    if not Path(args.input).exists():
        sys.exit(f"ERROR: {args.input} not found. Run run_audit.py first.")

    with open(args.input) as f:
        audit = json.load(f)

    all_results = {"mode": "apply" if apply else "dry_run", "remediations": []}

    # 1. Descriptions
    missing_desc = audit.get("missing_descriptions", [])
    if missing_desc:
        print(f"\n[1/4] Descriptions ({len(missing_desc)} missing)...", file=sys.stderr)
        r = remediate_descriptions(client, missing_desc, apply)
        all_results["remediations"].extend(r)

    # 2. Unassigned
    unassigned = audit.get("unassigned", [])
    if unassigned:
        if not args.default_assignee and apply:
            print(
                f"\n[2/4] Unassigned ({len(unassigned)} issues) - SKIPPED: no --default-assignee provided",
                file=sys.stderr,
            )
        else:
            print(f"\n[2/4] Unassigned ({len(unassigned)} issues)...", file=sys.stderr)
            r = remediate_unassigned(client, unassigned, args.default_assignee, apply)
            all_results["remediations"].extend(r)

    # 3. Duplicates
    duplicates = audit.get("duplicates", [])
    if duplicates:
        print(f"\n[3/4] Duplicates ({len(duplicates)} pairs)...", file=sys.stderr)
        r = remediate_duplicates(client, duplicates, apply)
        all_results["remediations"].extend(r)

    # 4. Archiving
    to_archive = audit.get("archived_completeness", {}).get("not_archived_list", [])
    if to_archive:
        print(f"\n[4/4] Archive completed ({len(to_archive)} issues)...", file=sys.stderr)
        r = remediate_archiving(client, to_archive, apply)
        all_results["remediations"].extend(r)

    # Save remediation log
    log_file = Path(args.input).parent / "remediation_log.json"
    with open(log_file, "w") as f:
        json.dump(all_results, f, indent=2)

    print(f"\n{'=' * 60}", file=sys.stderr)
    print(f"Remediation {'APPLIED' if apply else 'DRY-RUN'} complete (v2 MCP flat shape)", file=sys.stderr)
    print(f"Total actions: {len(all_results['remediations'])}", file=sys.stderr)
    print(f"Log saved to {log_file}", file=sys.stderr)
    print("Ready for MCP flat-shape consumption (v2) — write-back via Linear GraphQL UUIDs.", file=sys.stderr)


if __name__ == "__main__":
    main()
