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
import os
import re
import tempfile
import time
from pathlib import Path
from unittest import mock

from scripts.services.monthly_llm_driver.dispatch_resume_gate import (
    _read_pids_from_disk,
    _read_pids_from_redis,
    heartbeat_age_seconds,
    kill_stale_dispatch,
    register_dispatch_pid,
    scan,
)
from scripts.services.monthly_llm_driver.orch_db import ConnectionBundle

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
            "scripts.services.monthly_llm_driver.dispatch_resume_gate._read_pids_from_disk",
            return_value=test_pids,
        ):
            # Mock the Redis reader to return a subset (one duplicate, one unique).
            redis_pids = [12345, 99999]
            with mock.patch(
                "scripts.services.monthly_llm_driver.dispatch_resume_gate._read_pids_from_redis",
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
            "scripts.services.monthly_llm_driver.dispatch_resume_gate._read_pids_from_disk",
            return_value=[],
        ),
        mock.patch(
            "scripts.services.monthly_llm_driver.dispatch_resume_gate._read_pids_from_redis",
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
                "scripts.services.monthly_llm_driver.dispatch_resume_gate._PIDS_FILE_TEMPLATE",
                str(pids_file),
            ),
            mock.patch(
                "scripts.services.monthly_llm_driver.dispatch_resume_gate.ConnectionBundle.from_env",
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
            "scripts.services.monthly_llm_driver.dispatch_resume_gate._PIDS_FILE_TEMPLATE",
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
        "scripts.services.monthly_llm_driver.dispatch_resume_gate.ConnectionBundle.from_env",
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
            "scripts.services.monthly_llm_driver.dispatch_resume_gate._read_pids_from_disk",
            return_value=test_pids,
        ),
        mock.patch(
            "scripts.services.monthly_llm_driver.dispatch_resume_gate._read_pids_from_redis",
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


# ---------------------------------------------------------------------------
# Test 7: scan() Mongo-first when both sources populated
# ---------------------------------------------------------------------------


def test_scan_mongo_first_when_both_populated() -> None:
    """scan() must use Mongo as primary source when both Mongo and flat files
    contain data for the same month."""
    month = "2025-11"  # Use a month not in _MONTH_CHUNK_OVERRIDES to test dynamic detection

    # Create a temporary directory with flat files
    with tempfile.TemporaryDirectory() as tmpdir:
        chunks_dir = Path(tmpdir)

        # Create flat files for chunks 1-3 with status='ok'
        for i in [1, 2, 3]:
            chunk_file = chunks_dir / f"{month}_chunk_{i:02d}_wayfarer.json"
            chunk_data = {
                "chunk_index": i,
                "transport": "wayfarer",
                "status": "ok",
                "emails": [{"id": f"email-{i}"}],
                "chat_bursts": [{"id": f"chat-{i}"}],
            }
            chunk_file.write_text(json.dumps(chunk_data))

        # Mock ConnectionBundle to return a mock MongoDB client
        mock_mongo_db = mock.MagicMock()
        mock_collection = mock.MagicMock()
        mock_mongo_db.__getitem__ = mock.MagicMock(return_value=mock_collection)

        # Mock the find() result to return chunks 1-2 with status='ok'
        # Note: Mongo has chunk 2 as 'ok_empty' to test that we use Mongo, not flat files
        mock_docs = [
            {"chunk_index": 1, "status": "ok", "emails": [{"id": "email-1"}], "chat_bursts": [{"id": "chat-1"}]},
            {"chunk_index": 2, "status": "ok", "emails": [], "chat_bursts": []},  # ok_empty
        ]
        mock_collection.find.return_value = mock_docs

        # Mock count_documents to return 2 (Mongo has data)
        mock_collection.count_documents.return_value = 2

        mock_bundle = mock.MagicMock(spec=ConnectionBundle)
        mock_bundle.mongo_db = mock_mongo_db
        mock_bundle.__enter__ = mock.MagicMock(return_value=mock_bundle)
        mock_bundle.__exit__ = mock.MagicMock(return_value=None)

        # Patch ConnectionBundle.from_env to return our mock
        with mock.patch(
            "scripts.services.monthly_llm_driver.dispatch_resume_gate.ConnectionBundle.from_env",
            return_value=mock_bundle,
        ):
            result = scan(month, chunks_dir)

            # Verify: scan used Mongo (2 documents), not flat files (3 documents)
            assert result is not None
            assert result.month == month
            # n_chunks_expected is derived from the highest chunk_index in flat files (3)
            # when the month is not in _MONTH_CHUNK_OVERRIDES
            assert result.n_chunks_expected == 3

            # Chunk 1: ok (from Mongo)
            assert 1 in result.ok

            # Chunk 2: ok_empty (from Mongo, even though flat file says ok)
            assert 2 in result.ok_empty

            # Chunk 3: missing (not in Mongo, even though flat file exists)
            assert 3 in result.missing

            # Verify no partial chunks (all handled correctly)
            assert len(result.partial) == 0

            # Verify totals
            assert len(result.ok) == 1
            assert len(result.ok_empty) == 1
            assert len(result.missing) == 1

            # Verify Mongo was queried
            mock_collection.count_documents.assert_called_once_with({"month": month})
            mock_collection.find.assert_called_once_with({"month": month})


# ---------------------------------------------------------------------------
# Test 8: registry_empty log line when both registries are empty
# ---------------------------------------------------------------------------


def test_writes_registry_empty_log_line() -> None:
    """kill_stale_dispatch must write a registry_empty log line to
    /tmp/dispatch_resume_gate_kills.log when both registries are empty."""
    month = "2025-10-test8"

    with tempfile.TemporaryDirectory() as tmpdir:
        kills_log = Path(tmpdir) / "dispatch_resume_gate_kills.log"

        with (
            mock.patch(
                "scripts.services.monthly_llm_driver.dispatch_resume_gate._read_pids_from_disk",
                return_value=[],
            ),
            mock.patch(
                "scripts.services.monthly_llm_driver.dispatch_resume_gate._read_pids_from_redis",
                return_value=[],
            ),
            mock.patch(
                "scripts.services.monthly_llm_driver.dispatch_resume_gate._ps_find_dispatch_processes",
                return_value=[],
            ),
            mock.patch(
                "scripts.services.monthly_llm_driver.dispatch_resume_gate._KILLS_LOG",
                kills_log,
            ),
        ):
            result = kill_stale_dispatch(month)

            # Verify: no PIDs killed.
            assert result == []

            # Verify: log file was created with registry_empty line.
            assert kills_log.exists()
            log_content = kills_log.read_text()
            assert "registry_empty" in log_content
            assert "level=warn" in log_content
            assert f"month={month}" in log_content
            # Verify timestamp format is present (ISO 8601).
            assert re.search(r"\[\d{4}-\d{2}-\d{2}T", log_content)


# ---------------------------------------------------------------------------
# Test 9: registry_empty_but_ps_alive when ps -ef finds dispatch processes
# ---------------------------------------------------------------------------


def test_warns_when_ps_alive_but_registry_empty() -> None:
    """kill_stale_dispatch must write registry_empty_but_ps_alive log lines
    when both registries are empty AND ps -ef finds python processes matching
    dispatch_<month> argv pattern."""
    month = "2025-10-test9"
    fake_pid = 123456
    fake_argv = (
        "/usr/bin/python /home/vivi/pixelated/scripts/services/monthly_llm_driver/dispatch_2025-10.py 2025-10 650 800"
    )

    with tempfile.TemporaryDirectory() as tmpdir:
        kills_log = Path(tmpdir) / "dispatch_resume_gate_kills.log"

        with (
            mock.patch(
                "scripts.services.monthly_llm_driver.dispatch_resume_gate._read_pids_from_disk",
                return_value=[],
            ),
            mock.patch(
                "scripts.services.monthly_llm_driver.dispatch_resume_gate._read_pids_from_redis",
                return_value=[],
            ),
            mock.patch(
                "scripts.services.monthly_llm_driver.dispatch_resume_gate._ps_find_dispatch_processes",
                return_value=[(fake_pid, fake_argv[:120])],
            ),
            mock.patch(
                "scripts.services.monthly_llm_driver.dispatch_resume_gate._KILLS_LOG",
                kills_log,
            ),
        ):
            result = kill_stale_dispatch(month)

            # Verify: no PIDs killed (we only warn, not kill).
            assert result == []

            # Verify: log file contains registry_empty_but_ps_alive line.
            assert kills_log.exists()
            log_content = kills_log.read_text()
            assert "registry_empty_but_ps_alive" in log_content
            assert f"pid={fake_pid}" in log_content
            assert "dispatch_2025-10" in log_content

            # Verify: registry_empty line is ALSO present (always written).
            assert "registry_empty" in log_content
            assert "level=warn" in log_content


# ---------------------------------------------------------------------------
# Test 10: test_stall_when_heartbeat_alive_but_bytes_zero
# ---------------------------------------------------------------------------


def test_stall_when_heartbeat_alive_but_bytes_zero() -> None:
    """heartbeat_age_seconds must detect stall when heartbeat writer is alive
    (writing timestamps) but chunk completion thread has stalled (zero bytes emitted).

    This is Chaos Monkey #6a source-fix #8: the writer thread can keep the
    heartbeat fresh while the actual chunk processing stalls. The triage dict
    must report state='stalled' when:
    - heartbeat_age > STREAM_CHUNK_IDLE_S (default 90s)
    - content_chars (bytes emitted) < expected_chunk_size (5300 chars)
    - no terminal tag set (stream not completed/failed)
    """
    month = "2025-10-test10"

    with tempfile.TemporaryDirectory() as tmpdir:
        heartbeat_file = Path(tmpdir) / f"heartbeat_{month}.json"
        chunks_dir = Path(tmpdir) / "chunks"
        chunks_dir.mkdir(parents=True, exist_ok=True)

        # Create a heartbeat file with:
        # - now_epoch = 120 seconds ago (stale, > STREAM_CHUNK_IDLE_S=90)
        # - content_chars = 0 (zero bytes emitted — stall condition)
        # - chunk_idx = 15 (mid-dispatch)
        # - NO terminal tag (stream not completed)
        stale_epoch = int(time.time()) - 120
        heartbeat_data = {
            "now_epoch": stale_epoch,
            "content_chars": 0,
            "chunk_idx": 15,
            "elapsed_s": 120.0,
            "feature_id": "test-feature",
            "transport": "wayfarer",
            "model": "LatitudeGames/Wayfarer-2-12B-GGUF:IQ4_XS",
            "pid": 123456,
        }
        heartbeat_file.write_text(json.dumps(heartbeat_data))

        # Create a chunk file with old mtime (so heartbeat appears stale)
        chunk_file = chunks_dir / f"{month}_chunk_15_wayfarer.json"
        chunk_data = {
            "chunk_index": 15,
            "status": "partial",
            "emails": [],
            "chat_bursts": [],
        }
        chunk_file.write_text(json.dumps(chunk_data))
        # Set chunk mtime to 150 seconds ago (older than heartbeat)
        old_mtime = time.time() - 150
        os.utime(chunk_file, (old_mtime, old_mtime))

        # Call heartbeat_age_seconds
        result = heartbeat_age_seconds(heartbeat_file)

        # Verify: result is a dict with the expected keys
        assert isinstance(result, dict)
        assert "heartbeat_age_seconds" in result
        assert "bytes_age_ratio" in result
        assert "state" in result

        # Verify: state is 'stalled' (age > 90s AND bytes=0 AND no terminal)
        assert result["state"] == "stalled"

        # Verify: heartbeat_age_seconds is approximately 120 seconds
        assert result["heartbeat_age_seconds"] is not None
        assert 115 <= result["heartbeat_age_seconds"] <= 125  # allow 5s tolerance

        # Verify: bytes_age_ratio is 0.0 (0 bytes / 5300 expected)
        assert result["bytes_age_ratio"] == 0.0


# ---------------------------------------------------------------------------
# Test 11: test_terminal_tag_returns_dead_state
# ---------------------------------------------------------------------------


def test_terminal_tag_returns_dead_state() -> None:
    """heartbeat_age_seconds must return state='terminal' when heartbeat has
    a terminal tag set, regardless of heartbeat age or byte count.

    Terminal tags are written when the stream completes (successfully or with
    an error like stream_hard_timeout, stream_content_stall, etc.). The triage
    dict must report state='terminal' so the worker can dispatch on it.
    """
    month = "2025-10-test11"

    with tempfile.TemporaryDirectory() as tmpdir:
        heartbeat_file = Path(tmpdir) / f"heartbeat_{month}.json"
        chunks_dir = Path(tmpdir) / "chunks"
        chunks_dir.mkdir(parents=True, exist_ok=True)

        # Create a heartbeat file with:
        # - now_epoch = 5 seconds ago (fresh)
        # - content_chars = 5300 (chunk completed)
        # - terminal = "stream_hard_timeout" (stream failed)
        recent_epoch = int(time.time()) - 5
        heartbeat_data = {
            "now_epoch": recent_epoch,
            "content_chars": 5300,
            "chunk_idx": 15,
            "elapsed_s": 1100.0,
            "feature_id": "test-feature",
            "transport": "wayfarer",
            "model": "LatitudeGames/Wayfarer-2-12B-GGUF:IQ4_XS",
            "pid": 123456,
            "terminal": "stream_hard_timeout",
        }
        heartbeat_file.write_text(json.dumps(heartbeat_data))

        # Create a chunk file with recent mtime
        chunk_file = chunks_dir / f"{month}_chunk_15_wayfarer.json"
        chunk_data = {
            "chunk_index": 15,
            "status": "partial",
            "emails": [],
            "chat_bursts": [],
        }
        chunk_file.write_text(json.dumps(chunk_data))
        os.utime(chunk_file, (time.time(), time.time()))

        # Call heartbeat_age_seconds
        result = heartbeat_age_seconds(heartbeat_file)

        # Verify: result is a dict with the expected keys
        assert isinstance(result, dict)
        assert "heartbeat_age_seconds" in result
        assert "bytes_age_ratio" in result
        assert "state" in result

        # Verify: state is 'terminal' (terminal tag is set)
        assert result["state"] == "terminal"

        # Verify: heartbeat_age_seconds is approximately 5 seconds
        assert result["heartbeat_age_seconds"] is not None
        assert 0 <= result["heartbeat_age_seconds"] <= 10  # allow 10s tolerance

        # Verify: bytes_age_ratio is 0.0 (terminal state, no ongoing progress)
        assert result["bytes_age_ratio"] == 0.0
