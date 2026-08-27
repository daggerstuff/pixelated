"""OpenTelemetry-compatible distributed tracing and metric collection."""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger("agent_runner.telemetry")


@dataclass
class AgentSpan:
    span_id: str
    trace_id: str
    agent_name: str
    ticket_identifier: str
    start_time: float
    end_time: float | None = None
    duration: float = 0.0
    attributes: dict[str, Any] = field(default_factory=dict)
    success: bool = True
    verification_passed: bool = True


class TelemetryCollector:
    """Collects distributed execution spans and performance metrics."""

    def __init__(self):
        self._spans: list[AgentSpan] = []

    def start_span(
        self, agent_name: str, ticket_identifier: str, attributes: dict[str, Any] | None = None
    ) -> AgentSpan:
        """Start a new execution span."""
        span = AgentSpan(
            span_id=str(uuid.uuid4())[:8],
            trace_id=str(uuid.uuid4()),
            agent_name=agent_name,
            ticket_identifier=ticket_identifier,
            start_time=time.time(),
            attributes=attributes or {},
        )
        self._spans.append(span)
        return span

    def end_span(self, span: AgentSpan, success: bool = True, verification_passed: bool = True) -> AgentSpan:
        """Close an execution span."""
        span.end_time = time.time()
        span.duration = span.end_time - span.start_time
        span.success = success
        span.verification_passed = verification_passed
        logger.debug(
            "Span [%s] closed for %s (%s) in %.2fs",
            span.span_id,
            span.agent_name,
            span.ticket_identifier,
            span.duration,
        )
        return span

    def get_recent_spans(self, limit: int = 50) -> list[AgentSpan]:
        return self._spans[-limit:]
