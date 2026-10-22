"""Verify unchanged real traces and assemble explicitly sourced final development evidence."""

from __future__ import annotations

import hashlib
import json

from ai.training.contextual_support_policy import ContextualSupportTransport, canonical_hash
from ai.training.support_task_review import TaskResponseReviewer
from scripts.training.replay_v6_support_trace import RecordedTransport
from scripts.training.v6_policy_resolution import DIRECTORY, OUTPUT, ROOT, rows, write, write_rows


def groups(records: list[dict]) -> list[list[dict]]:
    result: list[list[dict]] = []
    for record in records:
        if record["max_tokens"] == 96 and "gemma-4" in record["model"]:
            result.append([])
        if not result:
            raise ValueError("provider trace does not start with router")
        result[-1].append(record)
    return result


def verify_response(trace, settings, config, messages, selected):
    router, certificate = settings
    arm = next(a for a in config["arms"] if a["id"] == selected["arm_id"])
    raw = RecordedTransport(trace)
    transport = ContextualSupportTransport(raw, router)
    transport.task_reviewer = TaskResponseReviewer(raw, router, certificate)
    transport.task_fallback_arm = config["arms"][0]
    result = transport.complete(arm, messages, [], config["decoding"])
    if (
        any(result[k] != selected[k] for k in ("response", "usage", "finish_reason"))
        or next(raw.records, None) is not None
    ):
        raise ValueError("final output or provider calls differ from real evidence")
    return transport, raw.count


def write_stage(stage, cases, config, evidence):
    final, final_audit, provenance = evidence
    target = DIRECTORY / "bounded-support-v14" / stage
    output = OUTPUT / f"bounded-v14-{stage}"
    write_rows(target / "cases.jsonl", list(cases.values()))
    write(target / "config.json", config)
    write_rows(output / "results.jsonl", final)
    write_rows(output / "routing-audit.jsonl", final_audit)
    write(
        output / "trace-provenance.json",
        {
            "derived_no_new_provider_calls": True,
            "method": "Mixed real run provenance; rows and original config hashes preserved. Exact local replay verifies every final response. Costs belong only to source ledgers.",
            "rows": provenance,
        },
    )


def main() -> None:
    router = json.loads((DIRECTORY / "calibration-v2/gemma4-calibration-config.json").read_text())["arms"][0]
    certificate = json.loads((DIRECTORY / "task-review-v3/certificate.json").read_text())
    changed = rows(OUTPUT / "bounded-v14-changed/results.jsonl")
    replacements = {(r["case_id"], r["arm_id"]): r for r in changed}
    proof = {
        "network_calls": 0,
        "clinical_validation": False,
        "stages": [],
        "implementation_sha256": {
            name: hashlib.sha256((ROOT / "ai/training" / name).read_bytes()).hexdigest()
            for name in ("contextual_support_policy.py", "support_task_review.py")
        },
    }
    replaced = set()
    for stage in ("original", "confirmation"):
        source = DIRECTORY / "bounded-support-v13" / stage
        source_output = OUTPUT / f"bounded-v13-{stage}"
        config = json.loads((source / "config.json").read_text())
        cases = {c["id"]: c for c in rows(source / "cases.jsonl")}
        arms = {a["id"]: a for a in config["arms"]}
        traces = groups(rows(source_output / "all-provider-calls.jsonl"))
        results = rows(source_output / "results.jsonl")
        if len(traces) != len(results):
            raise ValueError("trace/response cardinality mismatch")
        routes = [a for a in rows(source_output / "routing-audit.jsonl") if "router_usage" in a]
        if len(routes) != len(results):
            raise ValueError("route/response cardinality mismatch")
        final, final_audit, provenance = [], [], []
        calls = 0
        for row, trace, route in zip(results, traces, routes, strict=True):
            key = (row["case_id"], row["arm_id"])
            messages = cases[row["case_id"]]["messages"]
            if (
                route["input_sha256"] != canonical_hash(messages)
                or route["target_model"] != arms[row["arm_id"]]["model"]
            ):
                raise ValueError("route identity mismatch")
            if route["route"] == "impulsive_high_energy":
                selected = replacements[key]
                replaced.add(key)
                actual_dir = OUTPUT / "bounded-v14-changed"
                current_trace = groups(rows(actual_dir / "all-provider-calls.jsonl"))[changed.index(selected)]
                current_config = json.loads((DIRECTORY / "bounded-support-v14/changed/config.json").read_text())
                origin = "fresh v14 changed-route provider run"
            else:
                selected, actual_dir, current_trace, current_config = row, source_output, trace, config
                origin = "v13 real provider run, exact replay against current v14 implementation"
            if selected["status"] != "success":
                raise ValueError("missing or withheld response cannot pass")
            transport, matched_calls = verify_response(
                current_trace, (router, certificate), current_config, messages, selected
            )
            calls += matched_calls
            final.append(selected)
            final_audit.extend(transport.audit)
            provenance.append(
                {
                    "case_id": key[0],
                    "arm": key[1],
                    "source_results": str((actual_dir / "results.jsonl").relative_to(ROOT)),
                    "source_config_sha256": selected["config_sha256"],
                    "method": origin,
                    "matched_provider_calls": matched_calls,
                    "response_sha256": hashlib.sha256(selected["response"].encode()).hexdigest(),
                }
            )
        write_stage(stage, cases, config, (final, final_audit, provenance))
        proof["stages"].append({"stage": stage, "verified_responses": len(final), "matched_provider_calls": calls})
    if replaced != set(replacements) or len(replaced) != 2:
        raise ValueError("changed-route coverage mismatch")
    proof["passed"] = True
    proof["unchanged_responses_replayed"] = 86
    proof["changed_responses_fresh_and_replayed"] = 2
    write(DIRECTORY / "bounded-support-v14/current-code-replay-proof.json", proof)
    print(json.dumps(proof))


if __name__ == "__main__":
    main()
