#!/usr/bin/env python3
"""Verify Stage 2 persona artifact exists in OVH S3. Loads .env only; prints S3_VERIFY_OK or S3_VERIFY_MISSING."""
import os
from pathlib import Path

from boto3 import Session
from botocore.config import Config
from botocore.exceptions import ClientError
from dotenv import load_dotenv

# Repo root: script lives in scripts/
_repo_root = Path(__file__).resolve().parent.parent
load_dotenv(_repo_root / ".env")

BUCKET = "pixel-data"
ENDPOINT = "https://s3.us-east-va.io.cloud.ovh.us"
REGION = "us-east-va"
KEY = "final_dataset/shards/curriculum/stage2/synthetic_persona_batch_10000.jsonl"

def main() -> None:
    ak = os.environ.get("OVH_S3_ACCESS_KEY")
    sk = os.environ.get("OVH_S3_SECRET_KEY")
    if not ak or not sk:
        print("S3_VERIFY_MISSING")
        return
    session = Session(aws_access_key_id=ak, aws_secret_access_key=sk)
    client = session.client(
        "s3",
        endpoint_url=ENDPOINT,
        region_name=REGION,
        config=Config(signature_version="s3v4"),
    )
    try:
        client.head_object(Bucket=BUCKET, Key=KEY)
        print("S3_VERIFY_OK")
    except (ClientError, Exception):
        print("S3_VERIFY_MISSING")

if __name__ == "__main__":
    main()
