"""
Application bootstrap: Sentry and structured logging.
Invoked once at import so create_app() stays minimal.
"""

import os

import structlog

from .config import settings
from .sentry_metrics import init_sentry


def configure() -> None:
    """Initialize Sentry and structlog. Safe to call once at module load."""
    init_sentry(
        dsn=os.environ.get("SENTRY_DSN"),
        environment=os.environ.get("SENTRY_ENVIRONMENT", "bias-detection-service"),
        release=os.environ.get("SENTRY_RELEASE", settings.app_version),
    )
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer(),
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )
