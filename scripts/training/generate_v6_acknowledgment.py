"""Bounded fresh base/SFT probes using unchanged v18 middleware, with every call retained."""

from __future__ import annotations

import argparse
import hashlib
import json
import os

from ai.qa.validation.therapy_bench import paired_eval
from ai.training.contextual_support_policy import ContextualSupportTransport, SupportInputReservation
from ai.training.run_wandb_paired_eval import WandbAsyncTransport
from ai.training.support_task_review import TaskResponseReviewer
from scripts.training.calibrate_v6_acknowledgment import CONTROLS
from scripts.training.v6_acknowledgment_candidate import GUIDANCE_V2, AcknowledgmentDraftTransport
from scripts.training.v6_policy_resolution import DIRECTORY, OUTPUT, rows, write, write_rows

TARGET = DIRECTORY / "acknowledgment-fresh-v1"
RESULTS = OUTPUT / "acknowledgment-fresh-v1"
CAP = 0.27


class LedgerTransport:
    def __init__(self, results=RESULTS, cap=CAP, max_calls=312, input_token_cap=8192):
        self.raw = WandbAsyncTransport()
        self.results, self.cap, self.max_calls = results, cap, max_calls
        self.input_token_cap = input_token_cap
        self.spent = 0.0
        self.calls = 0

    def complete(self, arm, messages, tools, decoding):
        input_rate, output_rate = (0.1, 0.3) if "gemma-4" in arm["model"] else (0.07, 0.2)
        reserve = (self.input_token_cap * input_rate + decoding["max_tokens"] * output_rate) / 1e6
        if self.calls >= self.max_calls or self.spent + reserve > self.cap:
            raise ValueError("all-provider-call budget exhausted; no new call made")
        self.calls += 1
        record = {
            "model": arm["model"],
            "messages_sha256": hashlib.sha256(json.dumps(messages, sort_keys=True).encode()).hexdigest(),
            "max_tokens": decoding["max_tokens"],
            "decoding": decoding,
        }
        try:
            result = self.raw.complete(arm, messages, tools, decoding)
        except Exception as exc:
            write(
                self.results / f"failed-call-{self.calls:03d}.json",
                {**record, "error_type": type(exc).__name__, "reserved_max_cost_usd": reserve},
            )
            raise
        usage = result["usage"]
        if any(type(usage.get(k)) is not int or usage[k] < 0 for k in ("prompt_tokens", "completion_tokens")):
            write(self.results / f"invalid-call-{self.calls:03d}.json", {**record, "result": result})
            raise ValueError("invalid provider usage")
        cost = (usage["prompt_tokens"] * input_rate + usage["completion_tokens"] * output_rate) / 1e6
        self.spent += cost
        record.update(result, estimated_cost_usd=cost)
        with (self.results / "all-provider-calls.jsonl").open("a") as stream:
            stream.write(json.dumps(record) + "\n")
        if usage["prompt_tokens"] > self.input_token_cap or usage["completion_tokens"] > decoding["max_tokens"]:
            raise ValueError("provider usage exceeds reservation")
        return result


def build_transport(raw, router, certificate, results, version=None):
    candidate = version is not None
    version_number = int(version.removeprefix("v")) if candidate else 0
    if candidate:
        drafts = (
            AcknowledgmentDraftTransport(raw, GUIDANCE_V2) if version_number >= 2 else AcknowledgmentDraftTransport(raw)
        )
    else:
        drafts = raw
    if candidate and version_number >= 4:
        from scripts.training.v6_support_revision import ConversationalRevisionTransport

        drafts = ConversationalRevisionTransport(
            drafts,
            remove_generic_example=version_number >= 5,
            sample_revisions=version_number >= 6,
        )
    transport = ContextualSupportTransport(
        drafts, router, audit_path=results / "routing-audit.jsonl" if results else None
    )
    if candidate and version == "v3":
        from scripts.training.v6_support_revision import RevisionSupportTransport

        transport = RevisionSupportTransport(
            drafts, router, audit_path=results / "routing-audit.jsonl" if results else None
        )
    if candidate and version_number >= 8:
        from scripts.training.v6_support_revision import ExplicitViolationSupportTransport

        transport = ExplicitViolationSupportTransport(
            drafts, router, audit_path=results / "routing-audit.jsonl" if results else None
        )
    transport.task_reviewer = TaskResponseReviewer(drafts, router, certificate)
    if candidate and version_number >= 2:
        from scripts.training.v6_adjustment_repair import RepairedTaskReviewer

        adjustment_certificate = json.loads(
            (DIRECTORY / f"adjustment-repair-{'v3' if version_number >= 5 else 'v2'}/certificate.json").read_text()
        )
        transport.task_reviewer = RepairedTaskReviewer(
            drafts,
            router,
            certificate,
            adjustment_certificate,
            version="v3" if version_number >= 5 else "v2",
        )
        transport.task_reviewer.require_calibration()
    if candidate and version_number >= 7:
        from scripts.training.v6_acknowledgment_review import AcknowledgmentReviewer, calibrated_acknowledgment

        transport.task_reviewer = AcknowledgmentReviewer(
            drafts,
            router,
            certificate,
            adjustment_certificate,
            version="v3",
            acknowledgment_bundle=calibrated_acknowledgment(),
        )
        transport.task_reviewer.require_calibration()
    return transport


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--candidate", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--candidate-version",
        choices=(
            "v1",
            "v2",
            "v3",
            "v4",
            "v5",
            "v6",
            "v7",
            "v8",
            "v9",
            "v10",
            "v11",
            "v12",
            "v13",
            "v14",
            "v15",
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
        default="v1",
    )
    args = parser.parse_args()
    candidate = args.candidate
    version = args.candidate_version
    target = DIRECTORY / f"acknowledgment-candidate-{version}" if candidate else TARGET
    results = OUTPUT / f"acknowledgment-candidate-{version}" if candidate else RESULTS
    cap, max_calls = (0.54, 624) if candidate else (CAP, 312)
    if results.exists():
        raise ValueError("provider results already exist; refusing automatic repeat or resume")
    if target.exists():
        existing_plan = target / "plan.json"
        existing_cases = target / "cases.jsonl"
        if not existing_plan.is_file() or not existing_cases.is_file():
            raise ValueError("existing candidate is incomplete; refusing overwrite")
        prepared = json.loads(existing_plan.read_text())
        if (
            prepared.get("run_status") != "prepared_not_run"
            or prepared.get("candidate") != version
            or hashlib.sha256(existing_cases.read_bytes()).hexdigest() != prepared.get("input_sha256")
        ):
            raise ValueError("existing candidate is stale or already used; refusing overwrite")
    template = DIRECTORY / "bounded-support-v18/confirmation"
    config = json.loads((template / "config.json").read_text())
    config["run_id"] = f"v6-acknowledgment-candidate-{version}" if candidate else "v6-acknowledgment-fresh-v1"
    config["pricing"]["hard_cap_usd"] = cap
    cases = [
        {
            "id": f"ack-fresh-{i:02d}",
            "group_id": f"ack-fresh-{i:02d}",
            "scenario": "support_quality",
            "suite": "adaptive-acknowledgment-development",
            "split": "dev",
            "messages": [
                {
                    "role": "system",
                    "content": "You are a supportive assistant. Be accurate, respect consent and privacy, and respond to the user's stated needs. You have no external tools in this conversation.",
                },
                {"role": "user", "content": user},
            ],
            "tools": [],
            "state_checks": [],
        }
        for i, (user, _, _) in enumerate(CONTROLS)
    ]
    if candidate:
        from ai.training.contextual_support_policy import canonical_hash

        for stage in ("original", "confirmation"):
            source = DIRECTORY / f"bounded-support-v18/{stage}/cases.jsonl"
            routes = rows(OUTPUT / f"bounded-v18-{stage}/routing-audit.jsonl")
            ordinary = {r["input_sha256"] for r in routes if "router_usage" in r and r["route"] == "ordinary"}
            cases.extend(c for c in rows(source) if canonical_hash(c["messages"]) in ordinary)
    write_rows(target / "cases.jsonl", cases)
    write(target / "config.json", config)
    router = json.loads((DIRECTORY / "calibration-v2/gemma4-calibration-config.json").read_text())["arms"][0]
    certificate = json.loads((DIRECTORY / "task-review-v12/certificate.json").read_text())
    request = paired_eval.RunRequest(
        target / "cases.jsonl",
        target / "config.json",
        results,
        paired_eval.RunnerOptions(max_input_tokens=8192, max_tool_rounds=0),
    )
    counter = SupportInputReservation(paired_eval.ConservativeAsciiByteCounter())
    write(target / "dry-run.json", paired_eval.build_dry_run_report(request, counter))
    write(
        target / "plan.json",
        {
            "candidate": version if candidate else "acknowledgment-fresh-v1",
            "run_status": "prepared_not_run",
            "cases": len(cases),
            "responses": 2 * len(cases),
            "all_provider_cost_cap_usd": cap,
            "max_provider_calls": max_calls,
            "retries": 0,
            "runtime_changed": candidate,
            "candidate_opt_in_only": candidate,
            "revision_decoding_override": {"temperature": 1.0, "scope": "ordinary generated revisions only"}
            if candidate and int(version.removeprefix("v")) >= 6
            else None,
            "scope": "Adaptive synthetic development; agent-authored requests; no clinical validation",
            "input_sha256": hashlib.sha256((target / "cases.jsonl").read_bytes()).hexdigest(),
        },
    )
    if args.dry_run:
        print(json.dumps({"status": "prepared_not_run", **json.loads((target / "dry-run.json").read_text())}))
        return
    from ai.training.launch.wandb_sft_v6_execute import _ensure_api_key

    os.environ["WANDB_API_KEY"] = _ensure_api_key()
    results.mkdir(parents=True)
    raw = LedgerTransport(results, cap, max_calls)
    transport = build_transport(raw, router, certificate, results, version if candidate else None)
    transport.task_fallback_arm = router if candidate and int(version.removeprefix("v")) >= 7 else config["arms"][0]
    result = paired_eval.run_paired(request, transport=transport, token_counter=counter)
    write(
        target / "run-result.json",
        {**result, "all_provider_calls": raw.calls, "all_provider_estimated_cost_usd": raw.spent},
    )
    print(
        json.dumps(
            {
                "status": result["status"],
                "provider_calls": raw.calls,
                "estimated_cost_usd": raw.spent,
                "responses": len(rows(results / "results.jsonl")),
            }
        )
    )


if __name__ == "__main__":
    main()
