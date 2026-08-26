# Copilot Instructions for `pixelated`

## Project Overview

Pixelated Empathy - clinical AI platform: Astro 6 + React 19 (TypeScript)
frontend/SSR; Express/FastAPI/Flask backend.

## Core Developer Rules

### ✅ Always

- **Config Hygiene**: Keep agent-specific dotfiles at `~<.agent_name>`. Never
  create or commit agent-specific config at project level.
- **Surgical Edits**: Keep changes minimal, safe, tightly scoped. Write clear,
  self-documenting code. Remove only what your edits make obsolete.
- **Privacy & Safety Gating**: Preserve therapeutic, privacy, and
  HIPAA-compliant boundaries for client/patient-facing workflows. Clinical
  health data is paramount.
- **Verify Explicitly**: Validate edits w/ concrete commands (tests, lint,
  typecheck) before completion. Restate what was requested, review diffs for
  suppression comments, report results and residual risks.

### ⚠️ Ask First

- Modifying authentication, security controls, or clinical gating.
- Modifying public API contracts, routing architectures, or CI/CD pipelines.

### 🚫 Never (Strict Anti-Suppression Policy)

> [!IMPORTANT] **No suppression.** Never mask linter errors, TypeScript errors,
> compile warnings, or test failures. Fix the issue—never hide it.
>
> - **TypeScript**: `@ts-ignore` `@ts-nocheck` `@ts-expect-error` (unless
>   strictly required in pre-existing test mock files).
> - **Python**: `# noqa` `# type: ignore` (do not bypass linting or pyright
>   checks).
> - **JavaScript / ESLint**: `/* eslint-disable */` or file-level/block-level
>   rule exclusions to cover up new warning flags.
> - **Config Bypasses**: Modifying `tsconfig.json` `.eslintrc` `.oxlintrc` or
>   test configs to lower strictness or hide failures.
> - **Secrets & PHI**: Hardcoding credentials, API tokens, passwords, or
>   patient-identifiable details in codebase, fixtures, or test environments.

---

## Core Developer Rules

Follow conventions in `.agents/rules/`:

- `typescript.md` — TypeScript and React patterns
- `astro.md` — Astro 6 component, routing, and SSR rules
- `python.md` — Python/uv toolchain and ruff/pyright conventions
- `testing.md` — Vitest, Playwright, and pytest patterns
- `security.md` — HIPAA, secrets, auth/gating, threat modeling

---

## SkillRoute — Skill Discovery & Routing

SkillRoute (`erichare/skill-route`) provides semantic skill routing for
ambiguous or multi-domain tasks.

```bash
skillroute route "<task description>"  # Route to best skill
skillroute search "<query>"            # Search available skills
```

Installed at `~/.skillroute/skill-route`. Requires `SKILLROUTE_CATALOG_PATH` env
var (already in shell config).

When the next step is unclear: run `skillroute route`, read confidence scores,
load recommended skill(s) via the Skill tool.

---

## Foresight Memory & Continuity System

Foresight is a persistent memory layer for AI agents — shared across all
machines via Ghost Postgres.

### Session Startup Gate (mandatory)

Every session touching real work MUST run Foresight continuity read as its
**first action** — before any code edit, exploration, or planning.

1. Call `manage_context_blocks` w/ `action: "get"` for both `project_context`
   and `pending_items`.
2. Call `search_memories` w/ keywords related to your task.
3. In your first reply, state what blocks returned (entry count + one-line
   summary each).
4. Use findings to inform your approach — if memory contradicts your plan, say
   so before editing.

**Skipping this gate is not permitted without naming it.** If it doesn't apply
(pure conversation, no code), say so explicitly and why.

### Session End Gate (mandatory)

Every session that touched real work MUST run the Foresight capture pipeline
before ending:

1. Call `process_session_transcript` w/ `session_id` and `messages`.
2. Call `manage_memories` (`store`) for new decisions, lessons, or preferences —
   store distilled facts, not transcripts.
3. Call `manage_context_blocks` (`update`, `pending_items`) — mark completed
   items, add follow-ups, remove stale entries.
4. Update `user_preferences` or `project_context` blocks if scope shifted.

**Skipping this gate is not permitted without naming it.** If the session
produced no durable context, say so explicitly and why.

---

## Aesthetic Judgment

When doing design, creative, or artistic work — UI design, visual assets,
layouts, color choices, typography, animation, branding, or creative direction —
read `TASTES.md` if it exists and apply its constraints to your output.

## 3b) Neon Ai Gateway Setup

This project can also use Neon Ai Gateway as an alternative model provider. Neon
Ai Gateway provides a unified API for frontier and open-source models.

### Quick Start

To configure your environment for Neon Ai Gateway:

```bash
source .github/copilot/neon-byok.sh
```

This script sets following environment variables:

- `COPILOT_PROVIDER_BASE_URL="${NEON_AI_GATEWAY_BASE_URL}"` (your branch's AI
  Gateway host)
- `COPILOT_PROVIDER_API_KEY="${NEON_AI_GATEWAY_TOKEN}"` (credential with
  `ai_gateway:invoke` scope)
- `COPILOT_PROVIDER_TYPE="openai"` (Neon is OpenAI-compatible)
- `COPILOT_MODEL="openai/gpt-oss-120b"` (default, or specify a model from Neon's
  catalog)
- Token limits tuned for selected model

### Getting Started with Neon Ai Gateway

1. **Create a Neon project** in the AWS us-east-2 region (required for AI
   Gateway beta)

2. **Create a credential** with `ai_gateway:invoke` scope:
   - In the Neon Console, select your branch, click **Credentials** under
     **Branch**, then click **Create credential** and check `ai_gateway:invoke`
   - Or use the API:
     `curl -X POST "https://console.neon.tech/api/v2/projects/{project_id}/branches/{branch_id}/credentials" \ -H "Authorization: ******" \ -H "Content-Type: application/json" \ -d '{"scopes": ["ai_gateway:invoke"], "principal_type": "user"}'`

3. **Set environment variables**:

```bash
export NEON_AI_GATEWAY_TOKEN=nt_live_...
export NEON_AI_GATEWAY_BASE_URL=https://br-<name>-api.ai.c-2.us-east-2.aws.neon.tech
```

4. **Install dependencies** (if not already installed):

```bash
pnpm add openai
```

5. **Make your first request** - the Chat Completions endpoint is
   OpenAI-compatible:

```typescript
import OpenAI from 'openai'
const openai = new OpenAI({
  baseURL: process.env.NEON_AI_GATEWAY_BASE_URL,
  apiKey: process.env.NEON_AI_GATEWAY_TOKEN,
})
```

### Available Models

Neon Ai Gateway's catalog includes:

- **Open-weight models**: Qwen, gpt-oss (via Databricks Foundation Model APIs)
- **Frontier models**: GPT (`gpt-5`), Gemini (`gemini-3-flash`) - rolling out
  gradually

Use `COPILOT_MODEL` to select a model. For example:

- `openai/gpt-oss-120b` - general coding and reasoning
- `openai/gpt-5` - frontier capabilities (where available)

### Switching Models

To temporarily use a different model for a session:

```bash
export COPILOT_MODEL="openai/gpt-5"
copilot <your-command>
```

Or make it persistent:

```bash
echo 'export COPILOT_MODEL="openai/gpt-5"' >> ~/.bashrc
```
