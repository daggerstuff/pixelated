"""Unit tests for format_iso_timestamp."""

from datetime import datetime, timedelta, timezone

from tools.agent_runner.utils import format_iso_timestamp


def test_format_iso_timestamp_defaults_to_now():
    """Calling with no argument returns a current UTC timestamp."""
    before = datetime.now(timezone.utc)
    result = format_iso_timestamp()
    after = datetime.now(timezone.utc)

    parsed = datetime.fromisoformat(result.replace("Z", "+00:00"))
    assert before <= parsed <= after


def test_format_iso_timestamp_uses_z_suffix():
    """Output must end with ``Z``, not ``+00:00``."""
    result = format_iso_timestamp()
    assert result.endswith("Z")
    assert "+00:00" not in result


def test_format_iso_timestamp_accepts_aware_datetime():
    """A timezone-aware datetime is converted to UTC."""
    dt = datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
    assert format_iso_timestamp(dt) == "2024-01-15T12:00:00Z"


def test_format_iso_timestamp_accepts_naive_datetime():
    """A timezone-naive datetime is treated as UTC."""
    dt = datetime.fromisoformat("2024-06-30T23:59:59.123456")
    assert format_iso_timestamp(dt) == "2024-06-30T23:59:59.123456Z"


def test_format_iso_timestamp_converts_non_utc_offset():
    """A datetime with a non-UTC offset is normalised to UTC."""
    dt = datetime(2024, 1, 1, 5, 0, 0, tzinfo=timezone(timedelta(hours=5)))
    assert format_iso_timestamp(dt) == "2024-01-01T00:00:00Z"


def test_format_iso_timestamp_is_rfc3339_parseable():
    """The output round-trips through RFC-3339 / ISO-8601 parsers."""
    result = format_iso_timestamp(datetime(2024, 3, 14, 1, 59, 26, 535897, tzinfo=timezone.utc))
    # Python's fromisoformat handles the 'Z' suffix in 3.12+
    parsed = datetime.fromisoformat(result)
    assert parsed == datetime(2024, 3, 14, 1, 59, 26, 535897, tzinfo=timezone.utc)
