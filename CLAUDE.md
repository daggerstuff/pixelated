# CLAUDE.md

## Scope

- Governs Claude Code sessions for `Pixelated Empathy`.
- Main source of truth: root `AGENTS.md`.
- Keep this file concise and high-signal (shorter files improve adherence).

## Rules

### ✅ Always

- **No Project-level Littering**: Keep all agent-specific configurations,
  skills, and dotfiles at global level (`~/.claude`). Never commit project-level
  config folders (e.g. `.claude` at repo root).
- Follow root `AGENTS.md` exactly, then this file and scoped `AGENTS.md` under
  touched directories.
- Apply root behavioral defaults: assumptions-first, simplicity, surgical edits,
  and explicit success criteria.
- Quick examples: ask before coding if scope is unclear; remove only
  imports/files your change made obsolete; verify w/ one concrete check.
- Preserve privacy/safety context for mental health workflows.
- Use explicit directives instead of implied conventions; avoid vague guidance.
- Use `uv run` for Python execution where possible.
- Keep context scoped: prefer root-level defaults w/ path-specific overrides.
- Start every task by running Foresight continuity calls before edits:
  `manage_context_blocks` (`list` `get` for `pending_items` `project_context`)
  and `search_memories` for active/upcoming work.

### ⚠️ Ask first

- Edits to deployment routes, auth middleware, or public-facing behavior
  contracts.
- Removing or broadening scope guards (security/privacy checks, gating logic).
- Command-policy changes that affect CI/release safety.

### 🚫 Never

- Use suppression comments to mask issues (`@ts-ignore` `# noqa`
  `# type: ignore` `/* eslint-disable */`).
- Include secrets, tokens, patient details, or credentials in examples/fixtures.
- Run raw `python`/`pip` in this repo unless explicitly requested.

## Delivery checks

1. Restate goal, risk, and target surface.
2. Apply minimal-safe changes.
3. Run one relevant command from command list.
4. Report result and immediate risk.

## Context tooling

- Foresight MCP first for active state: `manage_context_blocks` (`list` `get`
  for `pending_items` + `project_context`), `search_memories` (`active tasks`
  `upcoming work` owner/team scope), then `manage_memories` as needed.
- MCP server exposes only reduced core surface documented in
  `.agents/skills/foresight/SKILL.md`. Use `foresight` CLI for expert maintenance
  commands.
- Root `AGENTS.md` is main source of truth.
- For scoped rules, prefer nested instruction files (`AGENTS.md` under touched
  directories).

## Design Context

- **Design is documented**: `PRODUCT.md` (strategic: register, users, purpose, brand
  personality, anti-references, principles, a11y) `DESIGN.md` (visual: Quiet
  Instrument — dark-first, zero-chroma grayscale, 0px radius, no shadows, Fraunces /
  Public Sans / JetBrains Mono). Read both before any UI work.
- **Doctrine**: zero-chroma (no accent, no hue in tokens), 0px radius everywhere, tonal
  layering not shadows, motion conveys state only. Emphasis via value contrast.
- **Known code drift** (open tech-debt, see DESIGN.md §7): emerald `#10b981` accent lives
  in ~30 components, non-zero radius scale (2/4/8px) across 5 competing theme files,
  and shadow tokens. New/refactored work targets doctrine; drift is follow-up
  work, not permission to extend it.
- **A11y mandate**: every text/surface pair must be measured against WCAG AA (4.5:1 body,
  3:1 large). neutral ramp gives no contrast guarantee — measure, don't assume.
