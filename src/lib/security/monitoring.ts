import type { Database } from '../../types/supabase'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

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
  public destroy(): void {
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

      // Store the security event in the Supabase database
      const { supabase } = await import('../supabase')

      const { error } = await supabase.from('security_events').insert({
        type: event.type,
        severity: event.severity,
        user_id: event.userId || null,
        ip_address: event.ip || null,
        user_agent: event.userAgent || null,
        metadata: event.metadata,
        created_at: event.timestamp.toISOString(),
      })

      if (error) {
        logger.error('Failed to store security event in database', {
          error: error.message,
          details: error.details,
          hint: error.hint,
        })

        // If this fails, store in Redis as a fallback
        await this.storeEventInRedis(event)
      }

      return Promise.resolve()
    } catch (error) {
      logger.error('Failed to track security event', {
        error: error instanceof Error ? error.message : String(error),
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
      const eventKey = `security:event:${Date.now()}:${Math.random().toString(36).substring(2, 15)}`

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
   * Lock an account
   */
  private async lockAccount(
    userId: string,
    event: SecurityEvent,
  ): Promise<void> {
    const now = new Date()
    this.lockedAccounts.set(userId, now)

    try {
      // Create account lockout event
      await this.trackSecurityEvent({
        type: SecurityEventType.ACCESS_DENIED,
        userId,
        ip: event.ip,
        userAgent: event.userAgent,
        metadata: {
          failedAttempts: this.failedLogins.get(userId)?.count,
          lockoutDuration: this.config.accountLockoutDuration,
        },
        severity: SecurityEventSeverity.HIGH,
        timestamp: now,
      })

      // Reset failed login counter
      this.failedLogins.delete(userId)

      // Log account lockout
      logger.warn(`Account locked: ${userId}`, {
        userId,
        duration: this.config.accountLockoutDuration,
        until: new Date(
          now.getTime() + this.config.accountLockoutDuration * 1000,
        ),
      })
    } catch (error) {
      throw new DatabaseError(
        `Failed to update user lock status: ${error instanceof Error ? error.message : String(error)}`,
      )
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
  public async getUserSecurityEvents(
    userId: string,
    limit = 100,
  ): Promise<SecurityEvent[]> {
    const { supabase } = await import('../supabase')

    try {
      const { data, error } = await supabase
        .from('security_events')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        throw error
      }

      return (data || []).map(
        (row: Database['public']['Tables']['security_events']['Row']) => ({
          type: row.type as SecurityEventType,
          userId: row.user_id || undefined,
          ip: row.ip_address || undefined,
          userAgent: row.user_agent || undefined,
          metadata: row.metadata,
          severity: row.severity as SecurityEventSeverity,
          timestamp: new Date(row.created_at),
        }),
      )
    } catch (error) {
      throw new DatabaseError(
        `Failed to get user security events: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * Get security events by type
   */
  public async getSecurityEventsByType(
    type: SecurityEventType,
    limit = 100,
  ): Promise<SecurityEvent[]> {
    const { supabase } = await import('../supabase')

    try {
      const { data, error } = await supabase
        .from('security_events')
        .select('*')
        .eq('type', type)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        throw error
      }

      return (data || []).map(
        (row: Database['public']['Tables']['security_events']['Row']) => ({
          type: row.type as SecurityEventType,
          userId: row.user_id || undefined,
          ip: row.ip_address || undefined,
          userAgent: row.user_agent || undefined,
          metadata: row.metadata,
          severity: row.severity as SecurityEventSeverity,
          timestamp: new Date(row.created_at),
        }),
      )
    } catch (error) {
      throw new DatabaseError(
        `Failed to get security events by type: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * Clean up stale records
   */
  private cleanupStaleRecords(): void {
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
