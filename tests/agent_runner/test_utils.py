"""Unit tests for tools.agent_runner.utils."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from tools.agent_runner.utils import format_iso_timestamp


def test_format_iso_timestamp_no_arg_returns_iso_utc_string() -> None:
    """S1: Calling with no argument returns an ISO-8601 UTC string."""
    result = format_iso_timestamp()
    assert isinstance(result, str)
    # ISO-8601 / RFC-3339 UTC: YYYY-MM-DDTHH:MM:SS+00:00
    assert result.endswith("+00:00")
    assert len(result) >= 25  # at least YYYY-MM-DDTHH:MM:SS+00:00
    # Must be parseable back to a UTC datetime
    parsed = datetime.fromisoformat(result)
    assert parsed.tzinfo is not None
    assert parsed.utcoffset() == timedelta(0)


def test_format_iso_timestamp_with_explicit_utc_datetime() -> None:
    """S2: Explicit UTC datetime is returned in ISO format."""
    dt = datetime(2024, 1, 15, 12, 30, 45, tzinfo=timezone.utc)
    result = format_iso_timestamp(dt)
    assert result == "2024-01-15T12:30:45+00:00"


def test_iso_timestamp_no_arg_matches_current_time_within_window() -> None:
    """S1 (robustness): No-arg result is within ±2s of now."""
    before = datetime.now(timezone.utc)
    result = format_iso_timestamp()
    after = datetime.now(timezone.utc)
    parsed = datetime.fromisoformat(result)
    assert before - timedelta(seconds=2) <= parsed <= after + timedelta(seconds=2)


def test_format_iso_timestamp_naive_datetime_assumes_utc() -> None:
    """S3: Naive datetime is treated as UTC."""
    dt = datetime.fromisoformat("2024-06-01T00:00:00")  # naive: no tz info
    result = format_iso_timestamp(dt)
    assert result == "2024-06-01T00:00:00+00:00"


def test_format_iso_timestamp_tz_aware_non_utc_converts_to_utc() -> None:
    """S4: tz-aware non-UTC datetime is converted to UTC."""
    tz_offset = timezone(timedelta(hours=5, minutes=30))  # IST
    dt = datetime(2024, 1, 15, 18, 0, 0, tzinfo=tz_offset)
    result = format_iso_timestamp(dt)
    assert result == "2024-01-15T12:30:00+00:00"


def test_format_iso_timestamp_preserves_microseconds_when_present() -> None:
    """Microseconds are preserved in the ISO output."""
    dt = datetime(2024, 3, 10, 8, 15, 30, 123456, tzinfo=timezone.utc)
    result = format_iso_timestamp(dt)
    assert result == "2024-03-10T08:15:30.123456+00:00"


def test_format_iso_timestamp_negative_offset_converts_to_utc() -> None:
    """S4 (negative offset): tz-aware with negative offset converts to UTC."""
    tz_neg = timezone(timedelta(hours=-8))  # PST
    dt = datetime(2024, 1, 15, 4, 30, 0, tzinfo=tz_neg)
    result = format_iso_timestamp(dt)
    assert result == "2024-01-15T12:30:00+00:00"
