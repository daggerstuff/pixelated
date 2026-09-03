"""Agno model factory for SkillReducer LLM calls."""

from __future__ import annotations

from typing import TYPE_CHECKING

from skillreducer.config import (
    Config,
    resolve_api_base_url,
    resolve_api_key,
    resolve_api_version,
    resolve_azure_endpoint,
    resolve_azure_subscription,
    resolve_compression_model,
    resolve_evaluation_model,
    resolve_routing_model,
)

if TYPE_CHECKING:
    from agno.models.base import Model

try:
    from agno.models.azure import AzureOpenAI
except ImportError:  # pragma: no cover - optional at type-check time
    AzureOpenAI = None  # type: ignore[misc, assignment]

try:
    from agno.models.openai import OpenAIChat
except ImportError:  # pragma: no cover - optional at type-check time
    OpenAIChat = None  # type: ignore[misc, assignment]


def create_openai_chat(
    config: Config,
    *,
    model_id: str | None = None,
    temperature: float = 0.0,
) -> Model:
    """Build an Agno chat model from SkillReducer config."""
    api_key = resolve_api_key(config)
    if not api_key:
        raise ValueError(
            "No API key found. Set api_key in the environment, .env, or config.yaml."
        )

    deployment = model_id or resolve_compression_model(config)
    kwargs: dict = {
        "id": deployment,
        "api_key": api_key,
        "temperature": temperature,
    }

    if resolve_azure_subscription(config):
        if AzureOpenAI is None:
            raise ImportError("agno is not installed. Install with: pip install agno")
        kwargs["azure_deployment"] = deployment
        endpoint = resolve_azure_endpoint(config)
        if endpoint:
            kwargs["azure_endpoint"] = endpoint
        kwargs["api_version"] = resolve_api_version(config)
        return AzureOpenAI(**kwargs)

    if OpenAIChat is None:
        raise ImportError("agno is not installed. Install with: pip install agno")

    base_url = resolve_api_base_url(config)
    if base_url:
        kwargs["base_url"] = base_url
    return OpenAIChat(**kwargs)


def create_compression_model(config: Config) -> Model:
    return create_openai_chat(config, model_id=resolve_compression_model(config))


def create_routing_model(config: Config) -> Model:
    return create_openai_chat(config, model_id=resolve_routing_model(config))


def create_evaluation_model(config: Config) -> Model:
    return create_openai_chat(config, model_id=resolve_evaluation_model(config))
