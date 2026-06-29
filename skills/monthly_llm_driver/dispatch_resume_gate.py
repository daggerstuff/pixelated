"""Dispatch Resume Gate — infrastructure hardening after M02 attempt-1 silent
mid-dispatch failure (2026-06-28T23:00Z, worker session
9b86edcc-6cfa-48bc-9e44-14442e8abf3c, dispatch PID 1295219).

Four callables:
    scan(month, chunks_dir) -> ResumeGateReport
    register_dispatch_pid(month, pid) -> None
    kill_stale_dispatch(month)
    heartbeat_age_seconds(heartbeat_path) -> Optional[float]

The ``register_dispatch_pid`` callable writes the dispatch PID to both
on-disk (``/tmp/wayfarer_smoke/dispatch_pids_<month>.json``) and to a
Redis SET (``orch:dispatch:pids:<month>``) with NX-EX 86400 TTL. The
``kill_stale_dispatch`` callable reads both registries and SIGTERMs
each PID exactly, replacing the prior argv-substring matching.

See library/dispatch_resume_gate.md for the worked M02 example and
AGENTS.md § Dispatch Resume Gate (mandatory) for the worker contract.
"""

from __future__ import annotations

import contextlib
import json
import os
import re
import signal
import time
from dataclasses import dataclass, field
from pathlib import Path

from skills.monthly_llm_driver.orch_db import ConnectionBundle

# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------


@dataclass
class ResumeGateReport:
    """Result of scanning a chunks directory for a given month."""

    month: str
    n_chunks_expected: int
    ok: list[int] = field(default_factory=list)
    ok_empty: list[int] = field(default_factory=list)
    partial: list[int] = field(default_factory=list)
    missing: list[int] = field(default_factory=list)

    @property
    def missing_or_partial_count(self) -> int:
        return len(self.missing) + len(self.partial)

    def to_dict(self) -> dict:
        return {
            "month": self.month,
            "n_chunks_expected": self.n_chunks_expected,
            "ok": sorted(self.ok),
            "ok_empty": sorted(self.ok_empty),
            "partial": sorted(self.partial),
            "missing": sorted(self.missing),
            "missing_or_partial_count": self.missing_or_partial_count,
        }


# ---------------------------------------------------------------------------
# (A1) scan
# ---------------------------------------------------------------------------

_CHUNK_RE_TEMPLATE = r"^{month}_chunk_(\d+)_.*\.json$"


_MONTH_CHUNK_OVERRIDES: dict[str, int] = {
    "2025-09": 23,  # M01: 23 chunks (700 emails / 680 chats at chunk_size=30)
    "2025-10": 27,  # M02: 27 chunks (650 emails / 800 chats at chunk_size=30)
}


def _expected_chunk_count(chunks_dir: Path, month: str) -> int:
    """Derive expected chunk count:
    1. From a known per-month override table (populated from dispatch logs).
    2. From {month}_manifest.json if present.
    3. From the highest chunk index found on disk.
    """
    if month in _MONTH_CHUNK_OVERRIDES:
        return _MONTH_CHUNK_OVERRIDES[month]

    manifest_path = chunks_dir / f"{month}_manifest.json"
    if manifest_path.exists():
        try:
            man = json.loads(manifest_path.read_text())
            return int(man.get("n_chunks", 0))
        except Exception:
            pass

    # Fallback: scan disk for highest chunk index
    pattern = re.compile(_CHUNK_RE_TEMPLATE.format(month=re.escape(month)))
    indices = []
    for p in chunks_dir.iterdir():
        m = pattern.match(p.name)
        if m:
            indices.append(int(m.group(1)))
    if indices:
        return max(indices)
    return 0


def _classify_chunk_doc(status: str, emails: list, chat_bursts: list) -> str:
    """Classify a chunk document (from Mongo or flat file) into one of
    'ok', 'ok_empty', or 'partial'.

    Rules:
    - 'partial'  : status == 'partial'.
    - 'ok'       : status == 'ok' AND at least one of emails / chat_bursts
                   arrays is non-empty.
    - 'ok_empty' : status == 'ok' BUT both emails and chat_bursts are empty.
    - 'partial'  : any other status (defensive fallback).
    """
    has_records = len(emails) > 0 or len(chat_bursts) > 0
    if status == "partial":
        return "partial"
    if status == "ok" and has_records:
        return "ok"
    if status == "ok" and not has_records:
        return "ok_empty"
    # Defensive: treat unknown status as partial so it surfaces for review.
    return "partial"


def _scan_from_mongo(month: str, n_expected: int) -> ResumeGateReport | None:
    """Read chunk state from Mongo ``dispatch_chunks`` collection.

    Returns a ResumeGateReport if Mongo has any documents for this month,
    otherwise returns None (caller should fall back to flat files).

    Raises only on unexpected Mongo errors; connection failures are
    swallowed (returns None) so the caller can fall back.
    """
    try:
        bundle = ConnectionBundle.from_env()
    except Exception:
        # Mongo URL unset or connection failed; fall back to flat files.
        return None

    try:
        coll = bundle.mongo_db["dispatch_chunks"]
        # Check if Mongo has ANY documents for this month.
        doc_count = coll.count_documents({"month": month})
        if doc_count == 0:
            # Mongo has no data for this month; fall back to flat files.
            return None

        # Fetch all documents for this month.
        docs = list(coll.find({"month": month}))

        report = ResumeGateReport(month=month, n_chunks_expected=n_expected)

        # Build a set of chunk indices found in Mongo.
        found_indices: set[int] = set()
        for doc in docs:
            idx = int(doc.get("chunk_index", 0))
            if idx < 1 or idx > n_expected:
                continue
            found_indices.add(idx)

            status = doc.get("status", "")
            emails = doc.get("emails", [])
            chat_bursts = doc.get("chat_bursts", [])
            classification = _classify_chunk_doc(status, emails, chat_bursts)

            if classification == "ok":
                report.ok.append(idx)
            elif classification == "ok_empty":
                report.ok_empty.append(idx)
            else:
                report.partial.append(idx)

        # Mark missing chunks.
        for idx in range(1, n_expected + 1):
            if idx not in found_indices:
                report.missing.append(idx)

        return report
    except Exception:
        # Unexpected Mongo error; fall back to flat files.
        return None
    finally:
        with contextlib.suppress(Exception):
            bundle.close()


def _scan_from_flat_files(month: str, chunks_dir: Path, n_expected: int) -> ResumeGateReport:
    """Read chunk state from flat ``/tmp/wayfarer_smoke/chunks/*.json`` files.

    This is the fallback path used when Mongo is unavailable or has no
    documents for the target month.
    """
    chunks_dir = Path(chunks_dir)
    pattern = re.compile(_CHUNK_RE_TEMPLATE.format(month=re.escape(month)))

    # Collect files on disk, keyed by chunk index.
    found: dict[int, Path] = {}
    for p in chunks_dir.iterdir():
        m = pattern.match(p.name)
        if m:
            idx = int(m.group(1))
            found[idx] = p

    report = ResumeGateReport(month=month, n_chunks_expected=n_expected)

    for idx in range(1, n_expected + 1):
        if idx not in found:
            report.missing.append(idx)
            continue

        try:
            data = json.loads(found[idx].read_text())
        except Exception:
            report.partial.append(idx)
            continue

        status = data.get("status", "")
        emails = data.get("emails", [])
        chat_bursts = data.get("chat_bursts", [])
        classification = _classify_chunk_doc(status, emails, chat_bursts)

        if classification == "ok":
            report.ok.append(idx)
        elif classification == "ok_empty":
            report.ok_empty.append(idx)
        else:
            report.partial.append(idx)

    return report


def scan(month: str, chunks_dir: Path) -> ResumeGateReport:
    """Classify every chunk for *month* using a Mongo-first strategy.

    **Primary source:** Mongo ``dispatch_chunks.find({month: month})``.
    If Mongo has any documents for this month, the report is built from
    Mongo and flat files are ignored.

    **Fallback:** Flat ``/tmp/wayfarer_smoke/chunks/<month>_chunk_*.json``
    files are read ONLY when:
    - ``MONGO_URL`` is unset (``ConnectionBundle.from_env()`` raises), OR
    - Mongo has zero documents for this month.

    This avoids the race condition where a worker reads stale on-disk
    state after a previous dispatch attempt cleaned up ``/tmp`` files.

    Classification rules:
    - 'ok'        : status='ok' AND at least one of emails / chat_bursts
                    arrays is non-empty.
    - 'ok_empty'  : status='ok' BUT both emails and chat_bursts arrays
                    are empty (content_len may be >0 but the JSON
                    recovery yielded 0 parseable records).
    - 'partial'   : status='partial' (or unknown status).
    - 'missing'   : chunk index in [1..n_chunks_expected] with no document.

    The expected set size is read from {month}_manifest.json if present,
    otherwise inferred from the highest chunk index on disk.
    """
    chunks_dir = Path(chunks_dir)
    n_expected = _expected_chunk_count(chunks_dir, month)

    # Try Mongo first.
    mongo_report = _scan_from_mongo(month, n_expected)
    if mongo_report is not None:
        return mongo_report

    # Fall back to flat files.
    return _scan_from_flat_files(month, chunks_dir, n_expected)


# ---------------------------------------------------------------------------
# (A2) register_dispatch_pid + kill_stale_dispatch
# ---------------------------------------------------------------------------

_PIDS_FILE_TEMPLATE = "/tmp/wayfarer_smoke/dispatch_pids_{month}.json"
_KILLS_LOG = Path("/tmp/dispatch_resume_gate_kills.log")


def register_dispatch_pid(month: str, pid: int) -> None:
    """Register a dispatch PID in both on-disk JSON and Redis SET.

    On-disk: writes PID to ``/tmp/wayfarer_smoke/dispatch_pids_<month>.json``
    (a JSON array of PIDs).  The file is created if it does not exist.

    Redis: adds PID to SET ``orch:dispatch:pids:<month>`` with NX-EX 86400
    (24-hour TTL, set only if the key does not already exist).

    Idempotent: adding the same PID twice is safe.
    """
    # -- On-disk registry --------------------------------------------------
    pids_file = Path(_PIDS_FILE_TEMPLATE.format(month=month))
    pids_file.parent.mkdir(parents=True, exist_ok=True)

    existing_pids: list[int] = []
    if pids_file.exists():
        try:
            existing_pids = json.loads(pids_file.read_text())
            if not isinstance(existing_pids, list):
                existing_pids = []
        except Exception:
            existing_pids = []

    if pid not in existing_pids:
        existing_pids.append(pid)
        pids_file.write_text(json.dumps(existing_pids, indent=2))

    # -- Redis registry (best-effort; do not fail if Redis is unreachable) --
    with contextlib.suppress(Exception):
        bundle = ConnectionBundle.from_env()
        try:
            redis_key = f"orch:dispatch:pids:{month}"
            bundle.redis_client.sadd(redis_key, pid)
            # Set TTL to 86400 seconds (24 hours) if the key was just created
            # (NX semantics).  If the key already existed, we still refresh the
            # TTL to ensure it does not expire mid-dispatch.
            bundle.redis_client.expire(redis_key, 86400)
        finally:
            bundle.close()


def _read_pids_from_disk(month: str) -> list[int]:
    """Read dispatch PIDs from the on-disk JSON registry."""
    pids_file = Path(_PIDS_FILE_TEMPLATE.format(month=month))
    if not pids_file.exists():
        return []
    try:
        data = json.loads(pids_file.read_text())
        if isinstance(data, list):
            return [int(p) for p in data if isinstance(p, (int, float, str))]
    except Exception:
        pass
    return []


def _read_pids_from_redis(month: str) -> list[int]:
    """Read dispatch PIDs from the Redis SET (best-effort)."""
    pids: list[int] = []
    with contextlib.suppress(Exception):
        bundle = ConnectionBundle.from_env()
        try:
            redis_key = f"orch:dispatch:pids:{month}"
            members = bundle.redis_client.smembers(redis_key)
            pids = [int(m) for m in members if m is not None]
        finally:
            bundle.close()
    return pids


def kill_stale_dispatch(month: str) -> list[int]:
    """SIGTERM every PID registered for this month in both the on-disk
    JSON registry and the Redis SET.

    Implementation: reads PIDs from both registries, deduplicates, and
    sends SIGTERM to each PID exactly once.  This replaces the prior
    argv-substring matching (which could not kill real dispatch processes
    because the heartbeat path is set via HEARTBEAT_PATH env var and never
    appears on the dispatch argv).

    Logs each kill to ``/tmp/dispatch_resume_gate_kills.log`` with
    pid + epoch + source (disk|redis|both).

    Returns list of PIDs killed.  Idempotent: returns [] if no PIDs are
    registered or if all registered PIDs have already exited.
    """
    killed: list[int] = []
    now_epoch = int(time.time())

    # Read PIDs from both registries.
    disk_pids = set(_read_pids_from_disk(month))
    redis_pids = set(_read_pids_from_redis(month))

    # Union of both sets.
    all_pids = disk_pids | redis_pids

    for pid in all_pids:
        # Determine source for logging.
        if pid in disk_pids and pid in redis_pids:
            source = "both"
        elif pid in disk_pids:
            source = "disk"
        else:
            source = "redis"

        try:
            os.kill(pid, signal.SIGTERM)
            killed.append(pid)
            log_line = f"pid={pid} epoch={now_epoch} source={source}\n"
            with open(_KILLS_LOG, "a") as fh:
                fh.write(log_line)
        except ProcessLookupError:
            # PID already exited; not an error.
            pass
        except PermissionError:
            # Cannot kill this PID; skip.
            pass

    return killed


# ---------------------------------------------------------------------------
# (A3) heartbeat_age_seconds
# ---------------------------------------------------------------------------


def heartbeat_age_seconds(heartbeat_path: Path) -> float | None:
    """Read the heartbeat JSON and return the age in seconds
    (now - last_heartbeat_at) if the heartbeat file mtime differs from
    the most recent successful chunk write's mtime (indicating the
    dispatch process has died).

    Returns None when the heartbeat mtime matches the most recent chunk
    file mtime, indicating the dispatch may still be alive.

    The heartbeat JSON is expected to contain a ``now_epoch`` field
    (written by the dispatch loop's heartbeat writer).
    """
    heartbeat_path = Path(heartbeat_path)
    if not heartbeat_path.exists():
        return None

    try:
        hb_data = json.loads(heartbeat_path.read_text())
    except Exception:
        return None

    last_heartbeat_at = hb_data.get("now_epoch")
    if last_heartbeat_at is None:
        return None

    # Find the most recent chunk file for the same month.
    # The heartbeat file lives in /tmp/wayfarer_smoke/ and chunks are
    # in /tmp/wayfarer_smoke/chunks/.  We use the heartbeat_path's
    # parent's chunks/ sibling directory.
    chunks_dir = heartbeat_path.parent / "chunks"
    most_recent_chunk_mtime: float | None = None
    if chunks_dir.exists():
        # Find the most recent chunk file by mtime
        chunk_files = sorted(
            chunks_dir.glob("*_chunk_*.json"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        if chunk_files:
            most_recent_chunk_mtime = chunk_files[0].stat().st_mtime

    heartbeat_mtime = heartbeat_path.stat().st_mtime

    # Compare mtimes with 2-second tolerance (filesystem granularity)
    if most_recent_chunk_mtime is not None and abs(heartbeat_mtime - most_recent_chunk_mtime) <= 2.0:
        # Heartbeat and most-recent chunk were written at the same time
        # — dispatch may still be alive
        return None

    # Heartbeat is stale relative to the most recent chunk write
    # (or dispatch died after the last chunk write, or no chunks exist)
    return time.time() - float(last_heartbeat_at)
