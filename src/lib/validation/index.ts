import { z } from 'zod'

/**
 * Type for Zod formatted error
 */
export interface ZodFormattedError {
  _errors: string[]
  [key: string]: ZodFormattedError | string[]
}

/**
 * Type for validation error details
 */
export type ValidationErrorDetails =
  | ZodFormattedError
  | string
  | Record<string, unknown>

/**
 * Type for validation error response
 */
export interface ValidationError {
  status: number
  error: string
  details?: ValidationErrorDetails
}

/**
 * Validates request body against a Zod schema
 * @param request The request objec
 * @param schema The Zod schema to validate agains
 * @returns A tuple of [data, error] where data is the validated data and error is the validation error
 */
export async function validateRequestBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<[z.infer<T> | null, ValidationError | null]> {
  try {
    // Parse request body as JSON
    const body = await request.json()

    // Validate against schema
    const result = schema.safeParse(body)

    if (!result?.success) {
      return [
        null,
        {
          status: 400,
          error: 'Invalid request parameters',
          details: result?.error.format(),
        },
      ]
    }

    return [result?.data, null]
  } catch (error) {
    return [
      null,
      {
        status: 400,
        error: 'Invalid JSON in request body',
        details: error instanceof Error ? error?.message : String(error),
      },
    ]
  }
}

/**
 * Validates query parameters against a Zod schema
 * @param url The URL object containing query parameters
 * @param schema The Zod schema to validate agains
 * @returns A tuple of [data, error] where data is the validated data and error is the validation error
 */
export function validateQueryParams<T extends z.ZodType>(
  url: URL,
  schema: T,
): [z.infer<T> | null, ValidationError | null] {
  try {
    // Create an object from URL search params
    const params: Record<string, string> = {}
    url.searchParams.forEach((value, key) => {
      params[key] = value
    })

    // Validate against schema
    const result = schema.safeParse(params)

    if (!result.success) {
      return [
        null,
        {
          status: 400,
          error: 'Invalid query parameters',
          details: result?.error.format(),
        },
      ]
    }

    return [result?.data, null]
  } catch (error) {
    return [
      null,
      {
        status: 400,
        error: 'Error parsing query parameters',
        details: error instanceof Error ? error?.message : String(error),
      },
    ]
  }
}

// Session ID validation schema
export const sessionIdSchema = z
  .string()
  .uuid()
  .or(z.string().regex(/^[\w-]{21}$/)) // For Supabase/Firebase style IDs

// Validate and sanitize session ID
export function validateSessionId(sessionId: unknown): string {
  const result = sessionIdSchema.safeParse(sessionId)
  if (!result.success) {
    throw new Error('Invalid session ID format')
  }
  return result.data
}

// API path validation to prevent path traversal
export function validateApiPath(path: string): string {
  // Remove any path traversal attempts
  const sanitizedPath = path
    .replace(/\.\./g, '')
    .replace(/\/+/g, '/')
    .replace(/^\/+|\/+$/g, '')

  // Only allow alphanumeric characters, hyphens, and forward slashes
  if (!/^[a-z0-9/-]+$/i.test(sanitizedPath)) {
    throw new Error('Invalid path format')
  }

  return sanitizedPath
}

// Combine both validations for API routes
export function validateApiRoute(path: string, sessionId: unknown): string {
  const validSessionId = validateSessionId(sessionId)
  const validPath = validateApiPath(path)
  return `${validPath}/${validSessionId}`
}
