from __future__ import annotations

import json
from pathlib import Path

from ai.training_corpus.expansion_queue import (
    SeedPackQueueConfig,
    build_authoring_batches,
    build_draft_queue_from_packets,
    build_expansion_packet_queue,
    build_expansion_queue_entry,
    build_seed_pack_from_queue,
    load_expansion_queue,
    load_expansion_source_registry,
    save_expansion_queue,
    write_expansion_execution_plan,
    write_seed_pack_from_queue,
)


def test_save_and_load_expansion_queue_roundtrip(tmp_path: Path) -> None:
    queue_path = tmp_path / "wave5_queue.json"
    entries = [
        build_expansion_queue_entry(
            {
                "queue_id": "wave5::scenario::after_hours_email_spiral",
                "source_ref": "wave5_soulchat_rebt_sessions",
                "source_family": "wave5_expansion_queue",
                "artifact_kind": "scenario",
                "draft_status": "reviewed",
                "target_pack": "wave5_batch1",
                "title": "After-Hours Email Spiral",
                "provenance_notes": ["Reverse-engineered from REBT session pacing."],
                "candidate_payload": {
                    "scenario_id": "scenario_rebt_after_hours_email_spiral",
                    "title": "After-Hours Email Spiral",
                    "difficulty": "high",
                    "hidden_driver": "catastrophic_belief_activation",
                },
            }
        ),
        build_expansion_queue_entry(
            {
                "queue_id": "wave5::benchmark::after_hours_email_spiral",
                "source_ref": "wave5_soulchat_rebt_sessions",
                "source_family": "wave5_expansion_queue",
                "artifact_kind": "benchmark_spec",
                "draft_status": "queued",
                "target_pack": "wave5_batch1",
                "title": "REBT Challenge Calibration",
                "candidate_payload": {
                    "benchmark_id": "benchmark_rebt_challenge_calibration",
                    "benchmark_slice": "benchmark_supervisor_rubrics",
                },
            }
        ),
    ]

    save_expansion_queue(
        queue_path,
        entries,
        pack_id="wave5_batch1",
        source_artifacts=["ai/training_corpus/assets/wave5_expansion_queue.json"],
    )

    payload = json.loads(queue_path.read_text(encoding="utf-8"))
    assert payload["pack_id"] == "wave5_batch1"
    roundtrip = load_expansion_queue(queue_path)
    assert len(roundtrip) == 2
    assert roundtrip[0].queue_id == "wave5::scenario::after_hours_email_spiral"
    assert roundtrip[0].candidate_payload["scenario_id"] == "scenario_rebt_after_hours_email_spiral"


def test_build_seed_pack_from_queue_filters_to_reviewed_or_promoted_entries() -> None:
    entries = (
        build_expansion_queue_entry(
            {
                "queue_id": "wave5::scenario::after_hours_email_spiral",
                "source_ref": "wave5_soulchat_rebt_sessions",
                "source_family": "wave5_expansion_queue",
                "artifact_kind": "scenario",
                "draft_status": "reviewed",
                "target_pack": "wave5_batch1",
                "candidate_payload": {
                    "scenario_id": "scenario_rebt_after_hours_email_spiral",
                    "title": "After-Hours Email Spiral",
                },
            }
        ),
        build_expansion_queue_entry(
            {
                "queue_id": "wave5::state::reassurance_not_sticking",
                "source_ref": "wave5_soulchat_rebt_sessions",
                "source_family": "wave5_expansion_queue",
                "artifact_kind": "state_profile",
                "draft_status": "promoted",
                "target_pack": "wave5_batch1",
                "candidate_payload": {
                    "state_id": "state_reassurance_not_sticking",
                    "label": "Reassurance Not Sticking",
                },
            }
        ),
        build_expansion_queue_entry(
            {
                "queue_id": "wave5::benchmark::queued_only",
                "source_ref": "wave5_soulchat_rebt_sessions",
                "source_family": "wave5_expansion_queue",
                "artifact_kind": "benchmark_spec",
                "draft_status": "queued",
                "target_pack": "wave5_batch1",
                "candidate_payload": {
                    "benchmark_id": "benchmark_should_not_materialize",
                },
            }
        ),
    )

    seed_pack = build_seed_pack_from_queue(
        entries,
        SeedPackQueueConfig(
            pack_id="wave5_batch1",
            version="2026-04-09-wave5-batch1",
            source_artifacts=("ai/training_corpus/assets/wave5_expansion_queue.json",),
        ),
    )

    assert seed_pack["pack_id"] == "wave5_batch1"
    assert len(seed_pack["scenario_archetypes"]) == 1
    assert len(seed_pack["client_state_profiles"]) == 1
    assert seed_pack["benchmark_specs"] == []


def test_write_seed_pack_from_queue_materializes_json(tmp_path: Path) -> None:
    queue_path = tmp_path / "wave5_queue.json"
    output_path = tmp_path / "wave5_seed_pack.json"
    entries = [
        build_expansion_queue_entry(
            {
                "queue_id": "wave5::move::belief_disputation",
                "source_ref": "wave5_soulchat_rebt_sessions",
                "source_family": "wave5_expansion_queue",
                "artifact_kind": "therapist_move",
                "draft_status": "reviewed",
                "target_pack": "wave5_batch1",
                "candidate_payload": {
                    "move_id": "move_belief_disputation_chain",
                    "label": "Belief Disputation Chain",
                },
            }
        )
    ]
    save_expansion_queue(queue_path, entries, pack_id="wave5_batch1")

    path = write_seed_pack_from_queue(
        queue_path,
        output_path,
        SeedPackQueueConfig(
            pack_id="wave5_batch1",
            version="2026-04-09-wave5-batch1",
        ),
    )

    assert path == output_path
    payload = json.loads(output_path.read_text(encoding="utf-8"))
    assert payload["therapist_move_inventory"][0]["move_id"] == "move_belief_disputation_chain"


def test_build_expansion_packet_queue_materializes_active_wave5_sources() -> None:
    registry = load_expansion_source_registry()

    queue = build_expansion_packet_queue(registry)

    assert queue["active_sources"] >= 5
    assert queue["packet_count"] >= 16
    assert any(packet["source_id"].endswith("task_5_9_soulchat") for packet in queue["packets"])
    assert any(packet["source_id"].endswith("PsyDTCorpus") for packet in queue["packets"])


def test_build_authoring_batches_groups_packets_by_source() -> None:
    queue = {
        "packets": [
            {
                "packet_id": "soulchat::01::session-phase-transitions",
                "source_key": "wave5_soulchat_rebt_sessions",
                "source_id": "gdrive:processed/phase_2/task_5_9_soulchat",
                "source_class": "remote_processed",
                "priority": "HIGH",
                "mode": "SYNTHESIS_FEEDSTOCK",
                "extraction_target": "session_phase_transitions",
                "allowed_lanes": ["simulation"],
                "fields_to_mine": ["session_progression"],
                "extraction_focus": ["continuity"],
                "discard_zones": [],
            },
            {
                "packet_id": "soulchat::02::hidden-therapist-move-chains",
                "source_key": "wave5_soulchat_rebt_sessions",
                "source_id": "gdrive:processed/phase_2/task_5_9_soulchat",
                "source_class": "remote_processed",
                "priority": "HIGH",
                "mode": "RUBRIC_SOURCE",
                "extraction_target": "hidden_therapist_move_chains",
                "allowed_lanes": ["evaluator", "benchmark"],
                "fields_to_mine": ["belief_dispute_turns"],
                "extraction_focus": ["hidden_driver_detection"],
                "discard_zones": ["do_not_train_directly_from_reference_text"],
            },
            {
                "packet_id": "counselchat::01::public-question-benchmark-prompts",
                "source_key": "wave5_counselchat_presenting_problems",
                "source_id": "gdrive:datasets/counsel-chat/data",
                "source_class": "remote_raw",
                "priority": "HIGH",
                "mode": "BENCHMARK_SEED",
                "extraction_target": "public_question_benchmark_prompts",
                "allowed_lanes": ["benchmark", "evaluator"],
                "fields_to_mine": ["public_question_benchmark_prompts"],
                "extraction_focus": ["benchmark_questions"],
                "discard_zones": ["keep_as_holdout_or_design_seed"],
            },
        ]
    }

    batches = build_authoring_batches(queue, max_packets_per_batch=2)

    assert len(batches) == 2
    assert [batch["batch_id"] for batch in batches] == [
        "wave5_batch_01_task-5-9-soulchat",
        "wave5_batch_02_data",
    ]
    assert batches[0]["packet_ids"] == [
        "soulchat::01::session-phase-transitions",
        "soulchat::02::hidden-therapist-move-chains",
    ]


def test_build_draft_queue_from_packets_scaffolds_entries() -> None:
    queue = {
        "packets": [
            {
                "packet_id": "psydt::01::intervention-sequence-patterns",
                "source_key": "wave5_psydt_long_horizon",
                "source_id": "gdrive:datasets/SoulChat2.0/PsyDTCorpus",
                "source_title": "PsyDT Long-Horizon Sessions",
                "source_class": "remote_raw",
                "priority": "HIGH",
                "mode": "RUBRIC_SOURCE",
                "extraction_target": "intervention_sequence_patterns",
                "allowed_lanes": ["evaluator", "benchmark"],
                "fields_to_mine": ["intervention_sequence_patterns"],
                "extraction_focus": ["long_horizon_session_scaffolds"],
                "discard_zones": ["do_not_train_directly_from_reference_text", "do_not_copy_counselor_persona_style"],
                "row_targets": {"simulation_seed": 60, "evaluator_seed": 16},
            }
        ]
    }

    ticket_queue = build_draft_queue_from_packets(queue)

    assert len(ticket_queue) == 1
    ticket = ticket_queue[0]
    assert ticket.queue_id == "wave5::therapist_move::psydtcorpus::01"
    assert ticket.target_pack == "wave5_batch_01_psydtcorpus"
    assert ticket.metadata["lane_targets"] == ["evaluator", "benchmark"]
    assert ticket.metadata["packet_id"] == "psydt::01::intervention-sequence-patterns"
    assert "do_not_copy_counselor_persona_style" in ticket.governance_flags


def test_write_expansion_execution_plan_materializes_packet_and_draft_queue(tmp_path: Path) -> None:
    registry_path = tmp_path / "wave5_registry.json"
    registry_path.write_text(
        json.dumps(
            [
                {
                    "source_key": "wave5_counselchat_presenting_problems",
                    "source_title": "CounselChat Presenting Problems",
                    "source_id": "gdrive:processed/phase_2_professional_datasets/task_5_10_counsel_chat",
                    "class": "remote_processed",
                    "salvage_modes": ["SYNTHESIS_FEEDSTOCK", "BENCHMARK_SEED"],
                    "priority": "HIGH",
                    "expansion_now": True,
                    "evidence": {"processed_rows": 2484},
                    "row_targets": {"simulation_seed": 48, "benchmark_seed": 16},
                    "authoring_targets": {"simulation": 24, "benchmark": 8},
                    "fields_to_mine": ["presenting_problem_clusters", "benchmark_question_families"],
                    "authoring_focus": ["public_help_seeking_rewrites"],
                    "extraction_targets": [
                        "presenting_problem_clusters",
                        "benchmark_question_families",
                    ],
                }
            ],
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    result = write_expansion_execution_plan(
        tmp_path / "report",
        source_registry_path=registry_path,
    )

    assert result["packet_queue"]["packet_count"] == 2
    assert len(result["batches"]) == 1
    assert result["ticket_queue"]["ticket_count"] == 1
    assert result["draft_queue_entries"] == 2
    assert (tmp_path / "report" / "expansion_queue.json").exists()
    assert (tmp_path / "report" / "expansion_ticket_queue.json").exists()
    assert (tmp_path / "report" / "expansion_draft_queue.json").exists()
    assert (tmp_path / "report" / "expansion_batches.json").exists()
    assert (tmp_path / "report" / "expansion_execution_plan.md").exists()
