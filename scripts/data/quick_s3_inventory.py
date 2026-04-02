#!/usr/bin/env python3
"""
Quick S3 Inventory - Just counts files and sizes, estimates samples
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import boto3

# S3 Configuration
S3_ENDPOINT = "https://s3.us-east-va.io.cloud.ovh.us"
S3_REGION = "us-east-va"
S3_BUCKET = "pixel-data"
S3_ACCESS_KEY = os.environ["OVH_S3_ACCESS_KEY"]
S3_SECRET_KEY = os.environ["OVH_S3_SECRET_KEY"]


def create_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        region_name=S3_REGION,
    )


def format_size(bytes_size: int) -> str:
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if bytes_size < 1024.0:
            return f"{bytes_size:.1f} {unit}"
        bytes_size /= 1024.0
    return f"{bytes_size:.1f} PB"


def estimate_samples(size_bytes: int, file_type: str) -> int:
    """Estimate number of samples based on file size"""
    # Average sizes from known datasets
    if file_type == "jsonl":
        # ~500-1000 bytes per sample average
        return int(size_bytes / 750)
    if file_type == "csv":
        # ~300-500 bytes per row average
        return int(size_bytes / 400)
    return 0


def quick_inventory(s3_client, bucket: str, prefix: str) -> dict[str, Any]:

    result = {
        "prefix": prefix,
        "total_files": 0,
        "total_size": 0,
        "jsonl_count": 0,
        "jsonl_size": 0,
        "json_count": 0,
        "json_size": 0,
        "csv_count": 0,
        "csv_size": 0,
        "md_count": 0,
        "other_count": 0,
        "estimated_samples": 0,
    }

    try:
        paginator = s3_client.get_paginator("list_objects_v2")
        pages = paginator.paginate(Bucket=bucket, Prefix=prefix)

        for page in pages:
            if "Contents" not in page:
                continue

            for obj in page["Contents"]:
                key = obj["Key"]
                size = obj["Size"]

                result["total_files"] += 1
                result["total_size"] += size

                if key.endswith(".jsonl"):
                    result["jsonl_count"] += 1
                    result["jsonl_size"] += size
                    result["estimated_samples"] += estimate_samples(size, "jsonl")
                elif key.endswith(".json"):
                    result["json_count"] += 1
                    result["json_size"] += size
                elif key.endswith(".csv"):
                    result["csv_count"] += 1
                    result["csv_size"] += size
                    result["estimated_samples"] += estimate_samples(size, "csv")
                elif key.endswith(".md"):
                    result["md_count"] += 1
                else:
                    result["other_count"] += 1

    except Exception:
        pass

    return result


def main():

    s3_client = create_s3_client()

    directories = ["datasets/", "training/", "processed/", "acquired/", "ai/", "knowledge/"]

    all_results = {}
    total_samples = 0
    total_size = 0
    total_jsonl = 0

    for directory in directories:
        result = quick_inventory(s3_client, S3_BUCKET, directory)
        all_results[directory] = result
        total_samples += result["estimated_samples"]
        total_size += result["total_size"]
        total_jsonl += result["jsonl_count"]

    # Save report
    output_dir = Path("metrics")
    output_dir.mkdir(exist_ok=True)

    timestamp = datetime.now(tz=timezone.utc).strftime("%Y%m%d_%H%M%S")
    json_path = output_dir / f"s3_quick_inventory_{timestamp}.json"

    report_data = {
        "timestamp": datetime.now(tz=timezone.utc).isoformat(),
        "bucket": S3_BUCKET,
        "total_estimated_samples": total_samples,
        "total_size": total_size,
        "total_jsonl_files": total_jsonl,
        "directories": all_results,
    }

    with open(json_path, "w") as f:
        json.dump(report_data, f, indent=2)


if __name__ == "__main__":
    main()
