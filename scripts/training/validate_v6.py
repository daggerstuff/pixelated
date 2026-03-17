#!/usr/bin/env python3
"""
Validation script for V6 training pipeline fixes.
Tests data loading, tokenization, and config without running full training.
"""

import json
import logging
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def _validate_item_structure(item: object) -> tuple[bool, str]:
    """Validate supported training sample formats."""
    if not isinstance(item, dict):
        return False, "Not a dict"

    is_valid = False
    reason = ""

    if "messages" in item:
        messages = item.get("messages", [])
        if isinstance(messages, list) and len(messages) > 0:
            is_valid = True
        else:
            reason = "Invalid messages format"
    elif "text" in item or "conversations" in item or ("prompt" in item and "response" in item):
        is_valid = True
    else:
        reason = f"Missing required fields: {list(item.keys())}"

    return is_valid, reason


def _describe_item_format(index: int, item: object) -> str:
    """Build a human-readable format summary for sample items."""
    if not isinstance(item, dict):
        return f"     [{index}] {type(item).__name__}"

    if "messages" in item:
        msg_count = len(item.get("messages", []))
        return f"     [{index}] messages format ({msg_count} messages)"

    if "text" in item:
        return f"     [{index}] text format ({len(item['text'])} chars)"

    if "conversations" in item:
        conv_count = len(item.get("conversations", []))
        return f"     [{index}] conversations format ({conv_count} turns)"

    return f"     [{index}] {list(item.keys())}"


def test_config_loading():
    """Test that config loads correctly"""
    config_path = Path("ai/config/training_config_v2_antirepetition.json")

    if not config_path.exists():
        logger.error(f"❌ Config not found: {config_path}")
        return False

    try:
        with open(config_path) as f:
            config = json.load(f)
        logger.info("✅ Config loaded successfully")
        logger.info(f"   - Base model: {config['model']['base_model']}")
        logger.info(f"   - LoRA r={config['lora']['r']}, alpha={config['lora']['lora_alpha']}")
        logger.info(f"   - Learning rate: {config['training']['learning_rate']}")
        return True
    except Exception as e:
        logger.error(f"❌ Config loading failed: {e}")
        return False


def test_data_file_exists():
    """Test that training data file exists"""
    data_file = Path(
        "ai/training/ready_packages/datasets/cache/training_v3_converted/stage1_foundation_counseling.jsonl"
    )

    if not data_file.exists():
        logger.error(f"❌ Training data file not found: {data_file}")
        return False

    logger.info("✅ Training data file exists")
    return True


def test_data_format():
    """Test that training data is valid JSONL"""
    data_file = Path(
        "ai/training/ready_packages/datasets/cache/training_v3_converted/stage1_foundation_counseling.jsonl"
    )

    try:
        samples = 0
        errors = 0
        sample_items: list[object] = []

        with open(data_file) as f:
            for line_num, line in enumerate(f, 1):
                if not line.strip():
                    continue
                try:
                    item = json.loads(line)
                    samples += 1

                    # Store first few examples
                    if len(sample_items) < 3:
                        sample_items.append(item)

                    is_valid, reason = _validate_item_structure(item)
                    if not is_valid:
                        errors += 1
                        if errors <= 3:
                            logger.warning(f"  ⚠️  Line {line_num}: {reason}")

                except json.JSONDecodeError as e:
                    errors += 1
                    if errors <= 3:
                        logger.warning(f"  ⚠️  Line {line_num}: {e}")

        if errors == 0:
            logger.info("✅ Training data format valid")
        else:
            logger.warning(f"⚠️  found {errors} format issues in {samples} samples")

        logger.info(f"   - Total samples: {samples}")
        logger.info("   - Sample data formats:")
        for i, item in enumerate(sample_items):
            logger.info(_describe_item_format(i, item))

        return errors == 0

    except Exception as e:
        logger.error(f"❌ Data format test failed: {e}")
        return False


def test_imports():
    """Test that required libraries are available"""
    required = [
        "torch",
        "transformers",
        "datasets",
        "peft",
        "accelerate",
    ]

    missing = []
    for lib in required:
        try:
            __import__(lib)
        except ImportError:
            missing.append(lib)

    if missing:
        logger.error(f"❌ Missing required libraries: {', '.join(missing)}")
        logger.info(f"   Install with: pip install {' '.join(missing)}")
        return False

    logger.info("✅ All required libraries available")
    return True


def main():
    logger.info("=" * 60)
    logger.info("V6 TRAINING PIPELINE VALIDATION")
    logger.info("=" * 60)

    tests = [
        ("Config Loading", test_config_loading),
        ("Data File Exists", test_data_file_exists),
        ("Data Format Valid", test_data_format),
        ("Required Libraries", test_imports),
    ]

    results = []
    for test_name, test_func in tests:
        logger.info(f"\n[Test] {test_name}")
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            logger.error(f"❌ Test failed with exception: {e}")
            results.append((test_name, False))

    # Summary
    logger.info("\n" + "=" * 60)
    logger.info("VALIDATION SUMMARY")
    logger.info("=" * 60)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        logger.info(f"{status}: {test_name}")

    logger.info("=" * 60)
    logger.info(f"Result: {passed}/{total} tests passed")

    if passed == total:
        logger.info("✅ All validation tests passed!")
        logger.info("\nYou can now proceed with training:")
        logger.info("  Kaggle: scripts/training/train_kaggle_qlora.py")
        logger.info("  Modal:  modal run scripts/training/train_modal_v2.py")
    else:
        logger.error("❌ Some tests failed. Please fix issues before training.")

    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
