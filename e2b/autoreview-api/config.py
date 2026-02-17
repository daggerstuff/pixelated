"""
AutoReview AI — Configuration.

Loads all environment variables using Pydantic Settings
with validation and sensible defaults for development.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ──────────────────────────────────
    app_name: str = "AutoReview AI"
    environment: Literal["development", "staging", "production"] = "development"
    debug: bool = True
    frontend_url: str = "http://localhost:8765"
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    # ── JWT ──────────────────────────────────────────
    jwt_secret: str = Field(
        ...,
        description="Secret key for signing JWT session tokens",
    )
    jwt_algorithm: str = "HS256"
    jwt_expiry_hours: int = 72

    # ── Supabase ─────────────────────────────────────
    supabase_url: str = Field(..., description="Supabase project URL")
    supabase_service_key: str = Field(
        ...,
        description="Supabase service role key (server-side only)",
    )

    # ── Stripe ───────────────────────────────────────
    stripe_secret_key: str = Field(..., description="Stripe secret API key")
    stripe_webhook_secret: str = Field(..., description="Stripe webhook endpoint secret")
    stripe_price_indie: str = Field(..., description="Stripe Price ID for Indie tier")
    stripe_price_team: str = Field(..., description="Stripe Price ID for Team tier")
    stripe_price_pro: str = Field(..., description="Stripe Price ID for Pro tier")

    # ── GitHub App ───────────────────────────────────
    github_app_id: str = Field(..., description="GitHub App numeric ID")
    github_app_client_id: str = Field(..., description="GitHub App OAuth Client ID")
    github_app_client_secret: str = Field(..., description="GitHub App OAuth Client Secret")
    github_app_name: str = Field(
        default="autoreview-ai",
        description="GitHub App slug for install URL",
    )

    # ── Tier Limits ──────────────────────────────────
    tier_limits: dict[str, int] = {
        "free": 5,
        "indie": 25,
        "team": 150,
        "pro": 500,
        "enterprise": 999_999,
    }

    tier_repo_limits: dict[str, int] = {
        "free": 1,
        "indie": 3,
        "team": 10,
        "pro": 999_999,
        "enterprise": 999_999,
    }


@lru_cache
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
