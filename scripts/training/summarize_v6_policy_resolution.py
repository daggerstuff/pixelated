"""Reconcile all policy repair attempts without treating missing evidence as passes."""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter

from scripts.training.summarize_v6_booking_contract_probe import state_passed
from scripts.training.v6_atomic_safety_judge import summarize
from scripts.training.v6_policy_resolution import DIRECTORY, DOCS, OUTPUT, ROOT, rows, write

PRIOR_ESTIMATE_USD = 0.16696285
SHARED_CAP_USD = 1.237


def task_calibration_cost(path):
    certificate = json.loads((DIRECTORY / path.parent.name / "certificate.json").read_text())
    input_rate, output_rate = (0.07, 0.2) if "Nemotron" in certificate["model"] else (0.1, 0.3)
    return sum(
        (r["usage"]["prompt_tokens"] * input_rate + r["usage"]["completion_tokens"] * output_rate) / 1e6
        for r in json.loads(path.read_text())
    )


def costs() -> dict:
    entries = []
    for path in sorted(OUTPUT.glob("*/results.jsonl")):
        if (path.parent / "all-provider-calls.jsonl").exists() or (path.parent / "trace-provenance.json").exists():
            continue
        entries.append(
            {
                "path": str(path.relative_to(ROOT)),
                "estimated_cost_usd": sum(row.get("estimated_cost_usd") or 0 for row in rows(path)),
                "method": "runner row usage, no nested calls",
            }
        )
    for path in sorted(OUTPUT.glob("*/all-provider-calls.jsonl")):
        entries.append(
            {
                "path": str(path.relative_to(ROOT)),
                "estimated_cost_usd": sum(row["estimated_cost_usd"] for row in rows(path)),
                "method": "all provider calls including routing and discarded drafts; runner totals excluded",
            }
        )
    for path in sorted(OUTPUT.glob("response-review-v*/calibration-attempts.json")):
        entries.append(
            {
                "path": str(path.relative_to(ROOT)),
                "estimated_cost_usd": sum(
                    (row["usage"]["prompt_tokens"] * 0.1 + row["usage"]["completion_tokens"] * 0.3) / 1e6
                    for row in json.loads(path.read_text())
                ),
                "method": "rejected reviewer calibration usage",
            }
        )
    for name in ("contextual-routing-audit.json", "confirmation-routing-audit.jsonl"):
        path = OUTPUT / name
        attempts = json.loads(path.read_text()) if path.suffix == ".json" else rows(path)
        entries.append(
            {
                "path": str(path.relative_to(ROOT)),
                "estimated_cost_usd": sum(
                    (row["router_usage"]["prompt_tokens"] * 0.1 + row["router_usage"]["completion_tokens"] * 0.3) / 1e6
                    for row in attempts
                ),
                "method": "nested routing, separately accounted from runner totals",
            }
        )
    for path in sorted(OUTPUT.glob("task-review-v*/attempts.json")):
        entries.append(
            {
                "path": str(path.relative_to(ROOT)),
                "estimated_cost_usd": task_calibration_cost(path),
                "method": "nonclinical task calibration, including failed variants",
            }
        )
    diagnostic = OUTPUT / "context-diagnostic/results.json"
    if diagnostic.exists():
        entries.append(
            {
                "path": str(diagnostic.relative_to(ROOT)),
                "estimated_cost_usd": sum(
                    (row["usage"]["prompt_tokens"] * 0.07 + row["usage"]["completion_tokens"] * 0.2) / 1e6
                    for row in json.loads(diagnostic.read_text())
                ),
                "method": "four base/SFT arithmetic context controls",
            }
        )
    quote_diagnostic = OUTPUT / "adjustment-diagnostic/results.json"
    if quote_diagnostic.exists():
        entries.append(
            {
                "path": str(quote_diagnostic.relative_to(ROOT)),
                "estimated_cost_usd": sum(
                    (r["result"]["usage"]["prompt_tokens"] * 0.1 + r["result"]["usage"]["completion_tokens"] * 0.3)
                    / 1e6
                    for r in json.loads(quote_diagnostic.read_text())
                ),
                "method": "two structured/unstructured Gemma adjustment diagnostics",
            }
        )
    total = PRIOR_ESTIMATE_USD + sum(entry["estimated_cost_usd"] for entry in entries)
    return {
        "prior_estimate_usd": PRIOR_ESTIMATE_USD,
        "cumulative_estimate_usd": round(total, 10),
        "cap_usd": SHARED_CAP_USD,
        "within_cap": total < SHARED_CAP_USD,
        "billed_amount_verified": False,
        "entries": entries,
    }


def judge_stage(stage: str, version: str) -> dict:
    source = DIRECTORY / f"bounded-support-{version}" / stage
    path = OUTPUT / f"bounded-{version}-{stage}-judge/results.jsonl"
    config = json.loads((source / "judge-config.json").read_text())
    result = summarize(rows(path) if path.exists() else [], rows(source / "judge-cases.jsonl"), config)
    mapping = {row["case_id"]: row for row in rows(source / "judge-sealed-mapping.jsonl")}
    critical, other = [], []
    complete = 0
    for ident, ratings in result["ratings"].items():
        for label, rating in ratings.items():
            version = mapping[ident]["label_to_version"][label]
            if stage == "original" and version != "bounded":
                continue
            complete += 1
            if not rating["all_requirements_met"]:
                failure = {
                    "case_id": mapping[ident]["source_case_id"],
                    "arm": mapping[ident]["arm"] if stage == "original" else version,
                    "critical_failure": rating["critical_failure"],
                    "failed_checks": [check for check in rating["checks"] if not check["met"]],
                    "rationale": rating["rationale"],
                }
                (critical if rating["critical_failure"] else other).append(failure)
    return {
        "strict_outputs_complete": result["passed"],
        "valid_pairs": result["valid_pairs"],
        "expected_pairs": result["expected_pairs"],
        "invalid": result["invalid"],
        "missing": result["missing"],
        "candidate_responses_strictly_rated": complete,
        "candidate_critical_failures": critical,
        "candidate_other_failures": other,
        "ratings_path": str(path.relative_to(ROOT)),
    }


def calibration_details() -> dict:
    directory = DIRECTORY / "calibration-v2"
    packets = rows(directory / "actual-failure-calibration-cases.jsonl")
    expected = json.loads((directory / "actual-failure-calibration-expected.json").read_text())
    result = {}
    for judge in ("gemma4", "nemotron35"):
        attempts = rows(OUTPUT / f"{judge}-calibration-v2/results.jsonl")
        config = json.loads((directory / f"{judge}-calibration-config.json").read_text())
        outcome = summarize(attempts, packets, config, expected)
        result[judge] = {
            key: outcome[key]
            for key in ("passed", "valid_pairs", "expected_pairs", "invalid", "missing", "critical_flag_mismatches")
        }
        result[judge]["truncated_outputs"] = sum(row.get("finish_reason") == "length" for row in attempts)
        result[judge]["critical_anchors"] = sum(sum(flags.values()) for flags in expected.values())
        result[judge]["negative_controls"] = 2 * len(expected) - result[judge]["critical_anchors"]
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", default="v18", choices=("v4", "v5", "v11", "v12", "v14", "v15", "v17", "v18"))
    version = parser.parse_args().version
    stages = {stage: judge_stage(stage, version) for stage in ("original", "confirmation")}
    bookings = rows(OUTPUT / "preserved-booking/results.jsonl")
    booking_summary = {
        arm: {
            scenario: {
                "total": len(group := [r for r in bookings if r["arm_id"] == arm and r["scenario"] == scenario]),
                "passed": sum(state_passed(r) for r in group),
            }
            for scenario in ("appointment_explicit_consent", "appointment_consent_gate")
        }
        for arm in ("base", "sft")
    }
    generation = {}
    for stage in ("original", "confirmation"):
        path = OUTPUT / f"bounded-{version}-{stage}"
        result_rows = rows(path / "results.jsonl")
        audit = rows(path / "routing-audit.jsonl")
        generation[stage] = {
            "status_counts": dict(Counter(r["status"] for r in result_rows)),
            "responses": len(result_rows),
            "explicit_boundary_responses": sum(r.get("response_origin") == "explicit_boundary_template" for r in audit),
            "router_calls": sum("router_usage" in r for r in audit),
            "explicit_base_fallback_responses": sum(
                r.get("response_origin") == "validated_release" and r.get("fallback_used", False) for r in audit
            ),
            "nonclinical_task_checks": sum(r.get("response_origin") == "nonclinical_task_review" for r in audit),
            "boilerplate_blocked_drafts": sum(bool(r.get("blocked_boilerplate")) for r in audit),
        }
    proof = json.loads((DIRECTORY / f"bounded-support-{version}/current-code-replay-proof.json").read_text())
    certificate_version = {"v17": "v10", "v18": "v12"}.get(version, "v3")
    complete = all(stage["strict_outputs_complete"] for stage in stages.values())
    critical = sum(len(stage["candidate_critical_failures"]) for stage in stages.values())
    other = sum(len(stage["candidate_other_failures"]) for stage in stages.values())
    result = {
        "status": "review_in_progress"
        if not complete
        else ("development_review_has_flags" if critical or other else "development_checks_complete"),
        "overall_fixed_claim_authorized": False,
        "original_attachment_sha256": hashlib.sha256(
            (ROOT.parent / ".codex/attachments/9b879c84-6dd8-4cf3-8f84-851913763d76/pasted-text-1.txt").read_bytes()
        ).hexdigest(),
        "candidate": f"bounded-support-{version}",
        "implementation": "ai/training/contextual_support_policy.py",
        "implementation_sha256": hashlib.sha256(
            (ROOT / "ai/training/contextual_support_policy.py").read_bytes()
        ).hexdigest(),
        "adapter_weights_repaired": False,
        "adapter_only_improvement_claim_authorized": False,
        "method": "Gemma routes actual conversations only. Eleven explicit boundary contexts use templates; other responses use the configured Nemotron base/SFT with nonclinical completion checks. In v18, practical suggestions additionally require a source span showing an adjustment invitation. Task checks and adjustment checks are separate; user context distinguishes listening from practical actions. Up to four drafts are allowed, with disclosed base fallback after two rejections. Tools preserve the existing booking path. This is mixed middleware, not adapter-only improvement. Source row/config hashes remain unchanged; derived evidence incurs no new provider cost. Trace replay is not stochastic replication.",
        "replay_proof": proof,
        "generation": generation,
        "independent_model_review": stages,
        "observed_candidate_critical_failures": critical,
        "observed_candidate_other_failures": other,
        "absence_of_flags_requires_complete_evidence": complete,
        "booking": booking_summary,
        "actual_calibration": calibration_details(),
        "judge_disposition": {
            "gemma_atomic": "Passed 5/5 strict calibration pairs: all four frozen critical flags and six negative controls. Used for blinded evaluation, with exact candidate-span evidence.",
            "nemotron_atomic": "No truncations in the revised calibration, but 4/5 strict-valid and a critical mismatch; excluded from acceptance judgments.",
            "runtime_response_reviewers": "All four variants rejected on actual-anchor calibration. No response was released through an uncalibrated model reviewer.",
            "independence_limit": "Gemma also routes and reviews runtime requests; correlated model bias remains. The evidence audit is agent-performed, not a qualified external clinical review.",
        },
        "failed_attempts_preserved": [
            "V12 retained an unsupported availability/disclosure promise. V13 blocks those generated promises; its high-energy route withheld one response under a broad boilerplate filter. V14 uses an explicit assessment/support template for that route. V15 additionally rejects false safe-here/next-session claims and explains why feeling better does not establish a safe medication change. All failures remain recorded.",
            "V15 retained a practical-action adjustment-invitation omission. V16 instructions alone reproduced it in another case. Extended task reviewers v4-v9 failed calibration and never authorized live releases. V17 separated task completion from exact quote extraction and passed 17 controls, but live quote typography failed strict matching twice. V18 selects source span IDs and retains actual user context to distinguish listening; its v12 combined protocol passed 17 controls.",
            "Uniform replacement policy retained urgent/ordinary support defects.",
            "Simplified tool policy failed 20 booking state checks; restored exact existing tool path passed 60/60.",
            "Context routing alone still chose missed-dose timing in two additional probes.",
            "Bounded-v1 ordinary support still added a hotline; bounded-v2 misclassified an explicitly clarified metaphor.",
            "V11 revealed failed-draft anchoring and raw-case-only preflight accounting. V12 regenerates from original context, bounds transformed requests and actual usage to the registered window, and preserves the old failed records.",
            "Nonclinical task checks caught the SFT nonresponse; v6/v7/v9/v10 pilots withheld repeated failures. V8 repeated V7 because an edit had not applied, as recorded in metadata correction. V11 has explicit base fallback after two rejected drafts.",
            "Agent audit rejected v4 medication-avoidance wording despite absent judge flags; v5 adds bounded assessment and external-action responses.",
            "Bounded-v3 classified an imminent ingestion plan as an actual ingestion; v4 distinguishes these and makes both templates preserve immediate means distance and physical company.",
        ],
        "agent_audit": {
            "current": f"policy-resolution-v1/bounded-support-{version}/agent-evidence-audit.json",
            "v4_blocker": "policy-resolution-v1/bounded-support-v4/agent-evidence-audit-blocker.json",
            "v5_remediation": "Unusual-belief and voice contexts use an uncertainty/assessment template that explicitly leaves medication decisions to pharmacist/prescriber. Trace replay confirms exact actual outputs.",
            "qualified_external_review": False,
        },
        "nonclinical_task_calibration": json.loads(
            (DIRECTORY / f"task-review-{certificate_version}/certificate.json").read_text()
        ),
        "scope": {
            "original_synthetic_development_cases": 24,
            "additional_adaptive_development_cases": 20,
            "sealed_holdouts_used": False,
            "corpus_or_model_weights_changed": False,
            "production_changed": False,
            "promoted": False,
            "clinical_validation": False,
            "qualified_independent_clinical_review": "Required before any deployment decision; not obtained in this work.",
            "additional_cases_are_adaptive_development_not_independent_holdouts": True,
            "coverage_limits": "Single-turn synthetic support, one observed response per final model/case; unchanged responses verified by exact replay, not new stochastic repetitions. Clinical tool interactions, multilingual contexts and real-world robustness are not established. Noncritical task failures remain visible, not excluded.",
        },
        "cost": costs(),
    }
    write(DOCS / "v6-policy-resolution-results.json", result)
    print(
        json.dumps(
            {
                key: result[key]
                for key in ("status", "observed_candidate_critical_failures", "observed_candidate_other_failures")
            }
        )
    )


if __name__ == "__main__":
    main()
