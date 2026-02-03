# Ralph Agent Configuration

> 🎭 *Autonomous Data Processing Agent for Pixelated Empathy — The Empathy Gym™*

## ⛔ ABSOLUTE PROHIBITION: No Stubs or Filler

**Every implementation MUST be complete and production-ready.**
- ❌ No `pass`, `...`, `TODO`, `NotImplementedError`, `# FIXME`
- ❌ No placeholder returns (`return True`, `return []`, hardcoded dummies)
- ❌ No mock implementations disguised as real code
- ✅ If it can't be fully implemented, it must not be committed

---

## Package Management (CRITICAL)

| Domain | Tool | Rule |
|--------|------|------|
| **Python** | `uv` | Never use pip, conda, venv |
| **Node.js** | `pnpm` | Never use npm or yarn |

## Key Commands

```bash
uv sync && pnpm install        # Setup
uv run pytest tests/           # Test
uv run ruff check ai/          # Lint
pnpm dev:all-services          # Run all
```

## Reference Documents

| Doc | Purpose |
|-----|---------|
| `.ralph/PROMPT.md` | Mission & requirements |
| `.ralph/fix_plan.md` | Task tracker |
| `.ralph/specs/requirements.md` | Technical specs |
| `AGENTS.md` | Project AI guidelines |

## Interaction Protocol (Hooks)

- **Thread Start**: Check `supermemory` (project: `pixelated`) and `.ralph/progress.txt` for context on the current/upcoming task.
- **Thread End**: Log the completed task/milestone in `supermemory` (project: `pixelated`) and update `.ralph/progress.txt`.

---

*Execute tasks in phase order. Validate before proceeding. Test first. Security always.*
