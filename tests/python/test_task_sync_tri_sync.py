from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from typing import Any

import scripts.task_sync.tri_sync as tri_sync
from scripts.task_sync.tri_sync import (
    SyncAction,
    SyncMetadata,
    SyncExecutionResult,
    TaskRecord,
    apply_sync_action,
    apply_sync_plan,
    beads_export,
    build_sync_plan,
    cleanup_beads_duplicates,
    collect_provider_records,
    execute_apply_mode,
    extract_sync_key,
    find_beads_duplicate_groups,
    merge_body_with_sync_metadata,
    normalize_asana_payload,
    normalize_jira_payload,
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
    minutes_ago: int = 0,
    sync_key: str | None = None,
) -> TaskRecord:
    return TaskRecord(
        provider=provider,
        external_id=external_id,
        title=title,
        body=body,
        status=status,
        updated_at=datetime.now(timezone.utc) - timedelta(minutes=minutes_ago),
        sync_key=sync_key,
    )


def test_extract_sync_key_prefers_embedded_metadata() -> None:
    body = """Discuss rollout

<!-- pixelated-sync
key: tri-sync-42
status: open
source-provider: beads
source-id: bd-1
-->"""

    assert extract_sync_key("Different title", body) == "tri-sync-42"


def test_sync_block_round_trip_preserves_task_body() -> None:
    metadata = SyncMetadata(
        key="tri-sync-42",
        status="in_progress",
        source_provider="beads",
        source_id="bd-1",
        provider_ids={"asana": "A-1", "jira": "PIX-4"},
        updated_at="2026-03-23T00:00:00Z",
    )

    merged = merge_body_with_sync_metadata("Add tri-sync support", metadata)
    clean_body, parsed = parse_sync_metadata(merged)

    assert clean_body == "Add tri-sync support"
    assert parsed["key"] == "tri-sync-42"
    assert parsed["status"] == "in_progress"
    assert parsed["asana"] == "A-1"
    assert parsed["jira"] == "PIX-4"
    assert task_body_without_sync_block(merged) == "Add tri-sync support"


def test_select_canonical_record_prefers_latest_record_and_beads_on_tie() -> None:
    earlier = make_record(
        "asana", "A-1", "Tri-sync", "Body", "open", minutes_ago=30, sync_key="tri-sync"
    )
    later = make_record(
        "jira", "PIX-1", "Tri-sync", "Body", "open", minutes_ago=5, sync_key="tri-sync"
    )
    tie_beads = make_record(
        "beads", "bd-1", "Tri-sync", "Body", "open", minutes_ago=5, sync_key="tri-sync"
    )

    assert select_canonical_record([earlier, later, tie_beads]).provider == "beads"


def test_build_sync_plan_creates_missing_targets_and_updates_stale_targets() -> None:
    beads = make_record(
        "beads",
        "bd-1",
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
            "beads": [beads],
            "asana": [asana],
        },
        enabled_providers=("beads", "asana", "jira"),
    )

    actions = {(action.provider, action.action) for action in plan}

    assert ("asana", "update") in actions
    assert ("jira", "create") in actions
    assert ("beads", "create") not in actions


def test_build_sync_plan_updates_when_provider_links_are_incomplete() -> None:
    beads = make_record(
        "beads",
        "bd-1",
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
            "beads": [beads],
            "asana": [asana],
        },
        enabled_providers=("beads", "asana", "jira"),
    )

    actions = {(action.provider, action.action) for action in plan}

    assert ("asana", "update") in actions


def test_build_sync_plan_collapses_duplicate_provider_records() -> None:
    beads_newer = make_record(
        "beads",
        "bd-2",
        "Tri-sync rollout",
        "Ship the sync bridge",
        "open",
        1,
        "tri-sync-rollout",
    )
    beads_older = make_record(
        "beads",
        "bd-1",
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
            "beads": [beads_newer, beads_older],
            "asana": [asana],
        },
        enabled_providers=("beads", "asana", "jira"),
    )

    jira_action = next(action for action in plan if action.provider == "jira")

    assert jira_action.provider_ids["beads"] == "bd-2"
    assert ("beads", "create") not in {(action.provider, action.action) for action in plan}


def test_build_sync_plan_embeds_sync_metadata_in_target_body() -> None:
    beads = make_record(
        "beads",
        "bd-1",
        "Tri-sync rollout",
        "Ship the sync bridge",
        "open",
        minutes_ago=1,
        sync_key="tri-sync-rollout",
    )

    plan = build_sync_plan(
        {
            "beads": [beads],
        },
        enabled_providers=("beads", "asana", "jira"),
    )

    jira_action = next(action for action in plan if action.provider == "jira")
    clean_body, metadata = parse_sync_metadata(jira_action.body)

    assert clean_body == "Ship the sync bridge"
    assert metadata["key"] == "tri-sync-rollout"
    assert metadata["source-provider"] == "beads"
    assert metadata["source-id"] == "bd-1"
    assert metadata["beads"] == "bd-1"


def test_build_sync_plan_preserves_linked_provider_ids_from_metadata() -> None:
    beads = make_record(
        "beads",
        "bd-1",
        "Tri-sync rollout",
        merge_body_with_sync_metadata(
            "Ship the sync bridge",
            SyncMetadata(
                key="tri-sync-rollout",
                status="open",
                source_provider="beads",
                source_id="bd-1",
                provider_ids={"beads": "bd-1", "asana": "A-7", "jira": "PIX-2"},
            ),
        ),
        "open",
        minutes_ago=1,
        sync_key="tri-sync-rollout",
    )
    beads = TaskRecord(
        provider=beads.provider,
        external_id=beads.external_id,
        title=beads.title,
        body=beads.body,
        status=beads.status,
        updated_at=beads.updated_at,
        sync_key=beads.sync_key,
        provider_ids={"beads": "bd-1", "asana": "A-7", "jira": "PIX-2"},
        clean_body="Ship the sync bridge",
    )

    plan = build_sync_plan(
        {"beads": [beads]},
        enabled_providers=("beads", "asana", "jira"),
    )

    asana_action = next(action for action in plan if action.provider == "asana")

    assert asana_action.provider_ids["jira"] == "PIX-2"


def test_build_sync_plan_ignores_records_without_sync_keys(capsys) -> None:
    beads = make_record(
        "beads",
        "bd-1",
        "",
        "",
        "open",
        minutes_ago=1,
        sync_key=None,
    )
    jira = make_record(
        "jira",
        "PIX-1",
        "",
        "",
        "open",
        minutes_ago=2,
        sync_key=None,
    )

    plan = build_sync_plan(
        {
            "beads": [beads],
            "jira": [jira],
        },
        enabled_providers=("beads", "asana", "jira"),
    )
    captured = capsys.readouterr()

    assert plan == []
    assert "Skipping beads record bd-1: missing sync key" in captured.err
    assert "Skipping jira record PIX-1: missing sync key" in captured.err


def test_normalize_asana_payload_reads_metadata_and_completion() -> None:
    payload = {
        "gid": "A-1",
        "name": "Tri-sync rollout",
        "notes": merge_body_with_sync_metadata(
            "Ship the sync bridge",
            SyncMetadata(
                key="tri-sync-rollout",
                status="open",
                source_provider="beads",
                source_id="bd-1",
                provider_ids={"beads": "bd-1", "jira": "PIX-1"},
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
    assert record.provider_ids["jira"] == "PIX-1"


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
                    source_provider="beads",
                    source_id="bd-1",
                    provider_ids={"beads": "bd-1", "asana": "A-1"},
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
    assert record.provider_ids["asana"] == "A-1"


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
                                "text": "<!-- pixelated-sync\nkey: tri-sync-rollout\nstatus: open\nsource-provider: beads\nsource-id: bd-1\n-->",
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


def test_plan_from_sources_loads_asana_and_jira_exports(tmp_path) -> None:
    asana_path = tmp_path / "asana.json"
    jira_path = tmp_path / "jira.jsonl"

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

    plan = plan_from_sources(
        enabled_providers=("asana", "jira", "beads"),
        export_paths={"asana": asana_path, "jira": jira_path},
    )

    actions = {(action.provider, action.action) for action in plan}

    assert ("beads", "create") in actions


def test_beads_export_does_not_use_scrubbed_snapshot(monkeypatch) -> None:
    commands: list[list[str]] = []

    def fake_run(command: list[str], *, input_text=None) -> str:
        commands.append(command)
        return (
            '{"id":"bd-1","title":"Tri-sync rollout","description":"Ship the sync bridge\\n\\n'
            '<!-- pixelated-sync\\nkey: tri-sync-rollout\\nstatus: open\\nsource-provider: beads\\nsource-id: bd-1\\n-->",'
            '"status":"open","external_ref":"tri-sync-rollout","updated_at":"2026-03-23T00:00:00Z"}'
        )

    monkeypatch.setattr(tri_sync, "_run_command", fake_run)

    records = beads_export()

    assert commands == [["bd", "export", "--no-memories"]]
    assert records[0].sync_key == "tri-sync-rollout"


def test_find_beads_duplicate_groups_prefers_latest_record() -> None:
    canonical = make_record(
        "beads",
        "bd-2",
        "Tri-sync rollout",
        "Ship the sync bridge",
        "open",
        1,
        "tri-sync-rollout",
    )
    duplicate = make_record(
        "beads",
        "bd-1",
        "Tri-sync rollout",
        "Ship the sync bridge",
        "open",
        20,
        "tri-sync-rollout",
    )

    groups = find_beads_duplicate_groups([duplicate, canonical])

    assert len(groups) == 1
    assert groups[0][0] == "tri-sync-rollout"
    assert groups[0][1].external_id == "bd-2"
    assert [record.external_id for record in groups[0][2]] == ["bd-1"]


def test_build_sync_plan_prefers_open_beads_record_over_newer_closed_duplicate() -> None:
    beads_open = make_record(
        "beads",
        "bd-open",
        "Tri-sync rollout",
        "Ship the sync bridge",
        "open",
        20,
        "tri-sync-rollout",
    )
    beads_closed = make_record(
        "beads",
        "bd-closed",
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
            "beads": [beads_open, beads_closed],
            "asana": [asana],
        },
        enabled_providers=("beads", "asana", "jira"),
    )

    jira_action = next(action for action in plan if action.provider == "jira")

    assert jira_action.status == "open"
    assert jira_action.provider_ids["beads"] == "bd-open"


def test_build_sync_plan_prefers_open_non_beads_record_over_closed_beads_record() -> None:
    beads_closed = make_record(
        "beads",
        "bd-closed",
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
            "beads": [beads_closed],
            "asana": [asana_open],
        },
        enabled_providers=("beads", "asana", "jira"),
    )

    beads_action = next(action for action in plan if action.provider == "beads")

    assert beads_action.action == "update"
    assert beads_action.status == "open"
    assert beads_action.source_provider == "asana"


def test_cleanup_beads_duplicates_closes_noncanonical_records() -> None:
    commands: list[list[str]] = []

    def fake_runner(command, *, input_text=None):
        command_list = list(command)
        commands.append(command_list)
        return SimpleNamespace(returncode=0, stdout="ok\n", stderr="")

    canonical = make_record(
        "beads",
        "bd-2",
        "Tri-sync rollout",
        "Ship the sync bridge",
        "open",
        1,
        "tri-sync-rollout",
    )
    duplicate = make_record(
        "beads",
        "bd-1",
        "Tri-sync rollout",
        "Ship the sync bridge",
        "open",
        20,
        "tri-sync-rollout",
    )

    results = cleanup_beads_duplicates([duplicate, canonical], run_process=fake_runner)

    assert len(results) == 1
    assert results[0].success is True
    assert results[0].target_id == "bd-2"
    assert commands == [
        ["bd", "close", "bd-1"],
        ["bd", "dep", "add", "bd-1", "bd-2", "--type", "related"],
    ]


def test_apply_sync_plan_runs_beads_and_external_provider_commands() -> None:
    commands: list[tuple[list[str], str | None]] = []

    def fake_runner(command, *, input_text=None):
        command_list = list(command)
        commands.append((command_list, input_text))
        if command_list[:2] == ["bd", "create"]:
            return SimpleNamespace(returncode=0, stdout="bd-42\n", stderr="")
        return SimpleNamespace(returncode=0, stdout='{"gid":"A-1"}\n', stderr="")

    results = apply_sync_plan(
        [
            make_action("beads", "create", None),
            make_action("asana", "update", "A-1"),
        ],
        provider_commands={"asana": ["cat"]},
        run_process=fake_runner,
    )

    assert results[0].success is True
    assert results[0].target_id == "bd-42"
    assert results[1].success is True
    assert results[1].target_id == "A-1"
    assert commands[0][0][:2] == ["bd", "create"]
    assert commands[1][0] == ["cat"]
    assert '"provider": "asana"' in (commands[1][1] or "")


def test_apply_sync_plan_beads_create_uses_default_open_status() -> None:
    commands: list[tuple[list[str], str | None]] = []

    def fake_runner(command, *, input_text=None):
        command_list = list(command)
        commands.append((command_list, input_text))
        return SimpleNamespace(returncode=0, stdout="bd-42\n", stderr="")

    results = apply_sync_plan(
        [make_action("beads", "create", None)],
        run_process=fake_runner,
    )

    assert results[0].success is True
    assert "--status" not in commands[0][0]


def test_normalize_status_maps_provider_workflow_terms() -> None:
    assert normalize_status("To Do") == "open"
    assert normalize_status("Under Review") == "in_progress"
    assert normalize_status("Cancelled") == "closed"


def test_main_apply_persists_sync_state(tmp_path, monkeypatch, capsys) -> None:
    state_path = tmp_path / "task-sync-state.json"
    plan = [make_action("asana", "create", None)]
    results = [
        SyncExecutionResult(
            provider="asana",
            action="create",
            sync_key="tri-sync-rollout",
            target_id="A-1",
            success=True,
            stdout="ok",
            stderr="",
        )
    ]

    monkeypatch.setattr(tri_sync, "SYNC_STATE_PATH", state_path)
    monkeypatch.setattr(
        tri_sync,
        "collect_records",
        lambda enabled_providers=None, export_paths=None: {"beads": []},
    )
    monkeypatch.setattr(
        tri_sync,
        "build_sync_plan",
        lambda records_by_provider, enabled_providers=None: plan,
    )
    monkeypatch.setattr(tri_sync, "resolve_apply_commands_from_env", lambda: {"asana": ["cat"]})
    monkeypatch.setattr(tri_sync, "apply_sync_plan", lambda actions, provider_commands: results)
    monkeypatch.setattr(tri_sync, "beads_export", lambda: [])
    monkeypatch.setattr(tri_sync, "cleanup_beads_duplicates", lambda records: [])

    exit_code = tri_sync.main(["apply"])
    captured = capsys.readouterr()

    assert exit_code == 0

    payload = json.loads(captured.out)
    state = json.loads(state_path.read_text(encoding="utf-8"))
    record = state["records"]["tri-sync-rollout"]

    assert payload["results"][0]["target_id"] == "A-1"
    assert record["provider_ids"]["beads"] == "bd-1"
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
        source_provider="beads",
        source_id="bd-1",
        target_id=None,
        title="Tri-sync rollout",
        body="Ship the sync bridge",
        status="open",
        provider_ids={"beads": "bd-1", "asana": "A-1"},
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
    monkeypatch.setattr(tri_sync, "resolve_apply_commands_from_env", lambda: {})
    monkeypatch.setattr(tri_sync, "resolve_enabled_providers_from_env", lambda: tri_sync.DEFAULT_PROVIDER_ORDER)
    monkeypatch.setattr(tri_sync, "apply_sync_plan", fake_apply_sync_plan)
    monkeypatch.setattr(tri_sync, "beads_export", lambda: [])
    monkeypatch.setattr(tri_sync, "cleanup_beads_duplicates", lambda records: [])

    payload, exit_code = execute_apply_mode(first_plan)

    assert exit_code == 0
    assert [len(actions) for actions in apply_calls] == [1, 3]
    assert payload["passes"] == [
        {"pass": 1, "summary": {"create": 1, "update": 0}, "result_count": 1, "success": True},
        {"pass": 2, "summary": {"create": 0, "update": 3}, "result_count": 3, "success": True},
    ]


def test_resolve_enabled_providers_from_env(monkeypatch) -> None:
    monkeypatch.setenv("PIXELATED_TASK_SYNC_PROVIDERS", "beads,asana")

    assert resolve_enabled_providers_from_env() == ("beads", "asana")


def test_collect_provider_records_uses_direct_asana_export_when_no_path(monkeypatch) -> None:
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


def test_apply_sync_action_uses_direct_asana_bridge_when_command_missing(monkeypatch) -> None:
    monkeypatch.setattr(
        tri_sync,
        "apply_provider_action",
        lambda provider, payload: {"gid": "A-99"} if provider == "asana" else {},
    )

    result = apply_sync_action(make_action("asana", "create", None))

    assert result.success is True
    assert result.target_id == "A-99"


def make_action(provider: str, action: str, target_id: str | None):
    return SyncAction(
        provider=provider,
        action=action,
        sync_key="tri-sync-rollout",
        source_provider="beads",
        source_id="bd-1",
        target_id=target_id,
        title="Tri-sync rollout",
        body="Ship the sync bridge",
        status="open",
        provider_ids={"beads": "bd-1"},
    )
