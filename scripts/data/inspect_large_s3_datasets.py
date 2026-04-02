#!/usr/bin/env python3
"""Inspect large S3 datasets to determine format and count."""

import sys

sys.path.insert(0, "/home/vivi/pixelated/ai")

from utils.s3_dataset_loader import S3DatasetLoader


def main():
    loader = S3DatasetLoader()

    # Check the ultimate final dataset and other large files
    datasets_to_check = [
        "s3://pixel-data/ai/training_ready/data/ULTIMATE_FINAL_DATASET_cleaned.jsonl",
        "s3://pixel-data/ai/data/lightning_h100/train.json",
        "s3://pixel-data/ai/data/compress/processed/mental_health_clean.jsonl",
        "s3://pixel-data/ai/training_ready/data/generated/edge_case_expanded/crisis_detection_cleaned.jsonl",
    ]

    for s3_path in datasets_to_check:
        # Iterate with index to avoid manual counting
        try:
            count = 0
            for idx, record in enumerate(loader.stream_jsonl(s3_path), start=1):
                count = idx
                if count == 1:
                    if "messages" in record:
                        pass
                    else:
                        pass
                if count >= 1000:  # Sample 1000 records
                    break
        except Exception:
            pass


if __name__ == "__main__":
    main()
