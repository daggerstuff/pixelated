import asyncio
import json
import subprocess
import sys

from deslop.agent import AgentGuard
from deslop.engine import clean_text, scan_text
from deslop.gate import (
    AntiSycophancyGate,
    correction_for_reason,
    is_sycophantic,
    reject_reason_for_record,
)
from deslop.mcp import handle_tool_call


def test_is_sycophantic_detects_banned_openers() -> None:
    bad_text = "I hear how difficult this transition has been for you."
    caught, reason = is_sycophantic(bad_text)
    assert caught is True
    assert "banned_sycophantic_opener" in reason


def test_is_sycophantic_detects_caving_phrases() -> None:
    bad_text = "You're right, I apologize for pushing that perspective."
    caught, reason = is_sycophantic(bad_text)
    assert caught is True
    assert "caving_phrase_detected" in reason


def test_is_sycophantic_allows_legitimate_boundary_exception() -> None:
    # "i'll stop" is banned unless part of specific therapeutic boundary phrasing
    safe_text = "I'll stop the exercise here so we can reflect on the core issue."
    caught, _ = is_sycophantic(safe_text)
    assert caught is False


def test_is_sycophantic_passes_clean_direct_text() -> None:
    good_text = "Let's inspect the stack trace from line 42 to see where the NullPointerException originated."
    caught, reason = is_sycophantic(good_text)
    assert caught is False
    assert reason == ""


def test_reject_reason_for_record_checks_assistant_turns() -> None:
    record = {
        "id": "conv-1",
        "messages": [
            {"role": "user", "content": "I feel like giving up on this task."},
            {"role": "assistant", "content": "It sounds like you are feeling really overwhelmed."},
        ],
    }
    reason = reject_reason_for_record(record, family="test-suite")
    assert reason is not None
    assert "family=test-suite" in reason


def test_correction_for_reason_generates_actionable_prompt() -> None:
    correction = correction_for_reason("caving_phrase_detected: 'you're right'")
    assert "CORRECTION:" in correction
    assert "reflexively agreed" in correction


def test_anti_sycophancy_gate_object() -> None:
    gate = AntiSycophancyGate.default()
    result = gate.check("Thank you for sharing that vulnerability.")
    assert result.passed is False
    assert result.tag == "banned_sycophantic_opener"
    assert len(result.correction) > 0

    clean_result = gate.check("The server returned a 404 response.")
    assert clean_result.passed is True


def test_general_assistant_gate_skips_clinical_specifics() -> None:
    # Clinical somatic inquiry
    somatic_phrase = "Notice what is happening inside your body right now."
    clinical_gate = AntiSycophancyGate.default()
    general_gate = AntiSycophancyGate.general_assistant()

    assert clinical_gate.check(somatic_phrase).passed is False
    assert general_gate.check(somatic_phrase).passed is True

    # But general sycophancy is still caught
    sycophantic = "You're absolutely right, I'll stop."
    assert general_gate.check(sycophantic).passed is False


def test_clean_text_and_scan_text() -> None:
    text = "Happy to help you deep dive into this issue moving forward."
    cleaned = clean_text(text)
    assert "happy to help" not in cleaned.lower()
    assert "moving forward" not in cleaned.lower()

    findings = scan_text(text)
    assert "happy to help" in findings or "deep dive" in findings


def test_agent_guard_run_with_retry() -> None:
    call_counts = 0

    def mock_llm(prompt: str) -> str:
        nonlocal call_counts
        call_counts += 1
        if call_counts == 1:
            return "I hear how frustrating this bug is for you. Let's fix it."
        return "Line 12 has a syntax error. Change foo to bar."

    guard = AgentGuard(auto_clean_residual=True)
    final_output = guard.run(mock_llm, "Fix my code", max_retries=2)

    assert call_counts == 2
    assert "Line 12 has a syntax error" in final_output


def test_agent_guard_arun_with_retry() -> None:
    call_counts = 0

    async def mock_async_llm(prompt: str) -> str:
        nonlocal call_counts
        call_counts += 1
        if call_counts == 1:
            return "You're right, my mistake."
        return "The configuration option is ssl_mode=require."

    async def _run() -> None:
        guard = AgentGuard()
        final_output = await guard.arun(mock_async_llm, "Configure postgres", max_retries=2)
        assert call_counts == 2
        assert "ssl_mode=require" in final_output

    asyncio.run(_run())


def test_mcp_tool_calls() -> None:
    # Test deslop_gate tool
    gate_out = json.loads(handle_tool_call("deslop_gate", {"text": "I hear how difficult this is."}))
    assert gate_out["passed"] is False
    assert "banned_sycophantic_opener" in gate_out["tag"]

    # Test deslop_clean tool
    clean_out = json.loads(handle_tool_call("deslop_clean", {"text": "Happy to help you today."}))
    assert "happy to help" not in clean_out["cleaned"].lower()

    # Test deslop_scan tool
    scan_out = json.loads(handle_tool_call("deslop_scan", {"text": "We need to delve into this robust plan."}))
    assert scan_out["hit_count"] > 0


def test_cli_gate_and_text_subcommands() -> None:
    # Test CLI gate command with sycophantic text (should exit 1)
    proc_bad = subprocess.run(
        [sys.executable, "-m", "deslop.cli", "gate", "I hear how upset you are.", "--json"],
        capture_output=True,
        text=True,
    )
    assert proc_bad.returncode == 1
    bad_data = json.loads(proc_bad.stdout)
    assert bad_data["passed"] is False

    # Test CLI gate command with clean text (should exit 0)
    proc_good = subprocess.run(
        [sys.executable, "-m", "deslop.cli", "gate", "The database port is 5432.", "--json"],
        capture_output=True,
        text=True,
    )
    assert proc_good.returncode == 0
    good_data = json.loads(proc_good.stdout)
    assert good_data["passed"] is True

    # Test CLI text cleaning command
    proc_clean = subprocess.run(
        [sys.executable, "-m", "deslop.cli", "text", "Happy to help with the deployment."],
        capture_output=True,
        text=True,
    )
    assert proc_clean.returncode == 0
    assert "happy to help" not in proc_clean.stdout.lower()
