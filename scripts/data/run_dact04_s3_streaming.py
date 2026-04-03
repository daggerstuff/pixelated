#!/usr/bin/env python3
"""
DACT-04: S3 Streaming Normalization & Dedup

Uses the StreamingS3Processor to normalize and dedup datasets in-place on S3
without downloading the full 10GB+ corpus locally.
"""

import hashlib
import json
import logging
import os
import sys
from pathlib import Path
from datetime import datetime, timezone

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("dact04-s3")


def load_registry() -> dict:
    """Load dataset registry."""
    with open("ai/data/dataset_registry.json") as f:
        return json.load(f)


def get_datasets_by_status(registry: dict, status: str) -> list:
    """Get list of datasets with given status."""
    result = []
    for category, datasets in registry.get("datasets", {}).items():
        if isinstance(datasets, dict):
            for name, config in datasets.items():
                if config.get("status") == status:
                    result.append({"category": category, "name": name, "config": config})
    return result


def extract_s3_parts(s3_path: str) -> tuple[str, str]:
    """Extract bucket and key from s3:// URL."""
    if not s3_path.startswith("s3://"):
        raise ValueError(f"Invalid S3 path: {s3_path}")

    remainder = s3_path[5:]
    parts = remainder.split("/", 1)
    if len(parts) != 2:
        raise ValueError(f"Invalid S3 path format: {s3_path}")

    return parts[0], parts[1]


def main():
    registry = load_registry()

    pending_sync = get_datasets_by_status(registry, "pending_sync")
    active = get_datasets_by_status(registry, "active")

    logger.info("DACT-04 S3 Streaming Processor")
    logger.info(f"Pending sync: {len(pending_sync)} datasets")
    logger.info(f"Active (already processed): {len(active)} datasets")

    s3_configured = os.environ.get("AWS_ACCESS_KEY_ID") is not None
    if not s3_configured:
        logger.warning("S3 credentials not configured. Checking for local fallback...")
        return process_local_datasets()

    logger.info("S3 credentials found - proceeding with streaming processing")

    processed = 0
    failed = 0

    for ds in pending_sync[:10]:
        try:
            logger.info(f"Processing {ds['category']}/{ds['name']}...")
            config = ds["config"]
            s3_path = config.get("path", "")

            if not s3_path.startswith("s3://"):
                logger.warning(f"Invalid S3 path: {s3_path}")
                failed += 1
                continue

            bucket, key = extract_s3_parts(s3_path)

            from ai.training.scripts.streaming_s3_processor import StreamingS3Processor

            processor = StreamingS3Processor(source_bucket=bucket)
            result = processor.process_and_upload(key)

            if result.get("success"):
                logger.info(
                    f" ✓ {ds['name']}: {result.get('records_processed', 0)} records processed"
                )
                processed += 1
            else:
                logger.error(f" ✗ {ds['name']}: {result.get('error', 'Unknown error')}")
                failed += 1

        except Exception as e:
            logger.error(f" ✗ {ds['name']}: {e}")
            failed += 1

    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "processed": processed,
        "failed": failed,
        "total_pending": len(pending_sync),
    }

    report_path = Path("ai/data/normalized/dact04_s3_report.json")
    report_path.parent.mkdir(exist_ok=True)
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)

    logger.info(f"\nDACT-04 S3 Summary:")
    logger.info(f" Processed: {processed}")
    logger.info(f" Failed: {failed}")
    logger.info(f" Report: {report_path}")

    return 0


def process_local_datasets() -> int:
    """
    Fallback: process local datasets through the PIX-32 normalization pipeline.

    This is invoked when S3 credentials are not configured, providing a complete
    local processing path identical to run_dact04_normalization.py.
    """
    from ai.core.pipelines.processing.normalization_pipeline import (
        DedupStrategy,
        NormalizationPipeline,
    )

    logger.info("Using local fallback mode - processing through PIX-32 pipeline")

    local_datasets = [
        "ai/data/acquired_datasets/cot_reasoning.json",
        "ai/data/acquired_datasets/mental_health_counseling.json",
    ]

    existing_files = []
    for ds_path in local_datasets:
        path = Path(ds_path)
        if path.exists():
            existing_files.append(path)
            logger.info(f"Found local dataset: {ds_path}")
        else:
            logger.warning(f"Missing local dataset: {ds_path}")

    if not existing_files:
        logger.error("No local datasets found to process")
        return 1

    output_dir = Path("ai/data/normalized/")
    output_dir.mkdir(parents=True, exist_ok=True)

    processed_count = 0
    failed_count = 0
    total_final_records = 0

    for input_file in existing_files:
        try:
            logger.info(f"Processing {input_file.name}...")

            temp_jsonl = output_dir / f"{input_file.stem}.jsonl"
            count = convert_json_to_jsonl(input_file, temp_jsonl, input_file.stem)
            logger.info(f"  Converted {count} records to JSONL")

            pipeline = NormalizationPipeline(
                dedup_strategy=DedupStrategy.STAGE_AWARE,
                enforce_phi_scan=False,
                enforce_license=False,
            )

            result = pipeline.run(
                input_paths=[str(temp_jsonl)],
                output_path=output_dir / f"{input_file.stem}_normalized.jsonl",
                reject_path=output_dir / f"{input_file.stem}_rejected.jsonl",
            )

            total_final_records += result.final_records
            processed_count += 1

            logger.info(f"  Validated: {result.validated_records}")
            logger.info(f"  Rejected: {result.rejected_records}")
            logger.info(f"  Duplicates removed: {result.duplicates_removed}")
            logger.info(f"  Final records: {result.final_records}")

        except Exception as e:
            logger.error(f"  Failed to process {input_file.name}: {e}")
            failed_count += 1

    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "mode": "local_fallback",
        "processed_files": processed_count,
        "failed_files": failed_count,
        "total_final_records": total_final_records,
        "dedup_strategy": "stage_aware",
    }

    report_path = output_dir / "dact04_local_report.json"
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)

    logger.info(f"\nDACT-04 Local Summary:")
    logger.info(f"  Processed: {processed_count} files")
    logger.info(f"  Failed: {failed_count} files")
    logger.info(f"  Total final records: {total_final_records}")
    logger.info(f"  Report: {report_path}")

    return 0 if failed_count == 0 else 1


def convert_json_to_jsonl(input_path: Path, output_path: Path, source_name: str) -> int:
    """Convert JSON array to canonical JSONL format."""
    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        data = [data]

    count = 0
    with open(output_path, "w", encoding="utf-8") as f:
        for record in data:
            canonical = transform_record_to_canonical(record, source_name)
            f.write(json.dumps(canonical, ensure_ascii=False) + "\n")
            count += 1

    return count


def transform_record_to_canonical(record: dict, source_name: str) -> dict:
    """
    Transform source format to PIX-30 canonical schema.

    Source format: { "conversation": [{"role": "...", "content": "..."}], "metadata": {...} }
    Canonical: { "id", "source", "messages": [{"role": "...", "content": "..."}], "metadata": {...} }
    """
    messages = []
    if "conversation" in record:
        for msg in record["conversation"]:
            messages.append({"role": msg.get("role", "unknown"), "content": msg.get("content", "")})
    elif "messages" in record:
        for msg in record["messages"]:
            content_val = msg.get("content") or msg.get("text", "")
            messages.append({"role": msg.get("role", "unknown"), "content": content_val})

    metadata = record.get("metadata", {})
    if not isinstance(metadata, dict):
        metadata = {}

    canonical = {
        "id": record.get("id")
        or metadata.get("original_id")
        or hashlib.sha256(json.dumps(record, sort_keys=True).encode()).hexdigest(),
        "source": record.get("source") or metadata.get("source") or source_name,
        "messages": messages,
        "metadata": {
            **metadata,
            "topic_tags": metadata.get("topic_tags", []),
            "therapeutic_modality": metadata.get("therapeutic_modality", "unknown"),
            "quality_score": metadata.get("quality_score", 0.5),
        },
        "phi_scan_passed": False,
        "phi_scan_date": None,
        "pull_date": datetime.now(timezone.utc).isoformat(),
    }

    if "license" in record:
        canonical["license"] = record["license"]

    canonical["content_type"] = record.get("content_type", "conversation")

    return canonical


if __name__ == "__main__":
    raise SystemExit(main())
