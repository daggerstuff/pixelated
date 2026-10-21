"""Prevent selective denominators or mismatched evidence in v6 comparisons."""

import pytest

from scripts.training.summarize_v6_paired_evaluations import canonical_hash, paired_interval, summarize


@pytest.fixture
def evidence():
    cases = [{"id": "one", "scenario": "one", "state_checks": [{"type": "tool_status"}]}]
    config = {"arms": [{"id": "base", "model": "base"}, {"id": "sft", "model": "adapter"}]}
    row = {
        "arm_id": "base",
        "case_id": "one",
        "case_sha256": canonical_hash(cases[0]),
        "config_sha256": canonical_hash(config),
        "model": "base",
        "status": "success",
        "finish_reason": "stop",
        "response": "done",
        "latency_ms": 10,
        "state_metrics": [{"type": "tool_status", "passed": True}],
    }
    return cases, config, row


def test_missing_adapter_is_failed_expected_check_and_regression(evidence):
    cases, config, row = evidence
    result = summarize(cases, [row], config)
    assert result["arms"]["sft"]["missing_cases"] == 1
    assert result["arms"]["sft"]["state_checks"]["tool_status"] == {"expected": 1, "passed": 0}
    assert result["paired_state_check_pass_fraction"]["sft_minus_base"] == -1
    assert result["state_check_regression_case_ids"] == ["one"]
    assert result["all_expected_arm_cases_attempted"] is False


def test_truncated_success_is_not_demonstrated_state_check_pass(evidence):
    cases, config, row = evidence
    row["finish_reason"] = "length"
    result = summarize(cases, [row], config)
    assert result["arms"]["base"]["transport_successes"] == 1
    assert result["arms"]["base"]["truncated_successes"] == 1
    assert result["arms"]["base"]["state_checks"]["tool_status"]["passed"] == 0


@pytest.mark.parametrize("field", ["case_sha256", "config_sha256", "model"])
def test_changed_evidence_identity_rejected(evidence, field):
    cases, config, row = evidence
    row[field] = "changed"
    with pytest.raises(ValueError, match="identity mismatch"):
        summarize(cases, [row], config)


def test_duplicate_attempt_cannot_replace_failed_outcome(evidence):
    cases, config, row = evidence
    with pytest.raises(ValueError, match="duplicate"):
        summarize(cases, [row, row], config)


def test_cluster_interval_keeps_shared_scenario_values_together():
    values = [("same-template", 1), ("same-template", -1)]
    result = paired_interval(values, draws=100)
    assert result["scenario_cluster_percentile_95_interval"] == [0, 0]
    assert result["scenario_clusters"] == 1
    assert result == paired_interval(values, draws=100)


def test_execution_limit_is_not_mislabeled_as_http_failure(evidence):
    cases, config, row = evidence
    row.update(status="error", error_type="ToolRoundLimitExceeded")
    result = summarize(cases, [row], config)
    assert result["arms"]["base"]["execution_error_type_counts"] == {"ToolRoundLimitExceeded": 1}
    assert result["arms"]["base"]["http_status_counts"] == {}
    assert result["arms"]["base"]["state_checks"]["tool_status"]["passed"] == 0


def test_visible_control_token_leak_is_recorded_without_semantic_safety_claim(evidence):
    cases, config, row = evidence
    row["response"] = "<|channel>thought\n<channel|>I saved it."
    result = summarize(cases, [row], config)
    assert result["arms"]["base"]["visible_serialization_markers_by_case"] == {"one": ["<|channel>", "<channel|>"]}
    assert result["clinical_quality_or_promotion_claim"] is False
