from __future__ import annotations

import json
from pathlib import Path

import pytest

from ai.training_corpus import CorpusBuildConfig, CorpusBuilder, build_source_inventory
from ai.training_corpus.model import CorpusSource
from ai.training_corpus.normalize import assign_split, make_entry


def test_assign_split_is_deterministic() -> None:
    assert assign_split("entry-123", "seed-a") == assign_split("entry-123", "seed-a")


def test_make_entry_handles_message_conversations() -> None:
    source = CorpusSource(
        source_id="demo",
        registry_group="unit",
        family="conversation",
        stage="stage1_foundation",
        locator=Path("/tmp/demo.jsonl"),
        source_type="conversation",
        allowed_lanes=("simulation",),
        default_lane="simulation",
    )
    entry = make_entry(
        source,
        {
            "conversation_id": "conv-1",
            "messages": [
                {"role": "user", "content": " I feel off today. "},
                {"role": "assistant", "content": " Let's talk through what feels different. "},
            ],
            "metadata": {"quality_score": 0.9, "safety_score": 0.9},
        },
        "seed-a",
    )

    assert entry is not None
    assert entry.prompt == "I feel off today."
    assert entry.response == "Let's talk through what feels different."
    assert entry.lane == "simulation"
    assert entry.attributes["conversation_id"] == "conv-1"


def test_corpus_builder_writes_fresh_artifacts(tmp_path: Path) -> None:
    data_path = tmp_path / "source.jsonl"
    data_path.write_text(
        "\n".join(
            [
                json.dumps(
                    {
                        "messages": [
                            {"role": "user", "content": "I feel overwhelmed."},
                            {"role": "assistant", "content": "Let's slow it down together."},
                        ],
                        "metadata": {"quality_score": 0.9, "safety_score": 0.9},
                    }
                ),
                json.dumps(
                    {
                        "input": "bad",
                        "output": "drop me",
                        "metadata": {"quality_score": 0.2, "safety_score": 0.9},
                    }
                ),
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    registry_path = tmp_path / "registry.json"
    registry_path.write_text(
        json.dumps(
            {
                "datasets": {
                    "professional_therapeutic": {
                        "demo": {
                            "path": "s3://pixelated/demo.jsonl",
                            "stage": "stage1_foundation",
                            "type": "conversation",
                            "quality_profile": "curated",
                            "focus": "unit-test",
                            "fallback_paths": {"local": str(data_path)},
                            "legacy_paths": [],
                        }
                    }
                }
            }
        ),
        encoding="utf-8",
    )

    destination = tmp_path / "build"
    result = CorpusBuilder(
        CorpusBuildConfig(
            name="pixelated-corpus",
            version="2026.04.08",
            registry_path=registry_path,
            destination=destination,
            verify_reproducibility=True,
        )
    ).build()

    assert result.manifest.total_entries == 1
    assert (destination / "corpus.jsonl").exists()
    assert (destination / "manifest.json").exists()
    assert (destination / "package.json").exists()
    assert (destination / "source_inventory.json").exists()
    assert (destination / "leakage_report.json").exists()
    assert (destination / "split_manifest.json").exists()
    assert (destination / "transformation_log.json").exists()
    assert (destination / "build_config.json").exists()
    assert (destination / "rubric_coverage_summary.json").exists()
    assert (destination / "clinician_review_summary.json").exists()
    assert (destination / "safety_governance_summary.json").exists()
    assert (destination / "continuity_report.json").exists()
    assert (destination / "benchmark_package.json").exists()
    assert (destination / "data_card.json").exists()
    assert (destination / "release_checklist.json").exists()
    assert (destination / "release_notes.md").exists()
    assert (destination / "reproducibility_report.json").exists()
    assert (destination / "splits" / "train.jsonl").exists()
    assert (destination / "lanes" / "simulation.jsonl").exists()
    assert result.manifest.by_lane == {"simulation": 1}
    assert result.manifest.by_family == {"professional_therapeutic": 1}
    assert len(result.sources) == 1
    split_manifest = json.loads((destination / "split_manifest.json").read_text(encoding="utf-8"))
    assert split_manifest["split_seed"] == "pixelated-corpus-v1"
    transformation_log = json.loads(
        (destination / "transformation_log.json").read_text(encoding="utf-8")
    )
    assert transformation_log["row_processing"]["raw_rows"] == 2
    assert transformation_log["row_processing"]["accepted_rows"] == 1
    reproducibility_report = json.loads(
        (destination / "reproducibility_report.json").read_text(encoding="utf-8")
    )
    assert reproducibility_report["enabled"] is True
    assert reproducibility_report["verified"] is True
    data_card = json.loads((destination / "data_card.json").read_text(encoding="utf-8"))
    assert data_card["intended_use"].startswith("Client-simulator-first training corpus")


def test_build_source_inventory_classifies_policy_sources(tmp_path: Path) -> None:
    registry_path = tmp_path / "registry.json"
    registry_path.write_text(
        json.dumps(
            {
                "datasets": {},
                "edge_case_sources": {
                    "safety_dpo_pairs": {
                        "path": "s3://pixelated/policy.jsonl",
                        "stage": "stage3_edge_stress_test",
                        "type": "dpo_pairs",
                        "quality_profile": "edge_dpo",
                        "focus": "policy",
                        "fallback_paths": {"local": str(tmp_path / "policy.jsonl")},
                    }
                },
            }
        ),
        encoding="utf-8",
    )

    inventory = build_source_inventory(registry_path)

    assert len(inventory) == 1
    assert inventory[0].source_id == "edge_case_sources.safety_dpo_pairs"
    assert inventory[0].inventory_decision == "keep"
    assert inventory[0].default_lane == "policy"
    assert inventory[0].allowed_lanes == ("policy", "benchmark")
    assert inventory[0].license_status == "review_required"
    assert inventory[0].provenance_status == "registry_and_fallback"
    assert inventory[0].benchmark_role == "holdout_eligible"


def test_corpus_builder_routes_policy_and_evaluator_lanes(tmp_path: Path) -> None:
    simulation_path = tmp_path / "simulation.jsonl"
    policy_path = tmp_path / "policy.jsonl"
    evaluator_path = tmp_path / "evaluator.jsonl"

    simulation_path.write_text(
        json.dumps(
            {
                "messages": [
                    {"role": "user", "content": "I don't think therapy works for me."},
                    {"role": "assistant", "content": "You keep saying that, but I still showed up."},
                ],
                "metadata": {"quality_score": 0.95, "safety_score": 0.9},
            }
        )
        + "\n",
        encoding="utf-8",
    )
    policy_path.write_text(
        json.dumps(
            {
                "input": "The client says they might hurt themselves tonight.",
                "output": "Escalate to immediate crisis protocol and avoid false reassurance.",
                "metadata": {"quality_score": 0.95, "safety_score": 0.95},
            }
        )
        + "\n",
        encoding="utf-8",
    )
    evaluator_path.write_text(
        json.dumps(
            {
                "input": "Assess the therapist response for alliance rupture repair.",
                "output": "Score empathy, repair timing, and boundary clarity.",
                "metadata": {
                    "quality_score": 0.95,
                    "safety_score": 0.95,
                    "rubric_items": [
                        {"name": "empathy", "weight": 0.5},
                        {"name": "boundary clarity", "weight": 0.5},
                    ],
                },
            }
        )
        + "\n",
        encoding="utf-8",
    )

    registry_path = tmp_path / "registry.json"
    registry_path.write_text(
        json.dumps(
            {
                "datasets": {
                    "professional_therapeutic": {
                        "sim": {
                            "path": "s3://pixelated/simulation.jsonl",
                            "stage": "stage1_foundation",
                            "type": "conversation",
                            "quality_profile": "foundation",
                            "focus": "simulation",
                            "fallback_paths": {"local": str(simulation_path)},
                            "legacy_paths": [],
                        }
                    }
                },
                "edge_case_sources": {
                    "safety_dpo_pairs": {
                        "path": "s3://pixelated/policy.jsonl",
                        "stage": "stage3_edge_stress_test",
                        "type": "dpo_pairs",
                        "quality_profile": "edge_dpo",
                        "focus": "policy",
                        "fallback_paths": {"local": str(policy_path)},
                    }
                },
                "supplementary": {
                    "psychology_10k": {
                        "path": "s3://pixelated/evaluator.jsonl",
                        "stage": "stage2_therapeutic_expertise",
                        "type": "knowledge_base",
                        "quality_profile": "knowledge_base",
                        "focus": "evaluator",
                        "fallback_paths": {"local": str(evaluator_path)},
                    }
                },
            }
        ),
        encoding="utf-8",
    )

    destination = tmp_path / "build"
    result = CorpusBuilder(
        CorpusBuildConfig(
            name="pixelated-corpus",
            version="2026.04.08",
            registry_path=registry_path,
            destination=destination,
        )
    ).build()

    assert result.manifest.total_entries == 3
    assert result.manifest.by_lane == {"simulation": 1, "policy": 1, "evaluator": 1}
    assert (destination / "lanes" / "policy.jsonl").exists()
    assert (destination / "lanes" / "evaluator.jsonl").exists()
    inventory_payload = json.loads((destination / "source_inventory.json").read_text(encoding="utf-8"))
    assert len(inventory_payload["sources"]) == 3
    assert {row["default_lane"] for row in inventory_payload["sources"]} == {
        "simulation",
        "policy",
        "evaluator",
    }
    rubric_summary = json.loads(
        (destination / "rubric_coverage_summary.json").read_text(encoding="utf-8")
    )
    assert rubric_summary["entries_with_rubrics"] == 1
    assert rubric_summary["rubric_items"] == 2
    assert rubric_summary["by_lane"]["evaluator"]["entries_with_rubrics"] == 1
    clinician_review_summary = json.loads(
        (destination / "clinician_review_summary.json").read_text(encoding="utf-8")
    )
    assert clinician_review_summary["entries_with_hooks"] == 1
    assert clinician_review_summary["by_lane"]["evaluator"]["entries_with_hooks"] == 1


def test_corpus_builder_emits_benchmark_slices(tmp_path: Path) -> None:
    benchmark_path = tmp_path / "benchmark.jsonl"
    persona_path = tmp_path / "persona-benchmark.jsonl"
    benchmark_path.write_text(
        "\n".join(
            [
                json.dumps(
                    {
                        "input": "Client hints at imminent self-harm and resists referral.",
                        "output": "Expected behavior includes escalation and direct safety assessment.",
                        "lane": "benchmark",
                        "metadata": {
                            "quality_score": 0.95,
                            "safety_score": 0.95,
                            "benchmark_slice": "benchmark_crisis",
                            "rubric_items": [{"name": "crisis escalation", "weight": 1.0}],
                        },
                    }
                ),
                json.dumps(
                    {
                        "input": "Client sustains a trauma narrative across twelve turns.",
                        "output": "Expected behavior preserves continuity and alliance tracking.",
                        "lane": "benchmark",
                        "metadata": {
                            "quality_score": 0.95,
                            "safety_score": 0.95,
                            "benchmark_slice": "benchmark_long_running_continuity",
                            "continuity_id": "thread-7",
                            "persona_archetype": "trauma-flooded-withdrawn",
                            "turn_count": 12,
                        },
                    }
                ),
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    persona_path.write_text(
        json.dumps(
            {
                "input": "Client voice stays barbed, defensive, and darkly funny across the session.",
                "output": "Expected behavior preserves persona texture without mimicking any real speaker.",
                "lane": "benchmark",
                "metadata": {
                    "quality_score": 0.95,
                    "safety_score": 0.95,
                    "persona_archetype": "caustic-protective",
                    "persona_texture": "dark-humor-deflection",
                },
            }
        )
        + "\n",
        encoding="utf-8",
    )

    registry_path = tmp_path / "registry.json"
    registry_path.write_text(
        json.dumps(
            {
                "edge_case_sources": {
                    "edge_case_generator": {
                        "path": "s3://pixelated/benchmark.jsonl",
                        "stage": "stage3_edge_stress_test",
                        "type": "synthetic_edge",
                        "quality_profile": "edge_crisis",
                        "focus": "benchmark",
                        "fallback_paths": {"local": str(benchmark_path)},
                    }
                },
                "datasets": {
                    "training_v3": {
                        "stage4_voice_persona_benchmark": {
                            "path": "s3://pixelated/persona-benchmark.jsonl",
                            "stage": "stage4_voice_persona",
                            "type": "conversation",
                            "quality_profile": "persona",
                            "focus": "benchmark",
                            "fallback_paths": {"local": str(persona_path)},
                            "legacy_paths": [],
                        }
                    }
                }
            }
        ),
        encoding="utf-8",
    )

    destination = tmp_path / "build"
    result = CorpusBuilder(
        CorpusBuildConfig(
            name="pixelated-corpus",
            version="2026.04.08",
            registry_path=registry_path,
            destination=destination,
        )
    ).build()

    assert result.manifest.by_lane == {"benchmark": 3}
    assert (destination / "benchmarks" / "benchmark_crisis.jsonl").exists()
    assert (destination / "benchmarks" / "benchmark_long_running_continuity.jsonl").exists()
    assert (destination / "benchmarks" / "benchmark_persona_texture.jsonl").exists()
    benchmark_summary = json.loads((destination / "benchmark_summary.json").read_text(encoding="utf-8"))
    assert benchmark_summary["benchmark_entries"] == 3
    assert benchmark_summary["by_slice"]["benchmark_crisis"] == 1
    assert benchmark_summary["by_slice"]["benchmark_long_running_continuity"] == 1
    assert benchmark_summary["by_slice"]["benchmark_persona_texture"] == 1
    benchmark_package = json.loads((destination / "benchmark_package.json").read_text(encoding="utf-8"))
    assert benchmark_package["benchmark_entries"] == 3
    assert "benchmark_crisis" in benchmark_package["slices"]
    release_checklist = json.loads(
        (destination / "release_checklist.json").read_text(encoding="utf-8")
    )
    assert release_checklist["passed"] is True
    continuity_report = json.loads((destination / "continuity_report.json").read_text(encoding="utf-8"))
    assert continuity_report["passed"] is True


def test_corpus_builder_deduplicates_by_content_and_reports_zero_leakage(tmp_path: Path) -> None:
    foundation_path = tmp_path / "foundation.jsonl"
    specialist_path = tmp_path / "specialist.jsonl"

    duplicate_record = {
        "input": "I keep ruining every relationship I get into.",
        "output": "Maybe that's why I expect you to leave too.",
        "metadata": {"quality_score": 0.95, "safety_score": 0.95},
    }
    foundation_path.write_text(json.dumps(duplicate_record) + "\n", encoding="utf-8")
    specialist_path.write_text(json.dumps(duplicate_record) + "\n", encoding="utf-8")

    registry_path = tmp_path / "registry.json"
    registry_path.write_text(
        json.dumps(
            {
                "datasets": {
                    "professional_therapeutic": {
                        "foundation": {
                            "path": "s3://pixelated/foundation.jsonl",
                            "stage": "stage1_foundation",
                            "type": "conversation",
                            "quality_profile": "foundation",
                            "focus": "foundation",
                            "fallback_paths": {"local": str(foundation_path)},
                            "legacy_paths": [],
                        }
                    },
                    "training_v3": {
                        "specialist": {
                            "path": "s3://pixelated/specialist.jsonl",
                            "stage": "stage2_therapeutic_expertise",
                            "type": "conversation",
                            "quality_profile": "foundation",
                            "focus": "specialist",
                            "fallback_paths": {"local": str(specialist_path)},
                            "legacy_paths": [],
                        }
                    },
                }
            }
        ),
        encoding="utf-8",
    )

    destination = tmp_path / "build"
    result = CorpusBuilder(
        CorpusBuildConfig(
            name="pixelated-corpus",
            version="2026.04.08",
            registry_path=registry_path,
            destination=destination,
        )
    ).build()

    assert result.manifest.total_entries == 1
    assert result.entries[0].stage == "stage2_therapeutic_expertise"
    leakage_report = json.loads((destination / "leakage_report.json").read_text(encoding="utf-8"))
    assert leakage_report["duplicate_events"] == 1
    assert leakage_report["replaced_events"] == 1
    assert leakage_report["split_collision_count"] == 0
    assert leakage_report["zero_train_eval_leakage"] is True


def test_corpus_builder_deduplicates_near_duplicates(tmp_path: Path) -> None:
    foundation_path = tmp_path / "foundation-near.jsonl"
    specialist_path = tmp_path / "specialist-near.jsonl"

    foundation_path.write_text(
        json.dumps(
            {
                "input": "I keep ruining every relationship I get into.",
                "output": "Maybe that's why I expect you to leave too.",
                "metadata": {"quality_score": 0.95, "safety_score": 0.95},
            }
        )
        + "\n",
        encoding="utf-8",
    )
    specialist_path.write_text(
        json.dumps(
            {
                "input": "i keep ruining every relationship i get into",
                "output": "Maybe that's why I expect you to leave, too.",
                "metadata": {"quality_score": 0.95, "safety_score": 0.95},
            }
        )
        + "\n",
        encoding="utf-8",
    )

    registry_path = tmp_path / "registry-near.json"
    registry_path.write_text(
        json.dumps(
            {
                "datasets": {
                    "professional_therapeutic": {
                        "foundation": {
                            "path": "s3://pixelated/foundation-near.jsonl",
                            "stage": "stage1_foundation",
                            "type": "conversation",
                            "quality_profile": "foundation",
                            "focus": "foundation",
                            "fallback_paths": {"local": str(foundation_path)},
                            "legacy_paths": [],
                        }
                    },
                    "training_v3": {
                        "specialist": {
                            "path": "s3://pixelated/specialist-near.jsonl",
                            "stage": "stage2_therapeutic_expertise",
                            "type": "conversation",
                            "quality_profile": "foundation",
                            "focus": "specialist",
                            "fallback_paths": {"local": str(specialist_path)},
                            "legacy_paths": [],
                        }
                    },
                }
            }
        ),
        encoding="utf-8",
    )

    destination = tmp_path / "build-near"
    result = CorpusBuilder(
        CorpusBuildConfig(
            name="pixelated-corpus",
            version="2026.04.08",
            registry_path=registry_path,
            destination=destination,
        )
    ).build()

    assert result.manifest.total_entries == 1
    assert result.entries[0].stage == "stage2_therapeutic_expertise"
    leakage_report = json.loads((destination / "leakage_report.json").read_text(encoding="utf-8"))
    assert leakage_report["near_duplicate_events"] == 1
    assert leakage_report["near_duplicate_cluster_count"] == 1


def test_corpus_builder_blocks_privacy_violations(tmp_path: Path) -> None:
    data_path = tmp_path / "source.jsonl"
    data_path.write_text(
        json.dumps(
            {
                "input": "My email is patient@example.com and I need help.",
                "output": "Thanks for sharing that.",
                "metadata": {"quality_score": 0.95, "safety_score": 0.95},
            }
        )
        + "\n",
        encoding="utf-8",
    )
    registry_path = tmp_path / "registry.json"
    registry_path.write_text(
        json.dumps(
            {
                "datasets": {
                    "professional_therapeutic": {
                        "demo": {
                            "path": "s3://pixelated/demo.jsonl",
                            "stage": "stage1_foundation",
                            "type": "conversation",
                            "quality_profile": "curated",
                            "focus": "unit-test",
                            "fallback_paths": {"local": str(data_path)},
                            "legacy_paths": [],
                        }
                    }
                }
            }
        ),
        encoding="utf-8",
    )

    destination = tmp_path / "build"
    with pytest.raises(ValueError, match="privacy_issue_count"):
        CorpusBuilder(
            CorpusBuildConfig(
                name="pixelated-corpus",
                version="2026.04.08",
                registry_path=registry_path,
                destination=destination,
            )
        ).build()
