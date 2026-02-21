#!/usr/bin/env python3
"""
Process S3 data through full pipeline and write back to S3.
Includes: Quality filtering, EARS compliance, safety checks, deduplication.
"""

import sys

sys.path.insert(0, "/home/vivi/pixelated/ai")

import json
import tempfile
from pathlib import Path
from utils.s3_dataset_loader import S3DatasetLoader
from pipelines.orchestrator.unified_preprocessing_pipeline import (
    UnifiedPreprocessingPipeline,
    ProcessingConfig,
    DataSource,
)


def main():
    print("=" * 80)
    print("🚀 S3-to-S3 FULL PIPELINE PROCESSING")
    print("=" * 80)

    # Initialize
    loader = S3DatasetLoader()
    config = ProcessingConfig(
        target_quality_threshold=0.7,
        deduplication_enabled=True,
        validation_enabled=True,
        safety_filtering_enabled=True,
        scrub_pii_enabled=True,
        normalize_text_enabled=True,
    )
    pipeline = UnifiedPreprocessingPipeline(config)

    # Source dataset (size_bytes from our earlier S3 inventory: 1.2GB)
    source = DataSource(
        name="s3_tier1_curated",
        path="s3://pixel-data/processed/pixelated_tier1_priority_curated_dark_humor.jsonl",
        format="jsonl",
        size_bytes=1200000000,  # ~1.2GB
    )

    print(f"\n📥 Processing: {source.name}")
    print(f"   Path: {source.path}")
    print(f"   Config: quality_threshold={config.target_quality_threshold}")
    print()

    # Process through pipeline
    # This returns a list of fully processed records
    print("⚙️  Processing through full pipeline...")
    print("   This may take 20-30 minutes for ~1.7M records")
    print()

    processed_records = pipeline.process_dataset(source)

    total_processed = len(processed_records)
    print(f"\n✅ Pipeline processing complete!")
    print(f"   Total processed: {total_processed:,} records")
    print()

    # Write to S3 in batches
    print("📤 Uploading to S3...")
    output_s3_key = "processed_ready/tier1_curated_processed.jsonl"

    # Write to S3 directly from memory
    import io

    buffer = io.BytesIO()
    for record in processed_records:
        buffer.write((json.dumps(record) + "\n").encode("utf-8"))

    buffer.seek(0)
    # Upload to S3
    loader.s3_client.upload_fileobj(buffer, loader.bucket, output_s3_key)

    print(f"✅ Uploaded to s3://pixel-data/{output_s3_key}")
    print(f"   Records: {total_processed:,}")
    print()
    print("=" * 80)
    print("🎉 PROCESSING COMPLETE!")
    print("=" * 80)


if __name__ == "__main__":
    main()
