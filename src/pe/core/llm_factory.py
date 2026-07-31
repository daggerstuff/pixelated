"""LLM provider factory — creates providers from runtime configuration.

Validation happens at request/creation time, not at boot, so missing
API keys or URLs only surface when a provider is actually requested.
"""

from __future__ import annotations

from ai.orchestration.core.inference import LLMProvider, MockLLMProvider, OpenAIProvider
from src.pe.config import settings


class LLMProviderFactory:
    """Creates LLM provider instances based on the current configuration.

    The factory validates credentials at creation time and raises clear
    errors when required config is missing for the selected provider type.
    """

    VALID_PROVIDERS = frozenset({"mock", "openai", "openai-compatible"})

    @classmethod
    def create(
        cls,
        provider_type: str | None = None,
        api_key: str | None = None,
        base_url: str | None = None,
        model_id: str | None = None,
    ) -> LLMProvider:
        """Build and return an LLM provider.

        Falls back to the global ``settings`` for any argument that is
        not explicitly passed.

        Raises
        ------
        ValueError
            If *provider_type* is unknown, or if required credentials for
            the selected provider are missing.
        """
        provider = provider_type or settings.LLM_PROVIDER
        resolved_api_key = api_key or settings.LLM_API_KEY
        resolved_base_url = base_url or settings.LLM_BASE_URL
        resolved_model = model_id or settings.LLM_MODEL_ID

        if provider not in cls.VALID_PROVIDERS:
            valid = ", ".join(sorted(cls.VALID_PROVIDERS))
            raise ValueError(f"Unknown LLM_PROVIDER: '{provider}'. Expected one of: {valid}.")

        if provider == "mock":
            return MockLLMProvider()

        if provider == "openai":
            cls._require(resolved_api_key, "LLM_API_KEY", "openai")
            return OpenAIProvider(
                api_key=resolved_api_key,
                model=resolved_model or "gpt-4",
            )

        if provider == "openai-compatible":
            cls._require(resolved_api_key, "LLM_API_KEY", "openai-compatible")
            cls._require(resolved_base_url, "LLM_BASE_URL", "openai-compatible")
            return OpenAIProvider(
                api_key=resolved_api_key,
                model=resolved_model or "gpt-4",
                base_url=resolved_base_url,
            )

        raise ValueError(f"Unhandled provider type: {provider}")

    @staticmethod
    def _require(value: str | None, var_name: str, provider_name: str) -> None:
        if value:
            return
        raise ValueError(
            f"{var_name} is required for the '{provider_name}' provider. "
            f"Set the {var_name} environment variable or pass it explicitly."
        )
