import json
import logging
import os
import sys

# Configure logging to mimic print behavior but satisfy linter
logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# Add workspace root to sys.path
sys.path.insert(0, "/home/vivi/pixelated")

from ai.training.ready_packages.utils.s3_dataset_loader import (  # noqa: E402
    S3DatasetLoader,
)


def peek_s3():
    bucket = os.getenv("OVH_S3_BUCKET", "pixel-data")
    endpoint = os.getenv("OVH_S3_ENDPOINT", "https://s3.us-east-va.io.cloud.ovh.us")

    loader = S3DatasetLoader(bucket=bucket, endpoint_url=endpoint)
    s3_path = "s3://pixel-data/datasets/consolidated/datasets/cot_reasoning_filtered.json"

    logger.info(f"Peeking into {s3_path}...")
    try:
        raw = loader.load_text(s3_path)
        data = json.loads(raw)
        if isinstance(data, list):
            logger.info(f"List of {len(data)} items.")
            logger.info(json.dumps(data[0], indent=2)[:1000])
        elif isinstance(data, dict):
            logger.info(f"Dict with keys: {list(data.keys())}")
            for k, v in data.items():
                if isinstance(v, list):
                    logger.info(f"Key '{k}' is a list of {len(v)} items.")
                    if len(v) > 0:
                        logger.info(json.dumps(v[0], indent=2)[:1000])
                    break
    except Exception as e:
        logger.error(f"Error: {e}")


if __name__ == "__main__":
    peek_s3()
