#!/usr/bin/env python3
"""
Ingest New Hugging Face Mental Health & Therapy Datasets
=========================================================

Downloads and processes 11 new open-source therapy, counseling, CBT, and empathetic dialogue datasets:
- vibhorag101/phr_mental_therapy_dataset (99,086 records)
- LuangMV97/Empathetic_counseling_Dataset (30,937 records)
- Estwld/empathetic_dialogues_llm (19,533 records)
- adarshxs/Therapy-Alpaca (10,507 records)
- samhog/psychology-10k (9,846 records)
- Sulav/mental_health_counseling_conversations_sharegpt (3,512 records)
- Amod/mental_health_counseling_conversations (3,512 records)
- devxpy/therapychat (1,573 records)
- epsilon3/cbt-cognitive-distortions-analysis (621 records)
- to-be/annomi-motivational-interviewing-therapy-conversations (133 records)
- heliosbrahma/mental_health_chatbot_dataset (172 records)

All records pass through QualityFilter (MD5 fingerprinting + SHA-256 deduplication + anti-repetition),
are appended to local dataset/final_dataset.jsonl, and uploaded to HetznerS3.
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

from datasets import load_dataset

from ai.dataset_pipeline.extractors.s3_streamer import S3Streamer
from ai.dataset_pipeline.processors.quality_filter import QualityFilter

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def parse_phr_text(text: str) -> tuple[str | None, str | None]:
    """Parse LLaMA-style [INST] <<SYS>> prompt/response text."""
    if "[/INST]" in text:
        parts = text.split("[/INST]", 1)
        inst_part = parts[0]
        assistant_resp = parts[1].replace("</s>", "").strip()
        if "<</SYS>>" in inst_part:
            user_prompt = inst_part.split("<</SYS>>", 1)[1].strip()
        else:
            user_prompt = inst_part.replace("<s>[INST]", "").strip()
        return user_prompt, assistant_resp
    return None, None


def convert_to_chatml(item: dict, dataset_name: str) -> dict | None:
    """Convert dataset sample dict into standard ChatML format."""
    # 1. ShareGPT format ('conversations' list)
    if "conversations" in item and isinstance(item["conversations"], list):
        messages = []
        for turn in item["conversations"]:
            if not isinstance(turn, dict):
                continue
            role = turn.get("from") or turn.get("role") or "user"
            content = turn.get("value") or turn.get("content") or ""
            if not content or not isinstance(content, str):
                continue
            role_norm = "user" if role in ["human", "user", "client"] else "assistant"
            messages.append({"role": role_norm, "content": content.strip()})
        return {"messages": messages} if len(messages) >= 2 else None

    # 2. Input / Output format (e.g. samhog/psychology-10k, adarshxs/Therapy-Alpaca, LuangMV97)
    if "input" in item or "Context" in item or "user" in item:
        user_text = item.get("input") or item.get("Context") or item.get("user") or item.get("prompt") or ""
        assistant_text = (
            item.get("output")
            or item.get("Response")
            or item.get("assistant")
            or item.get("response")
            or item.get("label")
            or ""
        )
        if (
            isinstance(user_text, str)
            and isinstance(assistant_text, str)
            and user_text.strip()
            and assistant_text.strip()
        ):
            return {
                "messages": [
                    {"role": "user", "content": user_text.strip()},
                    {"role": "assistant", "content": assistant_text.strip()},
                ]
            }

    # 3. LLaMA INST text format (e.g. vibhorag101/phr_mental_therapy_dataset)
    if "text" in item and isinstance(item["text"], str):
        text = item["text"]
        user_p, asst_r = parse_phr_text(text)
        if user_p and asst_r:
            return {
                "messages": [
                    {"role": "user", "content": user_p},
                    {"role": "assistant", "content": asst_r},
                ]
            }

    return None


def main():
    logger.info("=== Starting Ingestion of New Hugging Face Therapy Datasets ===")
    quality = QualityFilter()

    # Load existing clean records from dataset/final_dataset.jsonl into quality filter state
    existing_records = []
    local_file = project_root / "dataset/final_dataset.jsonl"
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

    sources = [
        "samhog/psychology-10k",
        "Amod/mental_health_counseling_conversations",
        "heliosbrahma/mental_health_chatbot_dataset",
        "vibhorag101/phr_mental_therapy_dataset",
        "Sulav/mental_health_counseling_conversations_sharegpt",
        "LuangMV97/Empathetic_counseling_Dataset",
        "devxpy/therapychat",
        "adarshxs/Therapy-Alpaca",
        "Estwld/empathetic_dialogues_llm",
        "to-be/annomi-motivational-interviewing-therapy-conversations",
        "epsilon3/cbt-cognitive-distortions-analysis",
    ]

    new_clean_records = []
    summary = {}

    for src in sources:
        logger.info("Ingesting source: %s ...", src)
        try:
            ds = load_dataset(src, split="train")
            extracted = 0
            accepted = 0
            rejected = 0

            for item in ds:
                extracted += 1
                chatml = convert_to_chatml(item, src)
                if chatml and quality.passes_filter(chatml):
                    new_clean_records.append(chatml)
                    accepted += 1
                else:
                    rejected += 1

            summary[src] = {"extracted": extracted, "accepted": accepted, "rejected": rejected}
            logger.info("  [%s] Extracted=%d, Accepted=%d, Rejected=%d", src, extracted, accepted, rejected)
        except Exception as e:
            logger.error("Failed to load source %s: %s", src, e)

    all_records = existing_records + new_clean_records
    logger.info("=== Overall Ingestion Summary ===")
    logger.info("Previous clean records: %d", len(existing_records))
    logger.info("New clean records added: %d", len(new_clean_records))
    logger.info("Total clean non-duplicate dataset size: %d", len(all_records))

    # Save to local canonical dataset file
    local_file.parent.mkdir(parents=True, exist_ok=True)
    with open(local_file, "w", encoding="utf-8") as f:
        for rec in all_records:
            f.write(json.dumps(rec) + "\n")
    logger.info("Saved %d clean records to local canonical dataset: %s", len(all_records), local_file)

    # Upload clean expanded dataset to S3
    logger.info("Uploading expanded clean dataset to S3 key: final_dataset/final_training_dataset.jsonl...")
    streamer = S3Streamer()
    streamer.write_jsonl("final_dataset/final_training_dataset.jsonl", all_records)
    logger.info("S3 upload complete! Updated final_training_dataset.jsonl on HetznerS3.")


if __name__ == "__main__":
    main()
