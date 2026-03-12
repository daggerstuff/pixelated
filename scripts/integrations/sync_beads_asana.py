# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "requests",
# ]
# ///
"""
Sync Beads issues to Asana conditionally and bi-directionally.
Usage: uv run scripts/sync_beads_asana.py

This script reads all issues from the local Beads database and synchronizes
them into Asana, and reads tasks from Asana to bring them back into Beads.
"""

import json
import logging
import os
import subprocess
import sys
from datetime import datetime

import requests

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

ASANA_PAT = os.getenv("ASANA_PAT")
if not ASANA_PAT:
    logging.error("ASANA_PAT environment variable is missing. Cannot sync to Asana.")
    sys.exit(1)

HEADERS = {
    "Authorization": f"Bearer {ASANA_PAT}",
    "Accept": "application/json",
    "Content-Type": "application/json",
}
BASE_URL = "https://app.asana.com/api/1.0"


def should_push_local_to_asana():
    return os.getenv("ASANA_BIDIRECTIONAL", "true").lower() in {"1", "true", "yes", "on"}


def run_bd(args, check=True, text=True):
    bd_path = "bd"
    if subprocess.run(["which", "bd"], check=False, capture_output=True).returncode != 0:
        bd_path = os.path.expanduser("~/.local/bin/bd")

    return subprocess.run([bd_path, *args], capture_output=True, text=text, check=check)


def get_beads_issues():
    """Fetch all issues from Beads in JSON format."""
    try:
        result = run_bd(["export", "--all"])
        output = result.stdout.strip()
        if not output:
            return {}

        issues = {}
        for line in output.splitlines():
            if not line.strip():
                continue
            issue = json.loads(line)
            issues[issue["id"]] = issue
        return issues
    except subprocess.CalledProcessError as e:
        logging.error(f"Failed to fetch beads issues: {e.stderr}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        logging.error(f"Failed to parse beads JSON: {e}")
        sys.exit(1)


def get_asana_workspace():
    resp = requests.get(f"{BASE_URL}/workspaces", headers=HEADERS)
    resp.raise_for_status()
    data = resp.json().get("data", [])
    if not data:
        logging.error("No Asana workspaces found for this user.")
        sys.exit(1)
    return data[0]["gid"]


def get_asana_project(workspace_gid, project_name="Pixelated Empathy - Active Sprint"):
    resp = requests.get(f"{BASE_URL}/projects?workspace={workspace_gid}", headers=HEADERS)
    resp.raise_for_status()
    projects = resp.json().get("data", [])

    for p in projects:
        if p["name"] == project_name:
            return p["gid"]

    payload = {"data": {"name": project_name, "workspace": workspace_gid}}
    resp = requests.post(f"{BASE_URL}/projects", headers=HEADERS, json=payload)
    resp.raise_for_status()
    return resp.json()["data"]["gid"]


def get_asana_projects(workspace_gid):
    explicit_project_names = os.getenv("ASANA_PROJECT_NAMES", "").strip()
    explicit_project_ids = os.getenv("ASANA_PROJECT_IDS", "").strip()
    sync_all_projects = os.getenv("ASANA_SYNC_ALL_PROJECTS", "").strip().lower() == "true"

    if explicit_project_ids:
        return [pid.strip() for pid in explicit_project_ids.split(",") if pid.strip()]

    resp = requests.get(f"{BASE_URL}/projects?workspace={workspace_gid}", headers=HEADERS)
    resp.raise_for_status()
    projects = resp.json().get("data", [])

    if sync_all_projects:
        return [p["gid"] for p in projects]

    if explicit_project_names:
        wanted_names = [name.strip() for name in explicit_project_names.split(",") if name.strip()]
        by_name = {p["name"]: p["gid"] for p in projects}
        missing_names = []
        resolved = []
        for name in wanted_names:
            gid = by_name.get(name)
            if gid:
                resolved.append(gid)
            else:
                missing_names.append(name)
        if missing_names:
            for name in missing_names:
                payload = {"data": {"name": name, "workspace": workspace_gid}}
                create_resp = requests.post(f"{BASE_URL}/projects", headers=HEADERS, json=payload)
                create_resp.raise_for_status()
                resolved.append(create_resp.json()["data"]["gid"])
        return resolved

    return [get_asana_project(workspace_gid)]


def _fetch_task_page(project_gid, offset):
    params = {
        "project": project_gid,
        "limit": "100",
        "opt_fields": "name,completed,notes,custom_fields,modified_at,due_on,due_at",
    }
    if offset:
        params["offset"] = offset
    resp = requests.get(f"{BASE_URL}/tasks", headers=HEADERS, params=params)
    resp.raise_for_status()
    payload = resp.json()
    next_page = payload.get("next_page") or {}
    return payload.get("data", []), next_page.get("offset")


def get_existing_tasks(project_gids):
    tasks = []
    for project_gid in project_gids:
        offset = None
        while True:
            page_data, offset = _fetch_task_page(project_gid, offset)
            tasks.extend(page_data)
            if not offset:
                break
    return tasks


def parse_iso(ts):
    if not ts:
        return datetime.fromisoformat("1970-01-01T00:00:00+00:00")
    if ts.endswith("Z"):
        ts = f"{ts[:-1]}+00:00"
    return datetime.fromisoformat(ts)


def asana_due_value(task):
    """Return Asana due date/time value, preferring due_at over due_on."""
    return task.get("due_at") or task.get("due_on")


def normalize_due_for_compare(due_value):
    """Normalize due strings for lightweight comparisons."""
    if not due_value:
        return None
    return due_value.split("T")[0]


def build_asana_due_payload(issue_due_value):
    """Convert Beads due value into the right Asana API field."""
    if not issue_due_value:
        return {}
    if "T" in issue_due_value:
        return {"due_at": issue_due_value}
    return {"due_on": issue_due_value}


def extract_beads_id_from_asana_name(name):
    """Extract beads ID from Asana task name format: 'Title [bd-id]'"""
    if " [" not in name or not name.endswith("]"):
        return None
    return name.split(" [")[-1][:-1]


def strip_asana_beads_suffix(name):
    """Strip any trailing '[xyz]' suffix from an Asana task title."""
    if " [" not in name or not name.endswith("]"):
        return name
    return name.rsplit(" [", 1)[0]


def build_asana_notes(bd_id, issue):
    """Build the notes field for an Asana task from a Beads issue."""
    priority = issue.get("priority", "")
    issue_type = issue.get("type", "")
    desc = issue.get("description", "")
    return f"Beads ID: {bd_id}\nPriority: {priority}\nType: {issue_type}\n\n{desc}"


def get_expected_task_name(title, bd_id):
    """Get the expected Asana task name for a Beads issue."""
    return f"{title} [{bd_id}]"


def pull_asana_task_to_beads(task):
    """Pull a single Asana task into the local Beads database."""
    name = strip_asana_beads_suffix(task.get("name", ""))
    desc = task.get("notes", "")
    is_completed = task.get("completed", False)
    due = asana_due_value(task)

    logging.info(f"Pulling new Asana task into Beads: {name}")

    create_args = ["create", "--silent", "--title", name]
    if desc:
        create_args.extend(["--description", desc])
    if due:
        create_args.extend(["--due", due])

    res = run_bd(create_args)
    new_bd_id = res.stdout.strip()

    if is_completed:
        run_bd(["close", new_bd_id])

    new_asana_name = f"{name} [{new_bd_id}]"
    payload = {"data": {"name": new_asana_name}}
    requests.put(f"{BASE_URL}/tasks/{task['gid']}", headers=HEADERS, json=payload)

    return {**task, "name": new_asana_name}


def push_beads_issue_to_asana(issue, workspace_gid, project_gids):
    """Push a single Beads issue to Asana as a new task."""
    bd_id = issue["id"]
    title = issue.get("title", "")
    is_completed = issue.get("status", "open") == "closed"
    notes = build_asana_notes(bd_id, issue)

    logging.info(f"Pushing new Beads task into Asana: {bd_id}")
    payload = {
        "data": {
            "name": get_expected_task_name(title, bd_id),
            "completed": is_completed,
            "notes": notes,
            "projects": [project_gids[0]],
            "workspace": workspace_gid,
        }
    }
    payload["data"].update(build_asana_due_payload(issue.get("due_at")))
    payload["data"]["projects"] = [project_gids[0]]
    requests.post(f"{BASE_URL}/tasks", headers=HEADERS, json=payload)


def resolve_conflict_asana_wins(issue, asana_task, bd_id):
    """Resolve sync conflict where Asana is newer - update local Beads."""
    asana_name = asana_task.get("name", "")
    clean_title = asana_name.split(" [")[0]

    run_bd(["update", bd_id, "--title", clean_title])

    asana_is_completed = asana_task.get("completed", False)
    bd_is_completed = issue.get("status", "open") == "closed"

    if asana_is_completed and not bd_is_completed:
        run_bd(["close", bd_id])
    elif not asana_is_completed and bd_is_completed:
        run_bd(["reopen", bd_id])
    asana_due = asana_due_value(asana_task)
    if asana_due:
        run_bd(["update", bd_id, "--due", asana_due])
    else:
        run_bd(["update", bd_id, "--due", ""])

    logging.info(f"Updated Beads task to match Asana for {bd_id}")


def resolve_conflict_beads_wins(asana_task, issue, bd_id):
    """Resolve sync conflict where Beads is newer - update Asana."""
    title = issue.get("title", "")
    is_completed = issue.get("status", "open") == "closed"
    notes = build_asana_notes(bd_id, issue)

    payload = {
        "data": {
            "name": get_expected_task_name(title, bd_id),
            "completed": is_completed,
            "notes": notes,
        }
    }
    payload["data"].update(build_asana_due_payload(issue.get("due_at")))
    requests.put(f"{BASE_URL}/tasks/{asana_task['gid']}", headers=HEADERS, json=payload)
    logging.info(f"Updated Asana task to match Beads for {bd_id}")


def sync_beads_with_asana(issue, asana_task):
    """Sync a single Beads issue with its corresponding Asana task."""
    bd_id = issue["id"]
    title = issue.get("title", "")
    is_completed = issue.get("status", "open") == "closed"

    expected_name = get_expected_task_name(title, bd_id)
    expected_notes = build_asana_notes(bd_id, issue)
    asana_is_completed = asana_task.get("completed", False)
    asana_name = asana_task.get("name", "")
    asana_notes = asana_task.get("notes", "")
    asana_due = asana_due_value(asana_task)
    issue_due = issue.get("due_at")

    needs_update = (
        asana_name != expected_name
        or asana_is_completed != is_completed
        or asana_notes != expected_notes
        or normalize_due_for_compare(asana_due) != normalize_due_for_compare(issue_due)
    )

    if not needs_update:
        return

    bd_updated = parse_iso(issue.get("updated_at", "1970-01-01T00:00:00Z"))
    asana_updated = parse_iso(asana_task.get("modified_at", "1970-01-01T00:00:00Z"))

    if bd_updated >= asana_updated:
        resolve_conflict_beads_wins(asana_task, issue, bd_id)
    else:
        resolve_conflict_asana_wins(issue, asana_task, bd_id)


def sync_issues():
    logging.info("Starting Bidirectional Beads <-> Asana sync...")

    bd_issues = get_beads_issues()
    known_bd_ids = set(bd_issues.keys())
    logging.info(f"Found {len(bd_issues)} issues in local beads database.")

    workspace_gid = get_asana_workspace()
    project_gids = get_asana_projects(workspace_gid)
    logging.info(f"Using Asana project target(s): {', '.join(project_gids)}")
    existing_tasks = get_existing_tasks(project_gids)

    asana_tasks_by_bd_id, asana_tasks_without_bd = categorize_asana_tasks(existing_tasks)

    for task in asana_tasks_without_bd:
        updated_task = pull_asana_task_to_beads(task)
        asana_tasks_by_bd_id[extract_beads_id_from_asana_name(updated_task["name"])] = updated_task
        if updated_task.get("name"):
            known_bd_ids.update([extract_beads_id_from_asana_name(updated_task["name"])])

    orphaned_asana_task_ids = [
        bd_id for bd_id in asana_tasks_by_bd_id if bd_id not in known_bd_ids
    ]
    for orphaned_bd_id in orphaned_asana_task_ids:
        task = asana_tasks_by_bd_id.pop(orphaned_bd_id)
        logging.info(f"Reconciling orphaned Asana task not present in local Beads: {orphaned_bd_id}")
        updated_task = pull_asana_task_to_beads(task)
        asana_tasks_by_bd_id[extract_beads_id_from_asana_name(updated_task["name"])] = updated_task
        known_bd_ids.add(extract_beads_id_from_asana_name(updated_task["name"]))

    bd_issues = get_beads_issues()

    for bd_id, issue in bd_issues.items():
        if bd_id not in asana_tasks_by_bd_id:
            if should_push_local_to_asana():
                push_beads_issue_to_asana(issue, workspace_gid, project_gids)
            continue
        sync_beads_with_asana(issue, asana_tasks_by_bd_id[bd_id])

    logging.info("Sync complete!")


def categorize_asana_tasks(existing_tasks):
    """Categorize Asana tasks into those with and without Beads IDs."""
    tasks_by_bd_id = {}
    tasks_without_bd = []

    for task in existing_tasks:
        name = task.get("name", "")
        if beads_id := extract_beads_id_from_asana_name(name):
            tasks_by_bd_id[beads_id] = task
        else:
            tasks_without_bd.append(task)

    return tasks_by_bd_id, tasks_without_bd


if __name__ == "__main__":
    sync_issues()
