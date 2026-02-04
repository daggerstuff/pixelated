#!/usr/bin/env python3
"""
S3 Loader Validation Test
Attempts to load a sample from 3 key datasets using S3DatasetLoader to ensure path resolution works.
"""

import logging
import sys
from pathlib import Path

# Add ai submodule to path
sys.path.append(str(Path(__file__).parents[2]))

from ai.utils.s3_dataset_loader import load_dataset_from_s3

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("s3_loader_test")


def attempt_load(name, stage=None, category=None):
    logger.info(f"Testing load: {name} (Stage: {stage})")
    try:
        data = load_dataset_from_s3(name, stage=stage, category=category)
        if isinstance(data, dict):
            keys = list(data.keys())
            logger.info(f"  [OK] Loaded dict with keys: {keys[:3]}...")
        elif isinstance(data, list):
            logger.info(f"  [OK] Loaded list with {len(data)} items.")
        return True
    except Exception as e:
        logger.error(f"  [FAIL] {e}")
        return False


def main():
    logger.info("--- Testing S3 Dataset Loader ---")

    # 1. Test Foundation (Professional)
    # CoT reasoning (Validation passes)
    attempt_load(
        "clinical_diagnosis_mental_health.json", stage="stage2_expertise", category="reasoning"
    )

    # Test Curated
    # 'priority_1_FINAL.jsonl' in 'curated'
    attempt_load("priority_1_FINAL.jsonl", stage="stage1_foundation", category="curated")

    # Test Edge Case
    # 'scenario_bank.jsonl' in 'raw/prompt_corpus'
    attempt_load("scenario_bank.jsonl", stage="stage3_stress_test", category="raw/prompt_corpus")


if __name__ == "__main__":
    main()
