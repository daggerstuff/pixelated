/**
 * @file src/lib/memory/contract/route-helpers.ts
 *
 * Shared helpers for the v1 public memory API route handlers. These wrap
 * the existing `withAuthenticatedMemoryRoute` auth + error handling with
 * Zod-validated request parsing and the canonical response envelopes.
 */
import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth'
import {
  ProductMemoryGatewayError,
  type ProductMemoryRecord,
  type ProductMemoryScope,
} from '@/lib/services/product-memory-gateway'

import { errorBody, mapGatewayError } from './errors'
import { MEMORY_API_CONTRACT_VERSION, PublicMemory } from './v1'

// ---------------------------------------------------------------------------
// Response helpers — every v1 route returns one of these two shapes.
// ---------------------------------------------------------------------------

export function jsonResponse<T>(payload: T, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Memory-Contract-Version': MEMORY_API_CONTRACT_VERSION,
    },
  })
}

export function jsonError(mapping: {
  status: number
  code: string
  message: string
}): Response {
  return jsonResponse(errorBody(mapping), mapping.status)
}

// ---------------------------------------------------------------------------
// Zod validation helpers.
// ---------------------------------------------------------------------------

export interface ValidationFailure {
  ok: false
  response: Response
}

export interface ValidationSuccess<T> {
  ok: true
  data: T
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure

export function parseJson<T>(
  schema: z.ZodType<T>,
  raw: unknown,
): ValidationResult<T> {
  const result = schema.safeParse(raw)
  if (!result.success) {
    return {
      ok: false,
      response: jsonError({
        status: 400,
        code: 'validation_failed',
        message: result.error.issues
          .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
          .join('; '),
      }),
    }
  }
  return { ok: true, data: result.data }
}

export async function parseRequestJson<T>(
  schema: z.ZodType<T>,
  request: Request,
): Promise<ValidationResult<T>> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return {
      ok: false,
      response: jsonError({
        status: 400,
        code: 'bad_request',
        message: 'Request body must be valid JSON.',
      }),
    }
  }
  return parseJson(schema, raw)
}

export function parseSearchParams<T>(
  schema: z.ZodType<T>,
  url: URL,
): ValidationResult<T> {
  const obj: Record<string, unknown> = {}
  for (const [key, value] of url.searchParams.entries()) {
    if (key in obj) {
      const existing = obj[key]
      obj[key] = Array.isArray(existing) ? [...existing, value] : [existing, value]
    } else {
      obj[key] = value
    }
  }
  return parseJson(schema, obj)
}

// ---------------------------------------------------------------------------
// Auth + scope resolution.
// ---------------------------------------------------------------------------

export interface AuthenticatedMemoryCaller {
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>
  scope: ProductMemoryScope
}

export async function requireAuthenticatedMemoryCaller(
  request: Request,
): Promise<{ ok: true; caller: AuthenticatedMemoryCaller } | { ok: false; response: Response }> {
  const user = await getCurrentUser(request)
  if (!user) {
    return {
      ok: false,
      response: jsonError({
        status: 401,
        code: 'unauthorized',
        message: 'You must be authenticated to access this endpoint.',
      }),
    }
  }
  return {
    ok: true,
    caller: {
      user,
      scope: {
        userId: user.id,
        accountId: user.accountId,
        workspaceId: user.workspaceId,
        includeShared: true,
      },
    },
  }
}

// ---------------------------------------------------------------------------
// Gateway error → canonical error response.
// ---------------------------------------------------------------------------

/**
 * Lightweight structured logger for the v1 memory routes. Falls back to
 * console to avoid coupling to the build-safe logger (which is heavy and
 * pulls in the wider logging stack).
 */
function logRouteError(action: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  const name = error instanceof Error ? error.name : 'UnknownError'
  // eslint-disable-next-line no-console
  console.error(`[memory-api-v1] ${action} failed: ${name}: ${message}`)
}

export function handleGatewayError(
  action: string,
  error: unknown,
): Response {
  if (error instanceof ProductMemoryGatewayError) {
    logRouteError(action, error)
    const mapping = mapGatewayError(error.status, error.message)
    return jsonError(mapping)
  }
  logRouteError(action, error)
  return jsonError({
    status: 500,
    code: 'internal_error',
    message: 'An unexpected error occurred.',
  })
}

// ---------------------------------------------------------------------------
// Internal → public record projection.
//
// This is the single place where the internal `UnifiedMemory` /
// `ProductMemoryRecord` shape is narrowed down to the public v1 surface.
// Any field NOT explicitly mapped here is intentionally omitted from the
// public contract.
// ---------------------------------------------------------------------------

export function toPublicMemory(
  record: ProductMemoryRecord,
): z.infer<typeof PublicMemory> {
  return PublicMemory.parse({
    id: record.id,
    content: record.content,
    scope: record.scope ?? 'session',
    retention: record.retention ?? 'short_term',
    category: record.category ?? 'general',
    tags: record.tags ?? [],
    version: record.version ?? 1,
    importance: record.importance ?? 0.5,
    createdAt: record.createdAt ?? new Date().toISOString(),
    updatedAt: record.updatedAt ?? null,
  })
}
