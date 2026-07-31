# GEMINI.md

## Scope

- Governs Gemini CLI context for `Pixelated Empathy`.
- Main source of truth: root `AGENTS.md`.
- Stack: Astro, React 19, TypeScript, Express, Python (`pnpm` + `uv`).
- Keep instructions short, specific, and command-first (2026 guidance).

## Commands (run first)

- `pnpm dev`, `pnpm dev:all-services`, `pnpm dev:ai-service`
- `pnpm dev:training-server`, `pnpm dev:websocket`, `pnpm dev:bias-detection`
- `uv run pytest`, `uv run python -m ...` (prefer `uv` over raw `python`)
- `pnpm test`, `pnpm test:unit`, `pnpm test:integration`
- `pnpm test:evals`, `pnpm test:bias-detection`
- `pnpm e2e`, `pnpm e2e:ui`, `pnpm e2e:debug`
- `pnpm lint`, `pnpm lint:fix`, `pnpm format`, `pnpm typecheck`
- `pnpm build`, `pnpm build:analyze`, `pnpm deploy`, `pnpm deploy:prod`

## Rules

### ✅ Always

- **No Project-level Littering**: Keep all agent-specific configurations,
  skills, and dotfiles at the global level (`~/.gemini`). Do not create or
  commit project-level agent configuration files/folders.
- Follow root `AGENTS.md` and the continuity stack first.
- Apply root behavioral defaults: assumptions-first, simplicity, surgical edits,
  and explicit success criteria.
- Quick examples: ask before coding if scope is unclear; remove only
  imports/files your change made obsolete; verify with one concrete check.
- Keep commands and constraints explicit and executable.
- Preserve therapeutic and privacy context in user-facing messaging.
- Use `uv run` for Python execution in this repo.
- Run Foresight continuity at the start of substantial tasks (not for small
  one-offs): `manage_subconscious` (`get project_context`) and `inject_context`.
  - If continuity calls fail, pause and use the local `continuity` fallback only
    when explicitly justified in `project_context`.
- **Prefer Droid's structured workflows** for non-trivial code:
  - **Spec Mode** (`Shift+Tab` or `/spec`) for single features; produces an
    `IMPLEMENTATION_PLAN.md` for auditability.
  - **Missions** (`/missions`) for multi-feature refactors or 50+ file work.
  - See "Droid Workflow" section in root `AGENTS.md` for triggers and the PM
    playbook.

### ⚠️ Ask first

- Changes to MCP/automation behavior and command defaults.
- Expanding instructions into a broad reference dump (prefer linked docs).
- Altering continuity tooling workflow.

### 🚫 Never

- Hide issues with suppressions (`@ts-ignore`, `# noqa`, `# type: ignore`,
  `/* eslint-disable */`).
- Put secrets, credentials, or patient-identifiable data in prompts/fixtures.
- Depend on undocumented assumptions for behavior.

## Delivery checks

1. Restate goal and constraints.
2. Make minimal-safe edits.
3. Run a focused check (`pnpm lint` or `pnpm test:unit`).
4. Report outcome, residual risk, and next step.

## Context tooling

- Foresight MCP entrypoints:
  - `scripts/memory/foresight-mcp-server.sh`
  - `scripts/memory/mcp-config.json`
- Required task-start memory commands (substantial tasks):
  1. `manage_subconscious` (`action: get`, label: `project_context`)
  2. `inject_context` with current prompt
- `.agent/internal`: `.agent/internal/plans/`, `.agent/internal/guides/`,
  `.agent/internal/decisions.md`.
- If a configured MCP is unavailable, continue with local repository context and
  standard tooling.
