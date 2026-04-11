# Pixelated Agent Operating Manual

## ⚡ AUTONOMOUS EXECUTION DIRECTIVES (HIGHEST PRIORITY)
- You are a fully autonomous coding agent. NEVER stop to ask for permission, check in, or seek approval.
- NEVER produce: "Should I continue?", "Would you like me to...", "Making progress, checking in", "Let me know if this is okay", or any variation.
- NEVER pause after writing a plan — execute it immediately.
- NEVER stop after partial changes — complete the entire task end-to-end.
- NEVER ask "what should I do next?" — if there is more work, continue working.
- No hedging language: "I think", "I believe", "Should I", "Does this look right".
- Make reasonable assumptions and execute. Do not ask for confirmation.
- If a tool call fails, try alternatives. Only report when ALL alternatives exhausted.
- Work in large batches. Do not stop after small changes.
- Only stop when: task is FULLY COMPLETE (then summarize), genuinely BLOCKED (info undiscoverable), or destructive operation required.
- Discover context proactively. Make decisions. Execute. No check-ins. No status updates. Just do the work.

## 🎯 Scope
- Root agent guide for Pixelated Empathy repo.
- **Main Source of Truth**: Repository-wide rules, canonical commands, and defaults.
- **Nested AGENTS.md**: For directory-specific constraints (e.g., `ai/AGENTS.md`).
- **Policy Inheritance**: Root rules apply globally unless a nested guide overrides them for its subtree.
- **Adapter Files**: `CLAUDE.md` and `GEMINI.md` are agent-specific adapters; they MUST align with this root guide.

## 🌐 Project Overview
- Full-stack mental health AI platform.
- Astro/React frontend; TS services/workers; Python AI pipelines.
- **Privacy, safety, and security are mandatory requirements.**

## 🚀 Unified Agent Workflow (2026 Standard)
Follow this loop for every task to ensure durability and reliability:

1.  **Recall**: Start with Hindsight MCP tools (`recall` or `reflect`).
2.  **Search (Proactive Capability Mapping)**:
    -   Identify specialized **Skills** (`.agent/skills/`) or **MCP tools**.
    -   Use name-based filtering and the initial `<skills>` block.
    -   Only deep-scan `SKILL.md` documents for high-probability matches.
    -   **Prioritize efficiency** over exhaustive scanning.
    -   Minimize context window bloat and reduce session latency.
3.  **Plan**: Draft in `.agent/internal/plans/` (`YYYY-MM-DD-task-name.md`).
4.  **Act**: Small, atomic chunks. Fix root causes, not symptoms.
5.  **Verify**: Validate each change with the smallest focused local checks that cover the behavior.
6.  **Retain**: Log actions/learnings in Hindsight (`retain`) at task end.

## 🏗️ Project Structure
- `src/`: Astro app, React UI, API routes, shared TypeScript libraries, hooks, and workers.
- `ai/`: Python inference, training, monitoring, safety, and pipeline code.
- `tests/`: Integration, browser, performance, security, and API coverage.
- `scripts/`, `docker/`, `config/`, `.github/workflows/`: Operational and deployment code.
- `public/`: Static assets.
- `docs/`: **PUBLIC** documentation only.
- `.agent/internal/`: **PRIVATE** internal plans, research, and notes (git-ignored).

## 🛠️ Canonical Commands
- `pnpm dev`: Run main app locally on port `5173`.
- `pnpm build` & `pnpm preview`: Validate production-ready output.
- `pnpm lint` & `pnpm format`: Primary quality gates for frontend and TS.
- `pnpm test`, `pnpm test:unit`, `pnpm e2e`: Main JS and browser tests.
- `uv run pytest`: Primary Python test entry point.
- `pnpm security:check` or `pnpm security:scan`: Audit for sensitive changes.

## ⚖️ Working Rules
- **Environment**: Use `pnpm` for Node/TS and `uv run` for Python. PROHIBITED: raw `npm`, `pip`, `conda`, `poetry`.
- **Quality**: No stubs, placeholders, or suppressed lint/TS errors. Enterprise-grade code only.
- **Data**: Synthetic test data ONLY. No secrets or local credentials.
- **Boundary**: Treat `ai/` as a submodule with its own commit discipline.
- **Safety**: DO NOT guess. Verify commands and structure if unsure.
- **Context**: Use `context7` for provider docs and `exa` for web search.

## 🔒 Verification & Memory
- **Hindsight**: Always recall context at start and retain learnings at task end.
- **Hindsight Identity**: In this project, NEVER use Hindsight with `user_id: "default"`. Use `user_id: "vivi"` unless the user explicitly provides a different identity.
- **Validation**: Smallest relevant test surface; do not skip behavior checks.
