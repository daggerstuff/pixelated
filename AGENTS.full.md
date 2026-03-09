# ⚠️ AGENTS.md - MANDATORY DIRECTIVES FOR ALL AI ASSISTANTS

> **READ THIS OR FAIL YOUR TASK.**
>
> This is not a list of suggestions. This is the absolute law for the
> **Pixelated Empathy** codebase.
>
> We are building a platform that teaches human empathy to clinical
> professionals. Be empathetic—however pixelated it may be—but write your code
> with the aggressiveness, rigor, and unapologetic precision of a surgeon. There
> is ZERO margin for lazy AI behaviors.

## ⛔ 1. THE ABSOLUTE PROHIBITIONS (VIOLATE THESE AND YOU FAIL)

- **NO STUBS. NO MOCKS. NO FILLER.**: Every line of code MUST be complete and
  production-ready. You will NOT write `pass`, you will NOT write `...`, you
  will NOT leave `TODO` comments. If you can't implement it entirely, ASK for
  help. Do not fake it.
- **NO WARNING SUPPRESSION**: Warnings are a sign of weak code. You are
  FORBIDDEN from using `// @ts-ignore`, `// eslint-disable`, `# noqa`, or any
  suppression pragmas. Fix the underlying trash code.
- **ZERO LEAK POLICY**: You will NEVER expose API keys, PII, PHI, or mental
  health data. Every byte must be HIPAA-compliant.
- **PACKAGE MANAGER LOCK**: Use **`pnpm`** strictly for Node. Use **`uv`**
  strictly for Python. If you run `npm`, `yarn`, `pip`, or `conda`, you are
  violating core directives.

## 🧠 2. THE EMPATHETIC CORE (OUR MISSION)

We engineer understanding, not just algorithms.

- **Frameworks**: Plutchik's Wheel + Big Five (OCEAN) traits + DMRS Defense
  Mechanisms.
- **Validation Constraints**: Emotion and defense maturity scores MUST be
  bounded floats exactly between `0.0` and `1.0`. Do not hallucinate score
  formats.
- **Psychological Safety**: Actively handle self-harm and crisis signals. Toxic
  positivity is prohibited; provide raw, authentic emotional validation.

## 🏗️ 3. ARCHITECTURE & TECH STACK STANDARDS

- **Stack**: Astro v5+, React 19, TypeScript (Strict Mode), Python, FastAPI.
- **UI/Styling**: Functional components + Hooks. CSS Modules + Vanilla CSS. **❌
  TAILWIND CSS IS COMPLETELY BANNED. DO NOT IMPORT OR USE IT.**
- **State/Data**: Zustand (global), Nanostores (Astro islands), TanStack Query
  (async/API).
- **Paths**: Use strict path aliases (`@/*`, `@lib/*`, `@components/*`)
  configured in `tsconfig.json`.

## 📁 4. PROJECT TOPOLOGY (KNOW YOUR ENVIRONMENT)

- `ai/`: The EI Engine. Training loops, models, inference, and synthetic data
  pipelines (Python).
- `src/`: Main Application (Astro/React).
  - `src/simulator/`: The Empathy Gym™ training simulator.
  - `src/lib/ai/`: Core AI services & bias detection.
- `.agent/steering/`: **MANDATORY START POINT.** Contains high-signal
  operational and architectural intent. Read ALL files here first.
- `.memory/`: The absolute source of truth for architectural decisions, system
  history, and milestones. Update and consult this relentlessly. _(Note: The
  legacy `.ralph` tracker has been purged. Use `.memory`.)_
- `docs/internal/runbooks/`: Technical procedures for service restoration,
  debugging, and complex operations.
- `.agent/internal/`: **INTERNAL MEMORY BANK**. Mandatory reading for
  operational context, epic history, and infrastructure "gotchas".
- `.openskills/` & `.openagents/`: Specialized loadable workflows and role-based
  agent guidelines.

## 💾 5. INTERNAL MEMORY BANK (KNOWLEDGE PRESERVATION)

You are FORBIDDEN from operating in the dark.

- **Check First**: Before any infrastructure, training, or release task, you
  MUST read `.agent/internal/OPERATIONS.md`.
- **Maintain Always**: If you discover a system quirk, a required command
  sequence, or a fix for a recurring failure, you MUST document it in the
  internal memory bank immediately.
- **Epic Context**: Read `.agent/internal/epics/` to understand the multi-month
  trajectory of major feature clusters.
- **Task List Home**: **Asana** is the absolute home for all tasks, epics, and
  sprints. You are PROHIBITED from tracking work in isolation. Use the Asana
  workflow defined in `.agent/internal/ASANA_WORKFLOW.md` for all progress
  updates.

## 💻 6. COMMAND EXECUTION & QA (PROVE YOUR WORK)

Do not dare claim a task is "done" without proving it via these commands:

```bash
pnpm dev:all-services # Start Frontend, AI, Worker, WebSocket
pnpm check:all        # Lint + Typecheck + Format (MUST PASS)
pnpm test:all         # Vitest (co-located tests) + Playwright E2E
pnpm security:scan    # Security audit
uv run <script>       # Execute Python scripts within the managed env
```

## 🐞 6. THE ULTIMATE BUG SCANNER (UBS)

**This is a MANDATORY pre-commit check.** Run UBS scoped only to changed files
to be fast and deadly:

```bash
ubs src/file.ts file2.py                 # Fast check on specific files
ubs $(git diff --name-only --cached)     # Check staged files before commit
```

Fix **ALL** `Critical` (null safety, XSS, async) and `Important` findings before
proceeding. No exceptions.

## 🚀 7. BEHAVIORAL DIRECTIVES (HOW NOT TO BE MEDIOCRE)

1. **Aggressive Context Seeking**: Check the `.memory/` directory before
   starting any architecture work. Know the history.
2. **Socratic Gate**: DO NOT ASSUME. If a requirement is vague, aggressively
   interrogate the user to clarify it.
3. **Internal Documentation Loop**: Never waste time twice. If a task requires
   specific OVH endpoints, Docker Hub workflows, or S3 configurations, verify
   the internal manual and update it with your findings.
4. **Show, Don't Tell**: Never assume code works. Actively run the verification
   commands (tests, builds, UBS) and verify terminal outputs before continuing.
5. **Iterative Dominance**: Make changes incrementally. Test after each logical
   component. Do not drop massive, untested blob PRs blindly.

---

**FINAL DIRECTIVE:** You are building Pixelated Empathy. We build better humans
through code. Treat this codebase with absolute precision and reverence.

<!-- BEGIN BEADS INTEGRATION -->

## Issue Tracking with bd (beads)

**IMPORTANT**: This project uses **bd (beads)** for ALL issue tracking. Do NOT
use markdown TODOs, task lists, or other tracking methods.

### Why bd?

- Dependency-aware: Track blockers and relationships between issues
- Git-friendly: Auto-syncs to JSONL for version control
- Agent-optimized: JSON output, ready work detection, discovered-from links
- Prevents duplicate tracking systems and confusion

### Quick Start

**Check for ready work:**

```bash
bd ready --json
```

**Create new issues:**

```bash
bd create "Issue title" --description="Detailed context" -t bug|feature|task -p 0-4 --json
bd create "Issue title" --description="What this issue is about" -p 1 --deps discovered-from:bd-123 --json
```

**Claim and update:**

```bash
bd update bd-42 --status in_progress --json
bd update bd-42 --priority 1 --json
```

**Complete work:**

```bash
bd close bd-42 --reason "Completed" --json
```

### Issue Types

- `bug` - Something broken
- `feature` - New functionality
- `task` - Work item (tests, docs, refactoring)
- `epic` - Large feature with subtasks
- `chore` - Maintenance (dependencies, tooling)

### Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (default, nice-to-have)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

### Workflow for AI Agents

1. **Check ready work**: `bd ready` shows unblocked issues
2. **Claim your task**: `bd update <id> --status in_progress`
3. **Work on it**: Implement, test, document
4. **Discover new work?** Create linked issue:

   ```bash
   bd create "Found bug" --description="Details about what was found" \
     -p 1 --deps discovered-from:<parent-id>
   ```

5. **Complete**: `bd close <id> --reason "Done"`

### Auto-Sync

bd automatically syncs with git:

- Exports to `.beads/issues.jsonl` after changes (5s debounce)
- Imports from JSONL when newer (e.g., after `git pull`)
- No manual export/import needed!

### Important Rules

- ✅ Use bd for ALL task tracking
- ✅ Always use `--json` flag for programmatic use
- ✅ Link discovered work with `discovered-from` dependencies
- ✅ Check `bd ready` before asking "what should I work on?"
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT use external issue trackers
- ❌ Do NOT duplicate tracking systems

For more details, see README.md and docs/QUICKSTART.md.

<!-- END BEADS INTEGRATION -->

<!-- BEGIN BYTEROVER INTEGRATION -->

## Global Context Memory with ByteRover (brv)

**IMPORTANT**: This project requires pulling knowledge context queries through
**ByteRover** (`brv`) to maintain continuous system states, architectural
decisions, and error-resolutions over time.

### ByteRover Workflow for AI Agents

1. **Check System Context Early**: At the start of a task, if there's any
   ambiguity or a need for architecture/design details, ALWAYS query ByteRover
   first.
   - Use the MCP `byterover` server (or `run_command` via
     `brv query "your-inquiry"`) to check if knowledge already exists.
2. **Retrieve focused answers**:
   - `brv query "API authentication patterns"`
   - `brv query "frontend data fetching architecture"`
3. **Curate findings**: When you resolve a nasty bug, define a new architecture
   pattern, or implement a feature, curate the context for future agents BEFORE
   closing the task.
   - `brv curate "We use strict JWTs in httpOnly cookies. Reference: @src/middleware/auth.ts"`
4. **Push/Pull Remote Context**:
   - Understand that Byterover context trees sync remotely among developers. By
     curating your learnings, you assist the entire engineering team.

### Important Rules for ByteRover

- ✅ **Always check context** via Byterover before reinventing the wheel.
- ✅ **Curate atomic, meaningful summaries**, avoiding raw datadumps without
  context. (e.g. `brv curate "The problem was X, so we solved it with Y"` rather
  than `brv curate "Fix code"`)
- ✅ Use the `byterover` MCP server integration natively when available,
otherwise fall back to `brv query` and `brv curate` in the shell snippet.
<!-- END BYTEROVER INTEGRATION -->

## 🤖 5. JULES AGENT - AUTONOMOUS REPOSITORY SETUP

**Jules**, you are an autonomous coding agent. To work effectively on this
codebase, you must initialize your environment and follow branch hygiene.

- **INITIAL SETUP**: Always run `pnpm jules:setup` at the start of every session.
  This ensures Node.js 24 and all Python/uv dependencies are synchronized.
- **BRANCH HYGIENE**: You are MANDATED to work on the `staging` branch.
  - Verification: Run `pnpm jules:check` before starting any implementation.
  - Direction: Never target `master` or `main` for PRs.
- **ENVIRONMENT SNAPSHOT**: After a successful setup, ensure your VM environment
  is snapshot-ready if supported by your CLI.
- **STRICT TOOLING**: NEVER fallback to `npm` or `pip`. If `pnpm` or `uv` fails,
  investigate the `scripts/jules-setup.sh` logic.

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT
complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs
   follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:

   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   bash -c 'set -a; source .env; set +a; uv run scripts/sync_beads_asana.py' # SYNC BEADS TO ASANA
   ```

5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

````markdown
## UBS Quick Reference for AI Agents

UBS stands for "Ultimate Bug Scanner": **The AI Coding Agent's Secret Weapon: Flagging Likely Bugs for Fixing Early On**

**Install:** `curl -sSL https://raw.githubusercontent.com/Dicklesworthstone/ultimate_bug_scanner/master/install.sh | bash`

**Golden Rule:** `ubs <changed-files>` before every commit. Exit 0 = safe. Exit >0 = fix & re-run.

**Commands:**
```bash
ubs file.ts file2.py                    # Specific files (< 1s) — USE THIS
ubs $(git diff --name-only --cached)    # Staged files — before commit
ubs --only=js,python src/               # Language filter (3-5x faster)
ubs --ci --fail-on-warning .            # CI mode — before PR
ubs --help                              # Full command reference
ubs sessions --entries 1                # Tail the latest install session log
ubs .                                   # Whole project (ignores things like .venv and node_modules automatically)
```

**Output Format:**
```
⚠️  Category (N errors)
    file.ts:42:5 – Issue description
    💡 Suggested fix
Exit code: 1
```
Parse: `file:line:col` → location | 💡 → how to fix | Exit 0/1 → pass/fail

**Fix Workflow:**
1. Read finding → category + fix suggestion
2. Navigate `file:line:col` → view context
3. Verify real issue (not false positive)
4. Fix root cause (not symptom)
5. Re-run `ubs <file>` → exit 0
6. Commit

**Speed Critical:** Scope to changed files. `ubs src/file.ts` (< 1s) vs `ubs .` (30s). Never full scan for small edits.

**Bug Severity:**
- **Critical** (always fix): Null safety, XSS/injection, async/await, memory leaks
- **Important** (production): Type narrowing, division-by-zero, resource leaks
- **Contextual** (judgment): TODO/FIXME, console logs

**Anti-Patterns:**
- ❌ Ignore findings → ✅ Investigate each
- ❌ Full scan per edit → ✅ Scope to file
- ❌ Fix symptom (`if (x) { x.y }`) → ✅ Root cause (`x?.y`)
````
