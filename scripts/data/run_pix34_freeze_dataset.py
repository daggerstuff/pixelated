#!/usr/bin/env python3
"""
PIX-34: Freeze v1 Training Slice — CLI Entry Point.

Creates a versioned dataset snapshot from sliced stage files with:
  - Exact source counts per stage
  - Quality score distributions
  - License distribution
  - Rejection reason summary
  - Full manifest for training pipeline consumption

Usage:
    uv run python scripts/data/run_pix34_freeze_dataset.py --slice-dir data/sliced/
    uv run python scripts/data/run_pix34_freeze_dataset.py --slice-dir data/sliced/ --version v1 --output-dir frozen_datasets/
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

# Ensure project root is on sys.path for ai.core imports
ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ai.core.pipelines.processing.dataset_freezer import DatasetFreezer  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("pix34")


def main(args: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="PIX-34: Freeze v1 Training Slice.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    parser.add_argument(
        "--slice-dir",
        required=True,
        help="Directory containing sliced stage JSONL files and slice_manifest.json.",
    )
    parser.add_argument(
        "--version",
        "-v",
        default=None,
        help="Version string (e.g., v1). Auto-generated if not provided.",
    )
    parser.add_argument(
        "--output-dir",
        "-o",
        default=None,
        help="Output directory for frozen snapshots (default: frozen_datasets/).",
    )
    parser.add_argument(
        "--slice-id",
        default=None,
        help="Source slice identifier (auto-detected from slice_manifest.json).",
    )
    parser.add_argument(
        "--rejection-report",
        default=None,
        help="Path to rejection report JSON from PIX-32 pipeline.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable debug logging.",
    )

    ns = parser.parse_args(args or [])

    if ns.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    logger.info("PIX-34 Dataset Freezer starting")
    logger.info("  Slice dir:      %s", ns.slice_dir)
    logger.info("  Version:        %s", ns.version or "auto-generated")
    logger.info("  Output dir:     %s", ns.output_dir or "frozen_datasets/")
    logger.info("  Slice ID:       %s", ns.slice_id or "auto-detected")

    freezer = DatasetFreezer(
        version=ns.version,
        output_dir=ns.output_dir,
    )

    try:
        result = freezer.freeze(
            slice_dir=ns.slice_dir,
            slice_id=ns.slice_id,
            rejection_report=ns.rejection_report,
        )
    except Exception as exc:
        logger.error("Freeze failed: %s", exc, exc_info=True)
        return 1

    # Print summary to stdout for CLI visibility
    sys.stdout.write(f"\n{result.summary()}\n\n")

    # Exit with error if no records frozen
    if result.manifest.total_records == 0:
        logger.error("No records found in slice directory")
        return 2

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
