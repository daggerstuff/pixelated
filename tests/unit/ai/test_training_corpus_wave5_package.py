from __future__ import annotations

import json

from ai.training_corpus.expansion_authoring import load_authoring_ledger
from ai.training_corpus.wave5_package import (
    Wave5PackageBuildConfig,
    build_wave5_authored_corpus,
    build_wave5_authored_records,
    ensure_wave5_authored_registry_materialized,
)


def test_build_wave5_authored_records_counts() -> None:
    ledger = load_authoring_ledger()

    records = build_wave5_authored_records(ledger)

    assert len(records["simulation"]) == 610
    assert len(records["evaluator"]) == 12
    assert len(records["benchmark"]) == 214
    assert records["simulation"][0]["lane"] == "simulation"
    assert records["evaluator"][0]["metadata"]["clinician_review"]["status"] == "planned"
    assert records["benchmark"][0]["lane"] == "benchmark"
    assert any(record["metadata"].get("rubric_items") for record in records["benchmark"])


def test_ensure_wave5_authored_registry_materialized(tmp_path) -> None:
    registry_path = ensure_wave5_authored_registry_materialized(
        output_dir=tmp_path,
        registry_path=tmp_path / "wave5_registry.json",
        manifest_path=tmp_path / "wave5_manifest.json",
    )

    payload = json.loads(registry_path.read_text())

    simulation = payload["datasets"]["professional_therapeutic"]["wave5_authored_seed_simulation"]
    evaluator = payload["supplementary"]["wave5_authored_seed_evaluator"]
    benchmark = payload["edge_case_sources"]["wave5_authored_seed_benchmark"]

    assert simulation["fallback_paths"]["local"].endswith("wave5_authored_seed_simulation.jsonl")
    assert evaluator["fallback_paths"]["local"].endswith("wave5_authored_seed_evaluator.jsonl")
    assert benchmark["fallback_paths"]["local"].endswith("wave5_authored_seed_benchmark.jsonl")


def test_build_wave5_authored_corpus(tmp_path) -> None:
    result = build_wave5_authored_corpus(
        tmp_path / "package",
        Wave5PackageBuildConfig(
            assets_dir=tmp_path / "assets",
            verify_reproducibility=False,
        ),
    )

    assert result.manifest.total_entries == 714
    assert result.manifest.by_lane["simulation"] == 562
    assert result.manifest.by_lane["evaluator"] == 12
    assert result.manifest.by_lane["benchmark"] == 140

    release_checklist = json.loads(result.artifacts["release_checklist"].read_text())
    checks = {check["name"]: check["passed"] for check in release_checklist["checks"]}

    assert checks["benchmark_package_present"] is True
    assert checks["rubric_coverage_present"] is True
    assert checks["clinician_review_hooks_present"] is True
