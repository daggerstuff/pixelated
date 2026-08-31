"""Unit tests for tools.agent_runner.utils."""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

from tools.agent_runner.utils import format_iso_timestamp

RFC3339_RE = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$",
)


def test_default_is_now_utc() -> None:
    before = datetime.now(timezone.utc)
    result = format_iso_timestamp()
    after = datetime.now(timezone.utc)

    parsed = datetime.fromisoformat(result.replace("Z", "+00:00"))
    assert before <= parsed <= after


def test_explicit_utc_datetime_preserves_microseconds() -> None:
    dt = datetime(2026, 8, 31, 19, 28, 0, 123456, tzinfo=timezone.utc)
    assert format_iso_timestamp(dt) == "2026-08-31T19:28:00.123456Z"


def test_naive_datetime_treated_as_utc() -> None:
    dt = datetime.fromisoformat("2026-01-15T12:00:00")
    assert dt.tzinfo is None
    assert format_iso_timestamp(dt) == "2026-01-15T12:00:00Z"


def test_aware_non_utc_datetime_converted_to_utc() -> None:
    eastern = timezone(timedelta(hours=-5))
    dt = datetime(2026, 8, 31, 14, 30, 0, tzinfo=eastern)
    assert format_iso_timestamp(dt) == "2026-08-31T19:30:00Z"


def test_result_matches_rfc3339() -> None:
    for _ in range(10):
        result = format_iso_timestamp(datetime.now(timezone.utc))
        assert RFC3339_RE.match(result), f"Result {result!r} does not match RFC 3339"
