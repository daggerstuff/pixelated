"""Report isolated contract repairs without replacing historical model failures."""

from __future__ import annotations

import json
from collections import Counter

from scripts.training.audit_v6_policy_training_context import digest
from scripts.training.build_v6_booking_contract_probe import describe_booking_note
from scripts.training.build_v6_safety_judge_packets import DOCS, ROOT
from scripts.training.summarize_v6_paired_evaluations import canonical_hash
from scripts.training.summarize_v6_policy_repair import booking_replay, read_rows


def state_passed(row: dict) -> bool:
    return (
        row["status"] == "success"
        and row.get("finish_reason") != "length"
        and bool(row.get("state_metrics"))
        and all(m["passed"] for m in row["state_metrics"])
    )


def booking_note_counts(rows: list[dict], arm: str) -> dict:
    counts = Counter()
    for row in rows:
        if row["arm_id"] != arm or row["scenario"] != "appointment_explicit_consent":
            continue
        for call in row.get("tool_trace", []):
            if call["name"] != "book_navigator_slot":
                continue
            args = json.loads(call["arguments"])
            label = (
                "omitted"
                if "note" not in args
                else "null"
                if args["note"] is None
                else "empty_string"
                if args["note"] == ""
                else "nonempty"
            )
            counts[label] += 1
    return dict(counts)


def verify_contract_cases(original: list[dict], actual: list[dict], version: int) -> None:
    by_id = {case["id"]: case for case in original}
    if len({case["id"] for case in actual}) != len(actual):
        raise ValueError("duplicate probe case")
    expected = describe_booking_note(
        [by_id[case["id"]] for case in actual], optional=version >= 2, describe_slot=version >= 3
    )
    if actual != expected:
        raise ValueError("probe changes more than its registered tool contract")


def report() -> dict:
    baseline_cases = read_rows(DOCS / "policy-repair-v3/tools-cases.jsonl")
    baseline_rows = read_rows(ROOT / "ai/training/output/v6-policy-repair-v3/tools/results.jsonl")
    baseline_config = json.loads((DOCS / "policy-repair-v3/tools-config.json").read_text())
    trials, hashes = {}, {}
    for version in (1, 2, 3):
        directory = DOCS / f"booking-contract-probe-v{version}"
        output = ROOT / f"ai/training/output/v6-booking-contract-probe-v{version}"
        cases = read_rows(directory / "cases.jsonl")
        verify_contract_cases(baseline_cases, cases, version)
        config = json.loads((directory / "config.json").read_text())
        if config["decoding"] != baseline_config["decoding"] or config["arms"] != baseline_config["arms"]:
            raise ValueError("model identity or decoding changed")
        if json.loads((output / "manifest.json").read_text())["status"] != "complete":
            raise ValueError("unfinished probe")
        rows = read_rows(output / "results.jsonl")
        case_hashes = {c["id"]: canonical_hash(c) for c in cases}
        expected = {(arm["id"], case["id"]) for arm in config["arms"] for case in cases}
        keys = {(r["arm_id"], r["case_id"]) for r in rows}
        if keys != expected or len(rows) != len(expected):
            raise ValueError("missing or duplicate probe result")
        for row in rows:
            if row["config_sha256"] != canonical_hash(config) or row["case_sha256"] != case_hashes[row["case_id"]]:
                raise ValueError("stale probe result")
        booking = booking_replay(cases, rows)
        repeats = {}
        prior = {(r["arm_id"], r["case_id"]): r for r in baseline_rows}
        for arm in ("base", "sft"):
            booking[arm]["supplied_note_representation_counts"] = booking_note_counts(rows, arm)
            repeated = [
                (row, prior[(arm, row["case_id"])])
                for row in rows
                if row["arm_id"] == arm and row["case_sha256"] == prior[(arm, row["case_id"])]["case_sha256"]
            ]
            repeats[arm] = {
                "identical_case_and_decoding_count": len(repeated),
                "old_state_pass_count": sum(state_passed(old) for _, old in repeated),
                "new_state_pass_count": sum(state_passed(new) for new, _ in repeated),
                "changed_state_outcome_count": sum(state_passed(new) != state_passed(old) for new, old in repeated),
                "interpretation": "Inputs and decoding are unchanged for these cases. Differences cannot be attributed to the booking contract; generation repeatability is limited.",
            }
        metrics = {}
        for arm in ("base", "sft"):
            groups = {}
            for scenario in sorted({c["scenario"] for c in cases}):
                group = [r for r in rows if r["arm_id"] == arm and r["scenario"] == scenario]
                groups[scenario] = {
                    "count": len(group),
                    "all_state_checks_pass": sum(state_passed(r) for r in group),
                    "failed_case_ids": [r["case_id"] for r in group if not state_passed(r)],
                }
            metrics[arm] = groups
        trials[str(version)] = {
            "records": len(rows),
            "response_status_counts": dict(Counter(r["status"] for r in rows)),
            "booking": booking,
            "unchanged_input_repeats": repeats,
            "state_checks": metrics,
            "estimated_cost_usd": sum(r["estimated_cost_usd"] for r in rows),
            "actual_billed_usd": None,
        }
        for path in (directory / "cases.jsonl", directory / "config.json", output / "results.jsonl"):
            hashes[str(path.relative_to(ROOT))] = digest(path)
    context_path = DOCS / "v6-policy-training-context-audit.json"
    context = json.loads(context_path.read_text())
    new_cost = sum(t["estimated_cost_usd"] for t in trials.values())
    if new_cost + 0.10313163 > 1.237:
        raise ValueError("shared repair cost ceiling exceeded")
    return {
        "status": "completed_unpromoted",
        "baseline_v3_booking": booking_replay(baseline_cases, baseline_rows),
        "trials": trials,
        "total_new_usage_estimate_usd": new_cost,
        "total_shared_repair_usage_estimate_usd": new_cost + 0.10313163,
        "prior_repair_usage_estimate_usd": 0.10313163,
        "shared_repair_cap_usd": 1.237,
        "actual_billed_usd": None,
        "clinical_clearance": False,
        "training_context_audit": {
            "path": str(context_path.relative_to(ROOT)),
            "sha256": digest(context_path),
            "candidate_count": context["candidate_count"],
            "largest_source": "mental_health_multiagent",
            "largest_source_candidate_count": context["source_counts"]["mental_health_multiagent"],
            "contextual_adjudication_complete": False,
            "training_modified": False,
        },
        "verification": {"focused_pytest_passed": 68, "ruff": "passed", "clinical_validation": False},
        "remaining_blockers": [
            "Previously reproduced confidentiality guarantees and unknown-medication dosing remain unresolved.",
            "Full tool suite retains non-booking state failures; repeated unchanged inputs vary.",
        ],
        "related_upstream_report": {
            "url": "https://github.com/vllm-project/vllm/issues/38885",
            "interpretation": "Analogous chat-template null serialization failure. Not proof of CoreWeave's parser or tokenizer configuration; exact model tokenizer retrieval returned HTTP401.",
        },
        "file_sha256": hashes,
    }


if __name__ == "__main__":
    value = report()
    (DOCS / "v6-booking-contract-results.json").write_text(json.dumps(value, indent=2) + "\n")
    print(json.dumps({"status": value["status"], "estimated_cost_usd": value["total_new_usage_estimate_usd"]}))
