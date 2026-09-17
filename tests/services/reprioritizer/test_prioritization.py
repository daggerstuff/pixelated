"""Reprioritizer service tests — PIX-4384.

Covers create_app behavior with the real AuthenticationSystem:
- refuses to boot without AUTH_SECRET_KEY (no unauthenticated clinical data)
- authenticates JWT via the middleware and scores/caches evidence counts
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any
from unittest import mock

import pytest
from fastapi.testclient import TestClient

# The service imports `ai.configs...`; make sure the repo root (parent of ai/)
# is importable even when pytest runs from an unusual cwd.
_REPO_ROOT = str(Path(__file__).resolve().parents[2])
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

from services.reprioritizer import app as app_module  # noqa: E402
from services.reprioritizer.app import create_app  # noqa: E402

_TEST_SECRET = "test-secret-not-a-real-credential"


class AsyncMockCollection:
    async def count_documents(self, _filter: dict[str, Any]) -> int:
        return 42


class AsyncMockRedis:
    def __init__(self) -> None:
        self.store: dict[str, str] = {}

    async def get(self, key: str) -> str | None:
        return self.store.get(key)

    async def set(self, key: str, value: str, ex: int | None = None) -> None:  # noqa: ARG002 - mirrors redis API
        self.store[key] = value

    async def aclose(self) -> None:
        pass


def _expose_auth_system(client: TestClient) -> Any:
    """Dig the AuthenticationSystem out of the middleware stack."""
    for middleware in client.app.user_middleware:  # type: ignore[attr-defined]
        if middleware.cls.__name__ == "FastAPIAuthenticationMiddleware":
            return middleware.kwargs["auth_system"]
    raise AssertionError("auth middleware not installed")


@pytest.fixture
def service_app(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> tuple[TestClient, Any]:
    monkeypatch.setenv("AUTH_SECRET_KEY", _TEST_SECRET)
    monkeypatch.setenv("AUTH_DB_PATH", str(tmp_path / "auth.db"))

    mock_db = mock.MagicMock()
    mock_db.__getitem__.return_value = AsyncMockCollection()
    mock_redis = AsyncMockRedis()

    app = create_app()
    app_module.state.mongo_client = mock.MagicMock()
    app_module.state.mongo_db = mock_db
    app_module.state.redis_client = mock_redis

    client = TestClient(app)
    auth_system = _expose_auth_system(client)
    # The middleware resolves users by id from the auth system's store
    auth_system.create_user(username="tester", email="tester@example.com", password="pw123456")
    return client, auth_system


class TestCreateAppSecurity:
    def test_refuses_to_boot_without_secret(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("AUTH_SECRET_KEY", raising=False)
        with pytest.raises(RuntimeError, match="AUTH_SECRET_KEY"):
            create_app()

    def test_middleware_installed_when_configured(self, service_app: tuple[TestClient, Any]) -> None:
        client, _ = service_app
        middleware_names = [
            m.cls.__name__
            for m in client.app.user_middleware  # type: ignore[attr-defined]
        ]
        assert "FastAPIAuthenticationMiddleware" in middleware_names


class TestAdjustPrioritization:
    def test_requires_authentication(self, service_app: tuple[TestClient, Any]) -> None:
        client, _ = service_app
        response = client.post("/api/prioritization/adjust", json={"dummy": 1})
        assert response.status_code == 401

    def test_scores_and_caches(self, service_app: tuple[TestClient, Any]) -> None:
        client, auth_system = service_app
        user = next(iter(auth_system.users.values()))
        token = auth_system.generate_jwt_token(user)
        headers = {"Authorization": f"Bearer {token}"}

        first = client.post("/api/prioritization/adjust", json={"dummy": "data"}, headers=headers)
        assert first.status_code == 200
        assert first.json() == {"score": 42, "cached": False}

        second = client.post("/api/prioritization/adjust", json={"dummy": "data"}, headers=headers)
        assert second.status_code == 200
        assert second.json() == {"score": 42, "cached": True}

    def test_health_is_public(self, service_app: tuple[TestClient, Any]) -> None:
        client, _ = service_app
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"


class TestModuleLevelApp:
    def test_import_stays_safe_without_secret(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("AUTH_SECRET_KEY", raising=False)
        # create_app is the construction path and raises without a secret.
        with pytest.raises(RuntimeError):
            create_app()
        # module-level app is None when no secret is present at import time
        assert app_module.app is None
