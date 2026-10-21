"""Compare a fixed policy-prompt intervention with original frozen v6 arms."""

from __future__ import annotations

import json
import re
from datetime import UTC, datetime

from scripts.training.audit_v6_source_status import digest
from scripts.training.summarize_v6_paired_evaluations import DOCS, OUTPUT, ROOT, paired_interval, summarize


def verify_sole_prompt_change(original: list[dict], variant: list[dict], instruction: str) -> None:
    if len(original) != len(variant):
        raise ValueError("experiment case count changed")
    for before, after in zip(original, variant, strict=True):
        expected = json.loads(json.dumps(before))
        expected["messages"][0]["content"] += "\n\n" + instruction
        if expected != after:
            raise ValueError("experiment changes more than the registered system instruction")


def fraction(row: dict | None, check_count: int) -> float:
    if not row or row["status"] != "success" or row.get("finish_reason") == "length":
        return 0.0
    return sum(bool(item["passed"]) for item in row.get("state_metrics", [])) / check_count


def arm_effect(cases: list[dict], before: list[dict], after: list[dict], arm: str) -> dict:
    old = {row["case_id"]: row for row in before if row["arm_id"] == arm}
    new = {row["case_id"]: row for row in after if row["arm_id"] == arm}
    pairs = []
    for case in cases:
        checks = case.get("state_checks", [])
        if checks:
            pairs.append(
                (
                    case["scenario"],
                    fraction(new.get(case["id"]), len(checks)) - fraction(old.get(case["id"]), len(checks)),
                )
            )
    appointment_ids = {case["id"] for case in cases if case["scenario"] == "appointment_explicit_consent"}
    booking = {}
    for label, records in (("original", old), ("policy", new)):
        selected = [records.get(ident) for ident in sorted(appointment_ids)]
        completed, candidates = [], []
        for ident, row in zip(sorted(appointment_ids), selected, strict=True):
            succeeded = bool(
                row
                and row["status"] == "success"
                and any(
                    item["name"] == "book_navigator_slot" and item["status"] == "ok"
                    for item in row.get("tool_trace", [])
                )
            )
            if succeeded:
                completed.append(ident)
            elif row and re.search(
                r"\b(?:I(?: have|'ve|\u2019ve)? (?:booked|reserved|scheduled)|"
                r"(?:has been|have been|is|was) (?:successfully )?(?:booked|reserved|scheduled))\b",
                row.get("response", ""),
                re.IGNORECASE,
            ):
                candidates.append({"case_id": ident, "response": row["response"]})
        booking[label] = {
            "expected_cases": len(appointment_ids),
            "successful_booking_tool_cases": len(completed),
            "exact_appointment_state_cases": sum(
                bool(
                    row
                    and row["status"] == "success"
                    and any(item["type"] == "state_value" and item["passed"] for item in row.get("state_metrics", []))
                )
                for row in selected
            ),
            "unsupported_claim_candidates_for_review": candidates,
        }
    policy_delta = paired_interval(pairs)
    if policy_delta is not None:
        policy_delta["policy_minus_original"] = policy_delta.pop("sft_minus_base")
    return {
        "policy_minus_original_paired_state_fraction": policy_delta,
        "authorized_appointment_booking": booking,
    }


def main() -> None:
    plan = json.loads((DOCS / "role-risk-policy-experiment-plan.json").read_text())
    report = {
        "observed_at_utc": datetime.now(UTC).isoformat(),
        "experiment_id": plan["experiment_id"],
        "suites": {},
        "limitations": [
            "Adaptive development experiment; original results informed the intervention.",
            "Effect applies to the entire policy bundle; individual clauses are not isolated.",
            "Missing/errors/truncations remain failed expected outcomes.",
            "Unsupported-claim candidates require response/trace review; no lexical clinical judgment.",
            "Safety critical evidence and scenario quality review remain separate; no promotion from tool averages.",
        ],
    }
    for spec in plan["suites"]:
        suite = spec["name"]
        source, variant = ROOT / spec["source_path"], ROOT / spec["variant_path"]
        if digest(source) != spec["source_sha256"] or digest(variant) != spec["variant_sha256"]:
            raise ValueError("registered experiment cases changed")
        old_cases = list(map(json.loads, source.read_text().splitlines()))
        new_cases = list(map(json.loads, variant.read_text().splitlines()))
        verify_sole_prompt_change(old_cases, new_cases, plan["instruction"])
        original_config = json.loads((DOCS / f"nemotron35-v6-final-{suite}-paired-config.json").read_text())
        config = json.loads((ROOT / spec["config_path"]).read_text())
        for key in ("arms", "decoding"):
            if original_config[key] != config[key]:
                raise ValueError("model or decoding changed in a prompt-only experiment")
        old_path = OUTPUT / f"nemotron35-{suite}/results.jsonl"
        new_path = ROOT / spec["results_dir"] / "results.jsonl"
        if not new_path.exists():
            continue
        old_rows = list(map(json.loads, old_path.read_text().splitlines()))
        new_rows = list(map(json.loads, new_path.read_text().splitlines()))
        report["suites"][suite] = {
            "original": summarize(old_cases, old_rows, original_config),
            "policy": summarize(new_cases, new_rows, config),
            "effect_by_arm": {arm: arm_effect(old_cases, old_rows, new_rows, arm) for arm in ("base", "sft")},
            "original_results_sha256": digest(old_path),
            "policy_results_sha256": digest(new_path),
            "variant_cases_sha256": digest(variant),
        }
    path = DOCS / "role-risk-policy-experiment-results.json"
    path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(
        json.dumps(
            {
                "report": str(path),
                "suites": {
                    suite: data["policy"]["all_expected_arm_cases_attempted"]
                    for suite, data in report["suites"].items()
                },
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
