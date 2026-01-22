import logging
import os

import boto3
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

load_dotenv(".env")


def check_creds():
    try:
        s3 = boto3.client(
            "s3",
            endpoint_url=os.getenv("OVH_S3_ENDPOINT"),
            aws_access_key_id=os.getenv("OVH_S3_ACCESS_KEY"),
            aws_secret_access_key=os.getenv("OVH_S3_SECRET_KEY"),
            region_name=os.getenv("OVH_S3_REGION"),
        )
        logger.info("Listing buckets...")
        resp = s3.list_buckets()
        for b in resp["Buckets"]:
            logger.info(f" - {b['Name']}")
    except Exception as e:
        logger.error(f"Failed to list buckets: {e}")


if __name__ == "__main__":
    check_creds()
