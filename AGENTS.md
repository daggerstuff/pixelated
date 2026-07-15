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

- `.factory/rules/typescript.md` - TypeScript and React patterns
- `.factory/rules/astro.md` - Astro 6 component, routing, and SSR rules
- `.factory/rules/python.md` - Python/uv toolchain and ruff/pyright conventions
- `.factory/rules/testing.md` - Vitest, Playwright, and pytest patterns
- `.factory/rules/security.md` - HIPAA, secrets, auth/gating, threat modeling

## Personal Preferences

Refer to `~/.factory/memories.md` for personal coding preferences and past decisions.

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

This is a hard gate, not a suggestion. Every session touching real work MUST run the foresight continuity read as its **first action** — before any code edit,
exploration, or planning prose.

1. **GATE read (mandatory first action):** call `manage_context_blocks` with action `get` for `project_context` AND `pending_items`.
   No exceptions for "I already know", "quick task", or "I'll check after". Treat it like `git status` — first, always.
2. **Show your work (no silent skip):** in your first reply, state what the blocks returned — quote the entry count and a one-line summary per block.
   Example: "project_context: 3 entries — <one-line>; pending_items: 2 — <one-line>." A skip that isn't named is one the human can't audit.
3. **`search_memories`** w/ keywords related to your task — prior decisions live in memories; confirm or contradict what the blocks said.
4. **Use findings to inform your approach** — if a memory contradicts your plan, say so before editing.
5. **`manage_memories` to store** durable lessons/decisions when work completes; `manage_context_blocks` `update` on `pending_items` when scope shifts.

**Skipping the gate is not permitted without naming it.** If you decide it doesn't apply (pure conversation, no code), say so explicitly in the first reply and why.

### CLI Quick Reference

```bash
foresight store "text"         # Store a memory
foresight list                 # List all memories (newest first)
foresight query "search term"  # Keyword + hybrid search
foresight get <id>             # Get memory by ID
foresight doctor               # Health check — verifies DB + config
foresight status               # System health overview
foresight synthesize           # Find patterns & contradictions
foresight profile              # Build user profile from memories
```

### MCP Tool Reference

| Tool                         | Action                    | What it does                                       |
| ---------------------------- | ------------------------- | -------------------------------------------------- |
| `manage_memories`            | `store`                   | Save a new memory (content, scope, category, tags) |
| `manage_memories`            | `update`                  | Edit an existing memory by ID                      |
| `manage_memories`            | `delete`                  | Remove a memory by ID                              |
| `search_memories`            | —                         | Unified search: ID lookup, keyword, or hybrid      |
| `manage_context_blocks`      | `list` / `get` / `update` | Read/write context blocks                          |
| `inject_context`             | —                         | Surface memories relevant to current conversation  |
| `query_memories_temporal`    | —                         | Retrieve by time window or trend                   |
| `process_session_transcript` | —                         | Extract memories from session transcript           |
| `manage_curation_runs`       | —                         | Bulk reorganize memories (dedupe, rebalance)       |
| `get_system_status`          | —                         | Health check + memory counts                       |

### Best Practices

- **Store decisions, not transcripts** — "Chose streamable-http over stdio for MCP transport" beats 40 lines of deliberation
- **Tag by category** — `preference` `decision` `lesson` `fact` — makes search precise
- **Update context blocks when scope changes** — `pending_items` should reflect reality, not history
- **Don't hoard** — Foresight is for durable context, not session scratch. One-liners > paragraphs
- **Search before storing** — avoids duplicates; `search_memories` catches near-matches

### Infrastructure

- **Service**: systemd user service `foresight-mcp` on port `8764` (streamable-http, endpoint `/mcp`), launched via `scripts/memory/foresight-server.sh`
- **Storage**: Ghost Postgres — all machines read/write same DB
- **Config**: `.env` vars auto-loaded via `python-dotenv` — no `export` needed

```bash
systemctl --user status foresight-mcp     # Check if running
systemctl --user restart foresight-mcp    # Restart after code update
journalctl --user -u foresight-mcp -f     # Live logs
foresight doctor                          # Health check + memory count + DB status
```

### Troubleshooting

- **CLI writes to SQLite instead of Postgres**: Check `FORESIGHT_DB_URL` is in `.env` — `foresight doctor` shows active env overrides
- **MCP server down**: `systemctl --user restart foresight-mcp`
- **MCP client can't connect**: Verify port `8764` is listening (`ss -ltn | grep 8764`) and client URL is `http://127.0.0.1:8764/mcp`

---

## Droid Workflow: Spec Mode & Missions

Prefer Droid's structured workflows over ad-hoc prompting for non-trivial work.

### Spec Mode (single-feature)

- **Trigger**: ≥1 framework surface or feature-boundary change
- **How**: Shift+Tab before prompt, `/spec` → Droid produces plan → you approve → Droid executes
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

Spec Mode and Missions are _recommended_ — not hard gates. If "would this benefit from writing it down before code lands?" → use them.

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

After clone or when `.gitmodules` changes, run these **before** `pnpm install`

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

Every monthly_llm_driver worker MUST call `dispatch_resume_gate.scan(month, CHUNKS_DIR)` BEFORE first chat_completion POST.

If `scan` returns `missing_or_partial > 0` `stale_dispatch_pid` is alive, worker MUST:

1. Kill stale dispatch
2. Wait 30 seconds
3. Write `/tmp/wayfarer_smoke/resume_<month>.json` (skip_list, re_dispatch_list, fresh_dispatch_list, rollover_wall_seconds)
4. Launch chunks from fresh_dispatch_list

resume file is durable contract: if worker dies, next resume continues from fresh_dispatch_list only.

Workers MUST NOT bypass gate for short halving loops. gate runs <5 s on chunks tree and prevents silent failures.

**Reference**: `skills/monthly_llm_driver/dispatch_resume_gate.py` + `library/dispatch_resume_gate.md`

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
