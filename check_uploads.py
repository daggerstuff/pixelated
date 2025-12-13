import logging
import os

import boto3
from dotenv import load_dotenv

load_dotenv("ai/.env")

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=os.environ.get("OVH_S3_ENDPOINT"),
        aws_access_key_id=os.environ.get("OVH_S3_ACCESS_KEY"),
        aws_secret_access_key=os.environ.get("OVH_S3_SECRET_KEY"),
        region_name=os.environ.get("OVH_S3_REGION", "us-east-va"),
    )


def check_uploads():
    s3 = get_s3_client()
    bucket = "pixel-data"
    prefix = "datasets/gdrive/"

    logger.info(f"Checking s3://{bucket}/{prefix}...")

    paginator = s3.get_paginator("list_objects_v2")
    pages = paginator.paginate(Bucket=bucket, Prefix=prefix)

    total_size = 0
    file_count = 0
    large_files = []

    for page in pages:
        if "Contents" in page:
            for obj in page["Contents"]:
                file_count += 1
                size_mb = obj["Size"] / (1024 * 1024)
                total_size += size_mb

                # Track files > 100MB
                if size_mb > 100:
                    large_files.append((obj["Key"], size_mb))

    logger.info(f"Total Files: {file_count}")
    logger.info(f"Total Size: {total_size:.2f} MB")
    logger.info("\nLarge Files (>100MB) Uploaded:")
    for key, size in sorted(large_files, key=lambda x: x[1], reverse=True):
        logger.info(f" - {size:.1f} MB: {key}")


if __name__ == "__main__":
    check_uploads()
