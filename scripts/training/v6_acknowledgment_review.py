"""Calibrated nonclinical acknowledgment gate for ordinary support drafts only."""

import hashlib
import json

from ai.training.support_task_review import INPUT_CAP, OUTPUT_CAP, validate as validate_task
from scripts.training.calibrate_v6_acknowledgment_single import packet
from scripts.training.v6_adjustment_repair import RepairedTaskReviewer
from scripts.training.v6_policy_resolution import DIRECTORY, OUTPUT, rows


def calibrated_acknowledgment():
    target = DIRECTORY / "acknowledgment-v11"
    result = json.loads((target / "result.json").read_text())
    plan = json.loads((target / "plan.json").read_text())
    for name, digest in plan["inputs_sha256"].items():
        if hashlib.sha256((target / name).read_bytes()).hexdigest() != digest:
            raise ValueError("acknowledgment calibration input changed")
    if (
        result.get("passed") is not True
        or result.get("calibration_labels") != 24
        or result.get("valid_responses") != 28
    ):
        raise ValueError("acknowledgment calibration incomplete or failed")
    if (
        result.get("raw_results_sha256")
        != hashlib.sha256((OUTPUT / "acknowledgment-v11-judge/results.jsonl").read_bytes()).hexdigest()
    ):
        raise ValueError("acknowledgment calibration outputs changed")
    config = json.loads((target / "judge-config.json").read_text())
    instruction = rows(target / "judge-cases.jsonl")[0]["messages"][0]["content"]
    return {
        "config": config,
        "instruction": instruction,
        "passed": True,
        "instruction_sha256": hashlib.sha256(instruction.encode()).hexdigest(),
    }


class AcknowledgmentReviewer(RepairedTaskReviewer):
    def __init__(self, *args, acknowledgment_bundle, **kwargs):
        super().__init__(*args, **kwargs)
        self.acknowledgment = acknowledgment_bundle

    def require_calibration(self):
        super().require_calibration()
        bundle = self.acknowledgment
        if (
            bundle.get("passed") is not True
            or bundle["config"]["arms"][0]["model"] != self.arm["model"]
            or bundle["instruction_sha256"] != hashlib.sha256(bundle["instruction"].encode()).hexdigest()
        ):
            raise ValueError("acknowledgment reviewer identity mismatch")

    def _adjustment_check(self, messages, response):
        adjustment = super()._adjustment_check(messages, response)
        if not adjustment["met"]:
            return adjustment
        bundle = self.acknowledgment
        request = packet("runtime", messages, response, bundle["instruction"])["messages"]
        if len(json.dumps(request).encode()) + 128 > INPUT_CAP:
            raise ValueError("acknowledgment input exceeds reserved bound")
        result = self.transport.complete(self.arm, request, [], bundle["config"]["decoding"])
        entry = {
            "stage": "acknowledgment_completion",
            "instruction_sha256": bundle["instruction_sha256"],
            "response_sha256": hashlib.sha256(response.encode()).hexdigest(),
            "usage": result.get("usage"),
            "finish_reason": result.get("finish_reason"),
            "scope": "nonclinical_quality_only",
        }
        self.audit.append(entry)
        usage = result.get("usage")
        if (
            result.get("finish_reason") != "stop"
            or not usage
            or any(type(usage.get(k)) is not int for k in ("prompt_tokens", "completion_tokens"))
            or not 0 <= usage["prompt_tokens"] <= INPUT_CAP
            or not 0 <= usage["completion_tokens"] <= OUTPUT_CAP
        ):
            raise ValueError("incomplete acknowledgment check; withheld")
        entry["result"] = validate_task(json.loads(result["response"]))
        return entry["result"]
