"""Provider bridge helpers for tri-sync export/apply scripts."""

from __future__ import annotations

import base64
import json
import os
import re
from collections.abc import Mapping
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib import parse, request

DEFAULT_CONFIG_PATH = Path(".agent/internal/config.json")
DEFAULT_JIRA_PROJECT_NAME = "Pixelated Empathy"
DEFAULT_JIRA_PROJECT_TYPE = "business"
DEFAULT_JIRA_PROJECT_TEMPLATES = (
    "com.atlassian.jira-core-project-templates:jira-core-simplified-project-management",
    "com.atlassian.jira-core-project-templates:jira-core-simplified-process-control",
)
_JIRA_PROJECT_EXISTS_CACHE: dict[str, bool] = {}


def _strip_env(name: str) -> str:
    return os.getenv(name, "").strip()


def resolve_asana_token() -> str:
    token = _strip_env("ASANA_ACCESS_TOKEN") or _strip_env("ASANA_PAT")
    if not token:
        raise RuntimeError("Missing Asana token. Set ASANA_ACCESS_TOKEN or ASANA_PAT.")
    return token


def resolve_asana_project_id() -> str:
    project_id = _strip_env("PIXELATED_ASANA_PROJECT_ID")
    if project_id:
        return project_id

    project_id = read_default_asana_project_id()
    if project_id:
        return project_id

    project_id = _strip_env("ASANA_PROJECT_ID")
    if not project_id:
        raise RuntimeError("Missing Asana project id. Set ASANA_PROJECT_ID.")
    return project_id


def read_default_asana_project_id(config_path: Path | None = None) -> str:
    path = config_path or DEFAULT_CONFIG_PATH
    if not path.exists():
        return ""

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return ""

    integration = payload.get("integration")
    if not isinstance(integration, Mapping):
        return ""
    asana = integration.get("asana")
    if not isinstance(asana, Mapping):
        return ""

    all_projects = asana.get("all_projects")
    if isinstance(all_projects, Mapping):
        active_sprint = all_projects.get("active_sprint")
        if isinstance(active_sprint, str) and active_sprint.strip():
            return active_sprint.strip()

    project_id = asana.get("project_id")
    if isinstance(project_id, str):
        return project_id.strip()
    return ""


def _load_internal_config(config_path: Path | None = None) -> dict[str, Any]:
    path = config_path or DEFAULT_CONFIG_PATH
    if not path.exists():
        return {}

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return payload if isinstance(payload, dict) else {}


def _write_internal_config(payload: Mapping[str, Any], config_path: Path | None = None) -> None:
    path = config_path or DEFAULT_CONFIG_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(dict(payload), indent=2) + "\n", encoding="utf-8")


def read_default_jira_project_key(config_path: Path | None = None) -> str:
    payload = _load_internal_config(config_path)
    integration = payload.get("integration")
    if not isinstance(integration, Mapping):
        return ""
    jira = integration.get("jira")
    if not isinstance(jira, Mapping):
        return ""

    project_key = jira.get("project_key")
    if isinstance(project_key, str):
        return project_key.strip()
    return ""


def persist_default_jira_project(project_key: str, project_name: str, config_path: Path | None = None) -> None:
    payload = _load_internal_config(config_path)
    integration = payload.setdefault("integration", {})
    if not isinstance(integration, dict):
        integration = {}
        payload["integration"] = integration

    jira = integration.setdefault("jira", {})
    if not isinstance(jira, dict):
        jira = {}
        integration["jira"] = jira

    jira["enabled"] = True
    jira["project_key"] = project_key
    jira["project_name"] = project_name

    _write_internal_config(payload, config_path)


def resolve_jira_site_url() -> str:
    site_url = _strip_env("JIRA_URL") or _strip_env("ATLASSIAN_SITE_URL")
    if not site_url:
        raise RuntimeError("Missing Jira site URL. Set JIRA_URL or ATLASSIAN_SITE_URL.")
    normalized = site_url.rstrip("/")
    if not normalized.lower().startswith("https://"):
        raise RuntimeError("Jira site URL must use HTTPS.")
    return normalized


def resolve_jira_user() -> str:
    user = _strip_env("JIRA_USERNAME") or _strip_env("ATLASSIAN_EMAIL")
    if not user:
        raise RuntimeError("Missing Jira user. Set JIRA_USERNAME or ATLASSIAN_EMAIL.")
    return user


def resolve_jira_token() -> str:
    token = _strip_env("JIRA_API_TOKEN") or _strip_env("ATLASSIAN_API_TOKEN")
    if not token:
        raise RuntimeError("Missing Jira token. Set JIRA_API_TOKEN or ATLASSIAN_API_TOKEN.")
    return token


def resolve_jira_project_key(*, create_if_missing: bool = False) -> str:
    project_key = resolve_configured_jira_project_key()
    if project_key:
        return project_key

    project_key = resolve_discovered_jira_project_key()
    if project_key:
        return project_key

    if create_if_missing:
        project = ensure_jira_project()
        return project["key"]

    return ""


def ensure_jira_project() -> dict[str, str]:
    project = _discover_first_jira_project()
    if project:
        persist_default_jira_project(project["key"], project["name"])
        return project

    project = create_jira_project()
    persist_default_jira_project(project["key"], project["name"])
    return project


def resolve_configured_jira_project_key() -> str:
    for candidate in (_strip_env("JIRA_PROJECT_KEY"), read_default_jira_project_key()):
        if not candidate:
            continue
        exists = jira_project_exists(candidate)
        if exists is True:
            return candidate
        if exists is None:
            raise RuntimeError(
                f"Jira project validation for '{candidate}' could not complete due to a transient API failure."
            )
    return ""


def resolve_discovered_jira_project_key() -> str:
    project = _discover_first_jira_project()
    if not project:
        return ""
    persist_default_jira_project(project["key"], project["name"])
    return project["key"]


def _discover_first_jira_project() -> dict[str, str] | None:
    site_url = resolve_jira_site_url()
    headers = build_jira_auth_header(resolve_jira_user(), resolve_jira_token())
    url = f"{site_url}/rest/api/3/project/search?maxResults=1"
    payload = _json_request("GET", url, headers=headers)
    values = payload.get("values")
    if isinstance(values, list) and values:
        first = values[0]
        if isinstance(first, Mapping):
            key = first.get("key")
            name = first.get("name")
            if isinstance(key, str):
                return {
                    "key": key.strip(),
                    "name": str(name or key).strip() or key.strip(),
                }
    return None


def jira_project_exists(project_key: str) -> bool | None:
    normalized = project_key.strip().upper()
    if not normalized:
        return False
    cached = _JIRA_PROJECT_EXISTS_CACHE.get(normalized)
    if cached is not None:
        return cached

    site_url = resolve_jira_site_url()
    headers = build_jira_auth_header(resolve_jira_user(), resolve_jira_token())
    req = request.Request(
        f"{site_url}/rest/api/3/project/{normalized}",
        headers=dict(headers),
        method="GET",
    )
    try:
        with request.urlopen(req) as response:
            response.read()
    except HTTPError as exc:
        if exc.code == 404:
            _JIRA_PROJECT_EXISTS_CACHE[normalized] = False
            return False
        if exc.code in {401, 403}:
            raise RuntimeError(f"Jira project validation failed with HTTP {exc.code}.") from exc
        if exc.code in {408, 409, 425, 429, 500, 502, 503, 504}:
            return None
        raise RuntimeError(
            f"GET {site_url}/rest/api/3/project/{normalized} failed with HTTP {exc.code}: "
            f"{exc.read().decode('utf-8', errors='replace')}"
        ) from exc
    _JIRA_PROJECT_EXISTS_CACHE[normalized] = True
    return True


def create_jira_project() -> dict[str, str]:
    site_url = resolve_jira_site_url()
    headers = build_jira_auth_header(resolve_jira_user(), resolve_jira_token())
    lead_account_id = fetch_jira_account_id(site_url, headers)
    project_name = resolve_jira_project_name()
    last_error: Exception | None = None
    for payload in jira_project_bootstrap_payloads(project_name, lead_account_id):
        try:
            return attempt_jira_project_create(site_url, headers, payload)
        except Exception as exc:  # pragma: no cover - exercised via integration path
            last_error = exc

    if last_error is not None:
        raise RuntimeError(
            "Jira authenticated but no visible projects exist, and automatic project bootstrap failed."
        ) from last_error
    raise RuntimeError("Jira authenticated but no visible projects exist.")


def resolve_jira_project_name() -> str:
    return (
        _strip_env("PIXELATED_JIRA_PROJECT_NAME")
        or _strip_env("JIRA_PROJECT_NAME")
        or DEFAULT_JIRA_PROJECT_NAME
    )


def jira_project_key_candidates(project_name: str) -> list[str]:
    explicit = _strip_env("PIXELATED_JIRA_PROJECT_KEY") or _strip_env("JIRA_PROJECT_KEY")
    if explicit:
        return [explicit.upper()]

    candidates = [
        _jira_condensed_key(project_name),
        _jira_initials_key(project_name),
        _jira_combined_key(project_name),
        "PIXELATED",
        "PIXEL",
        "PXL",
        "PE",
    ]
    result: list[str] = []
    for candidate in candidates:
        cleaned = re.sub(r"[^A-Z]", "", candidate.upper())[:10]
        if len(cleaned) < 2 or cleaned in result:
            continue
        result.append(cleaned)
    return result


def _jira_condensed_key(project_name: str) -> str:
    return re.sub(r"[^A-Z]", "", project_name.upper())[:10]


def _jira_initials_key(project_name: str) -> str:
    words = [token for token in re.split(r"[^A-Za-z0-9]+", project_name.upper()) if token]
    return "".join(word[0] for word in words)[:10]


def _jira_combined_key(project_name: str) -> str:
    return (_jira_initials_key(project_name) + _jira_condensed_key(project_name))[:10]


def jira_project_template_candidates() -> list[str]:
    override = _strip_env("PIXELATED_JIRA_PROJECT_TEMPLATE_KEY")
    if override:
        return [override]
    return list(DEFAULT_JIRA_PROJECT_TEMPLATES)


def fetch_jira_account_id(site_url: str, headers: Mapping[str, str]) -> str:
    current_user = _json_request("GET", f"{site_url}/rest/api/3/myself", headers=headers)
    lead_account_id = str(current_user.get("accountId") or "").strip()
    if not lead_account_id:
        raise RuntimeError("Unable to determine Jira accountId for project bootstrap.")
    return lead_account_id


def jira_project_bootstrap_payloads(project_name: str, lead_account_id: str) -> list[dict[str, str]]:
    payloads: list[dict[str, str]] = []
    for project_key in jira_project_key_candidates(project_name):
        for template_key in jira_project_template_candidates():
            payloads.append(
                {
                    "key": project_key,
                    "name": project_name,
                    "projectTypeKey": DEFAULT_JIRA_PROJECT_TYPE,
                    "projectTemplateKey": template_key,
                    "leadAccountId": lead_account_id,
                    "assigneeType": "PROJECT_LEAD",
                    "description": "Pixelated tri-sync bootstrap project",
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


def build_asana_headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def build_jira_auth_header(user: str, token: str) -> dict[str, str]:
    encoded = base64.b64encode(f"{user}:{token}".encode("utf-8")).decode("ascii")
    return {
        "Authorization": f"Basic {encoded}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def asana_create_payload(action: Any, project_id: str) -> dict[str, Any]:
    return {
        "data": {
            "name": action.title,
            "notes": action.body,
            "completed": action.status == "closed",
            "projects": [project_id],
        }
    }


def asana_update_payload(action: Any) -> dict[str, Any]:
    return {
        "data": {
            "name": action.title,
            "notes": action.body,
            "completed": action.status == "closed",
        }
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
    if not paragraphs:
        paragraphs = [{"type": "paragraph", "content": []}]
    return {"type": "doc", "version": 1, "content": paragraphs}


def _json_request(
    method: str,
    url: str,
    *,
    headers: Mapping[str, str],
    payload: Mapping[str, Any] | None = None,
) -> Any:
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    req = request.Request(url, data=data, headers=dict(headers), method=method)
    try:
        with request.urlopen(req) as response:
            body = response.read().decode("utf-8")
    except HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {url} failed with HTTP {exc.code}: {error_body}") from exc
    if not body:
        return {}
    return json.loads(body)


def export_asana_tasks() -> list[dict[str, Any]]:
    token = resolve_asana_token()
    project_id = resolve_asana_project_id()
    headers = build_asana_headers(token)
    fields = "gid,name,notes,completed,modified_at"

    offset = ""
    tasks: list[dict[str, Any]] = []
    while True:
        query = {"limit": "100", "opt_fields": fields}
        if offset:
            query["offset"] = offset
        url = (
            f"https://app.asana.com/api/1.0/projects/{project_id}/tasks?"
            f"{parse.urlencode(query)}"
        )
        payload = _json_request("GET", url, headers=headers)
        tasks.extend(payload.get("data", []))
        next_page = payload.get("next_page") or {}
        offset = next_page.get("offset") or ""
        if not offset:
            break
    return tasks


def apply_asana_action(action: Mapping[str, Any]) -> dict[str, Any]:
    token = resolve_asana_token()
    project_id = resolve_asana_project_id()
    headers = build_asana_headers(token)
    target_id = str(action.get("target_id") or "").strip()
    action_type = str(action.get("action") or "").strip()

    if action_type == "create":
        payload = asana_create_payload(_object_view(action), project_id)
        response = _json_request(
            "POST",
            "https://app.asana.com/api/1.0/tasks",
            headers=headers,
            payload=payload,
        )
    else:
        if not target_id:
            raise RuntimeError("Asana update requires target_id.")
        payload = asana_update_payload(_object_view(action))
        response = _json_request(
            "PUT",
            f"https://app.asana.com/api/1.0/tasks/{target_id}",
            headers=headers,
            payload=payload,
        )
    return response.get("data", response)


def export_jira_issues() -> list[dict[str, Any]]:
    site_url = resolve_jira_site_url()
    headers = build_jira_auth_header(resolve_jira_user(), resolve_jira_token())
    params = {
        "jql": jira_search_jql(resolve_jira_project_key(create_if_missing=True)),
        "fields": "summary,description,status,updated",
        "maxResults": "100",
    }
    url = f"{site_url}/rest/api/3/search/jql?{parse.urlencode(params)}"
    payload = _json_request("GET", url, headers=headers)
    return payload.get("issues", [])


def apply_jira_action(action: Mapping[str, Any]) -> dict[str, Any]:
    site_url = resolve_jira_site_url()
    headers = build_jira_auth_header(resolve_jira_user(), resolve_jira_token())
    target_id = str(action.get("target_id") or "").strip()
    action_type = str(action.get("action") or "").strip()

    if action_type == "create":
        project_key = resolve_jira_project_key(create_if_missing=True)
        if not project_key:
            raise RuntimeError("No accessible Jira project key found for tri-sync.")
        payload = jira_create_payload(
            _object_view(action),
            project_key,
            resolve_jira_issue_type(),
        )
        response = _json_request(
            "POST",
            f"{site_url}/rest/api/3/issue",
            headers=headers,
            payload=payload,
        )
    else:
        if not target_id:
            raise RuntimeError("Jira update requires target_id.")
        payload = jira_update_payload(_object_view(action))
        _json_request(
            "PUT",
            f"{site_url}/rest/api/3/issue/{target_id}",
            headers=headers,
            payload=payload,
        )
        response = {"key": target_id}
    return response


class _ObjectView:
    def __init__(self, payload: Mapping[str, Any]) -> None:
        self.title = str(payload.get("title") or "")
        self.body = str(payload.get("body") or "")
        self.status = str(payload.get("status") or "open")


def _object_view(payload: Mapping[str, Any]) -> _ObjectView:
    return _ObjectView(payload)
