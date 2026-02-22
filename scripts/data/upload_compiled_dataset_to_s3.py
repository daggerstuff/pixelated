#!/usr/bin/env python3
"""
Upload compiled_dataset/ directory to S3.
Uploads all training shards to the configured S3 bucket.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "ai"))

from utils.s3_dataset_loader import S3DatasetLoader


def main():
    """Upload compiled_dataset/ to S3."""
    print("=" * 80)
    print("📤 UPLOADING COMPILED DATASET TO S3")
    print("=" * 80)

    # Initialize S3 loader
    loader = S3DatasetLoader()

    # Local dataset path
    local_dataset_dir = Path(__file__).parent.parent.parent / "compiled_dataset"

    if not local_dataset_dir.exists():
        print(f"❌ Dataset directory not found: {local_dataset_dir}")
        sys.exit(1)

    # Get all JSONL files
    files = sorted(local_dataset_dir.glob("*.jsonl"))
    metadata_file = local_dataset_dir / "METADATA.json"

    if not files:
        print(f"❌ No JSONL files found in {local_dataset_dir}")
        sys.exit(1)

    print(f"📁 Found {len(files)} shard files")
    print(f"📊 Total size: {sum(f.stat().st_size for f in files) / (1024**3):.2f} GB")
    print(f"🎯 Target bucket: {loader.bucket}")
    print("")

    # Upload each file
    uploaded = 0
    failed = 0

    for idx, file_path in enumerate(files, 1):
        s3_key = f"compiled_dataset/{file_path.name}"
        size_mb = file_path.stat().st_size / (1024**2)

        print(f"[{idx}/{len(files)}] Uploading: {file_path.name} ({size_mb:.1f} MB)")

        try:
            loader.upload_file(file_path, s3_key)
            print(f"   ✅ Uploaded to s3://{loader.bucket}/{s3_key}")
            uploaded += 1
        except Exception as e:
            print(f"   ❌ Failed: {e}")
            failed += 1

    # Upload metadata file
    if metadata_file.exists():
        print(f"\n[{len(files) + 1}/{len(files) + 1}] Uploading: METADATA.json")
        try:
            loader.upload_file(metadata_file, "compiled_dataset/METADATA.json")
            print(f"   ✅ Uploaded to s3://{loader.bucket}/compiled_dataset/METADATA.json")
        except Exception as e:
            print(f"   ❌ Failed: {e}")

    print("\n" + "=" * 80)
    print("✅ UPLOAD COMPLETE!")
    print(f"   Files uploaded: {uploaded}")
    print(f"   Files failed: {failed}")
    print(f"   S3 location: s3://{loader.bucket}/compiled_dataset/")
    print("=" * 80)

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
