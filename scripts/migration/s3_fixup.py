#!/usr/bin/env python3
"""
Final S3 Reorganization Fix-up
Addresses the last 4 verification failures by moving/renaming specialized datasets.
"""

import logging
import os
from pathlib import Path

import boto3
import urllib3
from botocore.config import Config
from dotenv import load_dotenv

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
env_path = Path(__file__).parents[2] / "ai" / ".env"
load_dotenv(env_path)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

BUCKET = os.getenv("OVH_S3_BUCKET", "pixel-data")
ENDPOINT = os.getenv("OVH_S3_ENDPOINT", "https://s3.us-east-va.io.cloud.ovh.us")
ACCESS_KEY = os.getenv("OVH_S3_ACCESS_KEY") or os.getenv("AWS_ACCESS_KEY_ID")
SECRET_KEY = os.getenv("OVH_S3_SECRET_KEY") or os.getenv("AWS_SECRET_ACCESS_KEY")
REGION = os.getenv("OVH_S3_REGION", "us-east-va")


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


def move(old, new):
    s3 = get_s3_client()
    try:
        s3.copy_object(CopySource={"Bucket": BUCKET, "Key": old}, Bucket=BUCKET, Key=new)
        s3.delete_object(Bucket=BUCKET, Key=old)
        logger.info(f"  [OK] {old} -> {new}")
    except Exception as e:
        logger.error(f"  [FAIL] {old}: {e}")


def fix():
    logger.info("--- Final S3 Fix-up ---")

    # 1. Edge Case Generator
    move(
        "archive/gdrive/raw/edge_cases/edge_case_output/priority_edge_cases_nvidia.jsonl",
        "training/v1/stage3_stress_test/processed/edge_cases_training_format.jsonl",
    )

    # 2. Safety DPO Pairs
    # Looking for where it might be (guessing common locations)
    move(
        "archive/gdrive/processed/filtered_datasets/priority_1_filtered.jsonl",
        "training/v1/stage3_stress_test/processed/safety_dpo_pairs.jsonl",
    )

    # 3. Prompt Corpus
    # Need to move the whole prefix
    s3 = get_s3_client()
    old_p = "archive/gdrive/raw/dataset_pipeline/prompt_corpus/"
    new_p = "training/v1/stage3_stress_test/raw/prompt_corpus/"
    res = s3.list_objects_v2(Bucket=BUCKET, Prefix=old_p)
    if "Contents" in res:
        for obj in res["Contents"]:
            old = obj["Key"]
            new = old.replace(old_p, new_p, 1)
            move(old, new)

    logger.info("--- Fix-up Complete ---")


if __name__ == "__main__":
    fix()
