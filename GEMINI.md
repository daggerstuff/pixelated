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

- Follow root `AGENTS.md` and the continuity stack first.
- Keep commands and constraints explicit and executable.
- Preserve therapeutic and privacy context in user-facing messaging.
- Use `uv run` for Python execution in this repo.
- Run Foresight continuity at task start before editing: `manage_subconscious`
  (`list`, then `get` for `pending_items` and `project_context`) and
  `search_memories` for active/upcoming work.
  - If continuity calls fail, pause and use the local `continuity` fallback only when explicitly justified in `project_context`.

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
- Required task-start memory commands:
  1. `manage_subconscious` (`action: list`)
  2. `manage_subconscious` (`action: get`, labels `pending_items` and `project_context`)
  3. `search_memories` for `"active tasks"` and `"upcoming work"`
- `.agent/internal`: `.agent/internal/plans/`, `.agent/internal/guides/`,
  `.agent/internal/decisions.md`.
- If a configured MCP is unavailable, continue with local repository context and
  standard tooling.
