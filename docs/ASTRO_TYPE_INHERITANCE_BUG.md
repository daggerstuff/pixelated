# Astro 5.x Type Inheritance Bug: APIContext Request Property Missing

## Problem Statement
When using Astro 5.x API routes with TypeScript, you may encounter this error:
```typescript
Property 'request' does not exist on type 'AuthAPIContext<Record<string, unknown>, Record<string, string | undefined>>'.ts(2339)
```

This occurs when trying to access the `request` property in API route handlers, particularly when using authentication wrappers like `protectRoute()`.

## Root Cause Analysis

### The Bug in Astro Types
Astro 5.x has a type inheritance bug in the `APIContext` interface definition:

```typescript
// In node_modules/astro/dist/types/public/context.d.ts
export interface APIContext<
  Props extends Record<string, any> = Record<string, any>, 
  APIParams extends Record<string, string | undefined> = Record<string, string | undefined>
> extends AstroSharedContext<Props, Params> {  // ← BUG: Uses 'Params' not 'APIParams'
  // ... interface body
}
```

**The Problem**: The interface declares `APIParams` as the second generic but then uses `Params` in the extends clause. This breaks TypeScript's inheritance chain.

### Why This Matters
The `AstroSharedContext` interface correctly defines:
```typescript
export interface AstroSharedContext<Props, RouteParams> {
  request: Request; // ← This property gets lost due to broken inheritance
  url: URL;
  params: RouteParams;
  // ... other properties
}
```

## Symptoms
- ❌ Cannot access `request` property in API route handlers
- ❌ TypeScript errors when destructuring `{ locals, request }` from context
- ❌ Missing other properties from `AstroSharedContext`
- ❌ Occurs specifically with custom context types extending `APIContext`

## The Solution Pattern

### Step 1: Create Independent Base Interface
Instead of relying on Astro's broken inheritance, create your own base interface:

```typescript
// src/lib/auth/apiRouteTypes.ts
interface BaseAPIContext<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Params extends Record<string, string | undefined> = Record<string, string | undefined>
> {
  request: Request;           // ← Explicitly include this!
  url: URL;
  params: Params;
  props: Props;
  redirect(path: string, status?: number): Response;
  locals: Record<string, unknown>;
  cookies: {
    get(name: string): { value: string } | undefined;
    set(name: string, value: string, options?: Record<string, unknown>): void;
    delete(name: string, options?: Record<string, unknown>): void;
  };
}
```

### Step 2: Update Your Auth Context
```typescript
export interface AuthAPIContext<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Params extends Record<string, string | undefined> = Record<string, string | undefined>
> extends BaseAPIContext<Props, Params> {
  locals: BaseAPIContext<Props, Params>["locals"] & {
    user: AuthUser;
  }
  // Explicitly override request for extra clarity
  request: Request;
}
```

### Step 3: Remove Astro Type Dependencies
```typescript
// ❌ Remove these imports
// import type { APIContext, APIRoute } from 'astro'

// ✅ Use your own types instead
import type { AuthAPIContext } from './apiRouteTypes'
```

### Step 4: Update Type Definitions
```typescript
export type ProtectedAPIRoute<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Params extends Record<string, string | undefined> = Record<string, string | undefined>
> = (context: AuthAPIContext<Props, Params>) => Response | Promise<Response>

export type ProtectRouteFunction = <
  Props extends Record<string, unknown> = Record<string, unknown>,
  Params extends Record<string, string | undefined> = Record<string, string | undefined>
>(
  options: ProtectRouteOptions,
) => (
  handler: (context: AuthAPIContext<Props, Params>) => Response | Promise<Response>,
) => (context: BaseAPIContext<Props, Params>) => Response | Promise<Response>
```

## Implementation Checklist

### Files to Update
- `src/lib/auth/apiRouteTypes.ts` - Main type definitions
- Any API route files using `protectRoute()` or similar wrappers
- Any middleware or utilities importing from 'astro' types

### Code Changes Required
1. **Remove Astro imports**:
   ```typescript
   // ❌ Remove
   import type { APIContext, APIRoute } from 'astro'
   
   // ✅ Replace with local types
   import type { AuthAPIContext } from '../path/to/apiRouteTypes'
   ```

2. **Replace any usage**:
   ```typescript
   // ❌ Before
   function handler(context: APIContext) { ... }
   
   // ✅ After  
   function handler(context: AuthAPIContext) { ... }
   ```

3. **Update type safety**:
   ```typescript
   // ❌ Avoid 'any'
   locals: Record<string, any>;
   
   // ✅ Use 'unknown'
   locals: Record<string, unknown>;
   ```

## Verification Steps

### 1. TypeScript Compilation
```bash
# Test specific files
pnpm exec tsc --noEmit --skipLibCheck src/pages/api/emotions/session-analysis.ts src/lib/auth/apiRouteTypes.ts

# Should produce no output (meaning no errors)
```

### 2. VS Code Error Check
- Open the affected API route files
- Verify no red squiggly lines under `request` property access
- Check that intellisense works for `request.url`, `request.method`, etc.

### 3. Runtime Testing
```typescript
export const GET = protectRoute()(async ({ locals, request }) => {
  // ✅ Should work without TypeScript errors
  const url = new URL(request.url)
  const method = request.method
  const { user } = locals
  
  // ... rest of handler
})
```

## When This Will Happen Again

### Triggering Conditions
- ✅ **Upgrading Astro versions** - Bug may persist or change form
- ✅ **Adding new API routes** with authentication
- ✅ **Creating new middleware** that extends Astro contexts
- ✅ **Team members** encountering this for the first time

### Quick Diagnosis
Look for these error patterns:
```typescript
Property 'request' does not exist on type 'AuthAPIContext'
Property 'url' does not exist on type 'AuthAPIContext'  
Property 'params' does not exist on type 'AuthAPIContext'
Module '"astro"' has no exported member 'APIContext'
```

### Rapid Response
1. **Check imports**: Look for `import { APIContext } from 'astro'`
2. **Apply pattern**: Use the `BaseAPIContext` approach documented here
3. **Test quickly**: `pnpm exec tsc --noEmit --skipLibCheck <file>`
4. **Verify**: Ensure `request` property is accessible

## Related Issues
- **GitHub Issue**: [Astro APIContext type inheritance bug](https://github.com/withastro/astro/issues/XXXXX) *(if reported)*
- **Workaround tracking**: This document in `/docs/ASTRO_TYPE_INHERITANCE_BUG.md`
- **Code examples**: See `/src/lib/auth/apiRouteTypes.ts` for working implementation

## Future Considerations
- **Monitor Astro releases** for fixes to this inheritance issue
- **Consider contributing** a fix upstream to Astro
- **Document any variations** of this pattern needed for other Astro contexts
- **Update this doc** when the bug is fixed or patterns change

---

**Last Updated**: July 6, 2025  
**Astro Version**: 5.10.1  
**Status**: Active workaround required
