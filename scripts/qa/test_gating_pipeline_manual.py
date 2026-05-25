#!/usr/bin/env python
"""Manual QA driver for the 5-gate memory ingestion pipeline."""

from __future__ import annotations

import sys

sys.path.insert(0, ".")

from ai.memory.gates import GatingReport
from ai.memory.local_foresight_memory_write_service import LocalForesightMemoryWriteService


# Mock protocol adapter for QA
class MockProtocol:
    def retain_items(self, bank_id, items):
        return {"results": [{"id": f"doc-{len(items)}"}]}

    def build_add_memory_item(self, user_id, content, metadata):
        return {"user_id": user_id, "content": content, "metadata": metadata}


def test_gate(name, fn, expected):
    result = fn()
    status = "PASS" if result == expected else "FAIL"
    print(f"  [{status}] {name}: expected={expected}, got={result}")
    return status == "PASS"


def main():
    passed = 0
    failed = 0

    service = LocalForesightMemoryWriteService(
        protocol=MockProtocol(),
        default_bank_id="test-bank",
    )

    # Test 1: Clean content passes all gates
    print("\n=== Test 1: Clean content passes all gates ===")
    doc_id, report = service.gated_add_memory(
        content="I had a productive therapy session today.",
        user_id="user-1",
    )
    if test_gate("Clean content not blocked", report.blocked, False):
        passed += 1
    else:
        failed += 1
    if test_gate("Document ID returned", doc_id is not None, True):
        passed += 1
    else:
        failed += 1

    # Test 2: Crisis content blocks
    print("\n=== Test 2: Crisis content blocks ===")
    doc_id, report = service.gated_add_memory(
        content="I want to kill myself right now.",
        user_id="user-1",
    )
    if test_gate("Crisis content blocked", report.blocked, True):
        passed += 1
    else:
        failed += 1
    if test_gate("No document ID on block", doc_id is None, True):
        passed += 1
    else:
        failed += 1

    # Test 3: PII content with SSN blocks
    print("\n=== Test 3: PII content with SSN blocks ===")
    doc_id, report = service.gated_add_memory(
        content="My SSN is 123-45-6789 and I need help.",
        user_id="user-1",
    )
    if test_gate("SSN content blocked", report.blocked, True):
        passed += 1
    else:
        failed += 1

    # Test 4: Consent gate blocks when revoked
    print("\n=== Test 4: Consent gate blocks when revoked ===")
    service.consent_gate.grant_consent("user-no-consent", "open")
    service.consent_gate.revoke_consent("user-no-consent")
    doc_id, report = service.gated_add_memory(
        content="I had a good day.",
        user_id="user-no-consent",
    )
    if test_gate("Revoked consent blocks", report.blocked, True):
        passed += 1
    else:
        failed += 1

    # Test 5: GatingReport serializes
    print("\n=== Test 5: GatingReport serializes ===")
    report_dict = report.to_dict()
    if test_gate("Report has source_id", "source_id" in report_dict, True):
        passed += 1
    else:
        failed += 1
    if test_gate("Report has content", "content" in report_dict, True):
        passed += 1
    else:
        failed += 1

    # Test 6: PII redaction scrubs content
    print("\n=== Test 6: PII redaction scrubs content ===")
    result = service.pii_redactor.redact("Contact me at test@example.com please.")
    if test_gate("Email redacted", "[EMAIL]" in result.scrubbed_text, True):
        passed += 1
    else:
        failed += 1
    if test_gate("PII types found", "email" in result.pii_types_found, True):
        passed += 1
    else:
        failed += 1

    # Test 7: Crisis detector tiers
    print("\n=== Test 7: Crisis detector tiers ===")
    crisis_none = service.crisis_detector.detect("Everything is fine.")
    if test_gate("No crisis tier", crisis_none.tier.value, "none"):
        passed += 1
    else:
        failed += 1

    crisis_high = service.crisis_detector.detect("I want to kill myself.")
    if test_gate("High/critical crisis tier", crisis_high.tier.value in ("high", "critical"), True):
        passed += 1
    else:
        failed += 1

    # Test 8: Trauma filter detects lexicon
    print("\n=== Test 8: Trauma filter detects lexicon ===")
    trauma_result = service.trauma_filter.filter("I was abused and felt helpless.")
    if test_gate("Trauma indicators found", len(trauma_result.indicators) > 0, True):
        passed += 1
    else:
        failed += 1

    # Test 9: evaluate_gates returns full report
    print("\n=== Test 9: evaluate_gates returns full report ===")
    report = service.evaluate_gates(content="I feel anxious about work.", user_id="user-1")
    if test_gate("Report is GatingReport", isinstance(report, GatingReport), True):
        passed += 1
    else:
        failed += 1
    if test_gate("Gate 0 PII evaluated", report.gate0_pii is not None, True):
        passed += 1
    else:
        failed += 1
    if test_gate("Gate 1 Crisis evaluated", report.gate1_crisis is not None, True):
        passed += 1
    else:
        failed += 1
    if test_gate("Gate 2 Trauma evaluated", report.gate2_trauma is not None, True):
        passed += 1
    else:
        failed += 1
    if test_gate("Gate 3 Consent evaluated", report.gate3_consent is not None, True):
        passed += 1
    else:
        failed += 1

    # Test 10: Negation suppression in crisis detector
    print("\n=== Test 10: Negation suppression in crisis detector ===")
    negated = service.crisis_detector.detect("I would never hurt myself.")
    if test_gate("Negated crisis suppressed", negated.tier.value, "none"):
        passed += 1
    else:
        failed += 1

    print(f"\n{'=' * 50}")
    print(f"Manual QA Results: {passed} passed, {failed} failed out of {passed + failed} tests")
    if failed == 0:
        print("ALL TESTS PASSED - Gating pipeline is functional.")
    else:
        print("SOME TESTS FAILED - Review above output.")
    return failed == 0


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
