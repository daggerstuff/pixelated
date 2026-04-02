#!/usr/bin/env python3
"""
PIX-32: Normalize and Deduplicate Ingested Data — CLI Entry Point.

Processes JSONL files through the full PIX-32 pipeline:
  1. Schema validation (PIX-30 canonical JSONL schema)
  2. Text normalization (unicode NFKC, whitespace cleanup)
  3. Key standardization (lower_snake_case)
  4. Deduplication (BloomFilter, similarity, or stage-aware)
  5. Provenance metadata attachment
  6. Output to normalized JSONL with rejection report

Usage:
    PIX32_FILES=data/raw/*.jsonl uv run python scripts/data/run_pix32_normalize_dedup.py
    PIX32_FILES=data/raw/ uv run python scripts/data/run_pix32_normalize_dedup.py --output data/normalized/output.jsonl
    PIX32_FILES=data/raw/ uv run python scripts/data/run_pix32_normalize_dedup.py --dedup stage_aware --enforce-license
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

from ai.core.pipelines.processing.normalization_pipeline import (  # noqa: E402
    DedupStrategy,
    NormalizationPipeline,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("pix32")


def _progress_callback(current: int, total: int) -> None:
    """Simple progress reporter."""
    pct = (current / total * 100) if total > 0 else 0
    logger.info("Progress: %d/%d (%.1f%%)", current, total, pct)


def main(args: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="PIX-32: Normalize and deduplicate ingested JSONL data.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    parser.add_argument(
        "--files",
        nargs="*",
        default=None,
        help="Input JSONL file(s) or directory path(s). Supports glob patterns. "
        "Can also be set via PIX32_FILES env var (colon-separated).",
    )
    parser.add_argument(
        "--output",
        "-o",
        default=None,
        help="Output JSONL file path (default: output_normalized.jsonl).",
    )
    parser.add_argument(
        "--reject-path",
        "-r",
        default=None,
        help="Rejected records JSONL file path (default: output_rejected.jsonl).",
    )
    parser.add_argument(
        "--dedup",
        "-d",
        choices=["none", "bloom", "similarity", "stage_aware"],
        default="similarity",
        help="Deduplication strategy (default: similarity).",
    )
    parser.add_argument(
        "--similarity-threshold",
        type=float,
        default=0.85,
        help="Similarity threshold for dedup (default: 0.85).",
    )
    parser.add_argument(
        "--enforce-license",
        action="store_true",
        help="Reject records without a license field.",
    )
    parser.add_argument(
        "--enforce-phi-scan",
        action="store_true",
        help="Reject records without phi_scan_passed field.",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable debug logging.",
    )

    ns = parser.parse_args(args or [])

    # Resolve input files: --files arg > PIX32_FILES env var
    input_files = ns.files
    if not input_files:
        env_files = os.environ.get("PIX32_FILES", "")
        if env_files:
            input_files = env_files.split(":")
        else:
            parser.error(
                "No input files specified. Use --files or set PIX32_FILES env var "
                "(colon-separated paths)."
            )

    if ns.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    strategy = DedupStrategy(ns.dedup)

    logger.info("PIX-32 Pipeline starting")
    logger.info("  Input:       %s", input_files)
    logger.info("  Output:      %s", ns.output or "output_normalized.jsonl")
    logger.info("  Reject path: %s", ns.reject_path or "output_rejected.jsonl")
    logger.info("  Dedup:       %s", ns.dedup)
    logger.info("  Similarity:  %.2f", ns.similarity_threshold)
    logger.info("  Enforce license: %s", ns.enforce_license)
    logger.info("  Enforce PHI:   %s", ns.enforce_phi_scan)

    pipeline = NormalizationPipeline(
        dedup_strategy=strategy,
        similarity_threshold=ns.similarity_threshold,
        enforce_license=ns.enforce_license,
        enforce_phi_scan=ns.enforce_phi_scan,
        on_progress=_progress_callback,
    )

    try:
        result = pipeline.run(
            input_paths=list(input_files),
            output_path=ns.output,
            reject_path=ns.reject_path,
        )
    except Exception as exc:
        logger.error("Pipeline failed: %s", exc, exc_info=True)
        return 1

    # Print summary to stdout for CLI visibility
    sys.stdout.write(f"\n{result.summary()}\n\n")

    # Exit with error if no valid records produced
    if result.final_records == 0 and result.total_records > 0:
        logger.error("No valid records produced after normalization and deduplication")
        return 2

    # Exit with warning if rejection rate is high
    if result.total_records > 0:
        rejection_rate = result.rejected_records / result.total_records
        if rejection_rate > 0.5:
            logger.warning(
                "High rejection rate: %.1f%% (%d/%d records rejected)",
                rejection_rate * 100,
                result.rejected_records,
                result.total_records,
            )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
