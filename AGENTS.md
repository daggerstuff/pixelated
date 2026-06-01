# AGENTS.md

## Runtime & Local Services

### Product Overview
Pixelated Empathy is a clinical AI platform built with Astro 6 + React 19 (TypeScript) for the frontend/SSR, and Express/FastAPI/Flask backend services.

### Runtime Versions
- **Node.js**: 24.14.1 (see `.nvmrc`)
- **pnpm**: 11.3.0 (see `package.json`)
- **Python**: 3.13 (see `.python-version`)
- **uv**: Python package and environment manager (always prefer `uv run` for execution)

### Required Services
Start databases with Docker before running local services:
- **Astro dev**: port `5173` (run `pnpm dev`)
- **MongoDB**: port `27017` (run container `mongo:6`)
- **Redis**: port `6379` (run container `redis:7`)
- **PostgreSQL**: port `5432` (run container `postgres:15`)

For local integration tests, override environment variables if running with external databases to avoid hanging on remote connections:
```bash
REDIS_URL=redis://localhost:6379/0 \
UPSTASH_REDIS_REST_URL=redis://localhost:6379/0 \
pnpm vitest run -c config/vitest.config.ts
```

### Key Commands
- **Lint**: `pnpm lint` (oxlint; pre-existing warnings expected)
- **Typecheck**: `pnpm typecheck`
- **Tests**: `pnpm vitest run -c config/vitest.config.ts`
- **All Services**: `pnpm dev:all-services`
- **Build**: `pnpm build`

---

## Core Developer Rules

### ✅ Always
- **Global Configuration Hygiene**: Keep agent-specific dotfiles at `~/.<agent_name>`. Never create or commit agent-specific folders or configuration files at the project level.
- **Continuity First**: Respect guidelines in this root `AGENTS.md` followed by any subdirectory-specific instruction files.
- **Surgical Edits**: Keep changes minimal, safe, and tightly scoped. Remove only imports, variables, or assets made completely obsolete by your edits.
- **Assumptions-First & Simplicity**: Never assume undocumented behaviors. Write clear, readable, self-documenting code.
- **Privacy & Safety Gating**: Strongly preserve therapeutic, privacy, and HIPAA-compliant boundaries for client/patient-facing workflows. Isolated clinical health data is paramount.
- **Verify Explicitly**: Validate edits with concrete commands (e.g. tests or lint targets) before completion.

### ⚠️ Ask First
- Modifying authentication, security controls, or clinical gating.
- Modifying public API contracts, routing architectures, or CI/CD pipelines.

### 🚫 Never (Strict Anti-Suppression Policy)
> [!IMPORTANT]
> **No suppression.** Never mask linter errors, TypeScript errors, compile warnings, or test failures. Fix the issue—never hide it.

**Strictly forbidden suppressions and bypasses:**
- **TypeScript**: `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error` (unless strictly required in pre-existing test mock files).
- **Python**: `# noqa`, `# type: ignore` (do not bypass linting or pyright checks).
- **JavaScript / ESLint**: `/* eslint-disable */` or file-level/block-level rule exclusions to cover up new warning flags.
- **Configuration Bypasses**: Modifying `tsconfig.json`, `.eslintrc`, `.oxlintrc`, or test configs to lower strictness or hide failures.
- **Secrets & PHI**: Hardcoding credentials, API tokens, passwords, or patient-identifiable details in the codebase, fixtures, or test environments.

---

## Foresight Memory & Continuity System

**Foresight is the persistent brain for AI agents.** AI sessions are stateless—without Foresight, each session starts fresh, repeating mistakes and forgetting decisions.

### Quick Summary

Foresight provides two continuity layers:
1. **Context Blocks** — Tenant-isolated SQLite-persisted guidance (project_context, pending_items, guidance, user_preferences, session_patterns, etc.)
2. **Memory Store** — Semantic storage for observations, preferences, lessons learned

### Task Start Workflow (Mandatory)

Before substantial work, execute the continuity handshake:

1. **Query**: `manage_context_blocks` → get `project_context` + `pending_items`
2. **Search**: `query_memories` with keywords related to your task
3. **Inject**: Use findings to inform your approach
4. **Update**: Store lessons, mark completed items, update guidance

### Key Tools
- `manage_context_blocks` / `get_context_whisper` / `get_context_snapshot` — Context management
- `store_memory` / `query_memories` / `list_memories` — Memory operations
- `manage_curation_runs` — Async memory curation

### When to Use
- Starting work → query context first
- Making decisions → store learnings
- User preferences → persist immediately
- Resuming → check pending_items

**Full reference**: See `.agents/skills/foresight/SKILL.md`

**Fallback**: If MCP unavailable, use `.cursor/memory/scripts/bootstrap-memory-session.sh`

---

## Delivery Checks (Task Completion Contract)

Before ending a turn and finishing a task, perform the following checks:
1. **Restate the Goal**: Briefly describe what was requested and what was achieved.
2. **Review Diffs**: Ensure edits are minimal, clean, safe, and do not contain suppression comments.
3. **Execute Verification Command**: Run a target check (e.g. `pnpm lint`, `pnpm typecheck`, or targeted tests).
4. **Report Outcome & Risk**: Detail test results, highlight any residual risks or assumptions made, and propose the next steps.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ccf33ec3 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See
[beads/docs/SYNC_CONCEPTS.md](https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md) for details and anti-patterns.

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
