#!/usr/bin/env python3
"""
refresh_dashboard.py — Live dashboard generator for Enterprise Readiness Program.

Fetches all issues from the Linear project, computes completion stats per
workstream, and regenerates docs/linear-audit/dashboard.md with live data.

Usage:
    export LINEAR_API_KEY=lin_api_...
    python3 refresh_dashboard.py
"""

import json
import os
import sys
import urllib.request
from datetime import datetime, timezone

# ── Config ────────────────────────────────────────────────────────────────────

API_KEY = os.environ.get("LINEAR_API_KEY", "")
if not API_KEY:
    print("ERROR: LINEAR_API_KEY environment variable must be set.", file=sys.stderr)
    sys.exit(1)

API_URL = "https://api.linear.app/graphql"
PROJECT_ID = "29c133a2-9195-42d3-b53e-31154d47ea7d"
CUSTOM_VIEW_URL = "https://linear.app/pixelated/view/cb20ccc27a23"
DASHBOARD_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dashboard.md")

# Workstream definitions keyed by parent issue identifier.
# Each entry: (short_name, priority, icon, priority_emoji)
WORKSTREAMS = {
    "PIX-4126": ("Penetration Testing", 1, "\U0001f512", "\U0001f534"),       # Urgent
    "PIX-4125": ("Disaster Recovery", 2, "\U0001f504", "\U0001f7e1"),         # High
    "PIX-4127": ("SLA/SLO Definitions", 2, "\U0001f4ca", "\U0001f7e1"),      # High
    "PIX-4129": ("Vendor Risk Assessment", 2, "\U0001f4cb", "\U0001f7e1"),   # High
    "PIX-4130": ("SOC2/HIPAA Readiness", 2, "\u2705", "\U0001f7e1"),         # High
    "PIX-4128": ("Chaos Engineering", 3, "\U0001f9ea", "\U0001f7e2"),        # Medium
}

PRIORITY_LABELS = {1: "Urgent", 2: "High", 3: "Medium"}

# State types considered "complete/done"
DONE_STATE_TYPES = {"completed"}

# State types considered "in progress"
IN_PROGRESS_STATE_TYPES = {"started", "review"}


# ── API helpers ───────────────────────────────────────────────────────────────

def gql(query: str) -> dict | None:
    """Execute a GraphQL query against the Linear API with retry."""
    for attempt in range(3):
        req = urllib.request.Request(
            API_URL,
            data=json.dumps({"query": query}).encode(),
            headers={"Content-Type": "application/json", "Authorization": API_KEY},
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read())
                if "errors" in result:
                    print(f"  API error: {result['errors']}", file=sys.stderr)
                    return None
                return result
        except Exception as e:
            if attempt < 2:
                print(f"  Retry {attempt + 1} after: {e}", file=sys.stderr)
            else:
                print(f"  Failed after 3 retries: {e}", file=sys.stderr)
                return None


def fetch_project_issues() -> list[dict]:
    """Fetch all issues in the Enterprise Readiness Program project."""
    all_issues = []
    cursor = None
    page = 0

    while True:
        page += 1
        after = f', after: "{cursor}"' if cursor else ""
        query = f"""{{
            issues(first: 50{after}, filter: {{
                project: {{ id: {{ eq: "{PROJECT_ID}" }} }}
            }}) {{
                nodes {{
                    id identifier title priority estimate
                    state {{ id name type }}
                    parent {{ id identifier title }}
                    completedAt
                }}
                pageInfo {{ hasNextPage endCursor }}
            }}
        }}"""
        result = gql(query)
        if not result or "data" not in result:
            print(f"  Error on page {page}", file=sys.stderr)
            break

        nodes = result["data"]["issues"]["nodes"]
        page_info = result["data"]["issues"]["pageInfo"]
        all_issues.extend(nodes)

        if not page_info["hasNextPage"]:
            break
        cursor = page_info["endCursor"]

    return all_issues


# ── Markdown generation ───────────────────────────────────────────────────────

def progress_bar(completed: int, total: int, width: int = 10) -> str:
    """Generate a Unicode progress bar like ████░░░░░░."""
    if total == 0:
        return "\u2591" * width + " 0%"
    filled = round(completed / total * width)
    pct = round(completed / total * 100)
    bar = "\u2588" * filled + "\u2591" * (width - filled)
    return f"{bar} {pct}%"


def render_workstream_table(ws_entries: list) -> str:
    """Render the overview progress table."""
    rows = []
    for ws in ws_entries:
        rows.append(
            f"| {ws['priority_emoji']} {ws['priority_label']} "
            f"| {ws['icon']} {ws['name']} "
            f"| {ws['progress_bar']} "
            f"| {ws['done_count']}/{ws['total']} "
            f"| {ws['done_effort']}/{ws['total_effort']} pts |"
        )
    return "\n".join(rows)


def render_detail_section(ws: dict, sub_issues: list) -> str:
    """Render the detailed sub-issue table for one workstream."""
    # Summary line
    in_prog = ws["in_progress_count"]
    triage = ws["triage_count"]
    other = ws["total"] - ws["done_count"] - in_prog - triage
    parts = [f"**Sub-issues:** {ws['total']}"]
    if ws["done_count"]:
        parts.append(f"**Done:** {ws['done_count']}")
    if in_prog:
        parts.append(f"**In Progress:** {in_prog}")
    if triage:
        parts.append(f"**Triage:** {triage}")
    if other:
        parts.append(f"**Other:** {other}")
    summary = " | ".join(parts)

    lines = [
        f"### {ws['icon']} {ws['name']}",
        "",
        f"{summary}  ",
        f"**Est. Effort:** {ws['done_effort']}/{ws['total_effort']} pts completed",
        "",
        "| Issue | Title | Status | Priority | Estimate |",
        "|-------|-------|--------|----------|----------|",
    ]

    for si in sorted(sub_issues, key=lambda x: x.get("identifier", "")):
        ident = si["identifier"]
        title = si["title"]
        state_type = (si.get("state") or {}).get("type", "triage")
        state_name = (si.get("state") or {}).get("name", "?")
        priority = si.get("priority", 0)
        estimate = si.get("estimate") or 0

        # Status emoji
        if state_type in DONE_STATE_TYPES:
            status_emoji = "\u2705"
        elif state_type in IN_PROGRESS_STATE_TYPES:
            status_emoji = "\U0001f3c3"
        elif state_type == "canceled":
            status_emoji = "\u274c"
        else:
            status_emoji = "\u23f3"

        # Priority emoji
        pri_emoji = {1: "\U0001f534", 2: "\U0001f7e1", 3: "\U0001f7e2", 0: "\u26ab"}.get(priority, "\u26ab")

        # Truncate title to fit table
        title_display = title[:65]

        lines.append(
            f"| {ident} | {title_display} "
            f"| {status_emoji} {state_name} "
            f"| {pri_emoji} | {estimate} |"
        )

    return "\n".join(lines)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60, file=sys.stderr)
    print("REFRESH DASHBOARD: Enterprise Readiness Program", file=sys.stderr)
    print("=" * 60, file=sys.stderr)

    # 1. Fetch data
    print("Fetching issues...", file=sys.stderr)
    all_issues = fetch_project_issues()
    print(f"  {len(all_issues)} issues found", file=sys.stderr)

    if not all_issues:
        print("ERROR: No issues found in project!", file=sys.stderr)
        sys.exit(1)

    # 2. Build parent → sub-issue map
    sub_issues_by_parent = {}  # parent id -> [sub-issues]
    parent_map = {}  # parent identifier -> parent issue

    for issue in all_issues:
        parent = issue.get("parent")
        if parent and parent.get("id"):
            pid = parent["id"]
            if pid not in sub_issues_by_parent:
                sub_issues_by_parent[pid] = []
            sub_issues_by_parent[pid].append(issue)
        else:
            # This is a parent-level issue
            parent_map[issue["identifier"]] = issue

    # 3. Compute workstream stats
    ws_entries = []
    all_detail_sections = []

    total_done = 0
    total_sub_issues = 0
    total_done_effort = 0
    total_effort = 0

    for ws_ident in ["PIX-4126", "PIX-4125", "PIX-4127", "PIX-4129", "PIX-4130", "PIX-4128"]:
        if ws_ident not in WORKSTREAMS:
            continue

        name, priority, icon, pri_emoji = WORKSTREAMS[ws_ident]
        parent = parent_map.get(ws_ident)
        if not parent:
            print(f"  ⚠️ Parent {ws_ident} not found, skipping", file=sys.stderr)
            continue

        kids = sub_issues_by_parent.get(parent["id"], [])

        done_count = sum(
            1 for k in kids
            if (k.get("state") or {}).get("type") in DONE_STATE_TYPES
        )
        in_progress_count = sum(
            1 for k in kids
            if (k.get("state") or {}).get("type") in IN_PROGRESS_STATE_TYPES
        )
        triage_count = sum(
            1 for k in kids
            if (k.get("state") or {}).get("type") == "triage"
        )
        total = len(kids)

        done_effort = sum(
            (k.get("estimate") or 0) for k in kids
            if (k.get("state") or {}).get("type") in DONE_STATE_TYPES
        )
        total_effort_ws = sum((k.get("estimate") or 0) for k in kids)

        total_done += done_count
        total_sub_issues += total
        total_done_effort += done_effort
        total_effort += total_effort_ws

        ws_entry = {
            "ident": ws_ident,
            "name": name,
            "priority": priority,
            "priority_label": PRIORITY_LABELS.get(priority, "Unknown"),
            "priority_emoji": pri_emoji,
            "icon": icon,
            "total": total,
            "done_count": done_count,
            "in_progress_count": in_progress_count,
            "triage_count": triage_count,
            "done_effort": done_effort,
            "total_effort": total_effort_ws,
            "progress_bar": progress_bar(done_count, total),
        }
        ws_entries.append(ws_entry)

        detail = render_detail_section(ws_entry, kids)
        all_detail_sections.append(detail)

    # 4. Compute parent-level (non-sub) status
    # PIX-4131 is the EPIC - check its state
    epic = parent_map.get("PIX-4131")
    epic_status = (epic.get("state") or {}).get("name", "Triage") if epic else "?"

    # PIX-4158 is the quarterly audit tracker
    audit_issue = [i for i in all_issues if i["identifier"] == "PIX-4158"]
    audit_status = (audit_issue[0].get("state") or {}).get("name", "Triage") if audit_issue else "?"

    # 5. Generate dashboard
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    # Determine if there's a status banner based on whether any work has started
    if total_done == 0 and sum(ws["in_progress_count"] for ws in ws_entries) == 0:
        banner = (
            "> **\U0001f504 All sub-issues are in Triage \u2014 execution has not yet begun.**\n"
            "> The 0% completion across all workstreams is accurate for this starting state. "
            "Work begins with PIX-4126 (Penetration Testing \u2014 Urgent priority) as the first priority sprint.\n"
        )
    else:
        banner = ""

    overview_table = render_workstream_table(ws_entries)

    detail_sections = "\n\n".join(all_detail_sections)

    dashboard = f"""# Enterprise Readiness Program \u2014 Dashboard

**Generated:** {now}  
**Project:** Enterprise Readiness Program  
**Linear View:** [\U0001f517 Workstream Dashboard]({CUSTOM_VIEW_URL})

{banner}---

## Overview

| Metric | Value |
|--------|-------|
| Total Issues | {len(all_issues)} |
| Workstreams | {len(ws_entries)} |
| Completed Sub-Issues | {total_done}/{total_sub_issues} |
| Total Estimated Effort | {total_effort} pts (completed: {total_done_effort} pts) |

---

## Workstream Progress

| Priority | Workstream | Progress | Completed | Est. Effort |
|----------|------------|----------|-----------|-------------|
{overview_table}

---

## Workstream Details

{detail_sections}

---

## EPIC: Enterprise Readiness

**EPIC: Enterprise Readiness \u2014 Close All Enterprise Gaps** \u2014 Status: {epic_status}

Tracks the overall closure of all 6 enterprise gaps.

---

## Quarterly Audit Tracker

**Quarterly Workspace Audit \u2014 Linear Hygiene Check** \u2014 Status: {audit_status}

Next scheduled audit: **2026-10-29**

---

## Navigation

- **Linear Project:** Enterprise Readiness Program (`PIX` team)
- **Linear Custom View:** [\U0001f517 Workstream Dashboard]({CUSTOM_VIEW_URL})
- **Initiative:** [Enterprise Readiness](https://linear.app/pixelated/initiative/enterprise-readiness)
- **Initial Audit Report:** [./linear_audit.md](./linear_audit.md)
- **Final Snapshot:** [./linear_audit_final.md](./linear_audit_final.md)
- **Scripts:** `./fetch_issues.py`, `./run_audit.py`, `./remediate.py`, `./refresh_dashboard.py`

---

*Dashboard auto-generated by `refresh_dashboard.py`. Refresh by re-running:*
*`python3 docs/linear-audit/refresh_dashboard.py`*
"""

    # 6. Write to file
    with open(DASHBOARD_PATH, "w") as f:
        f.write(dashboard)

    print(f"\n\U0001f4be Dashboard written to {DASHBOARD_PATH}", file=sys.stderr)
    print(f"   {total_done}/{total_sub_issues} sub-issues completed ({total_done_effort}/{total_effort} pts)", file=sys.stderr)

    # Summary
    print("\n=== WORKSTREAM SUMMARY ===", file=sys.stderr)
    for ws in ws_entries:
        bar = ws["progress_bar"]
        print(f"  {ws['icon']} {ws['name']:25s} {bar:15s}  {ws['done_count']:2d}/{ws['total']:2d}  ({ws['done_effort']}/{ws['total_effort']} pts)", file=sys.stderr)


if __name__ == "__main__":
    main()
