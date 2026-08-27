"""DVC pipeline builder that generates dvc.yaml stages for construction releases."""

from __future__ import annotations

import yaml

from scripts.data.designer.release_manifest import ReleaseManifest


def generate_dvc_yaml(
    *,
    manifest: ReleaseManifest,
    construction_records_path: str,
    output_data_dir: str,
    script_path: str = "scripts/data/designer/scripts/dry_run_construction_release.py",
) -> str:
    """Generate dvc.yaml content for a construction release pipeline.

    Produces a dvc.yaml with:
    - A construction stage that reads source registry and produces construction records
    - A split stage that splits records into train/val/test
    - A manifest stage that builds the release manifest
    - A lineage audit stage that validates the lineage chain
    """
    release_dir = f"ai/data/curated/construction/releases/{manifest.release_id}"
    pipeline: dict[str, object] = {
        "stages": [
            {
                "name": "construct",
                "cmd": f"uv run python {script_path} --construct --product {manifest.product.value} --output {construction_records_path}",
                "deps": ["ai/data/curated/construction/source_registry/representative_sources.jsonl"],
                "outs": [construction_records_path],
            },
            {
                "name": "split",
                "cmd": f"uv run python {script_path} --split --input {construction_records_path} --output-dir {output_data_dir}",
                "deps": [construction_records_path],
                "outs": [
                    f"{output_data_dir}/train.jsonl",
                    f"{output_data_dir}/val.jsonl",
                    f"{output_data_dir}/test.jsonl",
                ],
            },
            {
                "name": "manifest",
                "cmd": f"uv run python {script_path} --manifest --release-id {manifest.release_id} --product {manifest.product.value}",
                "deps": [construction_records_path, f"{output_data_dir}/train.jsonl"],
                "outs": [f"{release_dir}/manifest.json"],
            },
            {
                "name": "audit",
                "cmd": f"uv run python {script_path} --audit --release-id {manifest.release_id}",
                "deps": [
                    f"{release_dir}/manifest.json",
                    "ai/data/curated/construction/source_registry/representative_sources.jsonl",
                ],
            },
        ]
    }
    return yaml.dump(pipeline, default_flow_style=False, sort_keys=False)


def generate_params_yaml(
    *,
    manifest: ReleaseManifest,
    construction_records_path: str,
    output_data_dir: str,
) -> str:
    """Generate params.yaml content for a construction release pipeline."""
    params: dict[str, object] = {
        "construction": {
            "release_id": manifest.release_id,
            "release_version": manifest.release_version,
            "product": manifest.product.value,
            "source_registry_version": manifest.source_registry_version,
            "construction_spec_version": manifest.construction_spec_version,
            "prompt_version": manifest.prompt_version,
            "model_alias": manifest.model_alias,
            "builder_config_hash": manifest.builder_config_hash,
            "construction_records_path": construction_records_path,
            "output_data_dir": output_data_dir,
            "split_ratios": {"train": 0.8, "val": 0.1, "test": 0.1},
        },
    }
    return yaml.dump(params, default_flow_style=False, sort_keys=False)
