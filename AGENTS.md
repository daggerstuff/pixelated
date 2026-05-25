# AGENTS.md

## Runtime & Local Services

### Product Overview
Pixelated Empathy is a clinical AI platform built with Astro 6 + React 19 (TypeScript) for the frontend/SSR, and Express/FastAPI/Flask backend services.

### Runtime Versions
- **Node.js**: 24.14.1 (see `.nvmrc`)
- **pnpm**: 11.1.2 (see `package.json`)
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
- **Global Configuration Hygiene**: Keep all agent-specific dotfiles, configs, and custom assets at the global home directory level (`~/.<agent_name>`). Never create or commit agent-specific folders or configuration files at the project level to avoid littering the codebase.
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
> **Sweeping quality, type, or linting issues under the rug is strictly prohibited.** Under no circumstances should linter errors, TypeScript errors, compile warnings, or test failures be masked using suppression comments or configuration downgrades.
> 
> *Fix the underlying issue—never hide it.*

**Strictly forbidden suppressions and bypasses:**
- **TypeScript**: `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error` (unless strictly required in pre-existing test mock files).
- **Python**: `# noqa`, `# type: ignore` (do not bypass linting or pyright checks).
- **JavaScript / ESLint**: `/* eslint-disable */` or file-level/block-level rule exclusions to cover up new warning flags.
- **Configuration Bypasses**: Modifying `tsconfig.json`, `.eslintrc`, `.oxlintrc`, or test configs to lower strictness or hide failures.
- **Secrets & PHI**: Hardcoding credentials, API tokens, passwords, or patient-identifiable details in the codebase, fixtures, or test environments.

---

## Foresight Memory & Continuity System

### Why Foresight is Necessary
AI agents are **stateless** across distinct terminal sessions, chat windows, and model invocations. Without a persistent memory layer, every new agent instantiation suffers from "amnesia"—losing track of active tasks, re-running redundant diagnostic commands, and ignoring user preferences or decisions agreed upon in past turns.

Foresight acts as the persistent brain of the agent, maintaining context and state between runs to ensure consistency, prevent repeating mistakes, and optimize the context window.

### Foresight Context Blocks
Context blocks represent SQLite-persisted, tenant-isolated alignment parameters and guidance.

| Context Block | Purpose |
| ------------- | ------- |
| `core_directives` | Global system constraints and behaviors that the agent must always respect. |
| `guidance` | Best practices, design systems, and engineering instructions tailored to the repo. |
| `pending_items` | Active TODOs, unresolved bugs, and tasks currently in progress. |
| `project_context` | High-level architecture brief, database schemas, and current sprint goals. |
| `session_patterns` | Lessons learned and recurring workflows discovered in the active session. |
| `user_preferences` | User-specific guidelines (e.g. style preferences, preferred commands). |
| `self_improvement` | Critiques and behavioral adjustments recorded from past agent evaluations. |
| `tool_guidelines` | Constraints on how specific tools, MCPs, or commands must be run. |

### Foresight Tool Reference
Use Foresight-native tool names on the public surface. Legacy aliases are supported for backwards compatibility:

| Legacy Aliases | Foresight-Native Tool Name | Description |
| -------------- | ------------------------- | ----------- |
| `manage_subconscious` | `manage_context_blocks` | Get, update, reset, or list the state of context blocks. |
| `get_subconscious_block` | `get_context_block` | Retrieve the raw content of a specific block. |
| `update_subconscious_block` | `update_context_block` | Safely update/write to a specific context block. |
| `add_subconscious_guidance` | `add_context_guidance` | Add concrete guidelines or rules to the context block. |
| `get_subconscious_whisper` | `get_context_whisper` | Generates a condensed system instruction summary. |
| `get_subconscious_context` | `get_context_snapshot` | Returns a full JSON bundle of all active context blocks. |
| `reset_subconscious_block` | `reset_context_block` | Reset a block back to its default system template. |
| `clear_subconscious_block` | `clear_context_block` | Completely erase all user overrides on a block. |

**Core Memory & Curation Tools:**
- `store_memory`: Saves new observations, preference facts, or safety events.
- `query_memories`: Fuzzy semantic search over stored memory nodes.
- `list_memories`: Fetch list of memories with tags/limit options.
- `get_memory` / `update_memory` / `delete_memory`: Direct CRUD on memory nodes.
- `manage_curation_runs`: Manage long-term curation runs (policy modes: `rebalance` or `in_place`).

### Task Start Workflow Integration (Mandatory)
Before beginning a substantial task, execute the continuity handshake:
1. **Query Foresight Context**: Run `manage_context_blocks` (or `manage_subconscious`) with `action: "get"` for `project_context` and `pending_items` to inherit the current state of work.
2. **Search Past Context**: Run `query_memories` with keywords related to your current task to see if there are past issues, fixes, or preferences to be aware of.
3. **Inject Context**: Update context blocks once milestones are met or patterns are observed.
4. **Fallback Procedure**: If the Foresight MCP server is unavailable or fails to connect:
   - Switch to the local continuity fallback in `.cursor/memory/` and run `scripts/memory/bootstrap-memory-session.sh` to update state manually.

### How to Configure Foresight
Add the server entrypoint to your agent client configuration file (e.g. Claude Code config, `mcp.json` / `config.json`):

```json
{
  "mcpServers": {
    "foresight": {
      "command": "/path/to/project/scripts/memory/foresight-mcp-server.sh",
      "args": [],
      "cwd": "/path/to/project/foresight-mcp",
      "env": {
        "FORESIGHT_DB_PATH": "/path/to/db/memory.db",
        "FORESIGHT_USER_ID": "user_id"
      }
    }
  }
}
```

---

## Delivery Checks (Task Completion Contract)

Before ending a turn and finishing a task, perform the following checks:
1. **Restate the Goal**: Briefly describe what was requested and what was achieved.
2. **Review Diffs**: Ensure edits are minimal, clean, safe, and do not contain suppression comments.
3. **Execute Verification Command**: Run a target check (e.g. `pnpm lint`, `pnpm typecheck`, or targeted tests).
4. **Report Outcome & Risk**: Detail test results, highlight any residual risks or assumptions made, and propose the next steps.
