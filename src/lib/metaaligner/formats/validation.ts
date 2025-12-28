/**
 * @module validation
 * @description This module provides format validation utilities using Zod schemas.
 */

import { z } from 'zod'

/**
 * Validates data against a Zod schema.
 *
 * @param schema - The Zod schema to validate against.
 * @param data - The data to validate.
 * @returns A promise that resolves to the validated data, or throws an error if validation fails.
 */
export async function validateData<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
): Promise<z.infer<T>> {
  try {
    return await schema.parseAsync(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Validation failed: ${error.errors.map((e) => e.message).join(', ')}`,
        { cause: error },
      )
    }
    throw error
  }
}
