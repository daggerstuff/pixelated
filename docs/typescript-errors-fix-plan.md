# TypeScript Errors Fix Plan

**Created:** 2025-01-XX  
**Status:** In Progress  
**Source:** GitLab CI log (`/tmp/gitlab.log`)

## Overview

This document tracks the systematic approach to fixing remaining TypeScript errors identified in the GitLab CI build log.

## Progress Summary

- ✅ **Completed:** Config types, Export errors, TherapeuticResponse, Button types
- 🔄 **In Progress:** Test file AstroComponent errors
- ⏳ **Pending:** Deprecation warnings, Other minor issues

---

## Phase 1: Test File AstroComponent Type Errors

### Strategy
These errors occur because Astro components don't match the expected `AstroComponent` type in test utilities. Need to:
1. Standardize test utilities
2. Update type assertions in test files
3. Fix component prop type mismatches

### Files to Fix

#### Category A: Alert Component Tests
- [ ] `src/components/ui/__tests__/Alert.test.ts` (10 errors)
  - **Issue:** Component type not assignable to AstroComponent
  - **Fix:** Add proper type assertion or update renderAstro utility
  - **Lines:** 7, 19, 38, 55, 69, 81, 93, 104, 114, 125

#### Category B: Card Component Tests  
- [ ] `src/components/ui/__tests__/Card.test.ts` (15 errors)
  - **Issue:** `as unknown` type assertions failing
  - **Fix:** Update type assertions to use proper AstroComponent type
  - **Lines:** 14, 32, 41, 48, 63, 76, 83, 90, 99, 106, 113, 120, 132, 139, 152, 160

#### Category C: ThemeToggle Component Tests
- [ ] `src/components/ui/__tests__/ThemeToggle.test.ts` (7 errors)
  - **Issue:** Similar to Card - type assertion problems
  - **Fix:** Use proper type casting
  - **Lines:** 39, 47, 77, 103, 115, 134

#### Category D: Security Dashboard Tests
- [ ] `src/components/security/__tests__/SecurityDashboard.test.ts` (5 errors)
  - **Issue:** Component not assignable to AstroComponent
  - **Fix:** Update renderAstro calls with proper typing
  - **Lines:** 17, 37, 51, 65, 74

#### Category E: RealUserMonitoring Tests
- [ ] `src/components/monitoring/__tests__/RealUserMonitoring.astro.test.ts` (1 error)
  - **Issue:** Props type mismatch - missing index signature
  - **Fix:** Add index signature to RealUserMonitoringProps or update mock
  - **Line:** 127

### Action Items

#### Step 1: Standardize Test Utilities ⏳
- [ ] Review `src/test/utils/astro.tsx` and `src/test/utils/astro.ts`
- [ ] Create unified `AstroComponent` type definition
- [ ] Update `renderAstro` function signature to accept broader component types
- [ ] Export proper types from test utilities

#### Step 2: Fix Alert Tests ⏳
- [ ] Read `src/components/ui/__tests__/Alert.test.ts`
- [ ] Check Alert component export structure
- [ ] Update renderAstro calls with proper type assertions
- [ ] Verify tests still pass

#### Step 3: Fix Card Tests ⏳
- [ ] Read `src/components/ui/__tests__/Card.test.ts`
- [ ] Replace `as unknown` with proper type assertions
- [ ] Import correct AstroComponent type
- [ ] Verify all Card component variants work

#### Step 4: Fix ThemeToggle Tests ⏳
- [ ] Read `src/components/ui/__tests__/ThemeToggle.test.ts`
- [ ] Apply same pattern as Card tests
- [ ] Verify type assertions

#### Step 5: Fix Security Dashboard Tests ⏳
- [ ] Read `src/components/security/__tests__/SecurityDashboard.test.ts`
- [ ] Check SecurityDashboard component structure
- [ ] Update renderAstro calls
- [ ] Verify component rendering

#### Step 6: Fix RealUserMonitoring Test ⏳
- [ ] Read `src/components/monitoring/__tests__/RealUserMonitoring.astro.test.ts`
- [ ] Check RealUserMonitoringProps interface
- [ ] Add index signature `[key: string]: unknown` if needed
- [ ] Or update mock component props type
- [ ] Verify test passes

---

## Phase 2: Deprecation Warnings

### Strategy
These are warnings, not errors, but should be addressed for code quality.

### Files to Review

- [ ] `src/config/cdn.ts` (2 warnings)
  - **Issue:** `z.string().url()` is deprecated
  - **Fix:** Update to new Zod URL validation API
  - **Lines:** 11, 42

### Action Items

- [ ] Check Zod documentation for new URL validation syntax
- [ ] Update `src/config/cdn.ts` with new API
- [ ] Verify validation still works correctly

---

## Phase 3: Other Minor Issues

### Unused Variables/Imports
- [ ] Review and fix all unused variable warnings
- [ ] Use `_` prefix for intentionally unused parameters
- [ ] Remove truly unused imports

### Code Style Issues
- [ ] Fix any remaining code style warnings
- [ ] Ensure consistent formatting

---

## Implementation Guidelines

### For Test File Fixes

1. **Type Assertion Pattern:**
```typescript
// Instead of:
await renderAstro(Component as unknown)

// Use:
await renderAstro(Component as AstroComponent)
// Or create proper type helper
```

2. **Component Type Definition:**
```typescript
interface AstroComponent {
  render: (props: Record<string, unknown>) => Promise<{ html: string }>
}
```

3. **Test Utility Updates:**
- Make `renderAstro` more flexible with component types
- Add proper type guards or overloads
- Export types for reuse

### Testing After Fixes

After fixing each category:
- [ ] Run TypeScript check: `pnpm check:types` or `pnpm tsc --noEmit`
- [ ] Run tests: `pnpm test <specific-test-file>`
- [ ] Verify no new errors introduced

---

## Verification Checklist

After all fixes:
- [ ] Run full type check: `pnpm check:all`
- [ ] Run all tests: `pnpm test:all`
- [ ] Check GitLab CI log for remaining errors
- [ ] Document any new patterns discovered
- [ ] Update test utilities documentation if needed

---

## Notes

- **Test Utility Locations:**
  - `src/test/utils/astro.tsx` - React-based renderer
  - `src/test/utils/astro.ts` - Basic renderer
  - `src/test-utils/astro-test-utils.ts` - Additional utilities

- **Common Pattern:**
  Many errors stem from Astro components being functions that return JSX, but test utilities expect a specific interface with a `render` method.

- **Best Practice:**
  Create a unified test utility that properly handles Astro component types and export it for reuse across all test files.

---

## Resources

- [Astro Component Testing Guide](https://docs.astro.build/en/guides/testing/)
- TypeScript Handbook - Type Assertions
- Zod Migration Guide for URL validation
