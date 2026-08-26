/**
 * @file src/lib/memory/contract/errors.ts
 *
 * Canonical error contract for the public memory API.
 *
 * The error envelope is intentionally small and stable:
 *
 *   { "error": "<MachineReadableCode>", "message": "<HumanReadableMessage>" }
 *
 * - `error`   — a stable, machine-readable string from `MemoryApiErrorCode`
 *               below. Consumers SHOULD switch on this value, not on
 *               `message` or `status`.
 * - `message` — a human-readable explanation, safe to show to end users.
 *               MUST NOT contain internal stack traces, raw gateway
 *               errors, or PII.
 *
 * The HTTP status code carries the coarse-grained category; the `error`
 * code carries the fine-grained reason. This separation lets the API
 * evolve statuses (e.g. retry semantics) without breaking consumers.
 */
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Machine-readable error codes — the public API's stable error vocabulary.
//
// Adding a new code is backwards-compatible. Renaming or removing a code is
// a BREAKING change and requires a new contract version.
// ---------------------------------------------------------------------------

export const MemoryApiErrorCode = {
  // 4xx — caller errors
  BadRequest: 'bad_request',
  ValidationFailed: 'validation_failed',
  Unauthorized: 'unauthorized',
  Forbidden: 'forbidden',
  NotFound: 'not_found',
  Conflict: 'conflict',
  PayloadTooLarge: 'payload_too_large',
  RateLimited: 'rate_limited',
  GateBlocked: 'gate_blocked',

  // 5xx — server / downstream errors
  InternalError: 'internal_error',
  UpstreamUnavailable: 'upstream_unavailable',
  UpstreamTimeout: 'upstream_timeout',
} as const

export type MemoryApiErrorCode =
  (typeof MemoryApiErrorCode)[keyof typeof MemoryApiErrorCode]

export const MemoryApiErrorCodeSchema = z.enum([
  ...Object.values(MemoryApiErrorCode),
] as [MemoryApiErrorCode, ...MemoryApiErrorCode[]])

/**
 * Canonical error envelope returned by every `/api/v1/memory/*` endpoint
 * on failure.
 */
export const MemoryApiError = z
  .object({
    error: z.string().min(1),
    message: z.string().min(1),
    code: MemoryApiErrorCodeSchema.optional(),
    details: z.record(z.string(), z.unknown()).optional(),
    requestId: z.string().optional(),
  })
  .strict()
export type MemoryApiError = z.infer<typeof MemoryApiError>

/**
 * Mapping from gateway / internal failure modes to the canonical
 * `(status, code, message)` triple.
 */
export interface ErrorMapping {
  status: number
  code: MemoryApiErrorCode
  message: string
}

export function mapGatewayError(
  status: number,
  gatewayMessage: string,
): ErrorMapping {
  if (status === 400) {
    return {
      status: 400,
      code: MemoryApiErrorCode.BadRequest,
      message: 'The request was invalid.',
    }
  }
  if (status === 401) {
    return {
      status: 401,
      code: MemoryApiErrorCode.Unauthorized,
      message: 'Authentication is required to access this resource.',
    }
  }
  if (status === 403) {
    return {
      status: 403,
      code: MemoryApiErrorCode.Forbidden,
      message: 'You are not permitted to access this resource.',
    }
  }
  if (status === 404) {
    return {
      status: 404,
      code: MemoryApiErrorCode.NotFound,
      message: 'The requested memory was not found.',
    }
  }
  if (status === 409) {
    return {
      status: 409,
      code: MemoryApiErrorCode.Conflict,
      message:
        gatewayMessage || 'The request conflicts with the current state.',
    }
  }
  if (status === 413) {
    return {
      status: 413,
      code: MemoryApiErrorCode.PayloadTooLarge,
      message: 'The request body is too large.',
    }
  }
  if (status === 429) {
    return {
      status: 429,
      code: MemoryApiErrorCode.RateLimited,
      message: 'Rate limit exceeded. Please retry after a short delay.',
    }
  }
  if (status === 502 || status === 503) {
    return {
      status: 502,
      code: MemoryApiErrorCode.UpstreamUnavailable,
      message: 'The memory service is temporarily unavailable.',
    }
  }
  if (status === 504) {
    return {
      status: 504,
      code: MemoryApiErrorCode.UpstreamTimeout,
      message: 'The memory service timed out.',
    }
  }
  return {
    status: 500,
    code: MemoryApiErrorCode.InternalError,
    message: 'An unexpected error occurred.',
  }
}

/**
 * Construct the canonical error response body. The `code` is typed
 * permissively (string) so route helpers can pass inline error codes
 * without having to widen every call site; the envelope itself is still
 * the strict `MemoryApiError` shape.
 */
export function errorBody(mapping: {
  code: string
  message: string
  details?: Record<string, unknown>
  requestId?: string
}): MemoryApiError {
  const codeValue = MemoryApiErrorCodeSchema.safeParse(mapping.code)
  return {
    error: mapping.code,
    message: mapping.message,
    code: codeValue.success ? codeValue.data : undefined,
    details: mapping.details,
    requestId: mapping.requestId,
  }
}
