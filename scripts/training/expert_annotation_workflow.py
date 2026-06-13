#!/usr/bin/env python3
"""Expert annotation workflow for borderline training samples (PIX-3749).

Identifies borderline-quality samples from a dataset, exports them in a
reviewable format, and provides a lightweight CLI for expert annotation.

A "borderline" sample has a clinical validity score in the review zone
(default: 0.35--0.65), indicating ambiguous quality that benefits from
human expert review.

Usage:
    python scripts/training/expert_annotation_workflow.py \
        --dataset ai/training/data/synthetic_deduped/shard_0000.jsonl \
        --output_dir ai/training/expert_reviews/ \
        --review-zone 0.35 0.65
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "ai"))

from training.clinical_validity_scorer import ClinicalValidityScorer

logger = logging.getLogger("expert_annotation")

DEFAULT_REVIEW_ZONE = (0.35, 0.65)
MAX_SAMPLES_PER_SESSION = 100


def _score_sample(sample: dict) -> tuple[float, dict]:
    response = sample.get("chosen", sample.get("output", ""))
    if not response:
        return 0.0, {}
    score = ClinicalValidityScorer.score(response)
    detail = ClinicalValidityScorer.score_detail(response)
    return score, detail


def extract_borderline_samples(
    dataset_path: Path,
    review_zone: tuple[float, float],
    max_samples: int = MAX_SAMPLES_PER_SESSION,
) -> list[dict]:
    """Extract samples within the review zone from a dataset."""
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset not found: {dataset_path}")

    lower, upper = review_zone
    borderline: list[dict] = []

    with open(dataset_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                sample = json.loads(line)
            except json.JSONDecodeError:
                continue
            score, detail = _score_sample(sample)
            if lower <= score <= upper:
                sample["__clinical_validity_score"] = round(score, 3)
                sample["__clinical_validity_detail"] = detail
                borderline.append(sample)
            if len(borderline) >= max_samples:
                break

    return borderline


def export_review_package(
    samples: list[dict],
    output_dir: Path,
    dataset_name: str,
    review_zone: tuple[float, float],
) -> Path:
    """Export borderline samples as a review package."""
    output_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    review_file = output_dir / f"review_{dataset_name}_{timestamp}.jsonl"

    package = {
        "meta": {
            "generated_at": datetime.now(UTC).isoformat(),
            "dataset_path": str(dataset_name),
            "review_zone": list(review_zone),
            "sample_count": len(samples),
            "description": (
                "Borderline samples for expert review. Each sample includes "
                "clinical validity score and per-dimension breakdown. "
                "Experts should review and set review_status to 'approved', "
                "'rejected', or 'needs_revision' and add review_notes."
            ),
        },
        "samples": samples,
    }

    with open(review_file, "w", encoding="utf-8") as f:
        json.dump(package, f, indent=2)
        f.write("\n")

    logger.info("Exported %d samples to %s", len(samples), review_file)
    return review_file


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Expert annotation workflow for borderline training samples",
    )
    parser.add_argument(
        "--dataset",
        type=Path,
        required=True,
        help="Path to the dataset JSONL file to review",
    )
    parser.add_argument(
        "--output_dir",
        type=Path,
        default=Path("ai/training/expert_reviews"),
        help="Directory for review packages",
    )
    parser.add_argument(
        "--review-zone",
        type=float,
        nargs=2,
        default=DEFAULT_REVIEW_ZONE,
        help="Clinical validity score review zone (lower upper)",
    )
    parser.add_argument(
        "--max-samples",
        type=int,
        default=MAX_SAMPLES_PER_SESSION,
        help="Maximum samples to include per review package",
    )
    return parser


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    parser = build_parser()
    args = parser.parse_args()

    logger.info(
        "Extracting borderline samples from %s (review zone: %s--%s)",
        args.dataset,
        args.review_zone[0],
        args.review_zone[1],
    )

    borderline = extract_borderline_samples(
        args.dataset,
        tuple(args.review_zone),
        args.max_samples,
    )

    if not borderline:
        logger.warning("No borderline samples found in review zone.")
        sys.exit(0)

    review_file = export_review_package(
        borderline,
        args.output_dir,
        args.dataset.stem,
        tuple(args.review_zone),
    )

    logger.info("Review package ready: %s", review_file)
    logger.info(
        "Next step: share %s with clinical experts for annotation.",
        review_file,
    )


if __name__ == "__main__":
    main()
