"""Draft guidance must preserve tool/consent, routing and review request identity."""

import copy

import pytest

from ai.training.contextual_support_policy import routed_messages
from scripts.training.calibrate_v6_acknowledgment_single import packet, validate
from scripts.training.v6_acknowledgment_candidate import GUIDANCE, AcknowledgmentDraftTransport


class RecordingTransport:
    def complete(self, arm, messages, tools, decoding):
        self.request = (arm, messages, tools, decoding)
        return {"response": "Recorded result"}


@pytest.mark.parametrize("kind", ["tools", "router", "reviewer", "boundary", "ordinary"])
def test_only_ordinary_drafts_receive_guidance(kind):
    messages = [{"role": "system", "content": "Original"}, {"role": "user", "content": "One action, no reflection."}]
    if kind in {"tools", "ordinary"}:
        messages = routed_messages(messages, "ordinary")
    elif kind == "boundary":
        messages = routed_messages(messages, "medication_schedule")
    tools = [{"function": {"name": "book", "parameters": {"consent": True}}}] if kind == "tools" else []
    original = copy.deepcopy(messages)
    arm, decoding = {"model": "test"}, {"max_tokens": 1024}
    raw = RecordingTransport()
    result = AcknowledgmentDraftTransport(raw).complete(arm, messages, tools, decoding)
    assert result == {"response": "Recorded result"}
    assert messages == original
    assert raw.request[0] is arm
    assert raw.request[2] is tools
    assert raw.request[3] is decoding
    if kind == "ordinary":
        assert raw.request[1][0]["content"] == original[0]["content"] + GUIDANCE
        assert raw.request[1][1:] == original[1:]
    else:
        assert raw.request[1] is messages


def test_single_judge_preserves_raw_semantic_rating_when_format_guard_rejects():
    case = packet(
        "test",
        [{"role": "user", "content": "I feel unseen. Reply in two sentences."}],
        "You feel unseen. I hear you. You matter.",
    )
    rating = {
        "recognition": "specific",
        "preferences_met": True,
        "evidence_id": "s0",
        "rationale": "Semantic recognition.",
    }
    result = validate(rating, case)
    assert result["recognition"] == "specific"
    assert result["preferences_met"]
    assert not result["met"]
    assert "rather than 3" in result["format_issue"]


@pytest.mark.parametrize("corruption", ["foreign_span", "string_boolean", "invented_recognition"])
def test_single_judge_rejects_unsupported_evidence_and_types(corruption):
    case = packet("test", [{"role": "user", "content": "Just sit quietly."}], "I'm here with you.")
    rating = {
        "recognition": "quiet_presence_exception",
        "preferences_met": True,
        "evidence_id": "s0",
        "rationale": "Presence.",
    }
    if corruption == "foreign_span":
        rating["evidence_id"] = "s63"
    elif corruption == "string_boolean":
        rating["preferences_met"] = "true"
    else:
        rating["recognition"] = "clinically_safe"
    with pytest.raises(ValueError, match=r"foreign candidate|invalid recognition"):
        validate(rating, case)
