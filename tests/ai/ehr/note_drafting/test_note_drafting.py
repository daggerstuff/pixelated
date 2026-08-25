"""Unit tests for the AI Note Drafting microservice.

Covers:
- Request/response model validation
- NIM mock responses and SOAP/DAP parsing
- BAA gate enforcement
- Error handling (NIM timeout, HTTP errors, parse errors)
- PHI sanitization
"""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from ai.ehr.note_drafting.config import NoteDraftingSettings
from ai.ehr.note_drafting.main import app, get_service, get_settings, verify_baa_gate
from ai.ehr.note_drafting.models import DraftRequest, DraftResponse, NoteFormat
from ai.ehr.note_drafting.phi import redact_patient_id, redact_session_id, sanitize_for_logging
from ai.ehr.note_drafting.service import NoteDraftingService, _build_prompt, _parse_nim_response

# --- Fixtures ---

VALID_TRANSCRIPT = (
    "Patient: I've been feeling really anxious lately, especially at night. "
    "Therapist: Can you tell me more about when this started? "
    "Patient: About two weeks ago, after I started a new job. I can't sleep well."
)


@pytest.fixture
def configured_settings() -> NoteDraftingSettings:
    """Settings with NIM configured and BAA confirmed."""
    return NoteDraftingSettings(
        nim_url="https://nim.example.com/v1/chat/completions",
        nim_api_key="test-key",
        nim_model="test-model",
        baa_confirmed=True,
        nim_timeout_seconds=5.0,
        nim_max_retries=2,
        nim_retry_base_delay=0.01,
    )


@pytest.fixture
def baa_disabled_settings() -> NoteDraftingSettings:
    """Settings with BAA NOT confirmed."""
    return NoteDraftingSettings(
        nim_url="https://nim.example.com/v1/chat/completions",
        nim_api_key="test-key",
        baa_confirmed=False,
    )


@pytest.fixture
def unconfigured_settings() -> NoteDraftingSettings:
    """Settings with NIM NOT configured."""
    return NoteDraftingSettings(
        baa_confirmed=True,
        nim_url="",
        nim_api_key="",
    )


@pytest.fixture
def valid_request_body() -> dict[str, Any]:
    """Valid request body for POST /draft."""
    return {
        "transcript": VALID_TRANSCRIPT,
        "patient_id": "patient-123",
        "session_id": "session-456",
        "note_format": "SOAP",
    }


def _make_nim_response(content: str) -> dict[str, Any]:
    """Build a mock OpenAI-compatible NIM response."""
    return {
        "choices": [
            {
                "message": {"role": "assistant", "content": content},
                "finish_reason": "stop",
            }
        ]
    }


SOAP_NIM_CONTENT = json.dumps({
    "subjective": "Patient reports anxiety and insomnia for 2 weeks.",
    "objective": "Alert, oriented, no acute distress.",
    "assessment": "Generalized anxiety with insomnia.",
    "plan": "Weekly therapy, CBT for sleep, follow-up in 2 weeks.",
})

DAP_NIM_CONTENT = json.dumps({
    "data": "Patient reports anxiety and insomnia for 2 weeks.",
    "assessment": "Generalized anxiety with insomnia.",
    "plan": "Weekly therapy, CBT for sleep, follow-up in 2 weeks.",
})


# --- Model validation tests ---


class TestDraftRequestValidation:
    """Tests for DraftRequest pydantic validation."""

    def test_valid_request(self) -> None:
        req = DraftRequest(
            transcript=VALID_TRANSCRIPT,
            patient_id="p1",
            session_id="s1",
            note_format=NoteFormat.SOAP,
        )
        assert req.transcript == VALID_TRANSCRIPT
        assert req.note_format == NoteFormat.SOAP

    def test_transcript_too_short(self) -> None:
        with pytest.raises(ValueError, match="transcript"):
            DraftRequest(transcript="short", patient_id="p1", session_id="s1")

    def test_transcript_blank_whitespace(self) -> None:
        with pytest.raises(ValueError, match="blank"):
            DraftRequest(transcript="   \n   \t  ", patient_id="p1", session_id="s1")

    def test_blank_patient_id(self) -> None:
        with pytest.raises(ValueError, match="blank"):
            DraftRequest(transcript=VALID_TRANSCRIPT, patient_id="   ", session_id="s1")

    def test_blank_session_id(self) -> None:
        with pytest.raises(ValueError, match="blank"):
            DraftRequest(transcript=VALID_TRANSCRIPT, patient_id="p1", session_id="   ")

    def test_default_note_format_is_soap(self) -> None:
        req = DraftRequest(transcript=VALID_TRANSCRIPT, patient_id="p1", session_id="s1")
        assert req.note_format == NoteFormat.SOAP

    def test_dap_format_accepted(self) -> None:
        req = DraftRequest(
            transcript=VALID_TRANSCRIPT,
            patient_id="p1",
            session_id="s1",
            note_format=NoteFormat.DAP,
        )
        assert req.note_format == NoteFormat.DAP


# --- Prompt building tests ---


class TestPromptBuilding:
    """Tests for _build_prompt function."""

    def test_soap_prompt_contains_section_keys(self) -> None:
        req = DraftRequest(
            transcript=VALID_TRANSCRIPT,
            patient_id="p1",
            session_id="s1",
            note_format=NoteFormat.SOAP,
        )
        sys_prompt, user_prompt = _build_prompt(req)
        assert "subjective" in sys_prompt
        assert "objective" in sys_prompt
        assert "assessment" in sys_prompt
        assert "plan" in sys_prompt
        assert VALID_TRANSCRIPT in user_prompt

    def test_dap_prompt_contains_section_keys(self) -> None:
        req = DraftRequest(
            transcript=VALID_TRANSCRIPT,
            patient_id="p1",
            session_id="s1",
            note_format=NoteFormat.DAP,
        )
        sys_prompt, _user_prompt = _build_prompt(req)
        assert "data" in sys_prompt
        assert "assessment" in sys_prompt
        assert "plan" in sys_prompt
        assert "subjective" not in sys_prompt


# --- NIM response parsing tests ---


class TestNimResponseParsing:
    """Tests for _parse_nim_response function."""

    def test_parse_soap_success(self) -> None:
        draft, sections, confidence = _parse_nim_response(SOAP_NIM_CONTENT, NoteFormat.SOAP)
        assert "Subjective" in draft
        assert "Objective" in draft
        assert "Assessment" in draft
        assert "Plan" in draft
        assert sections.subjective == "Patient reports anxiety and insomnia for 2 weeks."
        assert sections.objective is not None
        assert sections.assessment is not None
        assert sections.plan is not None
        assert confidence >= 0.8

    def test_parse_dap_success(self) -> None:
        draft, sections, confidence = _parse_nim_response(DAP_NIM_CONTENT, NoteFormat.DAP)
        assert "Data" in draft
        assert "Assessment" in draft
        assert "Plan" in draft
        assert sections.data is not None
        assert sections.assessment is not None
        assert sections.plan is not None
        assert confidence >= 0.8

    def test_parse_invalid_json_fallback(self) -> None:
        raw = "This is not JSON, just raw text."
        draft, _sections, confidence = _parse_nim_response(raw, NoteFormat.SOAP)
        assert confidence == 0.3
        assert "This is not JSON" in draft

    def test_parse_markdown_fenced_json(self) -> None:
        fenced = f"```json\n{SOAP_NIM_CONTENT}\n```"
        _draft, sections, confidence = _parse_nim_response(fenced, NoteFormat.SOAP)
        assert sections.subjective is not None
        assert confidence >= 0.8

    def test_parse_soap_missing_section(self) -> None:
        partial = json.dumps({"subjective": "Content", "objective": "", "assessment": "A", "plan": "P"})
        _draft, sections, confidence = _parse_nim_response(partial, NoteFormat.SOAP)
        assert confidence < 0.8
        assert sections.objective == ""


# --- Service tests ---


class TestNoteDraftingService:
    """Tests for the NoteDraftingService class."""

    @pytest.mark.asyncio
    async def test_draft_note_success(
        self, configured_settings: NoteDraftingSettings
    ) -> None:
        """Test successful NIM call with SOAP format."""
        service = NoteDraftingService(configured_settings)
        req = DraftRequest(
            transcript=VALID_TRANSCRIPT,
            patient_id="p1",
            session_id="s1",
            note_format=NoteFormat.SOAP,
        )
        mock_response = MagicMock()
        mock_response.json.return_value = _make_nim_response(SOAP_NIM_CONTENT)
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response):
            result = await service.draft_note(req)

        assert isinstance(result, DraftResponse)
        assert result.sections.subjective is not None
        assert result.confidence >= 0.8
        assert result.warnings == []

    @pytest.mark.asyncio
    async def test_draft_note_dap_success(
        self, configured_settings: NoteDraftingSettings
    ) -> None:
        """Test successful NIM call with DAP format."""
        service = NoteDraftingService(configured_settings)
        req = DraftRequest(
            transcript=VALID_TRANSCRIPT,
            patient_id="p1",
            session_id="s1",
            note_format=NoteFormat.DAP,
        )
        mock_response = MagicMock()
        mock_response.json.return_value = _make_nim_response(DAP_NIM_CONTENT)
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response):
            result = await service.draft_note(req)

        assert result.sections.data is not None
        assert result.sections.subjective is None
        assert result.confidence >= 0.8

    @pytest.mark.asyncio
    async def test_draft_note_nim_timeout_retry(
        self, configured_settings: NoteDraftingSettings
    ) -> None:
        """Test that timeout triggers retry."""
        service = NoteDraftingService(configured_settings)
        req = DraftRequest(
            transcript=VALID_TRANSCRIPT,
            patient_id="p1",
            session_id="s1",
        )
        success_response = MagicMock()
        success_response.json.return_value = _make_nim_response(SOAP_NIM_CONTENT)
        success_response.raise_for_status = MagicMock()

        with patch(
            "httpx.AsyncClient.post",
            new_callable=AsyncMock,
            side_effect=[
                httpx.TimeoutException("timeout"),
                success_response,
            ],
        ):
            result = await service.draft_note(req)

        assert isinstance(result, DraftResponse)

    @pytest.mark.asyncio
    async def test_draft_note_all_retries_exhausted(
        self, configured_settings: NoteDraftingSettings
    ) -> None:
        """Test that exhausting retries raises RuntimeError."""
        service = NoteDraftingService(configured_settings)
        req = DraftRequest(
            transcript=VALID_TRANSCRIPT,
            patient_id="p1",
            session_id="s1",
        )

        with (
            patch(
                "httpx.AsyncClient.post",
                new_callable=AsyncMock,
                side_effect=httpx.TimeoutException("timeout"),
            ),
            pytest.raises(RuntimeError, match="failed after"),
        ):
            await service.draft_note(req)

    @pytest.mark.asyncio
    async def test_draft_note_4xx_no_retry(
        self, configured_settings: NoteDraftingSettings
    ) -> None:
        """Test that 4xx errors (except 429) don't retry."""
        service = NoteDraftingService(configured_settings)
        req = DraftRequest(
            transcript=VALID_TRANSCRIPT,
            patient_id="p1",
            session_id="s1",
        )
        error_response = MagicMock()
        error_response.status_code = 400
        http_error = httpx.HTTPStatusError(
            "Bad Request", request=MagicMock(), response=error_response
        )

        mock_post = AsyncMock(side_effect=http_error)

        with patch("httpx.AsyncClient.post", new=mock_post), pytest.raises(RuntimeError, match="failed after"):
            await service.draft_note(req)

        # Should have only been called once (no retry on 4xx)
        assert mock_post.call_count == 1

    @pytest.mark.asyncio
    async def test_draft_note_not_configured_raises(self, unconfigured_settings: NoteDraftingSettings) -> None:
        """Test that unconfigured NIM raises RuntimeError."""
        service = NoteDraftingService(unconfigured_settings)
        req = DraftRequest(
            transcript=VALID_TRANSCRIPT,
            patient_id="p1",
            session_id="s1",
        )
        with pytest.raises(RuntimeError, match="not configured"):
            await service.draft_note(req)

    @pytest.mark.asyncio
    async def test_mock_response_soap(self, unconfigured_settings: NoteDraftingSettings) -> None:
        """Test mock response generates valid SOAP note."""
        service = NoteDraftingService(unconfigured_settings)
        req = DraftRequest(
            transcript=VALID_TRANSCRIPT,
            patient_id="p1",
            session_id="s1",
            note_format=NoteFormat.SOAP,
        )
        result = await service.draft_note_mock(req)
        assert "[Mock]" in result.draft_note
        assert result.sections.subjective is not None
        assert "Mock" in result.warnings[0]

    @pytest.mark.asyncio
    async def test_mock_response_dap(self, unconfigured_settings: NoteDraftingSettings) -> None:
        """Test mock response generates valid DAP note."""
        service = NoteDraftingService(unconfigured_settings)
        req = DraftRequest(
            transcript=VALID_TRANSCRIPT,
            patient_id="p1",
            session_id="s1",
            note_format=NoteFormat.DAP,
        )
        result = await service.draft_note_mock(req)
        assert "[Mock]" in result.draft_note
        assert result.sections.data is not None
        assert result.sections.subjective is None


# --- BAA gate tests ---


class TestBAAGate:
    """Tests for BAA gate enforcement via FastAPI TestClient."""

    def test_baa_disabled_rejects_403(
        self, baa_disabled_settings: NoteDraftingSettings, valid_request_body: dict[str, Any]
    ) -> None:
        """Test that BAA disabled returns 403."""
        app.dependency_overrides[get_settings] = lambda: baa_disabled_settings
        app.dependency_overrides[verify_baa_gate] = lambda: None if baa_disabled_settings.baa_confirmed else (_ for _ in ()).throw(
            __import__("fastapi").HTTPException(status_code=403, detail="BAA not confirmed.")
        )
        client = TestClient(app)
        response = client.post("/draft", json=valid_request_body)
        assert response.status_code == 403
        app.dependency_overrides.clear()

    @pytest.mark.usefixtures("unconfigured_settings")
    def test_baa_enabled_accepts(
        self, valid_request_body: dict[str, Any]
    ) -> None:
        """Test that BAA enabled with unconfigured NIM returns mock response."""
        settings = NoteDraftingSettings(
            baa_confirmed=True,
            nim_url="",
            nim_api_key="",
        )
        service = NoteDraftingService(settings)
        app.dependency_overrides[get_settings] = lambda: settings
        app.dependency_overrides[get_service] = lambda: service
        app.dependency_overrides[verify_baa_gate] = lambda: None
        client = TestClient(app)
        response = client.post("/draft", json=valid_request_body)
        assert response.status_code == 200
        data = response.json()
        assert "draft_note" in data
        assert "sections" in data
        assert "confidence" in data
        assert "warnings" in data
        app.dependency_overrides.clear()


# --- Endpoint tests ---


class TestDraftEndpoint:
    """Integration tests for POST /draft endpoint."""

    def test_health_check(self) -> None:
        """Test health endpoint."""
        client = TestClient(app)
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"

    def test_invalid_transcript_short(self, valid_request_body: dict[str, Any]) -> None:
        """Test that short transcript returns 422."""
        settings = NoteDraftingSettings(baa_confirmed=True, nim_url="", nim_api_key="")
        app.dependency_overrides[get_settings] = lambda: settings
        app.dependency_overrides[verify_baa_gate] = lambda: None
        app.dependency_overrides[get_service] = lambda: NoteDraftingService(settings)
        client = TestClient(app)
        body = {**valid_request_body, "transcript": "short"}
        response = client.post("/draft", json=body)
        assert response.status_code == 422
        app.dependency_overrides.clear()

    def test_missing_patient_id(self) -> None:
        """Test that missing patient_id returns 422."""
        settings = NoteDraftingSettings(baa_confirmed=True, nim_url="", nim_api_key="")
        app.dependency_overrides[get_settings] = lambda: settings
        app.dependency_overrides[verify_baa_gate] = lambda: None
        app.dependency_overrides[get_service] = lambda: NoteDraftingService(settings)
        client = TestClient(app)
        body = {"transcript": VALID_TRANSCRIPT, "session_id": "s1", "note_format": "SOAP"}
        response = client.post("/draft", json=body)
        assert response.status_code == 422
        app.dependency_overrides.clear()

    def test_mock_soap_response(
        self, unconfigured_settings: NoteDraftingSettings, valid_request_body: dict[str, Any]
    ) -> None:
        """Test full SOAP mock flow through the endpoint."""
        service = NoteDraftingService(unconfigured_settings)
        app.dependency_overrides[get_settings] = lambda: unconfigured_settings
        app.dependency_overrides[get_service] = lambda: service
        app.dependency_overrides[verify_baa_gate] = lambda: None
        client = TestClient(app)
        response = client.post("/draft", json=valid_request_body)
        assert response.status_code == 200
        data = response.json()
        assert "S (Subjective)" in data["draft_note"]
        assert "O (Objective)" in data["draft_note"]
        assert data["sections"]["subjective"] is not None
        app.dependency_overrides.clear()

    def test_mock_dap_response(self, unconfigured_settings: NoteDraftingSettings) -> None:
        """Test full DAP mock flow through the endpoint."""
        service = NoteDraftingService(unconfigured_settings)
        app.dependency_overrides[get_settings] = lambda: unconfigured_settings
        app.dependency_overrides[get_service] = lambda: service
        app.dependency_overrides[verify_baa_gate] = lambda: None
        client = TestClient(app)
        body = {
            "transcript": VALID_TRANSCRIPT,
            "patient_id": "p1",
            "session_id": "s1",
            "note_format": "DAP",
        }
        response = client.post("/draft", json=body)
        assert response.status_code == 200
        data = response.json()
        assert "D (Data)" in data["draft_note"]
        assert data["sections"]["data"] is not None
        assert data["sections"]["subjective"] is None
        app.dependency_overrides.clear()

    def test_nim_error_returns_502(
        self, configured_settings: NoteDraftingSettings, valid_request_body: dict[str, Any]
    ) -> None:
        """Test that NIM errors return 502."""
        service = NoteDraftingService(configured_settings)
        app.dependency_overrides[get_settings] = lambda: configured_settings
        app.dependency_overrides[get_service] = lambda: service
        app.dependency_overrides[verify_baa_gate] = lambda: None
        client = TestClient(app)

        with patch(
            "httpx.AsyncClient.post",
            new_callable=AsyncMock,
            side_effect=httpx.TimeoutException("timeout"),
        ):
            response = client.post("/draft", json=valid_request_body)

        assert response.status_code == 502
        app.dependency_overrides.clear()


# --- PHI sanitization tests ---


class TestPHISanitization:
    """Tests for PHI sanitization utilities."""

    def test_redact_phone(self) -> None:
        text = "Call me at (555) 123-4567 today."
        sanitized = sanitize_for_logging(text)
        assert "[REDACTED-PHONE]" in sanitized
        assert "555" not in sanitized

    def test_redact_email(self) -> None:
        text = "Email: john.doe@example.com"
        sanitized = sanitize_for_logging(text)
        assert "[REDACTED-EMAIL]" in sanitized
        assert "john.doe" not in sanitized

    def test_redact_ssn(self) -> None:
        text = "SSN: 123-45-6789"
        sanitized = sanitize_for_logging(text)
        assert "[REDACTED-SSN]" in sanitized

    def test_redact_date(self) -> None:
        text = "DOB: 01/15/1990"
        sanitized = sanitize_for_logging(text)
        assert "[REDACTED-DATE]" in sanitized

    def test_redact_mrn(self) -> None:
        text = "MRN: ABC123456789"
        sanitized = sanitize_for_logging(text)
        assert "[REDACTED-MRN]" in sanitized

    def test_redact_address(self) -> None:
        text = "Patient lives at 123 Main St"
        sanitized = sanitize_for_logging(text)
        assert "[REDACTED-ADDRESS]" in sanitized

    def test_redact_multiple_types(self) -> None:
        text = "Contact: (555) 123-4567, email: jane@example.com, SSN: 111-22-3333"
        sanitized = sanitize_for_logging(text)
        assert sanitized.count("[REDACTED") == 3

    def test_redact_patient_id(self) -> None:
        masked = redact_patient_id("patient-123")
        assert masked.startswith("pid:")
        assert len(masked) == 10  # "pid:" + 6 hex chars

    def test_redact_session_id(self) -> None:
        masked = redact_session_id("session-456")
        assert masked.startswith("sid:")
        assert len(masked) == 10

    def test_redact_patient_id_consistent(self) -> None:
        """Same input produces same output (deterministic)."""
        a = redact_patient_id("p1")
        b = redact_patient_id("p1")
        assert a == b

    def test_no_phi_in_clean_text(self) -> None:
        text = "Patient reported anxiety and insomnia."
        sanitized = sanitize_for_logging(text)
        assert sanitized == text
