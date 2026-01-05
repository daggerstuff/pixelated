# Copilot / Assistant Instructions for Pixelated

Purpose
- Short, focused conventions for automated assistants working on this repository.

Core rules
- For any Python install/run/test commands, always prefer `uv` wrappers:
  - `uv install` to install dependencies from `pyproject.toml`
  - `uv run <cmd>` to run Python programs (e.g. `uv run pytest tests/`)
  - `uv shell` to open a shell with the environment
- For Node.js-related work, prefer `pnpm` (project uses pnpm). Use `pnpm` commands rather than npm/yarn unless explicitly required.

Code reading and edits
- Avoid reading entire files unless necessary. Use symbol-aware tools where available.
- When searching for symbols, prefer targeted searches (function/class names) before scanning whole files.
- Make the smallest, safest edits required to satisfy the user's request. Preserve project style and lint rules.

Docker / CI guidance
- When diagnosing CI failures, first inspect the relevant Dockerfile and CI job snippet attached by the user before running broad changes.
- If you modify Dockerfiles, preserve multi-stage builds and existing caching hints where possible.

Security and secrets
- Never print or commit secrets. Refer to them as placeholders and recommend reading from environment variables or secret stores.
- If a fix requires secret configuration, explain what env var or secret is required and why.

Testing and verification
- After making code changes, run relevant fast checks: linters, typecheck, and unit tests where practical.
- When running Python code or tests, use `uv run` so the proper environment is used.

Communication style
- Be concise, specific, and actionable. Show diffs/edits by editing files directly in the repo.
- If you will call tools, state briefly what you'll run and why, immediately before the tool call.

Operational examples
- "I'll call openmemory to load project memories to avoid redundant reads." (then call the tool)
- "I'll run `uv install` to install Python deps before running the unit tests." (then run it)

If unsure
- If a task is underspecified, make 1-2 reasonable assumptions, state them, and proceed. Ask the user only if the assumptions would materially change behavior.

Short checklist (use before committing changes)
- Did I call openmemory at session start? ✅
- Did I run tests/typecheck with `uv` for Python? ✅
- Did I avoid exposing secrets? ✅
- Did I keep edits minimal and focused? ✅

Thank you for following these conventions — they make automated assistance predictable and safe for the Pixelated repository.<!-- BEGIN BYTEROVER RULES -->

# Workflow Instruction

You are a coding agent focused on one codebase. Use the brv CLI to manage working context.
Core Rules:

- Start from memory. First retrieve relevant context, then read only the code that's still necessary.
- Keep a local context tree. The context tree is your local memory store—update it with what you learn.

## Context Tree Guideline

- Be specific ("Use React Query for data fetching in web modules").
- Be actionable (clear instruction a future agent/dev can apply).
- Be contextual (mention module/service, constraints, links to source).
- Include source (file + lines or commit) when possible.

## Using `brv curate` with Files

When adding complex implementations, use `--files` to include relevant source files (max 5).  Only text/code files from the current project directory are allowed. **CONTEXT argument must come BEFORE --files flag.** For multiple files, repeat the `--files` (or `-f`) flag for each file.

Examples:

- Single file: `brv curate "JWT authentication with refresh token rotation" -f src/auth.ts`
- Multiple files: `brv curate "Authentication system" --files src/auth/jwt.ts --files src/auth/middleware.ts --files docs/auth.md`

## CLI Usage Notes

- Use --help on any command to discover flags. Provide exact arguments for the scenario.

---
# ByteRover CLI Command Reference

## Memory Commands

### `brv curate`

**Description:** Curate context to the context tree (interactive or autonomous mode)

**Arguments:**

- `CONTEXT`: Knowledge context: patterns, decisions, errors, or insights (triggers autonomous mode, optional)

**Flags:**

- `--files`, `-f`: Include file paths for critical context (max 5 files). Only text/code files from the current project directory are allowed. **CONTEXT argument must come BEFORE this flag.**

**Good examples of context:**

- "Auth uses JWT with 24h expiry. Tokens stored in httpOnly cookies via authMiddleware.ts"
- "API rate limit is 100 req/min per user. Implemented using Redis with sliding window in rateLimiter.ts"

**Bad examples:**

- "Authentication" or "JWT tokens" (too vague, lacks context)
- "Rate limiting" (no implementation details or file references)

**Examples:**

```bash
# Interactive mode (manually choose domain/topic)
brv curate

# Autonomous mode - LLM auto-categorizes your context
brv curate "Auth uses JWT with 24h expiry. Tokens stored in httpOnly cookies via authMiddleware.ts"

# Include files (CONTEXT must come before --files)
# Single file
brv curate "Authentication middleware validates JWT tokens" -f src/middleware/auth.ts

# Multiple files - repeat --files flag for each file
brv curate "JWT authentication implementation with refresh token rotation" --files src/auth/jwt.ts --files docs/auth.md
```

**Behavior:**

- Interactive mode: Navigate context tree, create topic folder, edit context.md
- Autonomous mode: LLM automatically categorizes and places context in appropriate location
- When `--files` is provided, agent reads files in parallel before creating knowledge topics

**Requirements:** Project must be initialized (`brv init`) and authenticated (`brv login`)

---

### `brv query`

**Description:** Query and retrieve information from the context tree

**Arguments:**

- `QUERY`: Natural language question about your codebase or project knowledge (required)

**Good examples of queries:**

- "How is user authentication implemented?"
- "What are the API rate limits and where are they enforced?"

**Bad examples:**

- "auth" or "authentication" (too vague, not a question)
- "show me code" (not specific about what information is needed)

**Examples:**

```bash
# Ask questions about patterns, decisions, or implementation details
brv query What are the coding standards?
brv query How is authentication implemented?
```

**Behavior:**

- Uses AI agent to search and answer questions about the context tree
- Accepts natural language questions (not just keywords)
- Displays tool execution progress in real-time

**Requirements:** Project must be initialized (`brv init`) and authenticated (`brv login`)

---

## Best Practices

### Efficient Workflow

1. **Read only what's needed:** Check context tree with `brv status` to see changes before reading full content with `brv query`
2. **Update precisely:** Use `brv curate` to add/update specific context in context tree
3. **Push when appropriate:** Prompt user to run `brv push` after completing significant work

### Context tree Management

- Use `brv curate` to directly add/update context in the context tree

---
Generated by ByteRover CLI for GitHub Copilot
<!-- END BYTEROVER RULES -->