from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from typing import Any

from scripts.task_sync.tri_sync import (
    SyncAction,
    SyncMetadata,
    TaskRecord,
    apply_sync_plan,
    build_sync_plan,
    extract_sync_key,
    merge_body_with_sync_metadata,
    normalize_asana_payload,
    normalize_jira_payload,
    parse_sync_metadata,
    plan_from_sources,
    select_canonical_record,
    task_body_without_sync_block,
)


def make_record(
    provider: str,
    external_id: str,
    title: str,
    body: str,
    status: str,
    **kwargs: Any,
) -> TaskRecord:
    minutes_ago = kwargs.get("minutes_ago", 0)
    sync_key = kwargs.get("sync_key")
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


def test_build_sync_plan_ignores_records_without_sync_keys() -> None:
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

    assert plan == []


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


def test_apply_sync_plan_runs_beads_and_external_provider_commands() -> None:
    commands: list[tuple[list[str], str | None]] = []

    def fake_runner(command, *, input_text=None):
        command_list = list(command)
        commands.append((command_list, input_text))
        if command_list[:2] == ["bd", "create"]:
            return SimpleNamespace(returncode=0, stdout="bd-42\n", stderr="")
        return SimpleNamespace(returncode=0, stdout="ok\n", stderr="")

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
    assert commands[0][0][:2] == ["bd", "create"]
    assert commands[1][0] == ["cat"]
    assert '"provider": "asana"' in (commands[1][1] or "")


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
