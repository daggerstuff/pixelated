/**
 * Security Event Logger
 * Comprehensive audit logging and security event tracking
 * HIPAA-compliant with structured logging and real-time monitoring
 */

import { logger } from '../logger'
import { randomUUID } from 'crypto'
import { getRedisClient } from '../redis'

export interface SecurityEvent {
  id: string
  eventType: SecurityEventType
  userId: string | null
  ipAddress: string
  userAgent: string
  endpoint: string
  method: string
  statusCode: number
  details: Record<string, unknown>
  riskScore: number
  encrypted: boolean
  timestamp: string
  sessionId?: string
  correlationId?: string
}

export interface SecurityMetrics {
  totalEvents: number
  highRiskEvents: number
  authenticationFailures: number
  authorizationFailures: number
  tokenRevocations: number
  rateLimitViolations: number
  suspiciousActivities: number
  averageRiskScore: number
}

export enum SecurityEventType {
  // Authentication events
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',
  LOGOUT = 'logout',
  TOKEN_CREATED = 'token_created',
  TOKEN_VALIDATED = 'token_validated',
  TOKEN_VALIDATION_FAILED = 'token_validation_failed',
  TOKEN_REFRESHED = 'token_refreshed',
  TOKEN_REVOKED = 'token_revoked',

  // Authorization events
  PERMISSION_GRANTED = 'permission_granted',
  PERMISSION_DENIED = 'permission_denied',
  ROLE_ASSIGNED = 'role_assigned',
  ROLE_REMOVED = 'role_removed',

  // Security incidents
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  ACCOUNT_LOCKED = 'account_locked',
  ACCOUNT_UNLOCKED = 'account_unlocked',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  SECURITY_BREACH = 'security_breach',

  // MFA events
  MFA_ENABLED = 'mfa_enabled',
  MFA_DISABLED = 'mfa_disabled',
  MFA_VERIFICATION_SUCCESS = 'mfa_verification_success',
  MFA_VERIFICATION_FAILED = 'mfa_verification_failed',

  // Password events
  PASSWORD_CHANGED = 'password_changed',
  PASSWORD_RESET_REQUESTED = 'password_reset_requested',
  PASSWORD_RESET_COMPLETED = 'password_reset_completed',

  // Session events
  SESSION_CREATED = 'session_created',
  SESSION_ENDED = 'session_ended',
  SESSION_EXPIRED = 'session_expired',
  SESSION_HIJACKING_DETECTED = 'session_hijacking_detected',

  // Configuration events
  SECURITY_SETTINGS_CHANGED = 'security_settings_changed',
  API_KEY_CREATED = 'api_key_created',
  API_KEY_REVOKED = 'api_key_revoked',

  // Compliance events
  HIPAA_VIOLATION_DETECTED = 'hipaa_violation_detected',
  COMPLIANCE_AUDIT_PASSED = 'compliance_audit_passed',
  COMPLIANCE_AUDIT_FAILED = 'compliance_audit_failed',

  // System events
  TOKEN_CLEANED_UP = 'token_cleaned_up',
  SECURITY_SCAN_COMPLETED = 'security_scan_completed',
  THREAT_NEUTRALIZED = 'threat_neutralized',
}

export interface SecurityEventLoggerConfig {
  enableRealTimeMonitoring: boolean
  enableHIPAACompliance: boolean
  enableEncryption: boolean
  retentionPeriod: number // days
  alertThreshold: number
  batchSize: number
  flushInterval: number // seconds
}

/**
 * Security Event Logger for comprehensive audit trail
 */
export class SecurityEventLogger {
  private redis: unknown
  private config: SecurityEventLoggerConfig
  private eventBuffer: SecurityEvent[]
  private flushTimer?: NodeJS.Timeout
  private metrics: SecurityMetrics

  constructor(config: Partial<SecurityEventLoggerConfig> = {}) {
    this.redis = getRedisClient()
    this.config = {
      enableRealTimeMonitoring: true,
      enableHIPAACompliance: true,
      enableEncryption: false,
      retentionPeriod: 2555, // 7 years for HIPAA compliance
      alertThreshold: 0.7,
      batchSize: 100,
      flushInterval: 60, // 1 minute
      ...config,
    }

    this.eventBuffer = []
    this.metrics = this.initializeMetrics()

    this.startFlushTimer()
  }

  /**
   * Log a security event with comprehensive details
   */
  async logSecurityEvent(
    eventType: SecurityEventType,
    userId: string | null,
    details: Record<string, unknown> = {},
    context: {
      ipAddress?: string
      userAgent?: string
      endpoint?: string
      method?: string
      statusCode?: number
      sessionId?: string
      correlationId?: string
    } = {},
  ): Promise<void> {
    try {
      const event: SecurityEvent = {
        id: randomUUID(),
        eventType,
        userId,
        ipAddress: context.ipAddress || 'unknown',
        userAgent: context.userAgent || 'unknown',
        endpoint: context.endpoint || 'unknown',
        method: context.method || 'unknown',
        statusCode: context.statusCode || 0,
        details: this.sanitizeDetails(details),
        riskScore: this.calculateRiskScore(eventType, details),
        encrypted: this.config.enableEncryption,
        timestamp: new Date().toISOString(),
        sessionId: context.sessionId,
        correlationId: context.correlationId || randomUUID(),
      }

      // Buffer the event for batch processing
      this.eventBuffer.push(event)

      // Update metrics
      this.updateMetrics(event)

      // Real-time monitoring and alerting
      if (this.config.enableRealTimeMonitoring) {
        await this.processRealTimeEvent(event)
      }

      // Immediate flush if buffer is full or high-risk event
      if (
        this.eventBuffer.length >= this.config.batchSize ||
        event.riskScore >= this.config.alertThreshold
      ) {
        await this.flushEvents()
      }

      // Log to console for development
      this.logToConsole(event)
    } catch (error) {
      logger.error('Error logging security event', { error, eventType, userId })
    }
  }

  /**
   * Log token generation event
   */
  async logTokenGeneration(
    userId: string,
    accessTokenId: string,
    refreshTokenId: string,
    clientInfo: Record<string, unknown>,
  ): Promise<void> {
    await this.logSecurityEvent(
      SecurityEventType.TOKEN_CREATED,
      userId,
      {
        accessTokenId,
        refreshTokenId,
        clientInfo,
      },
      {
        endpoint: '/api/auth/login',
        method: 'POST',
        statusCode: 200,
      },
    )
  }

  /**
   * Log token validation event
   */
  async logTokenValidation(
    userId: string,
    tokenId: string,
    tokenType: string,
  ): Promise<void> {
    await this.logSecurityEvent(
      SecurityEventType.TOKEN_VALIDATED,
      userId,
      {
        tokenId,
        tokenType,
      },
      {
        endpoint: '/api/auth/validate',
        method: 'POST',
        statusCode: 200,
      },
    )
  }

  /**
   * Log token validation failure
   */
  async logTokenValidationFailure(
    error: Error,
    tokenType?: string,
  ): Promise<void> {
    await this.logSecurityEvent(
      SecurityEventType.TOKEN_VALIDATION_FAILED,
      null,
      {
        error: error.message,
        tokenType,
        errorType: error.constructor.name,
      },
      {
        endpoint: '/api/auth/validate',
        method: 'POST',
        statusCode: 401,
      },
    )
  }

  /**
   * Log token refresh event
   */
  async logTokenRefresh(
    userId: string,
    oldTokenId: string,
    newTokenPair: { accessToken: string; refreshToken: string },
  ): Promise<void> {
    await this.logSecurityEvent(
      SecurityEventType.TOKEN_REFRESHED,
      userId,
      {
        oldTokenId,
        newAccessTokenId: this.extractTokenId(newTokenPair.accessToken),
        newRefreshTokenId: this.extractTokenId(newTokenPair.refreshToken),
      },
      {
        endpoint: '/api/auth/refresh',
        method: 'POST',
        statusCode: 200,
      },
    )
  }

  /**
   * Log token revocation event
   */
  async logTokenRevocation(
    userId: string,
    tokenId: string,
    reason: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    await this.logSecurityEvent(
      SecurityEventType.TOKEN_REVOKED,
      userId,
      {
        tokenId,
        reason,
        ...metadata,
      },
      {
        endpoint: '/api/auth/revoke',
        method: 'POST',
        statusCode: 200,
      },
    )
  }

  /**
   * Log token generation failure
   */
  async logTokenGenerationFailure(
    userId: string | null,
    error: Error,
  ): Promise<void> {
    await this.logSecurityEvent(
      SecurityEventType.TOKEN_VALIDATION_FAILED,
      userId,
      {
        error: error.message,
        errorType: error.constructor.name,
        phase: 'generation',
      },
      {
        endpoint: '/api/auth/login',
        method: 'POST',
        statusCode: 401,
      },
    )
  }

  /**
   * Log token refresh failure
   */
  async logTokenRefreshFailure(error: Error): Promise<void> {
    await this.logSecurityEvent(
      SecurityEventType.TOKEN_VALIDATION_FAILED,
      null,
      {
        error: error.message,
        errorType: error.constructor.name,
        phase: 'refresh',
      },
      {
        endpoint: '/api/auth/refresh',
        method: 'POST',
        statusCode: 401,
      },
    )
  }

  /**
   * Log token revocation failure
   */
  async logTokenRevocationFailure(
    tokenId: string,
    error: Error,
  ): Promise<void> {
    await this.logSecurityEvent(
      SecurityEventType.TOKEN_REVOKED,
      null,
      {
        tokenId,
        error: error.message,
        errorType: error.constructor.name,
      },
      {
        endpoint: '/api/auth/revoke',
        method: 'POST',
        statusCode: 500,
      },
    )
  }

  /**
   * Log token cleanup event
   */
  async logTokenCleanup(userId: string, tokenId: string): Promise<void> {
    await this.logSecurityEvent(
      SecurityEventType.TOKEN_CLEANED_UP,
      userId,
      {
        tokenId,
        reason: 'expired_cleanup',
      },
      {
        endpoint: '/system/cleanup',
        method: 'SYSTEM',
        statusCode: 200,
      },
    )
  }

  /**
   * Log token cleanup failure
   */
  async logTokenCleanupFailure(error: Error): Promise<void> {
    await this.logSecurityEvent(
      SecurityEventType.TOKEN_CLEANED_UP,
      null,
      {
        error: error.message,
        errorType: error.constructor.name,
      },
      {
        endpoint: '/system/cleanup',
        method: 'SYSTEM',
        statusCode: 500,
      },
    )
  }

  /**
   * Log permission denied event
   */
  async logPermissionDenied(
    userId: string,
    requiredPermission: string,
    actualPermission: string,
    resource: string,
  ): Promise<void> {
    await this.logSecurityEvent(
      SecurityEventType.PERMISSION_DENIED,
      userId,
      {
        requiredPermission,
        actualPermission,
        resource,
      },
      {
        endpoint: resource,
        method: 'UNKNOWN',
        statusCode: 403,
      },
    )
  }

  /**
   * Log rate limit exceeded event
   */
  async logRateLimitExceeded(
    userId: string | null,
    endpoint: string,
    limit: number,
    window: number,
  ): Promise<void> {
    await this.logSecurityEvent(
      SecurityEventType.RATE_LIMIT_EXCEEDED,
      userId,
      {
        endpoint,
        limit,
        window,
        retryAfter: window,
      },
      {
        endpoint,
        method: 'UNKNOWN',
        statusCode: 429,
      },
    )
  }

  /**
   * Log suspicious activity
   */
  async logSuspiciousActivity(
    userId: string | null,
    activity: string,
    details: Record<string, unknown> = {},
  ): Promise<void> {
    await this.logSecurityEvent(
      SecurityEventType.SUSPICIOUS_ACTIVITY,
      userId,
      {
        activity,
        ...details,
      },
      {
        endpoint: '/security/monitor',
        method: 'SYSTEM',
        statusCode: 200,
      },
    )
  }

  /**
   * Get security metrics
   */
  async getSecurityMetrics(
    timeWindow: number = 24 * 3600 * 1000,
  ): Promise<SecurityMetrics> {
    try {
      const since = new Date(Date.now() - timeWindow).toISOString()

      // Get events from Redis for the time window
      const recentEvents = await this.getRecentEvents(since)

      // Calculate metrics
      const metrics = this.calculateMetricsFromEvents(recentEvents)

      return {
        ...this.metrics,
        ...metrics,
      }
    } catch (error) {
      logger.error('Error getting security metrics', error)
      return this.metrics
    }
  }

  /**
   * Get recent security events
   */
  async getRecentEvents(
    since: string,
    limit: number = 1000,
  ): Promise<SecurityEvent[]> {
    try {
      // Get events from Redis sorted set by timestamp
      const eventIds = await this.redis.zrangebyscore(
        'security:events:timeline',
        new Date(since).getTime(),
        Date.now(),
        'LIMIT',
        0,
        limit,
      )

      if (eventIds.length === 0) {
        return []
      }

      // Get event details
      const pipeline = this.redis.pipeline()
      for (const eventId of eventIds) {
        pipeline.hgetall(`security:event:${eventId}`)
      }

      const results = await pipeline.exec()
      const events: SecurityEvent[] = []

      for (const [error, data] of results) {
        if (!error && data) {
          try {
            const event = this.deserializeEvent(data as Record<string, string>)
            events.push(event)
          } catch (parseError) {
            logger.error('Error deserializing security event', parseError)
          }
        }
      }

      return events.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
    } catch (error) {
      logger.error('Error getting recent security events', error)
      return []
    }
  }

  /**
   * Generate security audit report
   */
  async generateAuditReport(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    summary: SecurityMetrics
    highRiskEvents: SecurityEvent[]
    complianceStatus: {
      hipaaCompliant: boolean
      violations: string[]
      recommendations: string[]
    }
    recommendations: string[]
  }> {
    try {
      const events = await this.getEventsInDateRange(startDate, endDate)

      const summary = this.calculateMetricsFromEvents(events)
      const highRiskEvents = events.filter(
        (event) => event.riskScore >= this.config.alertThreshold,
      )

      const complianceStatus = await this.checkComplianceStatus(events)
      const recommendations = this.generateRecommendations(
        events,
        complianceStatus.violations,
      )

      return {
        summary,
        highRiskEvents,
        complianceStatus,
        recommendations,
      }
    } catch (error) {
      logger.error('Error generating audit report', error)
      throw new Error('Audit report generation failed', { cause: error })
    }
  }

  /**
   * Flush buffered events to persistent storage
   */
  private async flushEvents(): Promise<void> {
    if (this.eventBuffer.length === 0) return

    const eventsToFlush = [...this.eventBuffer]
    this.eventBuffer = []

    try {
      const pipeline = this.redis.pipeline()

      for (const event of eventsToFlush) {
        // Store event details
        const eventKey = `security:event:${event.id}`
        const eventData = this.serializeEvent(event)

        pipeline.hmset(eventKey, eventData)
        pipeline.expire(eventKey, this.config.retentionPeriod * 24 * 3600)

        // Add to timeline index
        const timelineKey = 'security:events:timeline'
        pipeline.zadd(
          timelineKey,
          new Date(event.timestamp).getTime(),
          event.id,
        )

        // Add to user index
        if (event.userId) {
          const userKey = `security:events:user:${event.userId}`
          pipeline.zadd(userKey, new Date(event.timestamp).getTime(), event.id)
          pipeline.expire(userKey, this.config.retentionPeriod * 24 * 3600)
        }

        // Add to type index
        const typeKey = `security:events:type:${event.eventType}`
        pipeline.zadd(typeKey, new Date(event.timestamp).getTime(), event.id)
        pipeline.expire(typeKey, this.config.retentionPeriod * 24 * 3600)
      }

      await pipeline.exec()

      logger.debug(`Flushed ${eventsToFlush.length} security events to storage`)
    } catch (error) {
      logger.error('Error flushing security events', error)
      // Re-add events to buffer for retry
      this.eventBuffer.unshift(...eventsToFlush)
    }
  }

  /**
   * Process real-time security events for monitoring and alerting
   */
  private async processRealTimeEvent(event: SecurityEvent): Promise<void> {
    // High-risk event alerting
    if (event.riskScore >= this.config.alertThreshold) {
      await this.triggerHighRiskAlert(event)
    }

    // Pattern detection for suspicious activities
    await this.detectSuspiciousPatterns(event)

    // Real-time metrics update
    this.updateRealTimeMetrics(event)
  }

  /**
   * Calculate risk score for security event
   */
  private calculateRiskScore(
    eventType: SecurityEventType,
    details: Record<string, unknown>,
  ): number {
    const baseScores: Record<SecurityEventType, number> = {
      [SecurityEventType.LOGIN_SUCCESS]: 0.1,
      [SecurityEventType.LOGIN_FAILURE]: 0.3,
      [SecurityEventType.LOGOUT]: 0.1,
      [SecurityEventType.TOKEN_CREATED]: 0.1,
      [SecurityEventType.TOKEN_VALIDATED]: 0.1,
      [SecurityEventType.TOKEN_VALIDATION_FAILED]: 0.4,
      [SecurityEventType.TOKEN_REFRESHED]: 0.2,
      [SecurityEventType.TOKEN_REVOKED]: 0.2,
      [SecurityEventType.PERMISSION_GRANTED]: 0.1,
      [SecurityEventType.PERMISSION_DENIED]: 0.3,
      [SecurityEventType.ROLE_ASSIGNED]: 0.2,
      [SecurityEventType.ROLE_REMOVED]: 0.2,
      [SecurityEventType.RATE_LIMIT_EXCEEDED]: 0.5,
      [SecurityEventType.ACCOUNT_LOCKED]: 0.7,
      [SecurityEventType.ACCOUNT_UNLOCKED]: 0.2,
      [SecurityEventType.SUSPICIOUS_ACTIVITY]: 0.8,
      [SecurityEventType.SECURITY_BREACH]: 1.0,
      [SecurityEventType.MFA_ENABLED]: 0.1,
      [SecurityEventType.MFA_DISABLED]: 0.3,
      [SecurityEventType.MFA_VERIFICATION_SUCCESS]: 0.1,
      [SecurityEventType.MFA_VERIFICATION_FAILED]: 0.4,
      [SecurityEventType.PASSWORD_CHANGED]: 0.2,
      [SecurityEventType.PASSWORD_RESET_REQUESTED]: 0.3,
      [SecurityEventType.PASSWORD_RESET_COMPLETED]: 0.2,
      [SecurityEventType.SESSION_CREATED]: 0.1,
      [SecurityEventType.SESSION_ENDED]: 0.1,
      [SecurityEventType.SESSION_EXPIRED]: 0.2,
      [SecurityEventType.SESSION_HIJACKING_DETECTED]: 0.9,
      [SecurityEventType.SECURITY_SETTINGS_CHANGED]: 0.3,
      [SecurityEventType.API_KEY_CREATED]: 0.2,
      [SecurityEventType.API_KEY_REVOKED]: 0.2,
      [SecurityEventType.HIPAA_VIOLATION_DETECTED]: 0.9,
      [SecurityEventType.COMPLIANCE_AUDIT_PASSED]: 0.1,
      [SecurityEventType.COMPLIANCE_AUDIT_FAILED]: 0.8,
      [SecurityEventType.TOKEN_CLEANED_UP]: 0.1,
      [SecurityEventType.SECURITY_SCAN_COMPLETED]: 0.2,
      [SecurityEventType.THREAT_NEUTRALIZED]: 0.6,
    }

    let riskScore = baseScores[eventType] || 0.5

    // Adjust based on details
    if (details.multipleFailures) riskScore += 0.2
    if (details.unusualLocation) riskScore += 0.3
    if (details.bruteForceAttempt) riskScore += 0.4
    if (details.maliciousPayload) riskScore += 0.5

    return Math.min(riskScore, 1.0)
  }

  /**
   * Sanitize event details for HIPAA compliance
   */
  private sanitizeDetails(
    details: Record<string, unknown>,
  ): Record<string, unknown> {
    if (!this.config.enableHIPAACompliance) {
      return details
    }

    const sanitized = { ...details }

    // Remove or mask PHI (Protected Health Information)
    const phiFields = [
      'ssn',
      'dob',
      'medical_record',
      'diagnosis',
      'treatment',
      'patient_id',
    ]

    for (const field of phiFields) {
      if (sanitized[field]) {
        sanitized[field] = '[PHI_MASKED]'
      }
    }

    return sanitized
  }

  /**
   * Initialize security metrics
   */
  private initializeMetrics(): SecurityMetrics {
    return {
      totalEvents: 0,
      highRiskEvents: 0,
      authenticationFailures: 0,
      authorizationFailures: 0,
      tokenRevocations: 0,
      rateLimitViolations: 0,
      suspiciousActivities: 0,
      averageRiskScore: 0,
    }
  }

  /**
   * Update metrics with new event
   */
  private updateMetrics(event: SecurityEvent): void {
    this.metrics.totalEvents++

    if (event.riskScore >= this.config.alertThreshold) {
      this.metrics.highRiskEvents++
    }

    // Update specific metrics based on event type
    switch (event.eventType) {
      case SecurityEventType.LOGIN_FAILURE:
      case SecurityEventType.TOKEN_VALIDATION_FAILED:
      case SecurityEventType.MFA_VERIFICATION_FAILED:
        this.metrics.authenticationFailures++
        break

      case SecurityEventType.PERMISSION_DENIED:
        this.metrics.authorizationFailures++
        break

      case SecurityEventType.TOKEN_REVOKED:
        this.metrics.tokenRevocations++
        break

      case SecurityEventType.RATE_LIMIT_EXCEEDED:
        this.metrics.rateLimitViolations++
        break

      case SecurityEventType.SUSPICIOUS_ACTIVITY:
      case SecurityEventType.SECURITY_BREACH:
      case SecurityEventType.SESSION_HIJACKING_DETECTED:
        this.metrics.suspiciousActivities++
        break
    }

    // Update average risk score
    this.metrics.averageRiskScore =
      (this.metrics.averageRiskScore * (this.metrics.totalEvents - 1) +
        event.riskScore) /
      this.metrics.totalEvents
  }

  /**
   * Start periodic flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }

    this.flushTimer = setInterval(async () => {
      try {
        await this.flushEvents()
      } catch (error) {
        logger.error('Error in security event flush timer', error)
      }
    }, this.config.flushInterval * 1000)

    // Run initial flush
    this.flushEvents().catch((error) => {
      logger.error('Error in initial security event flush', error)
    })
  }

  /**
   * Stop flush timer
   */
  stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = undefined
    }
  }

  // Placeholder methods for future implementation
  private async triggerHighRiskAlert(event: SecurityEvent): Promise<void> {
    // TODO: Implement high-risk alert system
    logger.warn('High-risk security event detected', { event })
  }

  private async detectSuspiciousPatterns(event: SecurityEvent): Promise<void> {
    // TODO: Implement pattern detection for suspicious activities
    logger.debug('Checking for suspicious patterns', { event })
  }

  private async updateRealTimeMetrics(event: SecurityEvent): Promise<void> {
    // TODO: Implement real-time metrics updates
    logger.debug('Updating real-time metrics', { event })
  }

  private async getEventsInDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<SecurityEvent[]> {
    try {
      const startTimestamp = startDate.getTime()
      const endTimestamp = endDate.getTime()

      // Get event IDs from Redis sorted set by timestamp range
      const eventIds = await this.redis.zrangebyscore(
        'security:events:timeline',
        startTimestamp,
        endTimestamp,
      )

      if (eventIds.length === 0) {
        return []
      }

      // Get event details using pipeline for efficiency
      const pipeline = this.redis.pipeline()
      for (const eventId of eventIds) {
        pipeline.hgetall(`security:event:${eventId}`)
      }

      const results = await pipeline.exec()
      const events: SecurityEvent[] = []

      for (const [error, data] of results) {
        if (!error && data) {
          try {
            const event = this.deserializeEvent(data as Record<string, string>)
            events.push(event)
          } catch (parseError) {
            logger.error('Error deserializing security event', parseError)
          }
        }
      }

      // Sort by timestamp descending
      return events.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
    } catch (error) {
      logger.error('Error getting events in date range', {
        error,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      })
      return []
    }
  }

  private async checkComplianceStatus(_events: SecurityEvent[]): Promise<{
    hipaaCompliant: boolean
    violations: string[]
    recommendations: string[]
  }> {
    // TODO: Implement compliance checking
    return {
      hipaaCompliant: true,
      violations: [],
      recommendations: [],
    }
  }

  private generateRecommendations(
    events: SecurityEvent[],
    violations: string[],
  ): string[] {
    const recommendations: string[] = []

    // Analyze events for patterns and generate recommendations
    const eventCounts = this.countEventsByType(events)
    const highRiskEvents = events.filter(e => e.riskScore >= this.config.alertThreshold)
    const failureEvents = events.filter(e =>
      e.eventType === SecurityEventType.LOGIN_FAILURE ||
      e.eventType === SecurityEventType.TOKEN_VALIDATION_FAILED ||
      e.eventType === SecurityEventType.MFA_VERIFICATION_FAILED
    )

    // Authentication-related recommendations
    if (failureEvents.length > 10) {
      recommendations.push('Consider implementing account lockout after multiple failed authentication attempts')
    }

    if (eventCounts[SecurityEventType.MFA_VERIFICATION_FAILED] > 5) {
      recommendations.push('Review MFA configuration and user training for multi-factor authentication')
    }

    // Rate limiting recommendations
    if (eventCounts[SecurityEventType.RATE_LIMIT_EXCEEDED] > 0) {
      recommendations.push('Review and potentially tighten rate limiting policies')
    }

    // High-risk event recommendations
    if (highRiskEvents.length > events.length * 0.1) {
      recommendations.push('High percentage of risky events detected - consider enhanced monitoring')
    }

    // Session security recommendations
    if (eventCounts[SecurityEventType.SESSION_HIJACKING_DETECTED] > 0) {
      recommendations.push('Implement additional session security measures and user education')
    }

    // Token management recommendations
    const tokenEvents = eventCounts[SecurityEventType.TOKEN_VALIDATION_FAILED] || 0
    if (tokenEvents > 20) {
      recommendations.push('Review token validation logic and consider shorter token lifespans')
    }

    // Compliance-based recommendations
    if (violations.length > 0) {
      recommendations.push('Address identified compliance violations immediately')
      recommendations.push('Implement additional HIPAA compliance monitoring')
    }

    // Permission-related recommendations
    if (eventCounts[SecurityEventType.PERMISSION_DENIED] > 15) {
      recommendations.push('Review user permissions and role assignments for proper access control')
    }

    // General security recommendations
    if (events.length > 1000) {
      recommendations.push('Consider implementing automated threat detection and response')
    }

    return recommendations
  }

  private calculateMetricsFromEvents(events: SecurityEvent[]): SecurityMetrics {
    if (events.length === 0) {
      return this.initializeMetrics()
    }

    const metrics: SecurityMetrics = {
      totalEvents: events.length,
      highRiskEvents: 0,
      authenticationFailures: 0,
      authorizationFailures: 0,
      tokenRevocations: 0,
      rateLimitViolations: 0,
      suspiciousActivities: 0,
      averageRiskScore: 0,
    }

    let totalRiskScore = 0

    for (const event of events) {
      totalRiskScore += event.riskScore

      // Count high-risk events
      if (event.riskScore >= this.config.alertThreshold) {
        metrics.highRiskEvents++
      }

      // Count specific event types
      switch (event.eventType) {
        case SecurityEventType.LOGIN_FAILURE:
        case SecurityEventType.TOKEN_VALIDATION_FAILED:
        case SecurityEventType.MFA_VERIFICATION_FAILED:
          metrics.authenticationFailures++
          break

        case SecurityEventType.PERMISSION_DENIED:
          metrics.authorizationFailures++
          break

        case SecurityEventType.TOKEN_REVOKED:
          metrics.tokenRevocations++
          break

        case SecurityEventType.RATE_LIMIT_EXCEEDED:
          metrics.rateLimitViolations++
          break

        case SecurityEventType.SUSPICIOUS_ACTIVITY:
        case SecurityEventType.SECURITY_BREACH:
        case SecurityEventType.SESSION_HIJACKING_DETECTED:
        case SecurityEventType.HIPAA_VIOLATION_DETECTED:
          metrics.suspiciousActivities++
          break
      }
    }

    // Calculate average risk score
    metrics.averageRiskScore = totalRiskScore / events.length

    return metrics
  }

  private countEventsByType(events: SecurityEvent[]): Record<SecurityEventType, number> {
    const counts: Record<SecurityEventType, number> = {} as Record<SecurityEventType, number>

    for (const event of events) {
      counts[event.eventType] = (counts[event.eventType] || 0) + 1
    }

    return counts
  }

  private serializeEvent(event: SecurityEvent): Record<string, string> {
    return {
      id: event.id,
      eventType: event.eventType,
      userId: event.userId || '',
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      endpoint: event.endpoint,
      method: event.method,
      statusCode: String(event.statusCode),
      details: JSON.stringify(event.details),
      riskScore: String(event.riskScore),
      encrypted: String(event.encrypted),
      timestamp: event.timestamp,
      sessionId: event.sessionId || '',
      correlationId: event.correlationId || '',
    }
  }

  private deserializeEvent(data: Record<string, string>): SecurityEvent {
    return {
      id: data.id,
      eventType: data.eventType as SecurityEventType,
      userId: data.userId || null,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      endpoint: data.endpoint,
      method: data.method,
      statusCode: Number(data.statusCode),
      details: JSON.parse(data.details || '{}'),
      riskScore: Number(data.riskScore),
      encrypted: data.encrypted === 'true',
      timestamp: data.timestamp,
      sessionId: data.sessionId || undefined,
      correlationId: data.correlationId || undefined,
    }
  }

  private extractTokenId(_token: string): string {
    // TODO: Implement token ID extraction
    return 'unknown'
  }

  private logToConsole(event: SecurityEvent): void {
    const logLevel =
      event.riskScore >= this.config.alertThreshold ? 'warn' : 'info'
    logger[logLevel]('Security event logged', {
      eventId: event.id,
      type: event.eventType,
      userId: event.userId,
      riskScore: event.riskScore,
      timestamp: event.timestamp,
    })
  }
}
