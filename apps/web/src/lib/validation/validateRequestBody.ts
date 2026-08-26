/**
 * Request body validation utilities
 */

import { z } from 'zod'

type AstroRequest = Request

export interface ValidationErrorDetails {
  details: Record<string, string>
  error?: string
  status?: number
}

export async function validateRequestBody<T extends z.ZodType>(
  request: AstroRequest,
  schema: T,
): Promise<[z.infer<T> | null, ValidationErrorDetails | null]> {
  try {
    // Parse JSON from request body
    const body = await request.json()

    // Validate against schema
    const validatedData = await schema.parseAsync(body)

    return [validatedData, null]
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      // Convert Zod errors to field error map
      const fieldErrors: Record<string, string> = {}
      error.issues.forEach((err) => {
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
          body:
            error instanceof Error
              ? error instanceof Error
                ? error.message
                : 'Unknown error'
              : 'Invalid request body',
        },
      },
    ]
  }
}
