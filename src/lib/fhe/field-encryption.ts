/**
 * Field-Level FHE Encryption Hooks
 *
 * Provides per-field encrypt/decrypt operations for PHI fields
 * using the FHE service. Designed to be wired into data-layer
 * middleware (pre-save encrypt, post-find decrypt).
 *
 * PIX-4198
 */

import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { encrypt, decrypt } from './encryption'
import type { EncryptedData } from './types'

const logger = createBuildSafeLogger('fhe:field-encryption')

/**
 * Fields classified as PHI (Protected Health Information)
 * that must be encrypted at rest using FHE.
 */
export const PHI_FIELDS = [
  'contact.email',
  'contact.phone',
  'contact.address',
  'emergencyContact.name',
  'emergencyContact.phone',
  'name',
  'diagnosis',
  'notes',
  'observations',
  'medicalRecordNumber',
] as const

export type PHIField = (typeof PHI_FIELDS)[number]

/**
 * Encrypted field wrapper stored in the data layer.
 * The ciphertext is JSON-serialized EncryptedData.
 */
export interface EncryptedField {
  fhe: true
  field: string
  payload: string
  encryptedAt: number
  originalType: 'string' | 'number' | 'boolean' | 'object' | 'array'
}

function isEncryptedField(value: unknown): value is EncryptedField {
  return (
    typeof value === 'object' &&
    value !== null &&
    'fhe' in value &&
    (value as EncryptedField).fhe
  )
}

/**
 * Encrypt a single PHI field value using FHE.
 * Returns the encrypted field wrapper suitable for storage.
 */
export async function encryptField(
  field: string,
  value: unknown,
): Promise<EncryptedField> {
  if (value === undefined || value === null || value === '') {
    return {
      fhe: true,
      field,
      payload: '',
      encryptedAt: Date.now(),
      originalType: 'string',
    }
  }

  const originalType = Array.isArray(value)
    ? 'array'
    : (typeof value as 'string' | 'number' | 'boolean' | 'object')
  const stringValue = typeof value === 'string' ? value : JSON.stringify(value)
  const encrypted = await encrypt(stringValue)
  const payload = JSON.stringify(encrypted)

  logger.debug(`Encrypted PHI field: ${field}`)

  return {
    fhe: true,
    field,
    payload,
    encryptedAt: Date.now(),
    originalType,
  }
}

/**
 * Decrypt a single encrypted PHI field back to its original value.
 * Returns the decrypted string, or the original value if not encrypted.
 */
export async function decryptField<T = string>(
  encryptedField: unknown,
): Promise<T | null> {
  if (!isEncryptedField(encryptedField)) {
    return null
  }

  if (!encryptedField.payload) {
    return null
  }

  try {
    const encryptedData: EncryptedData = JSON.parse(encryptedField.payload)
    const decrypted = await decrypt<string>(encryptedData)
    logger.debug(`Decrypted PHI field: ${encryptedField.field}`)

    if (
      encryptedField.originalType === 'object' ||
      encryptedField.originalType === 'array'
    ) {
      return JSON.parse(decrypted) as T
    }
    if (encryptedField.originalType === 'number') {
      return Number(decrypted) as T
    }
    if (encryptedField.originalType === 'boolean') {
      return (decrypted === 'true') as T
    }
    return decrypted as T
  } catch (error) {
    logger.error(`Failed to decrypt field ${encryptedField.field}`, { error })
    return null
  }
}

/**
 * Encrypt all PHI fields on a patient object before storage.
 * Mutates a shallow copy; original is untouched.
 */
export async function encryptPHIFields<T extends Record<string, unknown>>(
  record: T,
  fields: readonly string[] = PHI_FIELDS,
): Promise<T & { encryptedFields: string[] }> {
  const result = { ...record } as Record<string, unknown>
  const encryptedFields: string[] = []

  for (const fieldPath of fields) {
    const value = getNestedValue(result, fieldPath)
    if (value === undefined || value === null || value === '') continue

    const encrypted = await encryptField(fieldPath, value)
    setNestedValue(result, fieldPath, encrypted)
    encryptedFields.push(fieldPath)
  }

  return { ...result, encryptedFields } as T & { encryptedFields: string[] }
}

/**
 * Decrypt all encrypted PHI fields on a patient object after retrieval.
 * Returns a shallow copy with decrypted values restored.
 */
export async function decryptPHIFields<T extends Record<string, unknown>>(
  record: T,
): Promise<T> {
  const result = { ...record } as Record<string, unknown>
  const encryptedFields = (record as Record<string, unknown>)['encryptedFields']

  if (!Array.isArray(encryptedFields)) return result as T

  for (const fieldPath of encryptedFields) {
    const stored = getNestedValue(result, fieldPath)
    if (!isEncryptedField(stored)) continue

    const decrypted = await decryptField(stored)
    if (decrypted !== null) {
      setNestedValue(result, fieldPath, decrypted)
    }
  }

  return result as T
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const parts = path.split('.')
  let current: Record<string, unknown> = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (
      typeof current[parts[i]] !== 'object' ||
      current[parts[i]] === null
    ) {
      current[parts[i]] = {}
    }
    current = current[parts[i]] as Record<string, unknown>
  }
  current[parts[parts.length - 1]] = value
}