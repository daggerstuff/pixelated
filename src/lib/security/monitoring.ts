import { createBuildSafeLogger } from '../logging/build-safe-logger'

const logger = createBuildSafeLogger('default')

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
  private config: SecurityMonitoringConfig
  private failedLogins: Map<string, { count: number; firstAttempt: Date }> =
    new Map<string, { count: number; firstAttempt: Date }>()

  private lockedAccounts: Map<string, Date> = new Map<string, Date>()
  private cleanupInterval: NodeJS.Timeout

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
   * Track a security even
   */
  public async trackSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      logger.info(`Security event: ${event.type} (${event.severity})`, {
        ...event.metadata,
        timestamp: event.timestamp,
      })

      // TODO: Implement MongoDB insert for security events
      // If this fails, store in Redis as a fallback
      await this.storeEventInRedis(event)
      return Promise.resolve()
    } catch (error: unknown) {
      logger.error('Failed to track security event', {
        error: error instanceof Error ? String(error) : String(error),
      })
      throw error
    }
  }

  /**
   * Fallback method to store security events in Redis if database storage fails
   */
  private async storeEventInRedis(event: SecurityEvent): Promise<void> {
    try {
      const { redis } = await import('../services/redis')

      // Create a unique key for the event
      const crypto = await import('crypto')
      const randomStr = crypto.randomBytes(12).toString('hex')
      const eventKey = `security:event:${Date.now()}:${randomStr}`

      // Store the event as JSON
      await redis.set(
        eventKey,
        JSON.stringify({
          type: event.type,
          severity: event.severity,
          userId: event.userId,
          ip: event.ip,
          userAgent: event.userAgent,
          metadata: event.metadata,
          timestamp: event.timestamp.toISOString(),
        }),
        // Keep for 7 days
        7 * 24 * 60 * 60,
      )

      // Add to a list of events that need to be processed later
      // Use set method instead of sadd since it may not be available
      await redis.set(
        `security:pending_events:${eventKey}`,
        '1',
        7 * 24 * 60 * 60,
      )

      logger.info('Stored security event in Redis as fallback', { eventKey })
    } catch (fallbackError) {
      logger.error('Failed to store security event in Redis fallback', {
        error:
          fallbackError instanceof Error
            ? fallbackError.message
            : String(fallbackError),
      })
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

    // If lock duration has passed, unlock the account
    if (elapsedSeconds >= this.config.accountLockoutDuration) {
      this.lockedAccounts.delete(userId)
      return false
    }

    return true
  }

  /**
   * Get security events for a user
   */
  public async getUserSecurityEvents(): Promise<SecurityEvent[]> {
    // TODO: Implement MongoDB query for user security events
    return []
  }

  /**
   * Get security events by type
   */
  public async getSecurityEventsByType(): Promise<SecurityEvent[]> {
    // TODO: Implement MongoDB query for security events by type
    return []
  }

  /**
   * Clean up stale records
   */
  private cleanupStaleRecords() {
    const now = new Date()
    const staleLoginThreshold = new Date(
      now.getTime() - this.config.failedLoginWindow,
    )

    // Clean up failed login attempts
    const failedLoginEntries = Array.from(this.failedLogins.entries())
    for (const [key, record] of failedLoginEntries) {
      if (record.firstAttempt < staleLoginThreshold) {
        this.failedLogins.delete(key)
      }
    }

    // Clean up locked accounts
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
