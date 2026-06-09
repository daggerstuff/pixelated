---
name: git-lint
description: >
  Runs lint and auto-format on all changed files (staged + unstaged) across all
  4 repos in the Pixelated workspace. Covers TypeScript/JS (oxlint + prettier)
  and Python (ruff check + ruff format). Use before committing to ensure clean
  code, or as a standalone quality check.
  Trigger: /git:lint or "lint all changed files" or "format changed files".
allowed-tools: Bash,Read,Edit,Write,Search,ast_grep,ast_edit,LSP
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

### Step 3 — Auto-Fix Everything

After the script runs, if there are lint/format errors that could not be
auto-fixed by the tooling (oxlint, prettier, ruff), the agent **MUST** fix them
itself before finishing. Do not stop and hand the errors back to the user.

The fix loop:
1. Parse the remaining errors from the script output.
2. Read each affected file, understand the error, and edit to fix the root cause.
3. Re-run the lint script to verify the fixes.
4. Repeat until the lint script exits 0 or only warnings remain.

Hard rules during fixing:
- **Never** add suppression comments (`@ts-ignore`, `eslint-disable`, `# noqa`,
  `# type: ignore`, etc.) — fix the actual type or logic error.
- If a missing type/import is the root cause, add the correct type or import.
- If a value is `undefined` at a callsite, narrow it with a guard or provide a
  default — don't widen the type to `any`.
- If a type is genuinely unavailable (e.g. third-party untyped module), add a
  proper local type declaration — never fall back to `any` just to silence lint.

### Step 4 — Report Final Results

After all errors are resolved (or only non-blocking warnings remain):
- How many files were checked per repo
- Which files were auto-fixed by the tooling (prettier, ruff format)
- Which files the agent manually fixed, and what was changed
- Whether any warnings remain (these are acceptable; errors are not)

If lint is fully clean, suggest running `/git:push` to commit and push.

## Important Rules

- Python must be run via `uv run ruff` (not raw `python`)
- **Never** add suppression comments to hide lint errors — fix the root cause
- Untracked files in `scratch/`, `aws/`, or `tests/results/` are excluded
- The script is idempotent — safe to run multiple times
