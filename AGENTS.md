# AGENTS.md

## Runtime & Local Services

**Pixelated Empathy** — clinical AI platform: Astro 6 + React 19 (TypeScript) frontend/SSR; Express/FastAPI/Flask backend.

### Runtime Versions

See manifests: `.nvmrc` (Node), `package.json` (pnpm), `.python-version` (Python).

### Required Services

Start databases w/ Docker before running local services:

- **Astro dev**: `5173` → `pnpm dev`
- **MongoDB**: `27017` (container `mongo:latest`)
- **Redis**: `6379` (container `redis:latest`)
- **PostgreSQL**: `5432` (container `postgres:17`)

Override env vars for local integration tests against local DBs:

```bash
REDIS_URL=redis://localhost:6379/0 UPSTASH_REDIS_REST_URL=redis://localhost:6379/0 \
  pnpm vitest run -c config/vitest.config.ts
```

### Key Commands

- **Submodules** (after clone/pull, before `pnpm install`): `git submodule init && git submodule update`
- **Lint**: `pnpm lint` | **Typecheck**: `pnpm typecheck` | **Tests**: `pnpm vitest run -c config/vitest.config.ts`
- **All Services**: `pnpm dev:all-services` | **Build**: `pnpm build`

---

## Core Developer Rules

### ✅ Always

- **Config Hygiene**: Keep agent-specific dotfiles at `~/.<agent_name>`. Never create or commit agent-specific config at project level.
- **Surgical Edits**: Keep changes minimal, safe, tightly scoped. Write clear, self-documenting code. Remove only what your edits make obsolete.
- **Privacy & Safety Gating**: Preserve therapeutic, privacy, and HIPAA-compliant boundaries for client/patient-facing workflows. Clinical health data is paramount.
- **Verify Explicitly**: Validate edits w/ concrete commands (tests, lint, typecheck) before completion.
  Restate what was requested, review diffs for suppression comments, report results and residual risks.

### ⚠️ Ask First

- Modifying authentication, security controls, or clinical gating.
- Modifying public API contracts, routing architectures, or CI/CD pipelines.

### 🚫 Never (Strict Anti-Suppression Policy)

> [!IMPORTANT]
> **No suppression.** Never mask linter errors, TypeScript errors, compile warnings, or test failures. Fix the issue—never hide it.

- **TypeScript**: `@ts-ignore` `@ts-nocheck` `@ts-expect-error` (unless strictly required in pre-existing test mock files).
- **Python**: `# noqa` `# type: ignore` (do not bypass linting or pyright checks).
- **JavaScript / ESLint**: `/* eslint-disable */` or file-level/block-level rule exclusions to cover up new warning flags.
- **Config Bypasses**: Modifying `tsconfig.json` `.eslintrc` `.oxlintrc` or test configs to lower strictness or hide failures.
- **Secrets & PHI**: Hardcoding credentials, API tokens, passwords, or patient-identifiable details in codebase, fixtures, or test environments.

---

## Coding Standards

Follow conventions in `.agents/rules/`:

- `typescript.md` — TypeScript and React patterns
- `astro.md` — Astro 6 component, routing, and SSR rules
- `python.md` — Python/uv toolchain and ruff/pyright conventions
- `testing.md` — Vitest, Playwright, and pytest patterns
- `security.md` — HIPAA, secrets, auth/gating, threat modeling

---

## SkillRoute — Skill Discovery & Routing

SkillRoute (`erichare/skill-route`) provides semantic skill routing for ambiguous or multi-domain tasks.

```bash
skillroute route "<task description>"  # Route to best skill
skillroute search "<query>"            # Search available skills
```

Installed at `~/.skillroute/skill-route`. Requires `SKILLROUTE_CATALOG_PATH` env var (already in shell config).

When the next step is unclear: run `skillroute route`, read confidence scores, load recommended skill(s) via the Skill tool.

---

## Foresight Memory & Continuity System

Foresight is a persistent memory layer for AI agents — shared across all machines via Ghost Postgres.

### Session Startup Gate (mandatory)

Every session touching real work MUST run Foresight continuity read as its **first action** — before any code edit, exploration, or planning.

1. Call `manage_context_blocks` w/ `action: "get"` for both `project_context` and `pending_items`.
2. Call `search_memories` w/ keywords related to your task.
3. In your first reply, state what blocks returned (entry count + one-line summary each).
4. Use findings to inform your approach — if memory contradicts your plan, say so before editing.

**Skipping this gate is not permitted without naming it.** If it doesn't apply (pure conversation, no code), say so explicitly and why.

### Session End Gate (mandatory)

Every session that touched real work MUST run the Foresight capture pipeline before ending:

1. Call `process_session_transcript` w/ `session_id` and `messages`.
2. Call `manage_memories` (`store`) for new decisions, lessons, or preferences — store distilled facts, not transcripts.
3. Call `manage_context_blocks` (`update`, `pending_items`) — mark completed items, add follow-ups, remove stale entries.
4. Update `user_preferences` or `project_context` blocks if scope shifted.

**Skipping this gate is not permitted without naming it.** If the session produced no durable context, say so explicitly and why.

---

## Aesthetic Judgment

When doing design, creative, or artistic work — UI design, visual assets, layouts, color choices,
typography, animation, branding, or creative direction — read `TASTES.md` if it exists
and apply its constraints to your output.
