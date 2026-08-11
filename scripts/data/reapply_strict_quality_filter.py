#!/usr/bin/env python3
"""
Re-apply Strict Quality Filter to dataset/final_dataset.jsonl
==============================================================

Applies enhanced QualityFilter thresholds (substance length, non-stop-word density,
artifact filtering, low-unique-word-ratio checks, MD5 fingerprinting, and SHA-256 hash dedup).
"""

import json
import logging
import sys
from pathlib import Path

# Add project root to sys.path
script_dir = Path(__file__).resolve().parent
project_root = script_dir.parents[1]
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "ai"))

from ai.dataset_pipeline.extractors.s3_streamer import S3Streamer
from ai.dataset_pipeline.processors.quality_filter import QualityFilter

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def main():
    logger.info("=== Re-filtering Dataset with Enhanced Strict QualityFilter ===")
    quality = QualityFilter()

    local_file = project_root / "dataset/final_dataset.jsonl"
    if not local_file.exists():
        logger.error("Dataset file %s does not exist!", local_file)
        sys.exit(1)

    total_read = 0
    accepted_records = []
    rejection_reasons = {
        "short_substance": 0,
        "ngram_or_density_or_unique": 0,
        "artifact_junk": 0,
        "dedup_or_other": 0,
    }

    with open(local_file, encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            total_read += 1
            try:
                record = json.loads(line)
                if quality.passes_filter(record):
                    accepted_records.append(record)
            except Exception:
                pass

    total_rejected = total_read - len(accepted_records)
    rejection_rate = (total_rejected / total_read * 100) if total_read > 0 else 0

    logger.info("Total records evaluated: %d", total_read)
    logger.info("Records passing strict filter: %d", len(accepted_records))
    logger.info("Records pruned by strict filter: %d (Rejection Rate: %.1f%%)", total_rejected, rejection_rate)

    # Save to local canonical dataset file
    with open(local_file, "w", encoding="utf-8") as f:
        for rec in accepted_records:
            f.write(json.dumps(rec) + "\n")
    logger.info("Saved %d high-quality clean records to %s", len(accepted_records), local_file)

    # Upload clean strict dataset to S3
    logger.info("Uploading strict clean dataset to S3 key: final_dataset/final_training_dataset.jsonl...")
    streamer = S3Streamer()
    streamer.write_jsonl("final_dataset/final_training_dataset.jsonl", accepted_records)
    logger.info("S3 upload complete! Updated final_training_dataset.jsonl on HetznerS3.")


if __name__ == "__main__":
    main()
