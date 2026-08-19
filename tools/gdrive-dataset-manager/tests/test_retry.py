from __future__ import annotations

from gdrive_index.retry import MAX_DELAY, backoff_delay


def test_exponential_backoff_caps_at_max() -> None:
    assert backoff_delay(0) == 2.0
    assert backoff_delay(1) == 4.0
    assert backoff_delay(2) == 8.0
    assert backoff_delay(10) == MAX_DELAY


def test_retry_after_header_wins_when_smaller() -> None:
    assert backoff_delay(5, retry_after=3.5) == 3.5


def test_retry_after_header_capped() -> None:
    assert backoff_delay(0, retry_after=999.0) == MAX_DELAY
