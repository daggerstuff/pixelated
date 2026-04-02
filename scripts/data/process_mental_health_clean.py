#!/usr/bin/env python3
"""Stream and copy mental_health_clean.jsonl from S3 (already in correct format)."""

import json
import sys
import traceback
from pathlib import Path

sys.path.insert(0, "/home/vivi/pixelated/ai")

from utils.s3_dataset_loader import S3DatasetLoader


def main():

    loader = S3DatasetLoader()
    s3_path = "s3://pixel-data/ai/data/compress/processed/mental_health_clean.jsonl"

    # Create output directory
    output_dir = Path("ai/training/ready_packages/datasets/cache/s3_direct")
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / "mental_health_clean.jsonl"

    # Stream and copy (it's already in correct format)
    try:
        count = 0
        with open(output_file, "w") as f:
            for record in loader.stream_jsonl(s3_path):
                # Verify it has messages format
                if "messages" in record:
                    f.write(json.dumps(record) + "\n")
                    count += 1
                    if count % 10000 == 0:
                        pass

    except Exception:
        traceback.print_exc()


if __name__ == "__main__":
    main()
