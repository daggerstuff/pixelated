import logging
import os

import boto3
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

load_dotenv(".env")


def check_objects():
    try:
        s3 = boto3.client(
            "s3",
            endpoint_url=os.getenv("OVH_S3_ENDPOINT"),
            aws_access_key_id=os.getenv("OVH_S3_ACCESS_KEY"),
            aws_secret_access_key=os.getenv("OVH_S3_SECRET_KEY"),
            region_name=os.getenv("OVH_S3_REGION"),
        )
        access_key = os.getenv("OVH_S3_ACCESS_KEY")
        masked_key = f"{access_key[:5]}...{access_key[-5:]}" if access_key else "None"
        logger.info(f"Using Access Key: {masked_key}")
        logger.info("Listing objects in pixel-data (root)...")
        resp = s3.list_objects_v2(Bucket="pixel-data", MaxKeys=5)
        if "Contents" in resp:
            for o in resp["Contents"]:
                logger.info(f" - {o['Key']}")
        else:
            logger.info(" - No contents in root (or permission denied for contents)")

        logger.info("\nListing 'datasets/' prefix...")
        resp = s3.list_objects_v2(Bucket="pixel-data", Prefix="datasets/", MaxKeys=5)
        targets = [
            "datasets/consolidated/datasets/professional_psychology_filtered.json",
            "datasets/consolidated/datasets/professional_neuro_filtered.json",
            "datasets/consolidated/datasets/professional_soulchat_filtered.json",
            "datasets/consolidated/datasets/cot_reasoning_filtered.json",
            "datasets/consolidated/datasets/reddit_mental_health_filtered.json",
            "datasets/consolidated/datasets/research_datasets_filtered.json",
            "datasets/consolidated/datasets/priority_1_FINAL.jsonl",
        ]

        logger.info("\nChecking specific targets...")
        for t in targets:
            try:
                head = s3.head_object(Bucket="pixel-data", Key=t)
                logger.info(f" - {t}: {head['ContentLength']} bytes")
            except Exception as e:
                logger.error(f" - {t}: MISSING/ERROR ({e})")

    except Exception as e:
        logger.error(f"Failed: {e}")


if __name__ == "__main__":
    check_objects()
