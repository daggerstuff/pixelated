"""Summarize fixed v6 pairs, retaining unavailable outcomes in denominators."""

from __future__ import annotations

import hashlib
import json
import random
import statistics
from collections import Counter, defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs/training/execution-2026-10-21"
OUTPUT = ROOT / "ai/training/output/v6-final-paired-evaluation"
SERIALIZATION_MARKERS = ("<|channel>", "<channel|>", "<|start|>", "<|end|>", "<think>", "</think>")


def canonical_hash(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest()


def paired_interval(values: list[tuple[str, float]], draws: int = 5000) -> dict[str, Any] | None:
    if not values:
        return None
    groups: dict[str, list[float]] = defaultdict(list)
    for group, value in values:
        groups[group].append(value)
    clusters = list(groups.values())
    rng = random.Random(20261021)
    samples = sorted(
        statistics.mean(value for cluster in rng.choices(clusters, k=len(clusters)) for value in cluster)
        for _ in range(draws)
    )
    return {
        "sft_minus_base": statistics.mean(value for _, value in values),
        "scenario_cluster_percentile_95_interval": [samples[int(draws * 0.025)], samples[int(draws * 0.975)]],
        "scenario_clusters": len(clusters),
        "draws": draws,
        "seed": 20261021,
        "limitation": "Few synthetic scenario clusters; this interval is descriptive, not clinical validation.",
    }


def summarize(cases: list[dict[str, Any]], rows: list[dict[str, Any]], config: dict[str, Any]) -> dict[str, Any]:
    by_case = {case["id"]: case for case in cases}
    arms = {arm["id"]: arm for arm in config["arms"]}
    records = {}
    for row in rows:
        key = row["arm_id"], row["case_id"]
        if key in records or key[0] not in arms or key[1] not in by_case:
            raise ValueError("duplicate or unknown arm/case record")
        if (
            row["case_sha256"] != canonical_hash(by_case[key[1]])
            or row["config_sha256"] != canonical_hash(config)
            or row["model"] != arms[key[0]]["model"]
        ):
            raise ValueError("case/config/model identity mismatch")
        records[key] = row
    arm_summaries = {}
    paired_values = []
    regression_ids = []
    case_rows = []
    for arm in arms:
        selected = [records.get((arm, case["id"])) for case in cases]
        successes = [row for row in selected if row and row["status"] == "success"]
        counts: dict[str, Counter[str]] = defaultdict(Counter)
        for case, row in zip(cases, selected, strict=True):
            expected = case.get("state_checks", [])
            measured = row.get("state_metrics", []) if row and row["status"] == "success" else []
            if measured and [item["type"] for item in measured] != [item["type"] for item in expected]:
                raise ValueError("recorded state checks differ from expected case checks")
            usable = bool(row and row["status"] == "success" and row.get("finish_reason") != "length")
            for index, check in enumerate(expected):
                counts[check["type"]]["expected"] += 1
                counts[check["type"]]["passed"] += bool(usable and measured and measured[index]["passed"])
        latencies = [row["latency_ms"] for row in successes]
        arm_summaries[arm] = {
            "expected_cases": len(cases),
            "attempted_cases": sum(row is not None for row in selected),
            "transport_successes": len(successes),
            "provider_or_execution_errors": sum(bool(row and row["status"] != "success") for row in selected),
            "execution_error_type_counts": dict(
                Counter(row.get("error_type", "unknown") for row in selected if row and row["status"] != "success")
            ),
            "missing_cases": sum(row is None for row in selected),
            "truncated_successes": sum(row.get("finish_reason") == "length" for row in successes),
            "empty_visible_successes": sum(not row.get("response", "").strip() for row in successes),
            "cases_with_tool_calls": sum(bool(row.get("tool_trace") or row.get("tool_calls")) for row in successes),
            "visible_serialization_markers_by_case": {
                row["case_id"]: [marker for marker in SERIALIZATION_MARKERS if marker in row.get("response", "")]
                for row in successes
                if any(marker in row.get("response", "") for marker in SERIALIZATION_MARKERS)
            },
            "state_checks": {name: dict(count) for name, count in counts.items()},
            "median_success_latency_ms": statistics.median(latencies) if latencies else None,
            "reported_usage_cost_estimate_usd": sum(row.get("estimated_cost_usd") or 0 for row in selected if row),
            "http_status_counts": dict(
                Counter(str(row["provider_http_status"]) for row in selected if row and row.get("provider_http_status"))
            ),
        }
    for case in cases:
        scores = {}
        statuses = {}
        expected = case.get("state_checks", [])
        for arm in arms:
            row = records.get((arm, case["id"]))
            statuses[arm] = row["status"] if row else "missing"
            usable = bool(row and row["status"] == "success" and row.get("finish_reason") != "length")
            measured = row.get("state_metrics", []) if usable else []
            scores[arm] = sum(bool(item["passed"]) for item in measured) / len(expected) if expected else None
        if expected:
            delta = scores["sft"] - scores["base"]
            paired_values.append((case["scenario"], delta))
            if delta < 0:
                regression_ids.append(case["id"])
        case_rows.append(
            {
                "case_id": case["id"],
                "scenario": case["scenario"],
                "statuses": statuses,
                "state_check_pass_fraction": scores,
            }
        )
    return {
        "arms": arm_summaries,
        "paired_state_check_pass_fraction": paired_interval(paired_values),
        "state_check_regression_case_ids": regression_ids,
        "per_case": case_rows,
        "all_expected_arm_cases_attempted": len(records) == len(cases) * len(arms),
        "clinical_quality_or_promotion_claim": False,
    }


def main() -> None:
    budget = json.loads((DOCS / "v6-evaluation-budget.json").read_text())
    results = {}
    for label in ("gemma4", "nemotron35"):
        results[label] = {}
        for suite, spec in zip(("tools", "capability", "safety"), budget["suites"], strict=True):
            variant = "-availability-v2" if label == "gemma4" else ""
            config_name = (
                f"{label}-v6-final-{suite}-availability-v2-config.json"
                if variant
                else f"{label}-v6-final-{suite}-paired-config.json"
            )
            config_path = DOCS / config_name
            path = OUTPUT / f"{label}-{suite}{variant}" / "results.jsonl"
            if not path.exists() or not config_path.exists():
                continue
            cases_path = ROOT / spec["path"]
            if hashlib.sha256(cases_path.read_bytes()).hexdigest() != spec["sha256"]:
                raise ValueError("frozen case file changed")
            cases = [json.loads(line) for line in cases_path.read_text().splitlines()]
            rows = [json.loads(line) for line in path.read_text().splitlines()]
            result = summarize(cases, rows, json.loads(config_path.read_text()))
            result["results_path"] = str(path.relative_to(ROOT))
            result["results_sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
            result["cases_sha256"] = spec["sha256"]
            result["config_path"] = str(config_path.relative_to(ROOT))
            results[label][suite] = result
    report = {
        "observed_at_utc": datetime.now(UTC).isoformat(),
        "models": results,
        "limitations": [
            "Synthetic development cases; holdouts untouched.",
            "Missing/error/truncated outcomes count as failed expected state checks.",
            "Transport success is not a safety or quality pass.",
            "Gemma complete-coverage run and original fail-fast attempts are separate; no silent retries.",
            "Safety needs the separate case-specific rubric and calibrated ratings.",
            "Reported token cost estimates are not actual billed amounts.",
        ],
    }
    path = DOCS / "v6-paired-evaluation-summary.json"
    path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(
        json.dumps(
            {
                "report": str(path),
                "suites": {
                    label: {suite: data["all_expected_arm_cases_attempted"] for suite, data in suites.items()}
                    for label, suites in results.items()
                },
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
