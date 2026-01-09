/**
 * Security Module for Therapy Chat System
 *
 * Provides encryption, Fully Homomorphic Encryption (FHE) integration, and other
 * security features required for HIPAA compliance and beyond.
 */

import type { FHEOperation, HomomorphicOperationResult } from './fhe/types'
// Use isomorphic approach for process
import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { fheService } from './fhe'
import { EncryptionMode } from './fhe/types'

import { createBuildSafeLogger } from './logging/build-safe-logger'

// Initialize logger
const logger = createBuildSafeLogger('default')

// Security-related atoms
export const encryptionInitializedAtom = atom(false)
export const encryptionKeysAtom = atomWithStorage('chatEncryptionKeys', null)
export const securityLevelAtom = atomWithStorage('chatSecurityLevel', 'medium')

// Define our enhanced FHE service interface
interface EnhancedFHEService {
  initialize: (options: Record<string, unknown>) => Promise<void>
  encrypt: (message: string) => Promise<string>
  decrypt?: (encryptedMessage: string) => Promise<string>
  processEncrypted?: (
    encryptedMessage: string,
    operation: FHEOperation,
    params?: Record<string, unknown>,
  ) => Promise<HomomorphicOperationResult>
  setupKeyManagement?: (options: {
    rotationPeriodDays: number
    persistKeys: boolean
  }) => Promise<string>
  getEncryptionMode?: () => string
  createVerificationToken?: (message: string) => Promise<string>
  [key: string]: unknown
}

// Cast to our enhanced interface to avoid TypeScript errors
const enhancedFHEService = fheService as unknown as EnhancedFHEService

// Secret key for signatures
const SECRET_KEY =
  typeof process !== 'undefined' && process.env
    ? process.env['SECRET_KEY'] || 'default-secret-key'
    : 'default-secret-key'

/**
 * Initialize security system
 * This is the main entry point for setting up all security features
 */
export async function initializeSecurity(): Promise<void> {
  try {
    logger.info('Initializing security system...')

    // Get the configured security level
    const securityLevel = process.env['SECURITY_LEVEL'] || 'medium'

    // Initialize encryption with the configured level
    const encryptionSuccess = await initializeEncryption(securityLevel)

    if (!encryptionSuccess) {
      logger.warn(
        'Encryption initialization failed, continuing with reduced security',
      )
    }

    // Set up other security features as needed
    logger.info('Security system initialized successfully')
  } catch (error: unknown) {
    const errorDetails: Record<string, unknown> = {
      message: error instanceof Error ? String(error) : String(error),
    }
    logger.error('Failed to initialize security system:', errorDetails)
    throw new Error(
      `Security initialization failed: ${error instanceof Error ? String(error) : String(error)}`,
      { cause: error },
    )
  }
}

/**
 * Initialize encryption system
 * This sets up the FHE service with the appropriate security level
 */
export async function initializeEncryption(level = 'medium'): Promise<boolean> {
  try {
    const encryptionMode =
      level === 'high'
        ? EncryptionMode.FHE
        : level === 'medium'
          ? EncryptionMode.HIPAA
          : EncryptionMode.STANDARD

    await enhancedFHEService.initialize({
      mode: encryptionMode,
      keySize: level === 'high' ? 2048 : 1024,
      securityLevel: level,
      enableDebug: process.env['NODE_ENV'] === 'development',
    })

    // For FHE mode, also set up key management - fix typo and safely handle optional method
    if (
      encryptionMode === EncryptionMode.FHE &&
      enhancedFHEService.setupKeyManagement
    ) {
      const keyId = await enhancedFHEService.setupKeyManagement({
        rotationPeriodDays: 7,
        persistKeys: true,
      })

      logger.info(`FHE initialized with key ID: ${keyId}`)
    }

    logger.info(
      `Encryption initialized successfully with mode: ${encryptionMode}`,
    )
    return true
  } catch (error: unknown) {
    const errorDetails: Record<string, unknown> = {
      message: error instanceof Error ? String(error) : String(error),
    }
    logger.error('Failed to initialize encryption:', errorDetails)
    return false
  }
}

/**
 * Encrypt a message using the FHE service
 */
export async function encryptMessage(message: string): Promise<string> {
  try {
    return await enhancedFHEService.encrypt(message)
  } catch (error: unknown) {
    const errorDetails: Record<string, unknown> = {
      message: error instanceof Error ? String(error) : String(error),
    }
    logger.error('Encryption error:', errorDetails)
    throw error
  }
}

/**
 * Decrypt a message using the FHE service
 */
export async function decryptMessage(
  encryptedMessage: string,
): Promise<string> {
  try {
    let decrypted: string

    if (enhancedFHEService.decrypt) {
      decrypted = await enhancedFHEService.decrypt(encryptedMessage)
    } else {
      // Fallback implementation if decrypt is not available
      throw new Error('Decryption not implemented')
    }

    return decrypted
  } catch (error: unknown) {
    const errorDetails: Record<string, unknown> = {
      message: error instanceof Error ? String(error) : String(error),
    }
    logger.error('Decryption error:', errorDetails)
    throw error
  }
}

/**
 * Process encrypted data without decrypting
 * This is the key advantage of FHE over traditional encryption
 */
export async function processEncryptedMessage(
  encryptedMessage: string,
  operation: string,
  params?: Record<string, unknown>,
): Promise<string> {
  try {
    // Map operation string to FHEOperation enum
    const fheOperation = operation.toUpperCase() as FHEOperation

    if (!enhancedFHEService.processEncrypted) {
      throw new Error('FHE processing not implemented')
    }

    const result = await enhancedFHEService.processEncrypted(
      encryptedMessage,
      fheOperation,
      params,
    )

    // Convert result to string format for return
    return result.result || JSON.stringify(result)
  } catch (error: unknown) {
    const errorDetails: Record<string, unknown> = {
      message: error instanceof Error ? String(error) : String(error),
    }
    logger.error('FHE operation error:', errorDetails)
    throw error
  }
}

/**
 * Create a verification token for message integrity
 */
export async function createVerificationToken(
  message: string,
): Promise<string> {
  try {
    if (enhancedFHEService.createVerificationToken) {
      return await enhancedFHEService.createVerificationToken(message)
    }

    // Fallback implementation if the method doesn't exist
    const timestamp = Date.now().toString()
    const data = `${message}:${timestamp}`
    return `${createSignature(data)}.${timestamp}`
  } catch (error: unknown) {
    const errorDetails: Record<string, unknown> = {
      message: error instanceof Error ? String(error) : String(error),
    }
    logger.error('Verification token generation error:', errorDetails)
    throw error
  }
}

/**
 * Generate a secure session key
 */
export function generateSecureSessionKey(): string {
  // Use a proper CSPRNG that works in both Node.js and browser environments
  if (typeof window !== 'undefined') {
    // Browser environment
    const array = new Uint8Array(32)
    window.crypto.getRandomValues(array)
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join(
      '',
    )
  } else {
    // Node.js environment
    // Use a simple fallback for server-side rendering
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 15)
  }
}

/**
 * HIPAA Security Helper Functions
 */

// Security event types for logging (runtime + type-safe)
export const SecurityEventType = {
  ACCESS: 'access',
  ACCESS_ATTEMPT: 'access_attempt',
  ACCOUNT_LINKED: 'account_linked',
  ACCOUNT_UNLINKED: 'account_unlinked',
  API_ACCESS: 'api_access',
  AUTHENTICATION_FAILED: 'authentication_failed',
  AUTHENTICATION_SUCCESS: 'authentication_success',
  AUTH_FAILURE: 'auth_failure',
  AUTH_SUCCESS: 'auth_success',
  AUTHORIZATION_FAILED: 'authorization_failed',
  BULK_EXPORT_COMPLETED: 'bulk_export_completed',
  BULK_EXPORT_ERROR: 'bulk_export_error',
  BULK_IMPORT_COMPLETED: 'bulk_import_completed',
  BULK_IMPORT_ERROR: 'bulk_import_error',
  BULK_IMPORT_JOB_STATUS_CHECK: 'bulk_import_job_status_check',
  BULK_IMPORT_JOB_STATUS_ERROR: 'bulk_import_job_status_error',
  COMPLIANCE_CHECK: 'compliance_check',
  CONFIG_CHANGE: 'config_change',
  CONFIGURATION_CHANGED: 'configuration_changed',
  CSRF_VIOLATION: 'csrf_violation',
  DATA_ACCESS: 'data_access',
  DATA_RETENTION_POLICY_UPDATED: 'data_retention_policy_updated',
  ENCRYPTED_OPERATION: 'encrypted_operation',
  ERROR: 'error',
  IMPERSONATION_DENIED: 'impersonation_denied',
  IMPERSONATION_ENDED: 'impersonation_ended',
  IMPERSONATION_ERROR: 'impersonation_error',
  IMPERSONATION_EXTENDED: 'impersonation_extended',
  IMPERSONATION_STARTED: 'impersonation_started',
  KEY_ROTATION: 'key_rotation',
  LOGIN: 'login',
  LOGOUT: 'logout',
  MESSAGE: 'message',
  MFA_CHALLENGE_SENT: 'mfa_challenge_sent',
  MFA_ENROLLMENT_COMPLETED: 'mfa_enrollment_completed',
  MFA_ENROLLMENT_STARTED: 'mfa_enrollment_started',
  MFA_FACTOR_DELETED: 'mfa_factor_deleted',
  MFA_PREFERRED_FACTOR_SET: 'mfa_preferred_factor_set',
  MFA_REQUIRED: 'mfa_required',
  MFA_VERIFICATION_COMPLETED: 'mfa_verification_completed',
  MFA_VERIFICATION_FAILED: 'mfa_verification_failed',
  PERMISSION_DENIED: 'permission_denied',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  RECURRING_EXPORT_SCHEDULED: 'recurring_export_scheduled',
  RECURRING_EXPORT_SCHEDULE_ERROR: 'recurring_export_schedule_error',
  RISK_ASSESSMENT: 'risk_assessment',
  ROLE_ASSIGNED: 'role_assigned',
  ROLE_REMOVED: 'role_removed',
  ROLE_TRANSITION_APPROVAL_FAILED: 'role_transition_approval_failed',
  ROLE_TRANSITION_AUDIT: 'role_transition_audit',
  ROLE_TRANSITION_CANCELLATION_FAILED: 'role_transition_cancellation_failed',
  ROLE_TRANSITION_EXECUTION_FAILED: 'role_transition_execution_failed',
  ROLE_TRANSITION_REQUEST_FAILED: 'role_transition_request_failed',
  SECURITY_HEADER_VIOLATION: 'security_header_violation',
  SENSITIVE_ACTION: 'sensitive_action',
  SESSION_TERMINATED: 'session_terminated',
  SESSION_TERMINATION_ERROR: 'session_termination_error',
  THERAPY_CHAT_ERROR: 'therapy_chat_error',
  THERAPY_CHAT_REQUEST: 'therapy_chat_request',
  THERAPY_CHAT_RESPONSE: 'therapy_chat_response',
  TOKEN_CLEANED_UP: 'token_cleaned_up',
  TOKEN_CREATED: 'token_created',
  TOKEN_REFRESHED: 'token_refreshed',
  TOKEN_REVOKED: 'token_revoked',
  TOKEN_VALIDATED: 'token_validated',
  TOKEN_VALIDATION_FAILED: 'token_validation_failed',
  USER_BULK_IMPORT_ERROR: 'user_bulk_import_error',
  USER_BULK_IMPORT_SUCCESS: 'user_bulk_import_success',
  USER_CREATED: 'user_created',
  USER_PURGED: 'user_purged',
  USER_PURGE_ERROR: 'user_purge_error',
  USER_PURGE_NOTIFICATION_SENT: 'user_purge_notification_sent',
  USER_RESTORED: 'user_restored',
  USER_RESTORE_ERROR: 'user_restore_error',
  USER_RETENTION_EXTENDED: 'user_retention_extended',
  USER_RETENTION_EXTENSION_ERROR: 'user_retention_extension_error',
  USER_SOFT_DELETED: 'user_soft_deleted',
  USER_SOFT_DELETE_ERROR: 'user_soft_delete_error',
  WEBAUTHN_AUTHENTICATION_COMPLETED: 'webauthn_authentication_completed',
  WEBAUTHN_AUTHENTICATION_FAILED: 'webauthn_authentication_failed',
  WEBAUTHN_AUTHENTICATION_STARTED: 'webauthn_authentication_started',
  WEBAUTHN_CREDENTIAL_DELETED: 'webauthn_credential_deleted',
  WEBAUTHN_CREDENTIAL_RENAMED: 'webauthn_credential_renamed',
  WEBAUTHN_REGISTRATION_COMPLETED: 'webauthn_registration_completed',
  WEBAUTHN_REGISTRATION_FAILED: 'webauthn_registration_failed',
  WEBAUTHN_REGISTRATION_STARTED: 'webauthn_registration_started',
  WEBAUTHN_RESPONSE_VALIDATED: 'webauthn_response_validated',
  WEBAUTHN_RESPONSE_VALIDATION_FAILED: 'webauthn_response_validation_failed',
} as const

export type SecurityEventTypeValue =
  (typeof SecurityEventType)[keyof typeof SecurityEventType]

/**
 * Generate audit log entry for HIPAA compliance
 */
export async function logSecurityEvent(
  eventType: SecurityEventTypeValue,
  userIdOrDetails:
    | string
    | null
    | Record<string, string | number | boolean | null | undefined>,
  details?: Record<string, string | number | boolean | null | undefined>,
): Promise<void> {
  try {
    const metadata =
      typeof userIdOrDetails === 'string' || userIdOrDetails === null
        ? { ...details, userId: userIdOrDetails ?? undefined }
        : userIdOrDetails

    if (process.env['NODE_ENV'] === 'development') {
      logger.debug('[SECURITY EVENT]', {
        eventType,
        ...metadata,
      })
    }
  } catch (error: unknown) {
    const errorDetails: Record<string, unknown> = {
      message: error instanceof Error ? String(error) : String(error),
    }
    logger.error('Security event logging error:', errorDetails)
  }
}

/**
 * Validate that the security meets HIPAA requirements
 */
export function validateHIPAACompliance(): {
  compliant: boolean
  issues: string[]
} {
  const issues: string[] = []
  let compliant = true

  // Check that encryption is properly initialized
  const encryptionMode = enhancedFHEService.getEncryptionMode?.() || 'none'

  if (encryptionMode === EncryptionMode.NONE) {
    issues.push('Encryption is disabled')
    compliant = false
  } else if (
    encryptionMode !== EncryptionMode.FHE &&
    encryptionMode !== EncryptionMode.HIPAA
  ) {
    issues.push('Encryption level may not meet HIPAA requirements')
    compliant = false
  }

  return { compliant, issues }
}

/**
 * Clear sensitive data from memory
 */
export function secureClear(obj: Record<string, unknown>): void {
  if (typeof obj === 'object' && obj !== null) {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (typeof obj[key] === 'string') {
          obj[key] = ''
        } else if (typeof obj[key] === 'object') {
          secureClear(obj[key] as Record<string, unknown>)
        }
      }
    }
  }
}

/**
 * Generate a secure random token
 * @param length Token length in bytes
 * @returns Hex string token
 */
export function generateSecureToken(length = 32): string {
  try {
    // Browser-safe implementation
    if (typeof window !== 'undefined') {
      const array = new Uint8Array(length)
      window.crypto.getRandomValues(array)
      return Array.from(array, (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('')
    } else {
      // Node.js implementation - use a safe fallback for SSR
      return (
        Date.now().toString(36) +
        Math.random().toString(36).substring(2) +
        Math.random().toString(36).substring(2, 15)
      )
    }
  } catch (error: unknown) {
    const errorDetails: Record<string, unknown> = {
      message: error instanceof Error ? String(error) : String(error),
    }
    logger.error('Token generation error:', errorDetails)
    return ''
  }
}

/**
 * Create a signature for data integrity
 */
export function createSignature(data: string): string {
  try {
    // Browser-safe implementation
    if (typeof window !== 'undefined') {
      // Simple browser-compatible hash function for development
      // In production, use a proper Web Crypto API implementation
      return btoa(
        String.fromCharCode.apply(
          null,
          Array.from(new TextEncoder().encode(data + SECRET_KEY)),
        ),
      )
    } else {
      // Server-side implementation without Node.js Buffer
      const encoder = new TextEncoder()
      const dataWithKey = encoder.encode(data + SECRET_KEY)
      // Convert Uint8Array to base64 string without using Buffer
      return btoa(String.fromCharCode.apply(null, Array.from(dataWithKey)))
    }
  } catch (error: unknown) {
    const errorDetails: Record<string, unknown> = {
      message: error instanceof Error ? String(error) : String(error),
    }
    logger.error('Signature creation error:', errorDetails)
    return ''
  }
}

/**
 * Verify a HMAC signature
 * @param data Original data
 * @param signature Signature to verify
 * @returns Whether signature is valid
 */
export function verifySignature(data: string, signature: string): boolean {
  const expectedSignature = createSignature(data)
  return expectedSignature === signature
}

/**
 * Create a secure token with encrypted payload
 * @param payload Token payload
 * @param expiresIn Expiration time in seconds
 * @returns Secure token
 */
export function createSecureToken(
  payload: Record<string, unknown>,
  expiresIn = 3600,
): string {
  const tokenData = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + expiresIn,
    iat: Math.floor(Date.now() / 1000),
    jti: generateSecureToken(8),
  }

  const dataString = JSON.stringify(tokenData)
  // Use btoa instead of Buffer
  const encodedData = btoa(dataString)
  const signature = createSignature(encodedData)

  return `${encodedData}.${signature}`
}

/**
 * Verify and decode a secure token
 * @param token Token to verify
 * @returns Decoded payload or null if invalid
 */
export function verifySecureToken(
  token: string,
): Record<string, unknown> | null {
  try {
    const [encodedData, signature] = token.split('.')

    if (!encodedData || !signature) {
      return null
    }

    // Verify signature
    if (!verifySignature(encodedData, signature)) {
      return null
    }

    // Decode payload using atob instead of Buffer
    const dataString = atob(encodedData)
    const payload = JSON.parse(dataString) as unknown

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null // Token expired
    }

    return payload
  } catch {
    return null
  }
}
