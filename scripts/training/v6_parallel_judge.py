"""Four bounded inference workers; immutable shards and all raw calls are retained."""

import json
from concurrent.futures import ThreadPoolExecutor

from ai.qa.validation.therapy_bench import paired_eval
from scripts.training.generate_v6_acknowledgment import LedgerTransport
from scripts.training.v6_policy_resolution import rows, write, write_rows


def run_fourway(target, results, cap, max_input_tokens=8192):
    if results.exists():
        raise ValueError("judge output exists; automatic retries prohibited")
    packets = rows(target / "judge-cases.jsonl")
    for i in range(4):
        write_rows(target / f"shard-{i}/cases.jsonl", packets[i::4])

    def worker(i):
        dest = results / f"shard-{i}"
        dest.mkdir(parents=True)
        transport = LedgerTransport(
            dest,
            cap / 4,
            len(packets[i::4]),
            input_token_cap=max_input_tokens,
        )
        request = paired_eval.RunRequest(
            target / f"shard-{i}/cases.jsonl",
            target / "judge-config.json",
            dest,
            paired_eval.RunnerOptions(
                arm_selection="base",
                max_input_tokens=max_input_tokens,
                max_tool_rounds=0,
            ),
        )
        return paired_eval.run_paired(request, transport=transport)

    with ThreadPoolExecutor(max_workers=4) as pool:
        manifests = list(pool.map(worker, range(4)))
    for filename in ("results.jsonl", "all-provider-calls.jsonl"):
        write_rows(results / filename, [r for i in range(4) for r in rows(results / f"shard-{i}" / filename)])
    write(target / "worker-manifests.json", manifests)
    return {
        "responses": len(rows(results / "results.jsonl")),
        "workers": 4,
        "estimated_cost_usd": sum(r["estimated_cost_usd"] for r in rows(results / "all-provider-calls.jsonl")),
        "config": json.loads((target / "judge-config.json").read_text())["run_id"],
    }


def run_sampled(target, results, cap):
    """Standalone judge diagnostic: paired generation harness intentionally requires temperature zero."""
    if results.exists():
        raise ValueError("sampled output exists; retries prohibited")
    cases = paired_eval.load_cases(target / "judge-cases.jsonl")
    config = json.loads((target / "judge-config.json").read_text())
    decoding = config["decoding"]
    if decoding["temperature"] != 1.0 or decoding["max_tokens"] != 4096 or len(config["arms"]) != 1:
        raise ValueError("unexpected sampled judge configuration")
    config_hash = paired_eval.sha256_bytes(paired_eval.canonical_json(config).encode())

    def worker(i):
        dest = results / f"shard-{i}"
        dest.mkdir(parents=True)
        transport = LedgerTransport(dest, cap / 4, len(cases[i::4]))
        outputs = []
        for case in cases[i::4]:
            count = paired_eval.ConservativeAsciiByteCounter().count(case["messages"], [])
            if count > 8192:
                raise ValueError("sampled judge input exceeds bound")
            result = transport.complete(config["arms"][0], case["messages"], [], decoding)
            record = {
                **result,
                "status": "success",
                "case_id": case["id"],
                "arm_id": "base",
                "model": config["arms"][0]["model"],
                "config_sha256": config_hash,
                "case_sha256": paired_eval.sha256_bytes(paired_eval.canonical_json(case).encode()),
            }
            outputs.append(record)
            write_rows(dest / "results.jsonl", outputs)
        return len(outputs)

    with ThreadPoolExecutor(max_workers=4) as pool:
        counts = list(pool.map(worker, range(4)))
    for filename in ("results.jsonl", "all-provider-calls.jsonl"):
        write_rows(results / filename, [r for i in range(4) for r in rows(results / f"shard-{i}" / filename)])
    return {"responses": sum(counts), "cap_usd": cap, "sampling_temperature": 1.0}
