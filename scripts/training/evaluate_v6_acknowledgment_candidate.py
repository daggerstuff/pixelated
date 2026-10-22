"""Blinded single-response development review with four bounded judge workers."""

from __future__ import annotations

import argparse
import hashlib
import json
import os

from ai.qa.validation.therapy_bench import paired_eval
from scripts.training.calibrate_v6_acknowledgment_single import audit, packet
from scripts.training.generate_v6_acknowledgment import LedgerTransport
from scripts.training.v6_policy_resolution import DIRECTORY, OUTPUT, rows, write, write_rows

TARGET = DIRECTORY / "acknowledgment-candidate-v8-review"
RESULTS = OUTPUT / TARGET.name


def prepare():
    if TARGET.exists() or RESULTS.exists():
        raise ValueError("candidate review inputs already exist")
    source = DIRECTORY / "acknowledgment-candidate-v8"
    source_results = OUTPUT / source.name / "results.jsonl"
    calibration = json.loads((DIRECTORY / "acknowledgment-v11/result.json").read_text())
    if not calibration["passed"]:
        raise ValueError("judge calibration failed; candidate ratings unauthorized")
    cases = {c["id"]: c for c in rows(source / "cases.jsonl")}
    originals = rows(source_results)
    if len(originals) != 2 * len(cases) or any(r["status"] != "success" for r in originals):
        raise ValueError("candidate generation incomplete; failures must not be excluded")
    judge_case = rows(DIRECTORY / "acknowledgment-v11/judge-cases.jsonl")[0]
    instruction = judge_case["messages"][0]["content"]
    config = json.loads((DIRECTORY / "acknowledgment-v11/judge-config.json").read_text())
    config["run_id"] = "v6-acknowledgment-candidate-v8-review"
    config["pricing"]["hard_cap_usd"] = 0.08
    packets, mapping = [], []
    for i, row in enumerate(originals):
        ident = f"review-evidence-{i:03d}"
        packets.append(packet(ident, cases[row["case_id"]]["messages"], row["response"], instruction))
        mapping.append({"packet_id": ident, "case_id": row["case_id"], "arm": row["arm_id"]})
    write_rows(TARGET / "judge-cases.jsonl", packets)
    write(TARGET / "judge-config.json", config)
    write_rows(TARGET / "sealed-mapping.jsonl", mapping)
    write(TARGET / "expected-labels.json", {})
    counts = {c["id"]: paired_eval.ConservativeAsciiByteCounter().count(c["messages"], []) for c in packets}
    if max(counts.values()) > 8192:
        raise ValueError("candidate judge input bound exceeded")
    write(
        TARGET / "dry-run.json",
        {"mode": "standalone_sampled_judge", "input_bounds": counts, "output_cap": 256, "aggregate_cap_usd": 0.08},
    )
    write(
        TARGET / "plan.json",
        {
            "inputs_sha256": {
                str(p.relative_to(TARGET)): hashlib.sha256(p.read_bytes()).hexdigest()
                for p in TARGET.rglob("*")
                if p.is_file()
            },
            "source_results_sha256": hashlib.sha256(source_results.read_bytes()).hexdigest(),
            "workers": 1,
            "worker_cap_usd": 0.08,
            "aggregate_cap_usd": 0.08,
            "retries": 0,
            "scope": "adaptive development task quality, not clinical safety",
        },
    )
    return {"responses": len(packets), "cap_usd": 0.08}


def run():
    if RESULTS.exists():
        raise ValueError("review outputs already exist; no automatic retries")
    from ai.training.launch.wandb_sft_v6_execute import _ensure_api_key

    os.environ["WANDB_API_KEY"] = _ensure_api_key()

    RESULTS.mkdir(parents=True)
    request = paired_eval.RunRequest(
        TARGET / "judge-cases.jsonl",
        TARGET / "judge-config.json",
        RESULTS,
        paired_eval.RunnerOptions(arm_selection="base", max_input_tokens=8192, max_tool_rounds=0),
    )
    manifest = paired_eval.run_paired(request, transport=LedgerTransport(RESULTS, 0.08, 48))
    write(TARGET / "run-result.json", manifest)
    return audit(TARGET, RESULTS)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("prepare", "run", "audit"))
    action = parser.parse_args().action
    result = prepare() if action == "prepare" else (run() if action == "run" else audit(TARGET, RESULTS))
    print(json.dumps(result))


if __name__ == "__main__":
    main()
