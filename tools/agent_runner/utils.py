"""Shared utility helpers for the agent_runner package.

Provides ``format_iso_timestamp`` — a strict ISO-8601 / RFC-3339 UTC
timestamp formatter that consolidates the ad-hoc
``datetime.now(timezone.utc).isoformat()`` calls scattered across the
agent_runner modules.
"""

from __future__ import annotations

from datetime import datetime, timezone


def format_iso_timestamp(dt: datetime | None = None) -> str:
    """Return an ISO-8601 / RFC-3339 UTC timestamp string.

    Parameters
    ----------
    dt:
        Optional ``datetime`` to format. If ``None``, the current UTC
        time is used. Naive datetimes are assumed to be UTC. Timezone-aware
        datetimes are converted to UTC before formatting.

    Returns
    -------
    str
        The timestamp in ``YYYY-MM-DDTHH:MM:SS[.ffffff]+00:00`` form,
        preserving microseconds when present and always emitting a
        ``+00:00`` offset to satisfy RFC-3339.
    """
    if dt is None:
        dt = datetime.now(timezone.utc)
    elif dt.tzinfo is None:
        # Treat naive datetimes as UTC rather than raising, matching the
        # existing convention in the agent_runner codebase.
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.isoformat()
