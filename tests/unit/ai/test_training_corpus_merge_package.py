from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import pytest

from ai.training_corpus.merge_package import (
    MergePackageConfig,
    build_merged_corpus_package,
)


@dataclass(frozen=True)
class EntryOptions:
    benchmark_slice: str | None = None
    with_rubric: bool = False
    with_clinician_review: bool = False


def _write_component_package(
    root: Path,
    *,
    source_rows: list[dict[str, object]],
    entry_rows: list[dict[str, object]],
) -> None:
    root.mkdir(parents=True, exist_ok=True)
    by_lane: dict[str, int] = {}
    by_corpus: dict[str, int] = {}
    by_stage: dict[str, int] = {}
    by_family: dict[str, int] = {}
    for entry in entry_rows:
        lane = str(entry["lane"])
        source_id = str(entry["source_id"])
        stage = str(entry["stage"])
        family = str(entry["source_family"])
        by_lane[lane] = by_lane.get(lane, 0) + 1
        by_corpus[source_id] = by_corpus.get(source_id, 0) + 1
        by_stage[stage] = by_stage.get(stage, 0) + 1
        by_family[family] = by_family.get(family, 0) + 1

    (root / "source_inventory.json").write_text(
        json.dumps({"sources": source_rows}),
        encoding="utf-8",
    )
    (root / "corpus.jsonl").write_text(
        "\n".join(json.dumps(entry) for entry in entry_rows) + "\n",
        encoding="utf-8",
    )
    (root / "manifest.json").write_text(
        json.dumps(
            {
                "name": root.name,
                "version": "v1",
                "total_entries": len(entry_rows),
                "by_lane": by_lane,
                "by_corpus": by_corpus,
                "by_stage": by_stage,
                "by_family": by_family,
            }
        ),
        encoding="utf-8",
    )
    (root / "reproducibility_report.json").write_text(
        json.dumps({"verified": True}),
        encoding="utf-8",
    )


def _source_row(source_id: str, locator: Path, default_lane: str) -> dict[str, object]:
    group, _dataset = source_id.split(".", 1)
    return {
        "source_id": source_id,
        "registry_group": group,
        "family": "professional_therapeutic",
        "stage": "stage1_foundation",
        "source_type": "conversation",
        "quality_profile": "test",
        "focus": "merge",
        "inventory_decision": "keep",
        "rights_status": "review_required",
        "license_status": "review_required",
        "provenance_status": "registry_and_fallback",
        "benchmark_role": "holdout_eligible",
        "allowed_lanes": ["simulation", "evaluator", "benchmark", "policy"],
        "default_lane": default_lane,
        "locator": str(locator),
        "locator_exists": True,
        "locator_is_file": True,
        "notes": [],
        "provenance": {
            "registry_path": f"s3://pixel-data/tests/{source_id}.jsonl",
            "fallback_paths": {"local": str(locator)},
            "legacy_paths": [],
        },
    }


def _entry_row(
    entry_id: str,
    source_id: str,
    lane: str,
    options: EntryOptions | None = None,
) -> dict[str, object]:
    resolved_options = options or EntryOptions()
    attributes: dict[str, object] = {
        "content_hash": f"content-{entry_id}",
        "near_duplicate_hash": f"near-{entry_id}",
        "quality_score": 0.9,
        "safety_score": 0.9,
    }
    if resolved_options.benchmark_slice is not None:
        attributes["benchmark_slice"] = resolved_options.benchmark_slice
    if resolved_options.with_rubric:
        attributes["rubric_items"] = [
            {"criterion_id": f"criterion-{entry_id}", "name": "Coverage", "weight": 1, "required": True}
        ]
    if resolved_options.with_clinician_review:
        attributes["clinician_review"] = {
            "required": True,
            "status": "planned",
            "reviewer_role": "clinician",
            "reviewer_count": 0,
            "calibration_subset": True,
            "notes": "",
        }
    return {
        "entry_id": entry_id,
        "source_id": source_id,
        "stage": "stage1_foundation",
        "lane": lane,
        "prompt": f"prompt {entry_id}",
        "response": f"response {entry_id}",
        "split": "train",
        "source_family": "professional_therapeutic",
        "source_type": "conversation",
        "attributes": attributes,
    }


def test_build_merged_corpus_package_produces_union(tmp_path: Path) -> None:
    base_root = tmp_path / "wave1"
    overlay_root = tmp_path / "delta"
    base_locator = tmp_path / "wave1-source.jsonl"
    overlay_locator = tmp_path / "delta-source.jsonl"
    base_locator.write_text("{}\n", encoding="utf-8")
    overlay_locator.write_text("{}\n", encoding="utf-8")
    _write_component_package(
        base_root,
        source_rows=[_source_row("professional_therapeutic.wave1_seed_simulation", base_locator, "simulation")],
        entry_rows=[
            _entry_row("wave1-a", "professional_therapeutic.wave1_seed_simulation", "simulation"),
            _entry_row(
                "wave1-b",
                "professional_therapeutic.wave1_seed_simulation",
                "benchmark",
                EntryOptions(
                    benchmark_slice="benchmark_core",
                    with_rubric=True,
                    with_clinician_review=True,
                ),
            ),
        ],
    )
    _write_component_package(
        overlay_root,
        source_rows=[_source_row("edge_case_sources.edge_policy", overlay_locator, "policy")],
        entry_rows=[
            _entry_row("delta-a", "edge_case_sources.edge_policy", "policy"),
            _entry_row(
                "delta-b",
                "edge_case_sources.edge_policy",
                "evaluator",
                EntryOptions(with_rubric=True, with_clinician_review=True),
            ),
        ],
    )

    result = build_merged_corpus_package(
        tmp_path / "merged",
        config=MergePackageConfig(
            base_root=base_root,
            overlay_root=overlay_root,
            name="merged-package",
            version="merged-v1",
        ),
    )

    assert result.manifest.total_entries == 4
    assert result.manifest.by_lane == {"simulation": 1, "benchmark": 1, "policy": 1, "evaluator": 1}
    assert result.artifacts["reproducibility_report"].exists()
    release_checklist = json.loads((tmp_path / "merged" / "release_checklist.json").read_text(encoding="utf-8"))
    assert release_checklist["passed"] is True


def test_build_merged_corpus_package_rejects_entry_overlap(tmp_path: Path) -> None:
    base_root = tmp_path / "wave1"
    overlay_root = tmp_path / "delta"
    locator = tmp_path / "shared-source.jsonl"
    locator.write_text("{}\n", encoding="utf-8")
    overlapping_entry = _entry_row("same-entry", "professional_therapeutic.shared", "simulation")
    _write_component_package(
        base_root,
        source_rows=[_source_row("professional_therapeutic.shared", locator, "simulation")],
        entry_rows=[overlapping_entry],
    )
    _write_component_package(
        overlay_root,
        source_rows=[_source_row("professional_therapeutic.shared_overlay", locator, "simulation")],
        entry_rows=[overlapping_entry],
    )

    with pytest.raises(ValueError, match="overlapping entries"):
        build_merged_corpus_package(
            tmp_path / "merged",
            config=MergePackageConfig(base_root=base_root, overlay_root=overlay_root),
        )
