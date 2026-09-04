"""Provider config and Jira project bootstrap helpers for provider_bridge."""

from __future__ import annotations

import json
import os
import re
from collections.abc import Mapping
from pathlib import Path
from typing import Any
from urllib import parse, request
from urllib.error import HTTPError

from scripts.task_sync import provider_bridge as _provider_bridge


def _strip_env(name: str) -> str:
    return os.getenv(name, "").strip()


def resolve_asana_completed_since() -> str:
    return _strip_env("PIXELATED_ASANA_COMPLETED_SINCE") or _provider_bridge.DEFAULT_ASANA_COMPLETED_SINCE


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
            project_id for project_id in (candidate.strip() for candidate in raw_project_ids.split(",")) if project_id
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
        mtgc_value = all_projects.get("master_training_gap_closure")
        mtgc_project_id = _normalize_project_id(mtgc_value)
        if mtgc_project_id:
            return mtgc_project_id

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
    path = config_path or _provider_bridge.DEFAULT_CONFIG_PATH
    if not path.exists():
        return {}

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return payload if isinstance(payload, dict) else {}


def _write_internal_config(payload: Mapping[str, Any], config_path: Path | None = None) -> None:
    path = config_path or _provider_bridge.DEFAULT_CONFIG_PATH
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
    path = state_path or _provider_bridge.DEFAULT_RUNTIME_STATE_PATH
    if not path.exists():
        return {}

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return payload if isinstance(payload, dict) else {}


def _write_runtime_state(payload: Mapping[str, Any], state_path: Path | None = None) -> None:
    path = state_path or _provider_bridge.DEFAULT_RUNTIME_STATE_PATH
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
    project = _provider_bridge._discover_first_jira_project()
    if project:
        persist_default_jira_project(project["key"], project["name"])
        return project

    project = _provider_bridge.create_jira_project()
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
    exists = _provider_bridge.jira_project_exists(candidate)
    if exists is True:
        return candidate
    if exists is None:
        raise RuntimeError(
            f"Jira project validation for '{candidate}' could not complete due to a transient API failure."
        )
    if allow_fallback:
        return ""
    raise RuntimeError(f"Configured Jira project '{candidate}' does not exist or is not accessible.")


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
    project = _provider_bridge._discover_first_jira_project()
    if not project:
        return ""
    persist_default_jira_project(project["key"], project["name"])
    return project["key"]


def _discover_first_jira_project() -> dict[str, str] | None:
    site_url = resolve_jira_site_url()
    headers = _provider_bridge.build_jira_auth_header(resolve_jira_user(), resolve_jira_token())
    url = f"{site_url}/rest/api/3/project/search?maxResults=1"
    payload = _provider_bridge._json_request("GET", url, headers=headers)
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
    cached = _provider_bridge._JIRA_PROJECT_EXISTS_CACHE.get(normalized)
    if cached is not None:
        return cached

    site_url = resolve_jira_site_url()
    headers = _provider_bridge.build_jira_auth_header(resolve_jira_user(), resolve_jira_token())
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
            _provider_bridge._JIRA_PROJECT_EXISTS_CACHE[normalized] = False
            return False
        if exc.code in {401, 403}:
            raise RuntimeError(f"Jira project validation failed with HTTP {exc.code}.") from exc
        if exc.code in {408, 409, 425, 429, 500, 502, 503, 504}:
            return None
        raise RuntimeError(
            f"GET {site_url}/rest/api/3/project/{normalized} failed with HTTP {exc.code}: "
            f"{exc.read().decode('utf-8', errors='replace')}"
        ) from exc
    _provider_bridge._JIRA_PROJECT_EXISTS_CACHE[normalized] = True
    return True


def create_jira_project() -> dict[str, str]:
    site_url = resolve_jira_site_url()
    headers = _provider_bridge.build_jira_auth_header(resolve_jira_user(), resolve_jira_token())
    lead_account_id = fetch_jira_account_id(site_url, headers)
    project_name = resolve_jira_project_name()
    last_error: Exception | None = None
    for payload in jira_project_bootstrap_payloads(project_name, lead_account_id):
        try:
            return attempt_jira_project_create(site_url, headers, payload)
        except Exception as exc:
            last_error = exc

    if last_error is not None:
        raise RuntimeError(
            "Jira authenticated but no visible projects exist, and automatic project bootstrap failed."
        ) from last_error
    raise RuntimeError("Jira authenticated but no visible projects exist.")


def resolve_jira_project_name() -> str:
    return _strip_env("PIXELATED_JIRA_PROJECT_NAME") or _strip_env("JIRA_PROJECT_NAME") or _provider_bridge.DEFAULT_JIRA_PROJECT_NAME


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
    return list(_provider_bridge.DEFAULT_JIRA_PROJECT_TEMPLATES)


def fetch_jira_account_id(site_url: str, headers: Mapping[str, str]) -> str:
    current_user = _provider_bridge._json_request("GET", f"{site_url}/rest/api/3/myself", headers=headers)
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
                    "projectTypeKey": _provider_bridge.DEFAULT_JIRA_PROJECT_TYPE,
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
    response = _provider_bridge._json_request(
        "POST",
        f"{site_url}/rest/api/3/project",
        headers=headers,
        payload=payload,
    )
    created_key = str(response.get("key") or payload.get("key") or "").strip()
    created_name = str(response.get("name") or payload.get("name") or "").strip() or created_key
    if not created_key:
        raise RuntimeError("Jira project bootstrap did not return a project key.")
    _provider_bridge._JIRA_PROJECT_EXISTS_CACHE[created_key.upper()] = True
    return {"key": created_key, "name": created_name}


def resolve_jira_issue_type(project_key: str) -> dict[str, str]:
    configured_issue_type = _strip_env("JIRA_ISSUE_TYPE") or "Task"
    cache_key = f"{project_key}:{configured_issue_type or 'default'}".upper()
    cached_issue_type = _provider_bridge._JIRA_ISSUE_TYPE_CACHE.get(cache_key)
    if cached_issue_type is not None:
        return dict(cached_issue_type)

    issue_types = _fetch_jira_project_issue_types(project_key)
    issue_type = (
        _match_jira_issue_type(issue_types, configured_issue_type)
        or _first_standard_jira_issue_type(issue_types)
        or _jira_issue_type_field(configured_issue_type)
    )

    _provider_bridge._JIRA_ISSUE_TYPE_CACHE[cache_key] = dict(issue_type)
    return dict(issue_type)


def _jira_issue_type_field(value: str) -> dict[str, str]:
    normalized = value.strip()
    if normalized.isdigit():
        return {"id": normalized}
    return {"name": normalized}


def _fetch_jira_project_issue_types(project_key: str) -> list[Mapping[str, Any]]:
    site_url = resolve_jira_site_url()
    headers = _provider_bridge.build_jira_auth_header(resolve_jira_user(), resolve_jira_token())
    url = f"{site_url}/rest/api/3/issue/createmeta/{parse.quote(project_key)}/issuetypes"
    payload = _provider_bridge._json_request("GET", url, headers=headers)
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
        issue_type_id = _provider_bridge._coerce_provider_target_id(issue_type.get("id"))
        if issue_type_id and issue_type_id == configured_issue_type.strip():
            return {"id": issue_type_id}

        issue_type_name = _provider_bridge._coerce_provider_target_id(issue_type.get("name"))
        if issue_type_name and issue_type_name.lower() == normalized_target:
            return {"id": issue_type_id} if issue_type_id else {"name": issue_type_name}
    return None


def _first_standard_jira_issue_type(
    issue_types: list[Mapping[str, Any]],
) -> dict[str, str] | None:
    for issue_type in issue_types:
        if issue_type.get("subtask") is True:
            continue
        issue_type_id = _provider_bridge._coerce_provider_target_id(issue_type.get("id"))
        issue_type_name = _provider_bridge._coerce_provider_target_id(issue_type.get("name"))
        if issue_type_id:
            return {"id": issue_type_id}
        if issue_type_name:
            return {"name": issue_type_name}
    return None

