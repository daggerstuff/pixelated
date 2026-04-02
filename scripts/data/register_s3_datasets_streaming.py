#!/usr/bin/env python3
"""Register S3 datasets in the registry for streaming (no local caching)."""

import sys

sys.path.insert(0, "/home/vivi/pixelated/ai")

import json
from pathlib import Path


def main():
    registry_file = Path("ai/data/dataset_registry.json")

    # Load existing registry
    with open(registry_file) as f:
        registry = json.load(f)

    # Ensure therapeutic category exists
    if "therapeutic" not in registry.get("datasets", {}):
        registry.setdefault("datasets", {})["therapeutic"] = {}

    # Add S3 datasets for streaming (using actual S3 paths from our inventory)
    s3_datasets = {
        # Phase 1: Critical datasets (ai/training_ready)
        "s3_ultimate_final_dataset": {
            "path": "s3://pixel-data/ai/training_ready/ULTIMATE_FINAL_DATASET.jsonl",
            "priority": "critical",
            "format": "messages",
            "streaming": True,
            "estimated_records": 8000000
        },
        # Phase 2: Archive high-priority
        "s3_mental_health_clean": {
            "path": "s3://pixel-data/ai/data/compress/processed/mental_health_clean.jsonl",
            "priority": "high",
            "format": "messages",
            "streaming": True,
            "estimated_records": 65000
        },
        # Processed tier datasets
        "s3_tier1_curated": {
            "path": "s3://pixel-data/processed/pixelated_tier1_priority_curated_dark_humor.jsonl",
            "priority": "critical",
            "format": "messages",
            "streaming": True,
            "estimated_records": 1700000
        },
        "s3_tier2_professional": {
            "path": "s3://pixel-data/processed/pixelated_tier2_professional_therapeutic_dark_humor.jsonl",
            "priority": "high",
            "format": "messages",
            "streaming": True,
            "estimated_records": 150000
        },
        "s3_tier3_clinical": {
            "path": "s3://pixel-data/processed/pixelated_tier3_clinical_cot_dark_humor.jsonl",
            "priority": "high",
            "format": "messages",
            "streaming": True,
            "estimated_records": 50000
        }
    }

    # Add to registry
    registry["datasets"]["therapeutic"].update(s3_datasets)

    # Save updated registry
    with open(registry_file, "w") as f:
        json.dump(registry, f, indent=2)

    for _name, _info in s3_datasets.items():
        pass

if __name__ == "__main__":
    main()
