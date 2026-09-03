/**
 * Serialization helpers and FHEOperationError — extracted from homomorphic-ops.ts.
 */

import type { FHEOperation } from './types'

type SerializedSealObject = {
  save: () => string
  delete: () => void
}

type SerializedCiphertextInput = {
  serializedCiphertext: string
}

type OptionalNumericArray = number[] | null

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isSerializedCiphertextInput(
  value: unknown,
): value is SerializedCiphertextInput {
  return (
    isRecord(value) &&
    typeof value['serializedCiphertext'] === 'string' &&
    value['serializedCiphertext'].length > 0
  )
}

export function parseSerializedCiphertextInput(
  encryptedData: string,
): SerializedCiphertextInput {
  try {
    const parsed: unknown = JSON.parse(encryptedData)
    return isSerializedCiphertextInput(parsed)
      ? parsed
      : { serializedCiphertext: encryptedData }
  } catch {
    return { serializedCiphertext: encryptedData }
  }
}

function isSerializedSealObject(value: unknown): value is SerializedSealObject {
  return (
    isRecord(value) &&
    typeof value['save'] === 'function' &&
    typeof value['delete'] === 'function'
  )
}

export function resolveSerializedResult(result: unknown): string {
  if (!isSerializedSealObject(result)) {
    throw new Error('SEAL result object does not expose save/delete')
  }
  const serialized = result.save()
  result.delete()
  return serialized
}

export function normalizeOptionalRecordToStringArray(
  value: unknown,
): Record<string, string[]> {
  if (!isRecord(value)) {
    return {}
  }

  const normalized: Record<string, string[]> = {}
  for (const [key, rawValues] of Object.entries(value)) {
    if (
      Array.isArray(rawValues) &&
      rawValues.every((token): token is string => typeof token === 'string')
    ) {
      normalized[key] = rawValues
    }
  }
  return normalized
}

export function getNumericArray(
  value: unknown,
  fallback: OptionalNumericArray = null,
): number[] {
  if (Array.isArray(value) && value.every((item) => typeof item === 'number')) {
    return value
  }
  if (fallback === null) {
    return []
  }
  return fallback
}

export function getNumericValue(value: unknown, fallback: number): number {
  return typeof value === 'number' ? value : fallback
}

export function getStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  return value.every((token): token is string => typeof token === 'string')
    ? value
    : undefined
}

export function formatOperationError(error: string | undefined): string {
  return error ?? 'Unknown error'
}

/**
 * Custom error class for homomorphic operation errors
 * Extends the base Error class for FHE-specific error handling
 */
export class FHEOperationError extends Error {
  public readonly operation: FHEOperation | string
  public readonly code: string

  constructor(
    message: string,
    operation: FHEOperation | string,
    code = 'OPERATION_ERROR',
  ) {
    super(message)
    this.name = 'FHEOperationError'
    this.operation = operation
    this.code = code
  }
}

/**
 * Basic sentiment words for demonstration
 */
export const SENTIMENT_WORDS = {
  positive: [
    'good',
    'great',
    'excellent',
    'wonderful',
    'amazing',
    'happy',
    'joy',
    'loved',
    'best',
    'better',
  ],
  negative: [
    'bad',
    'terrible',
    'awful',
    'horrible',
    'sad',
    'angry',
    'hate',
    'worst',
    'poor',
    'disappointing',
  ],
  neutral: [
    'maybe',
    'possibly',
    'perhaps',
    'okay',
    'fine',
    'average',
    'neutral',
    'unclear',
  ],
}
