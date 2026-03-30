from __future__ import annotations

import importlib.util
import json
from pathlib import Path


import os

SCRIPT_PATH = (
    Path(os.environ.get("PIXELATED_ROOT", str(Path(__file__).parent.parent.parent)))
    / ".agent"
    / "internal"
    / "scripts"
    / "bootstrap_dual_storage_layout.py"
)


def _load_module():
    spec = importlib.util.spec_from_file_location("dual_storage_bootstrap", SCRIPT_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Failed to load module from {SCRIPT_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_build_storage_plan_maps_manifest_entries_to_local_and_future_s3_paths(
    tmp_path: Path,
) -> None:
    module = _load_module()
    manifest = {
        "canonical_layout_roots": {
            "tier_a": "s3://<bucket>/curated_sources/",
            "tier_b": "s3://<bucket>/salvage/",
            "manifests": "s3://<bucket>/manifests/",
            "shards": "s3://<bucket>/shards/",
            "holdout": "s3://<bucket>/holdout/",
        },
        "entries": [
            {
                "name": "final_dataset",
                "source_path": "drive:backups/S3-Complete/final_dataset",
                "destination_prefix": "curated_sources/final_dataset/",
                "tier": "tier_a",
                "decision": "include",
                "count": 10,
                "bytes": 1024,
                "size_gib": 0.001,
            },
            {
                "name": "raw_datasets_salvage",
                "source_path": "drive:backups/S3-Complete/archive/gdrive/raw/datasets",
                "destination_prefix": "salvage/raw_datasets/",
                "tier": "tier_b",
                "decision": "include_as_salvage",
                "count": 2,
                "bytes": 2048,
                "size_gib": 0.002,
            },
            {
                "name": "processed_ready",
                "source_path": "drive:backups/S3-Complete/processed_ready",
                "destination_prefix": "deferred/processed_ready/",
                "tier": "tier_c",
                "decision": "exclude",
                "count": 1,
                "bytes": 4096,
                "size_gib": 0.004,
            },
        ],
        "summary": {"included_size_gib": 0.003, "remaining_headroom_gib": 249.997},
    }

    plan = module.build_storage_plan(
        manifest=manifest,
        volume_root=tmp_path / "pixelated-workspace",
        future_bucket="pixel-data-phx",
    )

    assert plan["volume_root"] == str(tmp_path / "pixelated-workspace")
    assert plan["future_bucket"] == "pixel-data-phx"
    assert plan["materialization"]["status"] == "pending"
    assert plan["entries"][0]["local_path"].endswith(
        "pixelated-workspace/curated_sources/final_dataset"
    )
    assert (
        plan["entries"][0]["future_s3_uri"] == "s3://pixel-data-phx/curated_sources/final_dataset/"
    )
    assert plan["entries"][1]["local_path"].endswith("pixelated-workspace/salvage/raw_datasets")
    assert plan["entries"][1]["future_s3_uri"] == "s3://pixel-data-phx/salvage/raw_datasets/"
    assert plan["entries"][2]["materialize"] is False


def test_materialize_storage_plan_creates_roots_and_included_entry_paths(
    tmp_path: Path,
) -> None:
    module = _load_module()
    plan = {
        "volume_root": str(tmp_path / "pixelated-workspace"),
        "materialization": {"status": "pending"},
        "local_roots": {
            "curated_sources": str(tmp_path / "pixelated-workspace/curated_sources"),
            "salvage": str(tmp_path / "pixelated-workspace/salvage"),
            "manifests": str(tmp_path / "pixelated-workspace/manifests"),
            "shards": str(tmp_path / "pixelated-workspace/shards"),
            "holdout": str(tmp_path / "pixelated-workspace/holdout"),
            "scratch": str(tmp_path / "pixelated-workspace/scratch"),
            "logs": str(tmp_path / "pixelated-workspace/logs"),
        },
        "entries": [
            {
                "name": "final_dataset",
                "local_path": str(tmp_path / "pixelated-workspace/curated_sources/final_dataset"),
                "materialize": True,
            },
            {
                "name": "processed_ready",
                "local_path": str(tmp_path / "pixelated-workspace/deferred/processed_ready"),
                "materialize": False,
            },
        ],
    }

    created = module.materialize_storage_plan(plan)

    assert (tmp_path / "pixelated-workspace/curated_sources").is_dir()
    assert (tmp_path / "pixelated-workspace/scratch").is_dir()
    assert (tmp_path / "pixelated-workspace/curated_sources/final_dataset").is_dir()
    assert not (tmp_path / "pixelated-workspace/deferred/processed_ready").exists()
    assert str(tmp_path / "pixelated-workspace/curated_sources/final_dataset") in created


def test_write_storage_plan_persists_json(tmp_path: Path) -> None:
    module = _load_module()
    output_path = tmp_path / "dual-storage-plan.json"
    plan = {"volume_root": "/mnt/garbage/pixelated-s3", "entries": []}

    module.write_storage_plan(plan, output_path)

    assert json.loads(output_path.read_text(encoding="utf-8")) == plan


def test_bootstrap_storage_plan_writes_plan_before_materialization(tmp_path: Path) -> None:
    module = _load_module()
    manifest_path = tmp_path / "manifest.json"
    output_path = tmp_path / "dual-storage-plan.json"
    manifest_path.write_text(
        json.dumps(
            {
                "canonical_layout_roots": {},
                "entries": [],
                "summary": {},
                "tier_totals": {},
            }
        ),
        encoding="utf-8",
    )

    original_materialize = module.materialize_storage_plan

    def fail_materialize(_plan):
        raise PermissionError("no write access")

    module.materialize_storage_plan = fail_materialize
    try:
        try:
            module.bootstrap_storage_plan(
                manifest_path=manifest_path,
                volume_root=tmp_path / "volume",
                future_bucket="future-phx-bucket",
                output_path=output_path,
                materialize=True,
            )
        except PermissionError:
            pass
    finally:
        module.materialize_storage_plan = original_materialize

    assert output_path.exists()
    written = json.loads(output_path.read_text(encoding="utf-8"))
    assert written["materialization"]["status"] == "failed"
    assert written["materialization"]["error"] == "no write access"
