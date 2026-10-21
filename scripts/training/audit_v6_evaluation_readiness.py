#!/usr/bin/env python3
"""Freeze existing diagnostic suites and check prompt overlap with v6 train."""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any

from ai.qa.validation.therapy_bench.paired_eval import load_cases

ROOT = Path(__file__).resolve().parents[2]
RELEASE = Path("docs/training/execution-2026-10-21/wandb-full-corpus-current-master-20261021-v6.json")
SUITES = (
    Path("docs/training/agent-tool-sft-2026-10-19/evaluation/prompt-disjoint-heldout-test-cases.jsonl"),
    Path("docs/training/execution-2026-10-17/scenario-dev-v1.jsonl"),
    Path("docs/training/execution-2026-10-21/safety-quality-dev-v1.jsonl"),
)


def normalized_prompt_hash(value: str) -> str:
    normalized = re.sub(r"\s+", " ", unicodedata.normalize("NFKC", value).casefold()).strip()
    return hashlib.sha256(normalized.encode()).hexdigest()


def user_hashes(row: dict[str, Any]) -> set[str]:
    return {
        normalized_prompt_hash(message["content"])
        for message in row["messages"]
        if message["role"] == "user" and isinstance(message.get("content"), str)
    }


def audit(root: Path) -> dict[str, Any]:
    release = json.loads((root / RELEASE).read_text())
    train = root / release["partitions"]["train"]["path"]
    train_prompts = set()
    train_digest = hashlib.sha256()
    rows = 0
    with train.open("rb") as stream:
        for raw in stream:
            rows += 1
            train_digest.update(raw)
            train_prompts.update(user_hashes(json.loads(raw)))
    if (
        rows != release["partitions"]["train"]["row_count"]
        or train_digest.hexdigest() != release["partitions"]["train"]["sha256"]
    ):
        raise ValueError("v6 training payload identity changed")
    suites = []
    for relative in SUITES:
        raw = (root / relative).read_bytes()
        cases = load_cases(root / relative)
        if any(case.get("split") != "dev" for case in cases):
            raise ValueError("readiness audit only accepts development suites; sealed cases must stay reserved")
        overlaps = [case["id"] for case in cases if user_hashes(case) & train_prompts]
        suites.append(
            {
                "path": relative.as_posix(),
                "sha256": hashlib.sha256(raw).hexdigest(),
                "case_count": len(cases),
                "case_ids": [case["id"] for case in cases],
                "scenario_counts": dict(Counter(case["scenario"] for case in cases)),
                "normalized_user_prompt_overlap_case_ids": overlaps,
                "ready_for_development_diagnostics": not overlaps,
            }
        )
    rubric_path = root / "docs/training/execution-2026-10-21/safety-quality-dev-v1.rubric.json"
    rubric_raw = rubric_path.read_bytes()
    rubric = json.loads(rubric_raw)
    safety_suite = suites[-1]
    if (
        rubric["case_file"] != Path(safety_suite["path"]).name
        or rubric["case_file_sha256"] != safety_suite["sha256"]
        or set(rubric["case_criteria"]) != set(safety_suite["case_ids"])
    ):
        raise ValueError("safety rubric does not bind the frozen case suite")
    for criteria in rubric["case_criteria"].values():
        if not all(
            isinstance(criteria.get(key), str) and criteria[key].strip()
            for key in ("expected_behavior", "failure_conditions")
        ):
            raise ValueError("safety case has incomplete rating criteria")
    return {
        "schema_version": "v6-evaluation-readiness-v1",
        "release_id": release["release_id"],
        "train_rows_checked": rows,
        "train_sha256": train_digest.hexdigest(),
        "unique_normalized_train_user_prompts": len(train_prompts),
        "suites": suites,
        "safety_rubric": {
            "path": rubric_path.relative_to(root).as_posix(),
            "sha256": hashlib.sha256(rubric_raw).hexdigest(),
            "case_criteria_count": len(rubric["case_criteria"]),
            "ratings_completed": False,
            "clinical_validation_claimed": False,
        },
        "matching_settings": {"temperature": 0, "max_tokens": 1024, "max_tool_rounds": 4},
        "provider_calls": 0,
        "launch_authorized_by_this_report": False,
        "remaining_gates": [
            "Completed selected-model jobs and validated locally mirrored final adapters.",
            "Current provider model/adapter inference support and actual credit coverage, prices, and cost cap.",
            "Blinded safety/quality ratings and calibration using the frozen synthetic rubric; no ratings exist yet.",
            "Per-case matched results and paired uncertainty before choosing a next experiment.",
        ],
        "limitations": [
            "Case IDs and files are frozen for both model pairs; development cases may have informed prior experiments.",
            "NFKC/case/whitespace normalized user-text checks do not certify semantic or template independence.",
            "No sealed evaluation cases or explicit v6 holdouts are used, modified, or sent to a provider.",
            "Tool state checks are synthetic diagnostics, not clinical-quality or promotion scores.",
            "The added 24-case safety/quality suite is an unvalidated development screen, not clinical clearance.",
        ],
    }


def main() -> None:
    report = audit(ROOT)
    output = ROOT / "docs/training/execution-2026-10-21/v6-evaluation-readiness.json"
    output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(
        json.dumps(
            {
                "report": str(output),
                "suites": [
                    {key: suite[key] for key in ("path", "case_count", "normalized_user_prompt_overlap_case_ids")}
                    for suite in report["suites"]
                ],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
