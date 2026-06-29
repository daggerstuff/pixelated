# AGENTS.md

## Runtime & Local Services

### Product Overview
Pixelated Empathy is clinical AI platform built w/ Astro 6 + React 19 (TypeScript) for frontend/SSR, and Express/FastAPI/Flask backend services.

### Runtime Versions
- **Node.js**: 24.16.0 (see `.nvmrc`)
- **pnpm**: 11.9.0 (see `package.json`)
- **Python**: 3.13 (see `.python-version`)
- **uv**: Python package and environment manager (always prefer `uv run` for execution)

### Required Services
Start databases w/ Docker before running local services:
- **Astro dev**: port `5173` (run `pnpm dev`)
- **MongoDB**: port `27017` (run container `mongo:6`)
- **Redis**: port `6379` (run container `redis:7`)
- **PostgreSQL**: port `5432` (run container `postgres:15`)

For local integration tests, override environment variables if running w/ external databases to avoid hanging on remote connections:
```bash
REDIS_URL=redis://localhost:6379/0 \
UPSTASH_REDIS_REST_URL=redis://localhost:6379/0 \
pnpm vitest run -c config/vitest.config.ts
```

### Key Commands
- **Submodules**: `git submodule init && git submodule update` (run after clone/pull, before `pnpm install`)
- **Lint**: `pnpm lint` (oxlint; pre-existing warnings expected)
- **Typecheck**: `pnpm typecheck`
- **Tests**: `pnpm vitest run -c config/vitest.config.ts`
- **All Services**: `pnpm dev:all-services`
- **Build**: `pnpm build`

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

**Foresight is persistent brain for AI agents.** AI sessions are stateless—w/o Foresight, each session starts fresh, repeating mistakes and forgetting decisions.

### Quick Summary

Foresight provides two continuity layers:
1. **Context Blocks** — Tenant-isolated SQLite-persisted guidance (project_context, pending_items, guidance, user_preferences, session_patterns, etc.)
2. **Memory Store** — Semantic storage for observations, preferences, lessons learned

### Task Start Workflow (Mandatory)

Before substantial work, execute continuity handshake:

1. **Query**: `manage_context_blocks` → get `project_context` + `pending_items`
2. **Search**: `query_memories` w/ keywords related to your task
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

## Droid Workflow: Spec Mode & Missions

For non-trivial work, prefer Droid's two structured workflows. Treat them as
 default shape of any multi-step change rather than ad-hoc prompting.

### Specification Mode (single-feature planning)

Use when feature is well-scoped but still benefits from explicit approval
before code lands.

- **Trigger**: complex/single-feature work (touching ≥1 framework surface area
  or any change spanning feature boundary).
- **How**: press **Shift+Tab** before sending prompt, or invoke `/spec`.
  Droid produces plan, you approve it, then it executes.
- **Output**: in-repo `IMPLEMENTATION_PLAN.md` (or scoped filename) for
  auditability.
- **Prompt shape**: state goal in one sentence, list constraints
  related files, name verification command (`pnpm test:unit`
  `pnpm lint`targeted Playwright spec, etc.).
- **Best practice**: keep phases to 1-2 days of work each; one behavior per
  phase; one concrete verification per phase. ([Implementing Large
  Features guide](https://docs.factory.ai/cli/user-guides/implementing-large-features))

### Missions (multi-feature orchestration)

Use when work decomposes into multiple features, multiple milestones,
multiple subagents working in parallel.

- **Trigger**: large refactors (50+ files), component migrations, big
  multi-feature implementations (10+ files), or anything where planning
  phase is actual value.
- **How**: invoke `/missions`. Droid collaborates on plan, derives
  features + milestones, leverages existing skills (and develops new ones if
  needed), then hands approved plan to Mission Control for orchestration.
- **Inheritance**: your MCPs, skills, hooks, custom droids, `AGENTS.md`
  carry into missions automatically.
- **Stay engaged**: treat yourself as PM. Pause and redirect when:
  - worker is stuck ("mark this complete and move to next feature");
  - milestone is blocked ("re-assess and tell me what's blocking");
  - plan needs to change ("drop X, add Y, re-plan remaining milestones").
  See `~/.factory/missions/README.md` for full recovery playbook.
- **Heuristic for cost**: roughly `#features + 2 × #milestones` worker runs.
  Plan validation upfront is cheaper than rework after.
- **Headless mode**: `droid exec --mission -f mission.md` for CI / scheduled
  missions. Tunes via `--worker-model` `--validator-model`
  `--worker-reasoning-effort` `--validator-reasoning-effort`.

### How to Talk to a Droid (always-on principles)

Apply these to every prompt — Spec Mode, Missions, or direct work. Pulled
from [How to Talk to Droid guide](https://docs.factory.ai/cli/getting-started/how-to-talk-to-a-droid).

- **Be explicit about goal.** State outcome up front.
- **Provide context.** Include file paths, error messages, ticket links.
- **Choose approach.** Spec for complex single features, Missions for
  multi-feature work, direct for routine fixes.
- **Define success.** Name verification command, expected output,
  and surface to check.
- **Reference files directly.** Use `@file.ts` or full paths.
- **Set boundaries.** "Only modify files in auth dir" contained
  scope.
- **Reference external resources by URL.** Droid fetches them.
- **Break large projects up.** New sessions per phase or feature.

### Soft recommendation

Spec Mode and Missions are *recommended* workflows — not hard gates. Small,
clarified, well-scoped tasks can be completed directly. Treat bar as
"would I benefit from writing this down before code lands?" If yes, use Spec
or Mission.

---

## Cursor Cloud specific instructions

### Node.js PATH
Cloud VMs ship `/exec-daemon/node` (v22) ahead of nvm on `PATH`. Prepend Node 24 before running pnpm scripts:
```bash
export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"
```
(`~/.bashrc` in this environment is configured to do this in interactive shells.)

### Docker
- Cloud VMs may not have Docker preinstalled. If `docker info` fails, install Docker CE and start `dockerd` manually (systemd often cannot start service here):
  ```bash
  sudo dockerd >/tmp/dockerd.log 2>&1 &
  ```
  Use `sudo docker` / `sudo -E docker compose` unless your user is in `docker` group.
- Compose files require secrets on command line (not only in `.env`):
  ```bash
  export POSTGRES_PASSWORD=dev_password_change_in_prod
  export REDIS_PASSWORD=dev_redis_password
  export PGBOUNCER_PASSWORD=dev_pgbouncer_password
  sudo -E docker compose -f docker/docker-compose.db.yml up -d postgres redis
  sudo docker network create docker_web 2>/dev/null || true
  sudo docker compose -f docker/docker-compose.local-mongo.yml up -d
  ```
- Redis binds to `127.0.0.1:6379` w/ `--requirepass`use `redis://:dev_redis_password@127.0.0.1:6379/0` in `.env` and test overrides.

### Local `.env` bootstrap
If `.env` is missing, derive Postgres user/db from running container and write local URLs (see `WALKTHROUGH.md`). Do not commit `.env`.

### E2E against an already-running dev server
Install browsers once per VM: `pnpm exec playwright install chromium`

```bash
DISABLE_PLAYWRIGHT_WEBSERVER=1 BASE_URL=http://127.0.0.1:5173 \
  pnpm exec playwright test tests/e2e/infrastructure/ssr-functionality.spec.ts \
  --config=config/playwright.config.ts --project=chromium
```

### Submodules
After clone or when `.gitmodules` changes, run these **before** `pnpm install`
```bash
git submodule init
git submodule update
pnpm install --no-frozen-lockfile
```
Use `--no-frozen-lockfile` for local and CI installs to avoid frozen-lockfile retry/failover loops when lockfile drifts.

For CI/auth-aware shallow clones, use `bash scripts/devops/init-submodules.sh` instead of plain `git submodule` commands.

### Long-running dev server
Use tmux (not one-shot background shells) for `pnpm dev` on port `5173`.

---

## Dispatch Resume Gate (mandatory)

Every monthly-llm-driver worker MUST call `dispatch_resume_gate.scan(month, CHUNKS_DIR)` BEFORE the first chat_completion POST.

If `scan` returns `missing_or_partial > 0` AND `stale_dispatch_pid` is alive, worker MUST:
1. Call `kill_stale_dispatch(month)` first
2. Wait 30 seconds
3. Write `/tmp/wayfarer_smoke/resume_<month>.json` with the resume plan (skip_list, re_dispatch_list, fresh_dispatch_list, rollover_wall_seconds)
4. Only then launch new chunks from `fresh_dispatch_list`

The `resume_<month>.json` file is a durable contract: if the worker dies before
completing all chunks, the next worker resumes from `fresh_dispatch_list` and
writes a new `resume_<month>.json` next attempt, never restarting from chunk 1
unless `kill_stale_dispatch` and `scan` both report zero on-disk state.

Workers MUST NOT bypass the gate for short halving loops. The gate runs in <5 s on the chunks tree and protects against every future silent-failure pattern.

**Reference**: `skills/monthly-llm-driver/dispatch_resume_gate.py` (spec + implementation), `library/dispatch_resume_gate.md` (worked M02 example).

---

## Delivery Checks (Task Completion Contract)

Before ending turn and finishing task, perform following checks:
1. **Restate Goal**: Briefly describe what was requested and what was achieved.
2. **Review Diffs**: Ensure edits are minimal, clean, safe, and do not contain suppression comments.
3. **Execute Verification Command**: Run target check (e.g. `pnpm lint` `pnpm typecheck`or targeted tests).
4. **Report Outcome & Risk**: Detail test results, highlight any residual risks or assumptions made, and propose next steps.
