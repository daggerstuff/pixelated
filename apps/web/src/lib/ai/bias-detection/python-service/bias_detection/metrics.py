"""Prometheus metrics for the bias detection service."""

from __future__ import annotations


class _NoopMetric:
    def labels(self, *_args: object, **_kwargs: object) -> _NoopMetric:
        return self

    def inc(self, *_args: object, **_kwargs: object) -> None:
        return None

    def observe(self, *_args: object, **_kwargs: object) -> None:
        return None


try:
    from prometheus_client import Counter, Histogram
except Exception:

    def Counter(*_, **__):
        return _NoopMetric()

    def Histogram(*_, **__):
        return _NoopMetric()


request_count = Counter(
    "bias_detection_requests_total",
    "Total number of bias detection requests",
    ["method", "endpoint", "status"],
)

request_duration = Histogram(
    "bias_detection_request_duration_seconds",
    "Request duration in seconds",
    ["method", "endpoint"],
)

analysis_count = Counter(
    "bias_analysis_total",
    "Total number of bias analyses performed",
    ["status", "bias_types"],
)

analysis_duration = Histogram(
    "bias_analysis_duration_seconds",
    "Analysis duration in seconds",
    ["model_framework"],
)
