"""
Configuration management for bias detection service
"""

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic.networks import PostgresDsn, RedisDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with validation"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application settings
    app_name: str = Field(default="Bias Detection Service", validation_alias="APP_NAME")
    app_version: str = Field(default="1.0.0", validation_alias="APP_VERSION")
    debug: bool = Field(default=False, validation_alias="DEBUG")
    environment: str = Field(default="development", validation_alias="ENVIRONMENT")

    # Server settings
    host: str = Field(default="0.0.0.0", validation_alias="HOST")
    port: int = Field(default=8000, validation_alias="PORT")
    workers: int = Field(default=1, validation_alias="WORKERS")

    # Database settings
    database_url: PostgresDsn = Field(
        default="postgresql://user:password@localhost:5432/bias_detection",  # type: ignore[assignment]
        validation_alias="DATABASE_URL",
    )

    # Redis settings
    redis_url: RedisDsn = Field(
        default="redis://localhost:6379/0",  # type: ignore[assignment]
        validation_alias="REDIS_URL",
    )

    # Model settings
    model_cache_dir: str = Field(default="./models", validation_alias="MODEL_CACHE_DIR")
    tensorflow_model_path: str = Field(
        default="./models/bias_detection_tf", validation_alias="TENSORFLOW_MODEL_PATH"
    )
    pytorch_model_path: str = Field(
        default="./models/bias_detection_pt", validation_alias="PYTORCH_MODEL_PATH"
    )

    # ML settings
    max_sequence_length: int = Field(
        default=512, validation_alias="MAX_SEQUENCE_LENGTH"
    )
    batch_size: int = Field(default=32, validation_alias="BATCH_SIZE")
    model_timeout: int = Field(default=30, validation_alias="MODEL_TIMEOUT")

    # Security settings
    api_key_header: str = Field(default="X-API-Key", validation_alias="API_KEY_HEADER")
    rate_limit_per_minute: int = Field(
        default=60, validation_alias="RATE_LIMIT_PER_MINUTE"
    )

    # Logging settings
    log_level: str = Field(default="INFO", validation_alias="LOG_LEVEL")
    log_format: str = Field(
        default="json",
        validation_alias="LOG_FORMAT",
        description="Log format: json, text",
    )

    # Performance settings
    enable_caching: bool = Field(default=True, validation_alias="ENABLE_CACHING")
    cache_ttl_seconds: int = Field(
        default=900, validation_alias="CACHE_TTL_SECONDS"
    )  # 15 minutes
    enable_async_processing: bool = Field(
        default=True, validation_alias="ENABLE_ASYNC_PROCESSING"
    )

    @field_validator("environment")
    @classmethod
    def validate_environment(cls, v: str) -> str:
        """Validate environment setting"""
        valid_environments = {"development", "staging", "production"}
        if v not in valid_environments:
            raise ValueError(f"Environment must be one of: {valid_environments}")
        return v

    @field_validator("log_level")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        """Validate log level setting"""
        valid_levels = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        if v.upper() not in valid_levels:
            raise ValueError(f"Log level must be one of: {valid_levels}")
        return v.upper()

    @field_validator("log_format")
    @classmethod
    def validate_log_format(cls, v: str) -> str:
        """Validate log format setting"""
        valid_formats = {"json", "text"}
        if v.lower() not in valid_formats:
            raise ValueError(f"Log format must be one of: {valid_formats}")
        return v.lower()


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


# Global settings instance
settings = get_settings()
