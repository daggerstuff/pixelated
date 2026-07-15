import mongoQueryValidator from 'mongodb-query-validator'

import { mongoClient } from '../db/mongoClient'
import { createBuildSafeLogger } from '../logging/build-safe-logger'
const { validateQuery } = mongoQueryValidator as unknown as {
  validateQuery: (query: unknown) => boolean
}
import sanitize from 'mongo-sanitize'

const logger = createBuildSafeLogger('default')

const allowedProperties = ['userId', 'type']
const allowedCharacters = /^[a-zA-Z0-9_.@|-]+$/
const defaultLimit = 100
const maxLimit = 1000
const maxSkip = 10000
const allowedSortFields = ['timestamp', 'userId', 'type']
const allowedSortDirections: Array<1 | -1> = [-1, 1]

const validateInput = (input: string, property: string): void => {
  if (!allowedProperties.includes(property)) {
    throw new Error(`Invalid property: ${property}`)
  }
  if (!allowedCharacters.test(input)) {
    throw new Error(`Invalid input: ${input}`)
  }
}

const coerceLimit = (value: number): number => {
  const n = value
  if (!Number.isInteger(n) || n <= 0) {
    return defaultLimit
  }
  return Math.min(n, maxLimit)
}

const coerceSkip = (value: number): number => {
  const n = value
  if (!Number.isInteger(n) || n < 0) {
    return 0
  }
  return Math.min(n, maxSkip)
}

const validateSort = (sort: { [key: string]: 1 | -1 }): void => {
  const entries = Object.entries(sort)
  if (entries.length === 0) {
    throw new Error('Sort must not be empty')
  }
  for (const [field, direction] of entries) {
    if (!allowedSortFields.includes(field)) {
      throw new Error(`Invalid sort field: ${field}`)
    }
    if (!allowedSortDirections.includes(direction)) {
      throw new Error(`Invalid sort direction for field ${field}`)
    }
  }
}

/**
 * Security event types
 */
export enum SecurityEventType {
  AUTH_SUCCESS = 'auth_success',
  AUTH_FAILURE = 'auth_failure',
  KEY_ROTATION = 'key_rotation',
  ACCESS_DENIED = 'access_denied',
  DATA_ACCESS = 'data_access',
  ENCRYPTED_OPERATION = 'encrypted_operation',
  CONFIG_CHANGE = 'config_change',
  COMPLIANCE_CHECK = 'compliance_check',
  LOGIN = 'login',
  ACCOUNT_LINKED = 'account_linked',
  ACCOUNT_UNLINKED = 'account_unlinked',
  TOKEN_VALIDATED = 'token_validated',
  TOKEN_VALIDATION_FAILED = 'token_validation_failed',
  TOKEN_REFRESHED = 'token_refreshed',
  TOKEN_REVOKED = 'token_revoked',
  ROLE_ASSIGNED = 'role_assigned',
  ROLE_REMOVED = 'role_removed',
  MFA_ENROLLMENT_STARTED = 'mfa_enrollment_started',
  MFA_ENROLLMENT_COMPLETED = 'mfa_enrollment_completed',
  MFA_FACTOR_DELETED = 'mfa_factor_deleted',
  MFA_CHALLENGE_SENT = 'mfa_challenge_sent',
  MFA_VERIFICATION_COMPLETED = 'mfa_verification_completed',
  MFA_VERIFICATION_FAILED = 'mfa_verification_failed',
  MFA_PREFERRED_FACTOR_SET = 'mfa_preferred_factor_set',

  WEBAUTHN_REGISTRATION_STARTED = 'webauthn_registration_started',
  WEBAUTHN_REGISTRATION_COMPLETED = 'webauthn_registration_completed',
  WEBAUTHN_REGISTRATION_FAILED = 'webauthn_registration_failed',
  WEBAUTHN_AUTHENTICATION_STARTED = 'webauthn_authentication_started',
  WEBAUTHN_AUTHENTICATION_COMPLETED = 'webauthn_authentication_completed',
  WEBAUTHN_AUTHENTICATION_FAILED = 'webauthn_authentication_failed',
  WEBAUTHN_CREDENTIAL_DELETED = 'webauthn_credential_deleted',
  WEBAUTHN_CREDENTIAL_RENAMED = 'webauthn_credential_renamed',
  WEBAUTHN_RESPONSE_VALIDATED = 'webauthn_response_validated',
  WEBAUTHN_RESPONSE_VALIDATION_FAILED = 'webauthn_response_validation_failed',
  MFA_REQUIRED = 'mfa_required',
  CSRF_VIOLATION = 'csrf_violation',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  AUTHENTICATION_FAILED = 'authentication_failed',
  AUTHENTICATION_SUCCESS = 'authentication_success',
  AUTHORIZATION_FAILED = 'authorization_failed',
  RISK_ASSESSMENT = 'risk_assessment',
  CONFIGURATION_CHANGED = 'configuration_changed',
  IMPERSONATION_STARTED = 'impersonation_started',
  IMPERSONATION_ENDED = 'impersonation_ended',
  IMPERSONATION_DENIED = 'impersonation_denied',
  IMPERSONATION_ERROR = 'impersonation_error',
  IMPERSONATION_EXTENDED = 'impersonation_extended',

  SESSION_TERMINATED = 'session_terminated',
  SESSION_TERMINATION_ERROR = 'session_termination_error',

  USER_CREATED = 'user_created',
  USER_SOFT_DELETED = 'user_soft_deleted',
  USER_SOFT_DELETE_ERROR = 'user_soft_delete_error',
  USER_RESTORED = 'user_restored',
  USER_RESTORE_ERROR = 'user_restore_error',
  USER_PURGED = 'user_purged',
  USER_PURGE_ERROR = 'user_purge_error',
  USER_PURGE_NOTIFICATION_SENT = 'user_purge_notification_sent',
  DATA_RETENTION_POLICY_UPDATED = 'data_retention_policy_updated',
  USER_RETENTION_EXTENDED = 'user_retention_extended',
  USER_RETENTION_EXTENSION_ERROR = 'user_retention_extension_error',
  USER_BULK_IMPORT_SUCCESS = 'user_bulk_import_success',
  USER_BULK_IMPORT_ERROR = 'user_bulk_import_error',
  BULK_IMPORT_COMPLETED = 'bulk_import_completed',
  BULK_IMPORT_ERROR = 'bulk_import_error',
  BULK_EXPORT_COMPLETED = 'bulk_export_completed',
  BULK_EXPORT_ERROR = 'bulk_export_error',
  BULK_IMPORT_JOB_STATUS_CHECK = 'bulk_import_job_status_check',
  BULK_IMPORT_JOB_STATUS_ERROR = 'bulk_import_job_status_error',
  RECURRING_EXPORT_SCHEDULED = 'recurring_export_scheduled',
  RECURRING_EXPORT_SCHEDULE_ERROR = 'recurring_export_schedule_error',
}

/**
 * Security event severity levels
 */
export enum SecurityEventSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Security event interface
 */
export interface SecurityEvent {
  type: SecurityEventType
  userId?: string
  ip?: string
  userAgent?: string
  severity: SecurityEventSeverity
  metadata: Record<string, unknown>
  timestamp: Date
}

/**
 * Security monitoring configuration
 */
export interface SecurityMonitoringConfig {
  maxFailedLoginAttempts: number
  failedLoginWindow: number
  accountLockoutDuration: number
  apiAbuseThreshold: number
  enableAlerts: boolean
  debugMode?: boolean
}

/**
 * Custom error types
 */
export class SecurityMonitoringError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SecurityMonitoringError'
  }
}

export class DatabaseError extends SecurityMonitoringError {
  constructor(message: string) {
    super(message)
    this.name = 'DatabaseError'
  }
}

/**
 * Default security monitoring configuration
 */
const defaultConfig: SecurityMonitoringConfig = {
  maxFailedLoginAttempts: 5,
  failedLoginWindow: 300,
  accountLockoutDuration: 1800,
  apiAbuseThreshold: 100,
  enableAlerts: true,
  debugMode: false,
}

/**
 * Security monitoring service
 */
export class SecurityMonitoringService {
  private readonly config: SecurityMonitoringConfig
  private readonly failedLogins: Map<
    string,
    { count: number; firstAttempt: Date }
  > = new Map<string, { count: number; firstAttempt: Date }>()

  private readonly lockedAccounts: Map<string, Date> = new Map<string, Date>()
  private readonly cleanupInterval: NodeJS.Timeout

  constructor(config: Partial<SecurityMonitoringConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
    this.cleanupInterval = setInterval(() => this.cleanupStaleRecords(), 60000)
  }

  /**
   * Clean up service resources
   */
  public destroy() {
    clearInterval(this.cleanupInterval)
  }

  /**
   * Track a security event by writing it to the security_events collection.
   */
  public async trackSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      const db = mongoClient.db
      const doc = {
        userId: event.userId ? sanitize(event.userId) : undefined,
        type: sanitize(event.type),
        severity: event.severity ?? SecurityEventSeverity.MEDIUM,
        metadata: event.metadata ?? {},
        timestamp: event.timestamp ?? new Date(),
      }
      await db.collection('security_events').insertOne(doc)
    } catch (error: unknown) {
      logger.error('Failed to track security event', {
        error: error instanceof Error ? error.message : String(error),
      })
      // Non-fatal: security event logging must not break the caller
    }
  }

  /**
   * Get security events for a user with bounded, validated pagination.
   */
  public async getUserSecurityEvents(
    userId: string,
    limit: number = defaultLimit,
    skip: number = 0,
    sort: { [key: string]: 1 | -1 } = { timestamp: -1 },
  ): Promise<SecurityEvent[]> {
    validateInput(userId, 'userId')
    const safeLimit = coerceLimit(limit)
    const safeSkip = coerceSkip(skip)
    validateSort(sort)
    try {
      const db = mongoClient.db
      const sanitizedUserId = sanitize(userId)
      const query = { userId: sanitizedUserId }
      validateQuery(query)
      const events = await db
        .collection<SecurityEvent>('security_events')
        .find(query)
        .sort(sort)
        .skip(safeSkip)
        .limit(safeLimit)
        .toArray()
      return events
    } catch (error) {
      logger.error('Failed to get user security events', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      })
      throw error
    }
  }

  /**
   * Get security events by type with bounded, validated pagination.
   */
  public async getSecurityEventsByType(
    type: SecurityEventType,
    limit: number = defaultLimit,
    skip: number = 0,
    sort: { [key: string]: 1 | -1 } = { timestamp: -1 },
  ): Promise<SecurityEvent[]> {
    validateInput(type, 'type')
    const safeLimit = coerceLimit(limit)
    const safeSkip = coerceSkip(skip)
    validateSort(sort)
    try {
      const db = mongoClient.db
      const sanitizedType = sanitize(type)
      const query = { type: sanitizedType }
      validateQuery(query)
      const events = await db
        .collection<SecurityEvent>('security_events')
        .find(query)
        .sort(sort)
        .skip(safeSkip)
        .limit(safeLimit)
        .toArray()
      return events
    } catch (error) {
      logger.error('Failed to get security events by type', {
        error: error instanceof Error ? error.message : String(error),
        type,
      })
      throw error
    }
  }

  /**
   * Check if an account is locked
   */
  public isAccountLocked(userId: string): boolean {
    const lockTime = this.lockedAccounts.get(userId)
    if (!lockTime) {
      return false
    }

    const now = new Date()
    const elapsedSeconds = (now.getTime() - lockTime.getTime()) / 1000

    if (elapsedSeconds >= this.config.accountLockoutDuration) {
      this.lockedAccounts.delete(userId)
      return false
    }

    return true
  }

  /**
   * Clean up stale records
   */
  private cleanupStaleRecords() {
    const now = new Date()
    const staleLoginThreshold = new Date(
      now.getTime() - this.config.failedLoginWindow,
    )

    const failedLoginEntries = Array.from(this.failedLogins.entries())
    for (const [key, record] of failedLoginEntries) {
      if (record.firstAttempt < staleLoginThreshold) {
        this.failedLogins.delete(key)
      }
    }

    const lockedAccountEntries = Array.from(this.lockedAccounts.entries())
    for (const [key, lockTime] of lockedAccountEntries) {
      const lockExpiry = new Date(
        lockTime.getTime() + this.config.accountLockoutDuration,
      )
      if (now > lockExpiry) {
        this.lockedAccounts.delete(key)
      }
    }
  }
}
