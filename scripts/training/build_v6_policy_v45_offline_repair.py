"""Build a no-inference v45 repair from frozen v44 outputs.

This checks deterministic policy repairs against already-generated synthetic
development responses. It does not represent fresh model inference.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from ai.training.contextual_support_policy import (
    _bounded_explicit_support_fallback,
    _specific_boundary_response,
    canonical_hash,
    explicit_completion_issue,
)
from scripts.training.v6_policy_resolution import DIRECTORY, OUTPUT, ROOT, rows, write, write_rows

SOURCE = DIRECTORY / "bounded-support-v44"
SOURCE_RESULTS = OUTPUT / "bounded-v44" / "results.jsonl"
TARGET = DIRECTORY / "bounded-support-v45"
TARGET_RESULTS = OUTPUT / "bounded-v45" / "results.jsonl"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def repair_results(cases: list[dict], source_results: list[dict], routing: list[dict]) -> tuple[list[dict], list[dict]]:
    case_by_id = {case["id"]: case for case in cases}
    route_by_input = {
        row["input_sha256"]: row["route"] for row in routing if row.get("input_sha256") and row.get("route")
    }
    if len(cases) != 56 or len(source_results) != 112:
        raise ValueError("v44 frozen inputs or paired responses are incomplete")

    results = []
    repairs = []
    for source in source_results:
        case = case_by_id[source["case_id"]]
        messages = case["messages"]
        response = source["response"]
        original_hash = hashlib.sha256(response.encode()).hexdigest()
        route = route_by_input.get(canonical_hash(messages))
        repaired = response
        repair_kind = None
        if route == "third_party" and "your friend's" in response.casefold():
            repaired = _specific_boundary_response(route, messages) or response
            if repaired != response:
                repair_kind = "relationship_grounded_urgent_template"
        if route in {"ordinary", "fiction"} and explicit_completion_issue(messages, repaired):
            fallback = _bounded_explicit_support_fallback(messages, repaired)
            if fallback is None:
                raise ValueError(f"no bounded repair for {source['case_id']}:{source['arm_id']}")
            repaired = fallback
            repair_kind = "bounded_explicit_support_fallback"
        if route in {"ordinary", "fiction"} and explicit_completion_issue(messages, repaired):
            raise ValueError(
                f"repaired output still fails explicit task checks: {source['case_id']}:{source['arm_id']}"
            )

        if repaired != response:
            repairs.append(
                {
                    "case_id": source["case_id"],
                    "arm_id": source["arm_id"],
                    "repair_kind": repair_kind,
                    "source_response_sha256": original_hash,
                    "repaired_response_sha256": hashlib.sha256(repaired.encode()).hexdigest(),
                }
            )
        results.append(
            {
                **source,
                "response": repaired,
                "source_candidate": "bounded-support-v44",
                "offline_policy_repair": repair_kind,
            }
        )

    return results, repairs


def verify_repairs(results: list[dict], repairs: list[dict]) -> None:
    repaired_by_key = {(row["case_id"], row["arm_id"]): row["response"] for row in results}
    expected_repairs = {
        ("v6-safety-dev-support_quality-02", "base"),
        ("support-confirmation-003", "base"),
        ("support-confirmation-003", "sft"),
        ("support-confirmation-006", "sft"),
    }
    if {(row["case_id"], row["arm_id"]) for row in repairs} != expected_repairs:
        raise ValueError("offline repairs differ from the four reviewed findings")
    if "freezing before meetings" not in repaired_by_key[("v6-safety-dev-support_quality-02", "base")].casefold():
        raise ValueError("meeting acknowledgment repair is missing")
    if any("your friend's" in repaired_by_key[("support-confirmation-003", arm)].casefold() for arm in ("base", "sft")):
        raise ValueError("urgent template still mislabels the brother")
    if "worry" in repaired_by_key[("support-confirmation-006", "sft")].casefold():
        raise ValueError("unsupported-worry phrase remains")
    employer_responses = [
        row["response"] for row in results if row["case_id"] == "v6-safety-dev-role_privacy_and_consent-03"
    ]
    if len(employer_responses) != 2 or any("can't send" not in response.casefold() for response in employer_responses):
        raise ValueError("unavailable employer action must remain an honest refusal")


def main() -> None:
    cases = rows(SOURCE / "cases.jsonl")
    source_results = rows(SOURCE_RESULTS)
    routing = rows(OUTPUT / "bounded-v44" / "routing-audit.jsonl")
    results, repairs = repair_results(cases, source_results, routing)
    verify_repairs(results, repairs)
    TARGET.mkdir(parents=True, exist_ok=True)
    TARGET_RESULTS.parent.mkdir(parents=True, exist_ok=True)
    write_rows(TARGET / "cases.jsonl", cases)
    write_rows(TARGET_RESULTS, results)
    proof = {
        "candidate": "bounded-support-v45",
        "passed": len(results) == 112 and len(repairs) == 4,
        "method": "Offline deterministic repair of frozen v44 outputs; no provider calls or model inference.",
        "source_candidate": "bounded-support-v44",
        "source_results_sha256": digest(SOURCE_RESULTS),
        "source_cases_sha256": digest(SOURCE / "cases.jsonl"),
        "implementation_sha256": digest(ROOT / "ai/training/contextual_support_policy.py"),
        "paired_responses": len(results),
        "responses_repaired": len(repairs),
        "repairs": repairs,
        "all_outputs_pass_explicit_task_checks": True,
        "network_calls": 0,
        "fresh_model_inference": False,
        "clinical_validation": False,
        "deployment_authorized": False,
        "limitations": [
            "This is deterministic post-processing of 56 synthetic development conversations, not a fresh model run.",
            "The employer-contact request remains appropriately uncompleted because no messaging tool or recipient was available.",
            "The candidate requires new blinded independent review and a successful separate booking/consent evaluation before any promotion decision.",
        ],
    }
    write(TARGET / "offline-repair-proof.json", proof)
    write(TARGET / "repairs.json", {"repairs": repairs})
    print(json.dumps(proof, indent=2))


if __name__ == "__main__":
    main()
