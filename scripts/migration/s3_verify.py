#!/usr/bin/env python3
"""
S3 Verification Script
Checks if all datasets in the registry exist on S3 at their canonical paths.
"""

import json
import logging
import os
from pathlib import Path
from typing import Any

import boto3
import urllib3
from botocore.config import Config
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

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
    """Create and return an S3 client."""
    config = Config(region_name=REGION)
    return boto3.client(
        "s3",
        endpoint_url=ENDPOINT,
        aws_access_key_id=ACCESS_KEY,
        aws_secret_access_key=SECRET_KEY,
        config=config,
        verify=False,
    )


def check_s3_path(s3, path: str) -> bool:
    """Check if a path or prefix exists on S3."""
    if not path.startswith("s3://"):
        return False

    bucket_key = path.replace(f"s3://{BUCKET}/", "")
    try:
        s3.head_object(Bucket=BUCKET, Key=bucket_key)
        return True
    except Exception:
        # Could be a directory prefix
        try:
            res = s3.list_objects_v2(Bucket=BUCKET, Prefix=bucket_key, MaxKeys=1)
            return "Contents" in res
        except Exception:
            return False


def verify_datasets(s3, datasets: dict[str, Any]) -> tuple[int, int]:
    """Verify standard datasets in the registry."""
    checked = 0
    errors = 0
    for dept_name, dept_data in datasets.items():
        logger.info("Checking Department: %s", dept_name)
        for ds_name, ds_info in dept_data.items():
            path = ds_info.get("path", "")
            if path.startswith("s3://"):
                checked += 1
                if check_s3_path(s3, path):
                    logger.info("  [PASS] %s", ds_name)
                else:
                    logger.error("  [FAIL] %s NOT FOUND at %s", ds_name, path)
                    errors += 1
    return checked, errors


def verify_edge_cases(s3, edge_cases: dict[str, Any]) -> tuple[int, int]:
    """Verify edge case sources in the registry."""
    checked = 0
    errors = 0
    for cat_name, cat_data in edge_cases.items():
        logger.info("Checking Edge Category: %s", cat_name)
        if isinstance(cat_data, dict) and "path" in cat_data:
            path = cat_data["path"]
            if path.startswith("s3://"):
                checked += 1
                if check_s3_path(s3, path):
                    logger.info("  [PASS] %s", cat_name)
                else:
                    logger.error("  [FAIL] %s NOT FOUND at %s", cat_name, path)
                    errors += 1
        elif isinstance(cat_data, dict):
            # Nested structure
            for ds_name, ds_info in cat_data.items():
                if isinstance(ds_info, dict) and "path" in ds_info:
                    path = ds_info["path"]
                    if path.startswith("s3://"):
                        checked += 1
                        if check_s3_path(s3, path):
                            logger.info("  [PASS] %s", ds_name)
                        else:
                            logger.error("  [FAIL] %s NOT FOUND at %s", ds_name, path)
                            errors += 1
    return checked, errors


def verify_structure():
    """Main verification logic."""
    registry_path = Path(__file__).parents[2] / "ai" / "data" / "dataset_registry.json"
    with open(registry_path, encoding="utf-8") as f:
        registry = json.load(f)

    s3 = get_s3_client()

    logger.info("--- Verifying S3 Reorganization for Bucket: %s ---\n", BUCKET)

    checked_ds, errors_ds = verify_datasets(s3, registry.get("datasets", {}))
    checked_edge, errors_edge = verify_edge_cases(s3, registry.get("edge_case_sources", {}))

    checked = checked_ds + checked_edge
    errors = errors_ds + errors_edge

    logger.info("\n--- Verification Complete ---")
    logger.info("Total checked: %d", checked)
    logger.info("Errors found:  %d", errors)

    if errors == 0:
        logger.info("\n✅ Verification Successful! All datasets are in place.")
    else:
        logger.error("\n❌ Verification Failed! %d datasets are missing.", errors)


if __name__ == "__main__":
    verify_structure()
