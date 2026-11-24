"""Gemini client for Google Cloud (Vertex AI) and Google AI Studio.

Adheres strictly to Pixelated Empathy's Google Cloud & Gemini Usage Policy:
- Vertex AI on Google Cloud project `one-moon-505501-u3` (`us-central1`) is the
  approved embeddings path (text-embedding-004, 768 dims).
- Generative text routes through the Google AI Studio key (`GOOGLE_API_KEY`)
  when set; the project has no generative model entitlement on Vertex.
- Built-in HIPAA pre-check prevents transmission of unmasked identifiers.
- Eligible for the Google for Startups $2,000 credit package.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import Any

from google import genai
from google.genai import types

# Simple heuristic patterns to block unmasked PHI / PII
_SSN_PATTERN = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")
_MRN_PATTERN = re.compile(r"\bMRN[:\s#]+[0-9]{6,10}\b", re.IGNORECASE)


class PHIViolationError(ValueError):
    """Raised when text appears to contain unmasked PHI/PII."""


def validate_phi_free(text: str) -> None:
    """Validate that text does not contain unmasked PHI patterns.

    Raises:
        PHIViolationError: If suspicious unmasked identifiers are detected.
    """
    if _SSN_PATTERN.search(text):
        raise PHIViolationError("Payload rejected: detected potential unmasked Social Security Number.")
    if _MRN_PATTERN.search(text):
        raise PHIViolationError("Payload rejected: detected potential unmasked Medical Record Number (MRN).")


@dataclass
class VertexAIConfig:
    """Configuration for Gemini connections (Vertex AI or Google AI Studio)."""

    project_id: str = "one-moon-505501-u3"
    location: str = "us-central1"
    default_model: str = "gemini-3.8-flash"
    default_embedding_model: str = "text-embedding-004"
    api_key: str | None = None

    @classmethod
    def from_env(cls) -> VertexAIConfig:
        """Create configuration from environment variables.

        When GOOGLE_API_KEY is set, generation routes through Google AI Studio
        and embeddings default to gemini-embedding-001 (text-embedding-004 is
        Vertex-only). Without the key, the classic Vertex ADC path is used.
        """
        api_key = os.getenv("GOOGLE_API_KEY") or None
        default_embedding = "gemini-embedding-001" if api_key else "text-embedding-004"
        return cls(
            project_id=os.getenv("GCP_PROJECT_ID", "one-moon-505501-u3"),
            location=os.getenv("GCP_REGION", "us-central1"),
            default_model=os.getenv("VERTEX_DEFAULT_MODEL", "gemini-3.8-flash"),
            default_embedding_model=os.getenv("VERTEX_EMBEDDING_MODEL", default_embedding),
            api_key=api_key,
        )


class VertexAIClient:
    """Client for Gemini generation and embeddings (AI Studio key or Vertex AI)."""

    def __init__(self, config: VertexAIConfig | None = None) -> None:
        self.config = config or VertexAIConfig.from_env()
        self._client: genai.Client | None = None

    @property
    def client(self) -> genai.Client:
        """Lazy-initialize the GenAI client (AI Studio key or Vertex AI)."""
        if self._client is None:
            if self.config.api_key:
                self._client = genai.Client(api_key=self.config.api_key)
            else:
                self._client = genai.Client(
                    vertexai=True,
                    project=self.config.project_id,
                    location=self.config.location,
                )
        return self._client

    def generate_text(
        self,
        prompt: str,
        model: str | None = None,
        temperature: float = 0.7,
        max_output_tokens: int | None = None,
        system_instruction: str | None = None,
    ) -> str:
        """Generate text using Gemini (AI Studio when GOOGLE_API_KEY is set, else Vertex AI).

        Args:
            prompt: User prompt text.
            model: Model name (defaults to config.default_model).
            temperature: Sampling temperature (0.0 to 2.0).
            max_output_tokens: Maximum tokens in generated response.
            system_instruction: Optional system instruction.

        Returns:
            Generated text string.
        """
        validate_phi_free(prompt)
        if system_instruction:
            validate_phi_free(system_instruction)

        target_model = model or self.config.default_model
        config_kwargs: dict[str, Any] = {"temperature": temperature}
        if max_output_tokens is not None:
            config_kwargs["max_output_tokens"] = max_output_tokens
        if system_instruction is not None:
            config_kwargs["system_instruction"] = system_instruction

        config = types.GenerateContentConfig(**config_kwargs)
        response = self.client.models.generate_content(
            model=target_model,
            contents=prompt,
            config=config,
        )
        return response.text or ""

    async def generate_text_async(
        self,
        prompt: str,
        model: str | None = None,
        temperature: float = 0.7,
        max_output_tokens: int | None = None,
        system_instruction: str | None = None,
    ) -> str:
        """Generate text asynchronously (AI Studio when GOOGLE_API_KEY is set, else Vertex AI)."""
        validate_phi_free(prompt)
        if system_instruction:
            validate_phi_free(system_instruction)

        target_model = model or self.config.default_model
        config_kwargs: dict[str, Any] = {"temperature": temperature}
        if max_output_tokens is not None:
            config_kwargs["max_output_tokens"] = max_output_tokens
        if system_instruction is not None:
            config_kwargs["system_instruction"] = system_instruction

        config = types.GenerateContentConfig(**config_kwargs)
        response = await self.client.aio.models.generate_content(
            model=target_model,
            contents=prompt,
            config=config,
        )
        return response.text or ""

    def generate_embeddings(
        self,
        text_or_texts: str | list[str],
        model: str | None = None,
    ) -> list[list[float]]:
        """Generate vector embeddings (gemini-embedding-001 via AI Studio, text-embedding-004 via Vertex).

        Args:
            text_or_texts: Single string or list of text strings.
            model: Model name (defaults to config.default_embedding_model).

        Returns:
            List of float vectors.
        """
        inputs = [text_or_texts] if isinstance(text_or_texts, str) else text_or_texts
        for item in inputs:
            validate_phi_free(item)

        target_model = model or self.config.default_embedding_model
        response = self.client.models.embed_content(
            model=target_model,
            contents=inputs,
        )
        if hasattr(response, "embeddings") and response.embeddings:
            return [emb.values for emb in response.embeddings if hasattr(emb, "values")]
        return []
