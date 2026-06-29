"""Dispatch Resume Gate — infrastructure hardening after M02 attempt-1 silent
mid-dispatch failure (2026-06-28T23:00Z, worker session
9b86edcc-6cfa-48bc-9e44-14442e8abf3c, dispatch PID 1295219).

Three callables:
    scan(month, chunks_dir) -> ResumeGateReport
    kill_stale_dispatch(month)
    heartbeat_age_seconds(heartbeat_path) -> Optional[float]

See library/dispatch_resume_gate.md for the worked M02 example and
AGENTS.md § Dispatch Resume Gate (mandatory) for the worker contract.
"""

from __future__ import annotations

import json
import os
import re
import signal
import subprocess
import time
from dataclasses import dataclass, field
from pathlib import Path

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


def scan(month: str, chunks_dir: Path) -> ResumeGateReport:
    """Pure function: classify every chunk in *chunks_dir* for *month*.

    Classification rules:
    - 'ok'        : file exists, status='ok', AND at least one of
                    emails / chat_bursts arrays is non-empty.
    - 'ok_empty'  : file exists, status='ok', BUT both emails and
                    chat_bursts arrays are empty (content_len may be >0
                    but the JSON recovery yielded 0 parseable records).
    - 'partial'   : file exists, status='partial'.
    - 'missing'   : chunk index in [1..n_chunks_expected] with no file.

    The expected set size is read from {month}_manifest.json if present,
    otherwise inferred from the highest chunk index on disk.
    """
    chunks_dir = Path(chunks_dir)
    n_expected = _expected_chunk_count(chunks_dir, month)
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
        has_records = len(emails) > 0 or len(chat_bursts) > 0

        if status == "partial":
            report.partial.append(idx)
        elif status == "ok" and has_records:
            report.ok.append(idx)
        else:
            # status='ok' but 0 records parsed, or any other edge case
            report.ok_empty.append(idx)

    return report


# ---------------------------------------------------------------------------
# (A2) kill_stale_dispatch
# ---------------------------------------------------------------------------

_KILLS_LOG = Path("/tmp/dispatch_resume_gate_kills.log")


def kill_stale_dispatch(month: str) -> list[int]:
    """Find and SIGTERM any python process whose argv contains
    ``/tmp/wayfarer_smoke/chunks/{month}_heartbeat.json``.

    Implementation: runs ``ps -ef`` and greps for ``dispatch_{month}``
    in the command line, then filters to python processes whose full
    argv includes the heartbeat path for this month.

    Logs each kill to ``/tmp/dispatch_resume_gate_kills.log`` with
    pid + epoch + matched_argv.

    Returns list of PIDs killed.  Idempotent: returns [] if no match.
    """
    killed: list[int] = []
    heartbeat_marker = f"/tmp/wayfarer_smoke/chunks/{month}_heartbeat"
    dispatch_marker = f"dispatch_{month}"

    try:
        result = subprocess.run(
            ["ps", "-ef"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        lines = result.stdout.splitlines()
    except Exception:
        return killed

    now_epoch = int(time.time())

    for line in lines:
        # Skip the grep process itself and header lines
        if "grep" in line.split():
            continue
        # Must match dispatch_<month> somewhere in argv
        if dispatch_marker not in line:
            continue
        # Must be a python process
        parts = line.split()
        if len(parts) < 8:
            continue
        # ps -ef columns: UID PID PPID C STIME TTY TIME CMD...
        try:
            pid = int(parts[1])
        except (ValueError, IndexError):
            continue
        cmd = " ".join(parts[7:])
        # Must reference the heartbeat path for this month
        if heartbeat_marker not in cmd:
            continue
        # Must be a python process
        if "python" not in cmd.lower():
            continue

        try:
            os.kill(pid, signal.SIGTERM)
            killed.append(pid)
            log_line = f"pid={pid} epoch={now_epoch} matched_argv={cmd!r}\n"
            with open(_KILLS_LOG, "a") as fh:
                fh.write(log_line)
        except ProcessLookupError:
            pass
        except PermissionError:
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
    if not chunks_dir.exists():
        # No chunks directory at all — heartbeat is stale by definition
        return time.time() - float(last_heartbeat_at)

    # Find the most recent chunk file by mtime
    chunk_files = sorted(
        chunks_dir.glob("*_chunk_*.json"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not chunk_files:
        return time.time() - float(last_heartbeat_at)

    most_recent_chunk_mtime = chunk_files[0].stat().st_mtime
    heartbeat_mtime = heartbeat_path.stat().st_mtime

    # Compare mtimes with 2-second tolerance (filesystem granularity)
    if abs(heartbeat_mtime - most_recent_chunk_mtime) <= 2.0:
        # Heartbeat and most-recent chunk were written at the same time
        # — dispatch may still be alive
        return None

    # Heartbeat is stale relative to the most recent chunk write
    # (or dispatch died after the last chunk write)
    return time.time() - float(last_heartbeat_at)
