"""Tests for application configuration."""

import json
import logging

import pytest
import structlog

from src.pe.config import Settings, settings
from src.pe.logging_config import setup_logging


class TestSettings:
    """Verify configuration loading and defaults."""

    def test_default_settings(self) -> None:
        """Default settings should have expected values."""
        s = Settings()
        assert s.APP_NAME == "Pixelated Empathy"
        assert s.DEBUG is False
        assert s.JWT_ALGORITHM == "HS256"
        assert s.JWT_ACCESS_TOKEN_EXPIRE_MINUTES == 15
        assert s.API_V1_PREFIX == "/api/v1"

    def test_env_override(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Environment variables should override defaults."""
        monkeypatch.setenv("PE_DEBUG", "true")
        monkeypatch.setenv("PE_JWT_SECRET_KEY", "test-secret-key")
        s = Settings()
        assert s.DEBUG is True
        assert s.JWT_SECRET_KEY == "test-secret-key"

    def test_project_root(self) -> None:
        """Project root should exist and point to repo root."""
        root = settings.PROJECT_ROOT
        assert root.exists()
        assert (root / "pyproject.toml").exists()

    def test_cors_origins(self) -> None:
        """Default CORS origins should include localhost."""
        assert "http://localhost:3000" in settings.CORS_ORIGINS

    def test_database_url_sync(self) -> None:
        """Sync DB URL should strip +asyncpg."""
        s = Settings(DATABASE_URL="postgresql+asyncpg://user:pass@localhost/db")
        assert s.database_url_sync == "postgresql://user:pass@localhost/db"


class TestLoggingConfig:
    """Verify logging setup."""

    def test_setup_logging_no_error(self) -> None:
        """Setting up logging should not raise."""
        setup_logging("DEBUG")

    def test_json_format_emits_parseable_json(
        self, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
    ) -> None:
        """PE_LOG_FORMAT=json must emit machine-parseable log lines."""
        monkeypatch.setenv("PE_LOG_FORMAT", "json")
        setup_logging("INFO")
        structlog.get_logger("pe.test.json").info("structured log check")
        out = capsys.readouterr().out
        json_lines = [json.loads(line) for line in out.splitlines() if line.strip()]
        assert any(e.get("event") == "structured log check" and "timestamp" in e for e in json_lines)

    def test_console_format_respected(
        self, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
    ) -> None:
        """PE_LOG_FORMAT=console must not emit JSON (human renderer wins)."""
        monkeypatch.setenv("PE_LOG_FORMAT", "console")
        setup_logging("INFO")
        structlog.get_logger("pe.test.console").info("console log check")
        out = capsys.readouterr().out
        assert "console log check" in out
        with pytest.raises(json.JSONDecodeError):
            json.loads(out.strip().splitlines()[-1])

    def test_root_logger_level_applied(self) -> None:
        """Setup should apply the requested level to the root logger."""
        setup_logging("WARNING")
        assert logging.getLogger().level == logging.WARNING
