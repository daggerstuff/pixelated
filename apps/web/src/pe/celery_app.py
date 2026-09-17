"""Celery application configuration for Pixelated Empathy.

Defines the Celery app, task discovery, and periodic schedules.
Designed to integrate with the AI Persona Engineer's task chain:
    run_safety_input_guard → update_persona_state → generate_llm_response
    → run_safety_output_guard → broadcast_response
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, Protocol

from celery import Celery

from src.pe.config import settings

celery_app = Celery(
    "pixelated_empathy",
    broker=settings.REDIS_URL.replace("/0", "/1"),  # Use DB 1 for Celery
    backend=settings.REDIS_URL.replace("/0", "/1"),
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    result_expires=3600,  # Results expire after 1 hour
)

# Auto-discover tasks from registered modules
celery_app.autodiscover_tasks(
    packages=[
        "src.pe.tasks",
    ],
    related_name="tasks",
)


# ── Typed task decorator ──────────────────────────────────────────


class CeleryTask(Protocol):
    """Structural type for celery task objects: callable + chain builders.

    Celery ships no ``py.typed`` marker, so without this the decorator
    collapses task types to ``Any`` (strict ``untyped-decorator``) — and
    chain call sites like ``run_safety_input_guard.s(...)`` then fail
    with ``attr-defined`` once the function type is preserved.
    """

    def __call__(self, *args: Any, **kwargs: Any) -> Any: ...

    def s(self, *args: Any, **kwargs: Any) -> Any: ...

    def delay(self, *args: Any, **kwargs: Any) -> Any: ...

    def apply_async(self, *args: Any, **kwargs: Any) -> Any: ...

    def run(self, *args: Any, **kwargs: Any) -> Any: ...

    @property
    def name(self) -> str: ...


def task(*args: Any, **kwargs: Any) -> Callable[[Callable[..., Any]], CeleryTask]:
    """Typed facade over ``celery_app.task`` preserving the callable's type
    while exposing the chain-builder methods (``.s``, ``.delay``,
    ``.apply_async``) strict mypy can verify at dispatch sites.
    """
    decorator: Callable[[Callable[..., Any]], CeleryTask] = celery_app.task(*args, **kwargs)
    return decorator


# ── Periodic / Scheduled Tasks ────────────────────────────────────
# These run on a schedule via celery beat
CELERY_BEAT_SCHEDULE: dict[str, Any] = {}

# Example: metering daily rollup
# CELERY_BEAT_SCHEDULE["metering-daily-rollup"] = {
#     "task": "src.pe.tasks.metering.daily_rollup",
#     "schedule": crontab(hour=0, minute=5),  # Daily at 00:05 UTC
# }


# ── Task Chain Helpers ────────────────────────────────────────────
# The AI Persona Engineer's orchestration chain is called from
# simulations.py via trigger_celery_chain().
# Expected task signatures:
#   run_safety_input_guard(user_input) → sanitized_input
#   update_persona_state(sanitized_input, session_id) → context
#   generate_llm_response(context, persona_id) → llm_output
#   run_safety_output_guard(llm_output, persona_id) → verified_output
#   broadcast_response(verified_output, session_id) → None
