"""Asana task sync provider implementation."""

from __future__ import annotations

from collections.abc import Mapping
from pathlib import Path
from typing import Any
from urllib import parse

from .config import _load_internal_config, _strip_env
from .utils import _json_request, _object_view


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
    return str(_load_internal_config(config_path).get("asana_project_id", "")).strip()

def build_asana_headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
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

    view = _object_view(action)
    if not view.target_id:
        payload = asana_create_payload(view, project_id)
        response = _json_request(
            "POST", "https://app.asana.com/api/1.0/tasks", headers=headers, payload=payload
        )
        return response.get("data", {})
    else:
        payload = asana_update_payload(view)
        response = _json_request(
            "PUT",
            f"https://app.asana.com/api/1.0/tasks/{view.target_id}",
            headers=headers,
            payload=payload,
        )
        return response.get("data", {})
