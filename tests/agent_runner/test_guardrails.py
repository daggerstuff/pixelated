"""Unit tests for GuardrailsEngine."""

from tools.agent_runner.guardrails import GuardrailsEngine


def test_secret_and_phi_redaction():
    engine = GuardrailsEngine()
    text = "Secret api_key = 'sk-1234567890abcdef1234567890abcdef' for patient SSN 000-12-3456 and MRN: 12345678."
    redacted = engine.redact_secrets_and_phi(text)
    assert "sk-12345" not in redacted
    assert "000-12-3456" not in redacted
    assert "<REDACTED_AI_KEY>" in redacted or "<REDACTED_SECRET>" in redacted
    assert "<REDACTED_SSN>" in redacted


def test_anti_suppression_audit_in_diff():
    engine = GuardrailsEngine()
    bad_diff = """
--- a/src/db.ts
+++ b/src/db.ts
@@ -10,3 +10,4 @@
+// @ts-ignore
+const x: any = getClient();
+# noqa
"""
    violations = engine.audit_code_diff_for_suppressions(bad_diff)
    assert len(violations) >= 2
    assert any("@ts-ignore" in v for v in violations)
    assert any("# noqa" in v for v in violations)
