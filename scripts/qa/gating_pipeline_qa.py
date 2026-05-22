#!/usr/bin/env python3
"""Manual QA driver for the 5-gate memory ingestion pipeline."""

from __future__ import annotations

import sys

sys.path.insert(0, "/home/vivi/pixelated")

from ai.memory.gates import GateDecision, GatingReport
from ai.memory.gates.consent_gate import ConsentGateChecker
from ai.memory.gates.crisis_detector import CrisisDetector
from ai.memory.gates.pii_redactor import PiiRedactor
from ai.memory.gates.trauma_filter import TraumaFilter


def test_pii_gate():
    """Gate 0: PII Redaction"""
    gate = PiiRedactor()

    # Clean content should pass
    result = gate.redact("I had a good therapy session today.")
    assert not result.was_redacted, "Clean content should not be redacted"

    # Email should be redacted
    result = gate.redact("My email is test@example.com")
    assert result.was_redacted, "Email should be redacted"
    assert "email" in result.pii_types_found

    # SSN should trigger block
    eval_result = gate.evaluate("My SSN is 123-45-6789")
    assert eval_result.decision == GateDecision.BLOCK, f"SSN should block, got {eval_result.decision}"

    print("  PII Gate: PASS")


def test_crisis_gate():
    """Gate 1: Crisis Detection"""
    gate = CrisisDetector()

    # Clean content should pass
    result = gate.detect("I had a productive session today.")
    assert result.tier.value == "none", f"Clean content should have no crisis, got {result.tier.value}"

    # Self-harm should trigger
    result = gate.detect("I want to hurt myself.")
    assert result.tier.value != "none", "Self-harm should trigger crisis detection"

    # Negation should suppress confidence
    result = gate.detect("I would never hurt myself.")
    assert result.tier.value in ("none", "moderate"), f"Negated self-harm should be suppressed, got {result.tier.value}"
    assert result.confidence < 0.5, f"Negated content should have low confidence, got {result.confidence}"

    print("  Crisis Gate: PASS")


def test_trauma_gate():
    """Gate 2: Trauma Filter"""
    gate = TraumaFilter()

    # Clean content should pass
    result = gate.filter("I discussed my weekend plans.")
    assert result.severity == "none", f"Clean content should have no trauma, got {result.severity}"

    # Trauma lexicon should match
    result = gate.filter("I was abused and felt helpless.")
    assert len(result.indicators) > 0, "Trauma lexicon should match"

    print("  Trauma Gate: PASS")


def test_consent_gate():
    """Gate 3: Consent Management"""
    gate = ConsentGateChecker()

    # Grant and check consent
    gate.grant_consent("user-qa", "open")
    result = gate.check_consent("user-qa")
    assert result.allowed, "Consent should be allowed"

    # Revoke consent
    gate.revoke_consent("user-qa")
    result = gate.check_consent("user-qa")
    assert not result.allowed, "Revoked consent should block"

    print("  Consent Gate: PASS")


def test_gating_report():
    """GatingReport integration"""
    report = GatingReport(source_id="qa-test", content="Test content")
    assert not report.blocked, "Empty report should not be blocked"

    report.gate0_pii = type("GateResult", (), {"decision": GateDecision.BLOCK, "reason": "PII found"})()
    assert report.blocked, "Report should be blocked when PII blocks"

    print("  GatingReport: PASS")


def main():
    print("=== Manual QA: 5-Gate Memory Ingestion Pipeline ===\n")

    test_pii_gate()
    test_crisis_gate()
    test_trauma_gate()
    test_consent_gate()
    test_gating_report()

    print("\n=== ALL MANUAL QA CHECKS PASSED ===")


if __name__ == "__main__":
    main()
