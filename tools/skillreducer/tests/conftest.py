from __future__ import annotations

import pytest

from skillreducer.config import load_dotenv


@pytest.fixture(autouse=True)
def clear_credential_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Isolate every test from host credential/model environment variables.

    The config resolvers prefer environment values over YAML/defaults, so a
    host shell (or its .env files — loaded at most once per process) that
    exports e.g. ``compression_model`` would otherwise leak into
    model-factory tests and break their expectations. Load dotenv first so
    the one-time load has already happened, then strip what it contributed.
    """
    load_dotenv()
    for name in (
        "api_key",
        "api_base_url",
        "compression_model",
        "compression",
        "routing_model",
        "routing_oracle",
        "evaluation_model",
        "evaluation",
        "azure_subscription",
        "azure_endpoint",
        "api_version",
        "azure_api_version",
    ):
        monkeypatch.delenv(name, raising=False)
