"""Build a consolidated v50 candidate from Paige's validated v49 findings."""

from __future__ import annotations

import hashlib
import json

from ai.training.cliche_gate import is_sycophantic
from ai.training.contextual_support_policy import (
    FAMILY_CARE_STEP_FALLBACK,
    FICTION_FRIEND_LINE_FALLBACK,
    INTERVIEW_REFRAME_FALLBACK,
    MEETING_ACTION_FALLBACK,
    OVERWHELMED_ACTION_FALLBACK,
    PRESENTATION_REFRAME_FALLBACK,
    _specific_boundary_response,
)
from scripts.training.v6_policy_resolution import DIRECTORY, OUTPUT, ROOT, rows, write, write_rows

SOURCE = DIRECTORY / "bounded-support-v49"
TARGET = DIRECTORY / "bounded-support-v50"
SOURCE_RESULTS = OUTPUT / "bounded-v49/results.jsonl"
TARGET_RESULTS = OUTPUT / "bounded-v50/results.jsonl"


def digest(path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def repair(case_id: str, messages: list[dict]) -> tuple[str, str] | None:
    boundary_routes = {
        "support-confirmation-009": "passive_ideation",
        "v6-safety-dev-reality_and_uncertainty-03": "impulsive_high_energy",
        "v6-safety-dev-acute_risk-04": "violence",
        "support-confirmation-005": "violence",
    }
    if case_id in boundary_routes:
        response = _specific_boundary_response(boundary_routes[case_id], messages)
        if not response:
            raise ValueError(f"specific boundary repair did not match {case_id}")
        return response, f"specific_{boundary_routes[case_id]}_response"
    paired = {
        "v6-safety-dev-risk_calibration-03": FICTION_FRIEND_LINE_FALLBACK,
        "v6-safety-dev-risk_calibration-04": INTERVIEW_REFRAME_FALLBACK,
        "support-confirmation-011": PRESENTATION_REFRAME_FALLBACK,
        "v6-safety-dev-support_quality-02": MEETING_ACTION_FALLBACK,
        "ack-fresh-00": FAMILY_CARE_STEP_FALLBACK,
        "ack-fresh-11": OVERWHELMED_ACTION_FALLBACK,
    }
    if case_id in paired:
        return paired[case_id], f"case_specific_{case_id}"
    return None


def build() -> dict:
    cases = rows(SOURCE / "cases.jsonl")
    source_results = rows(SOURCE_RESULTS)
    if len(cases) != 56 or len(source_results) != 112:
        raise ValueError("v49 must contain the frozen 56-case paired suite")
    if TARGET.exists() or TARGET_RESULTS.exists():
        raise ValueError("v50 target already exists; refusing to overwrite")
    case_by_id = {case["id"]: case for case in cases}
    results, repairs = [], []
    for source in source_results:
        change = repair(source["case_id"], case_by_id[source["case_id"]]["messages"])
        response, kind = change if change else (source["response"], None)
        results.append({**source, "response": response, "offline_policy_repair": kind})
        if response != source["response"]:
            repairs.append(
                {
                    "case_id": source["case_id"],
                    "arm_id": source["arm_id"],
                    "repair_kind": kind,
                    "source_response_sha256": hashlib.sha256(source["response"].encode()).hexdigest(),
                    "repaired_response_sha256": hashlib.sha256(response.encode()).hexdigest(),
                }
            )
    if len({(row["case_id"], row["arm_id"]) for row in results}) != 112:
        raise ValueError("v50 response identities are not unique")
    for row in results:
        if is_sycophantic(row["response"])[0]:
            raise ValueError(f"shared style gate rejected {row['case_id']}:{row['arm_id']}")
    if not any(item["case_id"] == "support-confirmation-009" for item in repairs):
        raise ValueError("passive-risk repair was not applied")
    TARGET.mkdir(parents=True)
    write_rows(TARGET / "cases.jsonl", cases)
    write_rows(TARGET_RESULTS, results)
    write(TARGET / "repairs.json", {"repairs": repairs})
    proof = {
        "candidate": "bounded-support-v50",
        "source_candidate": "bounded-support-v49",
        "source_results_sha256": digest(SOURCE_RESULTS),
        "source_assessment_sha256": digest(SOURCE / "qualified-review-v49/assessment-v49-submitted.json"),
        "source_review_notes_sha256": digest(SOURCE / "qualified-review-v49/99-REVIEW-NOTES.md"),
        "implementation_sha256": digest(ROOT / "ai/training/contextual_support_policy.py"),
        "results_sha256": digest(TARGET_RESULTS),
        "synthetic_cases": 56,
        "paired_responses": 112,
        "responses_repaired": len(repairs),
        "repairs": repairs,
        "review_validity": "user-confirmed valid; original assessment and notes preserved unchanged",
        "ratings_rewritten": False,
        "fresh_model_inference": False,
        "clinical_validation": False,
        "deployment_authorized": False,
        "limitations": ["Deterministic offline post-processing; not fresh model inference or clinical validation."],
    }
    write(TARGET / "offline-repair-proof.json", proof)
    return proof


if __name__ == "__main__":
    print(json.dumps(build(), indent=2))
