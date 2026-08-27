"""Unit tests for TelemetryCollector."""

from tools.agent_runner.telemetry import TelemetryCollector


def test_telemetry_spans_and_metrics():
    collector = TelemetryCollector()
    span = collector.start_span("opencode", "PIX-10", {"role": "backend"})
    assert span.span_id is not None
    assert span.agent_name == "opencode"

    closed_span = collector.end_span(span, success=True, verification_passed=True)
    assert closed_span.end_time is not None
    assert closed_span.duration >= 0.0

    recent = collector.get_recent_spans()
    assert len(recent) == 1
