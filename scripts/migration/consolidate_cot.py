#!/usr/bin/env python3
"""
CoT Consolidation Script
Merges individual CoT JSON datasets from S3 into a single JSONL file on S3.
"""

import json
import logging
import os
from pathlib import Path

import boto3
import urllib3
from botocore.config import Config
from dotenv import load_dotenv

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(message)s")

# Disable insecure request warnings
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


def consolidate_cot():
    s3 = get_s3_client()
    prefix = "training/v1/stage2_expertise/reasoning/"
    target_key = f"{prefix}cot_reasoning_consolidated.jsonl"

    logger.info(f"--- Consolidating CoT Reasoning Data into {target_key} ---")

    # List files in reasoning folder
    res = s3.list_objects_v2(Bucket=BUCKET, Prefix=prefix)
    if "Contents" not in res:
        logger.info("No files found in reasoning folder.")
        return

    consolidated_data = []

    for obj in res["Contents"]:
        key = obj["Key"]
        if key == target_key or not key.endswith(".json"):
            continue

        logger.info(f"Processing: {key}")
        try:
            resp = s3.get_object(Bucket=BUCKET, Key=key)
            data = json.loads(resp["Body"].read())

            # Handle different formats (list or dict with 'conversations')
            items = []
            if isinstance(data, list):
                items = data
            elif isinstance(data, dict):
                # Try to find a list in the dict
                for _, v in data.items():
                    if isinstance(v, list):
                        items = v
                        break

            for item in items:
                # Ensure it's a dict
                if isinstance(item, dict):
                    # Add source metadata
                    item["_source"] = os.path.basename(key)
                    consolidated_data.append(item)

        except Exception as e:
            logger.error(f"  [ERROR] Failed to process {key}: {e}")

    if not consolidated_data:
        logger.warning("No data items found to consolidate.")
        return

    logger.info(f"Total items collected: {len(consolidated_data)}")

    # Upload as JSONL
    logger.info("Uploading to S3...")
    jsonl_content = ""
    for item in consolidated_data:
        jsonl_content += json.dumps(item) + "\n"

    s3.put_object(Bucket=BUCKET, Key=target_key, Body=jsonl_content.encode("utf-8"))
    logger.info("✅ Consolidation Complete!")


if __name__ == "__main__":
    consolidate_cot()
