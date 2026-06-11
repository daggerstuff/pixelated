# AGENTS.md

## Runtime & Local Services

### Product Overview
Pixelated Empathy is a clinical AI platform built with Astro 6 + React 19 (TypeScript) for the frontend/SSR, and Express/FastAPI/Flask backend services.

### Runtime Versions
- **Node.js**: 24.16.0 (see `.nvmrc`)
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
- **Submodules**: `bash scripts/devops/init-submodules.sh` (init + sync + update; run after clone/pull)
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

## Cursor Cloud specific instructions

### Node.js PATH
Cloud VMs ship `/exec-daemon/node` (v22) ahead of nvm on `PATH`. Prepend Node 24 before running pnpm scripts:
```bash
export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"
```
(`~/.bashrc` in this environment is configured to do this in interactive shells.)

### Docker
- Cloud VMs may not have Docker preinstalled. If `docker info` fails, install Docker CE and start `dockerd` manually (systemd often cannot start the service here):
  ```bash
  sudo dockerd >/tmp/dockerd.log 2>&1 &
  ```
  Use `sudo docker` / `sudo -E docker compose` unless your user is in the `docker` group.
- Compose files require secrets on the command line (not only in `.env`):
  ```bash
  export POSTGRES_PASSWORD=dev_password_change_in_prod
  export REDIS_PASSWORD=dev_redis_password
  export PGBOUNCER_PASSWORD=dev_pgbouncer_password
  sudo -E docker compose -f docker/docker-compose.db.yml up -d postgres redis
  sudo docker network create docker_web 2>/dev/null || true
  sudo docker compose -f docker/docker-compose.local-mongo.yml up -d
  ```
- Redis binds to `127.0.0.1:6379` with `--requirepass`; use `redis://:dev_redis_password@127.0.0.1:6379/0` in `.env` and test overrides.

### Local `.env` bootstrap
If `.env` is missing, derive Postgres user/db from the running container and write local URLs (see `WALKTHROUGH.md`). Do not commit `.env`.

### E2E against an already-running dev server
Install browsers once per VM: `pnpm exec playwright install chromium`

```bash
DISABLE_PLAYWRIGHT_WEBSERVER=1 BASE_URL=http://127.0.0.1:5173 \
  pnpm exec playwright test tests/e2e/infrastructure/ssr-functionality.spec.ts \
  --config=config/playwright.config.ts --project=chromium
```

### Submodules
After clone or when `.gitmodules` changes, initialize and update submodules before `pnpm install`:
```bash
bash scripts/devops/init-submodules.sh
```
Requires network access and `GITHUB_TOKEN`/`GITHUB_PAT` for private submodule repos when applicable.

### Long-running dev server
Use tmux (not one-shot background shells) for `pnpm dev` on port `5173`.

---

## Delivery Checks (Task Completion Contract)

Before ending a turn and finishing a task, perform the following checks:
1. **Restate the Goal**: Briefly describe what was requested and what was achieved.
2. **Review Diffs**: Ensure edits are minimal, clean, safe, and do not contain suppression comments.
3. **Execute Verification Command**: Run a target check (e.g. `pnpm lint`, `pnpm typecheck`, or targeted tests).
4. **Report Outcome & Risk**: Detail test results, highlight any residual risks or assumptions made, and propose the next steps.


