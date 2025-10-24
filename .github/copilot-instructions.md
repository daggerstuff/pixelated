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

Thank you for following these conventions — they make automated assistance predictable and safe for the Pixelated repository.