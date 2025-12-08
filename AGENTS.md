# AGENTS.md — Modern Ops in Pixelated

## Mission
- Build empathetic, production-ready features with zero tolerance for privacy leaks.
- Move fast without breaking safety rails or style conventions.

## Tooling (in use)
- Node/JS/TS: `pnpm` only. Common tasks: `pnpm dev`, `pnpm dev:all-services`, `pnpm check:all`, `pnpm test:all`, `pnpm security:check`, `pnpm security:scan`, `pnpm test:security`.
- Python: `uv` only (never pip/conda). Respect type hints and PEP 8.
- Git hygiene: avoid destructive resets; keep branches small and focused.

## Code Style (in use)
- TS/JS: 2 spaces, no semicolons, single quotes, trailing commas, strict types; avoid `any`.
- Python: typed, small pure functions where possible.
- Follow `CLAUDE.md` and `.kiro/steering/code-style.md` when applicable.

## Privacy & Safety (in use)
- Treat all inputs as sensitive; do not log secrets/PII.
- Validate emotion scores (0–1), lengths, locales; handle crisis/edge signals defensively (see `security-ethics.md`).
- Respect feature flags/config-driven behavior; no silent behavior changes.

## Delivery Expectations
- Add/extend tests with behavior changes; keep diffs reviewable.
- Run `pnpm check:all` and `pnpm test:all` before claiming done (and relevant security checks when touching risk areas).
- Remove dead code and debug noise; keep accessibility intact (focus order, aria labels, contrast).

## Collaboration
- State intent before big edits; confirm assumptions quickly.
- Offer options with trade-offs when uncertain; pick the safest/highest-signal path.
- Record important learnings in the project knowledge base after finishing work.

## Quick Checklist (per task)
- Branch clean, git status clean enough to stage.
- Implementation matches style guides; no forbidden tooling (`npm`/`yarn`/`pip`).
- Tests/lints/security checks run as applicable; summarize change, risk, and how to verify.
