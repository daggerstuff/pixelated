/**
 * Centralized API Error Handler
 *
 * Wraps Astro API route handlers with consistent error handling,
 * logging, and response formatting. Replaces the ad-hoc
 * try/catch + Response pattern repeated across 270+ endpoints.
 *
 * Usage:
 *   export const POST: APIRoute = withErrorHandler(async ({ request }) => {
 *     // endpoint logic — throw on error, return data on success
 *     return data
 *   })
 *
 * Or with options:
 *   export const POST: APIRoute = withErrorHandler(
 *     async ({ request }) => { ... },
 *     { endpoint: '/api/chat', method: 'POST' }
 *   )
 */

import type { APIRoute, APIContext } from 'astro'

// ── Types ─────────────────────────────────────────────────────────────

export interface ApiErrorResponse {
  error: string
  message?: string
  statusCode: number
  timestamp: string
  path?: string
}

export interface ApiSuccessResponse<T = unknown> {
  data: T
  statusCode: number
}

export interface ErrorHandlerOptions {
  /** Endpoint path for logging (e.g. '/api/chat') */
  endpoint?: string
  /** HTTP method for logging */
  method?: string
  /** Whether to include stack trace in dev mode (default: true in dev) */
  includeStack?: boolean
  /** Custom error mappers for specific error types */
  errorMappers?: Array<{
    match: (error: unknown) => boolean
    toResponse: (error: unknown) => { status: number; message: string }
  }>
}

// ── Standard Error Mappers ────────────────────────────────────────────

const defaultErrorMappers: NonNullable<ErrorHandlerOptions['errorMappers']> = [
  {
    match: (e): e is TypeError => e instanceof TypeError,
    toResponse: () => ({ status: 400, message: 'Invalid request data' }),
  },
  {
    match: (e): e is RangeError => e instanceof RangeError,
    toResponse: () => ({ status: 400, message: 'Value out of range' }),
  },
  {
    match: (e): e is SyntaxError => e instanceof SyntaxError,
    toResponse: () => ({ status: 400, message: 'Malformed request' }),
  },
  {
    match: (e): e is EvalError => e instanceof EvalError,
    toResponse: () => ({ status: 500, message: 'Internal evaluation error' }),
  },
]

// ── Response Helpers ──────────────────────────────────────────────────

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function errorResponse(
  message: string,
  status: number,
  options?: ErrorHandlerOptions,
): Response {
  const body: ApiErrorResponse = {
    error: message,
    statusCode: status,
    timestamp: new Date().toISOString(),
    ...(options?.endpoint ? { path: options.endpoint } : {}),
  }
  return jsonResponse(body, status)
}

// ── Logging ───────────────────────────────────────────────────────────

function logError(
  error: unknown,
  status: number,
  options?: ErrorHandlerOptions,
): void {
  const isDev = import.meta.env?.DEV ?? process.env.NODE_ENV !== 'production'
  const label = options?.endpoint
    ? `${options.method ?? 'GET'} ${options.endpoint}`
    : 'API'

  const errorType = error instanceof Error ? error.constructor.name : typeof error
  const errorMsg = error instanceof Error ? error.message : String(error)

  if (isDev) {
    // In dev, log full details
    console.error(`[${label}] ${errorType}: ${errorMsg}`)
    if (error instanceof Error && error.stack) {
      console.error(error.stack)
    }
  } else {
    // In production, log structured but minimal
    console.error(`[${label}] ${status} ${errorType}: ${errorMsg}`)
  }
}

// ── Main Wrapper ──────────────────────────────────────────────────────

/**
 * Wraps an Astro API route handler with centralized error handling.
 *
 * The wrapped handler can:
 * - Return a Response directly (pass-through)
 * - Return any serializable data (auto-wrapped as JSON with 200)
 * - Throw an Error (caught and formatted as error response)
 *
 * @example
 * export const POST: APIRoute = withErrorHandler(async ({ request }) => {
 *   const data = await request.json()
 *   if (!data.name) throw new Error('Name is required')
 *   return { success: true, data }
 * })
 */
export function withErrorHandler(
  handler: (ctx: APIContext) => Promise<Response> | Promise<unknown>,
  options?: ErrorHandlerOptions,
): APIRoute {
  return async (ctx: APIContext): Promise<Response> => {
    try {
      const result = await handler(ctx)

      // If handler returns a Response, pass through
      if (result instanceof Response) {
        return result
      }

      // Auto-wrap data as success response
      return jsonResponse(
        { data: result, statusCode: 200 },
        200,
      )
    } catch (error: unknown) {
      // Run custom error mappers first, then defaults
      const mappers = [
        ...(options?.errorMappers ?? []),
        ...defaultErrorMappers,
      ]

      let status = 500
      let message = 'An unexpected error occurred'

      for (const mapper of mappers) {
        if (mapper.match(error)) {
          const mapped = mapper.toResponse(error)
          status = mapped.status
          message = mapped.message
          break
        }
      }

      // If no mapper matched, use error message for generic Error
      if (status === 500 && error instanceof Error) {
        // Don't leak internal error messages in production
        const isDev = import.meta.env?.DEV ?? process.env.NODE_ENV !== 'production'
        if (isDev) {
          message = error.message
        }
      }

      logError(error, status, options)

      return errorResponse(message, status, options)
    }
  }
}

/**
 * Creates a standard error response without wrapping a handler.
 * Useful when you need to return an error manually.
 */
export function createApiError(
  message: string,
  status = 400,
  options?: ErrorHandlerOptions,
): Response {
  return errorResponse(message, status, options)
}

/**
 * Creates a standard success response.
 */
export function createApiSuccess(
  data: unknown,
  status = 200,
): Response {
  return jsonResponse({ data, statusCode: status }, status)
}
