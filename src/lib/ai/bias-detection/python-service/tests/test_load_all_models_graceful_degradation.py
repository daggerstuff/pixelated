from __future__ import annotations

from bias_detection.utils.model_utils import _download_pretrained_with_retry  # type: ignore

"""Tests covering graceful-degradation and Hub-outage handling in
``bias_detection.services.model_service``.

The bias-detection service must remain partially operational when a single
underlying model service cannot load (for example: BERT weights missing from
the local cache and HuggingFace Hub unreachable).  These tests assert that
``ModelEnsembleService.load_all_models`` accepts partial success and that
``_download_pretrained_with_retry`` bounds retries when the Hub is down.
"""

# pyright: ignore[reportAttributeAccessIssue]
import asyncio
import importlib

import pytest
from bias_detection.services.model_service import (
    ModelEnsembleService,
)


class _FakeService:
    def __init__(self, *, name: str, outcome: bool | Exception) -> None:
        self.model_name = name
        self._outcome = outcome
        self.load_calls = 0

    async def load_model(self) -> bool:
        self.load_calls += 1
        if isinstance(self._outcome, Exception):
            raise self._outcome
        return self._outcome


def test_load_all_models_returns_true_when_at_least_one_service_loads() -> None:
    ensemble = ModelEnsembleService()
    ensemble.services = [
        _FakeService(name="alpha", outcome=False),
        _FakeService(name="beta", outcome=True),
    ]

    result = asyncio.run(ensemble.load_all_models())

    assert result is True
    assert sum(s.load_calls for s in ensemble.services) == 2


def test_load_all_models_returns_false_when_all_services_fail() -> None:
    ensemble = ModelEnsembleService()
    ensemble.services = [
        _FakeService(name="alpha", outcome=False),
        _FakeService(name="beta", outcome=False),
    ]

    result = asyncio.run(ensemble.load_all_models())

    assert result is False


def test_load_all_models_swallows_raised_exceptions_from_services() -> None:
    ensemble = ModelEnsembleService()
    ensemble.services = [
        _FakeService(
            name="alpha",
            outcome=RuntimeError("HuggingFace Hub unreachable"),
        ),
        _FakeService(name="beta", outcome=True),
    ]

    result = asyncio.run(ensemble.load_all_models())

    assert result is True


def test_load_all_models_returns_false_when_no_services_configured() -> None:
    ensemble = ModelEnsembleService()
    ensemble.services = []

    assert asyncio.run(ensemble.load_all_models()) is False


def test_download_pretrained_with_retry_raises_runtime_error_after_exhausting_attempts() -> None:
    """When the Hub is unreachable, retries must be bounded and a helpful
    ``RuntimeError`` must surface so callers can degrade gracefully."""

    calls = {"n": 0}

    def _fail(repo: str, **kwargs):
        calls["n"] += 1
        raise ConnectionError("hub unreachable")

    class _StubLoader:
        from_pretrained = staticmethod(_fail)

    with pytest.raises(RuntimeError) as exc_info:
        _download_pretrained_with_retry(
            _StubLoader,
            repo="bert-base-uncased",
            timeout=1.0,
            max_attempts=3,
            sleep_seconds=0.0,
        )

    assert calls["n"] == 3
    assert "bert-base-uncased" in str(exc_info.value)


def test_download_pretrained_with_retry_returns_when_loader_succeeds() -> None:
    calls = {"n": 0}

    def _flaky(repo: str, **kwargs):
        calls["n"] += 1
        if calls["n"] < 2:
            raise ConnectionError("transient")
        return {"repo": repo, "kwargs": kwargs}

    class _StubLoader:
        from_pretrained = staticmethod(_flaky)

    result = _download_pretrained_with_retry(
        _StubLoader,
        repo="bert-base-uncased",
        timeout=1.0,
        max_attempts=3,
        sleep_seconds=0.0,
    )

    assert calls["n"] == 2
    assert result["repo"] == "bert-base-uncased"


def test_download_pretrained_with_retry_respects_max_attempts_one() -> None:
    """A single attempt budget should still surface a meaningful failure."""

    calls = {"n": 0}

    def _fail(repo: str, **kwargs):
        calls["n"] += 1
        raise ConnectionError("fail")

    class _StubLoader:
        from_pretrained = staticmethod(_fail)

    with pytest.raises(RuntimeError):
        _download_pretrained_with_retry(
            _StubLoader,
            repo="bert-base-uncased",
            timeout=1.0,
            max_attempts=1,
            sleep_seconds=0.0,
        )

    assert calls["n"] == 1


def test_model_service_module_imports_without_transformers() -> None:
    """Smoke-import check: importing the module must not require transformers."""

    importlib.import_module("bias_detection.services.model_service")
