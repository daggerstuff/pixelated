"""Application configuration via pydantic-settings."""

from __future__ import annotations

import re
import warnings
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Known insecure default values that MUST be replaced in production
INSECURE_DEFAULTS = {"change-me-in-production", "changeme", "secret", "password", "123456"}
HEX_KEY_PATTERN = re.compile(r"^[a-fA-F0-9]{64}$")  # 32-byte hex = 64 chars


class Settings(BaseSettings):
    """Pixelated Empathy backend configuration.

    All values can be overridden via environment variables or .env file.
    """

    model_config = SettingsConfigDict(
        env_prefix="PE_",
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────────────
    APP_NAME: str = "Pixelated Empathy"
    DEBUG: bool = False
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"

    # ── Database ─────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://localhost:5432/pixelated_empathy"
    DB_MIN_CONNECTIONS: int = 2
    DB_MAX_CONNECTIONS: int = 20
    DB_STATEMENT_TIMEOUT_MS: int = 30_000

    # ── Authentication ───────────────────────────────────────────
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── Encryption ───────────────────────────────────────────────
    ENCRYPTION_KEY: str = "change-me-in-production"  # 32-byte hex for AES-256

    # ── LLM / AI Provider ─────────────────────────────────────────
    # These env vars use aliases to work without the PE_ prefix.
    # Validation happens at provider-creation time, not at boot.
    LLM_PROVIDER: Literal["mock", "openai", "openai-compatible"] = Field(
        default="mock",
        alias="LLM_PROVIDER",
        description="LLM provider type. Options: mock, openai, openai-compatible",
    )
    LLM_API_KEY: str | None = Field(
        default=None,
        alias="LLM_API_KEY",
        description="API key for the LLM provider. Optional when provider=mock, required otherwise",
    )
    LLM_BASE_URL: str | None = Field(
        default=None,
        alias="LLM_BASE_URL",
        description="Base URL for the LLM API. Required for openai-compatible providers",
    )
    LLM_MODEL_ID: str | None = Field(
        default=None,
        alias="LLM_MODEL_ID",
        description="Model identifier passed to the provider (e.g. gpt-4, claude-3-opus)",
    )

    # ── Redis ────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── CORS ─────────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # ── API ──────────────────────────────────────────────────────
    API_V1_PREFIX: str = "/api/v1"

    # ── Paths ────────────────────────────────────────────────────
    PROJECT_ROOT: Path = Path(__file__).resolve().parent.parent.parent

    @field_validator("JWT_SECRET_KEY", "ENCRYPTION_KEY")
    @classmethod
    def _check_insecure_defaults(cls, v: str, info) -> str:
        """Warn if security-sensitive fields use known insecure defaults."""
        if v.lower() in INSECURE_DEFAULTS:
            warnings.warn(
                f"[CONFIG SECURITY] {info.field_name} uses an insecure default value. "
                f"Set a strong, unique value via environment variable in production!",
                UserWarning,
                stacklevel=2,
            )
        return v

    @property
    def database_url_sync(self) -> str:
        """Return a synchronous DB URL (for Alembic, etc.)."""
        return self.DATABASE_URL.replace("+asyncpg", "")


# Singleton
settings = Settings()

# Allow .env file in project root
_env_path = settings.PROJECT_ROOT / ".env"
if _env_path.exists():
    # Already loaded by pydantic-settings, but ensure path is correct
    pass
