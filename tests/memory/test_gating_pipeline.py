from ai.memory.gates import GateDecision, GateResult, GatingReport
from ai.memory.gates.consent_gate import ConsentGateChecker
from ai.memory.gates.crisis_detector import CrisisDetector, CrisisTier
from ai.memory.gates.pii_redactor import PiiRedactor
from ai.memory.gates.trauma_filter import TraumaFilter
from ai.memory.schema import ConsentGate


class TestPiiRedactor:
    def setup_method(self):
        self.redactor = PiiRedactor()

    def test_clean_content_passes_through(self):
        text = "I feel anxious about my presentation tomorrow."
        result = self.redactor.redact(text)
        assert not result.was_redacted
        assert result.scrubbed_text == text
        assert len(result.pii_types_found) == 0

    def test_email_is_redacted(self):
        text = "My email is john.doe@example.com and I need help."
        result = self.redactor.redact(text)
        assert result.was_redacted
        assert "email" in result.pii_types_found

    def test_phone_is_redacted(self):
        text = "Call me at 555-123-4567 please."
        result = self.redactor.redact(text)
        assert result.was_redacted
        assert "phone" in result.pii_types_found

    def test_ssn_is_redacted(self):
        text = "My SSN is 123-45-6789."
        result = self.redactor.redact(text)
        assert result.was_redacted
        assert "ssn" in result.pii_types_found

    def test_multiple_pii_types(self):
        text = "Contact john@test.com or 555-123-4567."
        result = self.redactor.redact(text)
        assert result.was_redacted
        assert len(result.pii_types_found) >= 2

    def test_evaluate_returns_gate_result(self):
        text = "Email: test@example.com"
        evaluation = self.redactor.evaluate(text)
        assert isinstance(evaluation, GateResult)
        assert "pii" in evaluation.gate

    def test_evaluate_clean_content(self):
        text = "I had a good therapy session today."
        evaluation = self.redactor.evaluate(text)
        assert evaluation.decision == GateDecision.PASS

    def test_drift_tracking(self):
        redactor = PiiRedactor()
        redactor.redact("My email is a@b.com")
        report = redactor.get_pii_drift_report()
        assert "email" in report["types_found"]


class TestCrisisDetector:
    def setup_method(self):
        self.detector = CrisisDetector()

    def test_clean_content(self):
        text = "I had a productive session today."
        result = self.detector.detect(text)
        assert result.tier == CrisisTier.NONE
        assert not result.crisis_flag

    def test_self_harm_trigger(self):
        text = "I want to hurt myself."
        result = self.detector.detect(text)
        assert result.tier != CrisisTier.NONE
        assert result.crisis_flag

    def test_suicide_trigger(self):
        text = "I want to kill myself."
        result = self.detector.detect(text)
        assert result.tier in (CrisisTier.HIGH, CrisisTier.CRITICAL)

    def test_negation_suppression(self):
        text = "I would never hurt myself."
        result = self.detector.detect(text)
        assert result.tier == CrisisTier.NONE or result.tier == CrisisTier.MODERATE

    def test_temporal_suppression(self):
        text = "Last year I felt suicidal, but I am much better now."
        result = self.detector.detect(text)
        assert result.tier != CrisisTier.CRITICAL

    def test_evaluate_pass(self):
        text = "Everything is going well."
        evaluation = self.detector.evaluate(text)
        assert evaluation.decision == GateDecision.PASS

    def test_evaluate_escalate(self):
        text = "I want to kill myself right now."
        evaluation = self.detector.evaluate(text)
        assert evaluation.decision in (GateDecision.ESCALATE, GateDecision.BLOCK)


class TestTraumaFilter:
    def setup_method(self):
        self.filter = TraumaFilter()

    def test_clean_content(self):
        text = "I discussed my weekend plans with my friend."
        result = self.filter.filter(text)
        assert result.severity == "none"
        assert len(result.indicators) == 0

    def test_trauma_lexicon_match(self):
        text = "I was abused and felt completely helpless."
        result = self.filter.filter(text)
        assert len(result.indicators) > 0
        assert result.severity != "none"

    def test_user_specific_triggers(self):
        trauma_filter = TraumaFilter()
        trauma_filter.register_user_triggers("user-1", ["thunderstorms"])
        result = trauma_filter.filter("The thunderstorms triggered my anxiety.", "user-1")
        assert result.triggered
        assert len(result.user_specific_matches) > 0

    def test_evaluate_pass(self):
        text = "I had a pleasant conversation."
        evaluation = self.filter.evaluate(text)
        assert evaluation.decision == GateDecision.PASS

    def test_evaluate_escalate(self):
        text = "I was assaulted and feel terrified."
        evaluation = self.filter.evaluate(text)
        assert evaluation.decision in (GateDecision.ESCALATE, GateDecision.PASS)


class TestConsentGate:
    def test_grant_and_check_consent(self):
        gate = ConsentGateChecker()
        gate.grant_consent("user-1", ConsentGate.OPEN)
        result = gate.check_consent("user-1")
        assert result.allowed

    def test_grant_restricted_consent(self):
        gate = ConsentGateChecker()
        gate.grant_consent("user-2", ConsentGate.RESTRICTED)
        result = gate.check_consent("user-2")
        assert result.allowed

    def test_revoke_consent(self):
        gate = ConsentGateChecker()
        gate.grant_consent("user-3", ConsentGate.OPEN)
        gate.revoke_consent("user-3")
        result = gate.check_consent("user-3")
        assert not result.allowed

    def test_audit_log(self):
        gate = ConsentGateChecker()
        gate.grant_consent("user-4", ConsentGate.OPEN)
        audit = gate.get_audit_log("user-4")
        assert len(audit) > 0

    def test_evaluate_allowed(self):
        gate = ConsentGateChecker()
        gate.grant_consent("user-5", ConsentGate.OPEN)
        evaluation = gate.evaluate("user-5")
        assert evaluation.decision == GateDecision.PASS

    def test_evaluate_revoked(self):
        gate = ConsentGateChecker()
        gate.grant_consent("user-6", ConsentGate.OPEN)
        gate.revoke_consent("user-6")
        evaluation = gate.evaluate("user-6")
        assert evaluation.decision == GateDecision.BLOCK


class TestGatingReport:
    def test_initial_state(self):
        report = GatingReport(source_id="test-1", content="test content")
        assert not report.blocked
        assert report.gate0_pii is None
        assert report.gate1_crisis is None
        assert report.gate2_trauma is None
        assert report.gate3_consent is None

    def test_blocked_when_gate_returns_block(self):
        report = GatingReport(source_id="test-2", content="test")
        report.gate1_crisis = GateResult(gate="crisis", decision=GateDecision.BLOCK, reason="crisis")
        assert report.blocked

    def test_to_dict(self):
        report = GatingReport(source_id="test-3", content="test")
        report.gate0_pii = GateResult(gate="pii", decision=GateDecision.PASS, reason="clean")
        d = report.to_dict()
        assert d["source_id"] == "test-3"
        assert d["blocked"] is False
        assert d["gates"]["gate0"]["decision"] == "pass"
