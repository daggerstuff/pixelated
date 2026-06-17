/**
 * @file src/lib/middleware/with-v1-contract.ts
 *
 * Shared middleware for the v1 public memory API route handlers.
 *
 * Wraps every Astro API route handler with:
 *
 *  1. Authentication — resolves the caller's identity/scope from the session
 *     via `requireAuthenticatedMemoryCaller`. Returns a 401 on failure.
 *  2. Error boundary — catches any thrown error (gateway errors, runtime
 *     exceptions) and maps it to the canonical `MemoryError` envelope via
 *     `handleGatewayError`. Non-gateway errors map to 500 `internal_error`.
 *
 * Handlers receive the caller's identity/scope as the second argument, so
 * they never need to call `requireAuthenticatedMemoryCaller` themselves.
 *
 * NOTE: Input validation (Zod parse) is NOT part of this wrapper. Each
 * handler calls `parseRequestJson` / `parseSearchParams` per-operation so
 * that the right schema is used and the 400 response includes field-level
 * detail. This wrapper only covers the auth + crash boundary that is
 * identical across every handler.
 */
import {
  handleGatewayError,
  requireAuthenticatedMemoryCaller,
  type AuthenticatedMemoryCaller,
} from '@/lib/memory/contract/route-helpers'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface V1RouteContext {
  request: Request
  params?: Record<string, string | undefined>
}

export type V1AuthHandler<TContext extends V1RouteContext> = (
  context: TContext,
  caller: AuthenticatedMemoryCaller,
) => Promise<Response>

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Wrap an Astro API route handler with authentication + error boundary.
 *
 * Usage:
 *
 *   export const GET = withV1Contract('listMemories', async (ctx, caller) => {
 *     // ctx.request / ctx.params — the Astro API route context
 *     // caller.user / caller.scope — authenticated identity and scope
 *   })
 */
export function withV1Contract<TContext extends V1RouteContext>(
  action: string,
  handler: V1AuthHandler<TContext>,
): (context: TContext) => Promise<Response> {
  return async (context: TContext): Promise<Response> => {
    const auth = await requireAuthenticatedMemoryCaller(context.request)
    if (!auth.ok) return auth.response

    try {
      return await handler(context, auth.caller)
    } catch (err) {
      return handleGatewayError(action, err)
    }
  }
}
