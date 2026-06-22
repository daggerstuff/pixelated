# Implementation Plan Template

> Copy this file, rename it after the feature (e.g., `PLAN-auth0-migration.md`),
> and let Specification Mode (`Shift+Tab` or `/spec`) populate the phases.
> Reference: https://docs.factory.ai/cli/user-guides/implementing-large-features

## Goal

One paragraph. What outcome does this plan deliver? For whom? On which
surface?

## Scope

### In scope
- ...

### Out of scope
- ...

## Constraints & Guardrails

- Stack: Astro 6 + React 19 + TypeScript (`pnpm`), Python 3.13 (`uv`).
- Privacy: clinical/HIPAA context applies — read
  `.factory/rules/security.md` before touching PHI paths.
- AGENTS.md rules: surgical edits, no suppression comments, no project-level
  dotfile commits.

## Phases

Each phase is 1-2 days of work and ends with a concrete verification step.

### Phase 1 — <name>

**Goal**: ...

**Changes**:
- `path/to/file.ts`: ...
- `path/to/other.ts`: ...

**Verify**: `pnpm test:unit -- <scope>` or equivalent concrete command.

**Rollback**: `git revert <commit>` / feature flag `OPT_PHASE_1` flips back
the behavior.

**Status**: [ ] not started · [ ] in progress · [ ] complete

---

### Phase 2 — <name>

**Goal**: ...

**Changes**:
- ...

**Verify**: ...

**Rollback**: ...

**Status**: [ ] not started · [ ] in progress · [ ] complete

---

(Add phases as needed. Keep each phase under two days of work.)

## Dependencies

- Phase N requires Phase M to be complete.
- External: ticket, design doc, third-party API contract.

## Testing Strategy

- Unit: ...
- Integration: ...
- E2E (Playwright): ...
- Manual QA: ...

## Risks & Rollback

| Risk | Likelihood | Mitigation | Recovery |
| ---- | ---------- | ---------- | -------- |
| ... | low/med/high | ... | ... |

## Definition of Done

- [ ] All phases complete
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` clean (no new warnings)
- [ ] `pnpm test:unit` and `pnpm test:integration` pass
- [ ] OpenAPI / API contract updated where relevant
- [ ] PR(s) merged; CHANGELOG / release notes updated
- [ ] Foresight `pending_items` updated; key decisions stored in memory

## Notes & Drift Log

Document anything unexpected. Update as phases complete.
