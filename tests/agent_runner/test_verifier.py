"""Unit tests for VerificationEngine."""

from tools.agent_runner.models import VerificationConfig
from tools.agent_runner.verifier import VerificationEngine


def test_verification_engine_run_checks():
    cfg = VerificationConfig(enabled=True, commands=["echo 'TEST PASSED'"])
    verifier = VerificationEngine(cfg)
    outcome = verifier.run_checks(".")
    assert outcome.passed is True
    assert "TEST PASSED" in outcome.summary


def test_verification_engine_failure_and_repair_prompt():
    cfg = VerificationConfig(enabled=True, commands=["false"])
    verifier = VerificationEngine(cfg)
    outcome = verifier.run_checks(".")
    assert outcome.passed is False

    prompt = verifier.generate_repair_prompt("opencode", "PIX-10", outcome)
    assert "The verification test gate FAILED for ticket PIX-10" in prompt
    assert "YOUR REPAIR MISSION" in prompt
