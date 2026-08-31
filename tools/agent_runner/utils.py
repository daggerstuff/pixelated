"""Shared utility helpers for the agent runner."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

logger = logging.getLogger("agent_runner.utils")


def format_iso_timestamp(dt: datetime | None = None) -> str:
    """Format a datetime as a strict ISO-8601 / RFC-3339 UTC string.

    The returned string always carries a ``Z`` suffix (no ``+00:00`` offset),
    matching the RFC-3339 UTC convention used across the agent runner.

    Args:
        dt: Optional datetime to format. Defaults to ``datetime.now(datetime.UTC)``.
            If a timezone-naive datetime is supplied it is assumed to be UTC.

    Returns:
        RFC-3339 UTC timestamp string ending in ``Z``, e.g.
        ``2024-01-15T10:30:00.123456Z``.
    """
    if dt is None:
        dt = datetime.now(timezone.utc)
    elif dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")
