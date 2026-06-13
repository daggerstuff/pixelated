"""Application configuration via pydantic-settings."""

from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


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

    # ── Redis ────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── CORS ─────────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # ── API ──────────────────────────────────────────────────────
    API_V1_PREFIX: str = "/api/v1"

    # ── Paths ────────────────────────────────────────────────────
    PROJECT_ROOT: Path = Path(__file__).resolve().parent.parent.parent

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
