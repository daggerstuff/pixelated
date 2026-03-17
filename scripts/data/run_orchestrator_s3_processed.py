#!/usr/bin/env python3
"""
Run the orchestrator on S3 processed/ tier datasets.

This script processes the curated S3 datasets and generates train/val/test splits.
"""
import json
import logging
import os
import sys
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# Set up environment
_ovh_access = os.getenv("OVH_S3_ACCESS_KEY")
_ovh_secret = os.getenv("OVH_S3_SECRET_KEY")
if not _ovh_access or not _ovh_secret:
    raise OSError(
        "OVH_S3_ACCESS_KEY and OVH_S3_SECRET_KEY must be set in the environment. "
        "Export them from your .env file before running this script."
    )
os.environ.setdefault("AWS_ACCESS_KEY_ID", _ovh_access)
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", _ovh_secret)
os.environ.setdefault("OVH_S3_ENDPOINT", "https://s3.us-east-va.io.cloud.ovh.us")
os.environ.setdefault("OVH_S3_BUCKET", "pixel-data")

# Add ai/ to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "ai"))

from pipelines.orchestrator.unified_preprocessing_pipeline import (  # noqa: E402
    DataSource,
    ProcessingConfig,
    UnifiedPreprocessingPipeline,
)


def main() -> int:
    logger.info("🚀 Starting Orchestrator with S3 Processed Tier Datasets")
    logger.info("=" * 80)

    # Create pipeline with production config
    config = ProcessingConfig(
        target_quality_threshold=0.7,  # Lower threshold for diverse data
        deduplication_enabled=True,
        validation_enabled=True,
        safety_filtering_enabled=True,
        psychology_integration_enabled=False,  # Disable for speed
        youtube_rag_integration_enabled=False,  # Disable for speed
        scrub_pii_enabled=True,
        normalize_text_enabled=True,
        convert_chatml_enabled=True,
    )

    pipeline = UnifiedPreprocessingPipeline(config)

    # Manually register S3 processed/ tier datasets (start with smaller ones for testing)
    processed_datasets = [
        # Start with tier2 (994KB) for quick validation
        (
            "pixelated_tier2_professional_therapeutic",
            "s3://pixel-data/processed/pixelated_tier2_professional_therapeutic_dark_humor.jsonl",
            994000,
            "stage2_therapeutic_expertise",
        ),
        # Then tier3 (332KB)
        (
            "pixelated_tier3_clinical_cot",
            "s3://pixel-data/processed/pixelated_tier3_clinical_cot_dark_humor.jsonl",
            332000,
            "stage2_therapeutic_expertise",
        ),
        # Finally tier1 (1.2GB) - will take longer
        (
            "pixelated_tier1_priority_curated",
            "s3://pixel-data/processed/pixelated_tier1_priority_curated_dark_humor.jsonl",
            1200000000,
            "stage1_foundation",
        ),
    ]

    for name, path, size, stage in processed_datasets:
        source = DataSource(
            name=name,
            path=path,
            format="jsonl",
            size_bytes=size,
            source_type="curated_training",
            stage=stage,
            metadata={"s3_streaming": True},
        )
        pipeline.register_data_source(source)

    logger.info("\n✅ Registered %d S3 datasets:", len(pipeline.data_sources))
    for ds in pipeline.data_sources:
        size_mb = ds.size_bytes / (1024 * 1024)
        logger.info("  - %s (%.1f MB, %s)", ds.name, size_mb, ds.stage)

    logger.info("\n" + "=" * 80)
    logger.info("📥 Starting S3 streaming and processing...")
    logger.info("=" * 80 + "\n")

    # Process all datasets
    all_records: list = []
    for source in pipeline.data_sources:
        logger.info("\n🔄 Processing: %s", source.name)
        if pipeline.validate_data_source(source):
            records = pipeline.process_dataset(source)
            all_records.extend(records)
            logger.info("✅ Extracted %s records from %s", f"{len(records):,}", source.name)
        else:
            logger.warning("❌ Validation failed for %s", source.name)

    logger.info("\n📊 Total records before deduplication: %s", f"{len(all_records):,}")

    # Apply deduplication
    logger.info("\n🔄 Deduplicating records...")
    deduplicated = pipeline.deduplicate_records(all_records)
    logger.info("✅ Records after deduplication: %s", f"{len(deduplicated):,}")

    # Apply safety filtering
    logger.info("\n🔄 Applying safety filtering...")
    safe_records = pipeline.apply_safety_filtering(deduplicated)
    logger.info("✅ Records after safety filtering: %s", f"{len(safe_records):,}")

    # Save processed records
    output_dir = Path("ai/training/ready_packages/datasets/cache/orchestrator_output")
    output_dir.mkdir(parents=True, exist_ok=True)

    output_file = output_dir / "processed_s3_tier_datasets.jsonl"
    logger.info("\n💾 Saving to: %s", output_file)

    with open(output_file, "w") as f:
        for record in safe_records:
            f.write(json.dumps(record) + "\n")

    logger.info("✅ Saved %s records", f"{len(safe_records):,}")

    # Generate summary
    logger.info("\n" + "=" * 80)
    logger.info("📈 PROCESSING SUMMARY")
    logger.info("=" * 80)
    logger.info("Total input records:     %s", f"{len(all_records):,}")
    logger.info(
        "After deduplication:     %s (%.1f%%)",
        f"{len(deduplicated):,}",
        len(deduplicated) / len(all_records) * 100,
    )
    logger.info(
        "After safety filtering:  %s (%.1f%%)",
        f"{len(safe_records):,}",
        len(safe_records) / len(all_records) * 100,
    )
    logger.info("Output file:             %s", output_file)
    logger.info("Output size:             %.1f MB", output_file.stat().st_size / (1024 * 1024))
    logger.info("=" * 80)

    return 0


if __name__ == "__main__":
    sys.exit(main())
