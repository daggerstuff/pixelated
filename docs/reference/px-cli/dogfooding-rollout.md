# px CLI — Phased Agent Activation (Dogfooding Rollout)

> **PIX-4252** — Phase 6: Phased Agent Activation (Dogfooding Rollout)

This document describes the rollout plan for activating px CLI agents in the
captain's daily workflow, across three waves.

## Prerequisites

- `px init` has been run (git hooks installed, config written)
- `px health` shows all target agents as `ok`
- Phases 1–5 are complete (command registration, hook scripts, config schema)

## Wave 1 — Advisor & Content Agents

**Agents:** `advisor`, `content`
**Duration:** 1 week minimum before Wave 2

### Activation Steps

1. **Advisor agent** — review code on every push:

   ```bash
   # Manual invocation
   px advisor review
   px advisor review --json
   px advisor review --dry-run

   # Automatic via git hook (pre-push)
   # Already wired in px.config.json: pre-push → advisor.review
   ```

2. **Content agent** — audit clinical corpus on commit:

   ```bash
   # Manual invocation
   px content audit
   px content corpus
   px content score --body '{"thread_id": "..."}'

   # Automatic via git hook (pre-commit)
   # Already wired in px.config.json: pre-commit → content.audit_clinical_corpus
   # Filter: scenarios/** (only triggers on scenario file changes)
   ```

### Feedback Collection

Track the following during Wave 1:

- **Advisor review quality:** Are the code review findings actionable? False positives?
- **Content audit accuracy:** Does the clinical corpus audit catch real safety issues?
- **Hook reliability:** Do pre-commit/pre-push hooks fail-open correctly when agents are unreachable?
- **Latency:** Is the agent response time acceptable for interactive use?

### Gate Criteria for Wave 2

- [ ] Wave 1 agents actively used for ≥ 1 week
- [ ] Feedback gathered on advisor-agent review quality
- [ ] Feedback gathered on content-agent audit accuracy
- [ ] No blocking issues identified

## Wave 2 — QA & Supervisor Agents

**Agents:** `qa`, `supervisor`
**Gate:** Ops/quality work has begun

### Available Commands

```bash
# QA agent (async by default)
px qa score --body '{"session_id": "..."}'
px qa sessions
px qa patterns --body '{"cohort_id": "..."}'
px qa flag --body '{"trainee_id": "...", "gap": "..."}'
px qa summarize --body '{"cohort_id": "..."}'
px qa report --body '{"cohort_id": "..."}'

# Supervisor agent
px supervisor report --body '{"cohort_id": "..."}'
px supervisor flagged
px supervisor trends --body '{"cohort_id": "..."}'
px supervisor compare --body '{"trainee_a": "...", "trainee_b": "..."}'
px supervisor timeline --body '{"trainee_id": "..."}'
px supervisor threshold --body '{"metric": "...", "value": ...}'
px supervisor status --body '{"trainee_id": "...", "status": "..."}'
px supervisor notify --body '{"message": "..."}'
```

## Wave 3 — Pipeline, Session & Intake Agents

**Agents:** `pipeline`, `session`, `intake`
**Gate:** Clinical user onboarding timeline

### Available Commands

```bash
# Pipeline agent (async by default)
px pipeline health
px pipeline train --body '{"model": "...", "dataset": "..."}'
px pipeline eval --body '{"model": "...", "benchmark": "..."}'
px pipeline staging --body '{"model": "...", "version": "..."}'
px pipeline promote --body '{"model": "...", "version": "..."}'
px pipeline rollback --body '{"model": "...", "target_version": "..."}'

# Session agent
px session start --body '{"trainee_id": "..."}'
px session message --body '{"session_id": "...", "message": "..."}'
px session emotion --body '{"session_id": "..."}'
px session pace --body '{"session_id": "..."}'
px session boundary --body '{"session_id": "...", "response": "..."}'
px session validate --body '{"session_id": "...", "response": "..."}'
px session hydrate --body '{"session_id": "..."}'
px session save --body '{"session_id": "..."}'
px session conclude --body '{"session_id": "..."}'

# Intake agent
px intake register --body '{"trainee_id": "...", "name": "..."}'
px intake assign --body '{"trainee_id": "...", "cohort_id": "..."}'
px intake cohorts
px intake status --body '{"trainee_id": "..."}'
px intake progress --body '{"cohort_id": "..."}'
px intake curriculum --body '{"trainee_id": "...", "step": ...}'
```

## All Commands Reference

Every agent supports these shared flags:

| Flag            | Description                         |
| --------------- | ----------------------------------- |
| `--body <json>` | JSON request body                   |
| `--stdin`       | Read JSON body from stdin           |
| `--json`        | Output raw JSON response            |
| `--async`       | Force async mode (returns task ID)  |
| `--sync`        | Force sync mode (wait for result)   |
| `--verbose`     | Show request/response details       |
| `--dry-run`     | Print payload without calling agent |
| `--compact`     | Single-line summary output          |
| `--no-color`    | Disable colored output              |

Both short aliases and full tool names work:

```bash
px qa score          # short alias
px qa score_session  # full tool name
```

## Local Development

### px serve — Local Stub Server

For local development without K8s agent endpoints, start a stub server:

```bash
# Start stub server on default port 2000
px serve

# Start on custom port
px serve --port 3000

# Serve only one agent (for multi-instance testing)
px serve --agent advisor
```

When `PX_LOCAL=1` is set in the environment, all `px` commands route to
`http://localhost:2000` automatically. The stub server returns realistic
mock responses for all 45 tool endpoints across 7 agents.

```bash
# Terminal 1: start stub server
px serve

# Terminal 2: use px commands (routes to localhost)
PX_LOCAL=1 px advisor review
PX_LOCAL=1 px advisor review --compact
PX_LOCAL=1 px advisor review --json
```

### Git Hook Installation

Install configured git hooks from `agents/px.config.json`:

```bash
# Preview hooks that would be installed (no files written)
px hook install --preview

# Install hooks (refuses to overwrite existing hooks)
px hook install

# Force overwrite existing hooks
px hook install --force
```

Installed hooks:

| Hook         | Agent    | Tool                     | Notes                          |
| ------------ | -------- | ------------------------ | ------------------------------ |
| `pre-commit` | content  | `audit_clinical_corpus`  | Filters to `scenarios/**`      |
| `pre-push`   | advisor  | `review`                 | Blocks push on high-risk findings |
| `post-merge` | pipeline | `check_pipeline_health`  | Async — posts to Slack         |

### CI Integration

GitHub Actions workflow at `.github/workflows/px-agents.yml`:

- **PR open/sync**: runs `px advisor review` and posts findings as a PR comment
- **Push to staging**: runs `px qa score` and uploads results as an artifact

Both CI jobs use `px serve` + `PX_LOCAL=1` to run against the stub server.
