# Systematic Build Errors Fix Plan

## Overview
This plan addresses the build errors discovered during test execution. Errors are categorized and prioritized for systematic resolution.

## Error Categories

### Category 1: Better-Auth Integration Export Mismatches (HIGH PRIORITY)
**Issue**: Test files expect functions that don't exist or have different names.

**Errors**:
- `registerUser` - should be `registerWithBetterAuth`
- `loginUser` - should be `authenticateWithBetterAuth`
- `logoutUser` - should be `logoutFromBetterAuth`
- `getUserById` - should be `getUserAuthentication` or `getUserAuthenticationByBetterAuthId`
- `updateUserProfile` - doesn't exist
- `changePassword` - doesn't exist
- `validateUserRole` - should be `hasRequiredRole` or `hasPermission`
- `AuthenticationError` - exists in `jwt-service.ts`, needs to be re-exported
- `BetterAuthIntegrationService` - doesn't exist as a class

**Files Affected**:
- `src/lib/auth/__tests__/better-auth-integration.test.ts`
- `src/lib/auth/__tests__/middleware.test.ts`
- `src/lib/auth/jwt-token-service.ts`

**Fix Strategy**:
1. Update test imports to match actual exports
2. Add missing wrapper functions if needed for backward compatibility
3. Re-export `AuthenticationError` from `better-auth-integration.ts`
4. Fix `jwt-token-service.ts` to use correct API

### Category 2: Security Module Exports (HIGH PRIORITY)
**Issue**: `logSecurityEvent` signature mismatch.

**Error**: 
- `logSecurityEvent` is called with 3 parameters `(type, userId, metadata)` but function signature is `(type, metadata)`
- `SecurityEventType` is correctly exported from `security/index.ts` (line 273)

**Files Affected**:
- `src/lib/auth/better-auth-integration.ts` - Multiple calls (lines 191, 208, 286, 302, 360)
- `src/lib/auth/role-transitions.ts` - Multiple calls
- `src/lib/auth/session-management.ts` - Multiple calls
- `src/lib/auth/two-factor-auth.ts` - Multiple calls
- `src/lib/auth/jwt-service.ts` - Multiple calls (lines 287, 349, 364, 409, 448, 482)
- `src/lib/auth/middleware.ts` - Line 326

**Fix Strategy**:
1. Update all `logSecurityEvent(type, userId, metadata)` calls to `logSecurityEvent(type, { userId, ...metadata })`
2. Ensure userId is included in metadata object
3. Keep `SecurityEventType` imports as-is (they're correct)

### Category 3: Audit Log Exports (MEDIUM PRIORITY)
**Issue**: Missing or incorrectly named audit log functions.

**Errors**:
- `createAuditLog` - should be `logAuditEvent` (from audit/log.ts)
- `createResourceAuditLog` - doesn't exist, needs to be created or use `logAuditEvent`

**Files Affected**:
- `src/lib/auth/__tests__/serverAuth.test.ts`
- `src/lib/middleware/auth.middleware.ts`
- `src/lib/db/security/initialize.ts`

**Fix Strategy**:
1. Check `src/lib/audit/index.ts` - it exports `createAuditLog` from `./log`
2. Verify `audit/log.ts` exports `createAuditLog` or needs to be added
3. Create `createResourceAuditLog` wrapper if needed, or update imports to use `logAuditEvent`

### Category 4: Logger Exports (MEDIUM PRIORITY)
**Issue**: Files trying to import `logger` directly instead of using factory functions.

**Errors**:
- `logger` not exported from `src/lib/logging/index.ts` or `src/lib/logging.ts`
- Files should use `getLogger()` or `createBuildSafeLogger()`

**Files Affected**:
- `src/lib/deployment/multi-region/*.ts` (multiple files)
- `src/lib/services/notification/__tests__/WebSocketServer.test.ts`

**Fix Strategy**:
1. Update all imports from `import { logger }` to `import { getLogger }` or `import { createBuildSafeLogger }`
2. Initialize logger in each file: `const logger = getLogger('module-name')` or `createBuildSafeLogger('module-name')`

### Category 5: EmotionValidationPipeline Export (LOW PRIORITY)
**Issue**: Test imports class but only instance is exported.

**Error**:
- Test imports `EmotionValidationPipeline` but only `emotionValidationPipeline` (instance) is exported

**Files Affected**:
- `src/lib/ai/emotions/__tests__/EmotionValidationPipeline.test.ts`

**Fix Strategy**:
1. Export the class: `export { EmotionValidationPipeline }` in addition to the instance
2. Or update test to test the instance directly

### Category 6: Missing Type Dependencies (LOW PRIORITY)
**Issue**: Missing type packages for build tools.

**Error**:
- `mdast` types missing for `plugins/remark-image-container.ts` and `plugins/remark-reading-time.ts`

**Fix Strategy**:
1. Install missing types: `pnpm add -D @types/mdast`
2. Or add type declarations if types don't exist

### Category 7: Other Missing Exports (VARIES)
**Issues**:
- Various modules have missing exports that other files expect
- FHE service exports
- Threat intelligence exports
- Research service exports

**Fix Strategy**:
1. Audit each error individually
2. Add missing exports or update imports to match actual exports
3. Consider creating wrapper/adapter functions if API changed

## Implementation Order

### Phase 1: Critical Auth Fixes (Blocks tests)
1. Fix better-auth integration exports and test imports
2. Fix SecurityEventType and logSecurityEvent usage
3. Fix AuthenticationError exports

### Phase 2: Core Infrastructure
4. Fix audit log exports
5. Fix logger imports across codebase

### Phase 3: Component Fixes
6. Fix EmotionValidationPipeline export
7. Fix type dependencies (mdast)

### Phase 4: Cleanup
8. Fix remaining missing exports
9. Run full typecheck and verify all errors resolved

## Testing Strategy

After each phase:
1. Run `pnpm typecheck` to verify errors are resolved
2. Run affected test suites
3. Verify no regressions in working code

## Files to Modify

### High Priority
1. `src/lib/auth/better-auth-integration.ts` - Add missing exports/aliases AND fix logSecurityEvent calls
2. `src/lib/auth/__tests__/better-auth-integration.test.ts` - Update imports to match actual exports
3. `src/lib/auth/__tests__/middleware.test.ts` - Update imports
4. `src/lib/auth/jwt-token-service.ts` - Fix BetterAuthIntegrationService usage AND logSecurityEvent calls
5. `src/lib/auth/role-transitions.ts` - Fix logSecurityEvent calls (multiple)
6. `src/lib/auth/session-management.ts` - Fix logSecurityEvent calls (multiple)
7. `src/lib/auth/two-factor-auth.ts` - Fix logSecurityEvent calls (multiple)
8. `src/lib/auth/middleware.ts` - Fix logSecurityEvent call

### Medium Priority
9. `src/lib/audit/log.ts` - Add createAuditLog export if missing
10. `src/lib/audit/index.ts` - Verify exports
11. Multiple files in `src/lib/deployment/multi-region/` - Fix logger imports
12. `src/lib/services/notification/__tests__/WebSocketServer.test.ts` - Fix logger import

### Low Priority
13. `src/lib/ai/emotions/EmotionValidationPipeline.ts` - Export class
14. `plugins/remark-image-container.ts` - Add type dependency
15. `plugins/remark-reading-time.ts` - Add type dependency

## Success Criteria

- `pnpm typecheck` passes with zero errors
- All test files compile successfully
- No breaking changes to public APIs (or documented if unavoidable)

