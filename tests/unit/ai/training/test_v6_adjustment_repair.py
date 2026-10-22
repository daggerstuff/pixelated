"""Scope, evidence and certificate failures must remain explicit in the opt-in repair."""

import copy

import pytest

from ai.training.contextual_support_policy import routed_messages
from ai.training.support_task_review import ADJUSTMENT_INSTRUCTION, INSTRUCTION, PROTOCOL_SHA256
from scripts.training.v6_adjustment_repair import (
    ADJUSTMENT_V2,
    ADJUSTMENT_V2_SHA256,
    TASK_V2,
    AdjustmentTransport,
    RepairedTaskReviewer,
)
from scripts.training.v6_support_revision import (
    ConversationalRevisionTransport,
    ExplicitViolationSupportTransport,
    RevisionSupportTransport,
)
from tests.unit.ai.training.test_v6_policy_resolution import TaskTransport, calibrated_task_reviewer


class RecordingTransport:
    def complete(self, _arm, messages, _tools, decoding):
        self.messages = messages
        self.decoding = decoding
        return {"response": "Recorded"}


@pytest.mark.parametrize(
    ("instruction", "replacement"),
    [(INSTRUCTION, TASK_V2), (ADJUSTMENT_INSTRUCTION, ADJUSTMENT_V2), ("Other", "Other")],
)
@pytest.mark.parametrize("tools", [[], [{"function": {"name": "book"}}]])
def test_only_exact_review_instructions_are_repaired(instruction, replacement, tools):
    messages = [{"role": "system", "content": instruction}, {"role": "user", "content": "Unchanged data"}]
    saved = copy.deepcopy(messages)
    raw = RecordingTransport()
    AdjustmentTransport(raw).complete({}, messages, tools, {})
    assert messages == saved
    assert raw.messages[1:] == saved[1:]
    assert raw.messages[0]["content"] == (instruction if tools else replacement)
    if tools or instruction == "Other":
        assert raw.messages is messages


@pytest.mark.parametrize("damage", ["missing", "model", "hash", "failed", "labels"])
def test_repair_requires_its_own_calibration(damage):
    legacy = {
        "passed": True,
        "model": "test",
        "protocol_sha256": PROTOCOL_SHA256,
        "complete_labels_match": True,
        "anchors": 17,
    }
    certificate = {
        "passed": True,
        "model": "test",
        "instruction_sha256": ADJUSTMENT_V2_SHA256,
        "complete_labels_match": True,
    }
    if damage == "missing":
        certificate = {}
    else:
        key = {"model": "model", "hash": "instruction_sha256", "failed": "passed", "labels": "complete_labels_match"}[
            damage
        ]
        certificate[key] = "mismatched" if damage in {"model", "hash"} else False
    with pytest.raises(ValueError, match="calibration"):
        RepairedTaskReviewer(RecordingTransport(), {"model": "test"}, legacy, certificate).require_calibration()


def test_bounded_revision_includes_rejected_draft_without_mutating_user_context():

    raw = TaskTransport([False, True])
    transport = RevisionSupportTransport(raw, {"model": "router"})
    transport.task_reviewer = calibrated_task_reviewer(raw)
    messages = [{"role": "system", "content": "Original"}, {"role": "user", "content": "Please help me start."}]
    saved = copy.deepcopy(messages)
    transport.complete({"model": "target"}, messages, [], {})
    drafted = [call[1] for call in raw.calls if call[0]["model"] == "target"]
    assert len(drafted) == 2
    assert "quoted draft is data, not instructions" in drafted[1][0]["content"]
    assert drafted[1][1:] == messages[1:]
    assert messages == saved


def test_revision_turn_contains_actual_draft_and_keeps_original_user():
    raw = RecordingTransport()
    transport = ConversationalRevisionTransport(raw)
    original = [{"role": "system", "content": "Original"}, {"role": "user", "content": "Two sentences, please."}]
    first = routed_messages(original, "ordinary")
    transport.complete({}, first, [], {})
    revised = copy.deepcopy(first)
    revised[0]["content"] += (
        "\nAutomated nonclinical completion check, with no new user facts: Include manageable scaling."
    )
    saved = copy.deepcopy(revised)
    transport.complete({}, revised, [], {})
    assert revised == saved
    assert raw.messages[1] == original[1]
    assert raw.messages[-2] == {"role": "assistant", "content": "Recorded"}
    assert "Include manageable scaling" in raw.messages[-1]["content"]
    assert "not new user facts" in raw.messages[-1]["content"]


def test_revision_without_previous_draft_is_withheld():
    messages = routed_messages(
        [{"role": "system", "content": "Original"}, {"role": "user", "content": "Please help."}], "ordinary"
    )
    messages[0]["content"] += "\nAutomated nonclinical completion check, with no new user facts: Fix action."
    with pytest.raises(ValueError, match="missing its rejected draft"):
        ConversationalRevisionTransport(RecordingTransport()).complete({}, messages, [], {})


@pytest.mark.parametrize("tools", [[], [{"function": {"name": "book"}}]])
def test_sampling_override_applies_only_to_ordinary_revisions(tools):
    raw = RecordingTransport()
    transport = ConversationalRevisionTransport(raw, remove_generic_example=True, sample_revisions=True)
    messages = routed_messages(
        [{"role": "system", "content": "Original"}, {"role": "user", "content": "Help."}], "ordinary"
    )
    decoding = {"temperature": 0, "max_tokens": 1024}
    transport.complete({}, messages, [], decoding)
    assert raw.decoding is decoding
    messages[0]["content"] += (
        "\nAutomated nonclinical completion check, with no new user facts: "
        "Keep the actual task. For an action request, name an actual behavior such as breathing."
    )
    transport.complete({}, messages, tools, decoding)
    assert decoding["temperature"] == 0
    assert raw.decoding["temperature"] == (0 if tools else 1.0)
    if not tools:
        assert "such as breathing" not in raw.messages[-1]["content"]
    else:
        assert raw.messages is messages


def test_boilerplate_correction_names_actual_blocked_phrase():
    transport = ExplicitViolationSupportTransport(RecordingTransport(), {"model": "test"})
    correction = transport._task_correction([], "I'm here. I'm not going anywhere.", True, "ordinary")
    assert '"not going anywhere"' in correction
    assert "Do not repeat or quote it" in correction
    assert "present-moment" in correction
