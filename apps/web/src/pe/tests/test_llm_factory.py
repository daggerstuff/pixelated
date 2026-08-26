"""Tests for LLMProviderFactory and LLM config defaults."""

from __future__ import annotations

import pytest

from src.pe.config import Settings
from src.pe.core.llm_factory import LLMProviderFactory


class TestLLMConfigDefaults:
    """LLM env var defaults should be safe for local dev."""

    def test_default_provider_is_mock(self) -> None:
        s = Settings()
        assert s.LLM_PROVIDER == "mock"

    def test_api_key_defaults_to_none(self) -> None:
        s = Settings()
        assert s.LLM_API_KEY is None

    def test_base_url_defaults_to_none(self) -> None:
        s = Settings()
        assert s.LLM_BASE_URL is None

    def test_model_id_defaults_to_none(self) -> None:
        s = Settings()
        assert s.LLM_MODEL_ID is None

    def test_env_override_without_prefix(self, monkeypatch) -> None:
        monkeypatch.setenv("LLM_PROVIDER", "openai")
        monkeypatch.setenv("LLM_API_KEY", "sk-test")
        monkeypatch.setenv("LLM_MODEL_ID", "gpt-4-test")
        s = Settings()
        assert s.LLM_PROVIDER == "openai"
        assert s.LLM_API_KEY == "sk-test"
        assert s.LLM_MODEL_ID == "gpt-4-test"


class TestLLMProviderFactory:
    """Factory should return correct providers and validate at request time."""

    def test_create_mock_provider(self) -> None:
        provider = LLMProviderFactory.create(provider_type="mock")
        result = provider.generate([{"role": "user", "content": "hello"}])
        assert "hello" in result
        assert "Mock response" in result

    def test_factory_reads_from_settings(self) -> None:
        provider = LLMProviderFactory.create()
        assert provider is not None

    def test_create_mock_without_api_key_succeeds(self) -> None:
        provider = LLMProviderFactory.create(provider_type="mock", api_key=None)
        result = provider.generate([{"role": "user", "content": "test"}])
        assert "test" in result

    def test_create_openai_without_api_key_raises(self) -> None:
        with pytest.raises(ValueError, match="LLM_API_KEY is required"):
            LLMProviderFactory.create(provider_type="openai", api_key=None, model_id="gpt-4")

    def test_create_openai_compatible_without_key_raises(self) -> None:
        with pytest.raises(ValueError, match="LLM_API_KEY is required"):
            LLMProviderFactory.create(
                provider_type="openai-compatible",
                api_key=None,
                base_url="http://localhost:8080",
            )

    def test_create_openai_compatible_without_url_raises(self) -> None:
        with pytest.raises(ValueError, match="LLM_BASE_URL is required"):
            LLMProviderFactory.create(
                provider_type="openai-compatible",
                api_key="sk-test",
                base_url=None,
            )

    def test_unknown_provider_raises(self) -> None:
        with pytest.raises(ValueError, match="Unknown LLM_PROVIDER"):
            LLMProviderFactory.create(provider_type="invalid-provider")

    def test_valid_providers_set(self) -> None:
        assert {"mock", "openai", "openai-compatible"} == LLMProviderFactory.VALID_PROVIDERS
