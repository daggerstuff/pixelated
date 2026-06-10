# CLAUDE.md

## Scope

- Governs Claude Code sessions for `Pixelated Empathy`.
- Main source of truth: root `AGENTS.md`.
- Stack: Astro, React 19, TypeScript, Express, Python AI pipelines (`pnpm`, `uv`).
- Keep this file concise and high-signal (shorter files improve adherence).

## Commands (run first)

- `pnpm dev`, `pnpm dev:all-services`, `pnpm dev:ai-service`
- `pnpm dev:training-server`, `pnpm dev:websocket`, `pnpm dev:bias-detection`
- `uv run pytest`, `uv run python -m ...`
- `pnpm test`, `pnpm test:unit`, `pnpm test:integration`
- `pnpm test:evals`, `pnpm test:bias-detection`
- `pnpm e2e`, `pnpm e2e:ui`, `pnpm e2e:debug`
- `pnpm lint`, `pnpm lint:fix`, `pnpm format`, `pnpm typecheck`
- `pnpm build`, `pnpm build:analyze`, `pnpm deploy`, `pnpm deploy:prod`

## Rules

### ✅ Always

- **No Project-level Littering**: Keep all agent-specific configurations, skills, and dotfiles
  at the global level (`~/.claude`). Never commit project-level configuration folders
  (e.g. `.claude` at the repository root).
- Follow root `AGENTS.md` exactly, then this file and scoped `AGENTS.md` under touched directories.
- Apply root behavioral defaults: assumptions-first, simplicity, surgical edits, and explicit success criteria.
- Quick examples: ask before coding if scope is unclear; remove only imports/files your change made obsolete; verify with one concrete check.
- Preserve privacy/safety context for mental health workflows.
- Use explicit directives instead of implied conventions; avoid vague guidance.
- Use `uv run` for Python execution where possible.
- Keep context scoped: prefer root-level defaults with path-specific overrides.
- Start every task by running Foresight continuity calls before edits:
  `manage_subconscious` (`list`, `get` for `pending_items` and
  `project_context`) and `search_memories` for active/upcoming work.
  - If these calls are unavailable, pause edits and switch to the local continuity fallback.

### ⚠️ Ask first

- Edits to deployment routes, auth middleware, or public-facing behavior contracts.
- Removing or broadening scope guards (security/privacy checks, gating logic).
- Command-policy changes that affect CI/release safety.

### 🚫 Never

- Use suppression comments to mask issues (`@ts-ignore`, `# noqa`, `# type: ignore`, `/* eslint-disable */`).
- Include secrets, tokens, patient details, or credentials in examples/fixtures.
- Run raw `python`/`pip` in this repo unless explicitly requested.

## Delivery checks

1. Restate goal, risk, and target surface.
2. Apply minimal-safe changes.
3. Run one relevant command from the command list.
4. Report result and immediate risk.

## Context tooling

- Foresight MCP first for active state: `manage_subconscious` (`list` and `get`
  for `pending_items` + `project_context`), `search_memories` (`active tasks`,
  `upcoming work`, owner/team scope), then `manage_memories` as needed.
- Root `AGENTS.md` is the main source of truth.
- For scoped rules, prefer nested instruction files (`AGENTS.md` under touched directories).
