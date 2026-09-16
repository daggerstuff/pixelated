"""Tests for pe distributed tracing (src/pe/tracing.py)."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from opentelemetry import context as otel_context, trace as otel_trace
from opentelemetry.sdk.trace import ReadableSpan
from opentelemetry.sdk.trace.export.in_memory_span_exporter import (
    InMemorySpanExporter,
)
from opentelemetry.trace import NonRecordingSpan, SpanContext, TraceFlags

from src.pe.tracing import current_trace_headers, setup_tracing, tracing_enabled


def _make_app() -> FastAPI:
    app = FastAPI()

    @app.get("/ping")
    async def ping() -> dict[str, str]:
        return {"status": "ok"}

    return app


def _enable_tracing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://collector:4318")
    monkeypatch.delenv("PE_TRACING_ENABLED", raising=False)


def test_disabled_without_endpoint(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OTEL_EXPORTER_OTLP_ENDPOINT", raising=False)
    assert not tracing_enabled()
    assert setup_tracing(_make_app()) is None


def test_opt_out_disables_tracing(monkeypatch: pytest.MonkeyPatch) -> None:
    _enable_tracing(monkeypatch)
    monkeypatch.setenv("PE_TRACING_ENABLED", "false")
    assert not tracing_enabled()


def test_instrumentation_continues_traceparent(monkeypatch: pytest.MonkeyPatch) -> None:
    _enable_tracing(monkeypatch)
    app = _make_app()
    exporter = InMemorySpanExporter()
    provider = setup_tracing(app, span_exporter=exporter)
    assert provider is not None

    # Trace id picked arbitrarily; flags sampled.
    incoming_trace_id = int("a3f1c2d4e5b60718293a4b5c6d7e8f90", 16)
    incoming_span_id = int("0123456789abcdef", 16)
    traceparent = f"00-{incoming_trace_id:032x}-{incoming_span_id:016x}-01"

    client = TestClient(app)
    response = client.get("/ping", headers={"traceparent": traceparent})
    assert response.status_code == 200
    assert response.headers["x-trace-id"] == f"{incoming_trace_id:032x}"

    provider.force_flush(timeout_millis=5000)

    spans: list[ReadableSpan] = exporter.get_finished_spans()
    server_span = next(s for s in spans if s.kind is not None and s.kind.name == "SERVER")
    assert server_span.context.trace_id == incoming_trace_id


def test_current_trace_headers_empty_without_span() -> None:
    assert current_trace_headers() == {}


def test_current_trace_headers_formats_context() -> None:
    context = SpanContext(
        trace_id=int("a3f1c2d4e5b60718293a4b5c6d7e8f90", 16),
        span_id=int("0123456789abcdef", 16),
        is_remote=False,
        trace_flags=TraceFlags(TraceFlags.SAMPLED),
    )
    token = otel_context.attach(otel_trace.set_span_in_context(NonRecordingSpan(context)))
    try:
        headers = current_trace_headers()
        assert headers["trace_id"] == "a3f1c2d4e5b60718293a4b5c6d7e8f90"
        assert headers["span_id"] == "0123456789abcdef"
    finally:
        otel_context.detach(token)
