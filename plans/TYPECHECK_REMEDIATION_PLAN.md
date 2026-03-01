# Typecheck Issues Remediation Plan

## Executive Summary

The project currently has **3,689 TypeScript errors** across **2,052 files**.
This plan outlines a systematic approach to resolve these issues using an
iterative, milestone-based strategy.

---

## Current State Analysis

### Error Distribution by Type Code

| Type Code | Count | Category                | Severity   |
| --------- | ----- | ----------------------- | ---------- |
| ts(2339)  | 760   | Property does not exist | HIGH       |
| ts(2345)  | 500   | Argument type mismatch  | HIGH       |
| ts(18046) | 432   | Astro module member     | MEDIUM     |
| ts(2322)  | 390   | Type assignment error   | HIGH       |
| ts(6133)  | 283   | Unused variable         | LOW        |
| ts(7044)  | 212   | Implicit any            | MEDIUM     |
| ts(6385)  | 192   | Deprecated API          | MEDIUM     |
| ts(2304)  | 175   | Cannot find name        | HIGH       |
| ts(2554)  | 162   | Wrong argument count    | MEDIUM     |
| ts(2353)  | 161   | Unknown property        | HIGH       |
| ts(80007) | 105   | JSX element error       | HIGH       |
| ts(2307)  | 103   | Module export error     | HIGH       |
| ts(2571)  | 86    | Duplicate declaration   | MEDIUM     |
| Other     | ~668  | Various                 | MEDIUM/LOW |

---

## Root Cause Categories

### 1. Astro Framework Type Limitations (~530 errors)

**Pattern:** `ts(18046)`, `ts(18047)`, `ts(18048)`

**Root Cause:** Astro's type system doesn't properly merge custom `App.Locals`
types in middleware context. This is a known limitation where:

- `context.locals` doesn't infer custom properties from `env.d.ts`
- Component prop types differ between Astro and React contexts

**Example:**

```typescript
// middleware.ts - Property 'user' does not exist on type 'Locals'
locals.user = { ... }  // Error but runtime works
```

**Solution:** Use explicit type assertions with documented rationale, OR extend
Astro's type interfaces properly.

---

### 2. Missing Module Exports (~186 errors)

**Pattern:** `ts(2305)`, `ts(2307)`

**Root Cause:** Functions imported but not exported from service modules.

**Affected Files:**

- `src/api/routes/market-research.ts` - Missing `createResearch`,
  `updateResearch`, etc.
- Various service files with incomplete export lists

**Solution:** Add missing exports to service modules.

---

### 3. Type Mismatches (~1,051 errors)

**Pattern:** `ts(2322)`, `ts(2345)`, `ts(2353)`

**Root Causes:**

- Boolean values passed where strings expected (ValidationError)
- Union types (string | string[]) not narrowed properly
- Object literals with unknown properties

**Example:**

```typescript
// market-research.ts - Type 'boolean' is not assignable to type 'string'
throw new ValidationError('title is required', { title: !title })
// title is boolean, but ValidationError expects string
```

**Solution:** Fix type arguments in error constructors, add proper type
narrowing for union types.

---

### 4. Property Access Issues (~760 errors)

**Pattern:** `ts(2339)`

**Root Causes:**

- `locals.user` not on Astro Locals type
- `dataset` property on generic `Element` type
- `req.params` on Express Request without augmentation

**Solution:** Add proper type augmentations to `env.d.ts` for Express/Request
types.

---

### 5. Implicit Any Parameters (~212 errors)

**Pattern:** `ts(7044)`

**Root Cause:** Callback parameters without explicit types.

**Solution:** Add explicit type annotations to all callback parameters.

---

### 6. Deprecated API Usage (~192 errors)

**Pattern:** `ts(6385)`

**Root Causes:**

- `req.connection.remoteAddress` - Use `req.socket.remoteAddress`
- `Math.random().toString(36).substr(2, 9)` - Use `substring` instead of
  `substr`

**Solution:** Replace deprecated APIs with current equivalents.

---

### 7. Unused Variables (~283 errors)

**Pattern:** `ts(6133)`

**Root Cause:** Variables declared but never used.

**Solution:** Remove unused variables or prefix with `_` for intentional
placeholders.

---

### 8. Scope/Declaration Issues (~337 errors)

**Pattern:** `ts(2304)`, `ts(2554)`

**Root Causes:**

- Variables used before declaration (hoisting issues)
- Wrong number of arguments to functions

**Solution:** Reorder declarations, fix function call arguments.

---

### 9. JSX Element Errors (~105 errors)

**Pattern:** `ts(80007)`

**Root Cause:** JSX props don't match component prop types.

**Solution:** Update Astro page frontmatter or component prop definitions.

---

## Remediation Strategy

### Phase 1: Quick Wins (Low-Hanging Fruit)

**Goal:** Reduce error count by ~40%

| Category                   | Errors | Effort | Impact |
| -------------------------- | ------ | ------ | ------ |
| Unused variables (ts 6133) | 283    | LOW    | HIGH   |
| Deprecated APIs (ts 6385)  | 192    | LOW    | MEDIUM |
| Implicit any (ts 7044)     | 212    | MEDIUM | HIGH   |

**Commands:**

```bash
# Find unused variables
pnpm typecheck 2>&1 | grep "ts(6133)"

# Find deprecated APIs
pnpm typecheck 2>&1 | grep "ts(6385)"
```

---

### Phase 2: Core Type Fixes

**Goal:** Reduce error count by ~30%

| Category                       | Errors | Effort | Impact |
| ------------------------------ | ------ | ------ | ------ |
| Missing exports (ts 2305/2307) | 186    | MEDIUM | HIGH   |
| Type mismatches (ts 2322/2345) | 890    | HIGH   | HIGH   |
| Property access (ts 2339)      | 760    | HIGH   | HIGH   |

**Approach:**

1. Fix ValidationError type arguments
2. Add missing service exports
3. Create type augmentation file for Express/Astro

---

### Phase 3: Astro Framework Issues

**Goal:** Reduce error count by ~15%

| Category                       | Errors | Effort | Impact |
| ------------------------------ | ------ | ------ | ------ |
| Astro module errors (ts 18046) | 432    | HIGH   | MEDIUM |
| JSX errors (ts 80007)          | 105    | MEDIUM | HIGH   |

**Approach:**

1. Add proper type assertions with documentation
2. Create `src/types/astro-augmentation.d.ts`

---

### Phase 4: Remaining Issues

**Goal:** Achieve zero errors

| Category                 | Errors | Effort | Impact |
| ------------------------ | ------ | ------ | ------ |
| Scope issues (ts 2304)   | 175    | MEDIUM | HIGH   |
| Argument count (ts 2554) | 162    | LOW    | HIGH   |
| Duplicate declarations   | 86     | LOW    | MEDIUM |

---

## Implementation Roadmap

### Sprint 1: Quick Fixes (1-2 days)

- [ ] Remove or prefix unused variables
- [ ] Replace deprecated APIs
- [ ] Fix implicit any in callbacks (high-traffic files)

### Sprint 2: Type Augmentations (2-3 days)

- [ ] Create `src/types/express-augmentation.d.ts`
- [ ] Fix `ValidationError` type arguments
- [ ] Add missing service exports

### Sprint 3: Property Access Fixes (2-3 days)

- [ ] Fix `locals.user` type issues
- [ ] Fix `dataset` property access
- [ ] Fix `req.params` typing

### Sprint 4: Astro/JSX Issues (2-3 days)

- [ ] Address Astro module exports
- [ ] Fix JSX prop type mismatches
- [ ] Address remaining scope issues

---

## Verification Commands

After each phase, verify progress:

```bash
# Full typecheck
pnpm typecheck 2>&1 | grep "Result" | tail -1

# Count remaining errors
pnpm typecheck 2>&1 | grep -c "error"

# Check specific category
pnpm typecheck 2>&1 | grep "ts(2339)" | wc -l
```

---

## Expected Outcome

| Phase   | Error Reduction | Target Errors |
| ------- | --------------- | ------------- |
| Current | -               | 3,689         |
| Phase 1 | ~40%            | ~2,213        |
| Phase 2 | ~30%            | ~1,349        |
| Phase 3 | ~15%            | ~727          |
| Phase 4 | ~15%            | 0             |

---

## Notes

1. **DO NOT use `// @ts-ignore`** - Fix the underlying issues
2. **Document any type assertions** - Add comments explaining why they're needed
3. **Test after each fix** - Run `pnpm dev` to verify runtime behavior
4. **Incremental approach** - Fix in small batches, verify often

---

## Progress Update (2026-02-26)

### Completed Fixes

#### Priority Files Fixed

- [x] `src/middleware.ts` - Added type assertions for locals.user
- [x] `src/api/routes/market-research.ts` - Added missing exports, fixed
      ValidationError fields
- [x] `src/api/routes/market-research-full.ts` - Fixed type mismatches
- [x] `src/api/routes/health.ts` - Added explicit return types
- [x] `src/api/routes/projects-full.ts` - Fixed scope issues
- [x] `src/api/routes/projects.ts` - Fixed ValidationError fields, req.params
- [x] `src/api/routes/users.ts` - Fixed requireRoles import, ValidationError
      fields
- [x] `src/api/routes/sales-opportunities.ts` - Added missing exports
- [x] `src/api/routes/strategic-plans.ts` - Added missing exports

#### AI API Routes Fixed

- [x] `src/pages/api/ai/auth0-crisis-detection.ts` - Fixed AuditEventType,
      CrisisDetectionResult properties
- [x] `src/pages/api/ai/auth0-high-risk-detections.ts` - Fixed userId null
      handling
- [x] `src/pages/api/ai/auth0-usage-stats.ts` - Fixed userId null handling
- [x] `src/pages/api/ai/completion.ts` - Added Session interface, fixed
      ValidationErrorDetails
- [x] `src/pages/api/ai/crisis-detection.ts` - Added Session interface,
      session.user null check

#### Core Type Fixes

- [x] `src/lib/validation/validateRequestBody.ts` - Added optional error and
      status to ValidationErrorDetails

### Key Patterns Discovered

- **ValidationError** expects `Record<string, string>` for fields, NOT booleans
- **Express params** need explicit `as string` assertions (string | string[])
- **AuditEventType** valid values: AI_OPERATION, SYSTEM, SECURITY, ACCESS,
  CREATE, MODIFY, DELETE, LOGIN, LOGOUT
- **getSession()** takes no arguments - it's a placeholder returning null
- **Session type** not exported from session module - define locally
- **ValidationErrorDetails** interface now includes optional error and status
  fields

### Additional Files Fixed in Current Session

- [x] `src/api/services/document-service.ts:26` - Fixed slug() function call
      (removed extra argument)
- [x] `src/components/dashboard/__tests__/performance.test.ts` - Fixed
      AnalyticsCharts imports and props
- [x] `src/test/utils/astro.ts` - Fixed renderAstro type signature for
      AstroComponent compatibility

### Key Pattern: AnalyticsCharts Component

The AnalyticsCharts React component doesn't accept any props - it fetches data
internally using the useAnalyticsDashboard hook. Tests must mock this hook
rather than passing data as props.

### Progress Summary

- **24+ files fixed** across the remediation effort
- **Error count**: Still ~3,476 errors remaining (significant progress made on
  fixed files)

### Pattern: Session Interface Definition

Files using getSession() now define a local Session interface:

```typescript
interface Session {
  user?: {
    id: string
    email?: string
    role?: string
    name?: string
  }
  session?: {
    sessionId?: string
  }
  expires?: string
}
```

---

## Files to Create

1. `src/types/express-augmentation.d.ts` - Express.Request type augmentations
2. `src/types/astro-augmentation.d.ts` - Astro type fixes

## Priority Files to Fix

### Completed (Phase 1: Initial Priority)

- [x] `src/middleware.ts` - Critical auth path
- [x] `src/api/routes/market-research.ts` - Multiple missing exports
- [x] `src/api/routes/market-research-full.ts` - Type mismatches
- [x] `src/api/routes/health.ts` - Missing return statements
- [x] `src/api/routes/projects-full.ts` - Scope issues
- [x] `src/api/routes/projects.ts` - ValidationError fields, req.params
- [x] `src/api/routes/users.ts` - requireRoles import, ValidationError fields,
      req.params
- [x] `src/api/routes/sales-opportunities.ts` - Missing exports, ValidationError
- [x] `src/api/routes/strategic-plans.ts` - Missing exports, ValidationError

### Completed (Phase 2: AI API Routes)

- [x] `src/pages/api/ai/auth0-crisis-detection.ts` - Invalid AuditEventType
      values, CrisisDetectionResult properties
- [x] `src/pages/api/ai/auth0-high-risk-detections.ts` - Invalid method name,
      userId null
- [x] `src/pages/api/ai/auth0-usage-stats.ts` - userId null
- [x] `src/pages/api/ai/completion.ts` - Session interface,
      ValidationErrorDetails
- [x] `src/pages/api/ai/crisis-detection.ts` - Session interface, session.user
      null check
- [x] `src/pages/api/ai/performance-metrics.ts` - Session interface,
      getSession()
- [x] `src/pages/api/ai/high-risk-detections.ts` - Session interface,
      getSession()
- [x] `src/pages/api/ai/response.ts` - Session interface, getSession(), missing
      imports
- [x] `src/pages/api/ai/embeddings/batch.ts` - Session interface, getSession()
- [x] `src/pages/api/ai/embeddings/embed.ts` - Session interface, getSession()
- [x] `src/pages/api/ai/usage-stats.ts` - Session interface, getSession(),
      AuditEventType

### Completed (Phase 3: Test & Utility Fixes)

- [x] `src/api/services/document-service.ts` - Fixed slug() function call
      (removed extra argument)
- [x] `src/components/dashboard/__tests__/performance.test.ts` - Fixed
      AnalyticsCharts props (doesn't accept data prop)
- [x] `src/test/utils/astro.ts` - Fixed renderAstro type signature for
      AstroComponent compatibility

### Completed (Phase 5: Additional Component Fixes)

- [x] `src/components/layout/Navigation.tsx` - Fixed roles -> role property
      mismatch
- [x] `src/components/demo/OfflineDemo.tsx` - Removed non-standard
      navigator.connection API
- [x] `src/components/auth/Register.tsx` - Fixed FormSubmitEvent (not in Astro),
      removed missing import

### Completed (Phase 4: Additional Fixes)

- [x] `src/hooks/useAudioCapture.ts` - Fixed MediaRecorderErrorEvent type
      (non-existent), added null checks
- [x] `src/hooks/useCognitiveDistortionDetection.ts` - Fixed hoisting issue by
      moving generateSummary before clientSideDetect
- [x] `src/lib/ai/types/CognitiveDistortions.ts` - Created missing module with
      cognitive distortion type definitions

### Completed (Phase 6: Deprecated API Fixes)

- [x] `src/api/middleware/rate-limiter.ts` - Fixed deprecated
      req.connection.remoteAddress -> req.socket?.remoteAddress
- [x] `src/hooks/usePipelineWebSocket.ts` - Fixed deprecated .substr() ->
      .substring()
- [x] `src/utils/sync/tabSyncManager.ts` - Fixed deprecated .substr() ->
      .substring()

### Completed (Phase 7: Zod v4 Compatibility)

- [x] Multiple files - Fixed ZodError.errors -> ZodError.issues for Zod v4
      compatibility:
  - `src/components/auth/Login.tsx`
  - `src/components/journal-research/forms/SessionForm.tsx`
  - `src/lib/validation/api.ts`
  - `src/lib/validation/validateRequestBody.ts`
  - `src/lib/metaaligner/formats/validation.ts`
  - `src/lib/ai/mental-llama/evidence/utils/semanticEvidenceParser.ts`
  - `src/pages/api/auth/register/route.ts`
  - `src/pages/api/bias-analysis/analyze-optimized.ts`
  - `src/pages/api/bias-detection/metrics.ts`
  - `src/pages/api/goals/[id].ts`
  - `src/pages/api/goals/index.ts`

### Completed (Phase 8: Missing Modules & Types)

- [x] `src/lib/security/backup/backup-types.ts` - Added missing BackupStatus
      enum values
- [x] `src/lib/auth-client.ts` - Added proper useSession React hook export
- [x] `src/components/chat/CognitiveModelSelector.tsx` - Added missing
      resistance property (3 instances)
- [x] `src/components/dashboard/TherapyProgressCharts.tsx` - Created missing
      component
- [x] `src/lib/ai/types/CognitiveDistortions.ts` - Created missing types module
- [x] `src/components/auth/PasswordResetRequestForm.tsx` - Fixed response.error
      -> response.success check
- Added `launchdarkly-js-client-sdk` package

### Additional Fixes in Current Session

- [x] `src/components/chat/MemoryAwareChatSystem.tsx` - Fixed user.name ->
      user.fullName
- [x] `src/components/session/SessionAnalysis.tsx` - Fixed dominantEmotion ->
      label, fixed imports

### Error Count Progress

| Date       | Errors | Notes                        |
| ---------- | ------ | ---------------------------- |
| Initial    | 3,689  | Starting point               |
| 2026-02-26 | ~3,300 | Phase 1-6 fixes              |
| Current    | ~3,303 | After Zod v4, modules, fixes |

### Session Progress (2026-02-28)

#### Phase 9: Test Utilities & Plugin Type Fixes

- [x] `src/test/utils/astro.ts` - Fixed renderAstro generic type signature to
      use Record<string, unknown> for Component parameter, fixing Alert.test.ts
      type errors
- [x] `plugins/index.ts` - Added Visitor type import and fixed implicit any for
      visit callback parameters (lines 62, 84, 136)
- [x] `plugins/remark-directive-sugar.ts` - Added Visitor type import and fixed
      implicit any for visit callback, fixed unused variables with let
      declarations
- [x] `plugins/remark-image-container.ts` - Added Visitor type import and fixed
      implicit any for visit callback

#### Key Patterns Discovered

- **renderAstro** expects Component parameter to accept
  `Record<string, unknown>` not strict generic Props type - Astro components
  don't have strict prop typing at runtime
- **Visitor** type from unist-util-visit can be used for callback parameter
  typing
- **Unused variables** should be declared with `let` instead of `const` if
  assigned later, or prefix with `_` to indicate intentional placeholder
