#!/usr/bin/env python3
"""
Upload compiled_dataset/ directory to S3.
Uploads all training shards to the configured S3 bucket.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "ai"))

import contextlib

from utils.s3_dataset_loader import S3DatasetLoader


def main():
    """Upload compiled_dataset/ to S3."""

    # Initialize S3 loader
    loader = S3DatasetLoader()

    # Local dataset path
    local_dataset_dir = Path(__file__).parent.parent.parent / "compiled_dataset"

    if not local_dataset_dir.exists():
        sys.exit(1)

    # Get all JSONL files
    files = sorted(local_dataset_dir.glob("*.jsonl"))
    metadata_file = local_dataset_dir / "METADATA.json"

    if not files:
        sys.exit(1)


    # Upload each file
    uploaded = 0
    failed = 0

    for _idx, file_path in enumerate(files, 1):
        s3_key = f"compiled_dataset/{file_path.name}"
        file_path.stat().st_size / (1024**2)


        try:
            loader.upload_file(file_path, s3_key)
            uploaded += 1
        except Exception:
            failed += 1

    # Upload metadata file
    if metadata_file.exists():
        with contextlib.suppress(Exception):
            loader.upload_file(metadata_file, "compiled_dataset/METADATA.json")


    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
