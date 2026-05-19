#!/usr/bin/env python3
"""Build acli/jira bulk-create payload from slimshadyme PIX export."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

DEFAULT_SRC_JSON = Path("gusher-pix.json")
DEFAULT_SRC_CSV = Path("exports/gusher-pix-issues-20260517.csv")
DEFAULT_OUT = Path("exports/gusher-pix-to-adhd-bulk.json")

ASSIGNEE_MAP = {
    "chris@slimshady.me": "chad@pixelated.love",
}


def load_labels_by_key(csv_path: Path) -> dict[str, list[str]]:
    labels: dict[str, list[str]] = {}
    if not csv_path.is_file():
        return labels
    with csv_path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            key = (row.get("Key") or "").strip()
            raw = (row.get("Label") or "").strip()
            if not key or not raw:
                continue
            labels[key] = [part.strip() for part in raw.split(",") if part.strip()]
    return labels


def build_issue(
    row: dict,
    labels_by_key: dict[str, list[str]],
    dest_project: str,
    dest_assignee: str,
) -> dict:
    fields = row.get("fields") or {}
    source_key = row.get("key") or ""
    issue_type = (fields.get("issuetype") or {}).get("name") or "Task"
    summary = (fields.get("summary") or "").strip() or f"Migrated {source_key}"
    if issue_type == "Epic":
        summary = f"[Epic] {summary}"

    status = (fields.get("status") or {}).get("name") or "Unknown"
    priority = (fields.get("priority") or {}).get("name") or "Unknown"
    assignee = (fields.get("assignee") or {}).get("emailAddress")
    mapped_assignee = ASSIGNEE_MAP.get(assignee, dest_assignee) if assignee else dest_assignee

    label_set = {
        "migrated-from-pix",
        f"source-{source_key.lower()}",
        *labels_by_key.get(source_key, []),
    }
    if issue_type == "Epic":
        label_set.add("source-epic")

    description = (
        f"Migrated from slimshadyme {source_key}.\n\n"
        f"Source type: {issue_type}\n"
        f"Source status: {status}\n"
        f"Source priority: {priority}\n"
    )

    return {
        "summary": summary,
        "projectKey": dest_project,
        "issueType": "Task",
        "description": description,
        "label": sorted(label_set),
        "assignee": mapped_assignee,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--src-json", type=Path, default=DEFAULT_SRC_JSON)
    parser.add_argument("--src-csv", type=Path, default=DEFAULT_SRC_CSV)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--dest-project", default="ADHD")
    parser.add_argument("--dest-assignee", default="chad@pixelated.love")
    args = parser.parse_args()

    labels_by_key = load_labels_by_key(args.src_csv)
    with args.src_json.open(encoding="utf-8") as handle:
        source_issues = json.load(handle)

    # Epics first so references could be added later if needed.
    def sort_key(row: dict) -> tuple[int, str]:
        name = ((row.get("fields") or {}).get("issuetype") or {}).get("name") or ""
        return (0 if name == "Epic" else 1, row.get("key") or "")

    issues = [
        build_issue(row, labels_by_key, args.dest_project, args.dest_assignee)
        for row in sorted(source_issues, key=sort_key)
    ]

    payload = {"issues": issues}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")

    print(f"Wrote {len(issues)} issues to {args.out}")


if __name__ == "__main__":
    main()
