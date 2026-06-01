---
name: git-lint
description: >
  Runs lint and auto-format on all changed files (staged + unstaged) across all
  4 repos in the Pixelated workspace. Covers TypeScript/JS (oxlint + prettier)
  and Python (ruff check + ruff format). Use before committing to ensure clean
  code, or as a standalone quality check.
  Trigger: /git:lint or "lint all changed files" or "format changed files".
allowed-tools: Bash,Read
---

# Git Lint — Lint & Format All Changed Files

## Purpose

Runs linting and auto-formatting on every changed file (staged + unstaged) across
all 4 repos in the Pixelated monorepo workspace:

| Language      | Tool(s)                    |
|---------------|---------------------------|
| TypeScript/JS | `oxlint` + `prettier`      |
| Python        | `ruff check` + `ruff format` (via `uv run`) |

## When to Activate

This skill is triggered when the user says:
- `/git:lint`
- "lint all changed files"
- "format changed files"
- "run lint before commit"
- "check all changed files for lint errors"
- "ruff and oxlint everything changed"

## Arguments (optional)

- `--fix` — auto-fix issues (default behaviour)
- `--check-only` — only report errors, don't write fixes
- `--repo <name>` — limit to one repo: `ai`, `docs`, `foresight-mcp`, or `main`

## Execution Protocol

### Step 1 — Confirm Scope

Tell the user which repos and file types will be checked.

### Step 2 — Run the Script

```bash
bash /home/vivi/pixelated/scripts/git/lint-changed.sh [ARGS]
```

Pass any flags the user specified.

### Step 3 — Report Results

- How many files were checked per repo
- Whether any errors or warnings were found
- Which files were auto-fixed (if `--fix` mode)

### Step 4 — Suggest Next Steps

If lint passes cleanly:
- Suggest running `/git:push` to commit and push
  
If lint finds unfixable errors:
- Show the specific files and errors
- Guide the user to fix them manually
- **Do NOT** suggest suppression comments (`@ts-ignore`, `# noqa`, etc.)

## Important Rules

- Python must be run via `uv run ruff` (not raw `python`)
- **Never** add suppression comments to hide lint errors — fix the root cause
- Untracked files in `scratch/`, `aws/`, or `tests/results/` are excluded
- The script is idempotent — safe to run multiple times
