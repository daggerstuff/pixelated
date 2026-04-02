#!/usr/bin/env python3
"""Generate comprehensive metrics report for all processed S3 data."""

import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, "/home/vivi/pixelated/ai")


def analyze_dataset(file_path: Path) -> dict:
    """Analyze a single dataset file."""

    stats = {
        "total_records": 0,
        "sample_keys": set(),
        "message_counts": [],
        "has_metadata": 0,
        "has_quality_score": 0,
        "categories": Counter(),
        "sources": Counter(),
    }

    with open(file_path) as f:
        for line in f:
            if not line.strip():
                continue

            try:
                record = json.loads(line)
                stats["total_records"] += 1

                # Collect keys
                stats["sample_keys"].update(record.keys())

                # Count messages
                if "messages" in record:
                    stats["message_counts"].append(len(record["messages"]))

                # Check metadata
                if "metadata" in record:
                    stats["has_metadata"] += 1
                    metadata = record["metadata"]

                    # Category
                    if "category" in metadata:
                        stats["categories"][metadata["category"]] += 1

                    # Source
                    if "source" in metadata:
                        stats["sources"][metadata["source"]] += 1

                    # Quality score
                    if "quality_score" in metadata:
                        stats["has_quality_score"] += 1

            except json.JSONDecodeError:
                continue

    stats["sample_keys"] = list(stats["sample_keys"])
    stats["avg_messages"] = (
        sum(stats["message_counts"]) / len(stats["message_counts"])
        if stats["message_counts"]
        else 0
    )

    return stats


def main():
    datasets = [
        (
            "Tier1 Priority Curated",
            Path(
                "ai/training/ready_packages/datasets/cache/orchestrator_output/processed_s3_tier_datasets.jsonl"
            ),
        ),
        (
            "Mental Health Clean",
            Path("ai/training/ready_packages/datasets/cache/s3_direct/mental_health_clean.jsonl"),
        ),
        (
            "Training V3 - Counseling",
            Path(
                "ai/training/ready_packages/datasets/cache/training_v3_converted/stage1_foundation_counseling.jsonl"
            ),
        ),
        (
            "Training V3 - Helios",
            Path(
                "ai/training/ready_packages/datasets/cache/training_v3_converted/heliosbrahma_converted.jsonl"
            ),
        ),
    ]

    all_stats = {}
    total_records = 0

    for name, path in datasets:
        if path.exists() and path.stat().st_size > 0:
            stats = analyze_dataset(path)
            all_stats[name] = stats
            total_records += stats["total_records"]
        else:
            pass

    # Category breakdown
    all_categories = Counter()
    for _name, stats in all_stats.items():
        all_categories.update(stats["categories"])

    for _category, _count in all_categories.most_common(10):
        pass

    # Source breakdown
    all_sources = Counter()
    for _name, stats in all_stats.items():
        all_sources.update(stats["sources"])

    for _source, _count in all_sources.most_common(10):
        pass

    # PRD Target Comparison

    targets = {
        "Therapeutic Samples": (
            10000,
            all_categories.get("therapeutic", 0) + all_categories.get("counseling", 0),
        ),
        "Bias Detection Samples": (5000, all_categories.get("bias", 0)),
        "Grounded Conversations": (5000, all_categories.get("grounded", 0)),
        "Total Dataset Size": (20000, total_records),
    }

    for _metric, (target, actual) in targets.items():
        (actual / target * 100) if target > 0 else 0

    # Save detailed report
    output_file = Path("metrics/final_s3_processing_report.json")
    output_file.parent.mkdir(exist_ok=True)

    report = {
        "timestamp": datetime.now(tz=timezone.utc).isoformat(),
        "total_records": total_records,
        "datasets": {
            name: {
                "records": stats["total_records"],
                "categories": dict(stats["categories"]),
                "sources": dict(stats["sources"]),
                "avg_messages": stats["avg_messages"],
            }
            for name, stats in all_stats.items()
        },
        "aggregated": {
            "categories": dict(all_categories),
            "sources": dict(all_sources),
        },
        "prd_comparison": {k: {"target": v[0], "actual": v[1]} for k, v in targets.items()},
    }

    with open(output_file, "w") as f:
        json.dump(report, f, indent=2)


if __name__ == "__main__":
    main()
