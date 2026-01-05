/**
 * Request body validation utilities
 */

import type { Request } from 'astro'
import { z } from 'zod'

/**
 * Validation error details returned by validateRequestBody
 */
export interface ValidationErrorDetails {
  details: Record<string, string>
}

/**
 * Validates a request body against a Zod schema
 * Returns a tuple: [validatedData, validationError]
 * - If validation succeeds: [validatedData, null]
 * - If validation fails: [null, ValidationErrorDetails]
 */
export async function validateRequestBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<[z.infer<T> | null, ValidationErrorDetails | null]> {
  try {
    // Parse JSON from request body
    const body = await request.json()

    // Validate against schema
    const validatedData = await schema.parseAsync(body)

    return [validatedData, null]
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Convert Zod errors to field error map
      const fieldErrors: Record<string, string> = {}
      error.errors.forEach((err) => {
        const path = err.path.join('.')
        fieldErrors[path] = err.message
      })

      return [
        null,
        {
          details: fieldErrors,
        },
      ]
    }

    // For non-Zod errors (e.g., JSON parse errors), return generic error
    return [
      null,
      {
        details: {
          body: error instanceof Error ? error.message : 'Invalid request body',
        },
      },
    ]
  }
}

