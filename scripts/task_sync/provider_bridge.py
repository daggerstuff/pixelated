"""Provider bridge helpers for tri-sync export/apply scripts."""

from __future__ import annotations

import base64
import contextlib
import importlib
import json
import sys
import time
from collections.abc import Mapping, Sequence
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any
from urllib import parse, request
from urllib.error import HTTPError

from scripts.task_sync.provider_config import (
    _strip_env,
    resolve_asana_completed_since,
    resolve_asana_project_id,
    resolve_asana_project_ids,
    resolve_asana_token,
    resolve_jira_issue_type,
    resolve_jira_project_key,
    resolve_jira_site_url,
    resolve_jira_token,
    resolve_jira_user,
)


def print_out(msg: str = "", file=sys.stdout) -> None:
    file.write(f"{msg}\n")
    file.flush()


DEFAULT_CONFIG_PATH = Path(".agent/internal/config.json")
DEFAULT_RUNTIME_STATE_PATH = Path(".agent/internal/task-sync-state.json")
DEFAULT_JIRA_PROJECT_NAME = "Pixelated Empathy"
DEFAULT_JIRA_PROJECT_TYPE = "business"
DEFAULT_ASANA_EXPORT_WORKERS = 16
DEFAULT_ASANA_COMPLETED_SINCE = "1970-01-01T00:00:00Z"
DEFAULT_GITHUB_API_URL = "https://api.github.com"
DEFAULT_LINEAR_API_URL = "https://api.linear.app/graphql"
DEFAULT_JIRA_PROJECT_TEMPLATES = (
    "com.atlassian.jira-core-project-templates:jira-core-simplified-project-management",
    "com.atlassian.jira-core-project-templates:jira-core-simplified-process-control",
)
_JIRA_PROJECT_EXISTS_CACHE: dict[str, bool] = {}
_JIRA_ISSUE_TYPE_CACHE: dict[str, dict[str, str]] = {}
_LINEAR_LABEL_IDS_CACHE: dict[str, str] = {}

# Canonical priority label → Jira ADHD priority name
PRIORITY_TO_JIRA: dict[str, str] = {
    "urgent": "Highest",
    "high": "High",
    "medium": "Medium",
    "low": "Low",
    "none": "Lowest",
}

# Canonical priority label → Linear numeric priority (0=urgent, 1=high, 2=medium, 3=low, 4=none)
PRIORITY_TO_LINEAR: dict[str, int] = {
    "urgent": 0,
    "high": 1,
    "medium": 2,
    "low": 3,
    "none": 4,
}

_PROVIDER_CONFIG_REEXPORTS = frozenset(
    {
        "_build_asana_project_defaults",
        "_collect_project_ids",
        "_dedupe_project_ids",
        "_discover_first_jira_project",
        "_empty_asana_project_defaults",
        "_ensure_runtime_jira_state",
        "_extract_jira_project_key",
        "_fetch_jira_project_issue_types",
        "_first_standard_jira_issue_type",
        "_jira_combined_key",
        "_jira_condensed_key",
        "_jira_initials_key",
        "_jira_issue_type_field",
        "_load_asana_config",
        "_load_internal_config",
        "_load_runtime_state",
        "_match_jira_issue_type",
        "_normalize_project_id",
        "_parse_asana_task_sync_projects",
        "_read_asana_project_defaults",
        "_read_static_jira_project_key",
        "_resolve_asana_project_defaults_from_sources",
        "_resolve_asana_project_ids_from_config",
        "_resolve_default_asana_project_id",
        "_validate_jira_project_candidate",
        "_write_internal_config",
        "_write_runtime_state",
        "attempt_jira_project_create",
        "create_jira_project",
        "ensure_jira_project",
        "fetch_jira_account_id",
        "infer_jira_project_key_from_sync_state",
        "jira_project_bootstrap_payloads",
        "jira_project_exists",
        "jira_project_key_candidates",
        "jira_project_template_candidates",
        "persist_default_jira_project",
        "read_default_asana_project_id",
        "read_default_asana_project_ids",
        "read_default_jira_project_key",
        "read_runtime_jira_project_key",
        "resolve_configured_jira_project_key",
        "resolve_discovered_jira_project_key",
        "resolve_jira_project_name",
    }
)


def __getattr__(name: str) -> Any:
    if name in _PROVIDER_CONFIG_REEXPORTS:
        return getattr(importlib.import_module("scripts.task_sync.provider_config"), name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def build_asana_headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def build_jira_auth_header(user: str, token: str) -> dict[str, str]:
    encoded = base64.b64encode(f"{user}:{token}".encode()).decode("ascii")
    return {
        "Authorization": f"Basic {encoded}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def resolve_github_api_url() -> str:
    return _strip_env("GITHUB_API_URL") or _strip_env("GITHUB_ENTERPRISE_URL") or DEFAULT_GITHUB_API_URL


def resolve_github_token() -> str:
    token = _strip_env("GITHUB_TOKEN") or _strip_env("GITHUB_ACCESS_TOKEN")
    if not token:
        raise RuntimeError("Missing GitHub token. Set GITHUB_TOKEN.")
    return token


def resolve_github_repo_owner() -> str:
    owner = _strip_env("GITHUB_OWNER") or _strip_env("GITHUB_REPO_OWNER")
    if not owner:
        raise RuntimeError("Missing GitHub repo owner. Set GITHUB_OWNER.")
    return owner


def resolve_github_repo() -> str:
    repo = _strip_env("GITHUB_REPO") or _strip_env("GITHUB_REPOSITORY_NAME")
    if not repo:
        raise RuntimeError("Missing GitHub repository name. Set GITHUB_REPO.")
    return repo


def build_github_headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "pixelated-task-sync",
    }


def resolve_linear_api_url() -> str:
    return _strip_env("LINEAR_API_URL") or DEFAULT_LINEAR_API_URL


def resolve_linear_token() -> str:
    token = _strip_env("LINEAR_API_KEY") or _strip_env("LINEAR_TOKEN")
    if not token:
        raise RuntimeError("Missing Linear API token. Set LINEAR_API_KEY.")
    return token


def resolve_linear_team_id() -> str:
    return _strip_env("LINEAR_TEAM_ID")


def resolve_linear_project_id() -> str:
    return _strip_env("LINEAR_PROJECT_ID")


def resolve_linear_parent_issue_id() -> str:
    return _strip_env("LINEAR_PARENT_ISSUE_ID")


def _linear_project_workflow_query(project_id: str) -> str:
    return f'query {{ project(id: "{project_id}") {{ name team {{ states {{ nodes {{ id name type }} }} }} }} }}'


def _canonical_linear_status_candidates(status: str) -> tuple[str, ...]:
    normalized = status.strip().lower().replace("-", " ").replace("_", " ")
    if normalized in {"closed", "done", "resolved", "complete", "completed", "cancelled", "canceled"}:
        return ("done", "closed", "completed", "canceled", "cancelled", "duplicate")
    if normalized in {"review", "in review", "under review"}:
        return ("review", "in review", "under review")
    if normalized in {"in progress", "doing", "active", "started"}:
        return ("in progress", "doing", "active", "started")
    if normalized in {"triage"}:
        return ("triage",)
    return ("backlog", "todo", "to do", "open", "unstarted")


def _resolve_linear_state_id(status: str, project_id: str) -> str | None:
    if not project_id:
        return None
    response = _extract_graphql_payload(_linear_graphql_query(_linear_project_workflow_query(project_id)))
    project = response.get("project")
    if not isinstance(project, Mapping):
        return None
    team = project.get("team")
    if not isinstance(team, Mapping):
        return None
    states = team.get("states")
    if not isinstance(states, Mapping):
        return None
    nodes = states.get("nodes")
    if not isinstance(nodes, list):
        return None

    candidates = _canonical_linear_status_candidates(status)
    result = None
    for candidate in candidates:
        for node in nodes:
            if not isinstance(node, Mapping):
                continue
            node_id = _coerce_provider_target_id(node.get("id"))
            node_name = str(node.get("name") or "").strip().lower()
            node_type = str(node.get("type") or "").strip().lower().replace("_", " ")
            if node_id and candidate in {node_name, node_type}:
                result = node_id
                break
        if result is not None:
            break
    return result


def build_linear_headers(token: str) -> dict[str, str]:
    auth = token if token.startswith("lin_api_") else f"Bearer {token}"
    return {
        "Authorization": auth,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def _linear_issues_query(filter_by_team: str = "", filter_by_project: str = "") -> str:
    filter_parts: list[str] = []
    if filter_by_team:
        filter_parts.append(f'team: {{ id: {{ eq: "{filter_by_team}" }} }}')
    if filter_by_project:
        filter_parts.append(f'project: {{ id: {{ eq: "{filter_by_project}" }} }}')
    filter_clause = ""
    if filter_parts:
        filter_clause = f", filter: {{ {' '.join(filter_parts)} }}"
    return (
        "query($after: String) { "
        "issues(first: 100, after: $after"
        f"{filter_clause}"
        ") { nodes { id identifier title description project { id name } state { id name type } updatedAt createdAt } pageInfo { hasNextPage endCursor } } }"
    )


def _linear_graphql_query(query: str, variables: Mapping[str, Any] | None = None) -> Any:
    api_url = resolve_linear_api_url()
    headers = build_linear_headers(resolve_linear_token())
    payload: dict[str, Any] = {"query": query}
    if variables is not None:
        payload["variables"] = dict(variables)
    return _json_request("POST", api_url, headers=headers, payload=payload)


def _extract_graphql_payload(response: Any) -> Any:
    if not isinstance(response, Mapping):
        raise RuntimeError(f"Linear API response was malformed: {response}")
    if "errors" in response:
        raise RuntimeError(f"Linear GraphQL reported errors: {response['errors']}")
    return response.get("data", {})


def extract_provider_target_id(provider: str, payload: Mapping[str, Any]) -> str | None:
    if provider == "asana":
        return _coerce_provider_target_id(payload.get("gid") or payload.get("id"))
    if provider == "jira":
        return _coerce_provider_target_id(payload.get("key") or payload.get("id"))
    if provider == "github":
        return _coerce_provider_target_id(payload.get("number") or payload.get("id"))
    if provider == "linear":
        return _coerce_provider_target_id(payload.get("id"))
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
    fields: dict[str, Any] = {
        "project": {"key": project_key},
        "issuetype": dict(issue_type),
        "summary": action.title,
        "description": jira_adf_document(action.body),
    }
    priority_label = getattr(action, "priority_label", None)
    if priority_label and priority_label in PRIORITY_TO_JIRA:
        fields["priority"] = {"name": PRIORITY_TO_JIRA[priority_label]}
    labels = getattr(action, "labels", None)
    if labels:
        fields["labels"] = list(labels)
    return {"fields": fields}


def jira_update_payload(action: Any) -> dict[str, Any]:
    fields: dict[str, Any] = {
        "summary": action.title,
        "description": jira_adf_document(action.body),
    }
    priority_label = getattr(action, "priority_label", None)
    if priority_label and priority_label in PRIORITY_TO_JIRA:
        fields["priority"] = {"name": PRIORITY_TO_JIRA[priority_label]}
    labels = getattr(action, "labels", None)
    if labels:
        fields["labels"] = list(labels)
    return {"fields": fields}


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

    max_retries = 5
    backoff = 2.0

    for attempt in range(max_retries):
        try:
            with request.urlopen(req) as response:
                body = response.read().decode("utf-8")
                if not body:
                    return {}
                return json.loads(body)
        except HTTPError as exc:
            if exc.code in (429, 500, 502, 503, 504) and attempt < max_retries - 1:
                retry_after = exc.headers.get("Retry-After")
                sleep_time = backoff**attempt
                if retry_after:
                    with contextlib.suppress(ValueError):
                        sleep_time = max(sleep_time, float(retry_after))
                print_out(
                    f"Warning: {method} {url} failed with HTTP {exc.code} (attempt {attempt + 1}/{max_retries}). "
                    f"Retrying in {sleep_time:.2f} seconds...",
                    file=sys.stderr,
                )
                time.sleep(sleep_time)
                continue
            error_body = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"{method} {url} failed with HTTP {exc.code}: {error_body}") from exc
        except Exception as exc:
            if attempt < max_retries - 1:
                sleep_time = backoff**attempt
                print_out(
                    f"Warning: {method} {url} encountered transient error {exc} (attempt {attempt + 1}/{max_retries}). "
                    f"Retrying in {sleep_time:.2f} seconds...",
                    file=sys.stderr,
                )
                time.sleep(sleep_time)
                continue
            raise
    return {}


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
            executor.submit(_fetch_asana_project_tasks, project_id, headers): project_id for project_id in project_ids
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
        print_out(
            f"Warning: Failed to export tasks from some Asana projects (gracefully skipping): {failed_projects}",
            file=sys.stderr,
        )
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
    url = f"https://app.asana.com/api/1.0/projects/{project_id}/tasks?{parse.urlencode(query)}"
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
    try:
        return _update_asana_task(action_view, target_id, headers)
    except Exception as exc:
        if any(code in str(exc) for code in ("403", "404")):
            print_out(
                f"Warning: Asana task update for {target_id} failed with access/not-found error ({exc}). "
                f"Gracefully falling back to creating a new task.",
                file=sys.stderr,
            )
            return _create_asana_task(action_view, headers)
        raise


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
    if provider == "github":
        return apply_github_action(action)
    if provider == "linear":
        return apply_linear_action(action)
    raise RuntimeError(f"Unsupported provider bridge action for '{provider}'.")


def export_jira_issues() -> list[dict[str, Any]]:
    site_url = resolve_jira_site_url()
    headers = build_jira_auth_header(resolve_jira_user(), resolve_jira_token())
    project_key = resolve_jira_project_key(create_if_missing=True)
    jql = jira_search_jql(project_key)

    issues: list[dict[str, Any]] = []
    next_page_token = None
    max_results = 100

    while True:
        params = {
            "jql": jql,
            "fields": "summary,description,status,updated",
            "maxResults": str(max_results),
        }
        if next_page_token:
            params["nextPageToken"] = next_page_token

        url = f"{site_url}/rest/api/3/search/jql?{parse.urlencode(params)}"
        payload = _json_request("GET", url, headers=headers)
        batch = payload.get("issues", [])
        issues.extend(batch)

        if payload.get("isLast") or not payload.get("nextPageToken"):
            break
        next_page_token = payload.get("nextPageToken")

    return issues


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
        try:
            _json_request(
                "PUT",
                f"{site_url}/rest/api/3/issue/{target_id}",
                headers=headers,
                payload=payload,
            )
            response = {"key": target_id}
        except Exception as exc:
            if any(code in str(exc) for code in ("403", "404")):
                print_out(
                    f"Warning: Jira issue update for {target_id} failed with access/not-found error ({exc}). "
                    f"Gracefully falling back to creating a new issue.",
                    file=sys.stderr,
                )
                project_key = resolve_jira_project_key(create_if_missing=True)
                if not project_key:
                    raise RuntimeError("No accessible Jira project key found for tri-sync.") from exc
                create_payload = jira_create_payload(
                    _object_view(action),
                    project_key,
                    resolve_jira_issue_type(project_key),
                )
                response = _json_request(
                    "POST",
                    f"{site_url}/rest/api/3/issue",
                    headers=headers,
                    payload=create_payload,
                )
            else:
                raise
    issue_key = str(response.get("key") or target_id or "").strip()
    desired_status = str(action.get("status") or "open").strip()
    if issue_key:
        _sync_jira_issue_status(site_url, headers, issue_key, desired_status)
    return response


def export_github_issues() -> list[dict[str, Any]]:
    api_url = resolve_github_api_url().rstrip("/")
    owner = resolve_github_repo_owner()
    repo = resolve_github_repo()
    token = resolve_github_token()
    headers = build_github_headers(token)

    issues: list[dict[str, Any]] = []
    page = 1
    while True:
        query = parse.urlencode(
            {
                "state": "all",
                "per_page": "100",
                "page": str(page),
                "sort": "updated",
                "direction": "desc",
            }
        )
        payload = _json_request("GET", f"{api_url}/repos/{owner}/{repo}/issues?{query}", headers=headers)
        if not isinstance(payload, list) or not payload:
            break
        issues.extend(dict(item) for item in payload if isinstance(item, Mapping) and "pull_request" not in item)
        if len(payload) < 100:
            break
        page += 1
    return issues


def apply_github_action(action: Mapping[str, Any]) -> dict[str, Any]:
    api_url = resolve_github_api_url().rstrip("/")
    owner = resolve_github_repo_owner()
    repo = resolve_github_repo()
    token = resolve_github_token()
    headers = build_github_headers(token)

    action_type = str(action.get("action") or "").strip()
    target_id = str(action.get("target_id") or "").strip()
    raw_labels = action.get("labels")
    labels = list(raw_labels) if isinstance(raw_labels, (list, tuple)) else []
    payload: dict[str, Any] = {
        "title": str(action.get("title") or ""),
        "body": str(action.get("body") or ""),
        "state": "closed" if str(action.get("status") or "").strip() == "closed" else "open",
    }
    if labels:
        payload["labels"] = labels
    if action_type == "create":
        response = _json_request(
            "POST",
            f"{api_url}/repos/{owner}/{repo}/issues",
            headers=headers,
            payload=payload,
        )
        if not isinstance(response, Mapping):
            return {}
        return dict(response)

    if not target_id:
        raise RuntimeError("GitHub update requires target_id.")
    try:
        _json_request(
            "PATCH",
            f"{api_url}/repos/{owner}/{repo}/issues/{target_id}",
            headers=headers,
            payload=payload,
        )
        return {"id": target_id}
    except Exception as exc:
        if any(code in str(exc) for code in ("403", "404")):
            print_out(
                f"Warning: GitHub issue update for {target_id} failed with access/not-found error ({exc}). "
                f"Gracefully falling back to creating a new issue.",
                file=sys.stderr,
            )
            response = _json_request(
                "POST",
                f"{api_url}/repos/{owner}/{repo}/issues",
                headers=headers,
                payload=payload,
            )
            if not isinstance(response, Mapping):
                return {}
            return dict(response)
        raise


def export_linear_issues() -> list[dict[str, Any]]:
    team_id = resolve_linear_team_id()
    project_id = resolve_linear_project_id()
    query = _linear_issues_query(team_id, project_id)
    cursor: str | None = None
    issues: list[dict[str, Any]] = []

    while True:
        response = _extract_graphql_payload(_linear_graphql_query(query, {"after": cursor}))
        issues_payload = response.get("issues")
        if not isinstance(issues_payload, Mapping):
            break

        nodes = issues_payload.get("nodes")
        if isinstance(nodes, list):
            for node in nodes:
                if isinstance(node, Mapping):
                    issues.append(dict(node))

        page_info = issues_payload.get("pageInfo")
        if not isinstance(page_info, Mapping) or not bool(page_info.get("hasNextPage")):
            break
        cursor = _coerce_provider_target_id(page_info.get("endCursor"))
        if not cursor:
            break

    return issues


def _resolve_linear_label_ids(label_names: Sequence[str]) -> list[str]:
    """Resolve Linear label names to their GraphQL IDs for the configured team.

    Results are cached in `_LINEAR_LABEL_IDS_CACHE` to avoid repeated lookups.
    Only returns IDs for label names that exist in the team's label set.
    """
    if not label_names:
        return []

    team_id = resolve_linear_team_id()
    if not team_id:
        return []

    if not _LINEAR_LABEL_IDS_CACHE:
        query = "query($teamId: String!) { team(id: $teamId) { labels { nodes { id name } } } }"
        response = _extract_graphql_payload(_linear_graphql_query(query, {"teamId": team_id}))
        team = response.get("team") if isinstance(response, Mapping) else None
        label_nodes: list[Any] = []
        if isinstance(team, Mapping):
            labels_container = team.get("labels")
            if isinstance(labels_container, Mapping):
                label_nodes = labels_container.get("nodes") or []
        for node in label_nodes:
            if isinstance(node, Mapping):
                label_id = str(node.get("id") or "")
                label_name = str(node.get("name") or "").strip()
                if label_id and label_name:
                    _LINEAR_LABEL_IDS_CACHE[label_name.lower()] = label_id

    resolved: list[str] = []
    for name in label_names:
        label_id = _LINEAR_LABEL_IDS_CACHE.get(name.strip().lower())
        if label_id:
            resolved.append(label_id)
    return resolved


def apply_linear_action(action: Mapping[str, Any]) -> dict[str, Any]:
    action_type = str(action.get("action") or "").strip()
    target_id = _coerce_provider_target_id(action.get("target_id"))

    if action_type != "create" and not target_id:
        raise RuntimeError("Linear update requires target_id.")

    input_payload: dict[str, Any] = {
        "title": str(action.get("title") or ""),
        "description": str(action.get("body") or ""),
    }
    raw_priority_label = str(action.get("priority_label") or "").strip().lower()
    if raw_priority_label and raw_priority_label in PRIORITY_TO_LINEAR:
        input_payload["priority"] = PRIORITY_TO_LINEAR[raw_priority_label]

    raw_labels = action.get("labels")
    if raw_labels:
        label_names = [str(lbl).strip() for lbl in raw_labels if lbl]
        label_ids = _resolve_linear_label_ids(label_names)
        if label_ids:
            input_payload["labelIds"] = label_ids

    desired_status = str(action.get("status") or "").strip()
    project_id = resolve_linear_project_id()
    state_id = _resolve_linear_state_id(desired_status, project_id) if desired_status and project_id else None
    if state_id:
        input_payload["stateId"] = state_id

    if action_type == "create":
        mutation = "mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id title } } }"
        key = "issueCreate"
        variables: dict[str, Any] = {"input": input_payload}
        optional_fields = {
            "teamId": resolve_linear_team_id(),
            "projectId": project_id,
            "parentId": resolve_linear_parent_issue_id(),
        }
        for field, value in optional_fields.items():
            if value:
                input_payload[field] = value
    else:
        mutation = (
            "mutation($id: String!, $input: IssueUpdateInput!) { "
            "issueUpdate(id: $id, input: $input) { success issue { id title } } }"
        )
        key = "issueUpdate"
        variables: dict[str, Any] = {"input": input_payload, "id": target_id}

    response = _extract_graphql_payload(_linear_graphql_query(mutation, variables))
    container = response.get(key)
    issue = container.get("issue") if isinstance(container, Mapping) else None
    if not isinstance(issue, Mapping):
        if target_id and key == "issueUpdate":
            return {"id": target_id}
        return {}

    issue_id = _coerce_provider_target_id(issue.get("id"))
    if issue_id or target_id:
        return {"id": issue_id or target_id}
    return {}


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
        self.priority_label = str(payload["priority_label"]) if payload.get("priority_label") else None
        labels_raw = payload.get("labels")
        self.labels = list(labels_raw) if isinstance(labels_raw, (list, tuple)) else []


def _object_view(payload: Mapping[str, Any]) -> _ObjectView:
    return _ObjectView(payload)
