#!/usr/bin/env python3
"""
S3 Fixup V2
Moves edge case datasets from datasets/consolidated/edge_cases/ to Stage 3.
"""

import logging
import os
from pathlib import Path

import boto3
import urllib3
from botocore.config import Config
from botocore.exceptions import ClientError
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("s3_fixup")

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
env_path = Path(__file__).parents[2] / "ai" / ".env"
load_dotenv(env_path)

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
        # Check if source exists
        try:
            s3.head_object(Bucket=BUCKET, Key=old)
        except ClientError:
            logger.warning(f"  [SKIP] Source not found: {old}")
            return

        s3.copy_object(CopySource={"Bucket": BUCKET, "Key": old}, Bucket=BUCKET, Key=new)
        s3.delete_object(Bucket=BUCKET, Key=old)
        logger.info(f"  [OK] {old} -> {new}")
    except Exception as e:
        logger.error(f"  [FAIL] {old}: {e}")


def fix():
    logger.info("--- S3 Fixup V2 ---")

    # 1. Edge Case Prompts -> Scenario Bank
    move(
        "datasets/consolidated/edge_cases/edge_case_output/edge_case_prompts.jsonl",
        "training/v1/stage3_stress_test/raw/prompt_corpus/scenario_bank.jsonl",
    )

    # 2. Priority Edge Cases -> Synthetic
    # Note: 'synthetic.jsonl' might already exist or be targeted by registry.
    # Registry now points 'edge_case_generator' to 'processed/synthetic.jsonl'.
    move(
        "datasets/consolidated/edge_cases/edge_case_output/priority_edge_cases_nvidia.jsonl",
        "training/v1/stage3_stress_test/processed/synthetic.jsonl",
    )

    logger.info("--- Fixup V2 Complete ---")


if __name__ == "__main__":
    fix()
