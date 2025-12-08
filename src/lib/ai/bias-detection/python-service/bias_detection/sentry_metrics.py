"""
Sentry Metrics Utilities for Pixelated Empathy Bias Detection Service

This module provides utilities for initializing Sentry and emitting metrics
for bias detection analysis, API performance, and service health monitoring.

Reference: https://docs.sentry.io/platforms/python/metrics/
Requires sentry-sdk >= 2.44.0
"""

import os
import logging
from typing import Optional
from functools import wraps
from datetime import datetime, timezone
import time

import sentry_sdk
from sentry_sdk.types import Metric, Hint

logger = logging.getLogger(__name__)

# ============================================
# Configuration
# ============================================

SENTRY_DSN = os.environ.get(
    "SENTRY_DSN",
    "https://ef4ca2c0d2530a95efb0ef55c168b661@o4509483611979776.ingest.us.sentry.io/4509483637932032",
)
SENTRY_ENVIRONMENT = os.environ.get(
    "SENTRY_ENVIRONMENT", os.environ.get("NODE_ENV", "production")
)
SENTRY_RELEASE = os.environ.get("SENTRY_RELEASE", "1.0.0")
SENTRY_ENABLE_METRICS = (
    os.environ.get("SENTRY_ENABLE_METRICS", "true").lower() != "false"
)


def before_send_metric(metric: Metric, hint: Hint) -> Optional[Metric]:
    """
    Filter or modify metrics before they are sent to Sentry.

    - Adds environment and service context to all metrics
    - Can drop sensitive metrics if needed
    """
    # Drop metrics explicitly marked for exclusion
    if metric.get("attributes", {}).get("drop_metric") is True:
        return None

    # Add standard attributes to all metrics
    metric["attributes"] = {
        **metric.get("attributes", {}),
        "service": "bias-detection-python",
        "environment": SENTRY_ENVIRONMENT,
    }

    return metric


def init_sentry(
    dsn: Optional[str] = None,
    environment: Optional[str] = None,
    release: Optional[str] = None,
    sample_rate: float = 1.0,
    traces_sample_rate: float = 0.1,
    profiles_sample_rate: float = 0.05,
) -> None:
    """
    Initialize Sentry SDK with metrics support.

    Call this function once at application startup.

    Args:
        dsn: Sentry DSN (defaults to environment variable)
        environment: Environment name (production, staging, development)
        release: Release/version string
        sample_rate: Error sampling rate (0.0 - 1.0)
        traces_sample_rate: Transaction/trace sampling rate
        profiles_sample_rate: Profiling sampling rate
    """
    effective_dsn = dsn or SENTRY_DSN
    effective_environment = environment or SENTRY_ENVIRONMENT
    effective_release = release or SENTRY_RELEASE

    if not effective_dsn:
        logger.warning("Sentry DSN not configured, Sentry will not be initialized")
        return

    sentry_sdk.init(
        dsn=effective_dsn,
        environment=effective_environment,
        release=effective_release,
        # Error tracking
        sample_rate=sample_rate,
        # Performance monitoring
        traces_sample_rate=traces_sample_rate,
        profiles_sample_rate=profiles_sample_rate,
        # Metrics support (enabled by default in SDK 2.44.0+)
        before_send_metric=before_send_metric,
        # Additional options
        send_default_pii=True,
        # Add Flask integration if available
        integrations=[],
        # Initial tags
        default_integrations=True,
    )

    # Set initial tags
    sentry_sdk.set_tag("service", "bias-detection-python")
    sentry_sdk.set_tag("component", "bias-detection")

    logger.info(
        f"Sentry initialized: environment={effective_environment}, "
        f"release={effective_release}, metrics_enabled={SENTRY_ENABLE_METRICS}"
    )


# ============================================
# Metrics API
# ============================================


def count_metric(
    name: str,
    value: int = 1,
    attributes: Optional[dict] = None,
) -> None:
    """
    Emit a counter metric.

    Use for tracking incrementing values like:
    - API call counts
    - Analysis completions
    - Error occurrences

    Args:
        name: Metric name (e.g., "bias.analysis_completed")
        value: Counter increment (default: 1)
        attributes: Additional attributes for filtering/grouping

    Example:
        count_metric("bias.analysis_completed", 1, {"layer": "preprocessing"})
    """
    if not SENTRY_ENABLE_METRICS:
        return

    try:
        sentry_sdk.metrics.count(name, value, attributes=attributes)
    except Exception as e:
        logger.debug(f"Failed to emit count metric {name}: {e}")


def gauge_metric(
    name: str,
    value: float,
    attributes: Optional[dict] = None,
    unit: Optional[str] = None,
) -> None:
    """
    Emit a gauge metric.

    Use for tracking values that can go up and down:
    - Queue depths
    - Active sessions
    - Memory usage

    Args:
        name: Metric name
        value: Current value
        attributes: Additional attributes
        unit: Unit of measurement (e.g., "byte", "second")

    Example:
        gauge_metric("bias.analysis_queue_depth", 15, {"priority": "high"})
    """
    if not SENTRY_ENABLE_METRICS:
        return

    try:
        kwargs = {"attributes": attributes}
        if unit:
            kwargs["unit"] = unit
        sentry_sdk.metrics.gauge(name, value, **kwargs)
    except Exception as e:
        logger.debug(f"Failed to emit gauge metric {name}: {e}")


def distribution_metric(
    name: str,
    value: float,
    attributes: Optional[dict] = None,
    unit: Optional[str] = None,
) -> None:
    """
    Emit a distribution metric.

    Use for tracking distributions (p50, p90, p99, avg):
    - Response times
    - Bias scores
    - Processing durations

    Args:
        name: Metric name
        value: Value to record
        attributes: Additional attributes
        unit: Unit of measurement (e.g., "millisecond", "second")

    Example:
        distribution_metric("bias.analysis_latency", 150.5,
                          {"layer": "model_level"}, unit="millisecond")
    """
    if not SENTRY_ENABLE_METRICS:
        return

    try:
        kwargs = {"attributes": attributes}
        if unit:
            kwargs["unit"] = unit
        sentry_sdk.metrics.distribution(name, value, **kwargs)
    except Exception as e:
        logger.debug(f"Failed to emit distribution metric {name}: {e}")


# ============================================
# Domain-specific Metric Helpers
# ============================================

class BiasMetrics:
    """Metrics for bias detection analysis."""

    @staticmethod
    def analysis_started(session_id: str, layer: str) -> None:
        """Track when a bias analysis starts."""
        count_metric(
            "bias.analysis_started",
            1,
            {
                "layer": layer,
            },
        )

    @staticmethod
    def analysis_completed(
        session_id: str,
        layer: str,
        duration_ms: float,
        success: bool = True,
    ) -> None:
        """Track when a bias analysis completes."""
        count_metric(
            "bias.analysis_completed",
            1,
            {
                "layer": layer,
                "success": str(success).lower(),
            },
        )
        distribution_metric(
            "bias.analysis_latency",
            duration_ms,
            {
                "layer": layer,
            },
            unit="millisecond",
        )

    @staticmethod
    def score_recorded(
        layer: str,
        score: float,
        bias_type: Optional[str] = None,
    ) -> None:
        """Track bias score distribution."""
        attrs = {"layer": layer}
        if bias_type:
            attrs["bias_type"] = bias_type
        distribution_metric("bias.score", score, attrs)

    @staticmethod
    def alert_triggered(
        level: str,
        layer: str,
        score: float,
    ) -> None:
        """Track when a bias alert is triggered."""
        count_metric(
            "bias.alert_triggered",
            1,
            {
                "alert_level": level,
                "layer": layer,
            },
        )

    @staticmethod
    def linguistic_bias_detected(
        bias_type: str,
        score: float,
    ) -> None:
        """Track linguistic bias detection."""
        count_metric(
            "bias.linguistic_bias_detected",
            1,
            {
                "bias_type": bias_type,
            },
        )
        distribution_metric(
            "bias.linguistic_score",
            score,
            {
                "bias_type": bias_type,
            },
        )


class APIMetrics:
    """Metrics for API performance monitoring."""

    @staticmethod
    def request_received(endpoint: str, method: str) -> None:
        """Track incoming API request."""
        count_metric(
            "api.request_received",
            1,
            {
                "endpoint": endpoint,
                "method": method,
            },
        )

    @staticmethod
    def request_completed(
        endpoint: str,
        method: str,
        status_code: int,
        duration_ms: float,
    ) -> None:
        """Track completed API request with timing."""
        count_metric(
            "api.request_completed",
            1,
            {
                "endpoint": endpoint,
                "method": method,
                "status_code": str(status_code),
            },
        )
        distribution_metric(
            "api.response_time",
            duration_ms,
            {
                "endpoint": endpoint,
                "method": method,
            },
            unit="millisecond",
        )

    @staticmethod
    def error(endpoint: str, error_type: str) -> None:
        """Track API error."""
        count_metric(
            "api.error",
            1,
            {
                "endpoint": endpoint,
                "error_type": error_type,
            },
        )


class ServiceMetrics:
    """Metrics for service health monitoring."""

    @staticmethod
    def active_sessions(count: int) -> None:
        """Track number of active analysis sessions."""
        gauge_metric("service.active_sessions", count)

    @staticmethod
    def queue_depth(depth: int, queue_name: str = "default") -> None:
        """Track analysis queue depth."""
        gauge_metric(
            "service.queue_depth",
            depth,
            {
                "queue_name": queue_name,
            },
        )

    @staticmethod
    def worker_status(worker_id: str, active_tasks: int) -> None:
        """Track worker status."""
        gauge_metric(
            "service.worker_active_tasks",
            active_tasks,
            {
                "worker_id": worker_id,
            },
        )

    @staticmethod
    def memory_usage_mb(usage_mb: float) -> None:
        """Track memory usage."""
        gauge_metric("service.memory_usage", usage_mb, unit="megabyte")

    @staticmethod
    def model_loaded(model_name: str, load_time_ms: float) -> None:
        """Track when a model is loaded."""
        count_metric(
            "service.model_loaded",
            1,
            {
                "model_name": model_name,
            },
        )
        distribution_metric(
            "service.model_load_time",
            load_time_ms,
            {
                "model_name": model_name,
            },
            unit="millisecond",
        )


# ============================================
# Decorators
# ============================================


def track_latency(
    metric_name: str,
    attributes: Optional[dict] = None,
):
    """
    Decorator to track function execution latency.

    Example:
        @track_latency("bias.preprocessing_analysis")
        async def run_preprocessing_analysis(session_data):
            ...
    """

    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            start_time = time.perf_counter()
            try:
                result = await func(*args, **kwargs)
                duration_ms = (time.perf_counter() - start_time) * 1000
                distribution_metric(
                    metric_name, duration_ms, attributes, unit="millisecond"
                )
                return result
            except Exception as e:
                duration_ms = (time.perf_counter() - start_time) * 1000
                distribution_metric(
                    f"{metric_name}_error",
                    duration_ms,
                    {
                        **(attributes or {}),
                        "error_type": type(e).__name__,
                    },
                    unit="millisecond",
                )
                raise

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            start_time = time.perf_counter()
            try:
                result = func(*args, **kwargs)
                duration_ms = (time.perf_counter() - start_time) * 1000
                distribution_metric(
                    metric_name, duration_ms, attributes, unit="millisecond"
                )
                return result
            except Exception as e:
                duration_ms = (time.perf_counter() - start_time) * 1000
                distribution_metric(
                    f"{metric_name}_error",
                    duration_ms,
                    {
                        **(attributes or {}),
                        "error_type": type(e).__name__,
                    },
                    unit="millisecond",
                )
                raise

        import asyncio

        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper

    return decorator


# ============================================
# Convenience Exports
# ============================================

# Expose metric helper classes as module-level singletons
bias_metrics = BiasMetrics()
api_metrics = APIMetrics()
service_metrics = ServiceMetrics()

__all__ = [
    # Initialization
    "init_sentry",
    # Core metric functions
    "count_metric",
    "gauge_metric",
    "distribution_metric",
    # Domain-specific helpers
    "BiasMetrics",
    "APIMetrics",
    "ServiceMetrics",
    "bias_metrics",
    "api_metrics",
    "service_metrics",
    # Decorators
    "track_latency",
]
