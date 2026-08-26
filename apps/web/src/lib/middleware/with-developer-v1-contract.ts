/**
 * @file src/lib/middleware/with-developer-v1-contract.ts
 *
 * Shared middleware for the developer-facing v1 public memory API.
 *
 * Wraps every developer API route handler with:
 *
 *  1. API-key authentication — extracts `X-API-Key`, validates it via
 *     `developerApiKeyManager`, and rejects unknown/expired keys.
 *  2. Scope authorization — enforces that the key has at least one of the
 *     required scopes for the operation.
 *  3. Caller hydration — resolves the developer's `userId` (and best-effort
 *     tenant/workspace when available) so the same `ProductMemoryGateway`
 *     can be used without code duplication.
 *  4. Error boundary — maps failures to the canonical `MemoryApiError`
 *     envelope.
 *
 * Read operations require:  `read` or `memory:read`.
 * Write operations require: `write` or `memory:write`.
 */
import { developerApiKeyManager } from '@/lib/db/developer-api-keys'
import { userManager } from '@/lib/db/index'
import {
  handleGatewayError,
  type AuthenticatedMemoryCaller,
} from '@/lib/memory/contract/route-helpers'

import { withV1Contract, V1RouteContext } from './with-v1-contract'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DeveloperScope = 'read' | 'write'

export interface DeveloperV1RouteContext extends V1RouteContext {}

// ---------------------------------------------------------------------------
// Scope helpers
// ---------------------------------------------------------------------------

const READ_SCOPES = new Set(['read', 'memory:read'])
const WRITE_SCOPES = new Set(['write', 'memory:write'])

function hasAnyScope(scopes: string[], allowed: Set<string>): boolean {
  return scopes.some((scope) => allowed.has(scope))
}

function isReadScope(scope: DeveloperScope): boolean {
  return scope === 'read'
}

function isWriteScope(scope: DeveloperScope): boolean {
  return scope === 'write'
}

function allowedScopesFor(operation: DeveloperScope): Set<string> {
  return isReadScope(operation) ? READ_SCOPES : WRITE_SCOPES
}

// ---------------------------------------------------------------------------
// Auth + caller resolution
// ---------------------------------------------------------------------------

export interface DeveloperAuthFailure {
  ok: false
  response: Response
}

export interface DeveloperAuthSuccess {
  ok: true
  caller: AuthenticatedMemoryCaller
}

export type DeveloperAuthResult = DeveloperAuthSuccess | DeveloperAuthFailure

/**
 * Resolve a developer caller from an API key.
 *
 * Reads `X-API-Key`, validates it against the database, checks the requested
 * operation scope, and hydrates the caller context. If the user's tenant
 * context (account/workspace) can be looked up, it is attached so the memory
 * gateway enforces the same isolation as product-session callers.
 */
export async function requireDeveloperMemoryCaller(
  request: Request,
  operation: DeveloperScope,
): Promise<DeveloperAuthResult> {
  const apiKey = request.headers.get('X-API-Key')

  if (!apiKey) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({
          error: 'unauthorized',
          message: 'X-API-Key header is required.',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    }
  }

  const validation = await developerApiKeyManager.validateApiKey(apiKey)

  if (!validation.valid || !validation.api_key) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({
          error: 'unauthorized',
          message: 'Invalid or revoked API key.',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    }
  }

  const keyRecord = validation.api_key
  const scopes = keyRecord.scopes ?? []

  if (!hasAnyScope(scopes, allowedScopesFor(operation))) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({
          error: 'forbidden',
          message: `API key is missing a required scope for this operation. Required: ${[...allowedScopesFor(operation)].join(' or ')}`,
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      ),
    }
  }

  // Hydrate user context so the gateway can apply workspace-level tenant
  // isolation. This is best-effort; the gateway accepts undefined values and
  // falls back to user-level isolation. account_id is intentionally not
  // hydrated because it is not currently stored on the users table.
  let workspaceId: string | undefined
  try {
    const user = await userManager.getUserById(keyRecord.user_id)
    if (user && typeof user.workspace_id === 'string') {
      workspaceId = user.workspace_id
    }
  } catch {
    // Best-effort hydration; continue with user-level isolation.
  }

  return {
    ok: true,
    caller: {
      user: {
        id: keyRecord.user_id,
        role: keyRecord.scopes.includes('admin') ? 'admin' : 'developer',
        workspaceId,
      },
      scope: {
        userId: keyRecord.user_id,
        workspaceId,
        includeShared: true,
      },
    },
  }
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export type DeveloperV1AuthHandler = (
  context: DeveloperV1RouteContext,
  caller: AuthenticatedMemoryCaller,
) => Promise<Response>

/**
 * Wrap a developer API route handler with API-key auth + scope checking.
 *
 * Usage:
 *
 *   export const GET = withDeveloperV1Contract('read', async (ctx, caller) => {
 *     // caller.user.id / caller.scope — developer identity and scope
 *   })
 */
export function withDeveloperV1Contract(
  operation: DeveloperScope,
  handler: DeveloperV1AuthHandler,
): (context: DeveloperV1RouteContext) => Promise<Response> {
  return async (context: DeveloperV1RouteContext): Promise<Response> => {
    const auth = await requireDeveloperMemoryCaller(context.request, operation)
    if (!auth.ok) return auth.response

    try {
      return await handler(context, auth.caller)
    } catch (err) {
      return handleGatewayError(`developer:${operation}`, err)
    }
  }
}
