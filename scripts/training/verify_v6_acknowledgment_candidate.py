"""Verify one released acknowledgment candidate against its frozen provider traces."""

from __future__ import annotations

import argparse
import hashlib
import json

from ai.qa.validation.therapy_bench import paired_eval
from scripts.training.generate_v6_acknowledgment import build_transport
from scripts.training.replay_v6_support_trace import RecordedTransport
from scripts.training.v6_policy_resolution import DIRECTORY, OUTPUT, ROOT, rows, write
from scripts.training.verify_v6_policy_final import groups


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


class CompleteDecodingReplay(RecordedTransport):
    def __init__(self, records):
        super().__init__(records)
        self.decoding_records = iter(records)

    def complete(self, arm, messages, tools, decoding):
        record = next(self.decoding_records)
        if "decoding" in record and decoding != record["decoding"]:
            raise ValueError("actual provider decoding differs from frozen ledger")
        return super().complete(arm, messages, tools, decoding)


def verify(version: str) -> dict:
    target = DIRECTORY / f"acknowledgment-candidate-{version}"
    output = OUTPUT / target.name
    cases = rows(target / "cases.jsonl")
    results = rows(output / "results.jsonl")
    traces = groups(rows(output / "all-provider-calls.jsonl"))
    run = json.loads((target / "run-result.json").read_text())
    config = json.loads((target / "config.json").read_text())
    plan = json.loads((target / "plan.json").read_text())
    keys = {(row["case_id"], row["arm_id"]) for row in results}
    expected = {(case["id"], arm) for case in cases for arm in ("base", "sft")}
    if (
        run["status"] != "complete"
        or len(cases) != 24
        or len(results) != 48
        or keys != expected
        or len(keys) != len(results)
        or len(traces) != len(results)
        or any(row["status"] != "success" for row in results)
    ):
        raise ValueError("candidate must contain exactly 24 complete paired cases")
    if digest(target / "cases.jsonl") != run["cases_sha256"]:
        raise ValueError("candidate case file differs from the completed run")
    config_digest = hashlib.sha256(paired_eval.canonical_json(config).encode()).hexdigest()
    if config_digest != run["config_sha256"]:
        raise ValueError("candidate config differs from the completed run")
    if run["all_provider_estimated_cost_usd"] > plan["all_provider_cost_cap_usd"]:
        raise ValueError("candidate exceeded its declared provider budget")

    router = json.loads((DIRECTORY / "calibration-v2/gemma4-calibration-config.json").read_text())["arms"][0]
    certificate = json.loads((DIRECTORY / "task-review-v12/certificate.json").read_text())
    case_by_id = {case["id"]: case for case in cases}
    matched_provider_calls = 0
    for row, trace in zip(results, traces, strict=True):
        raw = RecordedTransport(trace)
        transport = build_transport(raw, router, certificate, None, version)
        transport.task_fallback_arm = router
        arm = next(item for item in config["arms"] if item["id"] == row["arm_id"])
        result = transport.complete(arm, case_by_id[row["case_id"]]["messages"], [], config["decoding"])
        if any(result[field] != row[field] for field in ("response", "usage", "finish_reason")):
            raise ValueError(f"current implementation replay differs: {row['case_id']} {row['arm_id']}")
        if next(raw.records, None) is not None:
            raise ValueError(f"unused provider records: {row['case_id']} {row['arm_id']}")
        matched_provider_calls += raw.count

    implementation = [
        ROOT / "ai/training/contextual_support_policy.py",
        ROOT / "ai/training/support_task_review.py",
        ROOT / "scripts/training/generate_v6_acknowledgment.py",
        ROOT / "scripts/training/v6_support_revision.py",
        ROOT / "scripts/training/v6_adjustment_repair.py",
        ROOT / "scripts/training/v6_acknowledgment_review.py",
        ROOT / "scripts/training/v6_acknowledgment_candidate.py",
    ]
    proof = {
        "candidate": version,
        "passed": True,
        "network_calls": 0,
        "clinical_validation": False,
        "independent_review_completed": False,
        "deployment_authorized": False,
        "cases": len(cases),
        "paired_responses": len(results),
        "matched_provider_calls": matched_provider_calls,
        "estimated_provider_cost_usd": run["all_provider_estimated_cost_usd"],
        "actual_billed_cost_verified": False,
        "cases_sha256": run["cases_sha256"],
        "config_sha256": run["config_sha256"],
        "results_sha256": digest(output / "results.jsonl"),
        "provider_ledger_sha256": digest(output / "all-provider-calls.jsonl"),
        "implementation_sha256": {str(path.relative_to(ROOT)): digest(path) for path in implementation},
        "method": "Replayed every frozen provider request and response against the current candidate implementation; no network calls.",
    }
    write(target / "current-code-replay-proof.json", proof)
    return proof


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--candidate-version",
        default="v31",
        choices=(
            "v16",
            "v17",
            "v18",
            "v19",
            "v20",
            "v21",
            "v22",
            "v23",
            "v24",
            "v25",
            "v26",
            "v27",
            "v28",
            "v29",
            "v30",
            "v31",
        ),
    )
    print(json.dumps(verify(parser.parse_args().candidate_version)))


if __name__ == "__main__":
    main()
