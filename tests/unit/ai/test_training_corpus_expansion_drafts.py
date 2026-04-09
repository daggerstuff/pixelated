from __future__ import annotations

import json
from pathlib import Path

from ai.training_corpus import (
    build_expansion_draft_pack,
    ensure_default_expansion_draft_pack_materialized,
    load_expansion_dossiers,
    load_expansion_ticket_queue,
    materialize_expansion_draft_pack,
)


def test_load_expansion_dossiers_reads_wave_five_artifact() -> None:
    payload = load_expansion_dossiers(
        Path(".agent/internal/research/training_corpus_source_dossiers_wave5_2026-04-09.json")
    )

    assert len(payload) == 5
    assert payload[0]["source_key"] == "task_5_9_soulchat"


def test_build_expansion_draft_pack_creates_authoring_cards() -> None:
    queue = {
        "version": "demo",
        "tickets": [
            {
                "ticket_id": "wave5_demo",
                "source_key": "task_demo",
                "source_title": "Demo source",
                "priority": 1,
                "allowed_lanes": ["simulation", "evaluator", "benchmark"],
                "row_targets": {"simulation": 16, "evaluator": 8, "benchmark": 6},
                "fields_to_mine": ["session progression", "belief dispute turns"],
                "extraction_focus": ["challenge calibration"],
                "discard_zones": ["copy source wording"],
            }
        ],
    }
    dossiers = (
        {
            "source_key": "task_demo",
            "signals_to_mine": ["resistance-softening"],
            "candidate_outputs": ["scenario_archetypes", "therapist_moves"],
            "authoring_rules": ["De-voice the source into Pixelated-native language."],
            "translation_rules": ["Strip therapist persona markers."],
            "inspected_files": ["remote/demo.jsonl"],
            "sample_evidence": [{"label": "sample", "excerpt": "Client resists and then softens."}],
        },
    )

    draft_pack = build_expansion_draft_pack(queue, dossiers, version="demo-draft-pack")

    assert draft_pack["version"] == "demo-draft-pack"
    assert draft_pack["card_count"] >= 5
    assert draft_pack["summary"]["by_source_key"]["task_demo"] == draft_pack["card_count"]
    first = draft_pack["authoring_cards"][0]
    assert first["source_key"] == "task_demo"
    assert "resistance-softening" in first["signals_to_mine"]
    assert first["sample_evidence"][0]["label"] == "sample"


def test_materialize_and_ensure_default_expansion_draft_pack(tmp_path: Path) -> None:
    queue = load_expansion_ticket_queue()
    dossiers = load_expansion_dossiers(
        Path(".agent/internal/research/training_corpus_source_dossiers_wave5_2026-04-09.json")
    )
    output_path = tmp_path / "draft_pack.json"

    draft_pack = build_expansion_draft_pack(queue, dossiers)
    materialized = materialize_expansion_draft_pack(draft_pack, output_path)

    assert materialized.exists()
    assert json.loads(materialized.read_text(encoding="utf-8"))["card_count"] > 0

    ensured_path = ensure_default_expansion_draft_pack_materialized(
        queue_path=Path("ai/training_corpus/assets/wave5_expansion_ticket_queue.json"),
        dossier_path=Path(".agent/internal/research/training_corpus_source_dossiers_wave5_2026-04-09.json"),
        output_path=tmp_path / "ensured_draft_pack.json",
    )

    assert ensured_path.exists()
    ensured = json.loads(ensured_path.read_text(encoding="utf-8"))
    assert ensured["summary"]["by_source_key"]["task_5_9_soulchat"] >= 1
