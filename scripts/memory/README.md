# Memory Scripts Playbook

This directory contains lightweight helpers for the Cursor Memory Bank continuity workflow.

## Scripts

### `bootstrap-memory-session.sh`

Startup helper for session handoff.

Usage:

```bash
scripts/memory/bootstrap-memory-session.sh [MODE]
```

Behavior:

- Verifies `.cursor/memory/config.json`.
- Checks key continuity files.
- Prints the first required action before implementation work.

### `normalize-memory.sh`

Quick normalization pass for required memory files.

Usage:

```bash
scripts/memory/normalize-memory.sh
```

Behavior:

- Flags missing files.
- Flags placeholders and open TODO-like markers.
- Gives a fast remediation summary.

### `check-continuity-score.sh`

Continuity hardening check for memory health.

Usage:

```bash
scripts/memory/check-continuity-score.sh
```

What it evaluates:

- Required file presence.
- Placeholder density.
- Duplicate section heading risk.
- Stale risk density in `session_notes.md` and `progress.md`.
- Context staleness (`context_lag_minutes`) based on mtime.

Output format includes parseable `MEMORY_RESULT` fields and recovery actions.

Recommended flow:

1. `/memory bootstrap`
2. `/memory check` (or `scripts/memory/check-continuity-score.sh`)
3. If status failed, run `/memory normalize`
4. `/context status`
5. `/memory event session_start "Continuing with saved checkpoint"`
6. `/memory state` (verify `continuity_state=updated`)
7. Continue with `/mode <MODE>` and active mode commands.

### `update-continuity-state.sh`

Small state-machine helper used by bootstrap/check/normalize flows.

Usage:

```bash
scripts/memory/update-continuity-state.sh --mode THINK --event bootstrap --status success --next-action "..." --next-step "..."
```

It produces/updates `.cursor/memory/continuity_state.json`, storing:

- last bootstrap/check timestamps
- open risks and open actions
- next checkpoint and next command contract
- continuity health tags for agent handoff

### `state.sh`

Machine-readable continuity contract output for `/memory state`.

Usage:

```bash
scripts/memory/state.sh
```

It prints `MEMORY_RESULT` with:

- continuity freshness
- continuity score fields
- `continuity_state` + `continuity_state_path`
