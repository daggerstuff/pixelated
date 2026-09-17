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
from typing import Any, TypedDict, cast

BATCH_SIZE = 50


class AdfText(TypedDict):
    type: str
    text: str


class AdfParagraph(TypedDict):
    type: str
    content: list[AdfText]


class AdfDoc(TypedDict):
    type: str
    version: int
    content: list[AdfParagraph]


def adf_description(text: str) -> AdfDoc:
    paragraphs: list[AdfParagraph] = []
    for line_text in text.splitlines() or [text]:
        line = line_text.strip()
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
    payload: dict[str, Any] | None = None,
) -> dict[str, Any] | list[Any]:
    """Issue endpoints return a JSON object; user search returns a JSON array."""
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
            result: dict[str, Any] | list[Any] = json.loads(body) if body else {}
            return result
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {url} -> HTTP {exc.code}: {detail}") from exc


def create_issue(site: str, user: str, token: str, issue: dict[str, Any]) -> str:
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
    # POST /issue always returns a JSON object with the created issue "key".
    created = cast(dict[str, Any], response)
    key: str = created["key"]
    return key


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
    # GET /user/search always returns a JSON array of user objects.
    users = cast(list[dict[str, Any]], response)
    account_id: str = users[0]["accountId"]
    return account_id


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
        sys.exit(1)

    site = args.site.rstrip("/")
    with args.bulk_json.open(encoding="utf-8") as handle:
        issues = json.load(handle)["issues"]
    if args.limit > 0:
        issues = issues[: args.limit]

    mapping: dict[str, str] = {}
    if args.dry_run:
        for _issue in issues[:5]:
            pass
        return

    assignee_id: str | None = None
    if issues and issues[0].get("assignee"):
        assignee_id = lookup_account_id(site, args.email, args.token, issues[0]["assignee"])

    for index, item in enumerate(issues, start=1):
        issue = {**item, "assignee_id": assignee_id} if (assignee_id and item.get("assignee")) else item
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
        # POST /issue always returns a JSON object with the created issue "key".
        created = cast(dict[str, Any], response)
        dest_key: str = created["key"]
        mapping[source_key] = dest_key
        time.sleep(0.15)

    args.mapping_out.parent.mkdir(parents=True, exist_ok=True)
    with args.mapping_out.open("w", encoding="utf-8") as handle:
        json.dump(mapping, handle, indent=2)
        handle.write("\n")


if __name__ == "__main__":
    main()
