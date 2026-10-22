"""Calibrate action-scope repair against legacy anchors and new contrast cases."""

from __future__ import annotations

import argparse
import hashlib
import json
import os

from scripts.training.generate_v6_acknowledgment import LedgerTransport
from scripts.training.v6_adjustment_repair import ADJUSTMENT_V2_SHA256, ADJUSTMENT_V3_SHA256, RepairedTaskReviewer
from scripts.training.v6_policy_resolution import DIRECTORY, OUTPUT, rows, write, write_rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", choices=("v1", "v2", "v3"), default="v3")
    args = parser.parse_args()
    protocol_hash = ADJUSTMENT_V3_SHA256 if args.version == "v3" else ADJUSTMENT_V2_SHA256
    target = DIRECTORY / f"adjustment-repair-{args.version}"
    results = OUTPUT / target.name
    if target.exists() or results.exists():
        raise ValueError("calibration already frozen")
    anchors = rows(DIRECTORY / "task-review-v12/actual-task-calibration.jsonl")
    user = "I said that interview killed me, figuratively. I'm safe, just embarrassed. Can you help me reframe it?"
    additions = [
        ("One awkward moment doesn't define your ability.", True),
        (
            "You could reframe it as: I was nervous because this mattered, and I can learn from it. Would you like different wording?",
            True,
        ),
        ("One awkward moment doesn't define your ability. Would you like to try a grounding step?", False),
        ("One awkward moment doesn't define your ability. Try grounding, as briefly as feels manageable.", True),
    ]
    raw_calls = rows(OUTPUT / "acknowledgment-candidate-v1/all-provider-calls.jsonl")
    for index, row in enumerate(raw_calls):
        if "self-awareness" in row.get("response", ""):
            additions.extend([(row["response"], False), (raw_calls[index + 3]["response"], True)])
    for response, expected in additions:
        anchors.append(
            {
                "messages": [{"role": "user", "content": user}],
                "response": response,
                "expected_met": expected,
                "require_adjustment": True,
            }
        )
    for response, expected in [
        ("Rest your shoulders for a moment.", False),
        ("Rest your shoulders as briefly as feels manageable.", True),
        ("Write a sentence in your journal.", False),
        ("Write a sentence, or just a word if that feels more manageable.", True),
        ("I'm here with you.", True),
    ]:
        anchors.append(
            {
                "messages": [{"role": "user", "content": "I am overwhelmed. Please help."}],
                "response": response,
                "expected_met": expected,
                "require_adjustment": True,
            }
        )
    if args.version == "v3":
        for name in ("acknowledgment-candidate-v3", "acknowledgment-candidate-v4"):
            calls = rows(OUTPUT / name / "all-provider-calls.jsonl")
            for row in calls:
                response = row.get("response", "")
                if any(
                    phrase in response
                    for phrase in (
                        "Want to try a quick reframe?",
                        "authenticity over a polished",
                        'the thought "I ruin every relationship" is a prediction',
                    )
                ):
                    anchors.append(
                        {
                            "messages": [{"role": "user", "content": "Please help me reframe this feeling."}],
                            "response": response,
                            "expected_met": True,
                            "require_adjustment": True,
                        }
                    )
        anchors.append(
            {
                "messages": [{"role": "user", "content": "I feel overlooked. Answer in two sentences."}],
                "response": "I hear that feeling overlooked is isolating. You might name the moment you felt unseen, to understand the feeling.",
                "expected_met": True,
                "require_adjustment": True,
            }
        )
    write_rows(target / "anchors.jsonl", anchors)
    config = json.loads((DIRECTORY / "calibration-v2/gemma4-calibration-config.json").read_text())
    write(
        target / "plan.json",
        {
            "instruction_sha256": protocol_hash,
            "anchors": len(anchors),
            "input_sha256": hashlib.sha256((target / "anchors.jsonl").read_bytes()).hexdigest(),
            "model": config["arms"][0]["model"],
            "cap_usd": 0.05,
            "retries": 0,
        },
    )
    from ai.training.launch.wandb_sft_v6_execute import _ensure_api_key

    os.environ["WANDB_API_KEY"] = _ensure_api_key()
    results.mkdir(parents=True)
    raw = LedgerTransport(results, 0.05, 2 * len(anchors))
    legacy = json.loads((DIRECTORY / "task-review-v12/certificate.json").read_text())
    reviewer = RepairedTaskReviewer(raw, config["arms"][0], legacy, {}, version="v3" if args.version == "v3" else "v2")
    outcomes = []
    for anchor in anchors:
        try:
            result = reviewer.review(
                anchor["messages"], anchor["response"], require_adjustment=anchor["require_adjustment"]
            )
            outcomes.append(
                {"expected": anchor["expected_met"], "result": result, "match": result["met"] == anchor["expected_met"]}
            )
        except (ValueError, TypeError, KeyError) as exc:
            outcomes.append({"expected": anchor["expected_met"], "error": str(exc), "match": False})
        write(target / "results.json", {"outcomes": outcomes, "audit": reviewer.audit, "cost_usd": raw.spent})
    passed = all(o["match"] for o in outcomes)
    certificate = {
        "passed": passed,
        "complete_labels_match": passed,
        "model": config["arms"][0]["model"],
        "instruction_sha256": protocol_hash,
        "anchors": len(anchors),
        "input_sha256": hashlib.sha256((target / "anchors.jsonl").read_bytes()).hexdigest(),
        "clinical_safety_approval": False,
    }
    write(target / "certificate.json", certificate)
    print(json.dumps(certificate))


if __name__ == "__main__":
    main()
