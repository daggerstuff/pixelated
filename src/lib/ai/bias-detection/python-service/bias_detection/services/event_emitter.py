"""Optional integration with the foresight EventBus.

The `foresight` package is an optional dependency of this service. When it is
installed, bias/crisis analysis events are published to its EventBus; when it
is absent (standalone deployments), emission degrades to a logged no-op so
bias analysis is never interrupted.

The foresight import is intentionally lazy and isolated in this module:
importing it at module load time would make the whole service fail to import
in environments without foresight installed.
"""

import importlib
import logging
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

#: Score thresholds; keep in sync with AnalysisOrchestrator._consolidate_results.
WARNING_THRESHOLD = 0.2
CRITICAL_THRESHOLD = 0.7


def _load_foresight():
    """Return (Event, EventType, event_bus) or None when foresight is unavailable."""
    try:
        event_bus_mod = importlib.import_module("foresight.event_bus")
    except ImportError:
        logger.debug("foresight.event_bus not available; bias events disabled")
        return None
    return (
        event_bus_mod.Event,
        event_bus_mod.EventType,
        event_bus_mod.get_event_bus(),
    )


def _build_event(Event, EventType, event_type, *, actor, entity_id, payload):
    return Event(
        id=uuid.uuid4().hex,
        event_type=event_type,
        timestamp=datetime.now(timezone.utc),
        actor=actor,
        entity_id=entity_id,
        payload=payload,
        metadata={},
    )


def emit_bias_events(
    *,
    session_id: str,
    user_id: str,
    overall_score: float,
    alert_level: str,
    detected_biases: list | None = None,
    receipt_root_hash: str | None = None,
) -> bool:
    """Publish bias/crisis events to the foresight EventBus.

    Always publishes BIAS_DETECTED. When ``overall_score`` reaches the warning
    threshold also publishes BIAS_THRESHOLD_EXCEEDED; when it reaches the
    critical threshold additionally publishes CRISIS_DETECTED and
    CRISIS_THRESHOLD_EXCEEDED.

    Returns True when foresight is available (events attempted), False when it
    is not installed. Never raises: individual publish failures are logged and
    skipped so analysis is never interrupted.
    """
    loaded = _load_foresight()
    if loaded is None:
        return False
    Event, EventType, bus = loaded

    detected_biases = detected_biases or []
    base_payload = {
        "overall_bias_score": overall_score,
        "alert_level": alert_level,
        "session_id": session_id,
        "user_id": user_id,
        "detected_biases": detected_biases,
        "receipt_root_hash": receipt_root_hash,
    }

    events = [
        _build_event(
            Event,
            EventType,
            EventType.BIAS_DETECTED,
            actor=user_id,
            entity_id=session_id,
            payload=base_payload,
        )
    ]
    if overall_score >= WARNING_THRESHOLD:
        events.append(
            _build_event(
                Event,
                EventType,
                EventType.BIAS_THRESHOLD_EXCEEDED,
                actor=user_id,
                entity_id=session_id,
                payload={**base_payload, "threshold": WARNING_THRESHOLD},
            )
        )
    if overall_score >= CRITICAL_THRESHOLD:
        events.append(
            _build_event(
                Event,
                EventType,
                EventType.CRISIS_DETECTED,
                actor=user_id,
                entity_id=session_id,
                payload=base_payload,
            )
        )
        events.append(
            _build_event(
                Event,
                EventType,
                EventType.CRISIS_THRESHOLD_EXCEEDED,
                actor=user_id,
                entity_id=session_id,
                payload={**base_payload, "threshold": CRITICAL_THRESHOLD},
            )
        )

    for event in events:
        try:
            bus.publish(event)
        except Exception:
            logger.exception("Failed to publish bias event", extra={"event_type": event.event_type})
    return True
