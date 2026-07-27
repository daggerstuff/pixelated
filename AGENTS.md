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

- **Global config Hygiene**: Keep agent-specific dotfiles at `~/.<agent_name>`. Never create or commit agent-specific folders or config files at project level.
- **Continuity First**: Respect guidelines in this root `AGENTS.md` followed by any subdirectory-specific instruction files.
- **Surgical Edits**: Keep changes minimal, safe, and tightly scoped. Remove only imports, variables, or assets made completely obsolete by your edits.
- **Assumptions-First & Simplicity**: Never assume undocumented behaviors. Write clear, readable, self-documenting code.
- **Privacy & Safety Gating**: Strongly preserve therapeutic, privacy, and HIPAA-compliant boundaries for client/patient-facing workflows. Isolated clinical health data is paramount.
- **Verify Explicitly**: Validate edits w/ concrete commands (e.g. tests or lint targets) before completion.

### ⚠️ Ask First

- Modifying authentication, security controls, or clinical gating.
- Modifying public API contracts, routing architectures, or CI/CD pipelines.

### 🚫 Never (Strict Anti-Suppression Policy)

> [!IMPORTANT]
> **No suppression.** Never mask linter errors, TypeScript errors, compile warnings, or test failures. Fix the issue—never hide it.

**Strictly forbidden suppressions and bypasses:**

- **TypeScript**: `@ts-ignore` `@ts-nocheck` `@ts-expect-error` (unless strictly required in pre-existing test mock files).
- **Python**: `# noqa` `# type: ignore` (do not bypass linting or pyright checks).
- **JavaScript / ESLint**: `/* eslint-disable */` or file-level/block-level rule exclusions to cover up new warning flags.
- **config Bypasses**: Modifying `tsconfig.json` `.eslintrc` `.oxlintrc`or test configs to lower strictness or hide failures.
- **Secrets & PHI**: Hardcoding credentials, API tokens, passwords, or patient-identifiable details in codebase, fixtures, or test environments.

---

## Coding Standards

Follow conventions documented in:

- `.agents/rules/typescript.md` - TypeScript and React patterns
- `.agents/rules/astro.md` - Astro 6 component, routing, and SSR rules
- `.agents/rules/python.md` - Python/uv toolchain and ruff/pyright conventions
- `.agents/rules/testing.md` - Vitest, Playwright, and pytest patterns
- `.agents/rules/security.md` - HIPAA, secrets, auth/gating, threat modeling

## Personal Preferences

Personal coding preferences and past decisions are tracked via the **Foresight Memory & Continuity System** (see section below).
Use `foresight store "prefer pnpm over npm"` to persist durable preferences.
Always use `uv` when calling / dealing with python commands.
Always use `pnpm` over `npm`.`

---

## SkillRoute — Skill Discovery & Routing

This workspace uses **SkillRoute** (`erichare/skill-route`) for semantic skill routing when right skill for task is not obvious.

### Installation & Setup

- Installed at: `~/.skillroute/skill-route`
- CLI: `skillroute` (globally available via `uv tool install`)
- Catalog: `~/.skillroute/skill-route/.skillroute/catalog.db`
- Requires `SKILLROUTE_CATALOG_PATH` env var (already added to `.bashrc` / `.zshrc`)

### When to Use

- When agent needs to identify best skill for ambiguous or multi-domain task.
- When task description matches multiple possible skills.

### Key Commands

```bash
# Route a request to the best skill
skillroute route "<task description>"

# Search available skills
skillroute search "<query>"
```

### Agent Workflow

1. If next step is unclear, run `skillroute route "<task>"`.
2. Read returned skill(s) and their confidence scores.
3. Load recommended skill(s) via Skill tool.
4. Proceed w/ recommended workflow.

---

## Foresight Memory & Continuity System

Foresight is persistent memory layer for AI agents — shared across all machines via Ghost Postgres.

### When to Use Foresight

| Situation                                  | Tool                         | Example                                                                  |
| ------------------------------------------ | ---------------------------- | ------------------------------------------------------------------------ |
| Starting a substantial task                | `manage_context_blocks`      | Get `project_context` + `pending_items` before writing code              |
| Remembering a decision or preference       | `manage_memories`            | Store "user prefers pnpm over npm" as category `preference`              |
| Finding past context on a topic            | `search_memories`            | Search "Postgres migration" to recall prior decisions                    |
| Capturing lessons from a failed approach   | `manage_memories`            | Store "CLI fell back to SQLite because FORESIGHT_DB_URL wasn't exported" |
| Tracking active work items                 | `manage_context_blocks`      | Update `pending_items` block with current blockers                       |
| Injecting relevant memories into a session | `inject_context`             | Auto-surface memories matching current conversation                      |
| Reviewing work over a time window          | `query_memories_temporal`    | Pull memories from last 7 days for weekly reflection                     |
| Processing a session transcript            | `process_session_transcript` | Extract memories from a completed agent session                          |

### Session Startup Workflow (GATE — do not skip)

This is hard gate, not suggestion. Every session touching real work MUST run foresight continuity read as its **first action** — before any code edit,
exploration, or planning prose.

1. **GATE read (mandatory first action):** call `manage_context_blocks` w/ action `get` for `project_context`  `pending_items`.
   No exceptions for "I already know", "quick task", or "I'll check after". Treat it like `git status` — first, always.
2. **Show your work (no silent skip):** in your first reply, state what blocks returned — quote entry count and one-line summary per block.
   Example: "project_context: 3 entries — <one-line>; pending_items: 2 — <one-line>." skip that isn't named is one human can't audit.
3. **`search_memories`** w/ keywords related to your task — prior decisions live in memories; confirm or contradict what blocks said.
4. **Use findings to inform your approach** — if memory contradicts your plan, say so before editing.
5. **`manage_memories` to store** durable lessons/decisions when work completes; `manage_context_blocks` `update` on `pending_items` when scope shifts.

**Skipping gate is not permitted w/o naming it.** If you decide it doesn't apply (pure conversation, no code), say so explicitly in first reply and why.

### Best Practices

- **Store decisions, not transcripts** — "Chose streamable-http over stdio for MCP transport" beats 40 lines of deliberation
- **Tag by category** — `preference` `decision` `lesson` `fact` — makes search precise
- **Update context blocks when scope changes** — `pending_items` should reflect reality, not history
- **Don't hoard** — Foresight is for durable context, not session scratch. One-liners > paragraphs
- **Search before storing** — avoids duplicates; `search_memories` catches near-matches

---

## Delivery Checks (Task Completion Contract)

Before ending turn and finishing task, perform following checks:

1. **Restate Goal**: Briefly describe what was requested and what was achieved.
2. **Review Diffs**: Ensure edits are minimal, clean, safe, and do not contain suppression comments.
3. **Execute Verification Command**: Run target check (e.g. `pnpm lint` `pnpm typecheck`or targeted tests).
4. **Report Outcome & Risk**: Detail test results, highlight any residual risks or assumptions made, and propose next steps.

---

## Aesthetic Judgment

When doing design, creative, or artistic work — anything requiring aesthetic judgment such as UI design, visual assets, layouts, color choices, typography, animation,
branding, or creative direction — read `TASTES.md` if it exists and apply its constraints to your output.# AGENTS.md

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

- **Global config Hygiene**: Keep agent-specific dotfiles at `~/.<agent_name>`. Never create or commit agent-specific folders or config files at project level.
- **Continuity First**: Respect guidelines in this root `AGENTS.md` followed by any subdirectory-specific instruction files.
- **Surgical Edits**: Keep changes minimal, safe, and tightly scoped. Remove only imports, variables, or assets made completely obsolete by your edits.
- **Assumptions-First & Simplicity**: Never assume undocumented behaviors. Write clear, readable, self-documenting code.
- **Privacy & Safety Gating**: Strongly preserve therapeutic, privacy, and HIPAA-compliant boundaries for client/patient-facing workflows. Isolated clinical health data is paramount.
- **Verify Explicitly**: Validate edits w/ concrete commands (e.g. tests or lint targets) before completion.

### ⚠️ Ask First

- Modifying authentication, security controls, or clinical gating.
- Modifying public API contracts, routing architectures, or CI/CD pipelines.

### 🚫 Never (Strict Anti-Suppression Policy)

> [!IMPORTANT]
> **No suppression.** Never mask linter errors, TypeScript errors, compile warnings, or test failures. Fix the issue—never hide it.

**Strictly forbidden suppressions and bypasses:**

- **TypeScript**: `@ts-ignore` `@ts-nocheck` `@ts-expect-error` (unless strictly required in pre-existing test mock files).
- **Python**: `# noqa` `# type: ignore` (do not bypass linting or pyright checks).
- **JavaScript / ESLint**: `/* eslint-disable */` or file-level/block-level rule exclusions to cover up new warning flags.
- **config Bypasses**: Modifying `tsconfig.json` `.eslintrc` `.oxlintrc`or test configs to lower strictness or hide failures.
- **Secrets & PHI**: Hardcoding credentials, API tokens, passwords, or patient-identifiable details in codebase, fixtures, or test environments.

---

## Coding Standards

Follow conventions documented in:

- `.agents/rules/typescript.md` - TypeScript and React patterns
- `.agents/rules/astro.md` - Astro 6 component, routing, and SSR rules
- `.agents/rules/python.md` - Python/uv toolchain and ruff/pyright conventions
- `.agents/rules/testing.md` - Vitest, Playwright, and pytest patterns
- `.agents/rules/security.md` - HIPAA, secrets, auth/gating, threat modeling

## Personal Preferences

Personal coding preferences and past decisions are tracked via the **Foresight Memory & Continuity System** (see section below).
Use `foresight store "prefer pnpm over npm"` to persist durable preferences.
Always use `uv` when calling / dealing with python commands.
Always use `pnpm` over `npm`.`

---

## SkillRoute — Skill Discovery & Routing

This workspace uses **SkillRoute** (`erichare/skill-route`) for semantic skill routing when right skill for task is not obvious.

### Installation & Setup

- Installed at: `~/.skillroute/skill-route`
- CLI: `skillroute` (globally available via `uv tool install`)
- Catalog: `~/.skillroute/skill-route/.skillroute/catalog.db`
- Requires `SKILLROUTE_CATALOG_PATH` env var (already added to `.bashrc` / `.zshrc`)

### When to Use

- When agent needs to identify best skill for ambiguous or multi-domain task.
- When task description matches multiple possible skills.

### Key Commands

```bash
# Route a request to the best skill
skillroute route "<task description>"

# Search available skills
skillroute search "<query>"
```

### Agent Workflow

1. If next step is unclear, run `skillroute route "<task>"`.
2. Read returned skill(s) and their confidence scores.
3. Load recommended skill(s) via Skill tool.
4. Proceed w/ recommended workflow.

---

## Foresight Memory & Continuity System

Foresight is persistent memory layer for AI agents — shared across all machines via Ghost Postgres.

### When to Use Foresight

| Situation                                  | Tool                         | Example                                                                  |
| ------------------------------------------ | ---------------------------- | ------------------------------------------------------------------------ |
| Starting a substantial task                | `manage_context_blocks`      | Get `project_context` + `pending_items` before writing code              |
| Remembering a decision or preference       | `manage_memories`            | Store "user prefers pnpm over npm" as category `preference`              |
| Finding past context on a topic            | `search_memories`            | Search "Postgres migration" to recall prior decisions                    |
| Capturing lessons from a failed approach   | `manage_memories`            | Store "CLI fell back to SQLite because FORESIGHT_DB_URL wasn't exported" |
| Tracking active work items                 | `manage_context_blocks`      | Update `pending_items` block with current blockers                       |
| Injecting relevant memories into a session | `inject_context`             | Auto-surface memories matching current conversation                      |
| Reviewing work over a time window          | `query_memories_temporal`    | Pull memories from last 7 days for weekly reflection                     |
| Processing a session transcript            | `process_session_transcript` | Extract memories from a completed agent session                          |

### Session Startup Workflow (GATE — do not skip)

This is hard gate, not suggestion. Every session touching real work MUST run foresight continuity read as its **first action** — before any code edit,
exploration, or planning prose.

1. **GATE read (mandatory first action):** call `manage_context_blocks` w/ action `get` for `project_context`  `pending_items`.
   No exceptions for "I already know", "quick task", or "I'll check after". Treat it like `git status` — first, always.
2. **Show your work (no silent skip):** in your first reply, state what blocks returned — quote entry count and one-line summary per block.
   Example: "project_context: 3 entries — <one-line>; pending_items: 2 — <one-line>." skip that isn't named is one human can't audit.
3. **`search_memories`** w/ keywords related to your task — prior decisions live in memories; confirm or contradict what blocks said.
4. **Use findings to inform your approach** — if memory contradicts your plan, say so before editing.
5. **`manage_memories` to store** durable lessons/decisions when work completes; `manage_context_blocks` `update` on `pending_items` when scope shifts.

**Skipping gate is not permitted w/o naming it.** If you decide it doesn't apply (pure conversation, no code), say so explicitly in first reply and why.

### Best Practices

- **Store decisions, not transcripts** — "Chose streamable-http over stdio for MCP transport" beats 40 lines of deliberation
- **Tag by category** — `preference` `decision` `lesson` `fact` — makes search precise
- **Update context blocks when scope changes** — `pending_items` should reflect reality, not history
- **Don't hoard** — Foresight is for durable context, not session scratch. One-liners > paragraphs
- **Search before storing** — avoids duplicates; `search_memories` catches near-matches

---

## Delivery Checks (Task Completion Contract)

Before ending turn and finishing task, perform following checks:

1. **Restate Goal**: Briefly describe what was requested and what was achieved.
2. **Review Diffs**: Ensure edits are minimal, clean, safe, and do not contain suppression comments.
3. **Execute Verification Command**: Run target check (e.g. `pnpm lint` `pnpm typecheck`or targeted tests).
4. **Report Outcome & Risk**: Detail test results, highlight any residual risks or assumptions made, and propose next steps.

---

## Aesthetic Judgment

When doing design, creative, or artistic work — anything requiring aesthetic judgment such as UI design, visual assets, layouts, color choices, typography, animation,
branding, or creative direction — read `TASTES.md` if it exists and apply its constraints to your output.