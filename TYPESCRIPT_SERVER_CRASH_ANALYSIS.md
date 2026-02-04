# TypeScript Server Crash Investigation

## 🔍 Root Cause Analysis

### Problem Summary

The TypeScript server is crashing due to **multiple conflicting `Locals` interface declarations** across the codebase.

### Key Findings

#### 1. **Multiple Conflicting `Locals` Interfaces**

Found 4 different `Locals` interface declarations:

1. **`src/env.d.ts`** (lines  6-35):

   ```typescript
   declare namespace App {
     interface Locals {
       requestId: string
       timestamp: string
       user: { ... } | null  // ✅ HAS user property
       session: { ... } | null
       vercelEdge?: { ... }
       cspNonce?: string
     }
   }
   ```

2. **`src/types/astro-locals.d.ts`** (lines 3-18):

   ```typescript
   declare module 'astro' {
     interface Locals {
       isSSR: boolean
       isPrerendered: boolean
       headers: Record<string, string>
       userPreferences: { ... }
       // ❌ NO user property!
     }
   }
   ```

3. **`src/types/astro.d.ts`** (lines 34-56):

   ```typescript
   declare module 'astro' {
     interface Locals extends Record<string, unknown> {
       headers: Record<string, string>
       isPrerendered: boolean
       isSSR: boolean
       cspNonce?: string
       session?: any
       userPreferences: { ... }
       user?: { ... }  // ✅ HAS user (optional)
     }
   }
   ```

4. **`src/types/astro.d.ts`** (lines 60-72):

   ```typescript
   declare namespace App {
     interface Locals extends Record<string, unknown> {
       isSSR?: boolean
       isPrerendered?: boolean
       cspNonce?: string
       user?: any  // ✅ HAS user (optional, typed as any)
       session?: any
       userPreferences?: { ... }
     }
   }
   ```

#### 2. **TypeScript Errors Detected**

```text
src/middleware.ts:74:22 - error ts(2339): Property 'user' does not exist on type 'Locals'.

74       context.locals.user = {
                        ~~~~
```

This error occurs because TypeScript is resolving to the `Locals` interface from `astro-locals.d.ts` (which doesn't have `user`) instead of the one from `env.d.ts`.

#### 3. **Additional Critical Errors**

- **Missing module declarations**:
  - `./routes/auth` (src/api/server.ts:20)
  - `./middleware/auth` (src/api/server.ts:12)
  - `morgan` (src/api/server.ts:8)
  - Missing `@types/compression` and `@types/pg`

- **`override` modifier missing** in src/api/middleware/error-handler.ts:13

#### 4. **Violations of AGENTS.md Rules**

Found **46 instances** of `@ts-expect-error` / `@ts-ignore` comments, which violate:

```text
⛔ ABSOLUTE PROHIBITION: No Ignore Comments to Silence Warnings
❌ No `// eslint-disable`, `// @ts-ignore`, `# noqa`, etc. to bypass warnings
```

**Most egregious examples**:

- `src/lib/ai/bias-detection/python-bridge.ts`: 3 instances
- `src/lib/monitoring/service.ts`: 8 instances
- `src/lib/logging/index.ts`: 4 instances
- `src/components/ai/SyntheticTherapyDemo.tsx`: 7 instances

---

## 🎯 Solution Strategy

### Phase 1: Consolidate Type Declarations (CRITICAL)

**Goal**: Merge all `Locals` declarations into a single authoritative source.

**Actions**:

1. **Keep**: `src/env.d.ts` as the **single source of truth** for `App.Locals`
2. **Merge content** from other files into `env.d.ts`
3. **Delete** or refactor conflicting declarations in:
   - `src/types/astro-locals.d.ts`
   - Duplicate declarations in `src/types/astro.d.ts`

### Phase 2: Add Missing Type Declarations

**Install missing `@types` packages**:

```bash
pnpm add -D @types/compression @types/morgan @types/pg
```

### Phase 3: Fix Missing Module Paths

**Check if these files exist**:

- `src/api/routes/auth.ts`
- `src/api/middleware/auth.ts`

If not, create stubs or update imports.

### Phase 4: Remove `@ts-ignore` / `@ts-expect-error` Comments

**Follow AGENTS.md guidelines**:

- Fix the root cause instead of suppressing warnings
- If truly a false positive, document with detailed explanation

**Priority files**:

1. `src/lib/ai/bias-detection/python-bridge.ts`
2. `src/lib/monitoring/service.ts`
3. `src/lib/logging/index.ts`
4. `src/components/ai/SyntheticTherapyDemo.tsx`

### Phase 5: Fix Parameter Override Issue

**File**: `src/api/middleware/error-handler.ts:13`

Add the `override` modifier where TypeScript requires it.

---

## 📋 Implementation Checklist

### Immediate (Critical Path)

- [ ] **1.1** Consolidate `App.Locals` interface into `src/env.d.ts`
- [ ] **1.2** Remove duplicate `Locals` declarations from other files
- [ ] **1.3** Ensure `env.d.ts` is included in `tsconfig.json`
- [ ] **1.4** Run `pnpm typecheck` to verify

### High Priority

- [ ] **2.1** Install missing `@types` packages
- [ ] **2.2** Fix missing module paths (`routes/auth`, `middleware/auth`)
- [ ] **2.3** Add `override` modifier to error handler

### Medium Priority

- [ ] **3.1** Remove `@ts-ignore`/`@ts-expect-error` from monitoring files
- [ ] **3.2** Remove `@ts-ignore`/`@ts-expect-error` from logging files
- [ ] **3.3** Fix typing issues in `SyntheticTherapyDemo.tsx`

### Low Priority (Cleanup)

- [ ] **4.1** Remove all remaining `@ts-ignore`/`@ts-expect-error` comments
- [ ] **4.2** Add proper type definitions for Faro monitoring
- [ ] **4.3** Review and tighten `strict` mode settings

---

## 🛡️ Compliance with AGENTS.md

### Violations Found

#### **1. No Ignore Comments** (⛔ ABSOLUTE PROHIBITION)

- **Count**: 46 instances
- **Status**: ❌ VIOLATION
- **Action**: Remove all instances or document thoroughly

#### **2. Path Aliases** (Required)

- **Status**: ✅ COMPLIANT
- All imports use `@/`, `@lib/`, etc.

#### **3. TypeScript Strict Mode** (Required)

- **Status**: ⚠️ PARTIAL
- `noImplicitAny: false` in tsconfig.json
- Should be `true` per strict guidelines

#### **4. No Stubs or Filler** (⛔ ABSOLUTE PROHIBITION)

- **Status**: ✅ COMPLIANT (no obvious stubs found)

---

## 🔧 Recommended Fix Order

1. **Consolidate type declarations** (fixes the middleware error)
2. **Install missing types** (removes implicit `any` warnings)
3. **Fix module path issues** (resolves cannot find module errors)
4. **Remove/document `@ts-ignore` comments** (compliance with guidelines)

---

## 📊 Impact Assessment

### Severity: **CRITICAL** 🔴

- TypeScript server crashes disrupt development
- Intellisense fails
- Type safety compromised

### Effort: **MEDIUM** 🟡

- 2-4 hours to fix all issues thoroughly
- 30 minutes for critical path only

### Risk: **LOW** 🟢

- Changes are mostly type declarations
- No runtime behavior changes
- Easy to verify with `pnpm typecheck`

---

**Generated**: 2026-02-03T23:30:00Z
**Compliance**: AGENTS.md
**Next Steps**: Proceed with Phase 1 (Consolidate Type Declarations)
