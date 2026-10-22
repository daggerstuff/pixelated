"""Reconcile the opt-in repair with every retained failure and frozen v18 report."""

import hashlib
import json

from scripts.training.summarize_v6_policy_resolution import costs
from scripts.training.v6_policy_resolution import DIRECTORY, DOCS, OUTPUT, ROOT, rows, write


def main():
    target = DIRECTORY / "acknowledgment-candidate-v8"
    replay = json.loads((target / "current-code-replay-proof.json").read_text())
    review = json.loads((DIRECTORY / "acknowledgment-candidate-v8-review/result.json").read_text())
    runs = []
    for name in ("acknowledgment-fresh-v1", *(f"acknowledgment-candidate-v{i}" for i in range(1, 9))):
        generated = rows(OUTPUT / name / "results.jsonl")
        raw = rows(OUTPUT / name / "all-provider-calls.jsonl")
        routes = rows(OUTPUT / name / "routing-audit.jsonl")
        releases = [r for r in routes if r.get("response_origin") == "validated_release"]
        runs.append(
            {
                "run": name,
                "expected_responses": 2 * len(rows(DIRECTORY / name / "cases.jsonl")),
                "released": sum(r["status"] == "success" for r in generated),
                "withheld": [
                    {"case_id": r["case_id"], "arm": r["arm_id"]} for r in generated if r["status"] != "success"
                ],
                "provider_calls": len(raw),
                "all_provider_estimated_cost_usd": sum(r["estimated_cost_usd"] for r in raw),
                "gemma_fallback_releases": sum(
                    r.get("fallback_used") and "gemma" in r["actual_model"] for r in releases
                ),
            }
        )
    calibrations = []
    for i in range(1, 12):
        source = DIRECTORY / f"acknowledgment-v{i}"
        path = source / "result.json"
        if path.exists():
            result = json.loads(path.read_text())
            calibrations.append(
                {
                    "version": i,
                    "result": str(path.relative_to(ROOT)),
                    "passed": result["passed"],
                    "result_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                }
            )
        else:
            calibrations.append(
                {"version": i, "passed": False, "status": "setup rejected before provider calls; retained inputs"}
            )
    archive = target / "Paige-Taylor-blinded-review-v2.zip"
    result = {
        "candidate": "acknowledgment-candidate-v8",
        "opt_in_only": True,
        "changes": [
            "Explicit acknowledgment guidance and a calibrated ordinary-draft acknowledgment gate",
            "Distinguish supplied cognitive reframes from assigned physical/writing exercises",
            "Accept relevant validation for general support; do not invent action requests",
            "Carry rejected draft into a bounded revision turn; remove unrelated breathing example",
            "Use temperature 1.0 only for ordinary revisions; retain first-draft and tool decoding",
            "Disclosed Gemma fallback after two rejected drafts; up to four total drafts",
        ],
        "generation_runs": runs,
        "calibrations": calibrations,
        "adjustment_calibration": json.loads((DIRECTORY / "adjustment-repair-v3/certificate.json").read_text()),
        "final_review": {
            "strict_valid": review["valid_responses"],
            "expected": review["expected_responses"],
            "quality_met": sum(r["met"] for r in review["ratings"].values()),
            "unmet": [ident for ident, r in review["ratings"].items() if not r["met"]],
            "passed_schema_and_calibration": review["passed"],
            "critical_safety_assessed": False,
            "independent_model": False,
            "clinical_review": False,
        },
        "replay": {
            "passed": replay["passed"],
            "network_calls": replay["network_calls"],
            "v18_responses": replay["v18_responses_reverified"],
            "runs": replay["runs"],
            "proof": str((target / "current-code-replay-proof.json").relative_to(ROOT)),
        },
        "verification": {
            "focused_tests": 101,
            "ruff": "passed",
            "booking_and_consent_identity_tests": "passed",
            "fresh_booking_model_trial": False,
        },
        "original_v18_flags_retained": True,
        "adapter_weights_repaired": False,
        "corpus_splits_source_rows_unchanged": True,
        "deployment_authorized": False,
        "qualified_review": {
            "reviewer": "Paige Taylor",
            "human_verifier": "user",
            "qualification_verified": True,
            "independence_verified": True,
            "verification_source": "User attestation on 2026-10-22: She is approved; I verified",
            "assessment_received": False,
            "sent": False,
            "bundle_version": 2,
            "entrypoint": "qualified-review-v2/START-HERE.html",
            "answer_format": "Offline browser form; downloadable JSON draft and completed assessment",
            "archive": str(archive.relative_to(ROOT)),
            "archive_sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
        },
        "limits": [
            "All cases and calibration labels are adaptive synthetic development data, not independent holdouts",
            "Gemma participates in routing, runtime review, fallback generation and final review; results are correlated",
            "Original v18 flags are unchanged; no clinical safety or deployment conclusion is supported",
            "Paige's qualification and independence are user-verified; completed assessment remains outstanding",
        ],
        "cost": costs(),
    }
    write(target / "repair-results.json", result)
    report_path = DOCS / "v6-policy-resolution-results.json"
    report = json.loads(report_path.read_text())
    report["acknowledgment_follow_up"] = result
    report["cost"] = result["cost"]
    write(report_path, report)
    print(
        json.dumps(
            {
                "released": runs[-1]["released"],
                "review_met": result["final_review"]["quality_met"],
                "cost_usd": result["cost"]["cumulative_estimate_usd"],
            }
        )
    )


if __name__ == "__main__":
    main()
