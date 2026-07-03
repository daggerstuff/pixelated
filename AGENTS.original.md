# AGENTS.md

## Runtime & Local Services

**Pixelated Empathy** — clinical AI platform: Astro 6 + React 19 (TypeScript) frontend/SSR; Express/FastAPI/Flask backend.

### Runtime Versions

| Tool | Version | Config |
|------|---------|--------|
| Node.js | 24.16.0 | `.nvmrc` |
| pnpm | 11.9.0 | `package.json` |
| Python | 3.13 | `.python-version` |
| uv | latest | preferred Python manager |

### Required Services
Start databases w/ Docker before running local services:
- **Astro dev**: `5173` → `pnpm dev`
- **MongoDB**: `27017` (container `mongo:6`)
- **Redis**: `6379` (container `redis:7`)
- **PostgreSQL**: `5432` (container `postgres:15`)

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
- `.factory/rules/typescript.md` - TypeScript and React patterns
- `.factory/rules/astro.md` - Astro 6 component, routing, and SSR rules
- `.factory/rules/python.md` - Python/uv toolchain and ruff/pyright conventions
- `.factory/rules/testing.md` - Vitest, Playwright, and pytest patterns
- `.factory/rules/security.md` - HIPAA, secrets, auth/gating, threat modeling

## Personal Preferences
Refer to `~/.factory/memories.md` for personal coding preferences and past decisions.

---

## Foresight Memory & Continuity System

Foresight is persistent brain for AI agents. Without it, each session starts fresh.

### Continuity Layers
1. **Context Blocks** — Tenant-isolated SQLite-persisted guidance (project_context, pending_items, guidance, user_preferences, session_patterns)
2. **Memory Store** — Semantic storage for observations, preferences, lessons learned

### Task Start Workflow (Mandatory)
Before substantial work:
1. `manage_context_blocks` → get `project_context` + `pending_items`
2. `search_memories` w/ keywords related to your task
3. Use findings to inform your approach
4. Use `manage_memories` to store lessons or update durable memory when needed

### Key Tools
- MCP surface: `manage_memories`, `search_memories`, `manage_context_blocks`,
  `process_session_transcript`, `manage_curation_runs`, `inject_context`,
  `query_memories_temporal`, `get_system_status`
- Expert/maintenance workflows: use the nested `foresight-mcp` CLI or Python
  API; direct aliases such as `store_memory`, `query_memories`, and
  `list_memories` are not exposed as MCP tools

**Full reference**: `.agents/skills/foresight/SKILL.md` | **Fallback**: `.cursor/memory/scripts/bootstrap-memory-session.sh`

---

## Droid Workflow: Spec Mode & Missions

Prefer Droid's structured workflows over ad-hoc prompting for non-trivial work.

### Spec Mode (single-feature)
- **Trigger**: ≥1 framework surface or feature-boundary change
- **How**: Shift+Tab before prompt, or `/spec` → Droid produces plan → you approve → Droid executes
- **Output**: in-repo `IMPLEMENTATION_PLAN.md`
- **Prompt**: goal in one sentence, constraints, related files, verification command
- **Best practice**: 1-2 day phases, one behavior per phase, one verification per phase
- **Reference**: `~/.agents/skills/droid-workflow/SKILL.md`

### Missions (multi-feature)
- **Trigger**: 50+ file refactors, big multi-feature implementations (10+ files)
- **How**: `/missions` → Droid collaborates on plan, derives features + milestones → hands to Mission Control
- **Stay engaged**: redirect stuck/blocked workers; re-plan if direction changes
- **Heuristic**: `#features + 2 × #milestones` worker runs. Plan validation upfront > rework after
- **Headless**: `droid exec --mission -f mission.md` for CI/scheduled missions
- **Reference**: `~/.agents/skills/droid-workflow/SKILL.md` + `~/.factory/missions/README.md`

### How to Talk to Droid (always-on)
- Be explicit about goal. Provide context (file paths, error messages, ticket links).
- Choose approach: Spec for single features, Missions for multi-feature, direct for routine fixes.
- Define success: name verification command + expected output.
- Reference files directly. Set boundaries. Break large projects into new sessions.

### Soft recommendation
Spec Mode and Missions are *recommended* — not hard gates. If "would this benefit from writing it down before code lands?" → use them.

---

## Cursor Cloud specific instructions

### Node.js PATH
Cloud VMs ship `/exec-daemon/node` (v22) ahead of nvm on `PATH`. Prepend Node 24 before running pnpm scripts:
```bash
export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"
```
(`~/.bashrc` in this environment is configured to do this in interactive shells.)

### Docker
Cloud VMs may not have Docker preinstalled. If `docker info` fails, install Docker CE and start `dockerd` manually:
```bash
sudo dockerd >/tmp/dockerd.log 2>&1 &
```
Use `sudo docker` / `sudo -E docker compose` unless your user is in `docker` group. Compose files require secrets on command line:
```bash
export POSTGRES_PASSWORD=dev_password_change_in_prod
export REDIS_PASSWORD=dev_redis_password
export PGBOUNCER_PASSWORD=dev_pgbouncer_password
sudo -E docker compose -f docker/docker-compose.db.yml up -d postgres redis
sudo docker network create docker_web 2>/dev/null || true
sudo docker compose -f docker/docker-compose.local-mongo.yml up -d
```

### E2E against already-running dev server
Install browsers once per VM: `pnpm exec playwright install chromium`
```bash
DISABLE_PLAYWRIGHT_WEBSERVER=1 BASE_URL=http://127.0.0.1:5173 \
  pnpm exec playwright test tests/e2e/infrastructure/ssr-functionality.spec.ts \
  --config=config/playwright.config.ts --project=chromium
```

### Submodules
After clone or when `.gitmodules` changes, run these **before** `pnpm install`:
```bash
git submodule init && git submodule update
pnpm install --no-frozen-lockfile
```
Use `--no-frozen-lockfile` for local and CI installs. For CI/auth-aware shallow clones, use `bash scripts/devops/init-submodules.sh` instead.

### Long-running dev server
Use tmux (not one-shot background shells) for `pnpm dev` on port `5173`.

### Local `.env` bootstrap
If `.env` is missing, derive Postgres user/db from running container and write local URLs (see `WALKTHROUGH.md`). Do not commit `.env`.

---

## Dispatch Resume Gate (mandatory)

Every monthly_llm_driver worker MUST call `dispatch_resume_gate.scan(month, CHUNKS_DIR)` BEFORE the first chat_completion POST.

If `scan` returns `missing_or_partial > 0` AND `stale_dispatch_pid` is alive, worker MUST:
1. Kill stale dispatch
2. Wait 30 seconds
3. Write `/tmp/wayfarer_smoke/resume_<month>.json` (skip_list, re_dispatch_list, fresh_dispatch_list, rollover_wall_seconds)
4. Launch chunks from fresh_dispatch_list

The resume file is a durable contract: if worker dies, next resume continues from fresh_dispatch_list only.

Workers MUST NOT bypass the gate for short halving loops. The gate runs <5 s on the chunks tree and prevents silent failures.

**Reference**: `skills/monthly_llm_driver/dispatch_resume_gate.py` + `library/dispatch_resume_gate.md`

---

## Delivery Checks (Task Completion Contract)

Before ending turn and finishing task, perform following checks:
1. **Restate Goal**: Briefly describe what was requested and what was achieved.
2. **Review Diffs**: Ensure edits are minimal, clean, safe, and do not contain suppression comments.
3. **Execute Verification Command**: Run target check (e.g. `pnpm lint` `pnpm typecheck`or targeted tests).
4. **Report Outcome & Risk**: Detail test results, highlight any residual risks or assumptions made, and propose next steps.
