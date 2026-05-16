from __future__ import annotations

import json
from pathlib import Path

from ai.training_corpus import (
    DEFAULT_WAVE2_SEED_PACK_PATH,
    build_seed_corpus,
    build_seed_output_paths,
    build_seed_registry_path,
    ensure_seed_pack_registry_materialized,
    ensure_seed_pack_sources_materialized,
)


def test_build_seed_output_paths_uses_prefix() -> None:
    output_paths = build_seed_output_paths(Path("/tmp/seed-assets"), "wave5_seed")

    assert output_paths["simulation"] == Path("/tmp/seed-assets/wave5_seed_simulation.jsonl")
    assert output_paths["evaluator"] == Path("/tmp/seed-assets/wave5_seed_evaluator.jsonl")
    assert output_paths["benchmark"] == Path("/tmp/seed-assets/wave5_seed_benchmark.jsonl")


def test_ensure_seed_pack_registry_materialized_writes_generic_assets(tmp_path: Path) -> None:
    assets_dir = tmp_path / "assets"
    registry_path = ensure_seed_pack_registry_materialized(
        seed_pack_path=DEFAULT_WAVE2_SEED_PACK_PATH,
        output_dir=assets_dir,
        prefix="wave5_seed",
    )

    assert registry_path == build_seed_registry_path(assets_dir, "wave5_seed")
    payload = json.loads(registry_path.read_text(encoding="utf-8"))
    assert payload["datasets"]["professional_therapeutic"]["wave5_seed_simulation"]["focus"] == "simulation"
    assert payload["supplementary"]["wave5_seed_evaluator"]["focus"] == "evaluator"
    assert payload["edge_case_sources"]["wave5_seed_benchmark"]["focus"] == "benchmark"

    materialized = ensure_seed_pack_sources_materialized(
        seed_pack_path=DEFAULT_WAVE2_SEED_PACK_PATH,
        output_dir=assets_dir,
        prefix="wave5_seed",
    )
    assert all(path.exists() for path in materialized.values())


def test_build_seed_corpus_builds_generic_package(tmp_path: Path) -> None:
    output_dir = tmp_path / "wave5-build"
    assets_dir = tmp_path / "wave5-inputs"

    result = build_seed_corpus(
        output_dir,
        pack_id="wave5",
        seed_pack_path=DEFAULT_WAVE2_SEED_PACK_PATH,
        output_dir_for_assets=assets_dir,
    )

    assert result.manifest.total_entries == 28
    assert result.manifest.by_lane["simulation"] == 9
    assert result.manifest.by_lane["evaluator"] == 9
    assert result.manifest.by_lane["benchmark"] == 10
    assert (assets_dir / "wave5_seed_manifest.json").exists()
    assert (assets_dir / "wave5_seed_registry.json").exists()
