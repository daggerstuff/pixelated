from __future__ import annotations

from pathlib import Path

from ai.training_corpus.experiments import (
    ExperimentVariant,
    VariantOutcome,
    _extract_human_assistant_pair,
    _lane_scoped_messages,
    _pick_winner,
    _tagged_messages,
)


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
