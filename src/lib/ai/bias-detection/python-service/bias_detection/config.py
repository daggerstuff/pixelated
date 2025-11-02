"""
Configuration management for bias detection service
"""

import os
from functools import lru_cache
from typing import Optional

from pydantic import Field, validator
from pydantic_settings import BaseSettings
from pydantic.networks import RedisDsn, PostgresDsn


class Settings(BaseSettings):
    """Application settings with validation"""

    # Application settings
    app_name: str = Field(default="Bias Detection Service", env="APP_NAME")
    app_version: str = Field(default="1.0.0", env="APP_VERSION")
    debug: bool = Field(default=False, env="DEBUG")
    environment: str = Field(default="development", env="ENVIRONMENT")

    # Server settings
    host: str = Field(default="0.0.0.0", env="HOST")
    port: int = Field(default=8000, env="PORT")
    workers: int = Field(default=1, env="WORKERS")

    # Database settings
    database_url: PostgresDsn = Field(
        default="postgresql://user:password@localhost:5432/bias_detection",
        env="DATABASE_URL",
    )

    # Redis settings
    redis_url: RedisDsn = Field(default="redis://localhost:6379/0", env="REDIS_URL")

    # Model settings
    model_cache_dir: str = Field(default="./models", env="MODEL_CACHE_DIR")
    tensorflow_model_path: str = Field(
        default="./models/bias_detection_tf", env="TENSORFLOW_MODEL_PATH"
    )
    pytorch_model_path: str = Field(
        default="./models/bias_detection_pt", env="PYTORCH_MODEL_PATH"
    )

    # ML settings
    max_sequence_length: int = Field(default=512, env="MAX_SEQUENCE_LENGTH")
    batch_size: int = Field(default=32, env="BATCH_SIZE")
    model_timeout: int = Field(default=30, env="MODEL_TIMEOUT")

    # Security settings
    api_key_header: str = Field(default="X-API-Key", env="API_KEY_HEADER")
    rate_limit_per_minute: int = Field(default=60, env="RATE_LIMIT_PER_MINUTE")

    # Logging settings
    log_level: str = Field(default="INFO", env="LOG_LEVEL")
    log_format: str = Field(
        default="json", env="LOG_FORMAT", description="Log format: json, text"
    )

    # Performance settings
    enable_caching: bool = Field(default=True, env="ENABLE_CACHING")
    cache_ttl_seconds: int = Field(default=900, env="CACHE_TTL_SECONDS")  # 15 minutes
    enable_async_processing: bool = Field(default=True, env="ENABLE_ASYNC_PROCESSING")

    @validator("environment")
    def validate_environment(cls, v: str) -> str:
        """Validate environment setting"""
        valid_environments = {"development", "staging", "production"}
        if v not in valid_environments:
            raise ValueError(f"Environment must be one of: {valid_environments}")
        return v

    @validator("log_level")
    def validate_log_level(cls, v: str) -> str:
        """Validate log level setting"""
        valid_levels = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        if v.upper() not in valid_levels:
            raise ValueError(f"Log level must be one of: {valid_levels}")
        return v.upper()

    @validator("log_format")
    def validate_log_format(cls, v: str) -> str:
        """Validate log format setting"""
        valid_formats = {"json", "text"}
        if v.lower() not in valid_formats:
            raise ValueError(f"Log format must be one of: {valid_formats}")
        return v.lower()

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


# Global settings instance
settings = get_settings()
