/**
 * API request validation utilities
 */

import { z } from 'zod'
import { normalizeError, ValidationError, createErrorContext } from '@/lib/error'

/**
 * Validate API request body with Zod schema
 */
export async function validateApiRequest<T extends z.ZodType>(
  schema: T,
  data: unknown,
  context?: { endpoint?: string; method?: string },
): Promise<z.infer<T>> {
  try {
    return await schema.parseAsync(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors: Record<string, string> = {}
      error.errors.forEach((err) => {
        const path = err.path.join('.')
        fieldErrors[path] = err.message
      })

      throw new ValidationError(
        'Request validation failed',
        fieldErrors,
        createErrorContext({
          action: context?.endpoint
            ? `${context.method ?? 'REQUEST'} ${context.endpoint}`
            : 'api_request',
          metadata: {
            endpoint: context?.endpoint,
            method: context?.method,
          },
        }),
      )
    }

    throw normalizeError(error, createErrorContext({ action: 'api_validation' }))
  }
}

/**
 * Validate API response with Zod schema
 */
export async function validateApiResponse<T extends z.ZodType>(
  schema: T,
  data: unknown,
  context?: { endpoint?: string },
): Promise<z.infer<T>> {
  try {
    return await schema.parseAsync(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors: Record<string, string> = {}
      error.errors.forEach((err) => {
        const path = err.path.join('.')
        fieldErrors[path] = err.message
      })

      throw new ValidationError(
        'Response validation failed',
        fieldErrors,
        createErrorContext({
          action: context?.endpoint
            ? `RESPONSE ${context.endpoint}`
            : 'api_response',
          metadata: {
            endpoint: context?.endpoint,
          },
        }),
      )
    }

    throw normalizeError(error, createErrorContext({ action: 'api_response_validation' }))
  }
}

/**
 * Validate query parameters
 */
export function validateQueryParams<T extends z.ZodType>(
  schema: T,
  params: Record<string, string | string[] | undefined>,
): z.infer<T> {
  try {
    // Convert URLSearchParams-like object to plain object
    const normalized: Record<string, unknown> = {}
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        // Handle array values
        normalized[key] = Array.isArray(value) && value.length === 1
          ? value[0]
          : value
      }
    })

    return schema.parse(normalized)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors: Record<string, string> = {}
      error.errors.forEach((err) => {
        const path = err.path.join('.')
        fieldErrors[path] = err.message
      })

      throw new ValidationError(
        'Query parameter validation failed',
        fieldErrors,
        createErrorContext({
          action: 'query_validation',
        }),
      )
    }

    throw normalizeError(error, createErrorContext({ action: 'query_validation' }))
  }
}

