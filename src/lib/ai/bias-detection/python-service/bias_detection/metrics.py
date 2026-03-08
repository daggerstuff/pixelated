"""
Prometheus metrics for the bias detection service.
"""

from prometheus_client import Counter, Histogram

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
