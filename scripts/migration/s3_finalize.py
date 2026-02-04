#!/usr/bin/env python3
"""
S3 Reorganization Script (Final Patch)
Moves remaining Stage 3, curated, and forum datasets to canonical v1 structure.
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

MAX_WORKERS = 32


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
        logger.info("  [OK] Moved: %s -> %s", old_key, new_key)
        return True
    except Exception:
        # Don't log error if source is missing (might have been moved already)
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

        # Wait for completion
        completed_count = 0
        for future in as_completed(futures):
            if future.result():
                completed_count += 1
    logger.info("  Completed %d moves under prefix.", completed_count)


def finalize_reorganization():
    # 1. Curated Sets (Wendy Gold)
    # Move from legacy consolidated path to v1 stage1
    logger.info("\n--- Phase 6: Finalizing Curated Sets ---")
    process_prefix_migration(
        "datasets/consolidated/datasets/", "training/v1/stage1_foundation/curated/"
    )

    # 2. Stage 3 - Reddit Forum Data
    logger.info("\n--- Phase 7: Stage 3 Reddit Data ---")
    process_prefix_migration(
        "archive/gdrive/raw/reddit_mental_health/", "training/v1/stage3_stress_test/raw/reddit/"
    )
    process_prefix_migration(
        "archive/gdrive/raw/original_reddit_data/",
        "training/v1/stage3_stress_test/raw/reddit/original/",
    )

    # 3. Stage 3 - Edge Cases & DPO
    logger.info("\n--- Phase 8: Stage 3 Processed Data ---")
    process_prefix_migration(
        "archive/gdrive/processed/edge_cases/", "training/v1/stage3_stress_test/processed/"
    )

    # Specific file moves for edge cases if they exist in other folders
    mappings = {
        "archive/gdrive/processed/filtered_datasets/safety_dpo_pairs.jsonl": "training/v1/stage3_stress_test/processed/safety_dpo_pairs.jsonl",
        "archive/gdrive/processed/synthetic_conversations/reddit_mental_health_synthetic.json": "training/v1/stage3_stress_test/processed/reddit_synthetic.json",
    }
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        for old, new in mappings.items():
            executor.submit(move_s3_object, old, new)

    # 4. Final Cleanup of Empty Prefixes (Optional, but let's just make sure we moved the rest of datasets/)
    logger.info("\n--- Phase 9: Archiving Remaining Source Tiers ---")
    for source in ["datasets/local_sync/", "datasets/vps_archaeology/"]:
        process_prefix_migration(source, source.replace("datasets/", "archive/", 1))

    logger.info("\nFinal Reorganization Cleanup Complete!")


if __name__ == "__main__":
    finalize_reorganization()
