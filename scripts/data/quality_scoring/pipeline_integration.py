#!/usr/bin/env python3
"""
Pipeline Integration for Quality Scoring

Helper functions for integrating quality scoring into the dataset pipeline.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from .scoring_interface import compose_score, compute_signals

logger = logging.getLogger(__name__)


def score_conversation_text(
    text: str,
    weights: dict[str, float] | None = None,
    thresholds: dict[str, float] | None = None,
) -> dict[str, Any]:
    """
    Score a single conversation text.

    Args:
        text: Conversation text to score
        weights: Optional custom weights (defaults from config)
        thresholds: Optional custom thresholds (defaults from config)

    Returns:
        Dictionary with signals, composite, and decision
    """
    if weights is None:
        weights = {"empathy": 0.25, "fidelity": 0.25, "domain": 0.25, "harm": 0.25}

    if thresholds is None:
        thresholds = {
            "harm_max": 0.05,
            "accept_min": 0.60,
            "curate_min": 0.45,
        }

    signals = compute_signals(text)
    result = compose_score(signals, weights, thresholds)

    return {
        "signals": {
            "empathy": signals.empathy,
            "fidelity": signals.fidelity,
            "domain": signals.domain,
            "harm": signals.harm,
        },
        "composite": result.composite,
        "decision": result.decision,
    }


def score_jsonl_file(
    input_path: Path | str,
    output_path: Path | str,
    config_path: Path | str | None = None,
) -> int:
    """
    Score all entries in a JSONL file.

    Args:
        input_path: Path to input JSONL file
        output_path: Path to output JSONL file
        config_path: Optional path to config file

    Returns:
        Number of items scored
    """
    input_path = Path(input_path)
    output_path = Path(output_path)

    # Load config
    weights = {"empathy": 0.25, "fidelity": 0.25, "domain": 0.25, "harm": 0.25}
    thresholds = {"harm_max": 0.05, "accept_min": 0.60, "curate_min": 0.45}

    if config_path:
        config_path = Path(config_path)
        if config_path.exists():
            with open(config_path) as f:
                config = json.load(f)
                weights = config.get("weights", weights)
                thresholds = config.get("thresholds", thresholds)

    scored_count = 0

    with (
        open(input_path, encoding="utf-8") as fin,
        open(output_path, "w", encoding="utf-8") as fout,
    ):
        for line in fin:
            line = line.strip()
            if not line:
                continue

            try:
                obj = json.loads(line)
                text = obj.get("text", "")
                item_id = obj.get("id", f"item_{scored_count}")

                if not text:
                    logger.warning(f"Skipping item {item_id}: no text field")
                    continue

                # Score the text
                score_result = score_conversation_text(text, weights, thresholds)

                # Write output
                output_obj = {
                    "id": item_id,
                    "signals": score_result["signals"],
                    "composite": score_result["composite"],
                    "decision": score_result["decision"],
                }

                # Include original fields if present
                if "metadata" in obj:
                    output_obj["metadata"] = obj["metadata"]

                fout.write(json.dumps(output_obj, ensure_ascii=False) + "\n")
                scored_count += 1

            except json.JSONDecodeError as e:
                logger.warning(f"Invalid JSON line: {e}")
                continue
            except Exception as e:
                logger.error(f"Error scoring item: {e}")
                continue

    logger.info(f"Scored {scored_count} items, output written to {output_path}")
    return scored_count


def filter_by_decision(
    input_path: Path | str,
    output_path: Path | str,
    decision: str = "accept",
) -> int:
    """
    Filter scored JSONL file by decision (accept/curate/reject).

    Args:
        input_path: Path to scored JSONL file
        output_path: Path to filtered output
        decision: Decision to filter by (accept, curate, or reject)

    Returns:
        Number of items in filtered output
    """
    input_path = Path(input_path)
    output_path = Path(output_path)

    count = 0

    with (
        open(input_path, encoding="utf-8") as fin,
        open(output_path, "w", encoding="utf-8") as fout,
    ):
        for line in fin:
            line = line.strip()
            if not line:
                continue

            try:
                obj = json.loads(line)
                if obj.get("decision") == decision:
                    fout.write(line + "\n")
                    count += 1
            except Exception as e:
                logger.warning(f"Error processing line: {e}")
                continue

    logger.info(
        f"Filtered {count} items with decision '{decision}', output written to {output_path}"
    )
    return count
