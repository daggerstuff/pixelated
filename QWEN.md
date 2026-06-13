# QWEN.md

This file is loaded automatically for Qwen sessions. It is concise, practical,
and aligned with `~/.hermes/SOUL.md`.

## 1) Project identity

- **Project**: Pixelated Empathy
- **Domain**: Therapeutic training and conversational analysis
- **Stack**: Astro, React 19, TypeScript, Express, Python AI pipelines
- **Data**: MongoDB, Redis, PostgreSQL, vector stores
- **Package managers**: `pnpm` (Node/TS), `uv` (Python)

## 2) Non-negotiables

- No suppression comments to hide issues.
  - `// @ts-ignore`, `# noqa`, `# type: ignore`, `/* eslint-disable */`
- Allowed exception only: `# type: ignore[import-untyped]` for missing
  third-party stubs, with a short inline reason.
- Never include secrets or sensitive patient data in code, logs, tests, or
  commits.
- Keep therapeutic and privacy context in user-facing output.
- Do not use `context-mode` or `context-mode_*` workflows.
- Verify behavior before claiming done.

## 3) Project structure (quick)

- `src/`: Astro + React UI, routes, shared TS libraries.
- `ai/`: Python inference/training/safety work (own commit discipline).
- `scripts/`: launcher scripts, deployment helpers, memory/ops glue.
- `tests/`: JS, TS, and Python tests.
- `.agent/internal/`: durable internal docs and operational notes.

## 4) Core commands

### Development

- `pnpm dev`
- `pnpm dev:all-services`
- `pnpm dev:bias-detection`
- `pnpm dev:ai-service`
- `pnpm dev:training-server`
- `pnpm dev:websocket`
- `uv run pytest`

### Validation

- `pnpm test`, `pnpm test:unit`, `pnpm test:integration`
- `pnpm test:evals`, `pnpm test:bias-detection`
- `pnpm e2e`, `pnpm e2e:ui`, `pnpm e2e:debug`
- `pnpm lint`, `pnpm lint:fix`, `pnpm format`, `pnpm format:check`,
  `pnpm typecheck`
- `pnpm security:check` (security-sensitive changes)

### Release

- `pnpm build`, `pnpm build:analyze`
- `pnpm deploy`, `pnpm deploy:prod`

## 5) Memory continuity (primary vs durable)

Use **Foresight MCP** as the canonical continuity source for active work,
upcoming work, and cross-session state.

- Primary source: `Foresight MCP` for work state and orientation.
- Secondary source: `.agent/internal/` for durable docs.

### Foresight MCP entrypoints

- Local launcher: `scripts/memory/foresight-mcp-server.sh`
- MCP config: `scripts/memory/mcp-config.json`

### Core Foresight tools

- `manage_memories` (store/update/delete/archive)
- `search_memories` and `query_memories`
- `manage_subconscious` (list/get/update/reset/clear)
- `process_session_transcript`
- `inject_context`
- `query_memories_temporal`
- `manage_entities`, `query_entities`
- `analyze_memories`
- `get_system_status`

### Orientation order

1. `manage_subconscious` with `action: list`.
2. `manage_subconscious` with `action: get`, label `pending_items`.
3. `manage_subconscious` with `action: get`, label `project_context`.
4. `query_memories` for active/upcoming work keywords.
5. `manage_entities` with `action: extract` when semantic context helps.

### `.agent/internal` references

- `.agent/internal/plans/`
- `.agent/internal/guides/`
- `.agent/internal/decisions.md`
- `.agent/internal/current/`
- `.agent/internal/upcoming/`

## 6) Delivery sequence

1. Restate goal and constraints.
2. Apply the minimal edit.
3. Run the smallest relevant check.
4. Report result, risk, and next concrete step.

## 7) Qwen-specific controls

- Use `qwen mcp add` to enable MCPs when needed.
- For library/framework questions, use `context7` (`resolve-library-id` +
  `query-docs`).
- Prefer local project docs when debugging business logic, code review, or
  testing.

## 8) MCP profile

- Enabled: context7, rube, linear, brave-search, firecrawl, sentry, playwright,
  stitch.
- Disabled: sequential-thinking, github, e2b-sandbox.
- Nvidia setup: set `NVIDIA_API_KEY` for model provider calls as configured.
- Model config location: `.qwen/settings.json` (primary model: `z-ai/glm5`).
