"""Validate blinded judge evidence and retain disagreements for adjudication."""

from __future__ import annotations

import json
import statistics
from collections import Counter
from datetime import UTC, datetime

from scripts.training.build_v6_safety_judge_packets import DOCS, OUTPUT, validate_rating
from scripts.training.summarize_v6_paired_evaluations import canonical_hash, paired_interval


def parse_rating(text: str) -> dict:
    value = text.strip()
    if value.startswith("```json\n") and value.endswith("\n```"):
        value = value[len("```json\n") : -len("\n```")]
    elif value.startswith("```\n") and value.endswith("\n```"):
        value = value[len("```\n") : -len("\n```")]
    return json.loads(value)


def critical_disagreements(cases: dict, mapping: dict, judgments: dict) -> list[dict]:
    disagreements = []
    for case_id in cases:
        first, second = judgments.get(("gemma4", case_id)), judgments.get(("nemotron35", case_id))
        if first is None or second is None:
            continue
        for response_label in ("A", "B"):
            a, b = first["ratings"][response_label], second["ratings"][response_label]
            if a["critical_failure"] != b["critical_failure"]:
                bound = mapping[case_id]
                disagreements.append(
                    {
                        "source_case_id": bound["source_case_id"],
                        "arm": bound["label_to_arm"][response_label],
                        "gemma4_judge": a,
                        "nemotron35_judge": b,
                    }
                )
    return disagreements


def main() -> None:
    rubric = json.loads((DOCS / "safety-quality-dev-v1.rubric.json").read_text())
    dimensions = set(rubric["rating_protocol"]["dimensions"])
    report = {
        "observed_at_utc": datetime.now(UTC).isoformat(),
        "models": {},
        "limitations": [
            "Model-judge judgments are provisional and not clinical ground truth.",
            "Both selected model families also act as judges; self-preference and correlated bias remain possible.",
            "Errors, unavailable pairs, invalid JSON/schema/quotes and truncations are retained separately.",
            "Critical disagreements need evidence review, and ratings need calibration before promotion.",
        ],
    }
    for label in ("gemma4", "nemotron35"):
        directory = OUTPUT / f"{label}-safety-blinded"
        if not directory.exists():
            continue
        cases = {case["id"]: case for case in map(json.loads, (directory / "cases.jsonl").read_text().splitlines())}
        mapping = {
            row["judge_case_id"]: row for row in map(json.loads, (directory / "mapping.jsonl").read_text().splitlines())
        }
        manifest = json.loads((directory / "packet-manifest.json").read_text())
        model_report = {
            "expected_pairs": manifest["expected_pairs"],
            "ratable_pairs": manifest["ratable_pairs"],
            "excluded_pairs": manifest["excluded_pairs"],
            "judges": {},
        }
        judgments = {}
        for judge in ("gemma4", "nemotron35", "gemma4-schema-v2", "nemotron35-schema-v2"):
            path = directory / f"{judge}-ratings/results.jsonl"
            if not path.exists():
                continue
            config = json.loads((directory / f"{judge}-judge-config.json").read_text())
            valid, invalid, seen = [], [], set()
            for line in path.read_text().splitlines():
                row = json.loads(line)
                case_id = row["case_id"]
                if case_id in seen or case_id not in cases:
                    raise ValueError("duplicate or unknown blinded rating case")
                seen.add(case_id)
                if (
                    row["case_sha256"] != canonical_hash(cases[case_id])
                    or row["config_sha256"] != canonical_hash(config)
                    or row["arm_id"] != "base"
                    or row["model"] != config["arms"][0]["model"]
                ):
                    raise ValueError("blinded judgment identity changed")
                candidates = json.loads(cases[case_id]["messages"][1]["content"])["candidates"]
                try:
                    if row["status"] != "success" or row.get("finish_reason") == "length":
                        raise ValueError("provider error or truncation")
                    value = parse_rating(row["response"])
                    validate_rating(value, candidates, dimensions)
                except (ValueError, TypeError) as exc:
                    invalid.append(
                        {
                            "judge_case_id": case_id,
                            "source_case_id": mapping[case_id]["source_case_id"],
                            "reason": str(exc),
                        }
                    )
                    continue
                bound = mapping[case_id]
                judgments[judge, case_id] = value
                valid.append(
                    {
                        "judge_case_id": case_id,
                        "source_case_id": bound["source_case_id"],
                        "scenario": bound["scenario"],
                        "ratings_by_arm": {
                            bound["label_to_arm"][key]: rating for key, rating in value["ratings"].items()
                        },
                        "preferred_arm": bound["label_to_arm"].get(value["preference"], value["preference"]),
                        "pair_rationale": value["rationale"],
                    }
                )
            by_arm = {}
            for arm in ("base", "sft"):
                ratings = [value["ratings_by_arm"][arm] for value in valid]
                by_arm[arm] = {
                    "valid_response_ratings": len(ratings),
                    "dimension_means": {
                        dimension: statistics.mean(value["dimension_scores"][dimension] for value in ratings)
                        if ratings
                        else None
                        for dimension in sorted(dimensions)
                    },
                    "critical_failure_count": sum(value["critical_failure"] for value in ratings),
                }
            model_report["judges"][judge] = {
                "attempted_pairs": len(seen),
                "valid_pairs": len(valid),
                "unrated_or_invalid_pairs": manifest["expected_pairs"] - len(valid),
                "invalid_judgments": invalid,
                "arms": by_arm,
                "preference_counts": dict(Counter(value["preferred_arm"] for value in valid)),
                "paired_dimension_deltas": {
                    dimension: paired_interval(
                        [
                            (
                                value["scenario"],
                                value["ratings_by_arm"]["sft"]["dimension_scores"][dimension]
                                - value["ratings_by_arm"]["base"]["dimension_scores"][dimension],
                            )
                            for value in valid
                        ]
                    )
                    for dimension in sorted(dimensions)
                },
                "per_pair": valid,
            }
        model_report["critical_failure_disagreements"] = critical_disagreements(cases, mapping, judgments)
        strict_judgments = {
            (judge.removesuffix("-schema-v2"), case_id): value
            for (judge, case_id), value in judgments.items()
            if judge.endswith("-schema-v2")
        }
        model_report["strict_schema_critical_failure_disagreements"] = critical_disagreements(
            cases, mapping, strict_judgments
        )
        report["models"][label] = model_report
    output = DOCS / "v6-safety-rating-summary.json"
    output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(
        json.dumps(
            {
                "report": str(output),
                "models": {
                    label: {
                        judge: {key: data[key] for key in ("attempted_pairs", "valid_pairs", "preference_counts")}
                        for judge, data in model["judges"].items()
                    }
                    for label, model in report["models"].items()
                },
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
