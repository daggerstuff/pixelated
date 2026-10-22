"""Replay each real source trace against a selected candidate, retaining original row/config identities.

Makes no network calls. Mixed-source derived rows are explicitly identified and
excluded from usage charges. This verifies implementation continuity, not safety.
"""

from __future__ import annotations

import argparse
import hashlib
import json

from scripts.training.v6_policy_resolution import DIRECTORY, OUTPUT, ROOT, rows, write, write_rows
from scripts.training.verify_v6_policy_final import groups, verify_response


def source_trace(path, key):
    actual = rows(path)
    index = next(i for i, r in enumerate(actual) if (r["case_id"], r["arm_id"]) == key)
    trace = groups(rows(path.parent / "all-provider-calls.jsonl"))[index]
    prefix = path.parent.name.replace("bounded-", "bounded-support-", 1)
    version, stage = prefix.rsplit("-", 1)
    config = json.loads((DIRECTORY / version / stage / "config.json").read_text())
    return trace, config


def replay_stage(stage, changes, settings, versions):
    version, previous = versions
    source = DIRECTORY / f"bounded-support-{previous}" / stage
    cases = {c["id"]: c for c in rows(source / "cases.jsonl")}
    provenance_source = json.loads((OUTPUT / f"bounded-{previous}-{stage}/trace-provenance.json").read_text())["rows"]
    sources = {(p["case_id"], p["arm"]): ROOT / p["source_results"] for p in provenance_source}
    final, audit, provenance = [], [], []
    calls, fresh = 0, 0
    old = rows(OUTPUT / f"bounded-{previous}-{stage}/results.jsonl")
    expected_keys = {(case_id, arm) for case_id in cases for arm in ("base", "sft")}
    if len(old) != len(expected_keys) or {(r["case_id"], r["arm_id"]) for r in old} != expected_keys:
        raise ValueError("missing, duplicate or unexpected source response")
    for row in old:
        key = (row["case_id"], row["arm_id"])
        selected = changes.get(key, row)
        if selected["status"] != "success":
            raise ValueError("cannot accept missing or withheld response")
        path = OUTPUT / f"bounded-{version}-changed/results.jsonl" if key in changes else sources[key]
        trace, config = source_trace(path, key)
        transport, count = verify_response(trace, settings, config, cases[key[0]]["messages"], selected)
        fresh += key in changes
        final.append(selected)
        audit.extend(transport.audit)
        calls += count
        provenance.append(
            {
                "case_id": key[0],
                "arm": key[1],
                "source_results": str(path.relative_to(ROOT)),
                "source_config_sha256": selected["config_sha256"],
                "method": "fresh changed-route response"
                if key in changes
                else f"unchanged real response replayed against current {version} code",
                "matched_provider_calls": count,
                "response_sha256": hashlib.sha256(selected["response"].encode()).hexdigest(),
            }
        )
    target, output = DIRECTORY / f"bounded-support-{version}" / stage, OUTPUT / f"bounded-{version}-{stage}"
    write_rows(target / "cases.jsonl", list(cases.values()))
    write(target / "config.json", json.loads((source / "config.json").read_text()))
    write_rows(output / "results.jsonl", final)
    write_rows(output / "routing-audit.jsonl", audit)
    write(
        output / "trace-provenance.json",
        {
            "derived_no_new_provider_calls": True,
            "rows": provenance,
            "method": "Source real row hashes preserved. Costs counted only in underlying provider ledgers.",
        },
    )
    return {"stage": stage, "verified_responses": len(final), "matched_provider_calls": calls, "fresh_responses": fresh}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", choices=("v15", "v16", "v17", "v18"), default="v18")
    version = parser.parse_args().version
    previous = "v15" if version in {"v16", "v17", "v18"} else "v14"
    router = json.loads((DIRECTORY / "calibration-v2/gemma4-calibration-config.json").read_text())["arms"][0]
    certificate_version = {"v17": "v10", "v18": "v12"}.get(version, "v3")
    certificate = json.loads((DIRECTORY / f"task-review-{certificate_version}/certificate.json").read_text())
    changed = rows(OUTPUT / f"bounded-{version}-changed/results.jsonl")
    expected = json.loads((DIRECTORY / f"bounded-support-{version}/changed/plan.json").read_text())["responses"]
    if len(changed) != expected or any(r["status"] != "success" for r in changed):
        raise ValueError("changed run incomplete")
    changes = {(r["case_id"], r["arm_id"]): r for r in changed}
    if len(changes) != expected:
        raise ValueError("duplicate changed responses")
    proof = {
        "network_calls": 0,
        "clinical_validation": False,
        "stages": [
            replay_stage(stage, changes, (router, certificate), (version, previous))
            for stage in ("original", "confirmation")
        ],
        "implementation_sha256": {
            name: hashlib.sha256((ROOT / "ai/training" / name).read_bytes()).hexdigest()
            for name in ("contextual_support_policy.py", "support_task_review.py")
        },
        "passed": True,
        "unchanged_responses_replayed": 88 - expected,
        "changed_responses_fresh_and_replayed": expected,
    }
    if sum(stage["fresh_responses"] for stage in proof["stages"]) != len(changes):
        raise ValueError("unused changed response")
    write(DIRECTORY / f"bounded-support-{version}/current-code-replay-proof.json", proof)
    print(json.dumps(proof))


if __name__ == "__main__":
    main()
