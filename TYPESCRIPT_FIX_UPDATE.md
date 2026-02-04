# TypeScript Server Investigation - Update

## Current Status: Type Resolution Failing

The `App.Locals` interface is properly defined in `src/env.d.ts`, but TypeScript is NOT picking it up when used in `defineMiddleware` from `astro:middleware`.

### Root Cause

The `defineMiddleware` function from Astro uses its own internal typing that may not properly merge with `App.Locals` declarations.

From Astro's TypeScript definitions, `defineMiddleware` has this signature:

```typescript
export function defineMiddleware<Locals = object>(
  fn: (context: MiddlewareContext<Locals>, next: MiddlewareNext) => ...
): ...
```

The default `Locals = object` means it doesn't automatically infer our `App.Locals` interface.

### Solution Options

#### Option 1: Explicit Type Parameter (RECOMMENDED)

Pass the type explicitly to `defineMiddleware`:

```typescript
const projectAuthMiddleware = defineMiddleware<App.Locals>(
  async (context, next) => {
    // Now context.locals is properly typed as App.Locals
    context.locals.user = { ... }  // ✅ Works!
  }
)
```

#### Option 2: Type Assertion (Current Attempt - INCOMPLETE)

```typescript
(context.locals as App.Locals).user = { ... }
```

This works but is verbose and doesn't fix the underlying issue.

#### Option 3: Augment Astro's Module Types

Create a proper module augmentation:

```typescript
// In env.d.ts
declare module 'astro:middleware' {
  interface MiddlewareLocals extends App.Locals {}
}
```

### Additional Errors Found

Running `pnpm typecheck` reveals **17+ additional TypeScript errors** beyond the `Locals` issue:

1. **Missing modules**:
   - `./routes/auth`
   - `./middleware/auth`
   - `morgan`

2. **Missing type declarations**:
   - `@types/compression`
   - `@types/pg`

3. **Logic errors**:
   - `src/api/middleware/rate-limiter.ts`: Not all code paths return a value (2 instances)
   - `src/api/middleware/logger.ts`: Block-scoped variable used before declaration
   - `src/api/routes/documents.ts`: Type mismatches (6 instances)

4. **Override modifier missing**:
   - `src/api/middleware/error-handler.ts:13`

### Recommended Fix Strategy

1. **Immediate** (Fixes the Locals issue):
   - Use Option 1: Add explicit type parameter to `defineMiddleware<App.Locals>`

2. **Short-term** (Install missing types):

   ```bash
   pnpm add -D @types/compression @types/morgan @types/pg
   ```

3. **Medium-term** (Fix logic errors):
   - Fix rate-limiter return paths
   - Fix logger variable hoisting
   - Fix documents route type mismatches

4. **Long-term** (Compliance):
   - Remove all 46 instances of `@ts-ignore`/`@ts-expect-error`
   - Enable `noImplicitAny: true` in tsconfig.json

---

**Next Action**: Implement Option 1 to fix the immediate `Locals` error.
