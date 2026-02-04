#!/usr/bin/env python3
"""
S3 Reorganization Script (Multi-threaded)
Moves files from legacy paths to the new canonical structure.
"""

import logging
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import boto3
import urllib3
from botocore.config import Config
from dotenv import load_dotenv

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(message)s")

# Disable insecure request warnings for OVH self-signed certs
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Load environment variables
env_path = Path(__file__).parents[2] / "ai" / ".env"
load_dotenv(env_path)

# S3 Configuration
BUCKET = os.getenv("OVH_S3_BUCKET", "pixel-data")
ENDPOINT = os.getenv("OVH_S3_ENDPOINT", "https://s3.us-east-va.io.cloud.ovh.us")
ACCESS_KEY = os.getenv("OVH_S3_ACCESS_KEY") or os.getenv("AWS_ACCESS_KEY_ID")
SECRET_KEY = os.getenv("OVH_S3_SECRET_KEY") or os.getenv("AWS_SECRET_ACCESS_KEY")
REGION = os.getenv("OVH_S3_REGION", "us-east-va")

MAX_WORKERS = 32  # Increase for faster migration


def get_s3_client():
    config = Config(region_name=REGION)
    return boto3.client(
        "s3",
        endpoint_url=ENDPOINT,
        aws_access_key_id=ACCESS_KEY,
        aws_secret_access_key=SECRET_KEY,
        config=config,
        verify=False,
    )


def move_s3_object(old_key, new_key):
    """Moves an object in S3 (Copy + Delete)"""
    if old_key == new_key:
        return True

    s3 = get_s3_client()
    try:
        # Copy the object
        copy_source = {"Bucket": BUCKET, "Key": old_key}
        s3.copy_object(CopySource=copy_source, Bucket=BUCKET, Key=new_key)

        # Delete the original
        s3.delete_object(Bucket=BUCKET, Key=old_key)
        return True
    except Exception as e:
        logger.error("  [ERROR] Failed to move %s: %s", old_key, e)
        return False


def process_prefix_migration(old_prefix, new_prefix):
    """Migrates all objects under a prefix from old to new"""
    logger.info("\n--- Migrating Prefix: %s -> %s ---", old_prefix, new_prefix)
    s3 = get_s3_client()
    paginator = s3.get_paginator("list_objects_v2")
    pages = paginator.paginate(Bucket=BUCKET, Prefix=old_prefix)

    count = 0
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = []
        for page in pages:
            if "Contents" not in page:
                continue
            for obj in page["Contents"]:
                old_key = obj["Key"]
                new_key = old_key.replace(old_prefix, new_prefix, 1)
                futures.append(executor.submit(move_s3_object, old_key, new_key))
                count += 1
                if count % 100 == 0:
                    logger.info("  Queued %d moves...", count)

        # Wait for completion
        completed_count = 0
        for future in as_completed(futures):
            if future.result():
                completed_count += 1
            if completed_count % 100 == 0:
                logger.info("  Completed %d/%d moves...", completed_count, count)


def reorganize():
    # 1. Move GDrive Raw Mirror to Archive
    process_prefix_migration("datasets/gdrive/", "archive/gdrive/")

    # 2. Organize Training Stage 1 (Foundation/Professional)
    prof_prefixes = {
        "archive/gdrive/raw/mental_health_counseling_conversations/": "training/v1/stage1_foundation/professional/mental_health_counseling/",
        "archive/gdrive/raw/SoulChat2.0/": "training/v1/stage1_foundation/professional/soulchat2.0/",
        "archive/gdrive/raw/counsel-chat/": "training/v1/stage1_foundation/professional/counsel_chat/",
        "archive/gdrive/raw/LLAMA3_Mental_Counseling_Data/": "training/v1/stage1_foundation/professional/llama3_mental_counseling/",
        "archive/gdrive/raw/therapist-sft-format/": "training/v1/stage1_foundation/professional/therapist_sft/",
        "archive/gdrive/raw/neuro_qa_SFT_Trainer/": "training/v1/stage1_foundation/professional/neuro_qa_sft/",
        "archive/gdrive/raw/Psych8k/": "training/v1/stage1_foundation/professional/psych8k/",
    }
    for old, new in prof_prefixes.items():
        process_prefix_migration(old, new)

    # 3. Organize Training Stage 2 (Expertise/CoT)
    cot_mappings = {
        "archive/gdrive/raw/CoT_Reasoning_Clinical_Diagnosis_Mental_Health/CoT_Reasoning_Clinical_Diagnosis_Mental_Health.json": "training/v1/stage2_expertise/reasoning/clinical_diagnosis_mental_health.json",
        "archive/gdrive/raw/CoT_Heartbreak_and_Breakups_downloaded.json": "training/v1/stage2_expertise/reasoning/heartbreak_and_breakups.json",
        "archive/gdrive/raw/CoT_Neurodivergent_vs_Neurotypical_Interactions_downloaded.json": "training/v1/stage2_expertise/reasoning/neurodivergent_vs_neurotypical.json",
        "archive/gdrive/raw/CoT_Reasoning_Mens_Mental_Health_downloaded.json": "training/v1/stage2_expertise/reasoning/mens_mental_health.json",
        "archive/gdrive/raw/CoT-Reasoning_Cultural_Nuances/CoT-Reasoning_Cultural_Nuances_Dataset.json": "training/v1/stage2_expertise/reasoning/cultural_nuances.json",
        "archive/gdrive/raw/CoT_Philosophical_Understanding/CoT_Philosophical_Understanding.json": "training/v1/stage2_expertise/reasoning/philosophical_understanding.json",
        "archive/gdrive/raw/CoT_Temporal_Reasoning_Dataset/CoT_Temporal_Reasoning_Dataset.json": "training/v1/stage2_expertise/reasoning/temporal_reasoning.json",
        "archive/gdrive/raw/Reasoning_Problem_Solving_Dataset/RPSD.json": "training/v1/stage2_expertise/reasoning/rpsd.json",
    }
    logger.info("\n--- Migrating CoT Files ---")
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        for old, new in cot_mappings.items():
            executor.submit(move_s3_object, old, new)

    # 4. Organize Knowledge Base
    process_prefix_migration("archive/gdrive/raw/Books/", "knowledge/books/")
    process_prefix_migration("archive/gdrive/raw/youtube_transcriptions/", "knowledge/transcripts/")

    # 5. Archive other sources
    for source in ["datasets/huggingface/", "datasets/kaggle/", "datasets/local/"]:
        process_prefix_migration(source, source.replace("datasets/", "archive/", 1))

    logger.info("\nReorganization Complete!")


if __name__ == "__main__":
    reorganize()
