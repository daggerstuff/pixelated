#!/usr/bin/env python3
"""
Automated tests to detect hotline-first language and validate collaborative support responses
"""

import logging
import os
import re
import sys

# Adjust sys.path to allow imports from the parent 'ai' directory
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../ai")))

from integration.crisis_intervention_system import (
    CrisisDetectionEngine,
    RiskLevel,
    TherapeuticCrisisResponder,
)


class EmpathyStyleValidator:
    """Validates that responses follow the collaborative support approach"""

    def __init__(self):
        # Institutional referral patterns to avoid
        self.institutional_patterns = [
            r"\b988\b",
            r"\b911\b",
            r"\bcrisis\s+hotline\b",
            r"\bemergency\s+services?\b",
            r"\bprofessional\s+help\b",
            r"\bmental\s+health\s+(clinic|center|services?)\b",
            r"\btherapist\b",
            r"\bcounselor\b",
            r"\bpsychiatrist\b",
            r"\bcall.*immediately\b",
            r"\bcontact.*crisis\b",
            r"\breach.*crisis.*support\b",
        ]

        # Collaborative support patterns to encourage
        self.collaborative_patterns = [
            r"\bpeer\s+support\b",
            r"\bcommunity\b",
            r"\bconnect.*others\b",
            r"\bshared\s+experience\b",
            r"\bwalk.*alongside\b",
            r"\bunderstand.*experiences?\b",
            r"\bsimilar\s+path\b",
            r"\bfellow.*journey\b",
            r"\btogether.*figure\b",
            r"\bcollaborative\b",
        ]

        # Crisis detection engine for testing
        self.engine = CrisisDetectionEngine()
        self.responder = TherapeuticCrisisResponder()

    def detect_institutional_language(self, text: str) -> dict:
        """Detect institutional referral language that violates empathy guidelines"""
        violations = []
        matches = []

        for pattern in self.institutional_patterns:
            found_matches = re.findall(pattern, text, re.IGNORECASE)
            if found_matches:
                violations.append(
                    {
                        "pattern": pattern,
                        "matches": found_matches,
                        "severity": "HIGH" if "911" in pattern or "988" in pattern else "MEDIUM",
                    }
                )
                matches.extend(found_matches)

        return {
            "has_violations": len(violations) > 0,
            "violation_count": len(violations),
            "violations": violations,
            "matches": matches,
        }

    def detect_collaborative_language(self, text: str) -> dict:
        """Detect collaborative support language that aligns with empathy guidelines"""
        positive_matches = []

        for pattern in self.collaborative_patterns:
            found_matches = re.findall(pattern, text, re.IGNORECASE)
            if found_matches:
                positive_matches.extend(found_matches)

        return {
            "has_collaborative_language": len(positive_matches) > 0,
            "match_count": len(positive_matches),
            "matches": positive_matches,
        }

    def validate_response_style(self, response_text: str) -> dict:
        """Comprehensive validation of response style"""
        institutional_check = self.detect_institutional_language(response_text)
        collaborative_check = self.detect_collaborative_language(response_text)

        # Calculate empathy score (higher is better)
        empathy_score = 1.0
        if institutional_check["has_violations"]:
            # Reduce score based on violation severity
            for violation in institutional_check["violations"]:
                if violation["severity"] == "HIGH":
                    empathy_score -= 0.3
                else:
                    empathy_score -= 0.1

        # Boost score for collaborative language
        if collaborative_check["has_collaborative_language"]:
            empathy_score += min(0.2, collaborative_check["match_count"] * 0.05)

        # Connection score (based on collaborative elements)
        connection_score = min(1.0, collaborative_check["match_count"] * 0.2)

        return {
            "empathy_score": max(0.0, min(1.0, empathy_score)),
            "connection_score": connection_score,
            "institutional_violations": institutional_check,
            "collaborative_elements": collaborative_check,
            "passes_validation": empathy_score >= 0.7 and connection_score >= 0.3,
        }

    def test_crisis_responses(self) -> dict:
        """Test various crisis scenarios with the updated system"""
        test_cases = [
            {
                "message": "I'm feeling really overwhelmed and hopeless lately",
                "expected_risk": RiskLevel.MEDIUM,
            },
            {
                "message": "I've been having thoughts about hurting myself",
                "expected_risk": RiskLevel.HIGH,
            },
            {
                "message": "I want to die and I have a plan",
                "expected_risk": RiskLevel.CRITICAL,
            },
        ]

        results = []

        for test_case in test_cases:
            # Assess risk
            assessment = self.engine.assess_crisis_risk(test_case["message"])

            # Generate response
            response = self.responder._generate_template_response(assessment)

            # Validate style
            validation = self.validate_response_style(response)

            results.append(
                {
                    "input": test_case["message"],
                    "risk_level": assessment.risk_level.value,
                    "response": response[:200] + "..." if len(response) > 200 else response,
                    "validation": validation,
                    "passed": validation["passes_validation"],
                }
            )

        return {
            "test_results": results,
            "overall_pass_rate": sum(1 for r in results if r["passed"]) / len(results),
            "all_passed": all(r["passed"] for r in results),
        }


def main():
    """Run the empathy style validation tests"""

    logging.basicConfig(level=logging.INFO, format="%(message)s")
    validator = EmpathyStyleValidator()

    logging.info("🔍 Running Empathy Style Validation Tests...")
    logging.info("=" * 50)

    # Test individual language detection
    test_text = "If you're in immediate danger, please call 911. You can also contact the 988 Suicide & Crisis Lifeline."
    institutional_result = validator.detect_institutional_language(test_text)
    collaborative_result = validator.detect_collaborative_language(test_text)

    logging.info(f"Institutional language detected: {institutional_result['has_violations']}")
    logging.info(f"Violations found: {institutional_result['violation_count']}")
    logging.info(
        f"Collaborative language found: {collaborative_result['has_collaborative_language']}"
    )

    logging.info("\n" + "=" * 50)
    logging.info("🧪 Testing Crisis Response Styles...")

    # Test crisis responses
    test_results = validator.test_crisis_responses()

    for i, result in enumerate(test_results["test_results"], 1):
        status = "✅ PASS" if result["passed"] else "❌ FAIL"
        logging.info(f"\nTest {i}: {status}")
        logging.info(f"Input: {result['input']}")
        logging.info(f"Risk Level: {result['risk_level']}")
        logging.info(f"Empathy Score: {result['validation']['empathy_score']:.2f}")
        logging.info(f"Connection Score: {result['validation']['connection_score']:.2f}")
        logging.info(f"Response Preview: {result['response']}")

        if not result["passed"]:
            logging.warning(
                f"Violations: {len(result['validation']['institutional_violations']['violations'])}"
            )

    logging.info("📊 Overall Results:")
    logging.info(f"Pass Rate: {test_results['overall_pass_rate']:.1%}")
    logging.info(f"All Tests Passed: {test_results['all_passed']}")

    if test_results["all_passed"]:
        logging.info("🎉 All empathy style validations passed!")
    else:
        logging.warning("⚠️  Some responses need adjustment to meet empathy guidelines")


if __name__ == "__main__":
    main()
