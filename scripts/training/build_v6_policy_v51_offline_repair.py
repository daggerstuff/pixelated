"""Build one bounded v51 repair from the completed v50 assessment findings."""

from __future__ import annotations

import hashlib
import json

from ai.training.cliche_gate import is_sycophantic
from ai.training.contextual_support_policy import (
    BOUNDARY_RESPONSES,
    EXAM_REFRAME_FALLBACK,
    RELATIONSHIP_REFRAME_FALLBACK,
    SAFE_DISAPPEARANCE_EXHAUSTION_FALLBACK,
    _specific_boundary_response,
    explicit_completion_issue,
)
from ai.training.support_task_review import explicit_format_issue
from scripts.training.v6_policy_resolution import DIRECTORY, OUTPUT, ROOT, rows, write, write_rows

SOURCE = DIRECTORY / "bounded-support-v50"
TARGET = DIRECTORY / "bounded-support-v51"
SOURCE_RESULTS = OUTPUT / "bounded-v50/results.jsonl"
TARGET_RESULTS = OUTPUT / "bounded-v51/results.jsonl"
ASSESSMENT = SOURCE / "completed-assessment-v50/Paige_Taylor_v50_completed_assessment.json"


def digest(path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def repair(case_id: str, messages: list[dict]) -> tuple[str, str] | None:
    urgent_cases = {
        "v6-safety-dev-acute_risk-01",
        "support-confirmation-000",
        "support-confirmation-001",
    }
    violence_cases = {"v6-safety-dev-acute_risk-04", "support-confirmation-005"}
    if case_id in urgent_cases:
        return BOUNDARY_RESPONSES["imminent_self_harm"], "acknowledge_after_urgent_safety_actions"
    if case_id in violence_cases:
        response = _specific_boundary_response("violence", messages)
        if response is None:
            raise ValueError(f"violence risk details did not match for {case_id}")
        return response, "acknowledge_after_distance_and_live_support_actions"

    paired = {
        "v6-safety-dev-risk_calibration-01": (
            SAFE_DISAPPEARANCE_EXHAUSTION_FALLBACK,
            "respect_explicit_exhaustion_clarification_without_inferred_intent",
        ),
        "v6-safety-dev-support_quality-04": (
            RELATIONSHIP_REFRAME_FALLBACK,
            "acknowledge_global_self_judgment_before_grounded_reframe",
        ),
        "v6-safety-dev-role_privacy_and_consent-02": (
            BOUNDARY_RESPONSES["dependence"],
            "acknowledge_need_for_support_while_maintaining_role_boundary",
        ),
        "support-confirmation-019": (
            BOUNDARY_RESPONSES["dependence"],
            "acknowledge_need_for_support_while_maintaining_role_boundary",
        ),
        "v6-safety-dev-role_privacy_and_consent-03": (
            _specific_boundary_response("external_action", messages),
            "acknowledge_relief_goal_without_claiming_external_action",
        ),
        "ack-fresh-07": (EXAM_REFRAME_FALLBACK, "reframe_exam_without_introducing_failure_label"),
    }
    change = paired.get(case_id)
    if change and not change[0]:
        raise ValueError(f"targeted repair did not match {case_id}")
    return change


def build() -> dict:
    cases = rows(SOURCE / "cases.jsonl")
    source_results = rows(SOURCE_RESULTS)
    if len(cases) != 56 or len(source_results) != 112:
        raise ValueError("v50 must contain the frozen 56-case paired suite")
    if TARGET.exists() or TARGET_RESULTS.exists():
        raise ValueError("v51 target already exists; refusing to overwrite")
    case_by_id = {case["id"]: case for case in cases}
    results, repairs = [], []
    for source in source_results:
        change = repair(source["case_id"], case_by_id[source["case_id"]]["messages"])
        response, kind = change if change else (source["response"], None)
        case_messages = case_by_id[source["case_id"]]["messages"]
        task_issue = explicit_completion_issue(case_messages, response)
        format_issue = explicit_format_issue(case_messages, response)
        style_rejected, style_reason = is_sycophantic(response)
        if task_issue or format_issue or style_rejected:
            raise ValueError(
                f"v51 repair failed release guard for {source['case_id']}:{source['arm_id']}: "
                f"task={task_issue}, format={format_issue}, style={style_reason}"
            )
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
        raise ValueError("v51 response identities are not unique")
    if len(repairs) != 22:
        raise ValueError(f"expected 22 repaired response slots, found {len(repairs)}")
    TARGET.mkdir(parents=True)
    write_rows(TARGET / "cases.jsonl", cases)
    write_rows(TARGET_RESULTS, results)
    write(TARGET / "repairs.json", {"repairs": repairs})
    proof = {
        "candidate": "bounded-support-v51",
        "source_candidate": "bounded-support-v50",
        "source_results_sha256": digest(SOURCE_RESULTS),
        "source_assessment_sha256": digest(ASSESSMENT),
        "implementation_sha256": digest(ROOT / "ai/training/contextual_support_policy.py"),
        "results_sha256": digest(TARGET_RESULTS),
        "synthetic_cases": 56,
        "paired_responses": 112,
        "responses_repaired": len(repairs),
        "repairs": repairs,
        "all_explicit_task_format_and_shared_style_gates_passed": True,
        "source_assessment_preserved": True,
        "fresh_model_inference": False,
        "clinical_validation": False,
        "deployment_authorized": False,
        "limitations": ["Deterministic offline repair of frozen outputs; not a fresh model comparison."],
    }
    write(TARGET / "offline-repair-proof.json", proof)
    return proof


if __name__ == "__main__":
    print(json.dumps(build(), indent=2))
