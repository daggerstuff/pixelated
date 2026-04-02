#!/usr/bin/env python3
"""
Comprehensive S3 Dataset Metrics Measurement
Inventories pixel-data bucket and counts actual training samples
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import boto3
from botocore.exceptions import ClientError

# S3 Configuration from .env
S3_ENDPOINT = os.getenv("OVH_S3_ENDPOINT", "https://s3.us-east-va.io.cloud.ovh.us")
S3_REGION = os.getenv("OVH_S3_REGION", "us-east-va")
S3_BUCKET = os.getenv("OVH_S3_BUCKET", "pixel-data")
S3_ACCESS_KEY = os.environ["OVH_S3_ACCESS_KEY"]
S3_SECRET_KEY = os.environ["OVH_S3_SECRET_KEY"]


def create_s3_client():
    """Create S3 client with OVH credentials"""
    return boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        region_name=S3_REGION,
    )


def count_jsonl_lines(s3_client, bucket: str, key: str) -> int:
    """Count lines in a JSONL file in S3"""
    try:
        response = s3_client.get_object(Bucket=bucket, Key=key)
        content = response["Body"].read().decode("utf-8")
        lines = [line.strip() for line in content.split("\n") if line.strip()]
        return len(lines)
    except Exception:
        return 0


def inventory_s3_directory(s3_client, bucket: str, prefix: str) -> dict[str, Any]:
    """Inventory a directory in S3"""

    result = {
        "prefix": prefix,
        "total_files": 0,
        "total_size": 0,
        "jsonl_files": [],
        "json_files": [],
        "csv_files": [],
        "other_files": [],
        "total_samples": 0,
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
                    samples = count_jsonl_lines(s3_client, bucket, key)
                    result["jsonl_files"].append({"key": key, "size": size, "samples": samples})
                    result["total_samples"] += samples
                elif key.endswith(".json"):
                    result["json_files"].append({"key": key, "size": size})
                elif key.endswith(".csv"):
                    result["csv_files"].append({"key": key, "size": size})
                else:
                    result["other_files"].append({"key": key, "size": size})

    except ClientError:
        pass

    return result


def format_size(bytes_size: int) -> str:
    """Format bytes to human-readable size"""
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if bytes_size < 1024.0:
            return f"{bytes_size:.1f} {unit}"
        bytes_size /= 1024.0
    return f"{bytes_size:.1f} PB"


def main():

    s3_client = create_s3_client()

    # Directories to scan
    directories = ["datasets/", "training/", "processed/", "acquired/", "ai/", "knowledge/"]

    all_results = {}
    total_samples = 0
    total_size = 0

    for directory in directories:
        result = inventory_s3_directory(s3_client, S3_BUCKET, directory)
        all_results[directory] = result
        total_samples += result["total_samples"]
        total_size += result["total_size"]

        if result["jsonl_files"]:
            sorted_jsonl = sorted(result["jsonl_files"], key=lambda x: x["samples"], reverse=True)[
                :5
            ]
            for _f in sorted_jsonl:
                pass

    # Save detailed report
    output_dir = Path("metrics")
    output_dir.mkdir(exist_ok=True)

    timestamp = datetime.now(tz=timezone.utc).strftime("%Y%m%d_%H%M%S")
    json_path = output_dir / f"s3_dataset_metrics_{timestamp}.json"
    output_dir / f"s3_dataset_report_{timestamp}.md"

    # Save JSON
    report_data = {
        "timestamp": datetime.now(tz=timezone.utc).isoformat(),
        "bucket": S3_BUCKET,
        "endpoint": S3_ENDPOINT,
        "total_samples": total_samples,
        "total_size": total_size,
        "directories": all_results,
    }

    with open(json_path, "w") as f:
        json.dump(report_data, f, indent=2)


if __name__ == "__main__":
    main()
