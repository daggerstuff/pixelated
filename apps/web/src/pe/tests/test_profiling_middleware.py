"""Tests for the opt-in request profiling middleware."""

import pstats
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.pe.middleware.profiling import ProfilingMiddleware


def _make_app() -> FastAPI:
    app = FastAPI()

    @app.get("/ping")
    async def ping() -> dict[str, str]:
        return {"status": "ok"}

    app.add_middleware(ProfilingMiddleware)
    return app


@pytest.fixture
def profile_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.setenv("PE_PROFILING_DIR", str(tmp_path))
    monkeypatch.delenv("PE_PROFILING_ENABLED", raising=False)
    return tmp_path


def test_disabled_by_default_writes_nothing(profile_dir: Path) -> None:
    client = TestClient(_make_app())
    response = client.get("/ping")
    assert response.status_code == 200
    assert "x-profile" not in response.headers
    assert list(profile_dir.iterdir()) == []


def test_header_profiles_single_request(profile_dir: Path) -> None:
    client = TestClient(_make_app())
    response = client.get("/ping", headers={"X-Profile-Request": "true", "X-Request-ID": "req-1"})
    assert response.status_code == 200
    filename = response.headers["x-profile"]
    assert filename.startswith("get_req-1_")
    assert filename.endswith(".prof")
    profile_path = profile_dir / filename
    assert profile_path.exists()
    # constructing Stats re-parses the dump; an invalid file raises
    pstats.Stats(str(profile_path))


def test_env_var_profiles_every_request(profile_dir: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PE_PROFILING_ENABLED", "true")
    client = TestClient(_make_app())
    first = client.get("/ping")
    second = client.get("/ping")
    assert first.status_code == 200
    assert second.status_code == 200
    files = list(profile_dir.glob("*.prof"))
    assert len(files) == 2
