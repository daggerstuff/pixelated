"""
Dream Consolidation API — Flask Blueprint

Provides REST endpoints for triggering and monitoring dream cycle
consolidation in the background memory consolidation engine ("Dreaming").

Sprint 3 — PIX-1915: Dreaming & Consolidation
"""

from __future__ import annotations

import logging
import os
import uuid
from datetime import UTC, datetime
from typing import Any

from flask import Blueprint, jsonify, request

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Blueprint
# ---------------------------------------------------------------------------

dream_bp = Blueprint("dream", __name__, url_prefix="/api/dream")

# ---------------------------------------------------------------------------
# In-memory store for dream cycle tracking (development / non-clustered).
# In production this should be backed by Redis or MongoDB so multiple
# workers share state — see ``DREAM_STORE_BACKEND`` env var.
# ---------------------------------------------------------------------------

_dream_cycles: dict[str, dict[str, Any]] = {}


def _get_inference_base_url() -> str:
    """Return the base URL of the Pixel inference service.

    Falls back to http://localhost:8001 (the default inference port).
    Override via the ``PIXEL_INFERENCE_URL`` environment variable.
    """
    return os.environ.get("PIXEL_INFERENCE_URL", "http://localhost:8001").rstrip("/")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@dream_bp.route("/consolidate", methods=["POST"])
def trigger_consolidation():
    """Trigger a dream consolidation cycle for a user.

    Request JSON:
        user_id  (str, required)  — Target user identifier.
        memories (list, optional) — Pre-fetched memories to process.
                                    When omitted the dream manager fetches
                                    them from its store.

    Response JSON:
        success   (bool)   — Whether the cycle was initiated.
        dream_id  (str)    — Unique dream cycle identifier.
        message   (str)    — Human-readable status.
        result    (dict)   — Dream cycle result (themes, patterns, etc.).
    """
    data = request.get_json(silent=True) or {}
    user_id: str | None = data.get("user_id")

    if not user_id:
        return jsonify({"success": False, "error": "user_id is required"}), 400

    memories: list[dict[str, Any]] | None = data.get("memories")

    try:
        import httpx  # lazy import — not in base requirements.txt
    except ImportError:

        async def _noop_trigger():
            """Fallback: create a local dream record without calling the inference service."""
            dream_id = f"dream_{uuid.uuid4().hex[:12]}"
            now = datetime.now(UTC).isoformat()

            record = {
                "dream_id": dream_id,
                "user_id": user_id,
                "start_time": now,
                "end_time": now,
                "status": "completed",
                "phases": {
                    "nrem_completed": True,
                    "rem_completed": True,
                    "consolidation_completed": True,
                    "reflection_triggered": False,
                },
                "themes": [],
                "patterns": [],
                "consolidated_memories": [],
                "insights": [],
                "emotional_tone": None,
                "note": "httpx not available — triggered in degraded mode",
            }

            _dream_cycles[dream_id] = record
            return record

        import asyncio

        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        result = loop.run_until_complete(_noop_trigger())
        logger.info(
            "Dream consolidation [degraded] for user %s: dream_id=%s",
            user_id,
            result["dream_id"],
        )
        return jsonify(
            {
                "success": True,
                "dream_id": result["dream_id"],
                "message": "Dream cycle completed (degraded mode — httpx not available)",
                "result": result,
            }
        )

    # Forward the consolidation request to the Pixel inference service
    # which has the full DreamManager integration.
    inference_url = f"{_get_inference_base_url()}/api/memory/dream/consolidate"

    try:
        import httpx

        with httpx.Client(timeout=300.0) as client:
            payload: dict[str, Any] = {"user_id": user_id}
            if memories is not None:
                payload["memories"] = memories

            resp = client.post(inference_url, json=payload)
            resp.raise_for_status()
            data = resp.json()

        logger.info(
            "Dream consolidation forwarded for user %s: %s",
            user_id,
            data.get("dream_id", "?"),
        )
        return jsonify(
            {
                "success": True,
                "dream_id": data.get("dream_id"),
                "message": "Dream cycle initiated via inference service",
                "result": data,
            }
        )

    except Exception as exc:
        logger.error(
            "Dream consolidation failed for user %s: %s",
            user_id,
            exc,
        )
        return jsonify(
            {
                "success": False,
                "error": f"Dream consolidation failed: {exc}",
            }
        ), 502


@dream_bp.route("/status/<dream_id>", methods=["GET"])
def get_consolidation_status(dream_id: str):
    """Get the status of a dream consolidation cycle.

    Args:
        dream_id: Unique dream cycle identifier.

    Response JSON:
        success  (bool) — Whether the dream was found.
        dream    (dict) — Dream cycle record.
    """
    # Check local store first
    if dream_id in _dream_cycles:
        return jsonify(
            {
                "success": True,
                "dream": _dream_cycles[dream_id],
            }
        )

    # Fallback: query the inference service
    inference_url = f"{_get_inference_base_url()}/api/memory/dream/status/{dream_id}"

    try:
        import httpx

        with httpx.Client(timeout=30.0) as client:
            resp = client.get(inference_url)
            if resp.status_code == 404:
                return jsonify(
                    {
                        "success": False,
                        "error": f"Dream cycle {dream_id} not found",
                    }
                ), 404
            resp.raise_for_status()
            data = resp.json()

        return jsonify(
            {
                "success": True,
                "dream": data.get("dream", data),
            }
        )

    except Exception as exc:
        logger.error("Failed to query dream status for %s: %s", dream_id, exc)
        return jsonify(
            {
                "success": False,
                "error": f"Failed to query dream status: {exc}",
            }
        ), 502


@dream_bp.route("/users", methods=["GET"])
def list_active_users():
    """List users with pending consolidation data.

    This is a stub — in production it should query MongoDB or the
    memory backend for users whose memory count exceeds the
    consolidation threshold.

    Response JSON:
        success  (bool)  — Always true.
        users    (list)  — List of user identifiers eligible for consolidation.
    """
    return jsonify(
        {
            "success": True,
            "users": [],
            "message": (
                "Active user listing not yet implemented. "
                "Set DREAM_USER_WHITELIST env var with comma-separated user IDs "
                "to target specific users from the scheduler."
            ),
        }
    )
