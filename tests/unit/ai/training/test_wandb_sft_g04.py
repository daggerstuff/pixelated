from __future__ import annotations

import json
from pathlib import Path

import pytest

from ai.training.launch.wandb_sft_g04 import QualificationError, _validate_group_evidence, _validate_train_rows


def write_payload(path: Path, system_weight: int) -> None:
    row = {
        "messages": [
            {"role": "system", "content": "Classify the request.", "weight": system_weight},
            {"role": "user", "content": "A short request.", "weight": 0},
            {"role": "assistant", "content": "A concise response.", "weight": 1},
        ]
    }
    path.write_text(json.dumps(row) + "\n", encoding="utf-8")


def test_train_payload_accepts_zero_weight_system_context(tmp_path: Path) -> None:
    payload = tmp_path / "train.jsonl"
    write_payload(payload, system_weight=0)

    assert _validate_train_rows(payload, expected_rows=1) == 1


def test_train_payload_rejects_system_loss_weight(tmp_path: Path) -> None:
    payload = tmp_path / "train.jsonl"
    write_payload(payload, system_weight=1)

    with pytest.raises(QualificationError, match="assistant-only loss mask"):
        _validate_train_rows(payload, expected_rows=1)


def test_train_payload_accepts_weighted_tool_rounds(tmp_path: Path) -> None:
    payload = tmp_path / "train.jsonl"
    row = {
        "messages": [
            {"role": "system", "content": "Use tools carefully.", "weight": 0},
            {"role": "user", "content": "Read one record.", "weight": 0},
            {
                "role": "assistant",
                "content": None,
                "tool_calls": [
                    {
                        "id": "call-1",
                        "type": "function",
                        "function": {"name": "read_record", "arguments": '{"id":"R-1"}'},
                    }
                ],
                "weight": 1,
            },
            {"role": "tool", "tool_call_id": "call-1", "content": '{"id":"R-1"}', "weight": 0},
            {"role": "assistant", "content": "Record R-1 is available.", "weight": 1},
        ]
    }
    payload.write_text(json.dumps(row) + "\n", encoding="utf-8")

    assert _validate_train_rows(payload, expected_rows=1) == 1


def test_train_payload_rejects_tool_response_without_call(tmp_path: Path) -> None:
    payload = tmp_path / "train.jsonl"
    row = {
        "messages": [
            {"role": "user", "content": "Read one record.", "weight": 0},
            {"role": "tool", "tool_call_id": "missing", "content": '{"id":"R-1"}', "weight": 0},
            {"role": "assistant", "content": "Done.", "weight": 1},
        ]
    }
    payload.write_text(json.dumps(row) + "\n", encoding="utf-8")

    with pytest.raises(QualificationError, match="unmatched tool response"):
        _validate_train_rows(payload, expected_rows=1)


def test_train_payload_rejects_invalid_tool_arguments(tmp_path: Path) -> None:
    payload = tmp_path / "train.jsonl"
    row = {
        "messages": [
            {"role": "user", "content": "Read one record.", "weight": 0},
            {
                "role": "assistant",
                "content": None,
                "tool_calls": [
                    {
                        "id": "call-1",
                        "type": "function",
                        "function": {"name": "read_record", "arguments": "not-json"},
                    }
                ],
                "weight": 1,
            },
            {"role": "tool", "tool_call_id": "call-1", "content": "{}", "weight": 0},
            {"role": "assistant", "content": "Done.", "weight": 1},
        ]
    }
    payload.write_text(json.dumps(row) + "\n", encoding="utf-8")

    with pytest.raises(QualificationError, match="invalid tool-call arguments"):
        _validate_train_rows(payload, expected_rows=1)


def test_group_evidence_accepts_prompt_disjoint_key() -> None:
    manifest = {
        "evidence": {
            "group_disjointness": {
                "status": "verified",
                "group_key": "prompt_group_sha256",
                "train_group_count": 10,
                "validation_group_count": 2,
                "test_group_count": 3,
                "pairwise_intersections": {
                    "train_validation": 0,
                    "train_test": 0,
                    "validation_test": 0,
                },
                "evidence_path": "rowrefs.jsonl",
                "evidence_sha256": "a" * 64,
            }
        }
    }

    evidence = _validate_group_evidence(manifest)

    assert evidence["group_key"] == "prompt_group_sha256"
