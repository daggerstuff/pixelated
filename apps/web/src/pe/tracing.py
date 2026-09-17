"""OpenTelemetry distributed tracing for the pe service.

Continues W3C trace context (``traceparent`` headers) started by the web
app's OTel instrumentation and exports spans via OTLP/HTTP, so a request
can be followed from the Astro frontend through to pe's database calls.

Gating: tracing initializes only when ``OTEL_EXPORTER_OTLP_ENDPOINT`` is
set AND ``PE_TRACING_ENABLED`` is not explicitly false — normal local runs
and tests pay no overhead and export nothing.
"""

from __future__ import annotations

import os
from typing import Any

import structlog
from fastapi import FastAPI
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, SpanExporter

logger = structlog.get_logger(__name__)

TRUE_VALUES = {"1", "true", "yes"}


def tracing_enabled() -> bool:
    """Tracing is on only with an exporter endpoint and no explicit opt-out."""
    has_endpoint = bool(os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT"))
    opted_out = os.environ.get("PE_TRACING_ENABLED", "").lower() in {"0", "false", "no"}
    return has_endpoint and not opted_out


def setup_tracing(
    app: FastAPI,
    span_exporter: SpanExporter | None = None,
) -> TracerProvider | None:
    """Instrument ``app`` for distributed tracing.

    Returns the initialized provider, or None when tracing is disabled.
    ``span_exporter`` exists so tests can capture spans without a collector.
    """
    if not tracing_enabled():
        logger.info("tracing_disabled")
        return None

    resource = Resource.create(
        {
            "service.name": os.environ.get("OTEL_SERVICE_NAME", "pixelated-pe"),
            "service.version": os.environ.get("OTEL_SERVICE_VERSION", "0.1.0"),
        }
    )
    provider = TracerProvider(resource=resource)
    exporter = span_exporter or OTLPSpanExporter()
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)

    # Registered before instrumentation so the instrumentor's middleware is
    # outermost (Starlette runs the most recently added middleware first):
    # the header middleware then runs inside the server span and can read
    # valid trace context on the response path.
    @app.middleware("http")
    async def _trace_context_middleware(request: Any, call_next: Any) -> Any:
        response = await call_next(request)
        headers = current_trace_headers()
        if headers:
            response.headers["X-Trace-Id"] = headers["trace_id"]
        return response

    FastAPIInstrumentor.instrument_app(app, tracer_provider=provider)

    logger.info(
        "tracing_initialized",
        service=resource.attributes["service.name"],
        endpoint=os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT"),
    )
    return provider


def current_trace_headers() -> dict[str, str]:
    """Trace identifiers for logs and response headers, when a span is active."""
    span = trace.get_current_span()
    context = span.get_span_context()
    if not context.is_valid:
        return {}
    return {
        "trace_id": f"{context.trace_id:032x}",
        "span_id": f"{context.span_id:016x}",
    }
