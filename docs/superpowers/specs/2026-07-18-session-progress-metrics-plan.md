# Implementation Plan: Session Progress Tracking & Multi-Session Progression Metrics (PIX-3916)

This plan outlines the step-by-step phases to execute the approved design spec
for PIX-3916. We follow a safe, minimal-diff, test-driven approach.

---

### Phase 1 — Database Connection Pool Integration

**Goal**: Update session API endpoints to use the centralized database query
tool/pool singleton from `src/lib/db/index.ts` instead of opening redundant
connection pools per file import.

**Changes**:

- [src/pages/api/session/progress.ts](file:///home/vivi/pixelated/src/pages/api/session/progress.ts)
- [src/pages/api/session/analytics.ts](file:///home/vivi/pixelated/src/pages/api/session/analytics.ts)
- [src/pages/api/session/skills.ts](file:///home/vivi/pixelated/src/pages/api/session/skills.ts)

**Verify**: `pnpm vitest run src/tests/api/session/progress-api.test.ts` passes.
**Rollback**:
`git checkout src/pages/api/session/progress.ts src/pages/api/session/analytics.ts src/pages/api/session/skills.ts`
**Status**: [ ] not started · [ ] in progress · [x] complete

---

### Phase 2 — Defense Metrics API Endpoint

**Goal**: Implement GET and POST endpoints for `/api/defense` to store and
retrieve historical defense mechanism analysis scores.

**Changes**:

- `src/pages/api/defense.ts`
- `src/tests/api/session/defense-api.test.ts`

**Verify**: `pnpm vitest run src/tests/api/session/defense-api.test.ts` passes.
**Rollback**:
`rm src/pages/api/defense.ts src/tests/api/session/defense-api.test.ts`
**Status**: [ ] not started · [ ] in progress · [x] complete

---

### Phase 3 — React Components for Progress Visualizations

**Goal**: Replace the `SessionTimeline` placeholder and implement high-fidelity
React visualization components using vanilla CSS and SVG rendering in full
alignment with zero-chroma/premium design guidelines.

**Changes**:

- [src/components/chat/SessionTimeline.tsx](file:///home/vivi/pixelated/src/components/chat/SessionTimeline.tsx)
- `src/components/chat/MultiSessionProgression.tsx`
- `src/components/chat/BeliefChangeTracker.tsx`
- `src/components/chat/DefenseMechanismAdaptation.tsx`
- `src/components/chat/GoalAttainmentScale.tsx`
- `src/lib/utils/dynamic-components.ts` (Registering lazy-loaded components)

**Verify**: `pnpm typecheck` compiles clean for modified files. **Rollback**:
Revert `SessionTimeline.tsx` and delete the other React components. **Status**:
[ ] not started · [ ] in progress · [x] complete

---

### Phase 4 — Enhanced Dashboard & Progress Page Integration

**Goal**: Render the newly created visualization components dynamically in the
Enhanced Dashboard when in `analytics` or `therapist` mode, and create a
dedicated deep-dive progress route.

**Changes**:

- `src/pages/dashboard/enhanced.astro`
- `src/pages/dashboard/session-progress.astro`

**Verify**: `pnpm build` completes successfully. **Rollback**:
`git checkout src/pages/dashboard/enhanced.astro` and delete
`session-progress.astro`. **Status**: [ ] not started · [ ] in progress · [x]
complete
