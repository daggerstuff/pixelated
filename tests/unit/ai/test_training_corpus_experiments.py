from __future__ import annotations

from pathlib import Path

from ai.training_corpus.builder import CorpusBuildResult
from ai.training_corpus.experiments import (
    ExperimentVariant,
    VariantOutcome,
    _experiment_variants,
    _extract_human_assistant_pair,
    _lane_scoped_messages,
    _pick_winner,
    _release_candidate_source_limits,
    _score_variant,
    _tagged_messages,
    _variant_metrics,
)
from ai.training_corpus.model import CorpusEntry, CorpusManifest


def test_extract_human_assistant_pair_parses_tagged_text() -> None:
    prompt, response = _extract_human_assistant_pair(
        "<HUMAN>: I feel trapped.\n<ASSISTANT>: Let's slow this down together."
    )

    assert prompt == "I feel trapped."
    assert response == "Let's slow this down together."


def test_tagged_messages_extracts_user_and_assistant_turns() -> None:
    messages = _tagged_messages(
        "<|user|>Tell me what you noticed.</s><|assistant|>I noticed the shift in your breathing.</s>"
    )

    assert messages == [
        {"role": "user", "content": "Tell me what you noticed."},
        {"role": "assistant", "content": "I noticed the shift in your breathing."},
    ]


def test_pick_winner_prefers_higher_score_then_variant_id() -> None:
    lower = VariantOutcome(
        variant=ExperimentVariant("A", "A1.2", "lower", {}),
        score=71.0,
        metrics={},
        artifact_dir=Path("/tmp/a12"),
    )
    higher = VariantOutcome(
        variant=ExperimentVariant("A", "A1.1", "higher", {}),
        score=72.0,
        metrics={},
        artifact_dir=Path("/tmp/a11"),
    )

    assert _pick_winner([lower, higher]) == higher


def test_lane_scoped_messages_make_edge_variants_distinct() -> None:
    base_messages = [
        {"role": "user", "content": "Describe the clinical scene."},
        {"role": "assistant", "content": "Offer a grounded therapeutic response."},
    ]

    simulation = _lane_scoped_messages(base_messages, "simulation")
    policy = _lane_scoped_messages(base_messages, "policy")
    benchmark = _lane_scoped_messages(base_messages, "benchmark")

    assert simulation != policy
    assert simulation != benchmark
    assert policy != benchmark
    assert simulation[0]["content"].startswith("Clinical simulation case:")
    assert policy[1]["content"].startswith("Preferred policy-compliant response:")


def test_experiment_variants_include_wave1_synthesis_family() -> None:
    variants = [variant for variant in _experiment_variants() if variant.family == "I"]

    assert [variant.variant_id for variant in variants] == ["I1.1", "I1.2", "I1.3"]
    assert "wave1_seed_simulation" not in variants[0].source_limits
    assert variants[1].source_limits["wave1_seed_simulation"] == 6
    assert "wave1_seed_evaluator" not in variants[1].source_limits
    assert variants[2].source_limits["wave1_seed_simulation"] == 6
    assert variants[2].source_limits["wave1_seed_evaluator"] == 6
    assert variants[2].source_limits["wave1_seed_benchmark"] == 10


def test_variant_metrics_count_wave1_sources() -> None:
    entries = (
        CorpusEntry(
            entry_id="sim-1",
            source_id="professional_therapeutic.wave1_seed_simulation",
            stage="stage1_foundation",
            lane="simulation",
            prompt="p",
            response="r",
            split="train",
            source_family="professional_therapeutic",
            source_type="conversation",
            attributes={"source_origin": "generated_internal", "persona_archetype": "seeded"},
        ),
        CorpusEntry(
            entry_id="eval-1",
            source_id="supplementary.wave1_seed_evaluator",
            stage="stage2_therapeutic_expertise",
            lane="evaluator",
            prompt="p",
            response="r",
            split="train",
            source_family="supplementary",
            source_type="knowledge_base",
            attributes={"clinician_review": {"required": True}},
        ),
        CorpusEntry(
            entry_id="bench-1",
            source_id="edge_case_sources.wave1_seed_benchmark",
            stage="stage3_edge_stress_test",
            lane="benchmark",
            prompt="p",
            response="r",
            split="holdout",
            source_family="edge_case_nightmare",
            source_type="synthetic_edge",
            attributes={"benchmark_slice": "benchmark_persona_texture"},
        ),
    )
    manifest = CorpusManifest(
        name="pixelated",
        version="test",
        destination=Path("/tmp/wave1-metrics"),
        total_entries=3,
        by_split={"train": 2, "holdout": 1},
        by_stage={
            "stage1_foundation": 1,
            "stage2_therapeutic_expertise": 1,
            "stage3_edge_stress_test": 1,
        },
        by_corpus={
            "professional_therapeutic.wave1_seed_simulation": 1,
            "supplementary.wave1_seed_evaluator": 1,
            "edge_case_sources.wave1_seed_benchmark": 1,
        },
        by_lane={"simulation": 1, "evaluator": 1, "benchmark": 1},
        by_family={
            "professional_therapeutic": 1,
            "supplementary": 1,
            "edge_case_nightmare": 1,
        },
    )
    result = CorpusBuildResult(sources=(), entries=entries, manifest=manifest, artifacts={})

    metrics = _variant_metrics(result)

    assert metrics["wave1_seed_simulation_entries"] == 1
    assert metrics["wave1_seed_evaluator_entries"] == 1
    assert metrics["wave1_seed_benchmark_entries"] == 1
    assert metrics["wave1_seed_total_entries"] == 3
    assert metrics["benchmark_persona_entries"] == 1
    assert metrics["clinician_hook_entries"] == 1


def test_wave1_family_scoring_prefers_full_overlay() -> None:
    variants = {variant.variant_id: variant for variant in _experiment_variants() if variant.family == "I"}
    baseline_metrics = {
        "wave1_seed_simulation_entries": 0,
        "wave1_seed_evaluator_entries": 0,
        "wave1_seed_benchmark_entries": 0,
        "wave1_seed_share": 0.0,
        "clinician_hook_entries": 16,
        "benchmark_persona_entries": 4,
    }
    simulation_overlay = {
        **baseline_metrics,
        "wave1_seed_simulation_entries": 6,
        "wave1_seed_share": 6 / 412,
    }
    full_overlay = {
        **baseline_metrics,
        "wave1_seed_simulation_entries": 6,
        "wave1_seed_evaluator_entries": 6,
        "wave1_seed_benchmark_entries": 10,
        "wave1_seed_share": 22 / 428,
        "benchmark_persona_entries": 10,
        "clinician_hook_entries": 22,
    }

    assert _score_variant(variants["I1.1"], baseline_metrics) < _score_variant(
        variants["I1.2"], simulation_overlay
    )
    assert _score_variant(variants["I1.2"], simulation_overlay) < _score_variant(
        variants["I1.3"], full_overlay
    )


def test_release_candidate_source_limits_follow_wave1_winner() -> None:
    placeholder = VariantOutcome(
        variant=ExperimentVariant("A", "A1.2", "winner", {}),
        score=72.0,
        metrics={},
        artifact_dir=Path("/tmp/a12"),
    )
    no_wave1 = VariantOutcome(
        variant=ExperimentVariant("I", "I1.1", "control", {}),
        score=58.0,
        metrics={},
        artifact_dir=Path("/tmp/i11"),
    )
    simulation_only = VariantOutcome(
        variant=ExperimentVariant("I", "I1.2", "simulation", {}),
        score=66.0,
        metrics={},
        artifact_dir=Path("/tmp/i12"),
    )
    full_stack = VariantOutcome(
        variant=ExperimentVariant("I", "I1.3", "full", {}),
        score=72.0,
        metrics={},
        artifact_dir=Path("/tmp/i13"),
    )

    assert "wave1_seed_simulation" not in _release_candidate_source_limits({"A": placeholder, "I": no_wave1})
    simulation_limits = _release_candidate_source_limits({"A": placeholder, "I": simulation_only})
    assert simulation_limits["wave1_seed_simulation"] == 6
    assert "wave1_seed_evaluator" not in simulation_limits
    full_limits = _release_candidate_source_limits({"A": placeholder, "I": full_stack})
    assert full_limits["wave1_seed_simulation"] == 6
    assert full_limits["wave1_seed_evaluator"] == 6
    assert full_limits["wave1_seed_benchmark"] == 10
