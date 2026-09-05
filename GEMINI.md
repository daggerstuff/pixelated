# GEMINI.md

> Google Antigravity & Gemini CLI Operating Directives for **Pixelated
> Empathy**.

---

## 1. ⚡ Priority Zero: Context Grounding (Foresight First)

Ambient auto-injection automatically injects `[FORESIGHT CONTINUITY CONTEXT]` into turn 1.
When explicitly retrieving or persisting state during a session:

- **Retrieval (Antigravity lazy MCP tool)**:
  ```python
  call_mcp_tool(
      ServerName="foresight",
      ToolName="inject_context",
      Arguments={"conversation_text": "<user's prompt or topic>"},
  )
  ```
- **In-Session Capture (Preferences & Decisions)**:
  ```python
  # Update user preferences or pending items
  call_mcp_tool(
      ServerName="foresight",
      ToolName="manage_context_blocks",
      Arguments={"action": "update", "label": "user_preferences", "content": "..."},
  )
  # Store key decisions
  call_mcp_tool(
      ServerName="foresight",
      ToolName="manage_memories",
      Arguments={"action": "store", "category": "decision", "content": "..."},
  )
  ```
- Silently incorporate returned memories and context blocks (`user_preferences`,
  `pending_items`, `core_directives`).

---

## 2. 🛠️ Execution & Development Commands

Always use the project's pinned toolchains (`pnpm` for Node/TS, `uv` for
Python):

```bash
# Frontend & Services (Astro 6 / React 19 / Express)
pnpm dev                     # Start Astro frontend (port 5173)
pnpm dev:all-services        # Start complete local service ecosystem
pnpm typecheck               # Run TypeScript compiler checks
pnpm lint                    # ESLint & formatting audits
pnpm vitest run -c config/vitest.config.ts  # Run unit/integration tests
pnpm build                   # Production build

# Python Toolchain (uv mandatory)
uv run pytest                # Run pytest test suite
uv run ruff check .          # Python lint checks
uv run python -m <pkg>       # Run Python module
```

---

## 3. 🛡️ Non-Negotiable Engineering Rules

### ✅ Always

- **Global Config Only**: Store agent dotfiles under `~/.gemini/`. Never commit
  `.gemini` or agent dotfiles into project workspace roots.
- **Surgical Edits**: Minimal, clean modifications. Only touch lines necessary
  for the task.
- **Strict Verification**: Execute real test and lint commands to prove changes
  work before reporting completion.
- **HIPAA / Privacy Guardrails**: Treat patient/client clinical data with
  absolute privacy.

### 🚫 Strict Anti-Suppression Policy

- **No `@ts-ignore` / `@ts-nocheck` / `@ts-expect-error`**: Fix underlying type
  definitions.
- **No `# noqa` / `# type: ignore`**: Fix Python lint and pyright issues at
  source.
- **No `/* eslint-disable */`**: Address linter complaints properly.
- **No Secrets / PHI in Code**: Credentials, keys, and health identifiers belong
  in `.env` or secure memory rows.

---

## 4. 📦 Delivery Checklist

1. **Grounded Approach**: Confirm understanding against Foresight context.
2. **Minimal-Safe Edits**: Implement surgical code changes.
3. **Targeted Verification**: Run tests (`pnpm vitest`, `uv run pytest`) and
   linting (`pnpm typecheck`).
4. **State Capture**: Update `pending_items` or store new decisions in Foresight
   before closing.
