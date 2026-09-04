from __future__ import annotations

import os
from unittest.mock import patch

import pytest

from skillreducer.config import (
    Config,
    load_dotenv,
    normalize_azure_endpoint,
    resolve_api_base_url,
    resolve_api_key,
    resolve_api_version,
    resolve_azure_endpoint,
    resolve_azure_subscription,
    resolve_compression_model,
    resolve_routing_model,
)
from skillreducer.llm.client import LLMClient
from skillreducer.model import (
    create_compression_model,
    create_evaluation_model,
    create_openai_chat,
    create_routing_model,
)


@pytest.fixture(autouse=True)
def clear_credential_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("api_key", raising=False)
    monkeypatch.delenv("api_base_url", raising=False)
    monkeypatch.delenv("compression_model", raising=False)
    monkeypatch.delenv("compression", raising=False)
    monkeypatch.delenv("routing_model", raising=False)
    monkeypatch.delenv("routing_oracle", raising=False)
    monkeypatch.delenv("evaluation_model", raising=False)
    monkeypatch.delenv("evaluation", raising=False)
    monkeypatch.delenv("azure_subscription", raising=False)
    monkeypatch.delenv("azure_endpoint", raising=False)
    monkeypatch.delenv("api_version", raising=False)
    monkeypatch.delenv("azure_api_version", raising=False)


def test_load_dotenv_finds_env_in_parent_directory(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    work = tmp_path / "nested" / "run"
    work.mkdir(parents=True)
    (tmp_path / ".env").write_text("api_key=parent-key\n", encoding="utf-8")
    monkeypatch.chdir(work)
    monkeypatch.delenv("api_key", raising=False)

    load_dotenv(force=True)

    assert os.environ.get("api_key") == "parent-key"


def test_load_dotenv_cwd_overrides_parent(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    work = tmp_path / "nested" / "run"
    work.mkdir(parents=True)
    (tmp_path / ".env").write_text("api_key=parent-key\n", encoding="utf-8")
    (work / ".env").write_text("api_key=cwd-key\n", encoding="utf-8")
    monkeypatch.chdir(work)
    monkeypatch.delenv("api_key", raising=False)

    load_dotenv(force=True)

    assert os.environ.get("api_key") == "cwd-key"


def test_resolve_api_key_prefers_environment_over_config() -> None:
    config = Config(api_key="yaml-key")
    with patch.dict(os.environ, {"api_key": "env-key"}):
        assert resolve_api_key(config) == "env-key"


def test_resolve_api_base_url_prefers_environment_over_config() -> None:
    config = Config(api_base_url="https://yaml.example/v1")
    with patch.dict(os.environ, {"api_base_url": "https://env.example/v1"}):
        assert resolve_api_base_url(config) == "https://env.example/v1"


def test_config_load_merges_env_credentials(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    config_path = tmp_path / "config.yaml"
    config_path.write_text(
        "api_key: yaml-key\napi_base_url: https://yaml.example/v1\n",
        encoding="utf-8",
    )
    monkeypatch.setenv("api_key", "env-key")
    monkeypatch.setenv("api_base_url", "https://env.example/v1")

    config = Config.load(config_path)

    assert config.api_key == "env-key"
    assert config.api_base_url == "https://env.example/v1"
    assert resolve_api_key(config) == "env-key"
    assert resolve_api_base_url(config) == "https://env.example/v1"


def test_resolve_model_ids_prefers_environment_over_config() -> None:
    config = Config(
        compression_model="yaml-compression",
        routing_model="yaml-routing",
        evaluation_model="yaml-evaluation",
    )
    with patch.dict(
        os.environ,
        {
            "compression_model": "env-compression",
            "routing_model": "env-routing",
            "evaluation_model": "env-evaluation",
        },
    ):
        assert resolve_compression_model(config) == "env-compression"
        assert resolve_routing_model(config) == "env-routing"


def test_config_load_merges_env_model_ids(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    config_path = tmp_path / "config.yaml"
    config_path.write_text(
        "models:\n"
        "  compression: yaml-compression\n"
        "  routing_oracle: yaml-routing\n"
        "  evaluation: yaml-evaluation\n",
        encoding="utf-8",
    )
    monkeypatch.setenv("compression_model", "env-compression")
    monkeypatch.setenv("routing_model", "env-routing")
    monkeypatch.setenv("evaluation_model", "env-evaluation")

    config = Config.load(config_path)

    assert config.compression_model == "env-compression"
    assert config.routing_model == "env-routing"
    assert config.evaluation_model == "env-evaluation"


def test_all_agents_use_same_resolved_credentials() -> None:
    config = Config(
        api_key="yaml-key-should-not-win",
        api_base_url="https://yaml.example/v1",
        compression_model="compression-model",
        routing_model="routing-model",
        evaluation_model="evaluation-model",
    )
    captured: list[dict] = []

    class FakeOpenAIChat:
        def __init__(self, **kwargs) -> None:
            captured.append(kwargs)

    with patch.dict(
        os.environ,
        {
            "api_key": "shared-env-key",
            "api_base_url": "https://shared.example/v1",
        },
    ):
        with patch("skillreducer.model.OpenAIChat", FakeOpenAIChat):
            create_openai_chat(config)
            create_compression_model(config)
            create_routing_model(config)
            create_evaluation_model(config)

    assert len(captured) == 4
    assert captured[0]["id"] == "compression-model"
    assert captured[1]["id"] == "compression-model"
    assert captured[2]["id"] == "routing-model"
    assert captured[3]["id"] == "evaluation-model"
    for kwargs in captured:
        assert kwargs["api_key"] == "shared-env-key"
        assert kwargs["base_url"] == "https://shared.example/v1"


def test_agents_use_env_model_ids_over_config() -> None:
    config = Config(
        api_key="test-key",
        compression_model="yaml-compression",
        routing_model="yaml-routing",
        evaluation_model="yaml-evaluation",
    )
    captured: list[dict] = []

    class FakeOpenAIChat:
        def __init__(self, **kwargs) -> None:
            captured.append(kwargs)

    with patch.dict(
        os.environ,
        {
            "compression_model": "env-compression",
            "routing_model": "env-routing",
            "evaluation_model": "env-evaluation",
        },
    ):
        with patch("skillreducer.model.OpenAIChat", FakeOpenAIChat):
            create_compression_model(config)
            create_routing_model(config)
            create_evaluation_model(config)

    assert [kwargs["id"] for kwargs in captured] == [
        "env-compression",
        "env-routing",
        "env-evaluation",
    ]


def test_llm_client_uses_same_resolved_credentials() -> None:
    config = Config(api_key="yaml-key", api_base_url="https://yaml.example/v1")

    with patch.dict(
        os.environ,
        {
            "api_key": "shared-env-key",
            "api_base_url": "https://shared.example/v1",
        },
    ):
        with patch("skillreducer.llm.client.OpenAI") as mock_openai:
            LLMClient(config)

    mock_openai.assert_called_once_with(
        api_key="shared-env-key",
        base_url="https://shared.example/v1",
    )


def test_normalize_azure_endpoint_strips_openai_v1_suffix() -> None:
    assert (
        normalize_azure_endpoint("https://my-resource.openai.azure.com/openai/v1/")
        == "https://my-resource.openai.azure.com/"
    )


def test_resolve_azure_subscription_prefers_environment_over_config() -> None:
    config = Config(azure_subscription=False)
    with patch.dict(os.environ, {"azure_subscription": "true"}):
        assert resolve_azure_subscription(config) is True


def test_config_load_merges_azure_settings(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    config_path = tmp_path / "config.yaml"
    config_path.write_text(
        "azure_subscription: false\n"
        "azure_endpoint: https://yaml.example.openai.azure.com/\n"
        "api_version: 2024-02-01\n",
        encoding="utf-8",
    )
    monkeypatch.setenv("azure_subscription", "true")
    monkeypatch.setenv("azure_endpoint", "https://env.example.openai.azure.com/")
    monkeypatch.setenv("api_version", "2024-10-21")

    config = Config.load(config_path)

    assert config.azure_subscription is True
    assert resolve_azure_endpoint(config) == "https://env.example.openai.azure.com/"
    assert resolve_api_version(config) == "2024-10-21"


def test_agents_use_azure_openai_when_subscription_enabled() -> None:
    config = Config(
        api_key="azure-key",
        azure_subscription=True,
        azure_endpoint="https://my-resource.openai.azure.com/",
        compression_model="gpt-4o-deployment",
        routing_model="routing-deployment",
        evaluation_model="eval-deployment",
    )
    captured: list[dict] = []

    class FakeAzureOpenAI:
        def __init__(self, **kwargs) -> None:
            captured.append(kwargs)

    with patch("skillreducer.model.AzureOpenAI", FakeAzureOpenAI):
        create_openai_chat(config)
        create_compression_model(config)
        create_routing_model(config)
        create_evaluation_model(config)

    assert len(captured) == 4
    assert captured[0]["id"] == "gpt-4o-deployment"
    assert captured[2]["id"] == "routing-deployment"
    for kwargs in captured:
        assert kwargs["api_key"] == "azure-key"
        assert kwargs["azure_endpoint"] == "https://my-resource.openai.azure.com/"
        assert kwargs["azure_deployment"] == kwargs["id"]
        assert kwargs["api_version"] == "2024-10-21"


def test_llm_client_uses_azure_openai_when_subscription_enabled() -> None:
    config = Config(
        api_key="azure-key",
        azure_subscription=True,
        azure_endpoint="https://my-resource.openai.azure.com/",
    )

    with patch("skillreducer.llm.client.AzureOpenAI") as mock_azure:
        LLMClient(config)

    mock_azure.assert_called_once_with(
        api_key="azure-key",
        api_version="2024-10-21",
        azure_endpoint="https://my-resource.openai.azure.com/",
    )
