# Copilot / Assistant Instructions for Pixelated

Purpose
- Short, focused conventions for automated assistants working on this repository.
- Emphasize three non-negotiables: always use the project's `openmemory` MCP tool, always log a memory at session end, and always use `uv` for Python commands.

Core rules
- Start every new session by calling the project's MCP openmemory tool (e.g., `mcp_openmemory_list-memories` / `mcp_openmemory_search-memories`) to load relevant project memory and avoid duplicative reads. Treat openmemory as the canonical project memory store.
- At the end of every chat or task, write a short memory entry to openmemory summarizing what you changed and why (example: `mcp_openmemory_add-memory: "Fixed Dockerfile pnpm install fallback and verified local pnpm install"`). This grows project context and improves future assistance.
- For any Python install/run/test commands, always prefer `uv` wrappers:
  - `uv install` to install dependencies from `pyproject.toml`
  - `uv run <cmd>` to run Python programs (e.g. `uv run pytest tests/`)
  - `uv shell` to open a shell with the environment
- For Node.js related work, prefer `pnpm` (project uses pnpm). Use `pnpm` commands rather than npm/yarn unless explicitly required.

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

...existing code...

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
