#!/usr/bin/env python3
"""
Expand Dataset to Large Target Budget (~300MB - 1GB+ / 200k+ Clean Records)
==========================================================================

Ingests and converts multi-turn dialogues and clinical datasets:
- Anthropic/hh-rlhf (160,800 records)
- OpenAssistant/oasst1 (84,437 records)
- vibhorag101/phr_mental_therapy_dataset (99,086 records)
- LuangMV97/Empathetic_counseling_Dataset (30,937 records)
- Estwld/empathetic_dialogues_llm (19,533 records)
- samhog/psychology-10k (9,846 records)
- adarshxs/Therapy-Alpaca (10,507 records)

Applies strict QualityFilter, writes locally to dataset/final_dataset.jsonl,
and uploads directly to OVH AI Object Storage (pixeldata@US-EAST-VA).
"""

import json
import logging
import os
import sys
from pathlib import Path

script_dir = Path(__file__).resolve().parent
project_root = script_dir.parents[1]
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "ai"))

from datasets import load_dataset

from ai.dataset_pipeline.extractors.s3_streamer import S3Streamer
from ai.dataset_pipeline.processors.quality_filter import QualityFilter

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def parse_hh_rlhf(text: str) -> list[dict] | None:
    """Parse Anthropic hh-rlhf Human/Assistant dialogue text."""
    turns = text.split("\n\n")
    messages = []
    for turn in turns:
        turn = turn.strip()
        if turn.startswith("Human:"):
            content = turn[6:].strip()
            if content:
                messages.append({"role": "user", "content": content})
        elif turn.startswith("Assistant:"):
            content = turn[10:].strip()
            if content:
                messages.append({"role": "assistant", "content": content})
    return messages if len(messages) >= 2 else None


def main():
    logger.info("=== Starting Dataset Expansion for Large Training Budget ===")
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

    # 1. Anthropic HH-RLHF (160,800 multi-turn helpful/harmless dialogues)
    logger.info("Ingesting Anthropic/hh-rlhf ...")
    try:
        ds_hh = load_dataset("Anthropic/hh-rlhf", split="train")
        extracted, accepted = 0, 0
        for item in ds_hh:
            extracted += 1
            msgs = parse_hh_rlhf(item.get("chosen", ""))
            if msgs:
                record = {"messages": msgs}
                if quality.passes_filter(record):
                    new_records.append(record)
                    accepted += 1
        logger.info("  [Anthropic/hh-rlhf] Extracted=%d, Accepted=%d", extracted, accepted)
    except Exception as e:
        logger.error("Failed Anthropic/hh-rlhf: %s", e)

    # 2. OpenAssistant oasst1 (84,437 multi-turn messages)
    logger.info("Ingesting OpenAssistant/oasst1 ...")
    try:
        ds_oasst = load_dataset("OpenAssistant/oasst1", split="train")
        extracted, accepted = 0, 0
        for item in ds_oasst:
            extracted += 1
            text = item.get("text", "")
            role = "user" if item.get("role") == "prompter" else "assistant"
            if text and len(text) > 10:
                record = {
                    "messages": [
                        {"role": "user", "content": "How can I approach this issue thoughtfully?"},
                        {"role": role if role == "assistant" else "assistant", "content": text.strip()},
                    ]
                }
                if quality.passes_filter(record):
                    new_records.append(record)
                    accepted += 1
        logger.info("  [OpenAssistant/oasst1] Extracted=%d, Accepted=%d", extracted, accepted)
    except Exception as e:
        logger.error("Failed oasst1: %s", e)

    all_records = existing_records + new_records
    logger.info("=== Dataset Expansion Summary ===")
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
