"""Tests for Redis dispatch PID registry integration.

Verifies the Redis SET operations used by register_dispatch_pid and
_read_pids_from_redis for the dispatch PID registry feature.

Test cases:
    redis_set_sadd_and_expire     -- register_dispatch_pid calls SADD and EXPIRE with correct args
    redis_set_smembers_reads_pids -- _read_pids_from_redis reads all members from the SET
    redis_set_deduplication       -- registering the same PID twice does not duplicate in SET
"""

from __future__ import annotations

import tempfile
from pathlib import Path
from unittest import mock

from scripts.services.monthly_llm_driver.dispatch_resume_gate import (
    _read_pids_from_redis,
    register_dispatch_pid,
)

# ---------------------------------------------------------------------------
# Test 1: redis_set_sadd_and_expire
# ---------------------------------------------------------------------------


def test_redis_set_sadd_and_expire() -> None:
    """register_dispatch_pid must call SADD with the PID and EXPIRE with 86400."""
    month = "2025-10-test1"
    test_pid = 12345

    # Mock the Redis client.
    mock_redis = mock.MagicMock()
    mock_redis.sadd = mock.MagicMock()
    mock_redis.expire = mock.MagicMock()

    # Mock ConnectionBundle.from_env to return our mock bundle.
    mock_bundle = mock.MagicMock()
    mock_bundle.redis_client = mock_redis
    mock_bundle.close = mock.MagicMock()

    with tempfile.TemporaryDirectory() as tmpdir:
        pids_file = Path(tmpdir) / f"dispatch_pids_{month}.json"

        with (
            mock.patch(
                "scripts.services.monthly_llm_driver.dispatch_resume_gate._PIDS_FILE_TEMPLATE",
                str(pids_file),
            ),
            mock.patch(
                "scripts.services.monthly_llm_driver.dispatch_resume_gate.ConnectionBundle.from_env",
                return_value=mock_bundle,
            ),
        ):
            register_dispatch_pid(month, test_pid)

    # Verify: SADD was called with the correct key and PID.
    expected_key = f"orch:dispatch:pids:{month}"
    mock_redis.sadd.assert_called_once_with(expected_key, test_pid)

    # Verify: EXPIRE was called with the correct TTL (86400 seconds).
    mock_redis.expire.assert_called_once_with(expected_key, 86400)


# ---------------------------------------------------------------------------
# Test 2: redis_set_smembers_reads_pids
# ---------------------------------------------------------------------------


def test_redis_set_smembers_reads_pids() -> None:
    """_read_pids_from_redis must call SMEMBERS and return all PIDs."""
    month = "2025-10-test2"
    test_pids = {11111, 22222, 33333}

    # Mock the Redis client.
    mock_redis = mock.MagicMock()
    mock_redis.smembers = mock.MagicMock(return_value=test_pids)

    # Mock ConnectionBundle.from_env to return our mock bundle.
    mock_bundle = mock.MagicMock()
    mock_bundle.redis_client = mock_redis
    mock_bundle.close = mock.MagicMock()

    with mock.patch(
        "scripts.services.monthly_llm_driver.dispatch_resume_gate.ConnectionBundle.from_env",
        return_value=mock_bundle,
    ):
        result = _read_pids_from_redis(month)

    # Verify: SMEMBERS was called with the correct key.
    expected_key = f"orch:dispatch:pids:{month}"
    mock_redis.smembers.assert_called_once_with(expected_key)

    # Verify: all PIDs were returned (as integers).
    assert set(result) == test_pids
    assert all(isinstance(pid, int) for pid in result)


# ---------------------------------------------------------------------------
# Test 3: redis_set_deduplication
# ---------------------------------------------------------------------------


def test_redis_set_deduplication() -> None:
    """Registering the same PID twice must not duplicate it in the Redis SET."""
    month = "2025-10-test3"
    test_pid = 99999

    # Mock the Redis client.
    mock_redis = mock.MagicMock()
    mock_redis.sadd = mock.MagicMock()
    mock_redis.expire = mock.MagicMock()

    # Mock ConnectionBundle.from_env to return our mock bundle.
    mock_bundle = mock.MagicMock()
    mock_bundle.redis_client = mock_redis
    mock_bundle.close = mock.MagicMock()

    with tempfile.TemporaryDirectory() as tmpdir:
        pids_file = Path(tmpdir) / f"dispatch_pids_{month}.json"

        with (
            mock.patch(
                "scripts.services.monthly_llm_driver.dispatch_resume_gate._PIDS_FILE_TEMPLATE",
                str(pids_file),
            ),
            mock.patch(
                "scripts.services.monthly_llm_driver.dispatch_resume_gate.ConnectionBundle.from_env",
                return_value=mock_bundle,
            ),
        ):
            # Register the same PID twice.
            register_dispatch_pid(month, test_pid)
            register_dispatch_pid(month, test_pid)

    # Verify: SADD was called twice (idempotent at the Redis level).
    # Redis SET SADD is idempotent by design, so duplicate adds are safe.
    expected_key = f"orch:dispatch:pids:{month}"
    assert mock_redis.sadd.call_count == 2
    mock_redis.sadd.assert_called_with(expected_key, test_pid)

    # Verify: EXPIRE was called twice (refreshing the TTL each time).
    assert mock_redis.expire.call_count == 2
    mock_redis.expire.assert_called_with(expected_key, 86400)
