from __future__ import annotations

import base64
import json
from types import SimpleNamespace
from urllib.error import HTTPError

from scripts.task_sync.provider_bridge import (
    asana_create_payload,
    asana_update_payload,
    build_asana_headers,
    build_jira_auth_header,
    create_jira_project,
    export_asana_tasks,
    jira_adf_document,
    jira_project_exists,
    jira_project_key_candidates,
    jira_create_payload,
    jira_search_jql,
    jira_update_payload,
    jira_project_template_candidates,
    resolve_jira_project_key,
    resolve_asana_completed_since,
    read_default_asana_project_id,
    read_default_asana_project_ids,
    read_default_jira_project_key,
    read_runtime_jira_project_key,
    persist_default_jira_project,
    resolve_configured_jira_project_key,
    resolve_discovered_jira_project_key,
    resolve_jira_issue_type,
    resolve_jira_site_url,
)


def test_build_asana_headers_prefers_access_token() -> None:
    headers = build_asana_headers("access-token")

    assert headers["Authorization"] == "Bearer access-token"
    assert headers["Content-Type"] == "application/json"


def test_build_jira_auth_header_uses_basic_auth() -> None:
    headers = build_jira_auth_header("user@example.com", "jira-token")

    expected = base64.b64encode(b"user@example.com:jira-token").decode("ascii")

    assert headers["Authorization"] == f"Basic {expected}"
    assert headers["Accept"] == "application/json"


def test_resolve_jira_site_url_requires_https(monkeypatch) -> None:
    monkeypatch.setenv("JIRA_URL", "http://example.atlassian.net")

    try:
        resolve_jira_site_url()
    except RuntimeError as exc:
        assert "HTTPS" in str(exc)
    else:  # pragma: no cover
        raise AssertionError("Expected HTTPS enforcement failure")


def test_asana_create_payload_includes_project_and_status() -> None:
    action = SimpleNamespace(
        title="Tri-sync rollout",
        body="Ship the sync bridge",
        status="closed",
    )

    payload = asana_create_payload(action, "1213439967113319")

    assert payload == {
        "data": {
            "name": "Tri-sync rollout",
            "notes": "Ship the sync bridge",
            "completed": True,
            "projects": ["1213439967113319"],
        }
    }


def test_asana_update_payload_omits_project_assignment() -> None:
    action = SimpleNamespace(
        title="Tri-sync rollout",
        body="Ship the sync bridge",
        status="open",
    )

    payload = asana_update_payload(action)

    assert payload == {
        "data": {
            "name": "Tri-sync rollout",
            "notes": "Ship the sync bridge",
            "completed": False,
        }
    }


def test_resolve_asana_completed_since_defaults_to_epoch() -> None:
    assert resolve_asana_completed_since() == "1970-01-01T00:00:00Z"


def test_jira_search_jql_defaults_to_sync_marker() -> None:
    jql = jira_search_jql("PIX")

    assert jql == 'project = "PIX" ORDER BY updated DESC'


def test_jira_create_payload_defaults_issue_type_and_description() -> None:
    action = SimpleNamespace(
        title="Tri-sync rollout",
        body="Ship the sync bridge",
    )

    payload = jira_create_payload(action, "PIX", {"id": "10043"})

    assert payload["fields"]["project"] == {"key": "PIX"}
    assert payload["fields"]["issuetype"] == {"id": "10043"}
    assert payload["fields"]["summary"] == "Tri-sync rollout"
    assert payload["fields"]["description"] == jira_adf_document("Ship the sync bridge")


def test_resolve_jira_issue_type_prefers_project_issue_type_id(monkeypatch) -> None:
    monkeypatch.setenv("JIRA_URL", "https://example.atlassian.net")
    monkeypatch.setenv("JIRA_USERNAME", "user@example.com")
    monkeypatch.setenv("JIRA_API_TOKEN", "token")

    def fake_json_request(method, url, *, headers, payload=None):
        assert method == "GET"
        assert url.endswith("/rest/api/3/issue/createmeta/PIX/issuetypes")
        return {
            "issueTypes": [
                {
                    "id": "10043",
                    "name": "Task",
                    "subtask": False,
                }
            ]
        }

    monkeypatch.setattr("scripts.task_sync.provider_bridge._json_request", fake_json_request)

    assert resolve_jira_issue_type("PIX") == {"id": "10043"}


def test_jira_update_payload_updates_summary_and_description_only() -> None:
    action = SimpleNamespace(
        title="Tri-sync rollout",
        body="Ship the sync bridge",
    )

    payload = jira_update_payload(action)

    assert json.loads(json.dumps(payload)) == {
        "fields": {
            "summary": "Tri-sync rollout",
            "description": jira_adf_document("Ship the sync bridge"),
        }
    }


def test_jira_adf_document_splits_paragraphs() -> None:
    payload = jira_adf_document("Line one\n\nLine two")

    assert payload == {
        "type": "doc",
        "version": 1,
        "content": [
            {"type": "paragraph", "content": [{"type": "text", "text": "Line one"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Line two"}]},
        ],
    }


def test_read_default_asana_project_id_prefers_active_sprint(tmp_path) -> None:
    config_path = tmp_path / "config.json"
    config_path.write_text(
        json.dumps(
            {
                "integration": {
                    "asana": {
                        "project_id": "old-project",
                        "all_projects": {"active_sprint": "active-project"},
                    }
                }
            }
        ),
        encoding="utf-8",
    )

    assert read_default_asana_project_id(config_path) == "active-project"


def test_read_default_asana_project_ids_prefers_task_sync_projects(tmp_path) -> None:
    config_path = tmp_path / "config.json"
    config_path.write_text(
        json.dumps(
            {
                "integration": {
                    "asana": {
                        "project_id": "old-project",
                        "task_sync_projects": {
                            "active_sprint": "active-project",
                            "ci_federation": "ci-project",
                            "dataset_acquisition": "dataset-project",
                        },
                    }
                }
            }
        ),
        encoding="utf-8",
    )

    assert read_default_asana_project_ids(config_path) == (
        "active-project",
        "ci-project",
        "dataset-project",
    )


def test_jira_project_key_candidates_generate_reasonable_defaults() -> None:
    candidates = jira_project_key_candidates("Pixelated Empathy")

    assert candidates[0] == "PIXELATEDE"
    assert "PE" in candidates
    assert "PIXEL" in candidates


def test_persist_default_jira_project_writes_internal_config(tmp_path) -> None:
    state_path = tmp_path / "task-sync-state.json"

    persist_default_jira_project("PE", "Pixelated Empathy", state_path)

    payload = json.loads(state_path.read_text(encoding="utf-8"))
    assert payload["provider_bridge"]["jira"] == {
        "project_key": "PE",
        "project_name": "Pixelated Empathy",
    }


def test_read_runtime_jira_project_key_reads_runtime_state(tmp_path) -> None:
    state_path = tmp_path / "task-sync-state.json"
    state_path.write_text(
        json.dumps({"provider_bridge": {"jira": {"project_key": "PIX"}}}),
        encoding="utf-8",
    )

    assert read_runtime_jira_project_key(state_path) == "PIX"


def test_jira_project_template_candidates_respects_override(monkeypatch) -> None:
    monkeypatch.setenv("PIXELATED_JIRA_PROJECT_TEMPLATE_KEY", "custom-template")

    assert jira_project_template_candidates() == ["custom-template"]


def test_create_jira_project_bootstraps_first_valid_candidate(monkeypatch) -> None:
    monkeypatch.setenv("JIRA_URL", "https://example.atlassian.net")
    monkeypatch.setenv("JIRA_USERNAME", "user@example.com")
    monkeypatch.setenv("JIRA_API_TOKEN", "token")
    attempts: list[tuple[str, str]] = []

    def fake_json_request(method, url, *, headers, payload=None):
        if url.endswith("/rest/api/3/myself"):
            return {"accountId": "acct-1"}
        if url.endswith("/rest/api/3/project"):
            attempts.append((payload["key"], payload["projectTemplateKey"]))
            if payload["key"] == "PIXELATEDE":
                raise RuntimeError("key rejected")
            return {"key": payload["key"], "name": payload["name"]}
        raise AssertionError(url)

    monkeypatch.setattr("scripts.task_sync.provider_bridge._json_request", fake_json_request)

    project = create_jira_project()

    assert attempts[0][0] == "PIXELATEDE"
    assert project == {"key": "PE", "name": "Pixelated Empathy"}


def test_export_asana_tasks_aggregates_multiple_projects(monkeypatch) -> None:
    monkeypatch.setenv("ASANA_ACCESS_TOKEN", "token")
    monkeypatch.setattr(
        "scripts.task_sync.provider_bridge.resolve_asana_project_ids",
        lambda: ("proj-1", "proj-2"),
    )
    calls: list[str] = []

    def fake_json_request(method, url, *, headers, payload=None):
        calls.append(url)
        if "/projects/proj-1/tasks" in url:
            return {
                "data": [
                    {
                        "gid": "A-1",
                        "name": "One",
                        "notes": "Body",
                        "completed": False,
                        "modified_at": "2026-03-29T00:00:00Z",
                    }
                ],
                "next_page": None,
            }
        if "/projects/proj-2/tasks" in url:
            return {
                "data": [
                    {
                        "gid": "A-1",
                        "name": "One",
                        "notes": "Body",
                        "completed": False,
                        "modified_at": "2026-03-29T00:00:00Z",
                    },
                    {
                        "gid": "A-2",
                        "name": "Two",
                        "notes": "Body",
                        "completed": False,
                        "modified_at": "2026-03-29T00:00:00Z",
                    },
                ],
                "next_page": None,
            }
        raise AssertionError(url)

    monkeypatch.setattr("scripts.task_sync.provider_bridge._json_request", fake_json_request)

    tasks = export_asana_tasks()

    assert [task["gid"] for task in tasks] == ["A-1", "A-2"]
    assert len(calls) == 2
    assert all("completed_since=1970-01-01T00%3A00%3A00Z" in call for call in calls)


def test_apply_jira_action_transitions_status_best_effort(monkeypatch) -> None:
    monkeypatch.setenv("JIRA_URL", "https://example.atlassian.net")
    monkeypatch.setenv("JIRA_USERNAME", "user@example.com")
    monkeypatch.setenv("JIRA_API_TOKEN", "token")
    calls: list[tuple[str, str, dict | None]] = []

    def fake_json_request(method, url, *, headers, payload=None):
        calls.append((method, url, payload))
        if method == "PUT" and url.endswith("/rest/api/3/issue/PIX-1"):
            return {}
        if method == "GET" and url.endswith("/rest/api/3/issue/PIX-1?fields=status"):
            return {
                "fields": {
                    "status": {
                        "name": "To Do",
                        "statusCategory": {"key": "todo"},
                    }
                }
            }
        if method == "GET" and url.endswith("/rest/api/3/issue/PIX-1/transitions"):
            return {
                "transitions": [
                    {
                        "id": "31",
                        "to": {"name": "Done", "statusCategory": {"key": "done"}},
                    }
                ]
            }
        if method == "POST" and url.endswith("/rest/api/3/issue/PIX-1/transitions"):
            return {}
        raise AssertionError((method, url, payload))

    monkeypatch.setattr("scripts.task_sync.provider_bridge._json_request", fake_json_request)

    from scripts.task_sync.provider_bridge import apply_jira_action

    response = apply_jira_action(
        {
            "action": "update",
            "target_id": "PIX-1",
            "title": "Tri-sync rollout",
            "body": "Ship the sync bridge",
            "status": "closed",
        }
    )

    assert response == {"key": "PIX-1"}
    assert calls[-1] == (
        "POST",
        "https://example.atlassian.net/rest/api/3/issue/PIX-1/transitions",
        {"transition": {"id": "31"}},
    )


def test_resolve_jira_project_key_creates_and_persists_when_missing(monkeypatch, tmp_path) -> None:
    config_path = tmp_path / "config.json"
    config_path.write_text(json.dumps({"integration": {}}), encoding="utf-8")
    state_path = tmp_path / "task-sync-state.json"
    monkeypatch.setattr(
        "scripts.task_sync.provider_bridge.DEFAULT_CONFIG_PATH",
        config_path,
    )
    monkeypatch.setattr(
        "scripts.task_sync.provider_bridge.DEFAULT_RUNTIME_STATE_PATH",
        state_path,
    )
    monkeypatch.setattr(
        "scripts.task_sync.provider_bridge._discover_first_jira_project",
        lambda: None,
    )
    monkeypatch.setattr(
        "scripts.task_sync.provider_bridge.jira_project_exists",
        lambda key: False,
    )
    monkeypatch.setattr(
        "scripts.task_sync.provider_bridge.create_jira_project",
        lambda: {"key": "PE", "name": "Pixelated Empathy"},
    )

    assert resolve_jira_project_key(create_if_missing=True) == "PE"
    payload = json.loads(state_path.read_text(encoding="utf-8"))
    assert payload["provider_bridge"]["jira"]["project_key"] == "PE"


def test_resolve_configured_jira_project_key_prefers_static_config_over_runtime(monkeypatch, tmp_path) -> None:
    config_path = tmp_path / "config.json"
    config_path.write_text(
        json.dumps({"integration": {"jira": {"project_key": "PIX"}}}),
        encoding="utf-8",
    )
    state_path = tmp_path / "task-sync-state.json"
    state_path.write_text(
        json.dumps({"provider_bridge": {"jira": {"project_key": "MY"}}}),
        encoding="utf-8",
    )
    monkeypatch.setattr("scripts.task_sync.provider_bridge.DEFAULT_CONFIG_PATH", config_path)
    monkeypatch.setattr("scripts.task_sync.provider_bridge.DEFAULT_RUNTIME_STATE_PATH", state_path)
    monkeypatch.setattr(
        "scripts.task_sync.provider_bridge.jira_project_exists",
        lambda project_key: project_key == "PIX",
    )

    assert resolve_configured_jira_project_key() == "PIX"


def test_resolve_configured_jira_project_key_raises_on_transient_validation(monkeypatch) -> None:
    monkeypatch.setenv("JIRA_PROJECT_KEY", "TMPA")
    monkeypatch.setattr(
        "scripts.task_sync.provider_bridge.jira_project_exists",
        lambda key: None,
    )

    try:
        resolve_configured_jira_project_key()
    except RuntimeError as exc:
        assert "transient" in str(exc).lower()
    else:  # pragma: no cover
        raise AssertionError("Expected transient Jira validation failure")


def test_resolve_discovered_jira_project_key_persists_discovery(monkeypatch, tmp_path) -> None:
    config_path = tmp_path / "config.json"
    config_path.write_text(json.dumps({"integration": {}}), encoding="utf-8")
    state_path = tmp_path / "task-sync-state.json"
    monkeypatch.setattr("scripts.task_sync.provider_bridge.DEFAULT_CONFIG_PATH", config_path)
    monkeypatch.setattr("scripts.task_sync.provider_bridge.DEFAULT_RUNTIME_STATE_PATH", state_path)
    monkeypatch.setattr(
        "scripts.task_sync.provider_bridge._discover_first_jira_project",
        lambda: {"key": "TMPA", "name": "Tmp Alpha"},
    )

    assert resolve_discovered_jira_project_key() == "TMPA"
    payload = json.loads(state_path.read_text(encoding="utf-8"))
    assert payload["provider_bridge"]["jira"]["project_key"] == "TMPA"


def test_jira_project_exists_returns_false_on_request_failure(monkeypatch) -> None:
    monkeypatch.setenv("JIRA_URL", "https://example.atlassian.net")
    monkeypatch.setenv("JIRA_USERNAME", "user@example.com")
    monkeypatch.setenv("JIRA_API_TOKEN", "token")
    monkeypatch.setattr(
        "scripts.task_sync.provider_bridge.request.urlopen",
        lambda req: (_ for _ in ()).throw(HTTPError(req.full_url, 404, "Not Found", {}, None)),
    )

    assert jira_project_exists("MISSING") is False


def test_jira_project_exists_returns_none_on_transient_failure(monkeypatch) -> None:
    monkeypatch.setenv("JIRA_URL", "https://example.atlassian.net")
    monkeypatch.setenv("JIRA_USERNAME", "user@example.com")
    monkeypatch.setenv("JIRA_API_TOKEN", "token")
    monkeypatch.setattr(
        "scripts.task_sync.provider_bridge.request.urlopen",
        lambda req: (_ for _ in ()).throw(HTTPError(req.full_url, 503, "Unavailable", {}, None)),
    )

    assert jira_project_exists("FLAKY") is None


def test_jira_project_exists_uses_cache(monkeypatch) -> None:
    monkeypatch.setenv("JIRA_URL", "https://example.atlassian.net")
    monkeypatch.setenv("JIRA_USERNAME", "user@example.com")
    monkeypatch.setenv("JIRA_API_TOKEN", "token")
    monkeypatch.setattr("scripts.task_sync.provider_bridge._JIRA_PROJECT_EXISTS_CACHE", {})
    calls = {"count": 0}

    class FakeResponse:
        def read(self):
            return b"{}"

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

    def fake_urlopen(req):
        calls["count"] += 1
        return FakeResponse()

    monkeypatch.setattr("scripts.task_sync.provider_bridge.request.urlopen", fake_urlopen)

    assert jira_project_exists("CACHE") is True
    assert jira_project_exists("CACHE") is True
    assert calls["count"] == 1
