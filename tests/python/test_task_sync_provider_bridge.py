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
    jira_adf_document,
    jira_project_exists,
    jira_project_key_candidates,
    jira_create_payload,
    jira_search_jql,
    jira_update_payload,
    jira_project_template_candidates,
    resolve_jira_project_key,
    read_default_asana_project_id,
    read_default_jira_project_key,
    persist_default_jira_project,
    resolve_configured_jira_project_key,
    resolve_discovered_jira_project_key,
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


def test_jira_search_jql_defaults_to_sync_marker() -> None:
    jql = jira_search_jql("PIX")

    assert jql == 'project = "PIX" ORDER BY updated DESC'


def test_jira_create_payload_defaults_issue_type_and_description() -> None:
    action = SimpleNamespace(
        title="Tri-sync rollout",
        body="Ship the sync bridge",
    )

    payload = jira_create_payload(action, "PIX", "Task")

    assert payload["fields"]["project"] == {"key": "PIX"}
    assert payload["fields"]["issuetype"] == {"name": "Task"}
    assert payload["fields"]["summary"] == "Tri-sync rollout"
    assert payload["fields"]["description"] == jira_adf_document("Ship the sync bridge")


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


def test_jira_project_key_candidates_generate_reasonable_defaults() -> None:
    candidates = jira_project_key_candidates("Pixelated Empathy")

    assert candidates[0] == "PIXELATEDE"
    assert "PE" in candidates
    assert "PIXEL" in candidates


def test_persist_default_jira_project_writes_internal_config(tmp_path) -> None:
    config_path = tmp_path / "config.json"
    config_path.write_text(json.dumps({"integration": {}}), encoding="utf-8")

    persist_default_jira_project("PE", "Pixelated Empathy", config_path)

    payload = json.loads(config_path.read_text(encoding="utf-8"))
    assert payload["integration"]["jira"] == {
        "enabled": True,
        "project_key": "PE",
        "project_name": "Pixelated Empathy",
    }
    assert read_default_jira_project_key(config_path) == "PE"


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


def test_resolve_jira_project_key_creates_and_persists_when_missing(monkeypatch, tmp_path) -> None:
    config_path = tmp_path / "config.json"
    config_path.write_text(json.dumps({"integration": {}}), encoding="utf-8")
    monkeypatch.setattr(
        "scripts.task_sync.provider_bridge.DEFAULT_CONFIG_PATH",
        config_path,
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
    payload = json.loads(config_path.read_text(encoding="utf-8"))
    assert payload["integration"]["jira"]["project_key"] == "PE"


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
    monkeypatch.setattr("scripts.task_sync.provider_bridge.DEFAULT_CONFIG_PATH", config_path)
    monkeypatch.setattr(
        "scripts.task_sync.provider_bridge._discover_first_jira_project",
        lambda: {"key": "TMPA", "name": "Tmp Alpha"},
    )

    assert resolve_discovered_jira_project_key() == "TMPA"
    payload = json.loads(config_path.read_text(encoding="utf-8"))
    assert payload["integration"]["jira"]["project_key"] == "TMPA"


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
