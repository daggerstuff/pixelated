"""
MCP Server Configuration Management

Handles environment-based configuration with validation and type safety.
Follows the established patterns from the Pixelated platform.
"""

import os
import re
from typing import Any

from pydantic import BaseModel, Field, validator
from pydantic_settings import BaseSettings


class DatabaseConfig(BaseModel):
    """MongoDB database configuration."""

    uri: str = Field(..., description="MongoDB connection URI")
    max_pool_size: int = Field(default=100, ge=1, le=1000, description="Maximum connection pool size")
    min_pool_size: int = Field(default=10, ge=1, le=100, description="Minimum connection pool size")
    timeout: int = Field(default=30, ge=1, le=300, description="Connection timeout in seconds")

    @validator("uri")
    def validate_mongodb_uri(cls, v: str) -> str:
        """Validate MongoDB URI format."""
        if not v.startswith("mongodb://") and not v.startswith("mongodb+srv://"):
            raise ValueError("MongoDB URI must start with mongodb:// or mongodb+srv://")
        return v


class RedisConfig(BaseModel):
    """Redis cache configuration."""

    url: str = Field(..., description="Redis connection URL")
    max_connections: int = Field(default=100, ge=1, le=1000, description="Maximum connection pool size")
    socket_timeout: int = Field(default=30, ge=1, le=300, description="Socket timeout in seconds")
    socket_connect_timeout: int = Field(default=10, ge=1, le=60, description="Socket connection timeout in seconds")

    @validator("url")
    def validate_redis_url(cls, v: str) -> str:
        """Validate Redis URL format."""
        if not v.startswith("redis://") and not v.startswith("rediss://"):
            raise ValueError("Redis URL must start with redis:// or rediss://")
        return v


class AuthConfig(BaseModel):
    """Authentication configuration."""

    jwt_secret: str = Field(..., min_length=32, description="JWT secret key (minimum 32 characters)")
    jwt_algorithm: str = Field(default="HS256", description="JWT algorithm")
    token_expiration: int = Field(default=3600, ge=60, le=86400, description="Token expiration in seconds")
    refresh_token_expiration: int = Field(default=86400, ge=3600, le=604800, description="Refresh token expiration in seconds")

    @validator("jwt_algorithm")
    def validate_jwt_algorithm(cls, v: str) -> str:
        """Validate JWT algorithm."""
        valid_algorithms = ["HS256", "HS384", "HS512", "RS256", "RS384", "RS512"]
        if v not in valid_algorithms:
            raise ValueError(f"Invalid JWT algorithm. Must be one of: {valid_algorithms}")
        return v


class RateLimitConfig(BaseModel):
    """Rate limiting configuration."""

    requests_per_minute: int = Field(default=100, ge=1, le=10000, description="Requests per minute limit")
    burst_size: int = Field(default=10, ge=1, le=1000, description="Burst size for rate limiting")
    window_seconds: int = Field(default=60, ge=1, le=3600, description="Rate limiting window in seconds")


class LoggingConfig(BaseModel):
    """Logging configuration."""

    level: str = Field(default="INFO", description="Log level")
    format: str = Field(default="json", description="Log format")
    enable_request_logging: bool = Field(default=True, description="Enable request logging")
    enable_response_logging: bool = Field(default=True, description="Enable response logging")

    @validator("level")
    def validate_log_level(cls, v: str) -> str:
        """Validate log level."""
        valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        if v.upper() not in valid_levels:
            raise ValueError(f"Invalid log level. Must be one of: {valid_levels}")
        return v.upper()

    @validator("format")
    def validate_log_format(cls, v: str) -> str:
        """Validate log format."""
        valid_formats = ["json", "text"]
        if v.lower() not in valid_formats:
            raise ValueError(f"Invalid log format. Must be one of: {valid_formats}")
        return v.lower()


class AuditConfig(BaseModel):
    """Audit logging configuration."""

    enabled: bool = Field(default=True, description="Enable audit logging")
    retention_days: int = Field(default=2555, ge=1, le=3650, description="Audit log retention in days (7 years default)")
    encryption_key: str | None = Field(default=None, description="Encryption key for sensitive audit data")


class ExternalServiceConfig(BaseModel):
    """External service configuration."""

    flask_api_url: str = Field(..., description="Flask API service URL")
    openai_api_key: str | None = Field(default=None, description="OpenAI API key")
    google_ai_api_key: str | None = Field(default=None, description="Google GenAI API key")
    bias_detection_url: str | None = Field(default=None, description="Bias detection service URL")

    @validator("flask_api_url")
    def validate_flask_api_url(cls, v: str) -> str:
        """Validate Flask API URL format."""
        if not re.match(r"^https?://", v):
            raise ValueError("Flask API URL must start with http:// or https://")
        return v


class WebSocketConfig(BaseModel):
    """WebSocket configuration."""

    enabled: bool = Field(default=True, description="Enable WebSocket support")
    cors_allowed_origins: list[str] = Field(default=["*"], description="Allowed CORS origins for WebSocket")
    ping_interval: int = Field(default=25, ge=1, le=300, description="Ping interval in seconds")
    ping_timeout: int = Field(default=20, ge=1, le=300, description="Ping timeout in seconds")
    max_http_buffer_size: int = Field(default=1024 * 1024, ge=1024, le=100 * 1024 * 1024, description="Maximum HTTP buffer size in bytes")
    allow_upgrades: bool = Field(default=True, description="Allow protocol upgrades")
    http_compression: bool = Field(default=True, description="Enable HTTP compression")
    compression_threshold: int = Field(default=1024, ge=0, description="Compression threshold in bytes")
    max_connections: int = Field(default=1000, ge=1, le=10000, description="Maximum concurrent WebSocket connections")
    connection_timeout: int = Field(default=30, ge=1, le=300, description="Connection timeout in seconds")
    heartbeat_interval: int = Field(default=30, ge=5, le=300, description="Heartbeat interval in seconds")
    reconnection_attempts: int = Field(default=5, ge=0, le=20, description="Maximum reconnection attempts")
    reconnection_delay: int = Field(default=1, ge=0, le=60, description="Reconnection delay in seconds")


class MCPConfig(BaseSettings):
    """
    MCP Server configuration container.

    Validates configuration values and provides type safety for all
    environment variables used by the MCP server.
    """

    # Core application settings
    app_name: str = Field(default="MCP Server", description="Application name")
    api_version: str = Field(default="v1", description="API version")
    debug: bool = Field(default=False, description="Debug mode")
    environment: str = Field(default="development", description="Environment (development, staging, production)")

    # Database configuration
    database_config: DatabaseConfig

    # Redis configuration
    redis_config: RedisConfig

    # Authentication configuration
    auth_config: AuthConfig

    # Rate limiting configuration
    rate_limit_config: RateLimitConfig

    # Logging configuration
    logging_config: LoggingConfig

    # Audit configuration
    audit_config: AuditConfig

    # External services configuration
    external_services: ExternalServiceConfig

    # WebSocket configuration
    websocket_config: WebSocketConfig

    # API documentation settings
    enable_docs: bool = Field(default=True, description="Enable Swagger documentation")
    enable_redoc: bool = Field(default=True, description="Enable ReDoc documentation")
    enable_openapi: bool = Field(default=True, description="Enable OpenAPI schema")

    # CORS configuration
    allowed_origins: list[str] = Field(default=["http://localhost:3000"], description="Allowed CORS origins")

    # Security settings
    cors_enabled: bool = Field(default=True, description="Enable CORS")
    request_id_header: str = Field(default="X-Request-ID", description="Request ID header name")

    # Performance settings
    max_request_size: int = Field(default=10 * 1024 * 1024, description="Maximum request size in bytes (10MB)")
    request_timeout: int = Field(default=30, ge=1, le=300, description="Request timeout in seconds")

    class Config:
        """Pydantic configuration."""
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        validate_assignment = True

    def __init__(self, **kwargs: Any) -> None:
        """Initialize configuration with environment variables."""
        # Load from environment variables first
        env_vars = dict(os.environ)

        # Parse nested configurations
        database_config = self._parse_database_config(env_vars)
        redis_config = self._parse_redis_config(env_vars)
        auth_config = self._parse_auth_config(env_vars)
        rate_limit_config = self._parse_rate_limit_config(env_vars)
        logging_config = self._parse_logging_config(env_vars)
        audit_config = self._parse_audit_config(env_vars)
        external_services = self._parse_external_services(env_vars)

        # Parse WebSocket configuration
        websocket_config = self._parse_websocket_config(env_vars)

        # Parse CORS origins
        origins_str = env_vars.get("ALLOWED_ORIGINS", "http://localhost:3000")
        allowed_origins = [origin.strip() for origin in origins_str.split(",")]

        super().__init__(
            database_config=database_config,
            redis_config=redis_config,
            auth_config=auth_config,
            rate_limit_config=rate_limit_config,
            logging_config=logging_config,
            audit_config=audit_config,
            external_services=external_services,
            websocket_config=websocket_config,
            allowed_origins=allowed_origins,
            **kwargs
        )

    def _parse_database_config(self, env_vars: dict[str, str]) -> DatabaseConfig:
        """Parse database configuration from environment variables."""
        return DatabaseConfig(
            uri=env_vars["MONGODB_URI"],
            max_pool_size=int(env_vars.get("DB_MAX_POOL_SIZE", "100")),
            min_pool_size=int(env_vars.get("DB_MIN_POOL_SIZE", "10")),
            timeout=int(env_vars.get("DB_TIMEOUT", "30"))
        )

    def _parse_redis_config(self, env_vars: dict[str, str]) -> RedisConfig:
        """Parse Redis configuration from environment variables."""
        return RedisConfig(
            url=env_vars["REDIS_URL"],
            max_connections=int(env_vars.get("REDIS_MAX_CONNECTIONS", "100")),
            socket_timeout=int(env_vars.get("REDIS_SOCKET_TIMEOUT", "30")),
            socket_connect_timeout=int(env_vars.get("REDIS_CONNECT_TIMEOUT", "10"))
        )

    def _parse_auth_config(self, env_vars: dict[str, str]) -> AuthConfig:
        """Parse authentication configuration from environment variables."""
        return AuthConfig(
            jwt_secret=env_vars["JWT_SECRET"],
            jwt_algorithm=env_vars.get("JWT_ALGORITHM", "HS256"),
            token_expiration=int(env_vars.get("TOKEN_EXPIRATION", "3600")),
            refresh_token_expiration=int(env_vars.get("REFRESH_TOKEN_EXPIRATION", "86400"))
        )

    def _parse_rate_limit_config(self, env_vars: dict[str, str]) -> RateLimitConfig:
        """Parse rate limiting configuration from environment variables."""
        return RateLimitConfig(
            requests_per_minute=int(env_vars.get("RATE_LIMIT_RPM", "100")),
            burst_size=int(env_vars.get("RATE_LIMIT_BURST", "10")),
            window_seconds=int(env_vars.get("RATE_LIMIT_WINDOW", "60"))
        )

    def _parse_logging_config(self, env_vars: dict[str, str]) -> LoggingConfig:
        """Parse logging configuration from environment variables."""
        return LoggingConfig(
            level=env_vars.get("LOG_LEVEL", "INFO"),
            format=env_vars.get("LOG_FORMAT", "json"),
            enable_request_logging=env_vars.get("ENABLE_REQUEST_LOGGING", "true").lower() == "true",
            enable_response_logging=env_vars.get("ENABLE_RESPONSE_LOGGING", "true").lower() == "true"
        )

    def _parse_audit_config(self, env_vars: dict[str, str]) -> AuditConfig:
        """Parse audit configuration from environment variables."""
        return AuditConfig(
            enabled=env_vars.get("AUDIT_ENABLED", "true").lower() == "true",
            retention_days=int(env_vars.get("AUDIT_RETENTION_DAYS", "2555")),
            encryption_key=env_vars.get("AUDIT_ENCRYPTION_KEY")
        )

    def _parse_external_services(self, env_vars: dict[str, str]) -> ExternalServiceConfig:
        """Parse external services configuration from environment variables."""
        return ExternalServiceConfig(
            flask_api_url=env_vars["FLASK_API_URL"],
            openai_api_key=env_vars.get("OPENAI_API_KEY"),
            google_ai_api_key=env_vars.get("GOOGLE_AI_API_KEY"),
            bias_detection_url=env_vars.get("BIAS_DETECTION_URL")
        )

    def _parse_websocket_config(self, env_vars: dict[str, str]) -> WebSocketConfig:
        """Parse WebSocket configuration from environment variables."""
        # Parse CORS origins for WebSocket
        cors_origins_str = env_vars.get("WEBSOCKET_CORS_ORIGINS", "*")
        cors_allowed_origins = [origin.strip() for origin in cors_origins_str.split(",")]

        return WebSocketConfig(
            enabled=env_vars.get("WEBSOCKET_ENABLED", "true").lower() == "true",
            cors_allowed_origins=cors_allowed_origins,
            ping_interval=int(env_vars.get("WEBSOCKET_PING_INTERVAL", "25")),
            ping_timeout=int(env_vars.get("WEBSOCKET_PING_TIMEOUT", "20")),
            max_http_buffer_size=int(env_vars.get("WEBSOCKET_MAX_BUFFER_SIZE", str(1024 * 1024))),
            allow_upgrades=env_vars.get("WEBSOCKET_ALLOW_UPGRADES", "true").lower() == "true",
            http_compression=env_vars.get("WEBSOCKET_HTTP_COMPRESSION", "true").lower() == "true",
            compression_threshold=int(env_vars.get("WEBSOCKET_COMPRESSION_THRESHOLD", "1024")),
            max_connections=int(env_vars.get("WEBSOCKET_MAX_CONNECTIONS", "1000")),
            connection_timeout=int(env_vars.get("WEBSOCKET_CONNECTION_TIMEOUT", "30")),
            heartbeat_interval=int(env_vars.get("WEBSOCKET_HEARTBEAT_INTERVAL", "30")),
            reconnection_attempts=int(env_vars.get("WEBSOCKET_RECONNECTION_ATTEMPTS", "5")),
            reconnection_delay=int(env_vars.get("WEBSOCKET_RECONNECTION_DELAY", "1"))
        )

    def validate(self) -> None:
        """
        Validate configuration values.

        Raises:
            ValueError: If any configuration value is invalid
        """
        # Validate JWT secret length
        if len(self.auth_config.jwt_secret) < 32:
            raise ValueError("JWT secret must be at least 32 characters")

        # Validate rate limiting values
        if self.rate_limit_config.requests_per_minute <= 0:
            raise ValueError("Rate limit requests per minute must be positive")

        # Validate audit retention period
        if self.audit_config.retention_days <= 0:
            raise ValueError("Audit retention days must be positive")

        # Validate environment
        valid_environments = ["development", "staging", "production"]
        if self.environment not in valid_environments:
            raise ValueError(f"Invalid environment. Must be one of: {valid_environments}")


# Global configuration instance
_config: MCPConfig | None = None


def get_config() -> MCPConfig:
    """
    Get the global configuration instance.

    Returns:
        MCPConfig: The configuration instance

    Raises:
        ValueError: If required environment variables are missing
    """
    global _config

    if _config is None:
        # Validate required environment variables
        required_vars = [
            "MONGODB_URI",
            "REDIS_URL",
            "JWT_SECRET",
            "FLASK_API_URL"
        ]

        missing_vars = [var for var in required_vars if var not in os.environ]
        if missing_vars:
            raise ValueError(f"Missing required environment variables: {missing_vars}")

        _config = MCPConfig()
        _config.validate()

    return _config


def reload_config() -> MCPConfig:
    """
    Reload configuration from environment variables.

    Returns:
        MCPConfig: The reloaded configuration instance
    """
    global _config
    _config = None
    return get_config()


# Provide a module-level `settings` symbol for modules that import it at
# import-time. Some modules import `settings` but creating a full
# MCPConfig requires environment variables. Try to initialize it, but
# fall back to `None` so unit tests that mock configuration can import
# modules successfully during collection.
try:
    settings = get_config()
except Exception:
    settings = None
