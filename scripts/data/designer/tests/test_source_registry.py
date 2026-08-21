"""Tests for source registry schemas, policy enforcement, and lineage transforms."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from scripts.data.designer.schemas import (
    ChatMessage,
    ConstructionRecord,
    ContributionMode,
    HumanReviewStatus,
    JudgeResult,
    SourceAnalysisRecord,
    TargetProduct,
    UsePolicy,
    to_chatml,
    to_dpo,
    to_retrieval,
)
from scripts.data.designer.source_registry import SourceRegistry, collapse_aliases
from scripts.data.designer.validators import PolicyViolationError, assert_release_eligible, validate_source_record

FIXTURE_PATH = Path("ai/data/curated/construction/source_registry/representative_sources.jsonl")


def load_fixture_records() -> list[SourceAnalysisRecord]:
    return [SourceAnalysisRecord.model_validate_json(line) for line in FIXTURE_PATH.read_text().splitlines() if line]


def test_fixture_registry_resolves_canonical_names_and_aliases() -> None:
    registry = SourceRegistry.load_jsonl(FIXTURE_PATH)

    assert registry.resolve("AnnoMI").source_id == "SRC-047"
    assert registry.resolve("motivational_interviewing").source_id == "SRC-047"
    assert registry.resolve("AIPsy Bench").source_id == "SRC-068"


def test_alias_collapse_merges_same_source_and_rejects_cross_source_collisions() -> None:
    direct, evaluation = load_fixture_records()
    duplicate = direct.model_copy(update={"aliases": [*direct.aliases, "MI dialogue"]})

    collapsed = collapse_aliases([direct, duplicate])

    assert len(collapsed) == 1
    assert "MI dialogue" in collapsed[0].aliases

    collision = evaluation.model_copy(update={"aliases": [direct.canonical_name]})
    with pytest.raises(ValueError, match="shared by"):
        collapse_aliases([direct, collision])


def test_eval_source_cannot_emit_direct_or_verbatim_training_text() -> None:
    _, evaluation = load_fixture_records()
    selected = evaluation.selected_information[0].model_copy(
        update={"contribution_mode": ContributionMode.DIRECT_SEED, "source_text": "benchmark answer"}
    )
    invalid = evaluation.model_copy(update={"selected_information": [selected]})

    with pytest.raises(PolicyViolationError, match="blocks direct seed use"):
        validate_source_record(invalid)


def test_restricted_source_remains_represented_without_direct_use() -> None:
    _, evaluation = load_fixture_records()

    validate_source_record(evaluation)
    assert evaluation.selected_information[0].contribution_mode is ContributionMode.EVALUATION_STRUCTURE
    assert evaluation.selected_information[0].source_text is None


def test_release_requires_complete_inspection_and_human_approval() -> None:
    direct, _ = load_fixture_records()
    assert_release_eligible(direct)

    incomplete = direct.model_copy(
        update={"inspection_coverage": direct.inspection_coverage.model_copy(update={"complete": False})}
    )
    with pytest.raises(PolicyViolationError, match="inspection is incomplete"):
        assert_release_eligible(incomplete)


def construction_record(product: TargetProduct) -> ConstructionRecord:
    common = {
        "product": product,
        "source_id": "SRC-047",
        "analysis_id": "src047.mi-reflection",
        "source_unit_refs": ["annomi:dialogue-001:turn-04"],
        "use_policies": [UsePolicy.DIRECT],
        "contribution_mode": ContributionMode.DIRECT_SEED,
        "construction_spec_version": "1.0.0",
        "model_alias": "nvidia-text",
        "prompt_version": "2026-08-20.1",
        "judge_results": {"clinical_safety": JudgeResult(score=5, reason="No unsafe advice")},
        "human_review_status": HumanReviewStatus.APPROVED,
        "lineage_hashes": ["sha256:source", "sha256:prompt"],
    }
    if product is TargetProduct.DPO_PREFERENCES:
        return ConstructionRecord(**common, prompt="Reflect the concern", chosen="Reflection", rejected="Advice")
    if product is TargetProduct.KNOWLEDGE_TASKS:
        return ConstructionRecord(**common, query="What is reflection?", answer="A concise definition", citations=["annomi:guide"])
    return ConstructionRecord(
        **common,
        messages=[ChatMessage(role="user", content="I feel stuck"), ChatMessage(role="assistant", content="Part of you wants change")],
    )


@pytest.mark.parametrize(
    ("product", "transform", "payload_key"),
    [
        (TargetProduct.THERAPEUTIC_SFT, to_chatml, "messages"),
        (TargetProduct.DPO_PREFERENCES, to_dpo, "chosen"),
        (TargetProduct.KNOWLEDGE_TASKS, to_retrieval, "citations"),
    ],
)
def test_output_transforms_preserve_lineage(product, transform, payload_key) -> None:
    output = transform(construction_record(product))

    assert payload_key in output
    assert output["source_id"] == "SRC-047"
    assert output["analysis_id"] == "src047.mi-reflection"
    assert output["judge_scores"] == {"clinical_safety": 5}
    assert output["lineage_hashes"] == ["sha256:source", "sha256:prompt"]


def test_registry_round_trip(tmp_path: Path) -> None:
    registry = SourceRegistry(load_fixture_records())
    output = tmp_path / "registry.jsonl"

    registry.write_jsonl(output)
    round_tripped = SourceRegistry.load_jsonl(output)

    assert [record.model_dump(mode="json") for record in round_tripped.records] == [
        record.model_dump(mode="json") for record in registry.records
    ]
    for line in output.read_text().splitlines():
        assert isinstance(json.loads(line), dict)
