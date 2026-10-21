"""Replay frozen provider calls against current experimental support middleware.

This makes no network calls and is not clinical validation. Request hashes,
models, token caps and final outputs must match the real recorded run exactly.
"""

from __future__ import annotations

import argparse
import hashlib
import json

from ai.training.contextual_support_policy import ContextualSupportTransport
from ai.training.support_task_review import TaskResponseReviewer
from scripts.training.v6_policy_resolution import DIRECTORY, OUTPUT, ROOT, rows, write


class RecordedTransport:
    def __init__(self, records: list[dict]):
        self.records = iter(records)
        self.count = 0

    def complete(self, arm: dict, messages: list[dict], tools: list[dict], decoding: dict) -> dict:
        record = next(self.records)
        self.count += 1
        prompt_hash = hashlib.sha256(json.dumps(messages, sort_keys=True).encode()).hexdigest()
        if (
            arm["model"] != record["model"]
            or prompt_hash != record["messages_sha256"]
            or decoding["max_tokens"] != record["max_tokens"]
            or tools
        ):
            raise ValueError("current provider request differs from the actual frozen request")
        return {key: record[key] for key in ("response", "usage", "finish_reason")} | {"tool_calls": []}


def replay_stage(stage: str, version: str) -> dict:
    path = OUTPUT / f"bounded-{version}-{stage}"
    source = DIRECTORY / f"bounded-support-{version}" / stage
    raw = RecordedTransport(rows(path / "all-provider-calls.jsonl"))
    config = json.loads((source / "config.json").read_text())
    router = json.loads((DIRECTORY / "calibration-v2/gemma4-calibration-config.json").read_text())["arms"][0]
    transport = ContextualSupportTransport(raw, router)
    if version in {"v11", "v12"}:
        certificate = json.loads((DIRECTORY / "task-review-v3/certificate.json").read_text())
        transport.task_reviewer = TaskResponseReviewer(raw, router, certificate)
        transport.task_fallback_arm = config["arms"][0]
    cases = {row["id"]: row for row in rows(source / "cases.jsonl")}
    arms = {arm["id"]: arm for arm in config["arms"]}
    matched = []
    for row in rows(path / "results.jsonl"):
        if row["status"] != "success":
            raise ValueError("cannot replay an incomplete response as a pass")
        result = transport.complete(arms[row["arm_id"]], cases[row["case_id"]]["messages"], [], config["decoding"])
        if (
            result["response"] != row["response"]
            or result["usage"] != row["usage"]
            or result["finish_reason"] != row["finish_reason"]
            or result["finish_reason"] != "stop"
        ):
            raise ValueError("current output differs from the actual frozen response")
        matched.append(
            {
                "case_id": row["case_id"],
                "arm": row["arm_id"],
                "response_sha256": hashlib.sha256(result["response"].encode()).hexdigest(),
            }
        )
    if next(raw.records, None) is not None:
        raise ValueError("unused recorded provider calls")
    return {"stage": stage, "matched_responses": len(matched), "matched_provider_calls": raw.count, "results": matched}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", default="v12", choices=("v4", "v5", "v11", "v12"))
    version = parser.parse_args().version
    proof = {
        "passed": True,
        "network_calls": 0,
        "current_implementation_sha256": hashlib.sha256(
            (ROOT / "ai/training/contextual_support_policy.py").read_bytes()
        ).hexdigest(),
        "method": "Exact frozen provider request and response replay; post-run bounds/validation guards checked.",
        "stages": [replay_stage(stage, version) for stage in ("original", "confirmation")],
        "clinical_validation": False,
    }
    write(DIRECTORY / f"bounded-support-{version}/current-code-replay-proof.json", proof)
    print(
        json.dumps(
            {"passed": proof["passed"], "matched_responses": sum(s["matched_responses"] for s in proof["stages"])}
        )
    )


if __name__ == "__main__":
    main()
