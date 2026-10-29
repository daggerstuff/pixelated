"""Build an identity-blinded packet from the exact completed v70 paired run."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RUN = (
    ROOT / "docs/training/execution-2026-10-21/policy-resolution-v1/bounded-support-v70/fresh-transaction-and-retry-v1"
)
OUTPUT = ROOT / "ai/training/output/v6-policy-resolution-v1/bounded-v70-fresh-transaction-and-retry-v1"
REVIEW = ROOT / "docs/training/execution-2026-10-21/policy-resolution-v1/bounded-support-v70/paige-review"


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build() -> None:
    if REVIEW.exists():
        raise ValueError("v70 review packet already exists; refusing overwrite")
    cases = read_jsonl(RUN / "cases.jsonl")
    results = read_jsonl(OUTPUT / "results.jsonl")
    by_case: dict[str, list[dict]] = {}
    for result in results:
        by_case.setdefault(result["case_id"], []).append(result)
    REVIEW.mkdir(parents=True)
    packet = []
    for index, case in enumerate(cases, start=1):
        pair = by_case.get(case["id"], [])
        if len(pair) != 2 or any(result["status"] != "success" for result in pair):
            raise ValueError(f"case {case['id']} does not have two successful paired outputs")
        if {result["arm_id"] for result in pair} != {"base", "sft"}:
            raise ValueError(f"case {case['id']} arm coverage is incomplete")
        ordered = sorted(pair, key=lambda result: result["arm_id"])
        if hashlib.sha256(f"v70:{case['id']}".encode()).digest()[0] & 1:
            ordered.reverse()
        packet.append(
            {
                "packet_id": f"v70-transaction-review-{index:03d}",
                "case_id": case["id"],
                "scenario": case["scenario"],
                "messages": case["messages"],
                "follow_up_user_messages": case.get("follow_up_user_messages", []),
                "tools": case.get("tools", []),
                "tool_fixtures": case.get("tool_fixtures", {}),
                "state_checks": case.get("state_checks", []),
                "A": {
                    "response": ordered[0]["response"],
                    "tool_trace": ordered[0].get("tool_trace", []),
                    "state_metrics": ordered[0].get("state_metrics", []),
                    "finish_reason": ordered[0].get("finish_reason"),
                },
                "B": {
                    "response": ordered[1]["response"],
                    "tool_trace": ordered[1].get("tool_trace", []),
                    "state_metrics": ordered[1].get("state_metrics", []),
                    "finish_reason": ordered[1].get("finish_reason"),
                },
            }
        )
    packet_path = REVIEW / "SOURCE-BLINDED-PAIRS.jsonl"
    packet_path.write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in packet))
    manifest = {
        "candidate": "bounded-support-v70-runtime",
        "case_count": len(packet),
        "response_count": 2 * len(packet),
        "blindness": "A/B labels assigned from case ID hash before assessment; no model or arm identity included in this packet.",
        "files": {
            "locked_cases_sha256": sha256(RUN / "cases.jsonl"),
            "paired_results_sha256": sha256(OUTPUT / "results.jsonl"),
            "blinded_pairs_sha256": sha256(packet_path),
        },
        "diagnostic_validity": "synthetic tool state; not clinical validation or deployment authorization",
    }
    (REVIEW / "review-packet-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    build()
