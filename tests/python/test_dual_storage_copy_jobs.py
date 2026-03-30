from __future__ import annotations

import importlib.util
import json
from pathlib import Path


SCRIPT_PATH = Path(
    "/home/vivi/pixelated/.agent/internal/scripts/generate_dual_storage_copy_jobs.py"
)


def _load_module():
    spec = importlib.util.spec_from_file_location("dual_storage_copy_jobs", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec is not None
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_build_copy_plan_creates_local_and_s3_jobs_with_blocked_local_state() -> None:
    module = _load_module()
    storage_plan = {
        "volume_root": "/mnt/garbage/pixelated-dual-storage",
        "future_bucket": "future-phx-bucket",
        "materialization": {"status": "dry_run", "error": None},
        "entries": [
            {
                "name": "final_dataset",
                "tier": "tier_a",
                "decision": "include",
                "source_path": "drive:backups/S3-Complete/final_dataset",
                "destination_prefix": "curated_sources/final_dataset/",
                "local_path": "/mnt/garbage/pixelated-dual-storage/curated_sources/final_dataset",
                "future_s3_uri": "s3://future-phx-bucket/curated_sources/final_dataset/",
                "materialize": True,
            },
            {
                "name": "raw_datasets_salvage",
                "tier": "tier_b",
                "decision": "include_as_salvage",
                "source_path": "drive:backups/S3-Complete/archive/gdrive/raw/datasets",
                "destination_prefix": "salvage/raw_datasets/",
                "local_path": "/mnt/garbage/pixelated-dual-storage/salvage/raw_datasets",
                "future_s3_uri": "s3://future-phx-bucket/salvage/raw_datasets/",
                "materialize": True,
            },
        ],
    }

    copy_plan = module.build_copy_plan(
        storage_plan=storage_plan,
        target="both",
        include_salvage=False,
        s3_bucket="pixel-data-phx",
        s3_region="phx-1",
        s3_endpoint="https://object.example.com",
        s3_host_bucket_template=None,
        s3cmd_config_path="/tmp/pixel-data.s3cfg",
    )

    assert copy_plan["summary"]["job_count"] == 1
    assert copy_plan["summary"]["local_job_count"] == 1
    assert copy_plan["summary"]["s3_job_count"] == 1
    assert copy_plan["summary"]["blocked_local_job_count"] == 1
    job = copy_plan["jobs"][0]
    assert job["name"] == "final_dataset"
    assert job["local_job"]["blocked"] is True
    assert job["local_job"]["blocked_reason"] == "storage_plan_materialization_dry_run"
    assert job["local_job"]["command"] == [
        "rclone",
        "copy",
        "drive:backups/S3-Complete/final_dataset",
        "/mnt/garbage/pixelated-dual-storage/curated_sources/final_dataset",
        "--fast-list",
        "--create-empty-src-dirs",
        "--transfers",
        "8",
        "--checkers",
        "16",
    ]
    assert job["s3_job"]["command"] == [
        "s3cmd",
        "sync",
        "--recursive",
        "--config",
        "/tmp/pixel-data.s3cfg",
        "--host",
        "object.example.com",
        "--host-bucket",
        "%(bucket)s.object.example.com",
        "/mnt/garbage/pixelated-dual-storage/curated_sources/final_dataset/",
        "s3://pixel-data-phx/curated_sources/final_dataset/",
    ]
    assert job["s3_job"]["source"] == (
        "/mnt/garbage/pixelated-dual-storage/curated_sources/final_dataset/"
    )
    assert job["s3_job"]["depends_on"] == "local_stage"


def test_build_copy_plan_can_emit_local_only_jobs_and_include_salvage() -> None:
    module = _load_module()
    storage_plan = {
        "volume_root": "/mnt/garbage/pixelated-dual-storage",
        "future_bucket": "future-phx-bucket",
        "materialization": {"status": "materialized", "error": None},
        "entries": [
            {
                "name": "final_dataset",
                "tier": "tier_a",
                "decision": "include",
                "source_path": "drive:backups/S3-Complete/final_dataset",
                "destination_prefix": "curated_sources/final_dataset/",
                "local_path": "/mnt/garbage/pixelated-dual-storage/curated_sources/final_dataset",
                "future_s3_uri": "s3://future-phx-bucket/curated_sources/final_dataset/",
                "materialize": True,
            },
            {
                "name": "raw_datasets_salvage",
                "tier": "tier_b",
                "decision": "include_as_salvage",
                "source_path": "drive:backups/S3-Complete/archive/gdrive/raw/datasets",
                "destination_prefix": "salvage/raw_datasets/",
                "local_path": "/mnt/garbage/pixelated-dual-storage/salvage/raw_datasets",
                "future_s3_uri": "s3://future-phx-bucket/salvage/raw_datasets/",
                "materialize": True,
            },
        ],
    }

    copy_plan = module.build_copy_plan(
        storage_plan=storage_plan,
        target="local",
        include_salvage=True,
        s3_bucket="ignored-bucket",
        s3_region="ignored-region",
        s3_endpoint="https://ignored-endpoint.example.com",
        s3_host_bucket_template=None,
        s3cmd_config_path="/tmp/ignored.s3cfg",
    )

    assert copy_plan["summary"]["job_count"] == 2
    assert copy_plan["summary"]["local_job_count"] == 2
    assert copy_plan["summary"]["s3_job_count"] == 0
    assert copy_plan["summary"]["blocked_local_job_count"] == 0
    assert [job["name"] for job in copy_plan["jobs"]] == [
        "final_dataset",
        "raw_datasets_salvage",
    ]
    assert all(job["local_job"]["blocked"] is False for job in copy_plan["jobs"])
    assert all(job["s3_job"] is None for job in copy_plan["jobs"])


def test_write_copy_plan_persists_json(tmp_path: Path) -> None:
    module = _load_module()
    output_path = tmp_path / "dual-storage-copy-jobs.json"
    copy_plan = {"jobs": [], "summary": {"job_count": 0}}

    module.write_copy_plan(copy_plan, output_path)

    assert json.loads(output_path.read_text(encoding="utf-8")) == copy_plan


def test_build_copy_plan_supports_explicit_host_bucket_template_override() -> None:
    module = _load_module()
    storage_plan = {
        "volume_root": "/mnt/garbage/pixelated-dual-storage",
        "future_bucket": "future-phx-bucket",
        "materialization": {"status": "materialized", "error": None},
        "entries": [
            {
                "name": "final_dataset",
                "tier": "tier_a",
                "decision": "include",
                "source_path": "drive:backups/S3-Complete/final_dataset",
                "destination_prefix": "curated_sources/final_dataset/",
                "local_path": "/mnt/garbage/pixelated-dual-storage/curated_sources/final_dataset",
                "future_s3_uri": "s3://future-phx-bucket/curated_sources/final_dataset/",
                "materialize": True,
            }
        ],
    }

    copy_plan = module.build_copy_plan(
        storage_plan=storage_plan,
        target="s3",
        include_salvage=False,
        s3_bucket="pixel-data",
        s3_region="nyc3",
        s3_endpoint="nyc3.digitaloceanspaces.com",
        s3_host_bucket_template="%(bucket)s.digitaloceanspaces.com",
        s3cmd_config_path="/tmp/pixel-data.s3cfg",
    )

    assert copy_plan["s3_target"]["host_bucket_template"] == (
        "%(bucket)s.digitaloceanspaces.com"
    )
    assert copy_plan["s3_target"]["config_path"] == "/tmp/pixel-data.s3cfg"
    assert copy_plan["jobs"][0]["s3_job"]["command"] == [
        "s3cmd",
        "sync",
        "--recursive",
        "--config",
        "/tmp/pixel-data.s3cfg",
        "--host",
        "nyc3.digitaloceanspaces.com",
        "--host-bucket",
        "%(bucket)s.digitaloceanspaces.com",
        "/mnt/garbage/pixelated-dual-storage/curated_sources/final_dataset/",
        "s3://pixel-data/curated_sources/final_dataset/",
    ]
