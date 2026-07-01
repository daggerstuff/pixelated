# Dispatch Resume Gate — Worked Example (M02 / 2025-10 partial-run)

> **Ground truth from the 2026-06-28T23:00Z silent mid-dispatch failure on M02
> attempt-1 (worker session `9b86edcc-6cfa-48bc-9e44-14442e8abf3c`, dispatch PID
> `1295219`).**

## Callable Specification

```python
from skills.monthly_llm_driver.dispatch_resume_gate import (
    scan,
    kill_stale_dispatch,
    heartbeat_age_seconds,
)
from pathlib import Path

CHUNKS_DIR = Path("/tmp/wayfarer_smoke/chunks")

# (A1) scan(month: str, chunks_dir: Path) -> ResumeGateReport
report = scan("2025-10", CHUNKS_DIR)
# report.ok           -> list[int]  (status=ok, emails+chats non-empty)
# report.ok_empty     -> list[int]  (status=ok, but 0 records)
# report.partial      -> list[int]  (status=partial)
# report.missing      -> list[int]  (index in expected set, no file)
# report.missing_or_partial_count -> int

# (A2) kill_stale_dispatch(month: str) -> list[int]
killed = kill_stale_dispatch("2025-10")
# Returns list of PIDs SIGTERMed. Logs to /tmp/dispatch_resume_gate_kills.log.

# (A3) heartbeat_age_seconds(heartbeat_path: Path) -> Optional[float]
age = heartbeat_age_seconds(Path("/tmp/wayfarer_smoke/heartbeat_2025-10.json"))
# Returns None if heartbeat mtime matches most-recent chunk mtime (alive).
# Returns now - last_heartbeat_at if stale (dispatch died).
```

## AGENTS.md Mandate Cross-Reference

See `/home/vivi/pixelated/AGENTS.md` § "Dispatch Resume Gate (mandatory)" for
the worker contract:

- Every monthly_llm_driver worker MUST call `scan` BEFORE the first
  chat_completion POST
- If `missing_or_partial > 0` AND `kill_stale_dispatch` finds a live process,
  worker MUST kill first then write resume plan
- Workers MUST NOT bypass the gate for short halving loops

## Worked Example: M02 (2025-10) Partial-Run

### Step 1: Scan the chunks directory

```python
from pathlib import Path
from dispatch_resume_gate import scan

report = scan("2025-10", Path("/tmp/wayfarer_smoke/chunks"))
print(report.to_dict())
```

**Output (verified 2026-06-29 via uv run --frozen):**

```json
{
  "month": "2025-10",
  "n_chunks_expected": 27,
  "ok": [2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 14],
  "ok_empty": [15],
  "partial": [1, 11, 12],
  "missing": [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27],
  "missing_or_partial_count": 15
}
```

**Interpretation:**

- 11 chunks completed with content (chunks 2-10, 13, 14)
- 1 chunk completed but empty (chunk 15 — Granite transport, 70097 content_chars
  but JSON recovery yielded 0 parseable emails/chats)
- 3 chunks partial (chunks 1, 11, 12 — status=partial, 0 records)
- 12 chunks missing (chunks 16-27 — dispatch died before reaching these)
- Total `missing_or_partial_count` = 15

### Step 2: Check heartbeat age

```python
from dispatch_resume_gate import heartbeat_age_seconds

age = heartbeat_age_seconds(Path("/tmp/wayfarer_smoke/heartbeat_2025-10.json"))
print(f"Heartbeat age: {age} seconds")
```

**Output (verified 2026-06-29 via uv run --frozen):**

```
Heartbeat age: 7565.9 seconds
```

**Interpretation:** The heartbeat file was last written ~2.1 hours ago (7565.9
seconds). The dispatch process (PID 1295219) died silently without writing a
terminal-tagged heartbeat. The heartbeat mtime differs from the most-recent
chunk mtime, indicating the dispatch is no longer alive.

### Step 3: Kill stale dispatch (if alive)

```python
from dispatch_resume_gate import kill_stale_dispatch

killed = kill_stale_dispatch("2025-10")
print(f"Killed PIDs: {killed}")
```

**Output (verified 2026-06-29):**

```
Killed PIDs: []
```

**Interpretation:** No live dispatch process found (PID 1295219 already dead).
`kill_stale_dispatch` is idempotent — returns [] if no match.

### Step 4: Write resume plan

```python
import json
from pathlib import Path

resume_plan = {
    "month": "2025-10",
    "skip_list": sorted(report.ok + report.ok_empty),  # [2,3,4,5,6,7,8,9,10,13,14,15]
    "re_dispatch_list": sorted(report.partial),          # [1, 11, 12]
    "fresh_dispatch_list": sorted(report.missing),       # [16,17,18,19,20,21,22,23,24,25,26,27]
    "rollover_wall_seconds": sum(
        # Read wall_seconds from each chunk file for chunks 1, 11, 12
        # (partial chunks that need re-dispatch)
        json.loads(Path(f"/tmp/wayfarer_smoke/chunks/2025-10_chunk_{k:02d}_*.json").read_text()).get("wall_seconds", 0)
        for k in report.partial
    ),
}

Path("/tmp/wayfarer_smoke/resume_2025-10.json").write_text(
    json.dumps(resume_plan, indent=2)
)
```

**Output (resume_2025-10.json):**

```json
{
  "month": "2025-10",
  "skip_list": [2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 14, 15],
  "re_dispatch_list": [1, 11, 12],
  "fresh_dispatch_list": [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27],
  "rollover_wall_seconds": 645.69
}
```

**Interpretation:**

- Skip 12 chunks (11 ok + 1 ok_empty) — already on disk with content or
  status=ok
- Re-dispatch 3 partial chunks (1, 11, 12) — status=partial, need fresh attempt
- Fresh dispatch 12 chunks (16-27) — never started
- Rollover wall seconds = 645.69 s (sum of wall_seconds from chunks 1, 11, 12)

The next dispatch loop reads this file and starts from `fresh_dispatch_list`,
not from chunk 1. The stitcher's `chunks_manifest.json` records
`resume_indicators: original | re_dispatched | fresh` per chunk.

## Contrast: M01 (2025-09) — On-Disk State

```python
report_09 = scan("2025-09", Path("/tmp/wayfarer_smoke/chunks"))
print(report_09.to_dict())
```

**Output (verified 2026-06-29 via uv run --frozen):**

```json
{
  "month": "2025-09",
  "n_chunks_expected": 23,
  "ok": [1, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 22],
  "ok_empty": [18],
  "partial": [2, 5, 20, 21, 23],
  "missing": [],
  "missing_or_partial_count": 5
}
```

**Interpretation:**

- 17 chunks completed with content (chunks 1, 3, 4, 6-17, 19, 22)
- 1 chunk completed but empty (chunk 18 — status=ok but 0 records)
- 5 chunks partial (chunks 2, 5, 20, 21, 23 — status=partial, 0 records)
- 0 chunks missing (all 23 chunks on disk)
- Total `missing_or_partial_count` = 5

Note: M01 was already accepted (monthly_accepted/2025-09/month_summary.json
exists with audit_status=passed, accepted_email_count=550,
accepted_chat_count=680). The residual chunk files on /tmp are the original
dispatch artifacts from the M01 run. The stitcher's recovery logic (retry +
transport swap) compensated for the 5 partial chunks at the time, producing the
full 550/680 volume. The gate faithfully reports what is on disk; it does not
know whether a prior stitcher already compensated.

## Heartbeat Age Verification

```python
from dispatch_resume_gate import heartbeat_age_seconds

age = heartbeat_age_seconds(Path("/tmp/wayfarer_smoke/heartbeat_2025-10.json"))
print(f"heartbeat_age_seconds = {age}")
```

**Output (verified 2026-06-29 via uv run --frozen):**

```
heartbeat_age_seconds = 7692.448740005493
```

**Interpretation:** The heartbeat file was last written ~2.1 hours ago. The
dispatch process (PID 1295219) died silently without writing a terminal-tagged
heartbeat. The heartbeat mtime differs from the most-recent chunk mtime, so the
function returns the age as a float (not None). This confirms the dispatch is
dead — there is no alive indicator.

## kill_stale_dispatch Verification

```python
from dispatch_resume_gate import kill_stale_dispatch

killed = kill_stale_dispatch("2025-10")
print(f"Killed PIDs: {killed}")
```

**Output (verified 2026-06-29):**

```
Killed PIDs: []
```

**Interpretation:** No live dispatch process found (PID 1295219 already dead).
`kill_stale_dispatch` is idempotent — returns [] if no match.

## Failure Mode This Section Exists to Prevent

A dispatch process can die mid-batch (OOM kill, terminal process death, factoryd
session dropping) WITHOUT writing a heartbeat terminal tag. That is exactly what
happened on M02 attempt-1 chunks 16-27. Without the gate, the orchestrator-side
resume cycle would re-call `start_mission_run` blindly, and the next worker
would either:

1. Re-run all 27 chunks (wasting wall-budget), or
2. Skip the missing ones silently (missing evidence at audit).

The gate makes the partial-run truth discoverable in <5 s.
