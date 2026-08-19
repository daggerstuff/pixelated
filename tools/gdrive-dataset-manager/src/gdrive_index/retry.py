from __future__ import annotations

import functools
import logging
import time
from collections.abc import Callable

from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 6
BASE_DELAY = 2.0
MAX_DELAY = 60.0
RETRYABLE_STATUSES = frozenset({429, 500, 502, 503})


def backoff_delay(attempt: int, retry_after: float | None = None) -> float:
    if retry_after is not None:
        return min(retry_after, MAX_DELAY)
    return min(BASE_DELAY * 2**attempt, MAX_DELAY)


def with_retry[T](fn: Callable[..., T]) -> Callable[..., T]:
    """Retry on transient Google API errors (429/5xx) with exponential backoff."""

    @functools.wraps(fn)
    def wrapper(*args: object, **kwargs: object) -> T:
        attempt = 0
        while True:
            try:
                return fn(*args, **kwargs)
            except HttpError as exc:
                status = exc.resp.status
                if status not in RETRYABLE_STATUSES or attempt >= MAX_ATTEMPTS - 1:
                    raise
                retry_after_raw = exc.resp.get("retry-after")
                retry_after = float(retry_after_raw) if retry_after_raw else None
                delay = backoff_delay(attempt, retry_after)
                logger.warning("HTTP %s on attempt %d; retrying in %.1fs", status, attempt + 1, delay)
                time.sleep(delay)
                attempt += 1

    return wrapper
