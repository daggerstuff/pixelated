"""Shared utility helpers for the agent_runner tool."""

from __future__ import annotations

from datetime import datetime, timezone


def format_iso_timestamp(dt: datetime | None = None) -> str:
    """Format a datetime as a strict ISO-8601 / RFC-3339 UTC string with a ``Z`` suffix.

    Args:
        dt: Datetime to format. When ``None``, the current UTC time is used.
            Naive datetimes are treated as UTC. Aware datetimes in a non-UTC
            zone are converted to UTC.

    Returns:
        Canonical UTC timestamp, e.g. ``"2026-08-31T19:28:00.123456Z"``.
    """
    if dt is None:
        dt = datetime.now(timezone.utc)
    elif dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)

    return dt.isoformat().replace("+00:00", "Z")
