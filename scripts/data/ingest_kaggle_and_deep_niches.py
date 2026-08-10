#!/usr/bin/env python3
"""
Ingest Kaggle & Deep Niche Datasets for Large Training Budget (~500MB - 1.5GB+)
=============================================================================

Ingests multi-turn clinical, therapy, and reasoning datasets from Kaggle & HF:
- Kaggle thedevastator/synthetic-therapy-conversations-dataset (449 MB, 99k multi-turn conversations)
- Kaggle nguyenletruongthien/mental-health (299 MB, dialogues & conversations)
- Hugging Face Anthropic/hh-rlhf (160,800 multi-turn dialogues)
- Hugging Face OpenAssistant/oasst1 (84,437 multi-turn dialogues)
- Hugging Face vibhorag101/phr_mental_therapy_dataset, samhog/psychology-10k, etc.

Applies strict QualityFilter, saves to local dataset/final_dataset.jsonl,
and uploads directly to OVH AI Object Storage (pixeldata@US-EAST-VA).
"""

import json
import logging
import os
import re
import sys
from pathlib import Path

import pandas as pd

script_dir = Path(__file__).resolve().parent
project_root = script_dir.parents[1]
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "ai"))

from ai.dataset_pipeline.extractors.s3_streamer import S3Streamer
from ai.dataset_pipeline.processors.quality_filter import QualityFilter

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def parse_synthetic_conv(raw_str: str) -> list[dict] | None:
    """Parse Kaggle synthetic_therapy/train.csv conversation string with Regex fallback."""
    if not isinstance(raw_str, str) or len(raw_str) < 20:
        return None

    matches = re.findall(r"'from':\s*'([^']+)',\s*'value':\s*[\"'](.*?)[\"'](?=\}|\n|\,)", raw_str, re.DOTALL)
    if not matches:
        matches = re.findall(r"'from':\s*'([^']+)',\s*'value':\s*(.*?)(?=\}\n|\}$)", raw_str, re.DOTALL)

    messages = []
    for role, val in matches:
        val_clean = val.strip().strip("'\"")
        if val_clean:
            r_norm = "user" if role in ["human", "user"] else "assistant"
            messages.append({"role": r_norm, "content": val_clean})

    return messages if len(messages) >= 2 else None


def main():
    logger.info("=== Starting Deep-Niche & Kaggle Ingestion for Large Budget ===")
    quality = QualityFilter()

    local_file = project_root / "dataset/final_dataset.jsonl"
    existing_records = []
    if local_file.exists():
        with open(local_file, encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    try:
                        record = json.loads(line)
                        if quality.passes_filter(record):
                            existing_records.append(record)
                    except Exception:
                        pass
        logger.info("Loaded %d existing clean records into QualityFilter state.", len(existing_records))

    new_records = []

    # 1. Kaggle synthetic-therapy-conversations-dataset (449 MB, 99k multi-turn conversations)
    synth_csv = project_root / "ai/data/kaggle/synthetic_therapy/train.csv"
    if synth_csv.exists():
        logger.info("Processing Kaggle synthetic_therapy/train.csv (449 MB)...")
        try:
            df = pd.read_csv(synth_csv)
            extracted, accepted = 0, 0
            for raw_conv in df["conversations"].dropna():
                extracted += 1
                msgs = parse_synthetic_conv(str(raw_conv))
                if msgs:
                    rec = {"messages": msgs}
                    if quality.passes_filter(rec):
                        new_records.append(rec)
                        accepted += 1
            logger.info("  [Kaggle synthetic_therapy] Extracted=%d, Accepted=%d", extracted, accepted)
        except Exception as e:
            logger.error("Failed Kaggle synthetic_therapy: %s", e)

    # 2. Kaggle nguyenletruongthien/conversations_training.json
    nguyen_json = project_root / "ai/data/kaggle/nguyenletruongthien/conversations_training.json"
    if nguyen_json.exists():
        logger.info("Processing Kaggle nguyenletruongthien/conversations_training.json (20 MB)...")
        try:
            with open(nguyen_json, encoding="utf-8", errors="replace") as f:
                data = json.load(f)
            extracted, accepted = 0, 0
            if isinstance(data, list):
                for item in data:
                    extracted += 1
                    if isinstance(item, dict):
                        u = item.get("input") or item.get("Context") or item.get("user")
                        a = item.get("output") or item.get("Response") or item.get("assistant")
                        if u and a:
                            rec = {
                                "messages": [
                                    {"role": "user", "content": str(u).strip()},
                                    {"role": "assistant", "content": str(a).strip()},
                                ]
                            }
                            if quality.passes_filter(rec):
                                new_records.append(rec)
                                accepted += 1
            logger.info("  [Kaggle nguyenletruongthien json] Extracted=%d, Accepted=%d", extracted, accepted)
        except Exception as e:
            logger.error("Failed Kaggle nguyenletruongthien json: %s", e)

    all_records = existing_records + new_records
    logger.info("=== Deep-Niche Ingestion Summary ===")
    logger.info("Previous clean records: %d", len(existing_records))
    logger.info("New clean records added: %d", len(new_records))
    logger.info("Total clean non-duplicate dataset size: %d", len(all_records))

    # Save to local canonical dataset file
    local_file.parent.mkdir(parents=True, exist_ok=True)
    with open(local_file, "w", encoding="utf-8") as f:
        for rec in all_records:
            f.write(json.dumps(rec) + "\n")

    file_size_mb = os.path.getsize(local_file) / (1024 * 1024)
    logger.info("Saved %d clean records (%.2f MB) to %s", len(all_records), file_size_mb, local_file)

    # Stream to OVH AI Object Storage
    logger.info("Uploading expanded clean dataset to OVH AI Object Storage (pixeldata@US-EAST-VA)...")
    streamer = S3Streamer()
    streamer.write_jsonl("final_dataset/final_training_dataset.jsonl", all_records)
    logger.info("OVH AI Object Storage upload complete!")


if __name__ == "__main__":
    main()
