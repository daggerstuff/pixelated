/**
 * @module conversion
 * @description This module provides format conversion utilities.
 */

import { validateData } from './validation'
import {
  UnifiedProcessingRequestSchema,
  UnifiedProcessingResponseSchema,
} from './schemas'
import type {
  UnifiedProcessingRequest,
  UnifiedProcessingResponse,
} from '../api/unified-api'

/**
 * Converts data to the UnifiedProcessingRequest format.
 *
 * @param data - The data to convert.
 * @returns A promise that resolves to the converted data.
 */
export async function toUnifiedProcessingRequest(
  data: unknown,
): Promise<UnifiedProcessingRequest> {
  return validateData(UnifiedProcessingRequestSchema, data)
}

/**
 * Converts data to the UnifiedProcessingResponse format.
 *
 * @param data - The data to convert.
 * @returns A promise that resolves to the converted data.
 */
export async function toUnifiedProcessingResponse(
  data: unknown,
): Promise<UnifiedProcessingResponse> {
  return validateData(UnifiedProcessingResponseSchema, data)
}
