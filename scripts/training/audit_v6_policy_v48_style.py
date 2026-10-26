"""Audit frozen v48 paired outputs with the runtime gate and deslop rule packs."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "packages/deslop"))

from deslop.rules.core import load_rule_set
from deslop.scanner import ScanOptions, scan_file

from ai.training.cliche_gate import is_sycophantic

RESULTS = ROOT / "ai/training/output/v6-policy-resolution-v1/bounded-v48/results.jsonl"
DEFAULT_OUTPUT = ROOT / "docs/training/execution-2026-10-21/policy-resolution-v1/bounded-support-v48/style-audit.json"
DESLOP_PACKS = ("generic-ai", "sycophancy", "chatbot-assistant", "synthetic-evals")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def audit(results_path: Path, output_path: Path) -> dict:
    rows = [json.loads(line) for line in results_path.read_text().splitlines() if line]
    if len(rows) != 112 or len({(row["case_id"], row["arm_id"]) for row in rows}) != 112:
        raise ValueError("style audit requires all 112 unique paired response slots")

    gate_hits = []
    for row in rows:
        rejected, reason = is_sycophantic(row["response"])
        if rejected:
            gate_hits.append({"case_id": row["case_id"], "arm_id": row["arm_id"], "reason": reason})

    deslop = scan_file(
        results_path,
        ScanOptions(rules=load_rule_set(None, list(DESLOP_PACKS)), fields=("response",), finding_limit=10000),
    )
    deslop_hits = [
        {
            "case_id": rows[finding.record_index]["case_id"],
            "arm_id": rows[finding.record_index]["arm_id"],
            "pattern": finding.pattern,
        }
        for finding in deslop.findings
    ]
    report = {
        "candidate": "bounded-support-v48",
        "source_results": str(results_path),
        "source_results_sha256": sha256(results_path),
        "paired_responses": len(rows),
        "shared_cliche_gate": {
            "implementation": "ai/training/cliche_gate.py",
            "rejected_responses": len(gate_hits),
            "hits": gate_hits,
        },
        "deslop_dataset_style_rule_packs": {
            "packs": list(DESLOP_PACKS),
            "flagged_responses": deslop.records_flagged,
            "pattern_counts": deslop.top_slop_patterns,
            "hits": deslop_hits,
        },
        "passed": not gate_hits and deslop.records_flagged == 0,
        "clinical_validation": False,
        "deployment_authorized": False,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--results", type=Path, default=RESULTS)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    print(json.dumps(audit(args.results, args.output), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
