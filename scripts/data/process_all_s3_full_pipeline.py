#!/usr/bin/env python3
"""
Process ALL S3 datasets through full pipeline and write back to S3.
Processes all 589 JSONL files (103.97 GB, ~50-100M records).

MEMORY-SAFE VERSION: Streams records individually instead of loading
entire datasets into memory. Designed for 15GB RAM machines.
"""

import contextlib
import gc
import io
import json
import logging
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

sys.path.insert(0, "/home/vivi/pixelated/ai")
sys.path.insert(0, "/home/vivi/pixelated")

from pipelines.orchestrator.unified_preprocessing_pipeline import (
    DataSource,
    ProcessingConfig,
    UnifiedPreprocessingPipeline,
)
from utils.s3_dataset_loader import S3DatasetLoader

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)

# Constants for memory and batching
FLUSH_BATCH_SIZE = 5000
MAX_RSS_BYTES = 4 * 1024 * 1024 * 1024


@dataclass
class ProcessingEnv:
    """Core environment objects for processing."""

    pipeline: UnifiedPreprocessingPipeline
    loader: S3DatasetLoader
    bucket: str


@dataclass
class ProcessingStats:
    """Track processing metrics across files."""

    total_output: int = 0
    files_processed: int = 0
    files_skipped: int = 0


def get_rss_bytes() -> int:
    """Get current RSS in bytes from /proc/self/status."""
    with contextlib.suppress(OSError, ValueError):
        with open("/proc/self/status") as f:
            for line in f:
                if line.startswith("VmRSS:"):
                    return int(line.split()[1]) * 1024  # kB → bytes
    return 0


def flush_to_s3(s3_client, bucket: str, key: str, buffer: io.BytesIO) -> None:
    """Upload buffer contents to S3 as multipart or single put."""
    buffer.seek(0)
    s3_client.upload_fileobj(buffer, bucket, key)


def stream_process_dataset(
    pipeline: UnifiedPreprocessingPipeline,
    source: DataSource,
    loader: S3DatasetLoader,
):
    """
    Stream-process a single dataset, yielding one record at a time.
    Never holds the entire dataset in memory.
    """
    if not source.path.startswith("s3://"):
        with open(source.path) as f:
            for _, line in enumerate(f, 1):
                try:
                    record = json.loads(line.strip())
                except json.JSONDecodeError:
                    continue
                if processed := pipeline._process_single_record(record, source):
                    yield processed
        return

    for record in loader.stream_jsonl(source.path):
        processed = pipeline._process_single_record(record, source)
        if processed:
            yield processed


def discover_datasets(loader: S3DatasetLoader, bucket: str) -> list[dict[str, Any]]:
    """Discover all JSONL files in the S3 bucket."""
    logger.info("📋 Discovering all JSONL files in S3...")
    all_files = []

    s3_client = loader.s3_client
    paginator = s3_client.get_paginator("list_objects_v2")

    for page in paginator.paginate(Bucket=bucket):
        if "Contents" not in page:
            continue
        for obj in page["Contents"]:
            key = obj["Key"]
            if key.endswith(".jsonl"):
                all_files.append({"key": key, "size": obj["Size"]})

    logger.info(f"✅ Found {len(all_files)} JSONL files")
    return all_files


def check_memory_pressure() -> bool:
    """Check memory pressure and run GC if needed. Returns True if over budget."""
    rss = get_rss_bytes()
    if rss <= MAX_RSS_BYTES:
        return False

    logger.warning(
        f"   ⚠️ Memory pressure: {rss / (1024**3):.2f} GB RSS "
        f"(limit {MAX_RSS_BYTES / (1024**3):.1f} GB). "
        "Running GC..."
    )
    gc.collect()
    rss = get_rss_bytes()
    if rss <= MAX_RSS_BYTES:
        return False

    logger.error(f"   🛑 Still over budget after GC: {rss / (1024**3):.2f} GB.")
    return True


def process_single_file(
    idx: int,
    total_files: int,
    file_info: dict[str, Any],
    env: ProcessingEnv,
    stats: ProcessingStats,
) -> None:
    """Process a single file from S3 and write back processed results."""
    s3_key = file_info["key"]
    s3_path = f"s3://{env.bucket}/{s3_key}"
    size_mb = file_info["size"] / (1024**2)

    logger.info(f"[{idx}/{total_files}] Processing: {s3_key} ({size_mb:.1f} MB)")

    if check_memory_pressure():
        logger.error(f"Skipping {s3_key} due to persistent memory pressure")
        return

    try:
        output_key = f"processed_ready/{Path(s3_key).stem}_processed.jsonl"

        # Check if output already exists
        with contextlib.suppress(Exception):
            env.loader.s3_client.head_object(Bucket=env.bucket, Key=output_key)
            logger.info(f"   Skip: {s3_key} (already done)")
            stats.files_skipped += 1
            return

        # Create DataSource
        source = DataSource(
            name=Path(s3_key).stem,
            path=s3_path,
            format="jsonl",
            size_bytes=file_info["size"],
        )

        # Stream-process and write in batches
        buffer = io.BytesIO()
        batch_count = 0
        file_output = 0

        for record in stream_process_dataset(env.pipeline, source, env.loader):
            line = json.dumps(record) + "\n"
            buffer.write(line.encode("utf-8"))
            batch_count += 1
            file_output += 1

            if batch_count >= FLUSH_BATCH_SIZE:
                if check_memory_pressure():
                    logger.warning("   ⚠️ Mid-file memory threshold reached")
                batch_count = 0

        # Upload completed file
        if file_output > 0:
            flush_to_s3(env.loader.s3_client, env.bucket, output_key, buffer)
            stats.total_output += file_output
            stats.files_processed += 1
            logger.info(
                f"   ✅ Processed: {file_output:,} records → s3://{env.bucket}/{output_key}"
            )
        else:
            logger.warning("   ⚠️ No records passed pipeline filtering")

        # Explicitly free buffer and collect
        del buffer
        gc.collect()

    except Exception as e:
        logger.error(f"   ❌ Error processing {s3_key}: {e}")
        gc.collect()


def main():
    """Main entry point for the S3 pipeline processing."""
    logger.info("=" * 80)
    logger.info("🚀 FULL S3 PIPELINE PROCESSING - ALL DATA (MEMORY-SAFE)")
    logger.info("=" * 80)
    logger.info(f"   Memory budget: {MAX_RSS_BYTES / (1024**3):.1f} GB")
    logger.info(f"   Flush batch size: {FLUSH_BATCH_SIZE:,} records")
    logger.info("")

    # Initialize
    loader = S3DatasetLoader()
    bucket = loader.bucket
    config = ProcessingConfig(
        target_quality_threshold=0.7,
        deduplication_enabled=True,
        safety_filtering_enabled=True,
        validation_enabled=True,
    )
    pipeline = UnifiedPreprocessingPipeline(config)
    env = ProcessingEnv(pipeline=pipeline, loader=loader, bucket=bucket)

    all_files = discover_datasets(loader, bucket)
    total_size_gb = sum(f["size"] for f in all_files) / (1024**3)
    logger.info(f"📊 Total size: {total_size_gb:.2f} GB\n")

    # Sort smallest first to avoid hitting memory limits early
    all_files.sort(key=lambda f: f["size"])

    stats = ProcessingStats()

    for idx, file_info in enumerate(all_files, 1):
        process_single_file(idx, len(all_files), file_info, env, stats)

    logger.info("\n" + "=" * 80)
    logger.info("✅ PROCESSING COMPLETE!")
    logger.info(f"   Files processed: {stats.files_processed}")
    logger.info(f"   Files skipped (already done): {stats.files_skipped}")
    logger.info(f"   Total records output: {stats.total_output:,}")
    logger.info(f"   Output location: s3://{bucket}/processed_ready/")

    rss = get_rss_bytes()
    logger.info(f"   Final RSS: {rss / (1024**3):.2f} GB")
    logger.info("=" * 80)


if __name__ == "__main__":
    main()
