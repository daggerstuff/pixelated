from __future__ import annotations

import json
from pathlib import Path

from ai.training_corpus.expansion_authoring import (
    apply_authored_batch,
    build_authoring_ledger,
    build_authoring_target,
    load_authored_batch,
    materialize_authoring_ledger,
    write_applied_authoring_batch_report,
    write_authoring_ledger_report,
    write_authoring_target_report,
)


def test_build_authoring_ledger_creates_templates_and_progress() -> None:
    draft_pack = {
        "version": "demo-draft-pack",
        "authoring_cards": [
            {
                "card_id": "wave5::demo::scenario_archetypes",
                "ticket_id": "wave5::demo",
                "source_key": "demo_source",
                "source_title": "Demo Source",
                "priority": "P0",
                "artifact_type": "scenario_archetypes",
                "target_count": 8,
                "lane_targets": ["simulation"],
                "required_fields": [
                    "scenario_id",
                    "title",
                    "activation_cues",
                    "repair_opportunities",
                ],
                "fields_to_mine": ["presenting_problem"],
                "extraction_focus": ["challenge calibration"],
                "discard_zones": ["do_not_copy_source_wording"],
                "writing_notes": ["Abstract the source into Pixelated-native phrasing."],
                "sample_paths": ["remote/demo.jsonl"],
                "sample_evidence": [{"label": "sample", "excerpt": "Client freezes before asking for help."}],
            }
        ],
    }

    ledger = build_authoring_ledger(draft_pack, version="demo-ledger")

    assert ledger["version"] == "demo-ledger"
    assert ledger["ledger_entry_count"] == 1
    assert ledger["total_target_rows"] == 8
    entry = ledger["entries"][0]
    assert entry["ledger_entry_id"] == "wave5::demo::scenario_archetypes"
    assert entry["row_template"]["scenario_id"] == ""
    assert entry["row_template"]["activation_cues"] == []
    assert entry["progress"]["remaining_count"] == 8
    assert entry["draft_rows"] == []


def test_materialize_and_write_authoring_ledger_report(tmp_path: Path) -> None:
    draft_pack_path = tmp_path / "draft_pack.json"
    draft_pack_path.write_text(
        json.dumps(
            {
                "version": "demo-draft-pack",
                "authoring_cards": [
                    {
                        "card_id": "wave5::demo::benchmark_specs",
                        "ticket_id": "wave5::demo",
                        "source_key": "demo_source",
                        "source_title": "Demo Source",
                        "priority": "P1",
                        "artifact_type": "benchmark_specs",
                        "target_count": 4,
                        "lane_targets": ["benchmark", "evaluator"],
                        "required_fields": [
                            "benchmark_id",
                            "benchmark_slice",
                            "must_detect",
                            "rubric_items",
                        ],
                        "fields_to_mine": ["benchmark_question_families"],
                        "extraction_focus": ["benchmark compression"],
                        "discard_zones": ["keep_as_holdout_or_design_seed"],
                        "writing_notes": ["Keep benchmark prompts compact."],
                        "sample_paths": ["remote/demo.jsonl"],
                        "sample_evidence": [{"label": "sample", "excerpt": "Client asks if panic means danger."}],
                    }
                ],
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    ledger = build_authoring_ledger(json.loads(draft_pack_path.read_text(encoding="utf-8")))
    materialized = materialize_authoring_ledger(ledger, tmp_path / "authoring_ledger.json")
    assert materialized.exists()

    report = write_authoring_ledger_report(
        tmp_path / "report",
        draft_pack_path=draft_pack_path,
        ledger_path=tmp_path / "wave5_authoring_ledger.json",
    )

    assert report["ledger_entry_count"] == 1
    assert (tmp_path / "report" / "authoring_ledger.json").exists()
    assert (tmp_path / "report" / "authoring_ledger.md").exists()
    materialized_payload = json.loads((tmp_path / "wave5_authoring_ledger.json").read_text(encoding="utf-8"))
    assert materialized_payload["entries"][0]["row_template"]["must_detect"] == []


def test_build_authoring_target_filters_single_source_and_orders_entries() -> None:
    ledger = {
        "version": "demo-ledger",
        "entries": [
            {
                "ledger_entry_id": "wave5::demo::dialogue_seed_rows",
                "source_key": "demo_source",
                "source_title": "Demo Source",
                "priority": "P0",
                "artifact_type": "dialogue_seed_rows",
                "target_count": 40,
                "lane_targets": ["simulation"],
            },
            {
                "ledger_entry_id": "wave5::demo::scenario_archetypes",
                "source_key": "demo_source",
                "source_title": "Demo Source",
                "priority": "P0",
                "artifact_type": "scenario_archetypes",
                "target_count": 8,
                "lane_targets": ["simulation"],
            },
            {
                "ledger_entry_id": "wave5::other::benchmark_specs",
                "source_key": "other_source",
                "source_title": "Other Source",
                "priority": "P1",
                "artifact_type": "benchmark_specs",
                "target_count": 6,
                "lane_targets": ["benchmark"],
            },
        ],
    }

    target = build_authoring_target(ledger, source_key="demo_source")

    assert target["source_key"] == "demo_source"
    assert target["entry_count"] == 2
    assert target["target_rows"] == 48
    assert [entry["artifact_type"] for entry in target["starter_batch"]] == [
        "scenario_archetypes",
        "dialogue_seed_rows",
    ]


def test_write_authoring_target_report_materializes_source_bundle(tmp_path: Path) -> None:
    ledger_path = tmp_path / "wave5_authoring_ledger.json"
    ledger_path.write_text(
        json.dumps(
            {
                "version": "demo-ledger",
                "entries": [
                    {
                        "ledger_entry_id": "wave5::demo::scenario_archetypes",
                        "source_key": "demo_source",
                        "source_title": "Demo Source",
                        "priority": "P0",
                        "artifact_type": "scenario_archetypes",
                        "target_count": 8,
                        "lane_targets": ["simulation"],
                    }
                ],
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    target = write_authoring_target_report(
        tmp_path / "target_bundle",
        source_key="demo_source",
        ledger_path=ledger_path,
    )

    assert target["entry_count"] == 1
    assert (tmp_path / "target_bundle" / "authoring_target.json").exists()
    assert (tmp_path / "target_bundle" / "authoring_target.md").exists()


def test_apply_authored_batch_updates_rows_and_progress() -> None:
    ledger = {
        "version": "demo-ledger",
        "entries": [
            {
                "ledger_entry_id": "wave5::demo::scenario_archetypes",
                "source_key": "demo_source",
                "artifact_type": "scenario_archetypes",
                "target_count": 3,
                "required_fields": [
                    "scenario_id",
                    "title",
                    "summary",
                    "activation_cues",
                    "hidden_driver",
                    "difficulty",
                    "repair_opportunities",
                ],
                "progress": {
                    "drafted_count": 0,
                    "reviewed_count": 0,
                    "promoted_count": 0,
                    "remaining_count": 3,
                },
                "draft_rows": [],
            }
        ],
    }

    applied = apply_authored_batch(
        ledger,
        {
            "batch_id": "demo-batch-1",
            "source_key": "demo_source",
            "artifacts": {
                "scenario_archetypes": [
                    {
                        "scenario_id": "scenario_demo_001",
                        "title": "Demo Scenario",
                        "summary": "A compact authored scenario.",
                        "activation_cues": ["criticism"],
                        "hidden_driver": "shame",
                        "difficulty": "high",
                        "repair_opportunities": ["name the shame"],
                    },
                    {
                        "scenario_id": "scenario_demo_002",
                        "title": "Second Demo Scenario",
                        "summary": "Another compact authored scenario.",
                        "activation_cues": ["silence"],
                        "hidden_driver": "abandonment",
                        "difficulty": "medium",
                        "repair_opportunities": ["slow the spiral"],
                    },
                ]
            },
        },
        applied_at="2026-04-09T00:00:00Z",
    )

    entry = applied["entries"][0]
    assert entry["progress"]["drafted_count"] == 2
    assert entry["progress"]["remaining_count"] == 1
    assert entry["applied_batches"] == ["demo-batch-1"]
    assert entry["last_applied_at"] == "2026-04-09T00:00:00Z"
    assert applied["progress_summary"]["drafted_rows"] == 2
    assert applied["progress_summary"]["by_source_key"]["demo_source"]["drafted_rows"] == 2


def test_load_authored_batch_and_write_applied_report(tmp_path: Path) -> None:
    ledger_path = tmp_path / "wave5_authoring_ledger.json"
    ledger_path.write_text(
        json.dumps(
            {
                "version": "demo-ledger",
                "entries": [
                    {
                        "ledger_entry_id": "wave5::demo::dialogue_seed_rows",
                        "source_key": "demo_source",
                        "artifact_type": "dialogue_seed_rows",
                        "target_count": 5,
                        "required_fields": ["row_id", "lane", "input", "output", "metadata"],
                        "progress": {
                            "drafted_count": 0,
                            "reviewed_count": 0,
                            "promoted_count": 0,
                            "remaining_count": 5,
                        },
                        "draft_rows": [],
                    }
                ],
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    batch_path = tmp_path / "batch.json"
    batch_path.write_text(
        json.dumps(
            {
                "batch_id": "demo-batch-2",
                "source_key": "demo_source",
                "artifacts": {
                    "dialogue_seed_rows": [
                        {
                            "row_id": "row_demo_001",
                            "lane": "simulation",
                            "input": "I keep replaying what I said.",
                            "output": "I know it sounds small, but it keeps proving to me that I mess everything up.",
                            "metadata": {"scenario_id": "scenario_demo_001"},
                        }
                    ]
                },
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    batch = load_authored_batch(batch_path)
    assert batch["batch_id"] == "demo-batch-2"

    report = write_applied_authoring_batch_report(
        tmp_path / "report",
        batch_path=batch_path,
        ledger_path=ledger_path,
        applied_at="wave5-batch-2",
    )

    assert report["last_batch"]["batch_id"] == "demo-batch-2"
    assert report["progress_summary"]["drafted_rows"] == 1
    persisted = json.loads(ledger_path.read_text(encoding="utf-8"))
    assert persisted["entries"][0]["progress"]["drafted_count"] == 1
    assert (tmp_path / "report" / "authoring_ledger.json").exists()
    assert (tmp_path / "report" / "authoring_ledger.md").exists()
