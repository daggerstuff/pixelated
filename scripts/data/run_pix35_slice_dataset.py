#!/usr/bin/env python3
"""
PIX-35: Stage-Based Dataset Slicing — CLI Entry Point.

Splits normalized/deduped JSONL data into stage-specific training slices:
  - stage1_foundation: Core psychology knowledge, standard therapeutic conversations
  - stage2_therapeutic_expertise: Specialized therapeutic expertise
  - stage3_edge_stress_test: Edge cases, adversarial inputs
  - stage4_voice_persona: Voice persona, dual persona training
  - supplementary: Everything else

Usage:
    PIX35_FILES=data/normalized/*.jsonl uv run python scripts/data/run_pix35_slice_dataset.py
    PIX35_FILES=data/normalized/*.jsonl uv run python scripts/data/run_pix35_slice_dataset.py --output-dir data/sliced/ --target-stage1 1000 --target-stage2 500
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path

# Ensure project root is on sys.path for ai.core imports
ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ai.core.pipelines.processing.dataset_slicer import DatasetSlicer  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("pix35")


def main(args: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="PIX-35: Stage-Based Dataset Slicing.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    parser.add_argument(
        "--files",
        nargs="*",
        default=None,
        help="Input normalized JSONL file(s) or directory path(s). "
        "Can also be set via PIX35_FILES env var (colon-separated).",
    )
    parser.add_argument(
        "--output-dir",
        "-o",
        default=None,
        help="Output directory for sliced files (default: sliced_output/).",
    )
    parser.add_argument(
        "--slice-id",
        default=None,
        help="Unique slice identifier (auto-generated if not provided).",
    )
    parser.add_argument(
        "--target-stage1",
        type=int,
        default=0,
        help="Target sample count for stage1_foundation (0 = unlimited).",
    )
    parser.add_argument(
        "--target-stage2",
        type=int,
        default=0,
        help="Target sample count for stage2_therapeutic_expertise (0 = unlimited).",
    )
    parser.add_argument(
        "--target-stage3",
        type=int,
        default=0,
        help="Target sample count for stage3_edge_stress_test (0 = unlimited).",
    )
    parser.add_argument(
        "--target-stage4",
        type=int,
        default=0,
        help="Target sample count for stage4_voice_persona (0 = unlimited).",
    )
    parser.add_argument(
        "--enforce-targets",
        action="store_true",
        help="Cap each stage at its target count. Excess goes to supplementary.",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable debug logging.",
    )

    ns = parser.parse_args(args or [])

    # Resolve input files: --files arg > PIX35_FILES env var
    input_files = ns.files
    if not input_files:
        env_files = os.environ.get("PIX35_FILES", "")
        if env_files:
            input_files = env_files.split(":")
        else:
            parser.error(
                "No input files specified. Use --files or set PIX35_FILES env var "
                "(colon-separated paths)."
            )

    if ns.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Build stage targets
    stage_targets: dict[str, int] = {}
    if ns.target_stage1 > 0:
        stage_targets["stage1_foundation"] = ns.target_stage1
    if ns.target_stage2 > 0:
        stage_targets["stage2_therapeutic_expertise"] = ns.target_stage2
    if ns.target_stage3 > 0:
        stage_targets["stage3_edge_stress_test"] = ns.target_stage3
    if ns.target_stage4 > 0:
        stage_targets["stage4_voice_persona"] = ns.target_stage4

    logger.info("PIX-35 Dataset Slicer starting")
    logger.info("  Input files:     %s", input_files)
    logger.info("  Output dir:      %s", ns.output_dir or "sliced_output/")
    logger.info("  Stage targets:   %s", stage_targets or "unlimited")
    logger.info("  Enforce targets: %s", ns.enforce_targets)

    slicer = DatasetSlicer(
        stage_targets=stage_targets,
        enforce_targets=ns.enforce_targets,
        output_dir=ns.output_dir,
    )

    try:
        result = slicer.slice(
            input_paths=list(input_files),
            slice_id=ns.slice_id,
        )
    except Exception as exc:
        logger.error("Slicing failed: %s", exc, exc_info=True)
        return 1

    # Print summary to stdout for CLI visibility
    sys.stdout.write(f"\n{result.summary()}\n\n")

    # Exit with error if no records sliced
    if result.manifest.total_records == 0:
        logger.error("No records found in input files")
        return 2

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
