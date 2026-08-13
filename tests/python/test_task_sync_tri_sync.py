from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from scripts.task_sync import tri_sync
from scripts.task_sync.tri_sync import (
    SyncAction,
    SyncExecutionResult,
    SyncMetadata,
    TaskRecord,
    apply_sync_action,
    build_sync_plan,
    collect_provider_records,
    execute_apply_mode,
    extract_sync_key,
    merge_body_with_sync_metadata,
    normalize_asana_payload,
    normalize_github_payload,
    normalize_jira_payload,
    normalize_linear_payload,
    normalize_status,
    parse_sync_metadata,
    plan_from_sources,
    resolve_enabled_providers_from_env,
    select_canonical_record,
    task_body_without_sync_block,
)


def make_record(
    provider: str,
    external_id: str,
    title: str,
    body: str,
    status: str,
    **overrides,
) -> TaskRecord:
    updated_at = datetime.now(timezone.utc) - timedelta(minutes=overrides.pop("minutes_ago", 0))
    return TaskRecord(
        provider=provider,
        external_id=external_id,
        title=title,
        body=body,
        status=status,
        updated_at=updated_at,
        sync_key=overrides.pop("sync_key", None),
        **overrides,
    )


def test_extract_sync_key_prefers_embedded_metadata() -> None:
    body = """Discuss rollout

<!-- pixelated-sync
key: tri-sync-42
status: open
source-provider: jira
source-id: PIX-1
-->"""

    assert extract_sync_key("Different title", body) == "tri-sync-42"


def test_sync_block_round_trip_preserves_task_body() -> None:
    metadata = SyncMetadata(
        key="tri-sync-42",
        status="in_progress",
        source_provider="jira",
        source_id="PIX-1",
        provider_ids={"asana": "A-1", "github": "G-4"},
        updated_at="2026-03-23T00:00:00Z",
    )

    merged = merge_body_with_sync_metadata("Add tri-sync support", metadata)
    clean_body, parsed = parse_sync_metadata(merged)

    assert clean_body == "Add tri-sync support"
    assert parsed["key"] == "tri-sync-42"
    assert parsed["status"] == "in_progress"
    assert parsed["asana"] == "A-1"
    assert parsed["github"] == "G-4"
    assert task_body_without_sync_block(merged) == "Add tri-sync support"


def test_select_canonical_record_prefers_latest_record_and_asana_on_tie() -> None:
    earlier = make_record("asana", "A-1", "Tri-sync", "Body", "open", minutes_ago=30, sync_key="tri-sync")
    later = make_record("jira", "PIX-1", "Tri-sync", "Body", "open", minutes_ago=5, sync_key="tri-sync")
    tie_asana = make_record("asana", "A-2", "Tri-sync", "Body", "open", minutes_ago=5, sync_key="tri-sync")

    assert select_canonical_record([earlier, later, tie_asana]).provider == "asana"


def test_build_sync_plan_creates_missing_targets_and_updates_stale_targets() -> None:
    jira = make_record(
        "jira",
        "PIX-1",
        "Tri-sync rollout",
        "Ship the sync bridge",
        "open",
        minutes_ago=1,
        sync_key="tri-sync-rollout",
    )
    asana = make_record(
        "asana",
        "A-7",
        "Tri-sync rollout",
        "Ship the sync bridge but old",
        "open",
        minutes_ago=20,
        sync_key="tri-sync-rollout",
    )

    plan = build_sync_plan(
        {
            "jira": [jira],
            "asana": [asana],
        },
        enabled_providers=("asana", "jira", "github"),
    )

    actions = {(action.provider, action.action) for action in plan}

    assert ("asana", "update") in actions
    assert ("github", "create") in actions
    assert ("jira", "create") not in actions


def test_build_sync_plan_updates_when_provider_links_are_incomplete() -> None:
    jira = make_record(
        "jira",
        "PIX-1",
        "Tri-sync rollout",
        "Ship the sync bridge",
        "open",
        minutes_ago=1,
        sync_key="tri-sync-rollout",
    )
    asana = make_record(
        "asana",
        "A-7",
        "Tri-sync rollout",
        "Ship the sync bridge",
        "open",
        minutes_ago=1,
        sync_key="tri-sync-rollout",
    )
    asana = TaskRecord(
        provider=asana.provider,
        external_id=asana.external_id,
        title=asana.title,
        body=asana.body,
        status=asana.status,
        updated_at=asana.updated_at,
        sync_key=asana.sync_key,
        provider_ids={"asana": "A-7"},
    )

    plan = build_sync_plan(
        {
            "jira": [jira],
            "asana": [asana],
        },
        enabled_providers=("asana", "jira", "github"),
    )

    actions = {(action.provider, action.action) for action in plan}

    assert ("asana", "update") in actions


def test_build_sync_plan_collapses_duplicate_provider_records() -> None:
    jira_newer = make_record(
        "jira",
        "PIX-2",
        "Tri-sync rollout",
        "Ship the sync bridge",
        "open",
        1,
        "tri-sync-rollout",
    )
    jira_older = make_record(
        "jira",
        "PIX-1",
        "Tri-sync rollout",
        "Old body",
        "open",
        30,
        "tri-sync-rollout",
    )
    asana = make_record(
        "asana",
        "A-7",
        "Tri-sync rollout",
        "Ship the sync bridge",
        "open",
        5,
        "tri-sync-rollout",
    )

    plan = build_sync_plan(
        {
            "jira": [jira_newer, jira_older],
            "asana": [asana],
        },
        enabled_providers=("asana", "jira", "github"),
    )

    github_action = next(action for action in plan if action.provider == "github")

    assert github_action.provider_ids["jira"] == "PIX-2"
    assert ("jira", "create") not in {(action.provider, action.action) for action in plan}


def test_build_sync_plan_embeds_sync_metadata_in_target_body() -> None:
    jira = make_record(
        "jira",
        "PIX-1",
        "Tri-sync rollout",
        "Ship the sync bridge",
        "open",
        minutes_ago=1,
        sync_key="tri-sync-rollout",
    )

    plan = build_sync_plan(
        {
            "jira": [jira],
        },
        enabled_providers=("asana", "jira", "github"),
    )

    asana_action = next(action for action in plan if action.provider == "asana")
    clean_body, metadata = parse_sync_metadata(asana_action.body)

    assert clean_body == "Ship the sync bridge"
    assert metadata["key"] == "tri-sync-rollout"
    assert metadata["source-provider"] == "jira"
    assert metadata["source-id"] == "PIX-1"
    assert metadata["jira"] == "PIX-1"


def test_build_sync_plan_preserves_linked_provider_ids_from_metadata() -> None:
    jira = make_record(
        "jira",
        "PIX-1",
        "Tri-sync rollout",
        merge_body_with_sync_metadata(
            "Ship the sync bridge",
            SyncMetadata(
                key="tri-sync-rollout",
                status="open",
                source_provider="jira",
                source_id="PIX-1",
                provider_ids={"jira": "PIX-1", "asana": "A-7", "github": "G-2"},
            ),
        ),
        "open",
        minutes_ago=1,
        sync_key="tri-sync-rollout",
    )
    jira = TaskRecord(
        provider=jira.provider,
        external_id=jira.external_id,
        title=jira.title,
        body=jira.body,
        status=jira.status,
        updated_at=jira.updated_at,
        sync_key=jira.sync_key,
        provider_ids={"jira": "PIX-1", "asana": "A-7", "github": "G-2"},
        clean_body="Ship the sync bridge",
    )

    plan = build_sync_plan(
        {"jira": [jira]},
        enabled_providers=("asana", "jira", "github"),
    )

    asana_action = next(action for action in plan if action.provider == "asana")

    assert asana_action.provider_ids["github"] == "G-2"


def test_build_sync_plan_ignores_records_without_sync_keys(capsys) -> None:
    jira = make_record(
        "jira",
        "PIX-1",
        "",
        "",
        "open",
        minutes_ago=1,
        sync_key=None,
    )
    asana = make_record(
        "asana",
        "A-1",
        "",
        "",
        "open",
        minutes_ago=2,
        sync_key=None,
    )

    plan = build_sync_plan(
        {
            "jira": [jira],
            "asana": [asana],
        },
        enabled_providers=("asana", "jira", "github"),
    )
    captured = capsys.readouterr()

    assert plan == []
    assert "Skipping jira record PIX-1: missing sync key" in captured.err
    assert "Skipping asana record A-1: missing sync key" in captured.err


def test_normalize_asana_payload_reads_metadata_and_completion() -> None:
    payload = {
        "gid": "A-1",
        "name": "Tri-sync rollout",
        "notes": merge_body_with_sync_metadata(
            "Ship the sync bridge",
            SyncMetadata(
                key="tri-sync-rollout",
                status="open",
                source_provider="jira",
                source_id="PIX-1",
                provider_ids={"jira": "PIX-1", "github": "G-1"},
            ),
        ),
        "completed": True,
        "modified_at": "2026-03-23T00:00:00Z",
    }

    record = normalize_asana_payload(payload)

    assert record is not None
    assert record.external_id == "A-1"
    assert record.status == "closed"
    assert record.sync_key == "tri-sync-rollout"
    assert record.provider_ids["github"] == "G-1"


def test_normalize_jira_payload_reads_fields_shape() -> None:
    payload = {
        "key": "PIX-1",
        "fields": {
            "summary": "Tri-sync rollout",
            "description": merge_body_with_sync_metadata(
                "Ship the sync bridge",
                SyncMetadata(
                    key="tri-sync-rollout",
                    status="open",
                    source_provider="asana",
                    source_id="A-1",
                    provider_ids={"asana": "A-1", "github": "G-1"},
                ),
            ),
            "status": {"name": "In Progress"},
            "updated": "2026-03-23T00:00:00Z",
        },
    }

    record = normalize_jira_payload(payload)

    assert record is not None
    assert record.external_id == "PIX-1"
    assert record.title == "Tri-sync rollout"
    assert record.status == "in_progress"
    assert record.sync_key == "tri-sync-rollout"
    assert record.provider_ids["github"] == "G-1"


def test_normalize_jira_payload_flattens_adf_description() -> None:
    payload = {
        "key": "TMPA-1",
        "fields": {
            "summary": "Tri-sync rollout",
            "description": {
                "type": "doc",
                "version": 1,
                "content": [
                    {
                        "type": "paragraph",
                        "content": [{"type": "text", "text": "Ship the sync bridge"}],
                    },
                    {
                        "type": "paragraph",
                        "content": [
                            {
                                "type": "text",
                                "text": "<!-- pixelated-sync\nkey: tri-sync-rollout\nstatus: open\nsource-provider: asana\nsource-id: A-1\n-->",
                            }
                        ],
                    },
                ],
            },
            "status": {"name": "To Do"},
            "updated": "2026-03-23T00:00:00Z",
        },
    }

    record = normalize_jira_payload(payload)

    assert record is not None
    assert record.clean_body == "Ship the sync bridge"
    assert record.sync_key == "tri-sync-rollout"


def test_normalize_github_payload_reads_open_closed_status_and_metadata() -> None:
    payload = {
        "number": 15,
        "title": "Track dataset imports",
        "body": merge_body_with_sync_metadata(
            "Investigate import pipeline",
            SyncMetadata(
                key="modern-dataset-project",
                status="closed",
                source_provider="asana",
                source_id="A-15",
                provider_ids={"asana": "A-15", "jira": "PIX-5"},
            ),
        ),
        "state": "closed",
        "updated_at": "2026-03-23T00:00:00Z",
    }

    record = normalize_github_payload(payload)

    assert record is not None
    assert record.provider == "github"
    assert record.external_id == "15"
    assert record.status == "closed"
    assert record.sync_key == "modern-dataset-project"
    assert record.provider_ids["jira"] == "PIX-5"


def test_normalize_linear_payload_reads_state_and_metadata() -> None:
    payload = {
        "id": "lin-15",
        "title": "Track dataset imports",
        "description": merge_body_with_sync_metadata(
            "Investigate import pipeline",
            SyncMetadata(
                key="modern-dataset-project",
                status="closed",
                source_provider="asana",
                source_id="A-15",
                provider_ids={"asana": "A-15", "jira": "PIX-5"},
            ),
        ),
        "state": "completed",
        "updatedAt": "2026-03-23T00:00:00Z",
    }

    record = normalize_linear_payload(payload)

    assert record is not None
    assert record.provider == "linear"
    assert record.external_id == "lin-15"
    assert record.status == "closed"
    assert record.sync_key == "modern-dataset-project"
    assert record.provider_ids["jira"] == "PIX-5"


def test_plan_from_sources_loads_asana_and_jira_exports(tmp_path) -> None:
    asana_path = tmp_path / "asana.json"
    jira_path = tmp_path / "jira.jsonl"
    github_path = tmp_path / "github.jsonl"

    asana_path.write_text(
        """[
  {
    "gid": "A-1",
    "name": "Tri-sync rollout",
    "notes": "Ship the sync bridge",
    "modified_at": "2026-03-23T00:00:00Z"
  }
]
""",
        encoding="utf-8",
    )
    jira_path.write_text(
        """{"key":"PIX-1","fields":{"summary":"Tri-sync rollout","description":"Ship the sync bridge","status":{"name":"To Do"},"updated":"2026-03-23T00:00:00Z"}}\n""",
        encoding="utf-8",
    )
    github_path.write_text("[]", encoding="utf-8")

    plan = plan_from_sources(
        enabled_providers=("asana", "jira", "github"),
        export_paths={"asana": asana_path, "jira": jira_path, "github": github_path},
    )

    actions = {(action.provider, action.action) for action in plan}

    assert ("github", "create") in actions


def test_build_sync_plan_prefers_open_jira_record_over_newer_closed_duplicate() -> None:
    jira_open = make_record(
        "jira",
        "PIX-open",
        "Tri-sync rollout",
        "Ship the sync bridge",
        "open",
        20,
        "tri-sync-rollout",
    )
    jira_closed = make_record(
        "jira",
        "PIX-closed",
        "Tri-sync rollout",
        "Ship the sync bridge",
        "closed",
        1,
        "tri-sync-rollout",
    )
    asana = make_record(
        "asana",
        "A-7",
        "Tri-sync rollout",
        "Ship the sync bridge",
        "open",
        5,
        "tri-sync-rollout",
    )

    plan = build_sync_plan(
        {
            "jira": [jira_open, jira_closed],
            "asana": [asana],
        },
        enabled_providers=("asana", "jira", "github"),
    )

    github_action = next(action for action in plan if action.provider == "github")

    assert github_action.status == "open"
    assert github_action.provider_ids["jira"] == "PIX-open"


def test_build_sync_plan_prefers_open_non_jira_record_over_closed_jira_record() -> None:
    jira_closed = make_record(
        "jira",
        "PIX-closed",
        "Tri-sync rollout",
        "Ship the sync bridge",
        "closed",
        1,
        "tri-sync-rollout",
    )
    asana_open = make_record(
        "asana",
        "A-7",
        "Tri-sync rollout",
        "Ship the sync bridge",
        "open",
        5,
        "tri-sync-rollout",
    )

    plan = build_sync_plan(
        {
            "jira": [jira_closed],
            "asana": [asana_open],
        },
        enabled_providers=("asana", "jira", "github"),
    )

    jira_action = next(action for action in plan if action.provider == "jira")

    assert jira_action.action == "update"
    assert jira_action.status == "open"
    assert jira_action.source_provider == "asana"


def test_normalize_status_maps_provider_workflow_terms() -> None:
    assert normalize_status("To Do") == "open"
    assert normalize_status("Under Review") == "in_progress"
    assert normalize_status("Cancelled") == "closed"


def test_main_apply_persists_sync_state(tmp_path, monkeypatch, capsys) -> None:
    state_path = tmp_path / "task-sync-state.json"
    plan = [make_action("asana", "create", None)]

    monkeypatch.setattr(tri_sync, "SYNC_STATE_PATH", state_path)
    monkeypatch.setattr(
        tri_sync,
        "collect_records",
        lambda **kwargs: {"asana": []},
    )
    monkeypatch.setattr(
        tri_sync,
        "build_sync_plan",
        lambda *args, **kwargs: plan,
    )
    monkeypatch.setattr(tri_sync, "resolve_apply_commands_from_env", lambda: {"asana": ["cat"]})
    monkeypatch.setattr(
        tri_sync,
        "apply_sync_plan",
        lambda actions, provider_commands: [
            SyncExecutionResult(
                provider=action.provider,
                action=action.action,
                sync_key=action.sync_key,
                target_id="A-1",
                success=True,
                stdout="ok",
                stderr="",
            )
            for action in actions
        ],
    )

    exit_code = tri_sync.main(["apply"])
    captured = capsys.readouterr()

    assert exit_code == 0

    payload = json.loads(captured.out)
    state = json.loads(state_path.read_text(encoding="utf-8"))
    record = state["records"]["tri-sync-rollout"]

    assert payload["results"][0]["target_id"] == "A-1"
    assert record["provider_ids"]["asana"] == "A-1"
    assert record["providers"]["asana"]["target_id"] == "A-1"
    assert record["providers"]["asana"]["success"] is True
    assert state["record_count"] == 1


def test_execute_apply_mode_reconciles_until_plan_is_stable(monkeypatch, tmp_path) -> None:
    state_path = tmp_path / "task-sync-state.json"
    first_action = SyncAction(
        provider="jira",
        action="create",
        sync_key="tri-sync-rollout",
        source_provider="asana",
        source_id="A-1",
        target_id=None,
        title="Tri-sync rollout",
        body="Ship the sync bridge",
        status="open",
        provider_ids={"asana": "A-1", "github": "G-1"},
    )
    first_plan = [first_action]
    apply_calls: list[list[SyncAction]] = []

    def fake_apply_sync_plan(actions, *, provider_commands=None, run_process=tri_sync._run_process, max_workers=None):
        _ = provider_commands
        _ = run_process
        _ = max_workers
        apply_calls.append(list(actions))
        results = []
        for action in actions:
            target_id = action.target_id
            if action.provider == "jira" and target_id is None:
                target_id = "PIX-1"
            results.append(
                SyncExecutionResult(
                    provider=action.provider,
                    action=action.action,
                    sync_key=action.sync_key,
                    target_id=target_id,
                    success=True,
                )
            )
        return results

    monkeypatch.setattr(tri_sync, "SYNC_STATE_PATH", state_path)
    monkeypatch.setattr(tri_sync, "resolve_apply_commands_from_env", dict)
    monkeypatch.setattr(tri_sync, "resolve_enabled_providers_from_env", lambda: tri_sync.DEFAULT_PROVIDER_ORDER)
    monkeypatch.setattr(tri_sync, "apply_sync_plan", fake_apply_sync_plan)

    payload, exit_code = execute_apply_mode(first_plan)

    assert exit_code == 0
    assert [len(actions) for actions in apply_calls] == [1, 3]
    assert payload["passes"] == [
        {"pass": 1, "summary": {"create": 1, "update": 0}, "result_count": 1, "success": True},
        {"pass": 2, "summary": {"create": 0, "update": 3}, "result_count": 3, "success": True},
    ]


def test_resolve_enabled_providers_from_env(monkeypatch) -> None:
    monkeypatch.setenv("PIXELATED_TASK_SYNC_PROVIDERS", "asana,jira")

    assert resolve_enabled_providers_from_env() == ("asana", "jira")
    monkeypatch.setattr(
        tri_sync,
        "export_asana_tasks",
        lambda: [
            {
                "gid": "A-1",
                "name": "Tri-sync rollout",
                "notes": "Ship the sync bridge",
                "completed": False,
                "modified_at": "2026-03-23T00:00:00Z",
            }
        ],
    )

    records = collect_provider_records("asana", {})

    assert records is not None
    assert records[0].external_id == "A-1"


def test_collect_provider_records_uses_direct_github_export_when_no_path(monkeypatch) -> None:
    monkeypatch.setattr(
        tri_sync,
        "export_github_issues",
        lambda: [
            {
                "number": 11,
                "title": "Track dataset imports",
                "body": "Investigate import pipeline",
                "state": "open",
                "updated_at": "2026-03-23T00:00:00Z",
            }
        ],
    )

    records = collect_provider_records("github", {})

    assert records is not None
    assert records[0].external_id == "11"


def test_collect_provider_records_uses_direct_linear_export_when_no_path(monkeypatch) -> None:
    monkeypatch.setattr(
        tri_sync,
        "export_linear_issues",
        lambda: [
            {
                "id": "lin-21",
                "title": "Track dataset imports",
                "description": "Investigate import pipeline",
                "state": "open",
                "updatedAt": "2026-03-23T00:00:00Z",
            }
        ],
    )

    records = collect_provider_records("linear", {})

    assert records is not None
    assert records[0].provider == "linear"
    assert records[0].external_id == "lin-21"


def test_apply_sync_action_uses_direct_asana_bridge_when_command_missing(monkeypatch) -> None:
    monkeypatch.setattr(
        tri_sync,
        "apply_provider_action",
        lambda provider, payload: {"gid": "A-99"} if provider == "asana" else {},
    )

    result = apply_sync_action(make_action("asana", "create", None))

    assert result.success is True
    assert result.target_id == "A-99"


def test_apply_sync_action_uses_direct_github_bridge_when_command_missing(monkeypatch) -> None:
    monkeypatch.setattr(
        tri_sync,
        "apply_provider_action",
        lambda provider, payload: {"number": 99} if provider == "github" else {},
    )

    result = apply_sync_action(make_action("github", "create", None))

    assert result.success is True
    assert result.target_id == "99"


def test_apply_sync_action_uses_direct_linear_bridge_when_command_missing(monkeypatch) -> None:
    monkeypatch.setattr(
        tri_sync,
        "apply_provider_action",
        lambda provider, payload: {"id": "lin-101"} if provider == "linear" else {},
    )

    result = apply_sync_action(make_action("linear", "create", None))

    assert result.success is True
    assert result.target_id == "lin-101"


def make_action(provider: str, action: str, target_id: str | None):
    return SyncAction(
        provider=provider,
        action=action,
        sync_key="tri-sync-rollout",
        source_provider="jira",
        source_id="PIX-1",
        target_id=target_id,
        title="Tri-sync rollout",
        body="Ship the sync bridge",
        status="open",
        provider_ids={"jira": "PIX-1"},
    )
