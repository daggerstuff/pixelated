"""Provider bridge helpers for tri-sync export/apply scripts."""

from __future__ import annotations

import base64
import json
import os
import re
from collections.abc import Mapping
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any
from urllib import parse, request
from urllib.error import HTTPError

DEFAULT_CONFIG_PATH = Path(".agent/internal/config.json")
DEFAULT_RUNTIME_STATE_PATH = Path(".agent/internal/task-sync-state.json")
DEFAULT_JIRA_PROJECT_NAME = "Pixelated Empathy"
DEFAULT_JIRA_PROJECT_TYPE = "business"
DEFAULT_ASANA_EXPORT_WORKERS = 16
DEFAULT_ASANA_COMPLETED_SINCE = "1970-01-01T00:00:00Z"
DEFAULT_JIRA_PROJECT_TEMPLATES = (
    "com.atlassian.jira-core-project-templates:jira-core-simplified-project-management",
    "com.atlassian.jira-core-project-templates:jira-core-simplified-process-control",
)
_JIRA_PROJECT_EXISTS_CACHE: dict[str, bool] = {}
_JIRA_ISSUE_TYPE_CACHE: dict[str, dict[str, str]] = {}


def _strip_env(name: str) -> str:
    return os.getenv(name, "").strip()


def resolve_asana_completed_since() -> str:
    return _strip_env("PIXELATED_ASANA_COMPLETED_SINCE") or DEFAULT_ASANA_COMPLETED_SINCE


def resolve_asana_token() -> str:
    token = _strip_env("ASANA_ACCESS_TOKEN") or _strip_env("ASANA_PAT")
    if not token:
        raise RuntimeError("Missing Asana token. Set ASANA_ACCESS_TOKEN or ASANA_PAT.")
    return token


def resolve_asana_project_id() -> str:
    project_id = _resolve_asana_project_defaults_from_sources().get("project_id", "")
    if project_id:
        return project_id

    project_id = _strip_env("ASANA_PROJECT_ID")
    if not project_id:
        raise RuntimeError("Missing Asana project id. Set ASANA_PROJECT_ID.")
    return project_id


def resolve_asana_project_ids() -> tuple[str, ...]:
    raw_project_ids = _strip_env("PIXELATED_ASANA_PROJECT_IDS")
    if raw_project_ids:
        project_ids = tuple(
            project_id
            for project_id in (candidate.strip() for candidate in raw_project_ids.split(","))
            if project_id
        )
        if project_ids:
            return project_ids

    project_ids = read_default_asana_project_ids()
    if project_ids:
        return project_ids

    return (resolve_asana_project_id(),)


def read_default_asana_project_id(config_path: Path | None = None) -> str:
    return _read_asana_project_defaults(config_path).get("project_id", "")


def read_default_asana_project_ids(config_path: Path | None = None) -> tuple[str, ...]:
    defaults = _read_asana_project_defaults(config_path)
    project_ids = defaults.get("project_ids", ())
    return project_ids if isinstance(project_ids, tuple) else ()


def _read_asana_project_defaults(config_path: Path | None = None) -> dict[str, Any]:
    asana = _load_asana_config(config_path)
    if not isinstance(asana, Mapping):
        return _empty_asana_project_defaults()

    return _build_asana_project_defaults(asana)


def _empty_asana_project_defaults() -> dict[str, Any]:
    return {"project_id": "", "project_ids": ()}


def _build_asana_project_defaults(asana: Mapping[str, Any]) -> dict[str, Any]:
    project_id = _resolve_default_asana_project_id(asana)
    project_ids = _resolve_asana_project_ids_from_config(asana, project_id)
    return {
        "project_id": project_id,
        "project_ids": project_ids,
    }


def _load_asana_config(config_path: Path | None = None) -> Mapping[str, Any] | None:
    payload = _load_internal_config(config_path)
    integration = payload.get("integration")
    if not isinstance(integration, Mapping):
        return None

    asana = integration.get("asana")
    return asana if isinstance(asana, Mapping) else None


def _resolve_asana_project_ids_from_config(
    asana: Mapping[str, Any],
    fallback_project_id: str,
) -> tuple[str, ...]:
    project_ids = _parse_asana_task_sync_projects(asana)
    if not project_ids and fallback_project_id:
        project_ids = [fallback_project_id]
    return _dedupe_project_ids(project_ids)


def _parse_asana_task_sync_projects(asana: Mapping[str, Any]) -> list[str]:
    task_sync_projects = asana.get("task_sync_projects")
    if isinstance(task_sync_projects, Mapping):
        return _collect_project_ids(task_sync_projects.values())
    if isinstance(task_sync_projects, list):
        return _collect_project_ids(task_sync_projects)
    return []


def _collect_project_ids(candidates: Any) -> list[str]:
    project_ids: list[str] = []
    for candidate in candidates:
        project_id = _normalize_project_id(candidate)
        if project_id:
            project_ids.append(project_id)
    return project_ids


def _normalize_project_id(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def _dedupe_project_ids(project_ids: list[str]) -> tuple[str, ...]:
    deduped: list[str] = []
    for candidate in project_ids:
        if candidate not in deduped:
            deduped.append(candidate)
    return tuple(deduped)


def _resolve_default_asana_project_id(asana: Mapping[str, Any]) -> str:
    all_projects = asana.get("all_projects")
    if isinstance(all_projects, Mapping):
        active_sprint_value = all_projects.get("active_sprint")
        active_sprint_project_id = _normalize_project_id(active_sprint_value)
        if active_sprint_project_id:
            return active_sprint_project_id

    project_id_value = asana.get("project_id")
    return _normalize_project_id(project_id_value)


def _resolve_asana_project_defaults_from_sources(config_path: Path | None = None) -> dict[str, Any]:
    env_project_id = _strip_env("PIXELATED_ASANA_PROJECT_ID")
    defaults = _read_asana_project_defaults(config_path)
    project_id = env_project_id or str(defaults.get("project_id") or "").strip()
    return {
        "project_id": project_id,
        "project_ids": defaults.get("project_ids", ()),
    }


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
    return _read_static_jira_project_key(config_path)


def _read_static_jira_project_key(config_path: Path | None = None) -> str:
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


def read_runtime_jira_project_key(state_path: Path | None = None) -> str:
    runtime_state = _load_runtime_state(state_path)
    persisted_project = runtime_state.get("provider_bridge", {}).get("jira", {})
    if not isinstance(persisted_project, Mapping):
        return ""

    persisted_key = persisted_project.get("project_key")
    return persisted_key.strip() if isinstance(persisted_key, str) else ""


def persist_default_jira_project(
    project_key: str,
    project_name: str,
    state_path: Path | None = None,
) -> None:
    payload = _load_runtime_state(state_path)
    jira = _ensure_runtime_jira_state(payload)
    jira["project_key"] = project_key
    jira["project_name"] = project_name

    _write_runtime_state(payload, state_path)


def _load_runtime_state(state_path: Path | None = None) -> dict[str, Any]:
    path = state_path or DEFAULT_RUNTIME_STATE_PATH
    if not path.exists():
        return {}

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return payload if isinstance(payload, dict) else {}


def _write_runtime_state(payload: Mapping[str, Any], state_path: Path | None = None) -> None:
    path = state_path or DEFAULT_RUNTIME_STATE_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(dict(payload), indent=2) + "\n", encoding="utf-8")


def _ensure_runtime_jira_state(payload: dict[str, Any]) -> dict[str, Any]:
    provider_bridge = payload.get("provider_bridge")
    if not isinstance(provider_bridge, dict):
        provider_bridge = {}
        payload["provider_bridge"] = provider_bridge

    jira = provider_bridge.get("jira")
    if not isinstance(jira, dict):
        jira = {}
        provider_bridge["jira"] = jira
    return jira


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
    anchored_candidates = (
        _strip_env("PIXELATED_JIRA_PROJECT_KEY"),
        _strip_env("JIRA_PROJECT_KEY"),
        read_default_jira_project_key(),
    )
    anchored_candidate = next((candidate for candidate in anchored_candidates if candidate), "")
    if anchored_candidate:
        return _validate_jira_project_candidate(
            anchored_candidate,
            allow_fallback=False,
        )

    fallback_candidates = (
        infer_jira_project_key_from_sync_state(),
        read_runtime_jira_project_key(),
    )
    for candidate in fallback_candidates:
        if not candidate:
            continue
        resolved_candidate = _validate_jira_project_candidate(candidate, allow_fallback=True)
        if resolved_candidate:
            return resolved_candidate
    return ""


def _validate_jira_project_candidate(candidate: str, *, allow_fallback: bool) -> str:
    exists = jira_project_exists(candidate)
    if exists is True:
        return candidate
    if exists is None:
        raise RuntimeError(
            f"Jira project validation for '{candidate}' could not complete due to a transient API failure."
        )
    if allow_fallback:
        return ""
    raise RuntimeError(
        f"Configured Jira project '{candidate}' does not exist or is not accessible."
    )


def infer_jira_project_key_from_sync_state(state_path: Path | None = None) -> str:
    payload = _load_runtime_state(state_path)
    records = payload.get("records")
    if not isinstance(records, Mapping):
        return ""

    project_keys: set[str] = set()
    for record in records.values():
        if not isinstance(record, Mapping):
            continue
        provider_ids = record.get("provider_ids")
        if not isinstance(provider_ids, Mapping):
            continue
        jira_id = provider_ids.get("jira")
        project_key = _extract_jira_project_key(jira_id)
        if project_key:
            project_keys.add(project_key)

    if len(project_keys) == 1:
        return next(iter(project_keys))
    return ""


def _extract_jira_project_key(jira_issue_id: Any) -> str:
    if not isinstance(jira_issue_id, str):
        return ""
    match = re.match(r"^\s*([A-Za-z][A-Za-z0-9]+)-\d+\s*$", jira_issue_id)
    return match.group(1).upper() if match else ""


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


def resolve_jira_issue_type(project_key: str) -> dict[str, str]:
    configured_issue_type = _strip_env("JIRA_ISSUE_TYPE") or "Task"
    cache_key = f"{project_key}:{configured_issue_type or 'default'}".upper()
    cached_issue_type = _JIRA_ISSUE_TYPE_CACHE.get(cache_key)
    if cached_issue_type is not None:
        return dict(cached_issue_type)

    issue_types = _fetch_jira_project_issue_types(project_key)
    issue_type = (
        _match_jira_issue_type(issue_types, configured_issue_type)
        or _first_standard_jira_issue_type(issue_types)
        or _jira_issue_type_field(configured_issue_type)
    )

    _JIRA_ISSUE_TYPE_CACHE[cache_key] = dict(issue_type)
    return dict(issue_type)


def _jira_issue_type_field(value: str) -> dict[str, str]:
    normalized = value.strip()
    if normalized.isdigit():
        return {"id": normalized}
    return {"name": normalized}


def _fetch_jira_project_issue_types(project_key: str) -> list[Mapping[str, Any]]:
    site_url = resolve_jira_site_url()
    headers = build_jira_auth_header(resolve_jira_user(), resolve_jira_token())
    url = f"{site_url}/rest/api/3/issue/createmeta/{parse.quote(project_key)}/issuetypes"
    payload = _json_request("GET", url, headers=headers)
    raw_issue_types = payload.get("issueTypes", payload if isinstance(payload, list) else [])
    if not isinstance(raw_issue_types, list):
        return []
    return [issue_type for issue_type in raw_issue_types if isinstance(issue_type, Mapping)]


def _match_jira_issue_type(
    issue_types: list[Mapping[str, Any]],
    configured_issue_type: str,
) -> dict[str, str] | None:
    normalized_target = configured_issue_type.strip().lower()
    for issue_type in issue_types:
        issue_type_id = _coerce_provider_target_id(issue_type.get("id"))
        if issue_type_id and issue_type_id == configured_issue_type.strip():
            return {"id": issue_type_id}

        issue_type_name = _coerce_provider_target_id(issue_type.get("name"))
        if issue_type_name and issue_type_name.lower() == normalized_target:
            return {"id": issue_type_id} if issue_type_id else {"name": issue_type_name}
    return None


def _first_standard_jira_issue_type(
    issue_types: list[Mapping[str, Any]],
) -> dict[str, str] | None:
    for issue_type in issue_types:
        if issue_type.get("subtask") is True:
            continue
        issue_type_id = _coerce_provider_target_id(issue_type.get("id"))
        issue_type_name = _coerce_provider_target_id(issue_type.get("name"))
        if issue_type_id:
            return {"id": issue_type_id}
        if issue_type_name:
            return {"name": issue_type_name}
    return None


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


def extract_provider_target_id(provider: str, payload: Mapping[str, Any]) -> str | None:
    if provider == "asana":
        return _coerce_provider_target_id(payload.get("gid") or payload.get("id"))
    if provider == "jira":
        return _coerce_provider_target_id(payload.get("key") or payload.get("id"))
    return None


def _coerce_provider_target_id(value: Any) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    return normalized or None


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


def jira_create_payload(
    action: Any,
    project_key: str,
    issue_type: Mapping[str, str],
) -> dict[str, Any]:
    return {
        "fields": {
            "project": {"key": project_key},
            "issuetype": dict(issue_type),
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
    headers = build_asana_headers(token)

    tasks: list[dict[str, Any]] = []
    seen_task_ids: set[str] = set()
    failures: list[str] = []
    project_ids = resolve_asana_project_ids()
    worker_count = max(1, min(DEFAULT_ASANA_EXPORT_WORKERS, len(project_ids)))
    with ThreadPoolExecutor(max_workers=worker_count) as executor:
        futures = {
            executor.submit(_fetch_asana_project_tasks, project_id, headers): project_id
            for project_id in project_ids
        }
        for future in as_completed(futures):
            project_id = futures[future]
            try:
                project_tasks = future.result()
            except Exception as exc:
                failures.append(f"{project_id}: {exc}")
                continue
            for task in project_tasks:
                if _track_seen_asana_task(task, seen_task_ids):
                    tasks.append(task)
    if failures:
        failed_projects = "; ".join(failures)
        raise RuntimeError(f"Failed to export tasks from Asana projects: {failed_projects}")
    return tasks


def _track_seen_asana_task(task: Mapping[str, Any], seen_task_ids: set[str]) -> bool:
    task_id = str(task.get("gid") or "").strip()
    if task_id and task_id in seen_task_ids:
        return False
    if task_id:
        seen_task_ids.add(task_id)
    return True


def _fetch_asana_project_tasks(
    project_id: str,
    headers: Mapping[str, str],
) -> list[dict[str, Any]]:
    project_tasks: list[dict[str, Any]] = []
    for task in _iter_asana_project_task_payloads(project_id, headers):
        project_tasks.append(dict(task))
    return project_tasks


def _iter_asana_project_task_payloads(
    project_id: str,
    headers: Mapping[str, str],
):
    fields = "gid,name,notes,completed,modified_at"
    offset = ""
    while True:
        payload = _request_asana_project_task_page(project_id, headers, fields, offset)
        yield from _extract_asana_task_payloads(payload)
        offset = _next_asana_page_offset(payload)
        if not offset:
            break


def _request_asana_project_task_page(
    project_id: str,
    headers: Mapping[str, str],
    fields: str,
    offset: str,
) -> Mapping[str, Any]:
    query = {
        "limit": "100",
        "opt_fields": fields,
        "completed_since": resolve_asana_completed_since(),
    }
    if offset:
        query["offset"] = offset
    url = (
        f"https://app.asana.com/api/1.0/projects/{project_id}/tasks?"
        f"{parse.urlencode(query)}"
    )
    return _json_request("GET", url, headers=headers)


def _extract_asana_task_payloads(payload: Mapping[str, Any]):
    for task in payload.get("data", []):
        if isinstance(task, Mapping):
            yield task


def _next_asana_page_offset(payload: Mapping[str, Any]) -> str:
    next_page = payload.get("next_page") or {}
    return str(next_page.get("offset") or "")


def apply_asana_action(action: Mapping[str, Any]) -> dict[str, Any]:
    token = resolve_asana_token()
    headers = build_asana_headers(token)
    target_id = str(action.get("target_id") or "").strip()
    action_type = str(action.get("action") or "").strip()
    action_view = _object_view(action)

    if action_type == "create":
        return _create_asana_task(action_view, headers)
    return _update_asana_task(action_view, target_id, headers)


def _create_asana_task(action: Any, headers: Mapping[str, str]) -> dict[str, Any]:
    project_id = resolve_asana_project_id()
    payload = asana_create_payload(action, project_id)
    response = _json_request(
        "POST",
        "https://app.asana.com/api/1.0/tasks",
        headers=headers,
        payload=payload,
    )
    return _unwrap_asana_resource(response)


def _update_asana_task(
    action: Any,
    target_id: str,
    headers: Mapping[str, str],
) -> dict[str, Any]:
    if not target_id:
        raise RuntimeError("Asana update requires target_id.")
    payload = asana_update_payload(action)
    response = _json_request(
        "PUT",
        f"https://app.asana.com/api/1.0/tasks/{target_id}",
        headers=headers,
        payload=payload,
    )
    return _unwrap_asana_resource(response)


def _unwrap_asana_resource(response: Any) -> dict[str, Any]:
    resource = response.get("data") if isinstance(response, Mapping) else None
    if not isinstance(resource, Mapping):
        raise RuntimeError(
            "Asana API response did not include a resource payload: "
            f"{json.dumps(response, sort_keys=True, default=str)}"
        )
    return dict(resource)


def apply_provider_action(provider: str, action: Mapping[str, Any]) -> dict[str, Any]:
    if provider == "asana":
        return apply_asana_action(action)
    if provider == "jira":
        return apply_jira_action(action)
    raise RuntimeError(f"Unsupported provider bridge action for '{provider}'.")


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
            resolve_jira_issue_type(project_key),
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
    issue_key = str(response.get("key") or target_id or "").strip()
    desired_status = str(action.get("status") or "open").strip()
    if issue_key:
        _sync_jira_issue_status(site_url, headers, issue_key, desired_status)
    return response


def _sync_jira_issue_status(
    site_url: str,
    headers: Mapping[str, str],
    issue_key: str,
    desired_status: str,
) -> None:
    normalized_status = desired_status.strip().lower()
    target_category = _target_jira_status_category(normalized_status)
    if not target_category:
        return

    current_category = _fetch_jira_status_category(site_url, headers, issue_key)
    if current_category == target_category:
        return

    transition_id = _resolve_jira_transition_id(
        site_url,
        headers,
        issue_key,
        target_category,
        normalized_status,
    )
    if not transition_id:
        return

    _json_request(
        "POST",
        f"{site_url}/rest/api/3/issue/{issue_key}/transitions",
        headers=headers,
        payload={"transition": {"id": transition_id}},
    )


def _fetch_jira_status_category(
    site_url: str,
    headers: Mapping[str, str],
    issue_key: str,
) -> str:
    payload = _json_request(
        "GET",
        f"{site_url}/rest/api/3/issue/{issue_key}?fields=status",
        headers=headers,
    )
    fields = payload.get("fields")
    if not isinstance(fields, Mapping):
        return ""
    status = fields.get("status")
    if not isinstance(status, Mapping):
        return ""
    status_category = status.get("statusCategory")
    if not isinstance(status_category, Mapping):
        return ""
    category_key = status_category.get("key")
    return str(category_key or "").strip().lower()


def _target_jira_status_category(status: str) -> str:
    normalized = status.strip().lower().replace("_", " ")
    if normalized in {"closed", "done", "resolved", "complete", "completed"}:
        return "done"
    if normalized in {"in progress", "review", "under review", "doing", "active", "in_progress"}:
        return "indeterminate"
    return "todo"


def _resolve_jira_transition_id(
    site_url: str,
    headers: Mapping[str, str],
    issue_key: str,
    target_category: str,
    normalized_status: str,
) -> str:
    payload = _json_request(
        "GET",
        f"{site_url}/rest/api/3/issue/{issue_key}/transitions",
        headers=headers,
    )
    transitions = payload.get("transitions")
    if not isinstance(transitions, list):
        return ""

    for transition in transitions:
        if not isinstance(transition, Mapping):
            continue
        transition_id = _coerce_provider_target_id(transition.get("id")) or ""
        to_status = transition.get("to")
        if not isinstance(to_status, Mapping):
            continue
        status_category = to_status.get("statusCategory")
        category_key = ""
        status_name = ""
        if isinstance(status_category, Mapping):
            category_key = str(status_category.get("key") or "").strip().lower()
        status_name = str(to_status.get("name") or "").strip().lower()
        if transition_id and category_key == target_category:
            return transition_id
        if transition_id and _jira_status_name_matches_target(status_name, normalized_status):
            return transition_id
    return ""


def _jira_status_name_matches_target(status_name: str, normalized_status: str) -> bool:
    if not status_name:
        return False
    if normalized_status in {"closed", "done", "resolved", "complete", "completed"}:
        return any(token in status_name for token in ("done", "closed", "resolved", "complete"))
    if normalized_status in {
        "in_progress",
        "in progress",
        "review",
        "under review",
        "doing",
        "active",
    }:
        return any(token in status_name for token in ("progress", "review", "doing", "active"))
    return any(token in status_name for token in ("to do", "todo", "open", "backlog", "selected"))


class _ObjectView:
    def __init__(self, payload: Mapping[str, Any]) -> None:
        self.title = str(payload.get("title") or "")
        self.body = str(payload.get("body") or "")
        self.status = str(payload.get("status") or "open")


def _object_view(payload: Mapping[str, Any]) -> _ObjectView:
    return _ObjectView(payload)
