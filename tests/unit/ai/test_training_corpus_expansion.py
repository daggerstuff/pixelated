from __future__ import annotations

import json

from ai.training_corpus import (
    DEFAULT_WAVE5_EXPANSION_DRAFT_LEDGER_PATH,
    DEFAULT_WAVE5_EXPANSION_QUEUE_PATH,
    ExpansionCandidateArtifacts,
    ExpansionCandidateContext,
    ExpansionDraftContext,
    build_expansion_authoring_packets,
    build_expansion_candidate_record,
    build_expansion_draft_entry,
    expansion_draft_status_counts,
    expansion_queue_lane_targets,
    expansion_queue_priority_counts,
    expansion_queue_ticket_ids,
    load_expansion_draft_ledger,
    load_expansion_queue,
    materialize_expansion_authoring_packets,
    write_expansion_draft_ledger,
)


def test_load_expansion_queue_reads_wave_five_asset() -> None:
    queue = load_expansion_queue(DEFAULT_WAVE5_EXPANSION_QUEUE_PATH)

    assert len(queue) == 10
    queue_by_id = {item.queue_id: item for item in queue}
    assert queue_by_id["wave5:soulchat"].total_row_budget == 184
    assert queue_by_id["wave5:counsel_chat_raw"].target_outputs["preference_seed"] == 30
    assert queue_by_id["wave5:psycrisisbench"].priority == "P1"


def test_build_expansion_authoring_packets_preserves_total_budget() -> None:
    queue = load_expansion_queue(DEFAULT_WAVE5_EXPANSION_QUEUE_PATH)

    packets = build_expansion_authoring_packets(queue)

    assert packets
    assert sum(packet["requested_rows"] for packet in packets) == sum(
        item.total_row_budget for item in queue if item.status == "ready_for_authoring"
    )
    assert any(packet["target_output"] == "preference_seed" for packet in packets)
    assert all(packet["requested_rows"] > 0 for packet in packets)
    assert all(packet["batch_index"] <= packet["batch_count"] for packet in packets)


def test_materialize_expansion_authoring_packets_writes_manifest(tmp_path) -> None:
    queue = load_expansion_queue(DEFAULT_WAVE5_EXPANSION_QUEUE_PATH)
    packets_path = tmp_path / "wave5_packets.jsonl"
    manifest_path = tmp_path / "wave5_manifest.json"

    written = materialize_expansion_authoring_packets(
        queue,
        packets_path,
        manifest_path=manifest_path,
    )

    lines = packets_path.read_text(encoding="utf-8").splitlines()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    assert written["packets"] == packets_path
    assert written["manifest"] == manifest_path
    assert len(lines) > 50
    assert manifest["queue_size"] == 10
    assert manifest["by_target_output"]["simulation_seed"] == 610
    assert manifest["by_target_output"]["benchmark_seed"] == 428
    assert manifest["by_target_output"]["evaluator_seed"] == 200
    assert manifest["by_target_output"]["preference_seed"] == 50
    assert manifest["by_queue"]["wave5:soulchat"]["total_row_budget"] == 184


def test_expansion_queue_helpers_return_priority_ids_and_lane_totals() -> None:
    queue = load_expansion_queue(DEFAULT_WAVE5_EXPANSION_QUEUE_PATH)

    assert expansion_queue_ticket_ids(queue) == [
        "wave5:soulchat",
        "wave5:counsel_chat_raw",
        "wave5:psydt",
        "wave5:reddit_specialized_populations",
        "wave5:reddit_condition_specific",
        "wave5:psycrisisbench",
        "wave5:counselbench",
        "wave5:therapygym",
        "wave5:carebench_cbt",
        "wave5:failure_pair_harvest",
    ]
    assert expansion_queue_priority_counts(queue) == {"P0": 3, "P1": 4, "P2": 2, "P3": 1}
    assert expansion_queue_lane_targets(queue) == {
        "benchmark": 478,
        "evaluator": 200,
        "simulation": 610,
    }


def test_load_expansion_draft_ledger_reads_default_asset() -> None:
    ledger = load_expansion_draft_ledger(DEFAULT_WAVE5_EXPANSION_DRAFT_LEDGER_PATH)

    assert ledger["version"] == "2026-04-09-wave5-expansion-draft-ledger"
    assert ledger["queue_version"] == "2026-04-09-wave5-expansion-queue"
    assert ledger["drafts"] == []


def test_build_candidate_and_draft_entry_round_trip(tmp_path) -> None:
    queue = load_expansion_queue(DEFAULT_WAVE5_EXPANSION_QUEUE_PATH)
    item = next(entry for entry in queue if entry.queue_id == "wave5:soulchat")

    candidate = build_expansion_candidate_record(
        queue_item=item,
        lane="simulation",
        dialogue=ExpansionCandidateContext(
            prompt="I know the thought is irrational, but I still panic when my boss emails late at night.",
            response="Part of me knows it is probably nothing, but another part is already preparing for disaster.",
            source_excerpt="Client catastrophizes a delayed email response as proof of impending punishment.",
            source_fields_mined=("session progression", "belief dispute turns"),
        ),
        artifacts=ExpansionCandidateArtifacts(
            scenario_archetype={
                "scenario_id": "scenario_rebt_after_hours_email_spiral",
                "difficulty": "high",
                "hidden_driver": "catastrophic_belief_activation",
            },
            client_state_profile={
                "state_id": "state_reassurance_not_sticking",
                "label": "Reassurance Not Sticking",
            },
            therapist_moves=(
                {"move_id": "move_belief_disputation", "label": "Belief Disputation"},
            ),
        ),
    )

    draft = build_expansion_draft_entry(
        draft_id="draft-001",
        queue_item=item,
        candidate_record=candidate,
        draft=ExpansionDraftContext(
            lane="simulation",
            kind="scenario",
            status="drafted",
            source_excerpt="A delayed email becomes proof of punishment in the client's mind.",
            review_notes=("Needs stronger continuity callback.",),
        ),
    )
    ledger = {
        "version": "2026-04-09-wave5-expansion-draft-ledger",
        "queue_version": "2026-04-09-wave5-expansion-queue",
        "drafts": [draft],
    }
    output_path = tmp_path / "wave5_expansion_draft_ledger.json"
    write_expansion_draft_ledger(ledger, output_path)

    saved = load_expansion_draft_ledger(output_path)
    assert expansion_draft_status_counts(saved) == {"drafted": 1}
    assert saved["drafts"][0]["queue_id"] == "wave5:soulchat"
    assert saved["drafts"][0]["candidate_record"]["metadata"]["expansion_queue"]["queue_id"] == "wave5:soulchat"
