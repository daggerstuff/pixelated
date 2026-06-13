#!/usr/bin/env python3
"""Prometheus metrics exporter for clinical validity data (PIX-3750).

Reads "eval_report.json" from the mental health evaluation suite and
writes Prometheus text exposition format metrics to a file that can be
scraped by the Node Exporter textfile collector or a custom Prometheus job.

Usage:
    python scripts/training/export_clinical_validity_metrics.py \
        --eval-report ai/training/data/eval_report.json \
        --output-file /var/lib/prometheus/node-exporter/clinical_validity.prom
"""

from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path

logger = logging.getLogger("clinical_validity_metrics")

METRIC_PREFIX = "clinical_validity"


def load_eval_report(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def emit_metrics(report: dict, output_path: Path) -> None:
    metrics = report.get("metrics", {})
    dataset = report.get("eval_dataset", "unknown")
    checkpoint = report.get("checkpoint", "unknown")
    labels = f'dataset="{dataset}",checkpoint="{checkpoint}"'

    lines: list[str] = []
    lines.append(f"# HELP {METRIC_PREFIX}_pass_rate Clinical validity pass rate (score >= 0.5).")
    lines.append(f"# TYPE {METRIC_PREFIX}_pass_rate gauge")
    lines.append(f"{METRIC_PREFIX}_pass_rate{{{labels}}} {metrics.get('clinical_validity_pass_rate', 0)}")

    lines.append(f"# HELP {METRIC_PREFIX}_mean Mean clinical validity score.")
    lines.append(f"# TYPE {METRIC_PREFIX}_mean gauge")
    lines.append(f"{METRIC_PREFIX}_mean{{{labels}}} {metrics.get('clinical_validity_mean', 0)}")

    lines.append(f"# HELP {METRIC_PREFIX}_total_samples Total number of evaluated samples.")
    lines.append(f"# TYPE {METRIC_PREFIX}_total_samples gauge")
    lines.append(f"{METRIC_PREFIX}_total_samples{{{labels}}} {metrics.get('total_samples', 0)}")

    lines.append(f"# HELP {METRIC_PREFIX}_crisis_citation_rate Crisis resource citation rate.")
    lines.append(f"# TYPE {METRIC_PREFIX}_crisis_citation_rate gauge")
    lines.append(f"{METRIC_PREFIX}_crisis_citation_rate{{{labels}}} {metrics.get('crisis_citation_rate', 0)}")

    lines.append(
        f"# HELP {METRIC_PREFIX}_safety_failure_count Safety failure count (crisis prompts without resources)."
    )
    lines.append(f"# TYPE {METRIC_PREFIX}_safety_failure_count gauge")
    lines.append(f"{METRIC_PREFIX}_safety_failure_count{{{labels}}} {metrics.get('safety_failure_count', 0)}")

    lines.append(f"# HELP {METRIC_PREFIX}_response_length_mean Mean response length (words).")
    lines.append(f"# TYPE {METRIC_PREFIX}_response_length_mean gauge")
    lines.append(f"{METRIC_PREFIX}_response_length_mean{{{labels}}} {metrics.get('response_length_mean', 0)}")

    lines.append(f"# HELP {METRIC_PREFIX}_response_length_p50 Median response length (words).")
    lines.append(f"# TYPE {METRIC_PREFIX}_response_length_p50 gauge")
    lines.append(f"{METRIC_PREFIX}_response_length_p50{{{labels}}} {metrics.get('response_length_p50', 0)}")

    lines.append(f"# HELP {METRIC_PREFIX}_response_length_p95 95th percentile response length (words).")
    lines.append(f"# TYPE {METRIC_PREFIX}_response_length_p95 gauge")
    lines.append(f"{METRIC_PREFIX}_response_length_p95{{{labels}}} {metrics.get('response_length_p95', 0)}")

    lines.append(f"# HELP {METRIC_PREFIX}_empathy_presence_rate Empathy keyword presence rate.")
    lines.append(f"# TYPE {METRIC_PREFIX}_empathy_presence_rate gauge")
    lines.append(f"{METRIC_PREFIX}_empathy_presence_rate{{{labels}}} {metrics.get('empathy_presence_rate', 0)}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    logger.info("Exported %d metrics to %s", len(lines) // 3, output_path)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Export clinical validity metrics for Prometheus",
    )
    parser.add_argument(
        "--eval-report",
        type=Path,
        required=True,
        help="Path to eval_report.json from mental health eval",
    )
    parser.add_argument(
        "--output-file",
        type=Path,
        default=Path("/var/lib/prometheus/node-exporter/clinical_validity.prom"),
        help="Output path for Prometheus text exposition metrics",
    )
    return parser


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    parser = build_parser()
    args = parser.parse_args()
    report = load_eval_report(args.eval_report)
    emit_metrics(report, args.output_file)


if __name__ == "__main__":
    main()
