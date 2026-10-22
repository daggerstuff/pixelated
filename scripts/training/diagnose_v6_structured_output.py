"""Freeze a bounded comparison of schema versus strictly validated plain JSON."""

from __future__ import annotations

import copy
import json
import os

from scripts.training.calibrate_v6_acknowledgment_single import validate
from scripts.training.generate_v6_acknowledgment import LedgerTransport
from scripts.training.v6_policy_resolution import DIRECTORY, OUTPUT, rows, write


def main():
    target = DIRECTORY / "acknowledgment-decoding-diagnostic-v1"
    results = OUTPUT / target.name
    if target.exists() or results.exists():
        raise ValueError("diagnostic already frozen")
    cases = rows(DIRECTORY / "acknowledgment-v3/judge-cases.jsonl")[:6]
    config = json.loads((DIRECTORY / "acknowledgment-v3/judge-config.json").read_text())
    write(
        target / "plan.json",
        {
            "cases": cases,
            "config": config,
            "calls": 12,
            "cap_usd": 0.03,
            "retries": 0,
            "scope": "decoding diagnostic, not quality authorization",
        },
    )
    from ai.training.launch.wandb_sft_v6_execute import _ensure_api_key

    os.environ["WANDB_API_KEY"] = _ensure_api_key()
    results.mkdir(parents=True)
    raw = LedgerTransport(results, 0.03, 12)
    ratings = []
    for mode in ("schema_compact", "plain_compact"):
        for case in cases:
            messages = copy.deepcopy(case["messages"])
            schema = config["decoding"]["response_format"]["json_schema"]["schema"]
            messages[0]["content"] += (
                " Return one compact JSON object, with no whitespace outside strings. Schema: " + json.dumps(schema)
            )
            decoding = copy.deepcopy(config["decoding"])
            if mode == "plain_compact":
                decoding.pop("response_format")
            result = raw.complete(config["arms"][0], messages, [], decoding)
            entry = {"mode": mode, "id": case["id"], "finish_reason": result["finish_reason"]}
            try:
                if result["finish_reason"] != "stop":
                    raise ValueError("incomplete output")
                entry["rating"] = validate(json.loads(result["response"]), case)
                entry["valid"] = True
            except (ValueError, TypeError, KeyError) as exc:
                entry.update(valid=False, error=str(exc))
            ratings.append(entry)
            write(target / "results.json", {"ratings": ratings, "cost_usd": raw.spent})
    print(
        json.dumps(
            {
                mode: sum(r["valid"] for r in ratings if r["mode"] == mode)
                for mode in ("schema_compact", "plain_compact")
            }
        )
    )


if __name__ == "__main__":
    main()
