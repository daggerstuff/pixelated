"""Tests for dispatch_resume_gate PID registry and kill functions.

Verifies the PID registration and kill functionality added after the
scrutiny round-2 finding that the prior argv-substring matching could
not kill real dispatch processes.

Test cases:
    mock_pid_kills_match              -- kill_stale_dispatch kills exactly the registered PIDs
    no_pid_registry_is_clean_noop     -- kill_stale_dispatch returns [] when no PIDs registered
    register_without_redis_still_works -- register_dispatch_pid works even when Redis is unreachable
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path
from unittest import mock

from skills.monthly_llm_driver.dispatch_resume_gate import (
    _read_pids_from_disk,
    _read_pids_from_redis,
    kill_stale_dispatch,
    register_dispatch_pid,
)

# ---------------------------------------------------------------------------
# Test 1: mock_pid_kills_match
# ---------------------------------------------------------------------------


def test_mock_pid_kills_match() -> None:
    """kill_stale_dispatch must SIGTERM exactly the PIDs registered in both
    on-disk JSON and Redis SET, with no duplicates."""
    month = "2025-10-test1"
    test_pids = [12345, 67890, 11111]

    with tempfile.TemporaryDirectory() as tmpdir:
        # Mock the PID file path to use our temp directory.
        pids_file = Path(tmpdir) / f"dispatch_pids_{month}.json"
        pids_file.write_text(json.dumps(test_pids))

        # Mock the on-disk reader to return our test PIDs.
        with mock.patch(
            "skills.monthly_llm_driver.dispatch_resume_gate._read_pids_from_disk",
            return_value=test_pids,
        ):
            # Mock the Redis reader to return a subset (one duplicate, one unique).
            redis_pids = [12345, 99999]
            with mock.patch(
                "skills.monthly_llm_driver.dispatch_resume_gate._read_pids_from_redis",
                return_value=redis_pids,
            ):
                # Mock os.kill to track which PIDs were killed.
                killed_pids = []

                def mock_kill(pid: int, sig: int) -> None:
                    killed_pids.append(pid)
                    # Do not actually send SIGTERM.

                with mock.patch("os.kill", side_effect=mock_kill):
                    result = kill_stale_dispatch(month)

                # Verify: all unique PIDs from both registries were killed.
                expected_pids = set(test_pids) | set(redis_pids)
                assert set(result) == expected_pids
                assert set(killed_pids) == expected_pids
                # Verify: no duplicates.
                assert len(result) == len(expected_pids)


# ---------------------------------------------------------------------------
# Test 2: no_pid_registry_is_clean_noop
# ---------------------------------------------------------------------------


def test_no_pid_registry_is_clean_noop() -> None:
    """kill_stale_dispatch must return [] when no PIDs are registered in
    either the on-disk JSON or the Redis SET."""
    month = "2025-10-test2"

    # Mock both readers to return empty lists.
    with (
        mock.patch(
            "skills.monthly_llm_driver.dispatch_resume_gate._read_pids_from_disk",
            return_value=[],
        ),
        mock.patch(
            "skills.monthly_llm_driver.dispatch_resume_gate._read_pids_from_redis",
            return_value=[],
        ),
        mock.patch("os.kill") as mock_kill,
    ):
        # Mock os.kill to verify it is never called.
        result = kill_stale_dispatch(month)

        # Verify: no PIDs killed.
        assert result == []
        # Verify: os.kill was never called.
        mock_kill.assert_not_called()


# ---------------------------------------------------------------------------
# Test 3: register_without_redis_still_works
# ---------------------------------------------------------------------------


def test_register_without_redis_still_works() -> None:
    """register_dispatch_pid must write the PID to on-disk JSON even when
    Redis is unreachable or raises an exception."""
    month = "2025-10-test3"
    test_pid = 54321

    with tempfile.TemporaryDirectory() as tmpdir:
        # Mock the PID file path to use our temp directory.
        pids_file = Path(tmpdir) / f"dispatch_pids_{month}.json"

        # Mock _PIDS_FILE_TEMPLATE to point to our temp directory.
        with (
            mock.patch(
                "skills.monthly_llm_driver.dispatch_resume_gate._PIDS_FILE_TEMPLATE",
                str(pids_file),
            ),
            mock.patch(
                "skills.monthly_llm_driver.dispatch_resume_gate.ConnectionBundle.from_env",
                side_effect=Exception("Redis connection failed"),
            ),
        ):
            # Mock ConnectionBundle.from_env to raise an exception (Redis unreachable).
            # Call register_dispatch_pid; should not raise.
            register_dispatch_pid(month, test_pid)

            # Verify: PID was written to on-disk JSON.
            assert pids_file.exists()
            data = json.loads(pids_file.read_text())
            assert test_pid in data

            # Call register_dispatch_pid again with the same PID; should be idempotent.
            register_dispatch_pid(month, test_pid)
            data = json.loads(pids_file.read_text())
            assert data.count(test_pid) == 1

            # Call register_dispatch_pid with a different PID; should append.
            test_pid_2 = 99887
            register_dispatch_pid(month, test_pid_2)
            data = json.loads(pids_file.read_text())
            assert test_pid in data
            assert test_pid_2 in data
            assert len(data) == 2


# ---------------------------------------------------------------------------
# Test 4 (bonus): _read_pids_from_disk handles missing file
# ---------------------------------------------------------------------------


def test_read_pids_from_disk_missing_file() -> None:
    """_read_pids_from_disk must return [] when the PID file does not exist."""
    month = "2025-10-test4"

    with tempfile.TemporaryDirectory() as tmpdir:
        # Mock the PID file path to a non-existent file.
        pids_file = Path(tmpdir) / f"dispatch_pids_{month}.json"

        with mock.patch(
            "skills.monthly_llm_driver.dispatch_resume_gate._PIDS_FILE_TEMPLATE",
            str(pids_file),
        ):
            result = _read_pids_from_disk(month)
            assert result == []


# ---------------------------------------------------------------------------
# Test 5 (bonus): _read_pids_from_redis handles connection failure
# ---------------------------------------------------------------------------


def test_read_pids_from_redis_connection_failure() -> None:
    """_read_pids_from_redis must return [] when Redis is unreachable."""
    month = "2025-10-test5"

    # Mock ConnectionBundle.from_env to raise an exception.
    with mock.patch(
        "skills.monthly_llm_driver.dispatch_resume_gate.ConnectionBundle.from_env",
        side_effect=Exception("Redis connection failed"),
    ):
        result = _read_pids_from_redis(month)
        assert result == []


# ---------------------------------------------------------------------------
# Test 6 (bonus): kill_stale_dispatch handles ProcessLookupError
# ---------------------------------------------------------------------------


def test_kill_stale_dispatch_handles_process_lookup_error() -> None:
    """kill_stale_dispatch must not fail when a registered PID has already exited."""
    month = "2025-10-test6"
    test_pids = [11111, 22222]

    # Mock both readers to return test PIDs.
    with (
        mock.patch(
            "skills.monthly_llm_driver.dispatch_resume_gate._read_pids_from_disk",
            return_value=test_pids,
        ),
        mock.patch(
            "skills.monthly_llm_driver.dispatch_resume_gate._read_pids_from_redis",
            return_value=[],
        ),
    ):
        # Mock os.kill to raise ProcessLookupError for one PID.
        def mock_kill(pid: int, sig: int) -> None:
            if pid == 11111:
                raise ProcessLookupError("No such process")

        with mock.patch("os.kill", side_effect=mock_kill):
            result = kill_stale_dispatch(month)

            # Verify: only the PID that did not raise was killed.
            assert result == [22222]
