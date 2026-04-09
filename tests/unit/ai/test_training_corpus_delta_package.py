from __future__ import annotations

import json
from pathlib import Path

from ai.training_corpus.delta_package import (
    ReleaseCandidateDeltaPackageConfig,
    build_release_candidate_delta_corpus,
)
from ai.training_corpus.experiments import (
    PreparedSource,
    release_candidate_delta_source_limits_from_report,
)


def _write_report(path: Path, *, wave1_variant_id: str = "I1.3") -> dict[str, object]:
    report = {
        "families": {
            "A": {"winner": {"variant_id": "A1.1"}},
            "I": {"winner": {"variant_id": wave1_variant_id}},
        }
    }
    path.write_text(f"{json.dumps(report, indent=2)}\n", encoding="utf-8")
    return report


def _direct_record(prompt: str, response: str, *, lane: str | None = None) -> dict[str, object]:
    record = {
        "input": prompt,
        "output": response,
        "metadata": {"quality_score": 0.9, "safety_score": 0.9, "source_origin": "sourced"},
    }
    if lane is not None:
        record["lane"] = lane
    return record


def test_release_candidate_delta_source_limits_strip_wave1_overlay() -> None:
    report = {"families": {"I": {"winner": {"variant_id": "I1.3"}}}}

    source_limits = release_candidate_delta_source_limits_from_report(report)

    assert "wave1_seed_simulation" not in source_limits
    assert "wave1_seed_evaluator" not in source_limits
    assert "wave1_seed_benchmark" not in source_limits
    assert source_limits["foundation_amod"] == 80
    assert source_limits["evaluator_psychology"] == 60


def test_build_release_candidate_delta_corpus_produces_package(tmp_path: Path) -> None:
    report_path = tmp_path / "experiment_report.json"
    _write_report(report_path)
    catalog = {
        "foundation_amod": PreparedSource(
            name="foundation_amod",
            group="professional_therapeutic",
            stage="stage1_foundation",
            source_type="conversation",
            records=(
                _direct_record("Client case one", "Therapist response one"),
                _direct_record("Client case two", "Therapist response two"),
            ),
        ),
        "edge_policy": PreparedSource(
            name="edge_policy",
            group="edge_case_sources",
            stage="stage3_edge_stress_test",
            source_type="dpo_pairs",
            records=(
                _direct_record(
                    "Policy calibration prompt",
                    "Policy-calibrated response",
                    lane="policy",
                ),
            ),
        ),
    }

    result = build_release_candidate_delta_corpus(
        tmp_path / "delta-build",
        config=ReleaseCandidateDeltaPackageConfig(
            experiment_report_path=report_path,
            source_limits={"foundation_amod": 2, "edge_policy": 1},
            catalog=catalog,
            artifact_root=tmp_path / "delta-inputs",
            version="test-delta",
        ),
    )

    assert result.manifest.total_entries == 3
    assert result.manifest.by_lane == {"simulation": 2, "policy": 1}
    assert result.artifacts["reproducibility_report"].exists()
    manifest = json.loads((tmp_path / "delta-build" / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["by_corpus"] == {
        "professional_therapeutic.foundation_amod": 2,
        "edge_case_sources.edge_policy": 1,
    }
    registry = json.loads((tmp_path / "delta-inputs" / "registry.json").read_text(encoding="utf-8"))
    assert "wave1_seed_simulation" not in json.dumps(registry)
