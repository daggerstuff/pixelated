"""Unit tests for services.ai.vertex_client."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from services.ai.vertex_client import (
    PHIViolationError,
    VertexAIClient,
    VertexAIConfig,
    validate_phi_free,
)


def test_validate_phi_free_clean() -> None:
    """Verify clean text passes validation without error."""
    validate_phi_free("Clinician feedback for session 42: good emotional rapport.")
    validate_phi_free("Patient expressed feelings of anxiety regarding work.")


def test_validate_phi_free_detects_ssn() -> None:
    """Verify SSN pattern is caught and blocked."""
    with pytest.raises(PHIViolationError, match="Social Security Number"):
        validate_phi_free("Patient identifier is 123-45-6789 in notes.")


def test_validate_phi_free_detects_mrn() -> None:
    """Verify MRN pattern is caught and blocked."""
    with pytest.raises(PHIViolationError, match="Medical Record Number"):
        validate_phi_free("Reference MRN: 1234567 for clinical history.")


def test_vertex_ai_config_defaults() -> None:
    """Verify default configuration attributes."""
    config = VertexAIConfig()
    assert config.project_id == "one-moon-505501-u3"
    assert config.location == "us-central1"
    assert config.default_model == "gemini-1.5-flash"
    assert config.default_embedding_model == "text-embedding-004"


def test_vertex_ai_config_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify configuration loads properly from environment variables."""
    monkeypatch.setenv("GCP_PROJECT_ID", "custom-project")
    monkeypatch.setenv("GCP_REGION", "us-east4")
    monkeypatch.setenv("VERTEX_DEFAULT_MODEL", "gemini-1.5-pro")

    config = VertexAIConfig.from_env()
    assert config.project_id == "custom-project"
    assert config.location == "us-east4"
    assert config.default_model == "gemini-1.5-pro"


def test_generate_text_mocked() -> None:
    """Verify generate_text calls client models with expected parameters."""
    client = VertexAIClient()

    mock_response = MagicMock()
    mock_response.text = "Empathetic response from Gemini."

    mock_genai_client = MagicMock()
    mock_genai_client.models.generate_content.return_value = mock_response

    client._client = mock_genai_client

    result = client.generate_text("How should a clinician respond?")
    assert result == "Empathetic response from Gemini."
    mock_genai_client.models.generate_content.assert_called_once()


def test_generate_text_blocks_phi() -> None:
    """Verify generate_text blocks calls containing PHI before hitting network."""
    client = VertexAIClient()
    client._client = MagicMock()

    with pytest.raises(PHIViolationError):
        client.generate_text("Notes for SSN 999-00-1111.")

    client._client.models.generate_content.assert_not_called()


@pytest.mark.asyncio
async def test_generate_text_async_mocked() -> None:
    """Verify generate_text_async invokes async client."""
    client = VertexAIClient()

    mock_response = MagicMock()
    mock_response.text = "Async response."

    mock_genai_client = MagicMock()
    mock_genai_client.aio.models.generate_content = AsyncMock(return_value=mock_response)

    client._client = mock_genai_client

    result = await client.generate_text_async("Prompt")
    assert result == "Async response."
    mock_genai_client.aio.models.generate_content.assert_awaited_once()


def test_generate_embeddings_mocked() -> None:
    """Verify generate_embeddings calls embed_content."""
    client = VertexAIClient()

    mock_emb = MagicMock()
    mock_emb.values = [0.1, 0.2, 0.3]
    mock_response = MagicMock()
    mock_response.embeddings = [mock_emb]

    mock_genai_client = MagicMock()
    mock_genai_client.models.embed_content.return_value = mock_response

    client._client = mock_genai_client

    result = client.generate_embeddings("Clinical statement")
    assert result == [[0.1, 0.2, 0.3]]
    mock_genai_client.models.embed_content.assert_called_once()
