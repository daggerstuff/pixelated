"""Unit tests for the Risk Stratification service.

Covers scoring logic, models validation, PHI redaction, service orchestration,
NIM call mocking, BAA gate enforcement, and endpoint integration.

Run: uv run pytest tests/ai/ehr/risk_stratification/ -v
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from ai.ehr.risk_stratification.config import RiskStratificationSettings
from ai.ehr.risk_stratification.main import app, get_settings
from ai.ehr.risk_stratification.models import (
    ClinicalContext,
    CSSRSScreen,
    GAD7Scores,
    PHQ9Scores,
    RiskLevel,
    RiskStratificationRequest,
)
from ai.ehr.risk_stratification.phi import (
    redact_patient_id,
    redact_session_id,
    sanitize_for_logging,
)
from ai.ehr.risk_stratification.scoring import (
    classify_risk,
    get_recommended_actions,
    score_cssrs,
    score_gad7,
    score_phq9,
)
from ai.ehr.risk_stratification.service import (
    FALSE_NEGATIVE_RATE_CRISIS,
    FALSE_NEGATIVE_RATE_HIGH,
    RiskStratificationService,
    _build_prompt,
    _parse_nim_response,
)

# --------------------------------------------------------------------------- #
# Fixtures
# --------------------------------------------------------------------------- #


@pytest.fixture
def configured_settings() -> RiskStratificationSettings:
    return RiskStratificationSettings(
        nim_url="http://hetzner-nim:8000",
        nim_api_key="test-key-12345",
        nim_model="meta/llama-3.1-70b-instruct",
        baa_confirmed=True,
        nim_timeout_seconds=5.0,
        nim_max_retries=2,
        nim_retry_base_delay=0.1,
    )


@pytest.fixture
def baa_disabled_settings() -> RiskStratificationSettings:
    return RiskStratificationSettings(
        nim_url="http://hetzner-nim:8000",
        nim_api_key="test-key-12345",
        baa_confirmed=False,
    )


@pytest.fixture
def unconfigured_settings() -> RiskStratificationSettings:
    return RiskStratificationSettings(
        nim_url="",
        nim_api_key="",
        baa_confirmed=True,
    )


@pytest.fixture
def valid_request_body() -> dict:
    return {
        "phq9": {"responses": [0, 0, 0, 0, 0, 0, 0, 0, 0]},
        "gad7": {"responses": [0, 0, 0, 0, 0, 0, 0]},
        "cssrs": {"responses": [False, False, False, False, False, False]},
        "clinical_context": {
            "note_text": "Patient reports stable mood.",
            "session_id": "sess-001",
            "patient_id": "pat-001",
        },
    }


def make_request(
    *,
    phq9: list[int] | None = None,
    gad7: list[int] | None = None,
    cssrs: list[bool] | None = None,
    patient_id: str = "pat-001",
    session_id: str = "sess-001",
) -> RiskStratificationRequest:
    """Helper to build a valid request."""
    return RiskStratificationRequest(
        phq9=PHQ9Scores(responses=phq9 or [0] * 9),
        gad7=GAD7Scores(responses=gad7 or [0] * 7),
        cssrs=CSSRSScreen(responses=cssrs or [False] * 6),
        clinical_context=ClinicalContext(
            note_text="Patient is stable.",
            session_id=session_id,
            patient_id=patient_id,
        ),
    )


# --------------------------------------------------------------------------- #
# Scoring Tests
# --------------------------------------------------------------------------- #


class TestPHQ9Scoring:
    def test_minimal_score(self) -> None:
        result = score_phq9([0] * 9)
        assert result.total == 0
        assert result.severity == "minimal"
        assert result.item_9_positive is False

    def test_mild_score(self) -> None:
        result = score_phq9([1] * 5 + [0] * 4)
        assert result.total == 5
        assert result.severity == "mild"

    def test_moderate_score(self) -> None:
        result = score_phq9([2] * 5 + [0] * 4)
        assert result.total == 10
        assert result.severity == "moderate"

    def test_moderately_severe_score(self) -> None:
        result = score_phq9([2] * 8 + [0])
        assert result.total == 16
        assert result.severity == "moderately_severe"

    def test_severe_score(self) -> None:
        result = score_phq9([3] * 7 + [0, 0])
        assert result.total == 21
        assert result.severity == "severe"

    def test_item_9_positive(self) -> None:
        result = score_phq9([0] * 8 + [1])
        assert result.total == 1
        assert result.item_9_positive is True

    def test_max_score(self) -> None:
        result = score_phq9([3] * 9)
        assert result.total == 27
        assert result.severity == "severe"
        assert result.item_9_positive is True


class TestGAD7Scoring:
    def test_minimal_score(self) -> None:
        result = score_gad7([0] * 7)
        assert result.total == 0
        assert result.severity == "minimal"

    def test_mild_score(self) -> None:
        result = score_gad7([1] * 5 + [0] * 2)
        assert result.total == 5
        assert result.severity == "mild"

    def test_moderate_score(self) -> None:
        result = score_gad7([2] * 5 + [0] * 2)
        assert result.total == 10
        assert result.severity == "moderate"

    def test_severe_score(self) -> None:
        result = score_gad7([3] * 5 + [0] * 2)
        assert result.total == 15
        assert result.severity == "severe"

    def test_max_score(self) -> None:
        result = score_gad7([3] * 7)
        assert result.total == 21
        assert result.severity == "severe"


class TestCSSRSScoring:
    def test_all_negative(self) -> None:
        result = score_cssrs([False] * 6)
        assert result.highest_positive == 0
        assert result.risk_label == "none"
        assert result.any_positive is False

    def test_q1_positive(self) -> None:
        result = score_cssrs([True, False, False, False, False, False])
        assert result.highest_positive == 1
        assert result.risk_label == "low_risk"
        assert result.any_positive is True

    def test_q2_positive(self) -> None:
        result = score_cssrs([False, True, False, False, False, False])
        assert result.highest_positive == 2
        assert result.risk_label == "moderate_risk"

    def test_q3_positive(self) -> None:
        result = score_cssrs([False, False, True, False, False, False])
        assert result.highest_positive == 3
        assert result.risk_label == "high_risk"

    def test_q4_positive(self) -> None:
        result = score_cssrs([False, False, False, True, False, False])
        assert result.highest_positive == 4
        assert result.risk_label == "imminent_risk"

    def test_q5_positive(self) -> None:
        result = score_cssrs([False, False, False, False, True, False])
        assert result.highest_positive == 5
        assert result.risk_label == "imminent_risk"

    def test_q6_positive(self) -> None:
        result = score_cssrs([False, False, False, False, False, True])
        assert result.highest_positive == 6
        assert result.risk_label == "imminent_risk"

    def test_multiple_positive(self) -> None:
        result = score_cssrs([True, True, True, False, False, False])
        assert result.highest_positive == 3
        assert result.risk_label == "high_risk"


class TestClassifyRisk:
    def test_all_low(self) -> None:
        phq9 = score_phq9([0] * 9)
        gad7 = score_gad7([0] * 7)
        cssrs = score_cssrs([False] * 6)
        assert classify_risk(phq9, gad7, cssrs) == RiskLevel.LOW

    def test_cssrs_q4_crisis(self) -> None:
        phq9 = score_phq9([0] * 9)
        gad7 = score_gad7([0] * 7)
        cssrs = score_cssrs([False, False, False, True, False, False])
        assert classify_risk(phq9, gad7, cssrs) == RiskLevel.CRISIS

    def test_cssrs_q5_crisis(self) -> None:
        phq9 = score_phq9([0] * 9)
        gad7 = score_gad7([0] * 7)
        cssrs = score_cssrs([False, False, False, False, True, False])
        assert classify_risk(phq9, gad7, cssrs) == RiskLevel.CRISIS

    def test_cssrs_q6_crisis(self) -> None:
        phq9 = score_phq9([0] * 9)
        gad7 = score_gad7([0] * 7)
        cssrs = score_cssrs([False, False, False, False, False, True])
        assert classify_risk(phq9, gad7, cssrs) == RiskLevel.CRISIS

    def test_cssrs_q3_high(self) -> None:
        phq9 = score_phq9([0] * 9)
        gad7 = score_gad7([0] * 7)
        cssrs = score_cssrs([False, False, True, False, False, False])
        assert classify_risk(phq9, gad7, cssrs) == RiskLevel.HIGH

    def test_phq9_item9_positive_medium(self) -> None:
        phq9 = score_phq9([0] * 8 + [1])
        gad7 = score_gad7([0] * 7)
        cssrs = score_cssrs([False] * 6)
        assert classify_risk(phq9, gad7, cssrs) == RiskLevel.MEDIUM

    def test_phq9_item9_positive_with_high_total(self) -> None:
        phq9 = score_phq9([2] * 8 + [1])
        gad7 = score_gad7([0] * 7)
        cssrs = score_cssrs([False] * 6)
        assert classify_risk(phq9, gad7, cssrs) == RiskLevel.HIGH

    def test_phq9_severe_high(self) -> None:
        phq9 = score_phq9([3] * 7 + [0, 0])
        gad7 = score_gad7([0] * 7)
        cssrs = score_cssrs([False] * 6)
        assert classify_risk(phq9, gad7, cssrs) == RiskLevel.HIGH

    def test_phq9_moderate_medium(self) -> None:
        phq9 = score_phq9([2] * 5 + [0] * 4)
        gad7 = score_gad7([0] * 7)
        cssrs = score_cssrs([False] * 6)
        assert classify_risk(phq9, gad7, cssrs) == RiskLevel.MEDIUM

    def test_gad7_moderate_medium(self) -> None:
        phq9 = score_phq9([0] * 9)
        gad7 = score_gad7([2] * 5 + [0] * 2)
        cssrs = score_cssrs([False] * 6)
        assert classify_risk(phq9, gad7, cssrs) == RiskLevel.MEDIUM

    def test_cssrs_q1_medium(self) -> None:
        phq9 = score_phq9([0] * 9)
        gad7 = score_gad7([0] * 7)
        cssrs = score_cssrs([True, False, False, False, False, False])
        assert classify_risk(phq9, gad7, cssrs) == RiskLevel.MEDIUM

    def test_cssrs_q2_high(self) -> None:
        phq9 = score_phq9([0] * 9)
        gad7 = score_gad7([0] * 7)
        cssrs = score_cssrs([False, True, False, False, False, False])
        assert classify_risk(phq9, gad7, cssrs) == RiskLevel.HIGH


class TestRecommendedActions:
    def test_low_actions(self) -> None:
        actions = get_recommended_actions(RiskLevel.LOW)
        assert len(actions) >= 1
        assert "routine" in actions[0].lower()

    def test_medium_actions(self) -> None:
        actions = get_recommended_actions(RiskLevel.MEDIUM)
        assert "supervisor" in " ".join(actions).lower()

    def test_high_actions(self) -> None:
        actions = get_recommended_actions(RiskLevel.HIGH)
        assert "supervisor" in " ".join(actions).lower()
        assert "safety" in " ".join(actions).lower()

    def test_crisis_actions(self) -> None:
        actions = get_recommended_actions(RiskLevel.CRISIS)
        assert "988" in " ".join(actions)
        assert "emergency" in " ".join(actions).lower()


# --------------------------------------------------------------------------- #
# Models Tests
# --------------------------------------------------------------------------- #


class TestModels:
    def test_phq9_valid(self) -> None:
        phq9 = PHQ9Scores(responses=[0] * 9)
        assert len(phq9.responses) == 9

    def test_phq9_wrong_length(self) -> None:
        with pytest.raises(ValueError, match=r"."):
            PHQ9Scores(responses=[0] * 8)

    def test_phq9_out_of_range(self) -> None:
        with pytest.raises(ValueError, match=r"."):
            PHQ9Scores(responses=[4] + [0] * 8)

    def test_gad7_valid(self) -> None:
        gad7 = GAD7Scores(responses=[0] * 7)
        assert len(gad7.responses) == 7

    def test_gad7_wrong_length(self) -> None:
        with pytest.raises(ValueError, match=r"."):
            GAD7Scores(responses=[0] * 6)

    def test_cssrs_valid(self) -> None:
        cssrs = CSSRSScreen(responses=[False] * 6)
        assert len(cssrs.responses) == 6

    def test_cssrs_wrong_length(self) -> None:
        with pytest.raises(ValueError, match=r"."):
            CSSRSScreen(responses=[False] * 5)

    def test_clinical_context_requires_ids(self) -> None:
        with pytest.raises(ValueError, match=r"."):
            ClinicalContext(note_text="test", session_id="", patient_id="pat-001")

    def test_clinical_context_note_max_length(self) -> None:
        with pytest.raises(ValueError, match=r"."):
            ClinicalContext(note_text="x" * 5001, session_id="s1", patient_id="p1")

    def test_risk_level_enum(self) -> None:
        assert RiskLevel.LOW.value == "low"
        assert RiskLevel.MEDIUM.value == "medium"
        assert RiskLevel.HIGH.value == "high"
        assert RiskLevel.CRISIS.value == "crisis"


# --------------------------------------------------------------------------- #
# PHI Tests
# --------------------------------------------------------------------------- #


class TestPHI:
    def test_redact_patient_id_consistent(self) -> None:
        r1 = redact_patient_id("pat-001")
        r2 = redact_patient_id("pat-001")
        assert r1 == r2
        assert r1.startswith("pid:")

    def test_redact_patient_id_different(self) -> None:
        r1 = redact_patient_id("pat-001")
        r2 = redact_patient_id("pat-002")
        assert r1 != r2

    def test_redact_session_id(self) -> None:
        r = redact_session_id("sess-001")
        assert r.startswith("sid:")
        assert len(r) == 10  # "sid:" + 6 hex chars

    def test_sanitize_phone(self) -> None:
        assert sanitize_for_logging("Call 555-123-4567") == "Call [REDACTED]"

    def test_sanitize_email(self) -> None:
        assert sanitize_for_logging("Email test@example.com") == "Email [REDACTED]"

    def test_sanitize_ssn(self) -> None:
        assert sanitize_for_logging("SSN 123-45-6789") == "SSN [REDACTED]"

    def test_sanitize_date(self) -> None:
        assert sanitize_for_logging("Date 01/15/2024") == "Date [REDACTED]"

    def test_sanitize_mrn(self) -> None:
        assert sanitize_for_logging("MRN123456") == "[REDACTED]"

    def test_sanitize_address(self) -> None:
        assert sanitize_for_logging("123 Main St") == "[REDACTED]"

    def test_sanitize_clean_text(self) -> None:
        clean = "Patient reports stable mood"
        assert sanitize_for_logging(clean) == clean

    def test_sanitize_multiple(self) -> None:
        text = "Call 555-123-4567 or email test@example.com, SSN 123-45-6789"
        result = sanitize_for_logging(text)
        assert "[REDACTED]" in result
        assert "555" not in result
        assert "test@" not in result
        assert "123-45" not in result


# --------------------------------------------------------------------------- #
# Service Tests
# --------------------------------------------------------------------------- #


class TestService:
    @pytest.mark.asyncio
    async def test_mock_stratify_low_risk(self, unconfigured_settings: RiskStratificationSettings) -> None:
        service = RiskStratificationService(unconfigured_settings)
        req = make_request()
        result = await service.stratify_risk(req)
        assert result.risk_level == RiskLevel.LOW
        assert result.model_source == "mock"
        assert result.requires_supervisor_review is False
        assert result.requires_crisis_protocol is False
        assert result.audit_entry_id.startswith("rs-")
        assert len(result.warnings) >= 1

    @pytest.mark.asyncio
    async def test_mock_stratify_crisis(self, unconfigured_settings: RiskStratificationSettings) -> None:
        service = RiskStratificationService(unconfigured_settings)
        req = make_request(cssrs=[False, False, False, True, False, False])
        result = await service.stratify_risk(req)
        assert result.risk_level == RiskLevel.CRISIS
        assert result.requires_supervisor_review is True
        assert result.requires_crisis_protocol is True

    @pytest.mark.asyncio
    async def test_mock_stratify_high(self, unconfigured_settings: RiskStratificationSettings) -> None:
        service = RiskStratificationService(unconfigured_settings)
        req = make_request(cssrs=[False, False, True, False, False, False])
        result = await service.stratify_risk(req)
        assert result.risk_level == RiskLevel.HIGH
        assert result.requires_supervisor_review is True

    @pytest.mark.asyncio
    async def test_mock_stratify_medium(self, unconfigured_settings: RiskStratificationSettings) -> None:
        service = RiskStratificationService(unconfigured_settings)
        req = make_request(phq9=[2] * 5 + [0] * 4)
        result = await service.stratify_risk(req)
        assert result.risk_level == RiskLevel.MEDIUM

    @pytest.mark.asyncio
    async def test_stratify_mock_method(self, unconfigured_settings: RiskStratificationSettings) -> None:
        service = RiskStratificationService(unconfigured_settings)
        req = make_request()
        result = await service.stratify_risk_mock(req)
        assert result.model_source == "mock"
        assert result.audit_entry_id.startswith("rs-mock-")

    @pytest.mark.asyncio
    async def test_nim_call_success(self, configured_settings: RiskStratificationSettings) -> None:
        service = RiskStratificationService(configured_settings)

        mock_response = {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "risk_level": "medium",
                                "confidence": 0.9,
                                "reasoning": "Patient shows mild anxiety",
                            }
                        )
                    }
                }
            ]
        }

        mock_resp = httpx.Response(
            200,
            json=mock_response,
            request=httpx.Request("POST", "http://hetzner-nim:8000/v1/chat/completions"),
        )

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_resp
            req = make_request()
            result = await service.stratify_risk(req)
            assert result.model_source == "nim-hetzner"
            assert result.confidence_score == 0.9

    @pytest.mark.asyncio
    async def test_nim_call_failure_falls_back(self, configured_settings: RiskStratificationSettings) -> None:
        service = RiskStratificationService(configured_settings)

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.side_effect = httpx.ConnectError("Connection refused")
            req = make_request()
            result = await service.stratify_risk(req)
            assert result.model_source == "mock"
            assert len(result.warnings) >= 1
            assert "NIM" in " ".join(result.warnings)

    @pytest.mark.asyncio
    async def test_nim_call_4xx_no_retry(self, configured_settings: RiskStratificationSettings) -> None:
        service = RiskStratificationService(configured_settings)

        mock_resp = httpx.Response(
            400,
            json={"error": "Bad request"},
            request=httpx.Request("POST", "http://hetzner-nim:8000/v1/chat/completions"),
        )

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_resp
            req = make_request()
            result = await service.stratify_risk(req)
            assert result.model_source == "mock"
            assert mock_post.call_count == 1

    @pytest.mark.asyncio
    async def test_nim_escalates_risk(self, configured_settings: RiskStratificationSettings) -> None:
        service = RiskStratificationService(configured_settings)

        mock_response = {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "risk_level": "high",
                                "confidence": 0.85,
                                "reasoning": "Note text shows concerning patterns",
                            }
                        )
                    }
                }
            ]
        }

        mock_resp = httpx.Response(
            200,
            json=mock_response,
            request=httpx.Request("POST", "http://hetzner-nim:8000/v1/chat/completions"),
        )

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_resp
            # Deterministic would say LOW
            req = make_request()
            result = await service.stratify_risk(req)
            # NIM escalates to HIGH
            assert result.risk_level == RiskLevel.HIGH
            assert "escalated" in " ".join(result.warnings).lower()

    def test_is_nim_configured_true(self, configured_settings: RiskStratificationSettings) -> None:
        service = RiskStratificationService(configured_settings)
        assert service.is_nim_configured is True

    def test_is_nim_configured_false(self, unconfigured_settings: RiskStratificationSettings) -> None:
        service = RiskStratificationService(unconfigured_settings)
        assert service.is_nim_configured is False

    def test_false_negative_rates_documented(self, configured_settings: RiskStratificationSettings) -> None:
        service = RiskStratificationService(configured_settings)
        rates = service.get_false_negative_rates()
        assert "crisis" in rates
        assert "high" in rates
        assert 0 < rates["crisis"] < 0.05
        assert 0 < rates["high"] < 0.1
        # Also verify the module-level constants
        assert FALSE_NEGATIVE_RATE_CRISIS == 0.01
        assert FALSE_NEGATIVE_RATE_HIGH == 0.05


class TestServiceHelpers:
    def test_build_prompt_contains_scores(self) -> None:
        req = RiskStratificationRequest(
            phq9=PHQ9Scores(responses=[3] * 9),
            gad7=GAD7Scores(responses=[0] * 7),
            cssrs=CSSRSScreen(responses=[False] * 6),
            clinical_context=ClinicalContext(
                note_text="Patient feels hopeless",
                session_id="sess-001",
                patient_id="pat-001",
            ),
        )
        phq9 = score_phq9([3] * 9)
        gad7 = score_gad7([0] * 7)
        cssrs = score_cssrs([False] * 6)
        prompt = _build_prompt(req, phq9, gad7, cssrs)
        assert "27" in prompt  # PHQ-9 total
        assert "severe" in prompt
        assert "hopeless" in prompt

    def test_parse_nim_response_valid(self) -> None:
        data = {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "risk_level": "high",
                                "confidence": 0.85,
                                "reasoning": "test",
                            }
                        )
                    }
                }
            ]
        }
        result = _parse_nim_response(data)
        assert result["risk_level"] == RiskLevel.HIGH
        assert result["confidence"] == 0.85

    def test_parse_nim_response_clamps_confidence(self) -> None:
        data = {"choices": [{"message": {"content": json.dumps({"risk_level": "low", "confidence": 1.5})}}]}
        result = _parse_nim_response(data)
        assert result["confidence"] == 1.0

    def test_parse_nim_response_invalid_json(self) -> None:
        data = {"choices": [{"message": {"content": "not json"}}]}
        with pytest.raises(ValueError, match=r"."):
            _parse_nim_response(data)

    def test_parse_nim_response_unknown_risk(self) -> None:
        data = {"choices": [{"message": {"content": json.dumps({"risk_level": "unknown", "confidence": 0.5})}}]}
        with pytest.raises(ValueError, match="Unknown risk level"):
            _parse_nim_response(data)

    def test_parse_nim_response_missing_choices(self) -> None:
        with pytest.raises(ValueError, match=r"."):
            _parse_nim_response({})


# --------------------------------------------------------------------------- #
# Endpoint Tests
# --------------------------------------------------------------------------- #


class TestEndpoints:
    def test_health_endpoint(self) -> None:
        client = TestClient(app)
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["service"] == "risk-stratification"

    def test_stratify_baa_not_confirmed(self, valid_request_body: dict) -> None:
        client = TestClient(app)
        baa_off = RiskStratificationSettings(baa_confirmed=False)
        app.dependency_overrides[get_settings] = lambda: baa_off
        try:
            resp = client.post("/stratify", json=valid_request_body)
            assert resp.status_code == 403
            assert "BAA" in resp.json()["detail"]
        finally:
            app.dependency_overrides.clear()

    def test_stratify_success(self, valid_request_body: dict) -> None:
        client = TestClient(app)
        baa_on = RiskStratificationSettings(nim_url="", nim_api_key="", baa_confirmed=True)
        app.dependency_overrides[get_settings] = lambda: baa_on
        try:
            resp = client.post("/stratify", json=valid_request_body)
            assert resp.status_code == 200
            data = resp.json()
            assert data["risk_level"] in ["low", "medium", "high", "crisis"]
            assert "score_breakdown" in data
            assert "recommended_actions" in data
            assert data["audit_entry_id"].startswith("rs-")
        finally:
            app.dependency_overrides.clear()

    def test_stratify_validation_error(self) -> None:
        client = TestClient(app)
        baa_on = RiskStratificationSettings(baa_confirmed=True)
        app.dependency_overrides[get_settings] = lambda: baa_on
        try:
            bad_body = {
                "phq9": {"responses": [0, 0, 0]},  # wrong length
                "gad7": {"responses": [0] * 7},
                "cssrs": {"responses": [False] * 6},
                "clinical_context": {
                    "note_text": "test",
                    "session_id": "s1",
                    "patient_id": "p1",
                },
            }
            resp = client.post("/stratify", json=bad_body)
            assert resp.status_code == 422
        finally:
            app.dependency_overrides.clear()

    def test_stratify_crisis_request(self) -> None:
        client = TestClient(app)
        baa_on = RiskStratificationSettings(nim_url="", nim_api_key="", baa_confirmed=True)
        app.dependency_overrides[get_settings] = lambda: baa_on
        try:
            body = {
                "phq9": {"responses": [3] * 9},
                "gad7": {"responses": [3] * 7},
                "cssrs": {"responses": [False, False, False, True, False, False]},
                "clinical_context": {
                    "note_text": "Patient expressing intent to harm",
                    "session_id": "sess-crisis",
                    "patient_id": "pat-crisis",
                },
            }
            resp = client.post("/stratify", json=body)
            assert resp.status_code == 200
            data = resp.json()
            assert data["risk_level"] == "crisis"
            assert data["requires_supervisor_review"] is True
            assert data["requires_crisis_protocol"] is True
        finally:
            app.dependency_overrides.clear()
