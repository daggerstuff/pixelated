#!/usr/bin/env python3
"""
Sync from Linear (Source of Truth) to:
  - GitHub Issues
  - Jira Issues
  - Asana Tasks
  - GitLab Issues

Ensures NO duplicates are created (matching by ID and title similarity).
Updates existing issues to keep them in sync.
Cleans up target issues pointing to deleted/non-existent Linear IDs.
Ensures the pixelated-sync metadata is present to prevent feedback loops.
"""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.parse
import urllib.request

from dotenv import load_dotenv

load_dotenv()

# Add the repository root to Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from scripts.task_sync.provider_bridge import (  # noqa: E402
    apply_asana_action,
    apply_github_action,
    apply_jira_action,
    export_asana_tasks,
    export_github_issues,
    export_jira_issues,
)

LINEAR_API = "https://api.linear.app/graphql"
LINEAR_TOKEN = os.environ.get("LINEAR_API_KEY") or os.environ.get("LINEAR_TOKEN")
REPO = "daggerstuff/pixelated"

if REPO and "/" in REPO:
    owner, repo_name = REPO.split("/", 1)
    if "GITHUB_OWNER" not in os.environ:
        os.environ["GITHUB_OWNER"] = owner
    if "GITHUB_REPO" not in os.environ:
        os.environ["GITHUB_REPO"] = repo_name
SYNC_BLOCK_START = "<!-- pixelated-sync"
SYNC_BLOCK_END = "-->"

# ---------------------------------------------------------------------------
# Utility Functions
# ---------------------------------------------------------------------------


def slugify(title: str) -> str:
    t = title.lower()
    t = re.sub(r"[^a-z0-9\s-]", "", t)
    t = re.sub(r"[\s-]+", "-", t)
    return t.strip("-")


def clean_title(title: str) -> str:
    if not title:
        return ""
    t = title.lower()
    t = re.sub(r"[^a-z0-9\s]", "", t)
    return " ".join(t.split())


def extract_sync_metadata(body: str) -> dict[str, str]:
    if not body or SYNC_BLOCK_START not in body:
        return {}
    _, _, after = body.partition(SYNC_BLOCK_START)
    block_text, _, _ = after.partition(SYNC_BLOCK_END)
    metadata = {}
    for line in block_text.splitlines():
        match = re.match(r"(?im)^\s*(?P<key>[a-z0-9_-]+)\s*:\s*(?P<value>.+?)\s*$", line)
        if match:
            metadata[match.group("key").strip().lower()] = match.group("value").strip()
    return metadata


def task_body_without_sync_block(body: str) -> str:
    if not body or SYNC_BLOCK_START not in body:
        return (body or "").strip()
    lines = []
    in_block = False
    for line in body.splitlines():
        stripped = line.strip()
        if stripped.startswith(SYNC_BLOCK_START):
            in_block = True
            continue
        if in_block and stripped == SYNC_BLOCK_END:
            in_block = False
            continue
        if not in_block:
            lines.append(line)
    return "\n".join(lines).strip()


def normalize_linear_state(state_name: str) -> str:
    s = state_name.lower()
    if "backlog" in s:
        return "backlog"
    if "triage" in s:
        return "triage"
    if "progress" in s or "active" in s:
        return "in_progress"
    if "review" in s:
        return "review"
    if s in ("done", "closed", "canceled", "cancelled", "duplicate"):
        return "closed"
    return "open"


def get_priority_label(priority: int) -> str:
    return {0: "urgent", 1: "high", 2: "medium", 3: "low", 4: "none"}.get(priority, "none")


def get_linear_labels(issue: dict) -> list[str]:
    """Extract label names from a Linear issue node."""
    label_nodes = issue.get("labels", {}).get("nodes") or []
    return [str(n.get("name") or "").strip() for n in label_nodes if n.get("name")]


# ---------------------------------------------------------------------------
# Linear Client
# ---------------------------------------------------------------------------


def _gql(query: str, variables: dict | None = None) -> dict:
    payload = json.dumps({"query": query, "variables": variables or {}}).encode()
    req = urllib.request.Request(
        LINEAR_API,
        data=payload,
        headers={"Authorization": LINEAR_TOKEN or "", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())


def fetch_all_linear_issues() -> list[dict]:
    print("Fetching all live Linear issues (unfiltered)...")
    issues = []
    after = None
    while True:
        data = _gql(
            """
query($after: String) {
  issues(first: 250, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id
      identifier
      title
      description
      priority
      url
      labels { nodes { name } }
      state { name }
    }
  }
}""",
            {"after": after},
        )
        nodes = data["data"]["issues"]["nodes"]
        page_info = data["data"]["issues"]["pageInfo"]
        issues.extend(nodes)
        if not page_info["hasNextPage"]:
            break
        after = page_info["endCursor"]
    print(f"  → Found {len(issues)} active Linear issues.")
    return issues


# ---------------------------------------------------------------------------
# GitLab Provider
# ---------------------------------------------------------------------------


def fetch_gitlab_issues() -> list[dict]:
    token = os.environ.get("GITLAB_TOKEN")
    if not token:
        print("Warning: GITLAB_TOKEN not set. Skipping GitLab export.")
        return []

    print("Fetching GitLab issues...")
    headers = {"PRIVATE-TOKEN": token}
    issues = []
    page = 1
    while True:
        url = f"https://gitlab.com/api/v4/projects/pixelgroupies%2Fpixelated/issues?state=all&per_page=100&page={page}"
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read())
                if not data:
                    break
                issues.extend(data)
                if len(data) < 100:
                    break
                page += 1
        except Exception as e:
            print(f"Error fetching GitLab issues: {e}")
            break
    print(f"  → Found {len(issues)} GitLab issues.")
    return issues


def apply_gitlab_action(action: dict) -> str | None:
    token = os.environ.get("GITLAB_TOKEN")
    if not token:
        return None

    headers = {"PRIVATE-TOKEN": token, "Content-Type": "application/json"}
    action_type = action.get("action")
    target_id = action.get("target_id")  # Issue iid

    payload = {
        "title": action.get("title"),
        "description": action.get("body"),
    }

    if action.get("status") == "closed":
        payload["state_event"] = "close"
    else:
        payload["state_event"] = "reopen"

    if action_type == "create":
        url = "https://gitlab.com/api/v4/projects/pixelgroupies%2Fpixelated/issues"
        method = "POST"
    else:
        url = f"https://gitlab.com/api/v4/projects/pixelgroupies%2Fpixelated/issues/{target_id}"
        method = "PUT"

    try:
        req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method=method)
        with urllib.request.urlopen(req, timeout=30) as resp:
            res_data = json.loads(resp.read())
            return str(res_data.get("iid"))
    except Exception as e:
        print(f"Error applying GitLab action: {e}")
        return None


# ---------------------------------------------------------------------------
# Sync Logic
# ---------------------------------------------------------------------------


def build_sync_metadata_block(
    sync_key: str, status: str, linear_issue: dict, provider_ids: dict[str, str]
) -> str:
    lines = [
        SYNC_BLOCK_START,
        f"key: {sync_key}",
        f"status: {status}",
        "source-provider: linear",
        f"source-id: {linear_issue['id']}",
        f"linear-url: {linear_issue['url']}",
        f"linear-id: {linear_issue['identifier']}",
    ]
    # Add all provider mappings
    all_mappings = dict(provider_ids)
    all_mappings["linear"] = linear_issue["id"]
    for prov, p_id in sorted(all_mappings.items()):
        if p_id:
            lines.append(f"{prov}: {p_id}")
    lines.append(SYNC_BLOCK_END)
    return "\n".join(lines)


def main():  # noqa: PLR0912, PLR0915
    apply_mode = "--apply" in sys.argv
    print("=== Syncing from Linear (Source of Truth) ===")
    print(f"Mode: {'APPLY' if apply_mode else 'DRY RUN'}\n")

    if not LINEAR_TOKEN:
        print("ERROR: LINEAR_API_KEY or LINEAR_TOKEN not set.", file=sys.stderr)
        sys.exit(1)

    linear_issues = fetch_all_linear_issues()
    linear_by_id = {li["id"]: li for li in linear_issues}

    # -----------------------------------------------------------------------
    # 1. Fetch from other platforms
    # -----------------------------------------------------------------------
    providers_data = {}

    # GitHub
    try:
        providers_data["github"] = export_github_issues()
    except Exception as e:
        print(f"Warning: GitHub export failed: {e}")
        providers_data["github"] = []

    # Jira
    try:
        providers_data["jira"] = export_jira_issues()
    except Exception as e:
        print(f"Warning: Jira export failed: {e}")
        providers_data["jira"] = []

    # Asana
    try:
        providers_data["asana"] = export_asana_tasks()
    except Exception as e:
        print(f"Warning: Asana export failed: {e}")
        providers_data["asana"] = []

    # GitLab
    providers_data["gitlab"] = fetch_gitlab_issues()

    # -----------------------------------------------------------------------
    # 2. Reconcile and match
    # -----------------------------------------------------------------------
    print("\nReconciling mappings...")

    # Target maps: provider -> list of normalized issues
    # Normalized structure: { id, target_id (number/key/gid), title, body, state, metadata }
    target_issues = {}
    for prov, raw_list in providers_data.items():
        normalized_list = []
        for raw in raw_list:
            if prov == "github":
                body = raw.get("body") or ""
                meta = extract_sync_metadata(body)
                normalized_list.append(
                    {
                        "target_id": str(raw["number"]),
                        "title": raw["title"],
                        "body": body,
                        "state": raw["state"],
                        "metadata": meta,
                    }
                )
            elif prov == "jira":
                desc = raw.get("fields", {}).get("description", "")
                if isinstance(desc, dict):
                    # Convert Jira ADF structure back to text if needed, but provider_bridge exports text or we extract
                    desc_text = ""
                    # If ADF, we extract text content
                    content = desc.get("content", [])
                    paragraphs = []
                    for node in content:
                        text_nodes = [t.get("text", "") for t in node.get("content", []) if t.get("type") == "text"]
                        paragraphs.append("".join(text_nodes))
                    desc_text = "\n\n".join(paragraphs)
                else:
                    desc_text = str(desc or "")
                meta = extract_sync_metadata(desc_text)
                normalized_list.append(
                    {
                        "target_id": raw["key"],
                        "title": raw.get("fields", {}).get("summary", ""),
                        "body": desc_text,
                        "state": raw.get("fields", {}).get("status", {}).get("name", ""),
                        "metadata": meta,
                    }
                )
            elif prov == "asana":
                notes = raw.get("notes") or ""
                meta = extract_sync_metadata(notes)
                normalized_list.append(
                    {
                        "target_id": raw["gid"],
                        "title": raw["name"],
                        "body": notes,
                        "state": "closed" if raw.get("completed") else "open",
                        "metadata": meta,
                    }
                )
            elif prov == "gitlab":
                desc = raw.get("description") or ""
                meta = extract_sync_metadata(desc)
                normalized_list.append(
                    {
                        "target_id": str(raw["iid"]),
                        "title": raw["title"],
                        "body": desc,
                        "state": raw["state"],
                        "metadata": meta,
                    }
                )
        target_issues[prov] = normalized_list

    # Match each Linear issue to target issues
    actions = []

    for li in linear_issues:
        lid = li["id"]
        li_title = li["title"]
        li_clean = clean_title(li_title)
        li_state = normalize_linear_state(li["state"]["name"])
        li_priority = get_priority_label(li["priority"])
        li_labels = get_linear_labels(li)

        # Build base sync metadata fields
        sync_key = slugify(li_title)

        # Find matches on each platform
        provider_matches = {}
        for prov, normalized_list in target_issues.items():
            match = None
            # A. Match by metadata ID
            for t in normalized_list:
                if t["metadata"].get("linear") == lid:
                    match = t
                    break
            # B. Match by title similarity if no metadata ID mapping exists
            if not match:
                for t in normalized_list:
                    # Only match by title if it doesn't already point to another Linear ID
                    if not t["metadata"].get("linear") and clean_title(t["title"]) == li_clean and len(li_clean) > 5:
                        match = t
                        break
            if match:
                provider_matches[prov] = match

        # Build known provider IDs map
        provider_ids = {}
        for prov, match in provider_matches.items():
            provider_ids[prov] = match["target_id"]

        # Generate action for each provider
        for prov in target_issues:
            # Check if this provider has credentials / is enabled
            if prov == "gitlab" and not os.environ.get("GITLAB_TOKEN"):
                continue
            if prov == "asana" and not any(
                os.environ.get(k) for k in ["ASANA_API_KEY", "ASANA_TOKEN", "ASANA_ACCESS_TOKEN", "ASANA_PAT"]
            ):
                continue

            match = provider_matches.get(prov)

            # Format the body
            clean_body = task_body_without_sync_block(li["description"] or "")
            metadata_block = build_sync_metadata_block(sync_key, li_state, li, provider_ids)
            body_with_meta = f"{clean_body}\n\n{metadata_block}"

            action = None
            if not match:
                action = {
                    "provider": prov,
                    "action": "create",
                    "sync_key": sync_key,
                    "title": li_title,
                    "body": body_with_meta,
                    "status": li_state,
                    "priority_label": li_priority,
                    "labels": li_labels,
                    "linear_id": lid,
                }
            else:
                # Check if we need to update
                needs_update = False

                # Check title difference
                if match["title"].strip() != li_title.strip():
                    needs_update = True

                # Check body difference (ignoring whitespaces/newlines)
                match_clean_body = task_body_without_sync_block(match["body"])
                if clean_body.strip() != match_clean_body.strip():
                    needs_update = True

                # Check state difference
                match_status = normalize_linear_state(match["state"])
                if match_status != li_state:
                    needs_update = True

                # Check metadata block completeness
                if not match["metadata"].get("linear") or match["metadata"].get("key") != sync_key:
                    needs_update = True

                if needs_update:
                    action = {
                        "provider": prov,
                        "action": "update",
                        "target_id": match["target_id"],
                        "sync_key": sync_key,
                        "title": li_title,
                        "body": body_with_meta,
                        "status": li_state,
                        "priority_label": li_priority,
                        "labels": li_labels,
                        "linear_id": lid,
                    }
            if action:
                actions.append(action)

    # -----------------------------------------------------------------------
    # 3. Handle Orphans (Target issues pointing to non-existent/deleted Linear IDs)
    # -----------------------------------------------------------------------
    for prov, normalized_list in target_issues.items():
        if prov == "gitlab" and not os.environ.get("GITLAB_TOKEN"):
            continue
        if prov == "asana" and not any(
            os.environ.get(k) for k in ["ASANA_API_KEY", "ASANA_TOKEN", "ASANA_ACCESS_TOKEN", "ASANA_PAT"]
        ):
            continue

        for t in normalized_list:
            mapped_lid = t["metadata"].get("linear")
            if (
                mapped_lid
                and mapped_lid not in linear_by_id
                and t["state"].lower() not in ("closed", "done", "canceled")
            ):
                actions.append(
                    {
                        "provider": prov,
                        "action": "update",
                        "target_id": t["target_id"],
                        "sync_key": t["metadata"].get("key", slugify(t["title"])),
                        "title": t["title"],
                        "body": t["body"],
                        "status": "closed",
                        "priority_label": "none",
                        "labels": [],
                        "linear_id": mapped_lid,
                        "is_orphan": True,
                    }
                )

    # Summary
    print("\nSync plan summary:")
    creates = [a for a in actions if a["action"] == "create"]
    updates = [a for a in actions if a["action"] == "update" and not a.get("is_orphan")]
    orphans = [a for a in actions if a.get("is_orphan")]

    print(f"  To CREATE: {len(creates)}")
    print(f"  To UPDATE: {len(updates)}")
    print(f"  To CLOSE (stale orphans): {len(orphans)}")

    # Detail by provider
    for prov in target_issues:
        prov_actions = [a for a in actions if a["provider"] == prov]
        p_creates = len([a for a in prov_actions if a["action"] == "create"])
        p_updates = len([a for a in prov_actions if a["action"] == "update" and not a.get("is_orphan")])
        p_orphans = len([a for a in prov_actions if a.get("is_orphan")])
        print(f"    - {prov.upper()}: {p_creates} creates, {p_updates} updates, {p_orphans} closes")

    if not apply_mode:
        print("\nDry run complete. Use --apply to execute the sync.")
        return

    # -----------------------------------------------------------------------
    # 4. Execute Actions
    # -----------------------------------------------------------------------
    print("\nExecuting sync...")
    success_count = fail_count = 0

    for a in actions:
        prov = a["provider"]
        act = a["action"]
        sync_key = a["sync_key"]

        label_orphan = " [Orphan]" if a.get("is_orphan") else ""
        print(f"  [{prov.upper()}] Running {act}{label_orphan} for '{sync_key}'...", end="", flush=True)

        ok = False
        try:
            if prov == "github":
                res = apply_github_action(a)
                ok = bool(res.get("id") or res.get("number"))
            elif prov == "jira":
                res = apply_jira_action(a)
                ok = bool(res.get("key") or res.get("id"))
            elif prov == "asana":
                res = apply_asana_action(a)
                ok = bool(res.get("gid"))
            elif prov == "gitlab":
                res = apply_gitlab_action(a)
                ok = bool(res)
        except Exception as e:
            print(f" Exception: {e}")
            fail_count += 1
            continue

        if ok:
            print(" SUCCESS")
            success_count += 1
        else:
            print(" FAILED")
            fail_count += 1

    print(f"\nSync complete. Success: {success_count}, Failed: {fail_count}")


if __name__ == "__main__":
    main()
