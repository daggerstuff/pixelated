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


def run_bd(args, check=True, text=True):
    bd_path = "bd"
    if subprocess.run(["which", "bd"], check=False, capture_output=True).returncode != 0:
        bd_path = os.path.expanduser("~/.local/bin/bd")

    return subprocess.run([bd_path, *args], capture_output=True, text=text, check=check)


def get_beads_issues():
    """Fetch all issues from Beads in JSON format."""
    try:
        result = run_bd(["list", "--all", "--json"])
        output = result.stdout.strip()
        if not output:
            return {}
        issues = json.loads(output)
        return {issue["id"]: issue for issue in issues}
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


def get_existing_tasks(project_gid):
    resp = requests.get(
        f"{BASE_URL}/tasks?project={project_gid}&opt_fields=name,completed,notes,custom_fields,modified_at",
        headers=HEADERS,
    )
    resp.raise_for_status()
    return resp.json().get("data", [])


def parse_iso(ts):
    if ts.endswith("Z"):
        ts = f"{ts[:-1]}+00:00"
    return datetime.fromisoformat(ts)


def extract_beads_id_from_asana_name(name):
    """Extract beads ID from Asana task name format: 'Title [bd-id]'"""
    if " [" not in name or not name.endswith("]"):
        return None
    return name.split(" [")[-1][:-1]


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
    name = task.get("name", "")
    desc = task.get("notes", "")
    is_completed = task.get("completed", False)

    logging.info(f"Pulling new Asana task into Beads: {name}")

    create_args = ["create", "--silent", "--title", name]
    if desc:
        create_args.extend(["--description", desc])

    res = run_bd(create_args)
    new_bd_id = res.stdout.strip()

    if is_completed:
        run_bd(["close", new_bd_id])

    new_asana_name = f"{name} [{new_bd_id}]"
    payload = {"data": {"name": new_asana_name}}
    requests.put(f"{BASE_URL}/tasks/{task['gid']}", headers=HEADERS, json=payload)

    return {**task, "name": new_asana_name}


def push_beads_issue_to_asana(issue, workspace_gid, project_gid):
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
            "projects": [project_gid],
            "workspace": workspace_gid,
        }
    }
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

    needs_update = (
        asana_name != expected_name
        or asana_is_completed != is_completed
        or asana_notes != expected_notes
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
    logging.info(f"Found {len(bd_issues)} issues in local beads database.")

    workspace_gid = get_asana_workspace()
    project_gid = get_asana_project(workspace_gid)
    existing_tasks = get_existing_tasks(project_gid)

    asana_tasks_by_bd_id, asana_tasks_without_bd = categorize_asana_tasks(existing_tasks)

    for task in asana_tasks_without_bd:
        updated_task = pull_asana_task_to_beads(task)
        asana_tasks_by_bd_id[updated_task["name"].split(" [")[-1][:-1]] = updated_task

    bd_issues = get_beads_issues()

    for bd_id, issue in bd_issues.items():
        if bd_id not in asana_tasks_by_bd_id:
            push_beads_issue_to_asana(issue, workspace_gid, project_gid)
        else:
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
