# Dependabot Alerts Script

This script checks terminal session snapshots for context window usage signals and
outputs a concise risk summary.

## Usage

```bash
pnpm ts-node scripts/utils/list-dependabot-alerts.ts
```

Or if ts-node is globally available:

```bash
./scripts/utils/list-dependabot-alerts.ts
```

## Context Window Guard

Run this before long interactive sessions to get a quick status check:

```bash
./scripts/context-window-check.sh
```

Use `--enforce` to force a hard stop when risky patterns are detected:

```bash
./scripts/context-window-check.sh --enforce
```

This now also flags high-risk edit churn patterns in recent terminal logs (`Update(...)`, `Error editing file`, repeated
  `Read ... file` output bursts) and tells you when compaction should happen now.

To enforce a hard stop warning (kill-switch), pass:

```bash
./scripts/context-window-check.sh --enforce
```

If risky context growth is detected, the script exits with code `2` and instructs you
to run `/compact` immediately.

Notes:

- The guard checks only local terminal snapshot signals (`Context XX%` lines) for signs of
  Claude session pressure.
- There is no user-editable Claude configuration in this repo that sets `model_auto_compact_token_limit`.
  That setting belongs to other tooling and is intentionally not used by this script.

## Requirements

- GitHub CLI (`gh`) installed and authenticated
- Repository with Dependabot alerts
- `ts-node` (available as dev dependency in this project)

## Output

The script will create or overwrite `alerts.json` in the repository root, with
the Dependabot alerts data.
