"""Configuration for the Risk Stratification service.

Settings follow the same pydantic pattern as note_drafting.config.NoteDraftingSettings.
All values come from environment variables; no hardcoded credentials.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class RiskStratificationSettings(BaseSettings):
    """Settings for the risk stratification FastAPI service.

    Attributes:
        nim_url: Base URL for the NIM model endpoint (OpenAI-compatible).
        nim_api_key: API key for NIM authentication.
        nim_model: Model identifier for chat completions.
        baa_confirmed: Whether a BAA is in place before processing PHI.
        nim_timeout_seconds: Per-request timeout for NIM calls.
        nim_max_retries: Maximum retry attempts on transient failures.
        nim_retry_base_delay: Base delay (seconds) for exponential backoff.
    """

    model_config = SettingsConfigDict(
        env_prefix="RISK_STRAT_",
        env_file=".env",
        extra="ignore",
    )

    nim_url: str = ""
    nim_api_key: str = ""
    nim_model: str = "meta/llama-3.1-70b-instruct"
    baa_confirmed: bool = False
    nim_timeout_seconds: float = 30.0
    nim_max_retries: int = 3
    nim_retry_base_delay: float = 1.0
