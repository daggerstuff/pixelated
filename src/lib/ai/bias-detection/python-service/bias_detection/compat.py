"""Backward-compatible compatibility helpers for legacy imports.

This module preserves a small compatibility layer used by legacy tests and
utility modules that still import pre-refactor symbols from
`bias_detection_service`. The new architecture should import from the
`bias_detection` package directly.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from .services.bias_detection_service import BiasDetectionService
from .services.security_service import AuditLogger, SecurityManager


@dataclass
class BiasDetectionConfig:
    warning_threshold: float = 0.3
    high_threshold: float = 0.6
    critical_threshold: float = 0.8
    enable_hipaa_compliance: bool = True
    enable_audit_logging: bool = True
    enable_encryption: bool = True
    max_session_size_mb: int = 50
    rate_limit_per_minute: int = 60
    layer_weights: dict[str, float] = field(
        default_factory=lambda: {
            "preprocessing": 0.25,
            "model_level": 0.30,
            "interactive": 0.20,
            "evaluation": 0.25,
        }
    )


@dataclass
class SessionData:
    session_id: str
    participant_demographics: dict[str, Any]
    training_scenario: dict[str, Any]
    content: dict[str, Any]
    ai_responses: list[dict[str, Any]]
    expected_outcomes: list[dict[str, Any]]
    transcripts: list[dict[str, Any]]
    metadata: dict[str, Any]
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class LegacyBiasDetectionService(BiasDetectionService):
    """Compatibility shim that accepts the legacy config argument."""

    def __init__(self, config: BiasDetectionConfig | None = None):
        super().__init__()
        self.config = config or BiasDetectionConfig()


__all__ = [
    "AuditLogger",
    "BiasDetectionConfig",
    "BiasDetectionService",
    "LegacyBiasDetectionService",
    "SecurityManager",
    "SessionData",
]
