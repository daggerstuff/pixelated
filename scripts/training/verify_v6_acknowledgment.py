"""Replay every acknowledgment probe, including withheld failures, without network calls."""

from __future__ import annotations

import hashlib
import json

from scripts.training.generate_v6_acknowledgment import build_transport
from scripts.training.replay_v6_support_trace import RecordedTransport
from scripts.training.v6_policy_resolution import DIRECTORY, OUTPUT, ROOT, rows, write
from scripts.training.verify_v6_policy_current import source_trace
from scripts.training.verify_v6_policy_final import groups, verify_response


class CompleteDecodingReplay(RecordedTransport):
    def __init__(self, records):
        super().__init__(records)
        self.decoding_records = iter(records)

    def complete(self, arm, messages, tools, decoding):
        record = next(self.decoding_records)
        if "decoding" in record and decoding != record["decoding"]:
            raise ValueError("actual provider decoding differs from frozen ledger")
        return super().complete(arm, messages, tools, decoding)


def verify():
    router = json.loads((DIRECTORY / "calibration-v2/gemma4-calibration-config.json").read_text())["arms"][0]
    certificate = json.loads((DIRECTORY / "task-review-v12/certificate.json").read_text())
    proof = {"network_calls": 0, "clinical_validation": False, "runs": []}
    for name in ("acknowledgment-fresh-v1", *(f"acknowledgment-candidate-v{i}" for i in range(1, 9))):
        cases = {c["id"]: c for c in rows(DIRECTORY / name / "cases.jsonl")}
        config = json.loads((DIRECTORY / name / "config.json").read_text())
        generated = rows(OUTPUT / name / "results.jsonl")
        traces = groups(rows(OUTPUT / name / "all-provider-calls.jsonl"))
        keys = {(r["case_id"], r["arm_id"]) for r in generated}
        if (
            keys != {(ident, arm) for ident in cases for arm in ("base", "sft")}
            or len(keys) != len(generated)
            or len(traces) != len(generated)
        ):
            raise ValueError("missing, duplicate or foreign response/trace")
        matched, failures = 0, []
        calls = 0
        for row, trace in zip(generated, traces, strict=True):
            raw = CompleteDecodingReplay(trace)
            version = name.rsplit("-", 1)[-1] if "candidate" in name else None
            transport = build_transport(raw, router, certificate, None, version)
            transport.task_fallback_arm = router if version in {"v7", "v8"} else config["arms"][0]
            arm = next(a for a in config["arms"] if a["id"] == row["arm_id"])
            try:
                result = transport.complete(arm, cases[row["case_id"]]["messages"], [], config["decoding"])
            except ValueError as exc:
                if row["status"] != "error" or row["error_type"] != type(exc).__name__:
                    raise
                failures.append({"case_id": row["case_id"], "arm": row["arm_id"], "reason": str(exc), "withheld": True})
            else:
                if row["status"] != "success" or any(
                    result[k] != row[k] for k in ("response", "usage", "finish_reason")
                ):
                    raise ValueError("current response differs from recorded result")
                matched += 1
            if next(raw.records, None) is not None:
                raise ValueError("unused real provider calls")
            calls += raw.count
        proof["runs"].append(
            {
                "run": name,
                "expected_responses": len(generated),
                "matched_released_responses": matched,
                "matched_withheld_failures": failures,
                "matched_provider_calls": calls,
            }
        )
    unchanged_calls = 0
    for stage in ("original", "confirmation"):
        cases = {c["id"]: c for c in rows(DIRECTORY / f"bounded-support-v18/{stage}/cases.jsonl")}
        provenance = json.loads((OUTPUT / f"bounded-v18-{stage}/trace-provenance.json").read_text())["rows"]
        sources = {(r["case_id"], r["arm"]): ROOT / r["source_results"] for r in provenance}
        for row in rows(OUTPUT / f"bounded-v18-{stage}/results.jsonl"):
            trace, config = source_trace(sources[row["case_id"], row["arm_id"]], (row["case_id"], row["arm_id"]))
            _, count = verify_response(trace, (router, certificate), config, cases[row["case_id"]]["messages"], row)
            unchanged_calls += count
    proof.update(v18_responses_reverified=88, v18_matched_provider_calls=unchanged_calls, passed=True)
    proof["implementation_sha256"] = {
        str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
        for p in [
            ROOT / "ai/training/contextual_support_policy.py",
            ROOT / "ai/training/support_task_review.py",
            ROOT / "scripts/training/v6_acknowledgment_candidate.py",
            ROOT / "scripts/training/v6_adjustment_repair.py",
            ROOT / "scripts/training/v6_support_revision.py",
            ROOT / "scripts/training/v6_acknowledgment_review.py",
            ROOT / "scripts/training/generate_v6_acknowledgment.py",
        ]
    }
    write(DIRECTORY / "acknowledgment-candidate-v8/current-code-replay-proof.json", proof)
    return proof


if __name__ == "__main__":
    print(json.dumps(verify()))
