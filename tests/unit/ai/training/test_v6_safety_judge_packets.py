"""Require faithful evidence and bounded scores from provisional judges."""

import copy

import pytest

from scripts.training.build_v6_safety_judge_packets import judge_config, packet, validate_rating
from scripts.training.summarize_v6_safety_ratings import critical_disagreements, parse_rating

DIMENSIONS = {"safety", "accuracy_and_role", "support_and_relevance", "actionability_and_concision"}


@pytest.fixture
def judgment():
    rating = {
        "dimension_scores": dict.fromkeys(DIMENSIONS, 2),
        "critical_failure": False,
        "evidence_excerpt": "contact support",
        "rationale": "Offers a manageable next step.",
    }
    return {
        "ratings": {"A": copy.deepcopy(rating), "B": copy.deepcopy(rating)},
        "preference": "tie",
        "rationale": "Similar responses.",
    }


def test_valid_judgment_retains_independent_scores(judgment):
    validate_rating(judgment, dict.fromkeys(("A", "B"), "Please contact support."), DIMENSIONS)


@pytest.mark.parametrize("score", [True, -1, 3, 1.5, "2"])
def test_invalid_or_boolean_dimension_score_rejected(judgment, score):
    judgment["ratings"]["A"]["dimension_scores"]["safety"] = score
    with pytest.raises(ValueError, match="dimension scores"):
        validate_rating(judgment, dict.fromkeys(("A", "B"), "Please contact support."), DIMENSIONS)


def test_fabricated_critical_failure_quote_rejected(judgment):
    judgment["ratings"]["A"].update(critical_failure=True, evidence_excerpt="invented harmful advice")
    with pytest.raises(ValueError, match="exact candidate excerpt"):
        validate_rating(judgment, dict.fromkeys(("A", "B"), "Please contact support."), DIMENSIONS)


def test_packet_only_sends_blinded_responses_and_case_rubric():
    case = {"id": "one", "messages": [{"role": "user", "content": "A synthetic support request."}]}
    rubric = {
        "case_criteria": {"one": {"expected_behavior": "Offer support"}},
        "rating_protocol": {
            "dimensions": dict.fromkeys(DIMENSIONS, "0 to 2"),
            "critical_failure": "Do not fabricate actions.",
        },
    }
    result = packet(case, {"A": "Candidate one", "B": "Candidate two"}, rubric)
    assert set(result) == {"messages"}
    assert "Candidate one" in result["messages"][1]["content"]
    assert "gemma" not in result["messages"][1]["content"].lower()
    assert "nemotron" not in result["messages"][1]["content"].lower()


def test_malformed_judge_json_is_not_repaired_into_a_valid_rating():
    with pytest.raises(ValueError, match="Expecting"):
        parse_rating('```json\n{"rationale":"example", ""}\n```')
    assert parse_rating('```json\n{"rationale":"example"}\n```') == {"rationale": "example"}


def test_critical_disagreements_preserve_both_original_ratings(judgment):
    second = copy.deepcopy(judgment)
    second["ratings"]["A"]["critical_failure"] = True
    mapping = {"one": {"source_case_id": "source", "label_to_arm": {"A": "sft", "B": "base"}}}
    judgments = {("gemma4", "one"): judgment, ("nemotron35", "one"): second}
    differences = critical_disagreements({"one": {}}, mapping, judgments)
    assert len(differences) == 1
    assert differences[0]["arm"] == "sft"
    assert differences[0]["gemma4_judge"]["critical_failure"] is False
    assert differences[0]["nemotron35_judge"]["critical_failure"] is True


def test_judge_config_disables_thinking_without_mutating_source():
    template = {
        "run_id": "original",
        "decoding": {
            "temperature": 0,
            "max_tokens": 1024,
            "stop": [],
            "chat_template_kwargs": {"enable_thinking": True},
        },
        "pricing": {"input_usd_per_million_tokens": 0.07, "output_usd_per_million_tokens": 0.2},
    }
    original = copy.deepcopy(template)
    cfg = judge_config(template, "test-judge", 48, DIMENSIONS)
    assert template == original
    assert cfg["decoding"]["chat_template_kwargs"] == {"enable_thinking": False}
    assert cfg["decoding"]["response_format"]["json_schema"]["strict"] is True
    assert cfg["decoding"]["max_tokens"] == 2048
    assert cfg["pricing"]["hard_cap_usd"] >= 48 * (16384 * 0.07 + 2048 * 0.2) / 1e6


def test_blank_pair_rationale_rejected(judgment):
    judgment["rationale"] = " "
    with pytest.raises(ValueError, match="pair preference"):
        validate_rating(judgment, dict.fromkeys(("A", "B"), "Please contact support."), DIMENSIONS)
