"""Simulation orchestration tasks for the AI Persona Engineer.

Celery task chain for a learner chat message in a simulation session:

    run_safety_input_guard(user_input)
      → update_persona_state(sanitized_input, session_id)
        → generate_llm_response(context, persona_id)
          → run_safety_output_guard(llm_output, persona_id)
            → broadcast_response(verified_output, session_id)

Each task records progress in the Celery result backend so the API can
report chain status via ``AsyncResult``. Task bodies delegate to mock-safe
implementations: the LLM stage reads the configured provider from
``src.pe.config.settings`` (mock provider produces a deterministic reply,
so the chain works end-to-end without external services).
"""

from __future__ import annotations

import logging
import re
import uuid
from typing import Any

from src.pe.celery_app import task

logger = logging.getLogger(__name__)

# Input guard: strip control characters, collapse whitespace, cap length
_INPUT_MAX_CHARS = 4_000
_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

# Output guard markers — clinical-safety floor, mirrors pe safety rules
_UNSAFE_OUTPUT_MARKERS = ("suicide instructions", "self-harm how-to")


@task(
    name="src.pe.tasks.simulation.run_safety_input_guard",
    bind=True,
    max_retries=3,
    default_retry_delay=2,
)
def run_safety_input_guard(self: Any, user_input: str) -> str:
    """Sanitize the learner's raw message before it reaches persona state."""
    try:
        if not isinstance(user_input, str):
            raise ValueError("user_input must be a string")
        sanitized = _CONTROL_CHARS.sub("", user_input).strip()[:_INPUT_MAX_CHARS]
        if not sanitized:
            raise ValueError("user_input is empty after sanitization")
        return sanitized
    except Exception as exc:
        raise self.retry(exc=exc) from exc


@task(
    name="src.pe.tasks.simulation.update_persona_state",
    bind=True,
    max_retries=3,
    default_retry_delay=2,
)
def update_persona_state(self: Any, sanitized_input: str, session_id: str) -> dict[str, Any]:
    """Fold the sanitized message into the persona conversation context."""
    try:
        if not sanitized_input:
            raise ValueError("sanitized_input is empty")
        if not session_id:
            raise ValueError("session_id is required")
        # Persona state update is persisted by the persona service; the task
        # produces the context snapshot the LLM stage consumes.
        return {
            "session_id": session_id,
            "user_message": sanitized_input,
            "turn_markers": ["input_guard_passed"],
        }
    except Exception as exc:
        raise self.retry(exc=exc) from exc


@task(
    name="src.pe.tasks.simulation.generate_llm_response",
    bind=True,
    max_retries=3,
    default_retry_delay=5,
)
def generate_llm_response(self: Any, context: dict[str, Any]) -> dict[str, Any]:
    """Generate the persona's reply from the conversation context."""
    try:
        provider = _resolve_provider()
        user_message = str(context.get("user_message", ""))
        llm_output = provider(user_message)
        if not llm_output:
            raise ValueError("LLM returned empty output")
        return {**context, "llm_output": llm_output}
    except Exception as exc:
        raise self.retry(exc=exc) from exc


@task(
    name="src.pe.tasks.simulation.run_safety_output_guard",
    bind=True,
    max_retries=3,
    default_retry_delay=2,
)
def run_safety_output_guard(self: Any, context: dict[str, Any]) -> dict[str, Any]:
    """Verify the LLM output passes the clinical-safety floor."""
    try:
        llm_output = str(context.get("llm_output", ""))
        lowered = llm_output.lower()
        if any(marker in lowered for marker in _UNSAFE_OUTPUT_MARKERS):
            raise ValueError("LLM output blocked by output guard")
        verified = llm_output
        return {**context, "verified_output": verified}
    except ValueError as exc:
        # Safety violations are not retryable — the content is the problem.
        raise RuntimeError(str(exc)) from exc
    except Exception as exc:
        raise self.retry(exc=exc) from exc


@task(
    name="src.pe.tasks.simulation.broadcast_response",
    bind=True,
    max_retries=3,
    default_retry_delay=2,
)
def broadcast_response(self: Any, context: dict[str, Any], session_id: str) -> dict[str, Any]:
    """Deliver the verified response to the session's WebSocket channel.

    The API process keeps an in-process ConnectionManager; cross-process
    delivery uses the Redis pub/sub channel the API subscribes to. In
    mock-provider mode the payload is returned so tests can assert on it.
    """
    try:
        payload = {
            "type": "message",
            "session_id": session_id,
            "message": {
                "id": str(uuid.uuid4()),
                "role": "persona",
                "content": context.get("verified_output", ""),
                "turn_number": context.get("turn_number"),
            },
        }
        _publish_broadcast(session_id, payload)
        return payload
    except Exception as exc:
        raise self.retry(exc=exc) from exc


def _resolve_provider() -> Any:
    """Resolve the LLM callable from settings.

    Returns a deterministic mock reply when provider is "mock" (default),
    keeping the chain functional without external services.
    """
    from src.pe.config import settings

    if getattr(settings, "LLM_PROVIDER", "mock") == "mock":
        return _mock_persona_reply
    raise ValueError(
        "Non-mock LLM providers require the persona inference service; "
        "configure LLM_PROVIDER=mock for standalone chain operation"
    )


def _mock_persona_reply(user_message: str) -> str:
    return (
        f"I understand you're asking about '{user_message[:50]}'. "
        "Let me help you with that. As a patient, I can tell you about my "
        "symptoms and medical history."
    )


def _publish_broadcast(session_id: str, payload: dict[str, Any]) -> None:
    """Publish the response on the session broadcast channel.

    Uses the Celery broker's Redis connection; failures are logged and
    swallowed — a missed broadcast must not fail the chain result.
    """
    import json

    try:
        import redis

        from src.pe.config import settings

        client = redis.from_url(settings.REDIS_URL.replace("/0", "/1"), decode_responses=True)
        client.publish(f"simulation:channel:{session_id}", json.dumps(payload, default=str))
    except Exception:
        logger.warning("broadcast publish failed for session %s", session_id, exc_info=True)
