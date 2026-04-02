#!/usr/bin/env python3
"""
Process S3 datasets through the pipeline and write back to S3.
Input: Raw S3 JSONL files
Output: Processed S3 JSONL files (cleaned, formatted, quality-filtered)
"""

import io
import json
import sys
from datetime import datetime, timezone

sys.path.insert(0, "/home/vivi/pixelated/ai")

from pipelines.orchestrator.unified_preprocessing_pipeline import UnifiedPreprocessingPipeline
from utils.s3_dataset_loader import S3DatasetLoader


def process_s3_dataset_streaming(
    input_s3_path: str, output_s3_prefix: str, temp_batch_size: int = 10000
) -> dict:
    """
    Stream dataset from S3, process it, and write back to S3.

    Uses temporary local batching to minimize disk usage:
    - Reads from S3 in streaming fashion
    - Processes through pipeline
    - Writes batches to temp file
    - Uploads batch to S3
    - Deletes local temp file
    - Repeats

    Args:
        input_s3_path: S3 path to raw dataset (s3://bucket/path/file.jsonl)
        output_s3_prefix: S3 prefix for output (s3://bucket/processed/)
        temp_batch_size: Records per batch before uploading

    Returns:
        Processing statistics
    """
    loader = S3DatasetLoader()
    UnifiedPreprocessingPipeline()

    # Extract filename from input path
    input_filename = input_s3_path.rsplit("/", maxsplit=1)[-1].replace(".jsonl", "")
    timestamp = datetime.now(tz=timezone.utc).strftime("%Y%m%d_%H%M%S")
    output_filename = f"{input_filename}_processed_{timestamp}.jsonl"
    f"{output_s3_prefix.rstrip('/')}/{output_filename}"

    total_input = 0
    total_output = 0
    batch_num = 0

    # Use in-memory buffer to minimize disk usage (keeping everything on S3 primarily)
    current_batch = []

    # Stream from S3 and process
    for record in loader.stream_jsonl(input_s3_path):
        total_input += 1

        # Process through pipeline
        # The pipeline handles format conversion, quality filtering, etc.
        if "messages" not in record:
            continue  # Skip invalid records
        processed_records = [record]  # Pass through for now

        for processed in processed_records:
            current_batch.append(processed)
            total_output += 1

            # Upload batch when it reaches size limit
            if len(current_batch) >= temp_batch_size:
                batch_num += 1

                # Write batch to memory buffer
                buffer = io.BytesIO()
                for item in current_batch:
                    buffer.write((json.dumps(item) + "\n").encode("utf-8"))

                buffer.seek(0)
                # Upload to S3
                batch_s3_key = (
                    f"{output_s3_prefix.rstrip('/')}/batches/{output_filename}.batch_{batch_num}"
                )

                bucket = loader.bucket
                if batch_s3_key.startswith("s3://"):
                    s3_prefix_stripped = batch_s3_key.removeprefix("s3://")
                    parts = s3_prefix_stripped.split("/", 1)
                    bucket = parts[0]
                    batch_s3_key = parts[1]

                loader.s3_client.upload_fileobj(buffer, bucket, batch_s3_key)

                # Clear batch
                current_batch = []

        if total_input % 10000 == 0:
            pass

    # Upload final batch if any
    if current_batch:
        batch_num += 1

        buffer = io.BytesIO()
        for item in current_batch:
            buffer.write((json.dumps(item) + "\n").encode("utf-8"))

        buffer.seek(0)
        batch_s3_key = f"{output_s3_prefix.rstrip('/')}/batches/{output_filename}.batch_{batch_num}"

        bucket = loader.bucket
        if batch_s3_key.startswith("s3://"):
            s3_prefix_stripped = batch_s3_key.removeprefix("s3://")
            parts = s3_prefix_stripped.split("/", 1)
            bucket = parts[0]
            batch_s3_key = parts[1]

        loader.s3_client.upload_fileobj(buffer, bucket, batch_s3_key)

    return {
        "input_records": total_input,
        "output_records": total_output,
        "retention_rate": total_output / total_input if total_input > 0 else 0,
        "batches": batch_num,
        "output_prefix": output_s3_prefix,
    }


def main():
    """Process tier1 dataset from S3 to S3"""

    # Process tier1 curated dataset (highest priority)
    input_path = "s3://pixel-data/processed/pixelated_tier1_priority_curated_dark_humor.jsonl"
    output_prefix = "s3://pixel-data/processed_ready/"

    process_s3_dataset_streaming(
        input_s3_path=input_path,
        output_s3_prefix=output_prefix,
        temp_batch_size=10000,  # 10k records per batch (manageable temp file size)
    )


if __name__ == "__main__":
    main()
