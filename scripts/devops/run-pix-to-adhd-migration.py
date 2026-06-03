#!/usr/bin/env python3
"""Create ADHD issues on russianvodka from bulk JSON via Jira REST API."""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

BATCH_SIZE = 50


def adf_description(text: str) -> dict:
    paragraphs = []
    for line in text.splitlines() or [text]:
        line = line.strip()
        if not line:
            continue
        paragraphs.append(
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": line}],
            }
        )
    if not paragraphs:
        paragraphs = [
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": text or "Migrated issue."}],
            }
        ]
    return {"type": "doc", "version": 1, "content": paragraphs}


def request_json(
    method: str,
    url: str,
    user: str,
    token: str,
    payload: dict | None = None,
) -> dict:
    data = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    credentials = f"{user}:{token}".encode()
    import base64

    req.add_header("Authorization", "Basic " + base64.b64encode(credentials).decode())

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {url} -> HTTP {exc.code}: {detail}") from exc


def create_issue(site: str, user: str, token: str, issue: dict) -> str:
    fields = {
        "project": {"key": issue["projectKey"]},
        "summary": issue["summary"],
        "issuetype": {"name": issue["issueType"]},
        "description": adf_description(issue.get("description", "")),
    }
    labels = issue.get("label") or []
    if labels:
        fields["labels"] = labels
    assignee = issue.get("assignee")
    if assignee:
        fields["assignee"] = {"id": lookup_account_id(site, user, token, assignee)}

    payload = {"fields": fields}
    response = request_json(
        "POST",
        f"{site}/rest/api/3/issue",
        user,
        token,
        payload,
    )
    return response["key"]


def lookup_account_id(site: str, user: str, token: str, email: str) -> str:
    import urllib.parse

    query = urllib.parse.urlencode({"query": email})
    response = request_json(
        "GET",
        f"{site}/rest/api/3/user/search?{query}",
        user,
        token,
    )
    if not response:
        raise RuntimeError(f"No Jira user found for {email}")
    return response[0]["accountId"]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bulk-json", type=Path, required=True)
    parser.add_argument("--mapping-out", type=Path, default=Path("exports/pix-to-adhd-key-map.json"))
    parser.add_argument("--limit", type=int, default=0, help="0 = all issues")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--site", default=os.environ.get("ATLASSIAN_SITE_URL", "https://russianvodka.atlassian.net"))
    parser.add_argument("--email", default=os.environ.get("ATLASSIAN_EMAIL"))
    parser.add_argument("--token", default=os.environ.get("ATLASSIAN_API_TOKEN"))
    args = parser.parse_args()

    if not args.email or not args.token:
        print("ATLASSIAN_EMAIL and ATLASSIAN_API_TOKEN required", file=sys.stderr)
        sys.exit(1)

    site = args.site.rstrip("/")
    with args.bulk_json.open(encoding="utf-8") as handle:
        issues = json.load(handle)["issues"]
    if args.limit > 0:
        issues = issues[: args.limit]

    mapping: dict[str, str] = {}
    if args.dry_run:
        print(f"DRY RUN: would create {len(issues)} issues on {site}")
        for issue in issues[:5]:
            print(" -", issue["summary"][:80])
        return

    assignee_id: str | None = None
    if issues and issues[0].get("assignee"):
        assignee_id = lookup_account_id(site, args.email, args.token, issues[0]["assignee"])

    for index, issue in enumerate(issues, start=1):
        if assignee_id and issue.get("assignee"):
            issue = {**issue, "assignee_id": assignee_id}
        source_label = next((label for label in issue.get("label", []) if label.startswith("source-pix-")), None)
        source_key = source_label.replace("source-", "").upper() if source_label else f"ROW-{index}"

        fields = {
            "project": {"key": issue["projectKey"]},
            "summary": issue["summary"],
            "issuetype": {"name": issue["issueType"]},
            "description": adf_description(issue.get("description", "")),
        }
        if issue.get("label"):
            fields["labels"] = issue["label"]
        if assignee_id:
            fields["assignee"] = {"id": assignee_id}

        response = request_json(
            "POST",
            f"{site}/rest/api/3/issue",
            args.email,
            args.token,
            {"fields": fields},
        )
        dest_key = response["key"]
        mapping[source_key] = dest_key
        print(f"[{index}/{len(issues)}] {source_key} -> {dest_key}")
        time.sleep(0.15)

    args.mapping_out.parent.mkdir(parents=True, exist_ok=True)
    with args.mapping_out.open("w", encoding="utf-8") as handle:
        json.dump(mapping, handle, indent=2)
        handle.write("\n")
    print(f"Wrote mapping: {args.mapping_out}")


if __name__ == "__main__":
    main()
