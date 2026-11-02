"""Run one consolidated release-candidate gate against the current runtime.

The locked 54-case set combines the existing 24 safety development cases with
15 explicit-consent and 15 no-consent booking cases. All tools are mocked.
Passing this gate is not clinical validation or deployment authorization.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

from ai.qa.validation.therapy_bench import paired_eval
from ai.training.contextual_support_policy import SupportInputReservation
from scripts.training.build_v6_safety_judge_packets import ROOT
from scripts.training.run_v6_policy_v51_locked_eval import run as run_locked
from scripts.training.v6_policy_resolution import DIRECTORY, OUTPUT, rows, write, write_rows

SOURCE = DIRECTORY / "bounded-support-v57/locked-eval-v1"
TARGET = DIRECTORY / "release-candidate-gate-v1"
RESULTS = OUTPUT / "release-candidate-gate-v1"
FOLLOWUP_TARGET = TARGET / "post-repair-verification"
FOLLOWUP_RESULTS = OUTPUT / "release-candidate-gate-v1-post-repair"
RUNTIME = ROOT / "ai/training/contextual_support_policy.py"
TRANSPORT = ROOT / "ai/qa/validation/therapy_bench/paired_eval.py"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def prepare() -> Path:
    if TARGET.exists() or RESULTS.exists():
        raise ValueError("release-candidate gate exists; refusing overwrite or implicit rerun")
    source_plan = json.loads((SOURCE / "plan.json").read_text())
    if source_plan.get("status") != "complete":
        raise ValueError("source locked evaluation is not complete")
    source_cases = SOURCE / "cases.jsonl"
    if digest(source_cases) != source_plan.get("locked_cases_sha256"):
        raise ValueError("source locked cases changed")
    cases = rows(source_cases)
    booking = [
        case for case in cases if case.get("scenario") in {"appointment_explicit_consent", "appointment_consent_gate"}
    ]
    safety = [case for case in cases if case.get("suite") == "synthetic-safety-quality-dev-v1"]
    if len(safety) != 24 or len(booking) != 30:
        raise ValueError("expected 24 safety and 30 booking/consent cases")
    ids = [case["id"] for case in cases]
    if len(ids) != len(set(ids)):
        raise ValueError("locked case IDs are not unique")

    config = json.loads((SOURCE / "config.json").read_text())
    config["run_id"] = "v6-policy-release-candidate-gate-v1"
    config["pricing"]["hard_cap_usd"] = 0.5
    TARGET.mkdir(parents=True)
    write_rows(TARGET / "cases.jsonl", cases)
    write(TARGET / "config.json", config)
    request = paired_eval.RunRequest(
        TARGET / "cases.jsonl",
        TARGET / "config.json",
        RESULTS,
        paired_eval.RunnerOptions(
            arm_selection="both",
            max_input_tokens=8192,
            max_tool_rounds=4,
            continue_on_transient_http_errors=False,
        ),
    )
    counter = SupportInputReservation(paired_eval.ConservativeAsciiByteCounter())
    dry_run = paired_eval.build_dry_run_report(request, counter)
    write(TARGET / "dry-run.json", dry_run)
    plan: dict[str, Any] = {
        "candidate": "release-candidate-current-v74-runtime",
        "status": "locked_prepared_not_run",
        "source_candidate": "bounded-support-v57-runtime",
        "source_locked_case_sha256": digest(source_cases),
        "case_count": len(cases),
        "paired_responses": 2 * len(cases),
        "case_suite_counts": {"safety_development": len(safety), "booking_and_consent": len(booking)},
        "selected_case_ids": ids,
        "candidate_runtime_sha256": digest(RUNTIME),
        "candidate_transport_sha256": digest(TRANSPORT),
        "config_sha256": hashlib.sha256(paired_eval.canonical_json(config).encode("utf-8")).hexdigest(),
        "config_file_sha256": digest(TARGET / "config.json"),
        "locked_cases_sha256": digest(TARGET / "cases.jsonl"),
        "dry_run_sha256": digest(TARGET / "dry-run.json"),
        "paired_arms": [arm["id"] for arm in config["arms"]],
        "decoding": config["decoding"],
        "max_tool_rounds": 4,
        "application_cost_cap_usd": 0.5,
        "max_provider_calls": 624,
        "retry_policy": "No automatic provider retries; preserve any failed attempt in the run evidence.",
        "limitations": [
            "The safety prompts are development cases previously used during repair, not an unseen holdout.",
            "Booking and consent are deterministic mock state checks; no real appointment is created.",
            "This gate does not replace the independent judge-calibration gate or Paige's review of the complete packet.",
            "Synthetic development evidence only; not clinical validation or deployment authorization.",
        ],
        "clinical_validation": False,
        "deployment_authorized": False,
    }
    write(TARGET / "plan.json", plan)
    return TARGET


def execute() -> dict[str, Any]:
    return run_locked(TARGET, RESULTS)


def prepare_recheck() -> Path:
    if FOLLOWUP_TARGET.exists() or FOLLOWUP_RESULTS.exists():
        raise ValueError("post-repair verification exists; refusing overwrite or implicit rerun")
    baseline = json.loads((TARGET / "plan.json").read_text())
    if baseline.get("status") != "complete":
        raise ValueError("baseline release-candidate run is not complete")
    if digest(TARGET / "cases.jsonl") != baseline.get("locked_cases_sha256"):
        raise ValueError("baseline release-candidate cases changed")
    FOLLOWUP_TARGET.mkdir()
    write_rows(FOLLOWUP_TARGET / "cases.jsonl", rows(TARGET / "cases.jsonl"))
    config = json.loads((TARGET / "config.json").read_text())
    config["run_id"] = "v6-policy-release-candidate-post-repair-v1"
    write(FOLLOWUP_TARGET / "config.json", config)
    request = paired_eval.RunRequest(
        FOLLOWUP_TARGET / "cases.jsonl",
        FOLLOWUP_TARGET / "config.json",
        FOLLOWUP_RESULTS,
        paired_eval.RunnerOptions(
            arm_selection="both",
            max_input_tokens=8192,
            max_tool_rounds=4,
            continue_on_transient_http_errors=False,
        ),
    )
    counter = SupportInputReservation(paired_eval.ConservativeAsciiByteCounter())
    write(FOLLOWUP_TARGET / "dry-run.json", paired_eval.build_dry_run_report(request, counter))
    plan = {
        **baseline,
        "candidate": "release-candidate-post-booking-guard-repair",
        "run_id": config["run_id"],
        "status": "locked_prepared_not_run",
        "follow_up_to": "v6-policy-release-candidate-gate-v1",
        "follow_up_reason": (
            "The blinded baseline review found both arms failing all 15 authorized earliest-slot bookings. "
            "The shared selector now accepts open/available plus navigator/introduction wording."
        ),
        "candidate_runtime_sha256": digest(RUNTIME),
        "candidate_transport_sha256": digest(TRANSPORT),
        "config_sha256": hashlib.sha256(paired_eval.canonical_json(config).encode("utf-8")).hexdigest(),
        "config_file_sha256": digest(FOLLOWUP_TARGET / "config.json"),
        "locked_cases_sha256": digest(FOLLOWUP_TARGET / "cases.jsonl"),
        "dry_run_sha256": digest(FOLLOWUP_TARGET / "dry-run.json"),
        "baseline_case_sha256": baseline["locked_cases_sha256"],
        "limitations": [
            *baseline["limitations"],
            "This is one repair verification of the same locked case set; it is not unseen confirmation.",
        ],
    }
    write(FOLLOWUP_TARGET / "plan.json", plan)
    return FOLLOWUP_TARGET


def execute_recheck() -> dict[str, Any]:
    return run_locked(FOLLOWUP_TARGET, FOLLOWUP_RESULTS)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("prepare", "run", "prepare-recheck", "run-recheck"))
    action = parser.parse_args().action
    actions = {
        "prepare": prepare,
        "run": execute,
        "prepare-recheck": prepare_recheck,
        "run-recheck": execute_recheck,
    }
    result = actions[action]()
    print(json.dumps({"target": str(result)} if action.startswith("prepare") else result, indent=2))


if __name__ == "__main__":
    main()
