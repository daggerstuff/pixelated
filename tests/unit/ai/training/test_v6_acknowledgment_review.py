"""Acknowledgment omissions and incomplete judgments must never become releases."""

import hashlib
import json

import pytest

from scripts.training.v6_acknowledgment_review import AcknowledgmentReviewer


class QueueTransport:
    def __init__(self, acknowledgment):
        self.responses = iter(
            [
                {
                    "response": json.dumps({"offers_practical_action": False, "adjustment_evidence_id": None}),
                    "finish_reason": "stop",
                    "usage": {"prompt_tokens": 100, "completion_tokens": 10},
                },
                acknowledgment,
            ]
        )

    def complete(self, _arm, _messages, _tools, _decoding):
        return next(self.responses)


@pytest.mark.parametrize("damage", [None, "truncated", "missing_usage", "unknown_type"])
def test_acknowledgment_gate_preserves_omissions_and_rejects_invalid_judgments(damage):
    judgment = {
        "response": json.dumps({"met": False, "correction": "Recognize the user's stated exhaustion."}),
        "finish_reason": "stop",
        "usage": {"prompt_tokens": 100, "completion_tokens": 10},
    }
    if damage == "truncated":
        judgment["finish_reason"] = "length"
    elif damage == "missing_usage":
        judgment.pop("usage")
    elif damage == "unknown_type":
        judgment["response"] = json.dumps({"met": "true", "correction": ""})
    instruction = "Synthetic nonclinical criterion"
    bundle = {
        "instruction": instruction,
        "instruction_sha256": hashlib.sha256(instruction.encode()).hexdigest(),
        "config": {"decoding": {"max_tokens": 256}},
        "passed": True,
    }
    reviewer = AcknowledgmentReviewer(QueueTransport(judgment), {"model": "test"}, {}, {}, acknowledgment_bundle=bundle)
    if damage:
        with pytest.raises(ValueError, match=r"incomplete acknowledgment|invalid task-only"):
            reviewer._adjustment_check([{"role": "user", "content": "I'm exhausted."}], "Rest your hands.")
    else:
        result = reviewer._adjustment_check([{"role": "user", "content": "I'm exhausted."}], "Rest your hands.")
        assert not result["met"]
        assert "exhaustion" in result["correction"]
        assert reviewer.audit[-1]["stage"] == "acknowledgment_completion"
