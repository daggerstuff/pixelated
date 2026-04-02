#!/usr/bin/env python3
"""Analyze processed S3 data and generate comprehensive statistics."""

import sys

sys.path.insert(0, "/home/vivi/pixelated/ai")

import json
from collections import defaultdict
from pathlib import Path

from utils.s3_dataset_loader import S3DatasetLoader


def main():
    loader = S3DatasetLoader()

    # List all processed files
    all_files = loader.list_datasets(prefix="processed_ready/")

    # Statistics
    stats = {
        "total_files": len(all_files),
        "total_records": 0,
        "total_size_bytes": 0,
        "files_by_category": defaultdict(int),
        "records_by_category": defaultdict(int),
        "message_length_distribution": [],
        "files_analyzed": [],
    }

    # Analyze ALL files for comprehensive statistics
    sample_files = all_files  # All 90 files

    for _i, s3_file in enumerate(sample_files, 1):
        file_name = s3_file.split("/")[-1]

        try:
            # Stream and count
            record_count = 0
            message_lengths = []

            for record in loader.stream_jsonl(s3_file):
                record_count += 1

                # Analyze message structure
                if "messages" in record:
                    message_lengths.append(len(record["messages"]))

                # Sample first 5000 records per file for better statistics
                if record_count >= 5000:
                    break

            # Categorize
            category = "other"
            if "priority" in file_name or "curated" in file_name:
                category = "therapeutic"
            elif "bias" in file_name or "ethics" in file_name:
                category = "bias"
            elif "grounded" in file_name or "knowledge" in file_name:
                category = "grounded"

            stats["files_by_category"][category] += 1
            stats["records_by_category"][category] += record_count
            stats["total_records"] += record_count
            stats["message_length_distribution"].extend(message_lengths)
            stats["files_analyzed"].append(
                {
                    "name": file_name,
                    "records_sampled": record_count,
                    "category": category,
                    "avg_message_length": sum(message_lengths) / len(message_lengths)
                    if message_lengths
                    else 0,
                }
            )

        except Exception:
            pass

    for _category, _count in stats["files_by_category"].items():
        pass

    for _category, _count in stats["records_by_category"].items():
        pass

    if stats["message_length_distribution"]:
        sum(stats["message_length_distribution"]) / len(stats["message_length_distribution"])

    # Save detailed stats
    output_file = Path("metrics/processed_s3_statistics.json")
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, "w") as f:
        json.dump(stats, f, indent=2)


if __name__ == "__main__":
    main()
