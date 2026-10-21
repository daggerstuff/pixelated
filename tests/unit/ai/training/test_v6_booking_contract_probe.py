"""A tool-documentation experiment must not change the task or soften its checks."""

import copy

import pytest

from scripts.training.build_v6_booking_contract_probe import (
    NOTE_DESCRIPTION,
    SLOT_ID_DESCRIPTION,
    describe_booking_note,
)
from scripts.training.summarize_v6_booking_contract_probe import verify_contract_cases


def test_probe_cannot_change_expected_state_to_hide_model_error():
    original = [{"id": "one", "tools": [], "state_checks": [{"value": None}]}]
    actual = copy.deepcopy(original)
    verify_contract_cases(original, actual, 1)
    actual[0]["state_checks"][0]["value"] = "None"
    with pytest.raises(ValueError, match="registered tool contract"):
        verify_contract_cases(original, actual, 1)


def test_slot_documentation_does_not_change_other_tools_or_state():
    case = {
        "tools": [
            {
                "function": {
                    "name": "book_navigator_slot",
                    "parameters": {
                        "required": ["slot_id", "consent", "note"],
                        "properties": {"slot_id": {"type": "string"}, "note": {"type": ["string", "null"]}},
                    },
                }
            },
            {"function": {"name": "memory_write", "parameters": {"required": ["key", "value"]}}},
        ],
        "messages": [{"role": "user", "content": "Leave the note empty."}],
        "state_checks": [{"type": "state_value", "value": None}],
    }
    snapshot = copy.deepcopy(case)
    result = describe_booking_note([case], optional=True, describe_slot=True)[0]
    assert result["tools"][0]["function"]["parameters"]["properties"]["slot_id"]["description"] == SLOT_ID_DESCRIPTION
    assert result["tools"][1] == case["tools"][1]
    assert result["messages"] == case["messages"]
    assert result["state_checks"] == case["state_checks"]
    assert case == snapshot


def test_optional_note_keeps_consent_and_slot_required_and_preserves_types():
    cases = [
        {
            "tools": [
                {
                    "function": {
                        "name": "book_navigator_slot",
                        "parameters": {
                            "properties": {"note": {"type": ["string", "null"]}},
                            "required": ["slot_id", "consent", "note"],
                        },
                    }
                }
            ]
        }
    ]
    snapshot = copy.deepcopy(cases)
    result = describe_booking_note(cases, optional=True)
    params = result[0]["tools"][0]["function"]["parameters"]
    assert params["required"] == ["slot_id", "consent"]
    assert params["properties"]["note"]["type"] == ["string", "null"]
    assert cases == snapshot


def test_only_booking_note_description_changes():
    cases = [
        {
            "messages": [{"role": "user", "content": "Leave the note empty."}],
            "tools": [
                {
                    "function": {
                        "name": "book_navigator_slot",
                        "parameters": {
                            "properties": {"note": {"type": ["string", "null"]}},
                            "required": ["note"],
                        },
                    }
                }
            ],
            "tool_fixtures": {"user_consent_granted": False},
            "state_checks": [{"type": "state_value", "value": None}],
        }
    ]
    snapshot = copy.deepcopy(cases)
    result = describe_booking_note(cases)
    note = result[0]["tools"][0]["function"]["parameters"]["properties"]["note"]
    assert note.pop("description") == NOTE_DESCRIPTION
    assert result == snapshot == cases
