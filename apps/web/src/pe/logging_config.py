"""Structured logging configuration for the backend."""

import logging
import os
import sys
from typing import Any

import structlog


def _renderer() -> Any:
    """Pick the output renderer for the deployment context.

    Deployed processes (containers, CI, log shippers) get newline-delimited
    JSON; an interactive terminal gets the human console renderer. This
    mirrors the bias-detection services' bootstrap logging. ``PE_LOG_FORMAT``
    overrides the auto-detection: ``json`` or ``console``.
    """
    configured = os.environ.get("PE_LOG_FORMAT", "auto").lower()
    if configured == "json" or (configured == "auto" and not sys.stdout.isatty()):
        return structlog.processors.JSONRenderer()
    return structlog.dev.ConsoleRenderer(colors=sys.stdout.isatty())


def setup_logging(level: str = "INFO") -> None:
    """Configure structlog-based structured logging.

    Args:
        level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL).
    """
    shared_processors: list[Any] = [
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.dev.set_exc_info,
    ]

    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level.upper())

    formatter = structlog.stdlib.ProcessorFormatter(
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            _renderer(),
        ],
    )

    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.addHandler(handler)
    root_logger.setLevel(level.upper())

    # Quiet noisy libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("asyncpg").setLevel(logging.WARNING)
