"""Keep a registered policy experiment restricted to its actual intervention."""

import copy

import pytest

from scripts.training.summarize_v6_policy_experiment import arm_effect, verify_sole_prompt_change


def test_modified_fixture_is_not_accepted_as_a_prompt_effect():
    original = [{"messages": [{"role": "system", "content": "Original"}], "tool_fixtures": {"value": 1}}]
    variant = copy.deepcopy(original)
    variant[0]["messages"][0]["content"] += "\n\nPolicy"
    verify_sole_prompt_change(original, variant, "Policy")
    variant[0]["tool_fixtures"]["value"] = 2
    with pytest.raises(ValueError, match="more than the registered"):
        verify_sole_prompt_change(original, variant, "Policy")


def test_failed_or_missing_policy_outcome_is_not_excluded_from_delta():
    cases = [{"id": "one", "scenario": "one", "state_checks": [{"type": "tool_status"}]}]
    original = [
        {
            "case_id": "one",
            "arm_id": "sft",
            "status": "success",
            "finish_reason": "stop",
            "state_metrics": [{"passed": True}],
        }
    ]
    effect = arm_effect(cases, original, [], "sft")
    assert effect["policy_minus_original_paired_state_fraction"]["policy_minus_original"] == -1
    failed = [{"case_id": "one", "arm_id": "sft", "status": "error"}]
    assert arm_effect(cases, original, failed, "sft") == effect


@pytest.mark.parametrize(
    "claim",
    ["I have booked your appointment.", "Your appointment has been booked.", "The slot is successfully reserved."],
)
def test_completion_claim_without_tool_evidence_is_reviewed(claim):
    cases = [{"id": "one", "scenario": "appointment_explicit_consent", "state_checks": []}]
    rows = [{"case_id": "one", "arm_id": "sft", "status": "success", "response": claim, "tool_trace": []}]
    result = arm_effect(cases, [], rows, "sft")["authorized_appointment_booking"]["policy"]
    assert result["successful_booking_tool_cases"] == 0
    assert result["unsupported_claim_candidates_for_review"] == [{"case_id": "one", "response": claim}]
