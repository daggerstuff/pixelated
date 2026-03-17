# Copilot / Assistant Instructions for Pixelated

Purpose

- Short, focused conventions for automated assistants working on this
  repository.

Instruction order

- Follow the local governance defined in `GEMINI.md`.
- Read `AGENTS.md` at the repo root, then apply relevant guidance from
  `.agent/rules/`, `.agent/steering/`, `.agent/skills/`, and
  `.agent/workflows/`.
- Treat `.agent/` as the canonical location for agent rules, workflows, and
  skill references in this repository.

Tool and runtime defaults

- For Python install/run/test commands, always prefer `uv` wrappers:
  - `uv install` to install dependencies from `pyproject.toml`
  - `uv run <cmd>` to run Python programs (for example `uv run pytest tests/`)
  - `uv shell` to open a shell with the environment
- For Node.js-related work, prefer `pnpm` (project uses pnpm).
- Use `pnpm` commands rather than npm or yarn unless explicitly required.

Memory and continuity

- This project uses two MCP memory paths:
  - `mem0` for durable facts, preferences, decisions, and project context.
  - `pixelated-memory` for narrative state, themes, evolution, and dissonance.
- Start every meaningful task with this exact sequence:
  - `memory_query(query: "current project state", user_id: "<user_id>")`
  - `memory_query(query: "recent decisions, constraints, and next steps", user_id: "<user_id>")`
  - `memory_analyze(user_id: "<user_id>", mode: "themes")`
  - `memory_analyze(user_id: "<user_id>", mode: "dissonance")` before changing direction, revisiting old work, or extending prior plans.
- Use `memory_store(content: "...", user_id: "<user_id>", category: "fact|goal|preference|project_context|identity|insight", metadata: "{...}")` whenever you learn a stable fact or make a durable decision.
- Use `memory_analyze(user_id: "<user_id>", mode: "evolution")` when you need the project trajectory, and `memory_analyze(user_id: "<user_id>", mode: "forensics")` when you need structured entities, artifacts, or technical references.
- End every meaningful task with `memory_store(content: "<milestone, blockers, next step>", user_id: "<user_id>", category: "project_context", metadata: "{\"type\":\"handoff\"}")`.

Code reading and edits

- Avoid reading entire files unless necessary. Use symbol-aware tools where
  available.
- When searching for symbols, prefer targeted searches (function/class names)
  before scanning whole files.
- Make the smallest, safest edits required to satisfy the user's request.
- Preserve project style and lint rules.

Docker and CI guidance

- When diagnosing CI failures, first inspect the relevant Dockerfile and CI job
  snippet before making broad changes.
- If you modify Dockerfiles, preserve multi-stage builds and existing caching
  hints where possible.

Security and secrets

- Never print or commit secrets. Refer to them as placeholders and recommend
  reading from environment variables or secret stores.
- If a fix requires secret configuration, explain what env var or secret is
  required and why.

Testing and verification

- After making code changes, run relevant fast checks: linters, typecheck, and
  unit tests where practical.
- When running Python code or tests, use `uv run` so the proper environment is
  used.
- Prefer narrow, scoped verification before broader suite execution.

Communication style

- Be concise, specific, and actionable.
- State briefly what you will run and why immediately before tool use.
- Keep changes auditable and easy to review.

If unsure

- If a task is underspecified, make 1-2 reasonable assumptions, state them, and
  proceed.
- Ask only when ambiguity materially changes behavior, safety, or blast radius.

Short checklist

- Did I read `AGENTS.md` and relevant `.agent/*` guidance for this scope? ✅
- Did I bootstrap `mem0` with `memory_query` and inspect `pixelated-memory` with `memory_analyze` before making assumptions? ✅
- Did I run tests/typecheck with `uv` for Python where applicable? ✅
- Did I avoid exposing secrets? ✅
- Did I keep edits minimal and focused? ✅
