#!/usr/bin/env python3
"""
Legacy normalize script — updated to use PIX-32 pipeline.

Previously imported non-existent modules (scripts.ingestion.connectors.pubmed,
scripts.ingestion.normalize.schema). Now delegates to the PIX-32
NormalizationPipeline for all normalization work.

Usage:
    uv run python scripts/data/run_normalize.py --input data/raw/*.jsonl
    uv run python scripts/data/run_normalize.py --input data/raw/ --output data/normalized/output.jsonl
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import argparse
import logging

from ai.core.pipelines.processing.normalization_pipeline import (
    DedupStrategy,
    NormalizationPipeline,
)


def main(args: list[str] | None = None) -> int:

    parser = argparse.ArgumentParser(
        description="Normalize ingested JSONL data (PIX-32 pipeline).",
    )
    parser.add_argument(
        "--input",
        "-i",
        nargs="+",
        required=True,
        help="Input JSONL file(s) or directory path(s).",
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
        help="Rejected records output path (default: output_rejected.jsonl).",
    )
    parser.add_argument(
        "--dedup",
        "-d",
        choices=["none", "bloom", "similarity", "stage_aware"],
        default="similarity",
        help="Deduplication strategy (default: similarity).",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable debug logging.",
    )

    ns = parser.parse_args(args or [])

    if ns.verbose:
        logging.basicConfig(level=logging.DEBUG)

    pipeline = NormalizationPipeline(
        dedup_strategy=DedupStrategy(ns.dedup),
    )

    result = pipeline.run(
        input_paths=ns.input,
        output_path=ns.output,
        reject_path=ns.reject_path,
    )

    if result.final_records == 0 and result.total_records > 0:
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
