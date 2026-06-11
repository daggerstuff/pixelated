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
# Redis-backed store for dream cycle tracking (development / non-clustered).
# In production this should be backed by Redis or MongoDB so multiple
# workers share state — see ``DREAM_STORE_BACKEND`` env var.
# ---------------------------------------------------------------------------

# Try to import Redis for distributed job deduplication
try:
    import redis

    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    logger.warning("Redis package not available — falling back to in-memory storage")

# Initialize Redis client if available and REDIS_URL is set
_redis_client = None
if REDIS_AVAILABLE:
    redis_url = os.environ.get("REDIS_URL")
    if redis_url:
        try:
            # First try connecting with the full URL (including credentials if present)
            _redis_client = redis.from_url(redis_url, decode_responses=True)
            # Test connection
            _redis_client.ping()
            logger.info("Redis client initialized for dream consolidation")
        except Exception as e:
            # If connection fails, try without credentials (for Redis servers without auth)
            logger.warning(f"Failed to initialize Redis client with credentials: {e}")
            try:
                # Extract host and port from URL, ignoring credentials
                if "@" in redis_url:
                    # Format: redis://[:password@]host:port
                    host_part = redis_url.split("@")[1]
                    # Reconstruct URL without credentials
                    if redis_url.startswith("rediss://"):
                        fallback_url = f"rediss://{host_part}"
                    else:
                        fallback_url = f"redis://{host_part}"
                else:
                    # No credentials in URL, use as-is
                    fallback_url = redis_url

                _redis_client = redis.from_url(fallback_url, decode_responses=True)
                _redis_client.ping()
                logger.info("Redis client initialized for dream consolidation (without credentials)")
            except Exception as e2:
                logger.warning(
                    f"Failed to initialize Redis client without credentials: {e2} — falling back to in-memory storage"
                )
                _redis_client = None
    else:
        logger.debug("REDIS_URL not set — using in-memory storage for dream consolidation")

# Fallback to in-memory store if Redis is not available
if _redis_client is None:
    _dream_cycles: dict[str, dict[str, Any]] = {}


def _get_inference_base_url() -> str:
    """Return the base URL of the Pixel inference service.

    Falls back to http://localhost:8001 (the default inference port).
    Override via the ``PIXEL_INFERENCE_URL`` environment variable.
    """
    return os.environ.get("PIXEL_INFERENCE_URL", "http://localhost:8001").rstrip("/")


def _acquire_lock(user_id: str, timeout: int = 600) -> bool:
    """Acquire a TTL-based Redis lock for dream consolidation.

    Args:
        user_id: User identifier
        timeout: Lock timeout in seconds (default: 10 minutes)

    Returns:
        True if lock acquired, False otherwise
    """
    if _redis_client is None:
        # Fallback to in-memory locking (not truly distributed but maintains interface)
        lock_key = f"dream:lock:{user_id}"
        if lock_key in _dream_cycles:
            return False
        _dream_cycles[lock_key] = {"acquired_at": datetime.now(UTC).timestamp()}
        return True

    try:
        lock_key = f"dream:lock:{user_id}"
        # SET key value NX EX timeout (set if not exists with expiration)
        result = _redis_client.set(lock_key, "1", nx=True, ex=timeout)
        return result is True
    except Exception as e:
        logger.error(f"Failed to acquire Redis lock for user {user_id}: {e}")
        # Fallback to in-memory on Redis failure
        lock_key = f"dream:lock:{user_id}"
        if lock_key in _dream_cycles:
            return False
        _dream_cycles[lock_key] = {"acquired_at": datetime.now(UTC).timestamp()}
        return True


def _release_lock(user_id: str) -> None:
    """Release a Redis lock for dream consolidation.

    Args:
        user_id: User identifier
    """
    if _redis_client is None:
        # Fallback to in-memory lock release
        lock_key = f"dream:lock:{user_id}"
        _dream_cycles.pop(lock_key, None)
        return

    try:
        lock_key = f"dream:lock:{user_id}"
        _redis_client.delete(lock_key)
    except Exception as e:
        logger.error(f"Failed to release Redis lock for user {user_id}: {e}")
        # Fallback to in-memory cleanup
        lock_key = f"dream:lock:{user_id}"
        _dream_cycles.pop(lock_key, None)


def _store_dream_result(user_id: str, dream_id: str, result: dict[str, Any], ttl: int = 86400) -> None:
    """Store dream result in Redis with TTL.

    Args:
        user_id: User identifier
        dream_id: Dream identifier
        result: Dream result data
        ttl: Time to live in seconds (default: 24 hours)
    """
    if _redis_client is None:
        # Fallback to in-memory storage
        _dream_cycles[dream_id] = result
        # Also track user-dream relationship for active users listing
        user_dreams_key = f"dream:user:{user_id}"
        if user_dreams_key not in _dream_cycles:
            _dream_cycles[user_dreams_key] = []
        if dream_id not in _dream_cycles[user_dreams_key]:
            _dream_cycles[user_dreams_key].append(dream_id)
        return

    try:
        # Store the dream result (serialize to JSON for Redis)
        import json

        result_key = f"dream:result:{user_id}:{dream_id}"
        _redis_client.set(result_key, json.dumps(result), ex=ttl)

        # Track user-dream relationship for active users listing
        user_dreams_key = f"dream:user:{user_id}"
        _redis_client.sadd(user_dreams_key, dream_id)
        # Set expiration on the user tracking key as well
        _redis_client.expire(user_dreams_key, ttl)

        # Add user to global active users set
        _redis_client.sadd("dream:users", user_id)
    except Exception as e:
        logger.error(f"Failed to store dream result in Redis for user {user_id}, dream {dream_id}: {e}")
        # Fallback to in-memory storage
        _dream_cycles[dream_id] = result
        # Also track user-dream relationship for active users listing
        user_dreams_key = f"dream:user:{user_id}"
        if user_dreams_key not in _dream_cycles:
            _dream_cycles[user_dreams_key] = []
        if dream_id not in _dream_cycles[user_dreams_key]:
            _dream_cycles[user_dreams_key].append(dream_id)


def _get_dream_result(user_id: str, dream_id: str) -> dict[str, Any] | None:
    """Get dream result from Redis.

    Args:
        user_id: User identifier
        dream_id: Dream identifier

    Returns:
        Dream result data or None if not found
    """
    if _redis_client is None:
        # Fallback to in-memory storage
        return _dream_cycles.get(dream_id)

    try:
        result_key = f"dream:result:{user_id}:{dream_id}"
        result = _redis_client.get(result_key)
        if result is None:
            return None
        # Handle both string and dict results (for backward compatibility)
        if isinstance(result, str):
            import json

            return json.loads(result)
        return result
    except Exception as e:
        logger.error(f"Failed to get dream result from Redis for user {user_id}, dream {dream_id}: {e}")
        # Fallback to in-memory storage
        return _dream_cycles.get(dream_id)


def _get_user_latest_dream(user_id: str) -> tuple[str, dict[str, Any]] | None:
    """Get the most recent dream result for a user.

    Args:
        user_id: User identifier

    Returns:
        Tuple of (dream_id, dream_result) or None if not found
    """
    if _redis_client is None:
        # Fallback to in-memory storage
        user_dreams_key = f"dream:user:{user_id}"
        dream_ids = _dream_cycles.get(user_dreams_key, [])
        if not dream_ids:
            return None
        # Get the most recent dream (assuming dream_id contains timestamp or we check all)
        latest_dream_id = None
        latest_dream_result = None
        latest_time = 0

        for dream_id in dream_ids:
            dream_result = _dream_cycles.get(dream_id)
            if dream_result and isinstance(dream_result, dict):
                # Try to get timestamp from dream result
                dream_time = dream_result.get("start_time", 0)
                if isinstance(dream_time, str):
                    try:
                        # Parse ISO timestamp
                        dt = datetime.fromisoformat(dream_time.replace("Z", "+00:00"))
                        dream_time = dt.timestamp()
                    except:
                        dream_time = 0
                elif not isinstance(dream_time, (int, float)):
                    dream_time = 0

                if dream_time > latest_time:
                    latest_time = dream_time
                    latest_dream_id = dream_id
                    latest_dream_result = dream_result

        if latest_dream_id is None and dream_ids:
            # Fallback to first dream if no timestamps found
            latest_dream_id = dream_ids[0]
            latest_dream_result = _dream_cycles.get(latest_dream_id)

        return (latest_dream_id, latest_dream_result) if latest_dream_id else None

    try:
        # Get all dream IDs for this user
        user_dreams_key = f"dream:user:{user_id}"
        dream_ids = _redis_client.smembers(user_dreams_key)
        if not dream_ids:
            return None

        # Get the most recent dream by checking timestamps
        latest_dream_id = None
        latest_dream_result = None
        latest_time = 0

        for dream_id in dream_ids:
            dream_result = _get_dream_result(user_id, dream_id)
            if dream_result and isinstance(dream_result, dict):
                # Try to get timestamp from dream result
                dream_time = dream_result.get("start_time", 0)
                if isinstance(dream_time, str):
                    try:
                        # Parse ISO timestamp
                        dt = datetime.fromisoformat(dream_time.replace("Z", "+00:00"))
                        dream_time = dt.timestamp()
                    except:
                        dream_time = 0
                elif not isinstance(dream_time, (int, float)):
                    dream_time = 0

                if dream_time > latest_time:
                    latest_time = dream_time
                    latest_dream_id = dream_id
                    latest_dream_result = dream_result

        return (latest_dream_id, latest_dream_result) if latest_dream_id else None
    except Exception as e:
        logger.error(f"Failed to get user latest dream from Redis for user {user_id}: {e}")
        # Fallback to in-memory storage
        user_dreams_key = f"dream:user:{user_id}"
        dream_ids = _dream_cycles.get(user_dreams_key, [])
        if not dream_ids:
            return None
        # Return the first dream as fallback
        dream_id = dream_ids[0]
        dream_result = _dream_cycles.get(dream_id)
        return (dream_id, dream_result) if dream_id else None


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

    # Acquire lock before processing to prevent duplicate consolidation
    if not _acquire_lock(user_id):
        # Lock exists, check if we have an existing dream for this user
        existing_dream = _get_user_latest_dream(user_id)
        if existing_dream:
            dream_id, existing_result = existing_dream
            return jsonify(
                {
                    "success": False,
                    "error": "Dream consolidation already in progress",
                    "dream_id": dream_id,
                }
            ), 409
        else:
            # No existing dream found, but lock exists - this shouldn't happen
            # but we'll treat it as a conflict
            return jsonify(
                {
                    "success": False,
                    "error": "Dream consolidation already in progress",
                }
            ), 409

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

            _store_dream_result(user_id, dream_id, record)
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

        dream_id = data.get("dream_id")
        if dream_id:
            # Store the result in Redis for future reference
            _store_dream_result(user_id, dream_id, data)
            logger.info(
                "Dream consolidation forwarded for user %s: %s",
                user_id,
                dream_id,
            )
            return jsonify(
                {
                    "success": True,
                    "dream_id": dream_id,
                    "message": "Dream cycle initiated via inference service",
                    "result": data,
                }
            )
        else:
            logger.error(
                "Dream consolidation succeeded but no dream_id returned for user %s",
                user_id,
            )
            return jsonify(
                {
                    "success": False,
                    "error": "Dream consolidation succeeded but no dream_id returned",
                }
            ), 502

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
    finally:
        # Always release the lock when done
        _release_lock(user_id)


@dream_bp.route("/status/<dream_id>", methods=["GET"])
def get_consolidation_status(dream_id: str):
    """Get the status of a dream consolidation cycle.

    Args:
        dream_id: Unique dream cycle identifier.

    Response JSON:
        success  (bool) — Whether the dream was found.
        dream    (dict) — Dream cycle record.
    """
    # Try to get from Redis first
    # We need to search through all users to find this dream_id
    # This is inefficient but maintains compatibility with the existing interface
    # A better approach would be to maintain a reverse index, but for now we'll
    # check Redis if available, then fall back to the inference service

    dream_record = None
    found_user_id = None

    if _redis_client is not None:
        try:
            # Scan for users with dream records
            # This is not ideal but works for small-scale usage
            # In production, we'd want a better indexing strategy
            cursor = 0
            while True:
                cursor, keys = _redis_client.scan(cursor, match="dream:user:*", count=100)
                for key in keys:
                    # Extract user_id from key format "dream:user:{user_id}"
                    if key.startswith("dream:user:"):
                        user_id = key.split(":", 2)[2]
                        # Check if this user has the dream_id
                        dream_key = f"dream:result:{user_id}:{dream_id}"
                        if _redis_client.exists(dream_key):
                            dream_record = _get_dream_result(user_id, dream_id)
                            if dream_record:
                                found_user_id = user_id
                                break
                if found_user_id or cursor == 0:
                    break
        except Exception as e:
            logger.error(f"Failed to search for dream {dream_id} in Redis: {e}")
            # Continue to fallback methods

    # Fallback to in-memory storage if Redis search failed or Redis not available
    if dream_record is None and _redis_client is None:
        # Check in-memory store
        if dream_id in _dream_cycles:
            dream_record = _dream_cycles[dream_id]

    if dream_record is not None:
        return jsonify(
            {
                "success": True,
                "dream": dream_record,
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
    # Get users from Redis if available
    if _redis_client is not None:
        try:
            # Get all users with dream records
            user_ids = _redis_client.smembers("dream:users")
            users_list = list(user_ids) if user_ids else []

            return jsonify(
                {
                    "success": True,
                    "users": users_list,
                    "message": (
                        f"Found {len(users_list)} users with dream records in Redis. "
                        "Set DREAM_USER_WHITELIST env var with comma-separated user IDs "
                        "to target specific users from the scheduler."
                    ),
                }
            )
        except Exception as e:
            logger.error(f"Failed to get active users from Redis: {e}")
            # Fall through to in-memory fallback

    # Fallback to in-memory storage
    # Extract unique user_ids from _dream_cycles
    user_ids = set()
    for key, value in _dream_cycles.items():
        if key.startswith("dream:user:"):
            # Extract user_id from key format "dream:user:{user_id}"
            user_id = key.split(":", 2)[2]
            user_ids.add(user_id)
        elif isinstance(value, dict) and "user_id" in value:
            # Direct user_id in dream record
            user_ids.add(value["user_id"])

    users_list = list(user_ids)

    return jsonify(
        {
            "success": True,
            "users": users_list,
            "message": (
                "Active user listing not yet implemented. "
                "Set DREAM_USER_WHITELIST env var with comma-separated user IDs "
                "to target specific users from the scheduler."
            ),
        }
    )
