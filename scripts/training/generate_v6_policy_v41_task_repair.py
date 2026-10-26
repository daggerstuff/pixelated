"""Run all 56 frozen cases against the v40 task repair."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path

from ai.qa.validation.therapy_bench import paired_eval
from ai.training.contextual_support_policy import SupportInputReservation, canonical_hash
from ai.training.launch.wandb_sft_v6_execute import _ensure_api_key
from ai.training.run_wandb_paired_eval import WandbAsyncTransport
from scripts.training.generate_v6_acknowledgment import build_transport
from scripts.training.v6_policy_resolution import DIRECTORY, OUTPUT, rows, write, write_rows

VERSION = "v41"
SOURCE = DIRECTORY / "bounded-support-v40"
TARGET = DIRECTORY / f"bounded-support-{VERSION}"
RESULTS = OUTPUT / f"bounded-{VERSION}"
ESTIMATED_SPEND_CAP_USD = 0.05
MAX_PROVIDER_CALLS = 800


class LedgerTransport:
    def __init__(self):
        self.raw = WandbAsyncTransport()
        self.spent = 0.0
        self.calls = 0
        self.active_key = ""

    def set_active_response(self, case_id: str, arm_id: str) -> None:
        self.active_key = f"{case_id}:{arm_id}"

    def complete(self, arm, messages, tools, decoding):
        input_rate, output_rate = (0.1, 0.3) if "gemma-4" in arm["model"] else (0.07, 0.2)
        reserve = (8192 * input_rate + decoding["max_tokens"] * output_rate) / 1_000_000
        if self.calls >= MAX_PROVIDER_CALLS or self.spent + reserve > ESTIMATED_SPEND_CAP_USD:
            raise ValueError("targeted safety repair provider-call or estimated-spend cap reached")
        self.calls += 1
        record = {
            "response_key": self.active_key,
            "model": arm["model"],
            "messages_sha256": hashlib.sha256(json.dumps(messages, sort_keys=True).encode()).hexdigest(),
            "max_tokens": decoding["max_tokens"],
            "decoding": decoding,
        }
        try:
            result = self.raw.complete(arm, messages, tools, decoding)
        except Exception as exc:
            write(
                RESULTS / f"failed-call-{self.calls:04d}.json",
                {
                    **record,
                    "error_type": type(exc).__name__,
                    "reserved_max_cost_usd": reserve,
                },
            )
            raise
        usage = result.get("usage")
        if not isinstance(usage, dict) or any(
            type(usage.get(key)) is not int or usage[key] < 0 for key in ("prompt_tokens", "completion_tokens")
        ):
            write(RESULTS / f"invalid-call-{self.calls:04d}.json", {**record, "result": result})
            raise ValueError("provider returned invalid usage")
        cost = (usage["prompt_tokens"] * input_rate + usage["completion_tokens"] * output_rate) / 1_000_000
        self.spent += cost
        record.update(result, estimated_cost_usd=cost)
        with (RESULTS / "all-provider-calls.jsonl").open("a") as stream:
            stream.write(json.dumps(record, ensure_ascii=False) + "\n")
        if usage["prompt_tokens"] > 8192 or usage["completion_tokens"] > decoding["max_tokens"]:
            raise ValueError("provider usage exceeded the reserved bounds")
        return result


class KeyedTransport:
    def __init__(self, raw: LedgerTransport, inner, case_by_input: dict[str, str]):
        self.raw = raw
        self.inner = inner
        self.case_by_input = case_by_input

    def complete(self, arm, messages, tools, decoding):
        if not tools:
            user_key = canonical_hash(messages)
            case_id = self.case_by_input.get(user_key)
            if case_id is None:
                raise ValueError("support request does not map to a frozen synthetic case")
            self.raw.set_active_response(case_id, arm["id"])
        return self.inner.complete(arm, messages, tools, decoding)


def prepare() -> tuple[dict, list[dict]]:
    if RESULTS.exists():
        raise ValueError(f"{VERSION} results exist; refusing automatic repeat or resume")
    if TARGET.exists():
        plan_path = TARGET / "plan.json"
        if not plan_path.exists() or not (TARGET / "cases.jsonl").exists() or not (TARGET / "config.json").exists():
            raise ValueError("existing candidate is incomplete; refusing to overwrite")
        plan = json.loads(plan_path.read_text())
        if (
            plan.get("run_status") != "prepared_not_run"
            or plan.get("candidate") != VERSION
            or plan.get("policy_source_sha256")
            != hashlib.sha256(Path("ai/training/contextual_support_policy.py").read_bytes()).hexdigest()
        ):
            raise ValueError(f"prepared {VERSION} identity is stale or already used; refusing run")
        return json.loads((TARGET / "config.json").read_text()), rows(TARGET / "cases.jsonl")
    cases = rows(SOURCE / "cases.jsonl")
    if len(cases) != 56 or len({case["id"] for case in cases}) != len(cases):
        raise ValueError("expected the complete 56-case frozen v35 review set")
    config = json.loads((SOURCE / "config.json").read_text())
    config["run_id"] = f"v6-bounded-support-{VERSION}-targeted-repair"
    config["pricing"]["hard_cap_usd"] = 0.10
    write_rows(TARGET / "cases.jsonl", cases)
    write(TARGET / "config.json", config)
    plan = {
        "candidate": VERSION,
        "objective": "Recheck both model arms on the same frozen 56-case synthetic set after correcting the independently identified oversized one-action guard.",
        "cases": len(cases),
        "paired_responses": 2 * len(cases),
        "run_status": "prepared_not_run",
        "provider_call_cap": MAX_PROVIDER_CALLS,
        "estimated_usage_cap_usd": ESTIMATED_SPEND_CAP_USD,
        "actual_billing_verified": False,
        "source_case_sha256": hashlib.sha256((SOURCE / "cases.jsonl").read_bytes()).hexdigest(),
        "policy_source_sha256": hashlib.sha256(
            Path("ai/training/contextual_support_policy.py").read_bytes()
        ).hexdigest(),
        "clinical_validation_claimed": False,
        "qualified_independent_review_completed": False,
        "deployment_authorized": False,
    }
    write(TARGET / "plan.json", plan)
    return config, cases


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    arguments = parser.parse_args()
    config, cases = prepare()
    router = json.loads((DIRECTORY / "calibration-v2/gemma4-calibration-config.json").read_text())["arms"][0]
    certificate = json.loads((DIRECTORY / "task-review-v12/certificate.json").read_text())
    request = paired_eval.RunRequest(
        TARGET / "cases.jsonl",
        TARGET / "config.json",
        RESULTS,
        paired_eval.RunnerOptions(max_input_tokens=8192, max_tool_rounds=0),
    )
    counter = SupportInputReservation(paired_eval.ConservativeAsciiByteCounter())
    dry_run = paired_eval.build_dry_run_report(request, counter)
    if dry_run["provider_calls"] != 0 or dry_run["estimated_max_cost_usd"] > config["pricing"]["hard_cap_usd"]:
        raise ValueError("safety suite preflight or provider price cap failed")
    write(TARGET / "dry-run.json", dry_run)
    if arguments.dry_run:
        print(json.dumps({"candidate": VERSION, **dry_run, "provider_calls": 0}))
        return

    os.environ["WANDB_API_KEY"] = _ensure_api_key()
    RESULTS.mkdir(parents=True)
    raw = LedgerTransport()
    inner = build_transport(raw, router, certificate, RESULTS, version="v31")
    inner.task_fallback_arm = router
    transport = KeyedTransport(
        raw,
        inner,
        {canonical_hash(case["messages"]): case["id"] for case in cases},
    )
    result = paired_eval.run_paired(request, transport=transport, token_counter=counter)
    run = {
        **result,
        "all_provider_calls": raw.calls,
        "all_provider_estimated_cost_usd": raw.spent,
        "actual_billed_cost_verified": False,
        "clinical_validation": False,
        "qualified_independent_review_completed": False,
        "deployment_authorized": False,
    }
    write(TARGET / "run-result.json", run)
    plan = json.loads((TARGET / "plan.json").read_text())
    plan["run_status"] = result["status"]
    plan["actual_provider_calls"] = raw.calls
    plan["estimated_provider_cost_usd"] = raw.spent
    write(TARGET / "plan.json", plan)
    if result["status"] != "complete":
        raise ValueError("targeted safety repair run did not complete; partial results retained")
    print(
        json.dumps(
            {
                "candidate": VERSION,
                "status": result["status"],
                "responses": len(rows(RESULTS / "results.jsonl")),
                "provider_calls": raw.calls,
                "estimated_cost_usd": raw.spent,
                "actual_billing_verified": False,
                "network_calls_expected": raw.calls,
                "clinical_validation": False,
                "deployment_authorized": False,
            }
        )
    )


if __name__ == "__main__":
    main()
