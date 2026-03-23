from __future__ import annotations

from datetime import datetime, timezone, timedelta

from scripts.task_sync.tri_sync import (
    SyncMetadata,
    TaskRecord,
    build_sync_plan,
    extract_sync_key,
    merge_body_with_sync_metadata,
    parse_sync_metadata,
    select_canonical_record,
    task_body_without_sync_block,
)


def make_record(
    provider: str,
    external_id: str,
    title: str,
    body: str,
    status: str,
    minutes_ago: int,
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
    earlier = make_record("asana", "A-1", "Tri-sync", "Body", "open", 30, "tri-sync")
    later = make_record("jira", "PIX-1", "Tri-sync", "Body", "open", 5, "tri-sync")
    tie_beads = make_record("beads", "bd-1", "Tri-sync", "Body", "open", 5, "tri-sync")

    assert select_canonical_record([earlier, later, tie_beads]).provider == "beads"


def test_build_sync_plan_creates_missing_targets_and_updates_stale_targets() -> None:
    beads = make_record(
        "beads",
        "bd-1",
        "Tri-sync rollout",
        "Ship the sync bridge",
        "open",
        1,
        "tri-sync-rollout",
    )
    asana = make_record(
        "asana",
        "A-7",
        "Tri-sync rollout",
        "Ship the sync bridge but old",
        "open",
        20,
        "tri-sync-rollout",
    )

    plan = build_sync_plan(
        {
            "beads": [beads],
            "asana": [asana],
        },
        enabled_providers=("beads", "asana", "jira", "linear"),
    )

    actions = {(action.provider, action.action) for action in plan}

    assert ("asana", "update") in actions
    assert ("jira", "create") in actions
    assert ("linear", "create") in actions
    assert ("beads", "create") not in actions


def test_build_sync_plan_updates_when_provider_links_are_incomplete() -> None:
    beads = make_record(
        "beads",
        "bd-1",
        "Tri-sync rollout",
        "Ship the sync bridge",
        "open",
        1,
        "tri-sync-rollout",
    )
    asana = make_record(
        "asana",
        "A-7",
        "Tri-sync rollout",
        "Ship the sync bridge",
        "open",
        1,
        "tri-sync-rollout",
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
