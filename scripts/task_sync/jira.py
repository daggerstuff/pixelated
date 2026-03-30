"""Jira task sync provider implementation."""

from __future__ import annotations

import base64
from collections.abc import Mapping
from pathlib import Path
from typing import Any
from urllib import parse

from .config import _strip_env, _load_internal_config, _write_internal_config
from .utils import _json_request, _object_view

DEFAULT_JIRA_PROJECT_NAME = "Pixelated Empathy"
DEFAULT_JIRA_PROJECT_TYPE = "business"
DEFAULT_JIRA_PROJECT_TEMPLATES = (
    "com.atlassian.jira-core-project-templates:jira-core-simplified-project-management",
    "com.atlassian.jira-core-project-templates:jira-core-simplified-process-control",
)
_JIRA_PROJECT_EXISTS_CACHE: dict[str, bool] = {}

def read_default_jira_project_key(config_path: Path | None = None) -> str:
    return str(_load_internal_config(config_path).get("jira_project_key", "")).strip()

def persist_default_jira_project(project_key: str, project_name: str, config_path: Path | None = None) -> None:
    _write_internal_config(
        {"jira_project_key": project_key, "jira_project_name": project_name},
        config_path,
    )

def resolve_jira_site_url() -> str:
    url = _strip_env("JIRA_URL") or _strip_env("ATLASSIAN_SITE_URL")
    if not url:
        raise RuntimeError("Missing Jira URL. Set JIRA_URL or ATLASSIAN_SITE_URL.")
    return url.rstrip("/")

def resolve_jira_user() -> str:
    user = _strip_env("JIRA_USERNAME") or _strip_env("ATLASSIAN_EMAIL")
    if not user:
        raise RuntimeError("Missing Jira username. Set JIRA_USERNAME or ATLASSIAN_EMAIL.")
    return user

def resolve_jira_token() -> str:
    token = _strip_env("JIRA_API_TOKEN") or _strip_env("ATLASSIAN_API_TOKEN")
    if not token:
        raise RuntimeError("Missing Jira API token. Set JIRA_API_TOKEN or ATLASSIAN_API_TOKEN.")
    return token

def resolve_jira_project_key(*, create_if_missing: bool = False) -> str:
    key = _strip_env("PIXELATED_JIRA_PROJECT_ID") or _strip_env("JIRA_PROJECT_KEY")
    if key:
        return key

    key = read_default_jira_project_key()
    if key and jira_project_exists(key):
        return key

    key = resolve_configured_jira_project_key()
    if key:
        return key

    key = resolve_discovered_jira_project_key()
    if key:
        return key

    if create_if_missing:
        created = create_jira_project()
        return created["key"]

    raise RuntimeError("Missing Jira project key. Set JIRA_PROJECT_KEY.")

def ensure_jira_project() -> dict[str, str]:
    key = resolve_jira_project_key(create_if_missing=True)
    return {"key": key, "name": resolve_jira_project_name()}

def resolve_configured_jira_project_key() -> str:
    return _strip_env("JIRA_PROJECT_KEY")

def resolve_discovered_jira_project_key() -> str:
    project = _discover_first_jira_project()
    if project:
        persist_default_jira_project(project["key"], project["name"])
        return project["key"]
    return ""

def _discover_first_jira_project() -> dict[str, str] | None:
    site_url = resolve_jira_site_url()
    user = resolve_jira_user()
    token = resolve_jira_token()
    headers = build_jira_auth_header(user, token)
    projects = _json_request("GET", f"{site_url}/rest/api/3/project", headers=headers)
    if isinstance(projects, list) and projects:
        return {"key": projects[0]["key"], "name": projects[0]["name"]}
    return None

def jira_project_exists(project_key: str) -> bool | None:
    if project_key.upper() in _JIRA_PROJECT_EXISTS_CACHE:
        return _JIRA_PROJECT_EXISTS_CACHE[project_key.upper()]
    try:
        site_url = resolve_jira_site_url()
        user = resolve_jira_user()
        token = resolve_jira_token()
        headers = build_jira_auth_header(user, token)
        _json_request("GET", f"{site_url}/rest/api/3/project/{project_key}", headers=headers)
        _JIRA_PROJECT_EXISTS_CACHE[project_key.upper()] = True
        return True
    except RuntimeError:
        _JIRA_PROJECT_EXISTS_CACHE[project_key.upper()] = False
        return False

def create_jira_project() -> dict[str, str]:
    site_url = resolve_jira_site_url()
    user = resolve_jira_user()
    token = resolve_jira_token()
    headers = build_jira_auth_header(user, token)
    account_id = fetch_jira_account_id(site_url, headers)
    project_name = resolve_jira_project_name()
    payloads = jira_project_bootstrap_payloads(project_name, account_id)
    last_error = None
    for payload in payloads:
        try:
            result = attempt_jira_project_create(site_url, headers, payload)
            persist_default_jira_project(result["key"], result["name"])
            return result
        except RuntimeError as exc:
            last_error = exc
            continue
    raise RuntimeError(f"Failed to create Jira project after trying candidates: {last_error}")

def resolve_jira_project_name() -> str:
    return _strip_env("PIXELATED_JIRA_PROJECT_NAME") or DEFAULT_JIRA_PROJECT_NAME

def jira_project_key_candidates(project_name: str) -> list[str]:
    return [
        _jira_condensed_key(project_name),
        _jira_initials_key(project_name),
        _jira_combined_key(project_name),
    ]

def _jira_condensed_key(project_name: str) -> str:
    return "".join(c for c in project_name if c.isalnum()).upper()[:10]

def _jira_initials_key(project_name: str) -> str:
    return "".join(w[0] for w in project_name.split() if w).upper()[:10]

def _jira_combined_key(project_name: str) -> str:
    return (project_name.split()[0][:3] + project_name.split()[-1][:3]).upper()[:10]

def jira_project_template_candidates() -> list[str]:
    return list(DEFAULT_JIRA_PROJECT_TEMPLATES)

def fetch_jira_account_id(site_url: str, headers: Mapping[str, str]) -> str:
    current_user = _json_request("GET", f"{site_url}/rest/api/3/myself", headers=headers)
    return str(current_user.get("accountId") or "")

def jira_project_bootstrap_payloads(project_name: str, lead_account_id: str) -> list[dict[str, str]]:
    payloads = []
    for key in jira_project_key_candidates(project_name):
        for template in jira_project_template_candidates():
            payloads.append(
                {
                    "key": key,
                    "name": project_name,
                    "projectTypeKey": DEFAULT_JIRA_PROJECT_TYPE,
                    "projectTemplateKey": template,
                    "leadAccountId": lead_account_id,
                }
            )
    return payloads

def attempt_jira_project_create(
    site_url: str,
    headers: Mapping[str, str],
    payload: Mapping[str, Any],
) -> dict[str, str]:
    response = _json_request(
        "POST",
        f"{site_url}/rest/api/3/project",
        headers=headers,
        payload=payload,
    )
    created_key = str(response.get("key") or payload.get("key") or "").strip()
    created_name = str(response.get("name") or payload.get("name") or "").strip() or created_key
    if not created_key:
        raise RuntimeError("Jira project bootstrap did not return a project key.")
    _JIRA_PROJECT_EXISTS_CACHE[created_key.upper()] = True
    return {"key": created_key, "name": created_name}

def resolve_jira_issue_type() -> str:
    return _strip_env("JIRA_ISSUE_TYPE") or "Task"

def build_jira_auth_header(user: str, token: str) -> dict[str, str]:
    encoded = base64.b64encode(f"{user}:{token}".encode("utf-8")).decode("ascii")
    return {
        "Authorization": f"Basic {encoded}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

def jira_search_jql(project_key: str) -> str:
    return f'project = "{project_key}" ORDER BY updated DESC'

def jira_create_payload(action: Any, project_key: str, issue_type: str) -> dict[str, Any]:
    return {
        "fields": {
            "project": {"key": project_key},
            "issuetype": {"name": issue_type},
            "summary": action.title,
            "description": jira_adf_document(action.body),
        }
    }

def jira_update_payload(action: Any) -> dict[str, Any]:
    return {
        "fields": {
            "summary": action.title,
            "description": jira_adf_document(action.body),
        }
    }

def jira_adf_document(text: str) -> dict[str, Any]:
    paragraphs = []
    for block in text.split("\n\n"):
        line = block.strip()
        if not line:
            continue
        paragraphs.append(
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": line}],
            }
        )
    return {"type": "doc", "version": 1, "content": paragraphs}

def export_jira_issues() -> list[dict[str, Any]]:
    site_url = resolve_jira_site_url()
    user = resolve_jira_user()
    token = resolve_jira_token()
    project_key = resolve_jira_project_key()
    headers = build_jira_auth_header(user, token)
    jql = jira_search_jql(project_key)
    fields = "summary,description,status,updated"

    start_at = 0
    issues: list[dict[str, Any]] = []
    while True:
        query = {
            "jql": jql,
            "fields": fields,
            "startAt": str(start_at),
            "maxResults": "50",
        }
        url = f"{site_url}/rest/api/3/search?{parse.urlencode(query)}"
        payload = _json_request("GET", url, headers=headers)
        batch = payload.get("issues", [])
        issues.extend(batch)
        if len(batch) < 50:
            break
        start_at += len(batch)
    return issues

def apply_jira_action(action: Mapping[str, Any]) -> dict[str, Any]:
    site_url = resolve_jira_site_url()
    user = resolve_jira_user()
    token = resolve_jira_token()
    project_key = resolve_jira_project_key()
    issue_type = resolve_jira_issue_type()
    headers = build_jira_auth_header(user, token)

    view = _object_view(action)
    if not view.target_id:
        payload = jira_create_payload(view, project_key, issue_type)
        response = _json_request(
            "POST", f"{site_url}/rest/api/3/issue", headers=headers, payload=payload
        )
        return response
    else:
        payload = jira_update_payload(view)
        _json_request(
            "PUT",
            f"{site_url}/rest/api/3/issue/{view.target_id}",
            headers=headers,
            payload=payload,
        )
        return {"key": view.target_id}
