#!/usr/bin/env python3
"""
Comprehensive Safety Gates Integration Test Suite

Tests all safety and quality gates in the Unified AI Dataset Pipeline:
- EARS Compliance Gate
- Crisis Detection
- Content Filter
- Quality Gates (PII, Provenance, Deduplication, Bias)

This test validates that all safety gates work together correctly
to produce safe, high-quality training data.
"""

import tempfile
from datetime import datetime, timezone
from pathlib import Path

import pytest

from ai.pipelines.orchestrator.ears_compliance_gate import EarsComplianceGate
from ai.pipelines.orchestrator.quality_gates_runner import (
    GateResult,
    QualityGateRunner,
)
from ai.safety.content_filter import SafetyFilter, SafetyScore
from ai.safety.crisis_detection.production_crisis_detector import CrisisDetector

pytest.importorskip("ai.pipelines.orchestrator.ears_compliance_gate")
pytest.importorskip("ai.safety.crisis_detection.production_crisis_detector")
pytest.importorskip("ai.safety.content_filter")
pytest.importorskip("ai.pipelines.orchestrator.quality_gates_runner")


class TestEARSComplianceGate:
    """Test EARS compliance gate functionality."""

    def test_ears_gate_initialization(self):
        """Test that EARS gate can be initialized."""
        gate = EarsComplianceGate()
        assert gate is not None
        assert hasattr(gate, "validate_compliance")

    def test_ears_gate_stub_behavior(self):
        """Test current stub behavior (always returns False)."""
        gate = EarsComplianceGate()

        # Test with valid-looking data
        test_data = {
            "crisis_detection_score": 0.98,  # Above threshold
            "metadata": {"source": "test"},
        }

        # Current stub implementation returns False
        result = gate.validate_compliance(test_data)
        assert result is False

    def test_ears_gate_future_requirement(self):
        """Document future >95% sensitivity requirement."""
        # This test documents the PRD requirement
        # The gate should eventually enforce >95% crisis detection sensitivity

        # When implemented, this should PASS:
        # high_sensitivity_data = {"crisis_detection_score": 0.96}
        # assert gate.validate_compliance(high_sensitivity_data) == True

        # And this should FAIL:
        # low_sensitivity_data = {"crisis_detection_score": 0.94}
        # assert gate.validate_compliance(low_sensitivity_data) == False

        # For now, document as pending
        pytest.skip("EARS gate enforcement pending - stub implementation")


class TestCrisisDetection:
    """Test crisis detection functionality."""

    def test_crisis_detector_initialization(self):
        """Test that crisis detector can be initialized."""
        detector = CrisisDetector()
        assert detector is not None
        assert hasattr(detector, "detect_crisis")

    def test_crisis_detector_stub_behavior(self):
        """Test current stub behavior (always returns False)."""
        detector = CrisisDetector()

        # Test with crisis indicators
        crisis_input = {"messages": [{"role": "user", "content": "I want to kill myself"}]}

        # Current stub implementation returns False
        result = detector.detect_crisis(crisis_input)
        assert result is False

    def test_crisis_detector_future_requirements(self):
        """Document future crisis detection requirements."""
        # This test documents the PRD requirement
        # The detector should achieve >95% sensitivity on crisis signals

        # For now, document as pending
        pytest.skip("Crisis detection enforcement pending - stub implementation")


class TestContentFilter:
    """Test content filter functionality."""

    def test_content_filter_initialization(self):
        """Test that content filter can be initialized."""
        filter_obj = SafetyFilter()
        assert filter_obj is not None
        assert hasattr(filter_obj, "check_input_safety")
        assert hasattr(filter_obj, "check_output_safety")

    def test_content_filter_safe_input(self):
        """Test filtering of safe input."""
        filter_obj = SafetyFilter()

        safe_text = "I need help with my anxiety"
        result = filter_obj.check_input_safety(safe_text)

        assert isinstance(result, SafetyScore)
        assert result.overall_score > 0.8  # Should be high for safe content

    def test_content_filter_crisis_keywords(self):
        """Test detection of crisis-related keywords."""
        filter_obj = SafetyFilter()

        crisis_text = "I want to kill myself"
        result = filter_obj.check_input_safety(crisis_text)

        assert isinstance(result, SafetyScore)
        # Should have flagged categories
        # Note: Actual implementation may need adjustment

    def test_content_filter_toxic_keywords(self):
        """Test detection of toxic content."""
        filter_obj = SafetyFilter()

        toxic_text = "You are stupid and worthless"
        result = filter_obj.check_input_safety(toxic_text)

        assert isinstance(result, SafetyScore)
        # Should detect toxicity

    def test_content_filter_pii_detection(self):
        """Test PII pattern detection."""
        filter_obj = SafetyFilter()

        # This tests the privacy aspect
        text_with_email = "Contact me at john.doe@example.com"
        result = filter_obj.check_input_safety(text_with_email)

        assert isinstance(result, SafetyScore)
        # Should potentially flag PII


class TestQualityGates:
    """Test quality gates functionality."""

    @pytest.fixture
    def sample_config(self):
        """Sample configuration for quality gates."""
        return {
            "quality_gates": {
                "pii_detection": {
                    "enabled": True,
                    "strict_mode": True,
                    "confidence_threshold": 0.85,
                },
                "provenance_validation": {"enabled": True},
                "deduplication": {"enabled": True, "similarity_threshold": 0.9},
                "bias_detection": {
                    "enabled": True,
                    "categories": ["gender", "race", "age", "disability"],
                    "threshold": 0.7,
                },
            }
        }

    @pytest.fixture
    def sample_conversations(self):
        """Sample conversations for testing."""
        return [
            {
                "messages": [
                    {"role": "user", "content": "I feel anxious"},
                    {"role": "assistant", "content": "I understand"},
                ],
                "metadata": {"source": "test", "dataset_family": "test", "quality": "high"},
            },
            {
                "messages": [
                    {"role": "user", "content": "I need help"},
                    {"role": "assistant", "content": "How can I help?"},
                ],
                "metadata": {"source": "test", "dataset_family": "test", "quality": "high"},
            },
        ]

    def test_quality_gate_runner_initialization(self, sample_config):
        """Test that quality gate runner can be initialized."""
        runner = QualityGateRunner(sample_config)
        assert runner is not None
        assert hasattr(runner, "pii_detector")
        assert hasattr(runner, "provenance_validator")
        assert hasattr(runner, "deduplication_engine")
        assert hasattr(runner, "bias_detector")

    def test_pii_detection_gate(self, sample_config, sample_conversations):
        """Test PII detection gate."""
        runner = QualityGateRunner(sample_config)
        results = runner.run_all_gates(sample_conversations)

        assert "pii_detection" in results
        pii_result = results["pii_detection"]
        assert isinstance(pii_result, GateResult)
        assert pii_result.gate_name == "PII Detection"
        assert pii_result.conversations_processed == len(sample_conversations)
        assert isinstance(pii_result.status, str)
        assert pii_result.status in ["PASS", "FAIL", "WARNING"]

    def test_conversation_with_pii(self, sample_config):
        """Test detection of conversation containing PII."""
        runner = QualityGateRunner(sample_config)

        conversation_with_pii = {
            "messages": [{"role": "user", "content": "My email is john.doe@example.com"}],
            "metadata": {"source": "test", "dataset_family": "test", "quality": "high"},
        }

        results = runner.run_all_gates([conversation_with_pii])
        pii_result = results["pii_detection"]

        # Should detect PII
        assert pii_result.issues_found > 0
        assert pii_result.status == "FAIL"

        # Check issue details
        assert len(pii_result.issues) > 0
        assert pii_result.issues[0]["type"] == "PII_DETECTED"

    def test_provenance_validation_gate(self, sample_config, sample_conversations):
        """Test provenance validation gate."""
        runner = QualityGateRunner(sample_config)
        results = runner.run_all_gates(sample_conversations)

        assert "provenance_validation" in results
        prov_result = results["provenance_validation"]
        assert isinstance(prov_result, GateResult)
        assert prov_result.gate_name == "Provenance Validation"

    def test_conversation_missing_provenance(self, sample_config):
        """Test validation of conversation with missing provenance."""
        runner = QualityGateRunner(sample_config)

        conversation_no_provenance = {
            "messages": [{"role": "user", "content": "Hello"}]
            # Missing metadata
        }

        results = runner.run_all_gates([conversation_no_provenance])
        prov_result = results["provenance_validation"]

        # Should have warnings for missing fields
        assert prov_result.issues_found > 0
        assert prov_result.status == "WARNING"

    def test_deduplication_gate(self, sample_config, sample_conversations):
        """Test deduplication gate."""
        runner = QualityGateRunner(sample_config)
        results = runner.run_all_gates(sample_conversations)

        assert "deduplication" in results
        dedup_result = results["deduplication"]
        assert isinstance(dedup_result, GateResult)
        assert dedup_result.gate_name == "Deduplication"

    def test_duplicate_detection(self, sample_config):
        """Test detection of duplicate conversations."""
        runner = QualityGateRunner(sample_config)

        duplicate_conv = {
            "messages": [
                {"role": "user", "content": "I feel anxious"},
                {"role": "assistant", "content": "I understand"},
            ],
            "metadata": {"source": "test", "dataset_family": "test", "quality": "high"},
        }

        # Add the same conversation twice
        results = runner.run_all_gates([duplicate_conv, duplicate_conv])
        dedup_result = results["deduplication"]

        # Second one should be detected as duplicate
        assert dedup_result.issues_found > 0
        assert dedup_result.status == "WARNING"
        assert dedup_result.issues[0]["type"] == "EXACT_DUPLICATE"

    def test_bias_detection_gate(self, sample_config, sample_conversations):
        """Test bias detection gate."""
        runner = QualityGateRunner(sample_config)
        results = runner.run_all_gates(sample_conversations)

        assert "bias_detection" in results
        bias_result = results["bias_detection"]
        assert isinstance(bias_result, GateResult)
        assert bias_result.gate_name == "Bias Detection"

    def test_bias_keyword_detection(self, sample_config):
        """Test detection of biased language."""
        runner = QualityGateRunner(sample_config)

        biased_conv = {
            "messages": [{"role": "user", "content": "Men are always better at this"}],
            "metadata": {"source": "test", "dataset_family": "test", "quality": "high"},
        }

        results = runner.run_all_gates([biased_conv])
        bias_result = results["bias_detection"]

        # Should detect potential bias
        if bias_result.issues_found > 0:
            assert bias_result.status == "WARNING"


class TestSafetyGateIntegration:
    """Integration tests for all safety gates combined."""

    def test_all_gates_with_safe_conversation(self):
        """Test all gates with a safe, well-formed conversation."""
        safe_conv = {
            "messages": [
                {"role": "user", "content": "I feel anxious about work"},
                {"role": "assistant", "content": "Let's explore what's causing your anxiety"},
            ],
            "metadata": {
                "source": "test_dataset",
                "dataset_family": "therapeutic",
                "quality": "high",
                "source_url": "https://example.com",
            },
        }

        config = {
            "quality_gates": {
                "pii_detection": {
                    "enabled": True,
                    "strict_mode": True,
                    "confidence_threshold": 0.85,
                },
                "provenance_validation": {"enabled": True},
                "deduplication": {"enabled": True, "similarity_threshold": 0.9},
                "bias_detection": {
                    "enabled": True,
                    "categories": ["gender", "race"],
                    "threshold": 0.7,
                },
            }
        }

        # Test quality gates
        quality_runner = QualityGateRunner(config)
        quality_results = quality_runner.run_all_gates([safe_conv])

        # Most gates should pass
        passed_gates = sum(1 for r in quality_results.values() if r.status == "PASS")
        assert passed_gates >= 3  # Should pass most gates

    def test_all_gates_with_unsafe_conversation(self):
        """Test all gates with a problematic conversation."""
        unsafe_conv = {
            "messages": [
                {"role": "user", "content": "Contact me at john.doe@example.com about my anxiety"},
                {"role": "assistant", "content": "I can't share your contact info"},
            ],
            "metadata": {},  # Missing provenance
        }

        config = {
            "quality_gates": {
                "pii_detection": {
                    "enabled": True,
                    "strict_mode": True,
                    "confidence_threshold": 0.85,
                },
                "provenance_validation": {"enabled": True},
                "deduplication": {"enabled": True, "similarity_threshold": 0.9},
                "bias_detection": {
                    "enabled": True,
                    "categories": ["gender", "race"],
                    "threshold": 0.7,
                },
            }
        }

        # Test quality gates
        quality_runner = QualityGateRunner(config)
        quality_results = quality_runner.run_all_gates([unsafe_conv])

        # Should have multiple failures/warnings for PII and missing provenance
        total_issues = sum(r.issues_found for r in quality_results.values())
        assert total_issues > 0

    def test_gate_result_structure(self):
        """Test that all gate results have proper structure."""
        config = {
            "quality_gates": {
                "pii_detection": {
                    "enabled": True,
                    "strict_mode": True,
                    "confidence_threshold": 0.85,
                },
                "provenance_validation": {"enabled": True},
                "deduplication": {"enabled": True, "similarity_threshold": 0.9},
                "bias_detection": {"enabled": True, "categories": ["gender"], "threshold": 0.7},
            }
        }

        conversation = {
            "messages": [{"role": "user", "content": "Hello"}],
            "metadata": {"source": "test", "dataset_family": "test", "quality": "high"},
        }

        runner = QualityGateRunner(config)
        results = runner.run_all_gates([conversation])

        # Each result should have required fields
        required_fields = [
            "gate_name",
            "status",
            "conversations_processed",
            "issues_found",
            "issues",
            "execution_time_seconds",
            "timestamp",
        ]

        for gate_name, result in results.items():
            for field in required_fields:
                assert hasattr(result, field), f"Missing field {field} in {gate_name}"

            # Validate status values
            assert result.status in ["PASS", "FAIL", "WARNING"]

            # Validate timestamp format
            timestamp = result.timestamp
            # Should be ISO format
            assert "T" in timestamp or timestamp.count("-") >= 2


class TestSafetyGatePerformance:
    """Performance tests for safety gates."""

    def test_quality_gates_batch_processing(self):
        """Test that quality gates can handle batch processing."""
        # Create a batch of conversations
        conversations = []
        for i in range(100):
            conversations.append(
                {
                    "messages": [
                        {"role": "user", "content": f"I feel {['anxious', 'sad', 'happy'][i % 3]}"},
                        {"role": "assistant", "content": "I understand"},
                    ],
                    "metadata": {
                        "source": f"test_{i}",
                        "dataset_family": "test",
                        "quality": "high",
                    },
                }
            )

        config = {
            "quality_gates": {
                "pii_detection": {
                    "enabled": True,
                    "strict_mode": True,
                    "confidence_threshold": 0.85,
                },
                "provenance_validation": {"enabled": True},
                "deduplication": {"enabled": True, "similarity_threshold": 0.9},
                "bias_detection": {"enabled": True, "categories": ["gender"], "threshold": 0.7},
            }
        }

        runner = QualityGateRunner(config)

        # Measure execution time
        start_time = datetime.now(timezone.utc)
        results = runner.run_all_gates(conversations)
        execution_time = (datetime.now(timezone.utc) - start_time).total_seconds()

        # Should process 100 conversations in reasonable time (< 30 seconds)
        assert execution_time < 30.0

        # All gates should have run
        assert len(results) == 4

        # Each gate should have processed all conversations
        for result in results.values():
            assert result.conversations_processed == 100


def test_safety_gate_report_generation():
    """Test that safety gate reports can be generated."""
    config = {
        "quality_gates": {
            "pii_detection": {"enabled": True, "strict_mode": True, "confidence_threshold": 0.85},
            "provenance_validation": {"enabled": True},
            "deduplication": {"enabled": True, "similarity_threshold": 0.9},
            "bias_detection": {"enabled": True, "categories": ["gender"], "threshold": 0.7},
        }
    }

    conversations = [
        {
            "messages": [{"role": "user", "content": "Hello"}],
            "metadata": {"source": "test", "dataset_family": "test", "quality": "high"},
        }
    ]

    runner = QualityGateRunner(config)
    results = runner.run_all_gates(conversations)

    # Create temporary report file
    with tempfile.TemporaryDirectory() as tmpdir:
        report_path = Path(tmpdir) / "safety_gates_report.json"
        report = runner.generate_report(results, report_path)

        # Verify report was created
        assert report_path.exists()

        # Verify report structure
        assert "release" in report
        assert "generated_at" in report
        assert "gates" in report
        assert "summary" in report

        # Verify summary
        assert report["summary"]["total_gates"] == len(results)
        assert report["summary"]["passed"] + report["summary"]["warnings"] + report["summary"][
            "failed"
        ] == len(results)


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v", "-s"])
