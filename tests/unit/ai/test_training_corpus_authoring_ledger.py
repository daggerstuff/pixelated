from __future__ import annotations

import json
from pathlib import Path

from ai.training_corpus.expansion_authoring import (
    build_authoring_ledger,
    materialize_authoring_ledger,
    write_authoring_ledger_report,
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
