#!/usr/bin/env python3
"""
DACT-04: Normalize and Deduplicate Ingested Data

Processes JSON array datasets through the PIX-32 pipeline:
1. Convert JSON arrays to JSONL format
2. Transform to canonical schema (messages, text, etc.)
3. Schema validation (PIX-30 canonical JSONL schema)
4. Text normalization (unicode NFKC, whitespace cleanup)
5. Key standardization (lower_snake_case)
6. Deduplication (stage-aware hash dedup)
7. Provenance metadata attachment
8. Output to normalized JSONL with rejection report

Usage:
    uv run python scripts/data/run_dact04_normalization.py --input ai/data/acquired_datasets/*.json --output ai/data/normalized/
"""

import argparse
import json
import logging
import hashlib
import sys
from pathlib import Path
from datetime import datetime, timezone

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("dact04")


def transform_record_to_canonical(record: dict, source_name: str) -> dict:
    """
    Transform source format to PIX-30 canonical schema.

    Source format: { "conversation": [{"role": "...", "content": "..."}], "metadata": {...} }
    Canonical: { "id", "source", "messages": [{"role": "...", "content": "..."}], "metadata": {...} }
    Note: Uses 'content' not 'text' because the Conversation dataclass expects 'content'
    and dedup hashing happens before normalization converts text->content.
    """
    # Handle conversation -> messages transformation
    messages = []
    if "conversation" in record:
        for msg in record["conversation"]:
            messages.append({
                "role": msg.get("role", "unknown"),
                "content": msg.get("content", "")  # Use 'content' to match Conversation dataclass
            })
    elif "messages" in record:
        # If messages already exist, ensure they use 'content' not 'text'
        for msg in record["messages"]:
            content_val = msg.get("content") or msg.get("text", "")
            messages.append({
                "role": msg.get("role", "unknown"),
                "content": content_val
            })

    # Get metadata
    metadata = record.get("metadata", {})
    if not isinstance(metadata, dict):
        metadata = {}

    # Build canonical record
    canonical = {
        "id": record.get("id") or metadata.get("original_id") or hashlib.sha256(
            json.dumps(record, sort_keys=True).encode()
        ).hexdigest(),
        "source": record.get("source") or metadata.get("source") or source_name,
        "messages": messages,
        "metadata": {
            **metadata,
            "topic_tags": metadata.get("topic_tags", []),
            "therapeutic_modality": metadata.get("therapeutic_modality", "unknown"),
            "quality_score": metadata.get("quality_score", 0.5),
        },
        "phi_scan_passed": False,
        "phi_scan_date": None,
        "pull_date": datetime.now(timezone.utc).isoformat(),
    }

    # Add optional fields if present
    if "license" in record:
        canonical["license"] = record["license"]
    if "content_type" in record:
        canonical["content_type"] = record["content_type"]
    else:
        canonical["content_type"] = "conversation"

    return canonical


def convert_json_to_jsonl(input_path: Path, output_path: Path, source_name: str) -> int:
    """Convert JSON array to canonical JSONL format."""
    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        data = [data]

    count = 0
    with open(output_path, "w", encoding="utf-8") as f:
        for record in data:
            canonical = transform_record_to_canonical(record, source_name)
            f.write(json.dumps(canonical, ensure_ascii=False) + "\n")
            count += 1

    logger.info(f"Converted {input_path} -> {output_path} ({count} records)")
    return count


def main(args: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="DACT-04: Normalize and deduplicate ingested JSON datasets.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--input", "-i",
        nargs="+",
        required=True,
        help="Input JSON file(s) or directory path(s).",
    )
    parser.add_argument(
        "--output", "-o",
        default="ai/data/normalized/",
        help="Output directory for normalized JSONL (default: ai/data/normalized/).",
    )
    parser.add_argument(
        "--dedup",
        choices=["none", "bloom", "similarity", "stage_aware"],
        default="stage_aware",
        help="Deduplication strategy (default: stage_aware).",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable debug logging.",
    )

    ns = parser.parse_args(args or sys.argv[1:])

    if ns.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Resolve input files
    input_files = []
    for p in ns.input:
        path = Path(p)
        if path.is_file() and path.suffix == ".json":
            input_files.append(path)
        elif path.is_dir():
            input_files.extend(sorted(path.glob("*.json")))
        else:
            logger.warning(f"Input path not found: {p}")

    if not input_files:
        parser.error("No valid input files found.")

    output_dir = Path(ns.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    logger.info(f"DACT-04 Pipeline starting")
    logger.info(f" Input: {[str(f) for f in input_files]}")
    logger.info(f" Output: {output_dir}")
    logger.info(f" Dedup: {ns.dedup}")

    # Process each file
    total_records = 0
    total_converted = 0

    for input_file in input_files:
        logger.info(f"Processing {input_file.name}...")

        # Convert JSON to canonical JSONL
        temp_jsonl = output_dir / f"{input_file.stem}.jsonl"
        count = convert_json_to_jsonl(input_file, temp_jsonl, input_file.stem)
        total_converted += count

        # Now run through PIX-32 normalization pipeline
        from ai.core.pipelines.processing.normalization_pipeline import (
            DedupStrategy,
            NormalizationPipeline,
        )

        pipeline = NormalizationPipeline(
            dedup_strategy=DedupStrategy(ns.dedup),
            enforce_phi_scan=False,  # Not all datasets have PHI scan yet
            enforce_license=False,
        )

        result = pipeline.run(
            input_paths=[str(temp_jsonl)],
            output_path=output_dir / f"{input_file.stem}_normalized.jsonl",
            reject_path=output_dir / f"{input_file.stem}_rejected.jsonl",
        )

        total_records += result.final_records

        logger.info(f"  Validated: {result.validated_records}")
        logger.info(f"  Rejected: {result.rejected_records}")
        logger.info(f"  Duplicates removed: {result.duplicates_removed}")
        logger.info(f"  Final records: {result.final_records}")

    # Generate summary report
    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "input_files": [str(f) for f in input_files],
        "output_dir": str(output_dir),
        "total_converted": total_converted,
        "total_final_records": total_records,
        "dedup_strategy": ns.dedup,
    }

    report_path = output_dir / "dact04_normalization_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    logger.info(f"\nDACT-04 Summary:")
    logger.info(f"  Total records converted: {total_converted}")
    logger.info(f"  Total final records: {total_records}")
    logger.info(f"  Report: {report_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
