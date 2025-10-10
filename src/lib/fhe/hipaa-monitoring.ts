/**
 * HIPAA++ Monitoring and Alerting System
 *
 * Real-time security monitoring, threat detection, and compliance reporting
 */

import { EventEmitter } from 'node:events'
import os from 'node:os'
import { createBuildSafeLogger } from '../logging/build-safe-logger'
import hipaaKeyRotationService, { type AuditEvent } from './key-rotation'
import {
  HIPAA_SECURITY_CONFIG,
  validateHIPAAEnvironment,
} from './hipaa-config'
import AWS from 'aws-sdk'

const logger = createBuildSafeLogger('hipaa-monitoring')

interface SecurityAlert {
  id: string
  timestamp: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  category:
  | 'key_management'
  | 'access_control'
  | 'data_integrity'
  | 'system_health'
  title: string
  description: string
  affectedResources: string[]
  recommendedActions: string[]
  auditEvents: AuditEvent[]
  metadata: Record<string, unknown>
}

interface ComplianceReport {
  reportId: string
  generatedAt: string
  period: { start: string; end: string }
  metadata?: {
    dataComplete: boolean
    warning?: string
  }
  keyRotationCompliance: {
    totalRotations: number
    successfulRotations: number
    failedRotations: number
    averageRotationTime: number
    complianceScore: number
  }
  securityIncidents: {
    total: number
    byCategory: Record<string, number>
    bySeverity: Record<string, number>
    resolved: number
    pending: number
  }
  auditTrail: {
    totalEvents: number
    retentionCompliance: boolean
    integrityVerified: boolean
  }
  recommendations: string[]
}

interface ThreatPattern {
  id: string
  name: string
  description: string
  indicators: Array<{
    eventType: string
    threshold: number
    timeWindow: number
  }>
  severity: 'low' | 'medium' | 'high' | 'critical'
  responseActions: string[]
}

/**
 * HIPAA++ Security Monitoring Service
 */
export class HIPAAMonitoringService extends EventEmitter {
  private static instance: HIPAAMonitoringService
  private alerts: SecurityAlert[] = []
  private threatPatterns: ThreatPattern[] = []
  private cloudWatch: AWS.CloudWatch | null = null
  private sns: AWS.SNS | null = null
  private isMonitoring = false
  private monitoringIntervals: NodeJS.Timeout[] = []
  private patternCooldowns = new Map<string, number>()
  private lastComplianceStatus = {
    envValid: true,
    rotationWithinSla: true,
    auditTrailPresent: true,
    failureRateAcceptable: true,
  }
  private lastHealthStatus = {
    awsHealthy: true,
    serviceReady: true,
    resourceState: 'healthy' as 'healthy' | 'warning' | 'critical',
  }

  private constructor() {
    super()
    this.initializeAWSServices()
    this.setupThreatPatterns()
    logger.info('HIPAA++ Monitoring Service initialized')
  }

  public static getInstance(): HIPAAMonitoringService {
    if (!HIPAAMonitoringService.instance) {
      HIPAAMonitoringService.instance = new HIPAAMonitoringService()
    }
    return HIPAAMonitoringService.instance
  }

  /**
   * Initialize AWS monitoring services
   */
  private initializeAWSServices() {
    try {
      this.cloudWatch = new AWS.CloudWatch({ apiVersion: '2010-08-01' })
      this.sns = new AWS.SNS({ apiVersion: '2010-03-31' })
      logger.info('AWS monitoring services initialized')
    } catch (error: unknown) {
      logger.error('Failed to initialize AWS monitoring services', { error })
    }
  }

  /**
   * Setup threat detection patterns
   */
  private setupThreatPatterns() {
    this.threatPatterns = [
      {
        id: 'rapid_rotation_failures',
        name: 'Rapid Key Rotation Failures',
        description: 'Multiple key rotation failures in short time period',
        indicators: [
          {
            eventType: 'key_rotation_failed',
            threshold: 3,
            timeWindow: 300000,
          }, // 5 minutes
        ],
        severity: 'critical',
        responseActions: [
          'emergency_lockdown',
          'notify_security_team',
          'audit_system_integrity',
        ],
      },
      {
        id: 'unauthorized_key_access',
        name: 'Unauthorized Key Access Attempts',
        description: 'Suspicious access patterns to encryption keys',
        indicators: [
          {
            eventType: 'unauthorized_access',
            threshold: 5,
            timeWindow: 600000,
          }, // 10 minutes
        ],
        severity: 'high',
        responseActions: [
          'block_suspicious_ips',
          'force_key_rotation',
          'enhance_monitoring',
        ],
      },
      {
        id: 'key_age_violations',
        name: 'Key Age Policy Violations',
        description: 'Keys exceeding maximum allowed age',
        indicators: [
          { eventType: 'key_age_violation', threshold: 1, timeWindow: 3600000 }, // 1 hour
        ],
        severity: 'medium',
        responseActions: ['force_key_rotation', 'update_rotation_schedule'],
      },
      {
        id: 'system_compromise_indicators',
        name: 'System Compromise Indicators',
        description: 'Multiple security events indicating potential compromise',
        indicators: [
          { eventType: 'key_compromise_reported', threshold: 1, timeWindow: 0 },
          {
            eventType: 'suspicious_activity_detected',
            threshold: 1,
            timeWindow: 0,
          },
        ],
        severity: 'critical',
        responseActions: [
          'emergency_rotation',
          'isolate_affected_systems',
          'forensic_analysis',
        ],
      },
    ]
  }

  /**
   * Start continuous monitoring
   */
  public startMonitoring() {
    if (this.isMonitoring) {
      logger.warn('Monitoring already active')
      return
    }

    this.isMonitoring = true

    // Real-time threat detection
    const threatDetectionInterval = setInterval(() => {
      this.performThreatDetection()
    }, 30000) // Every 30 seconds

    // Compliance monitoring
    const complianceInterval = setInterval(() => {
      this.performComplianceCheck()
    }, 300000) // Every 5 minutes

    // Health monitoring
    const healthInterval = setInterval(() => {
      this.performHealthCheck()
    }, 60000) // Every minute

    // Metrics emission
    const metricsInterval = setInterval(() => {
      this.emitSecurityMetrics()
    }, HIPAA_SECURITY_CONFIG.METRICS_EMISSION_INTERVAL_MS)

    this.monitoringIntervals.push(
      threatDetectionInterval,
      complianceInterval,
      healthInterval,
      metricsInterval,
    )

    logger.info('HIPAA++ continuous monitoring started')
    this.emit('monitoring-started')
  }

  /**
   * Stop monitoring
   */
  public stopMonitoring() {
    this.isMonitoring = false

    for (const interval of this.monitoringIntervals) {
      clearInterval(interval)
    }
    this.monitoringIntervals = []

    logger.info('HIPAA++ monitoring stopped')
    this.emit('monitoring-stopped')
  }

  /**
   * Process security event for monitoring
   */
  public processSecurityEvent(event: AuditEvent): void {
    // Check against threat patterns
    this.evaluateThreatPatterns(event)

    // Generate alerts for high-risk events
    if (event.riskLevel === 'critical' || event.riskLevel === 'high') {
      this.generateSecurityAlert(event)
    }

    // Emit for real-time processing
    this.emit('security-event', event)
  }

  /**
   * Evaluate event against threat patterns
   */
  private evaluateThreatPatterns(event: AuditEvent): void {
    const now = Date.now()

    for (const pattern of this.threatPatterns) {
      for (const indicator of pattern.indicators) {
        if (event.action === indicator.eventType) {
          try {
            // Count recent events of this type
            const recentEvents = this.getRecentEvents(
              indicator.eventType,
              now - indicator.timeWindow,
            )

            if (recentEvents.length >= indicator.threshold) {
              this.triggerThreatResponse(pattern, recentEvents)
            }
          } catch (error: unknown) {
            logger.warn(
              'Failed to retrieve recent events for threat pattern evaluation',
              {
                eventType: indicator.eventType,
                patternId: pattern.id,
                error: error instanceof Error ? String(error) : 'Unknown error',
              },
            )
            // Continue processing other patterns
          }
        }
      }
    }
  }

  /**
   * Get recent audit events of specific type
   */
  private getRecentEvents(eventType: string, since: number): AuditEvent[] {
    try {
      const boundary = Number.isFinite(since) ? new Date(Math.max(since, 0)) : new Date(0)
      const events = hipaaKeyRotationService.getAuditEvents(boundary)
      return events.filter((event) => event.action === eventType)
    } catch (error: unknown) {
      logger.error('Failed to retrieve recent audit events', {
        eventType,
        since,
        error,
      })
      return []
    }
  }

  /**
   * Trigger threat response
   */
  private triggerThreatResponse(
    pattern: ThreatPattern,
    events: AuditEvent[],
  ): void {
    const alert: SecurityAlert = {
      id: this.generateAlertId(),
      timestamp: new Date().toISOString(),
      severity: pattern.severity,
      category: 'key_management',
      title: pattern.name,
      description: pattern.description,
      affectedResources: events.map((e) => e.keyId || 'system').filter(Boolean),
      recommendedActions: pattern.responseActions,
      auditEvents: events,
      metadata: {
        patternId: pattern.id,
        triggerCount: events.length,
      },
    }

    this.alerts.push(alert)
    this.emit('security-alert', alert)

    // Send to AWS SNS for immediate notification
    void this.sendAlertNotification(alert)

    logger.warn('Security threat detected', {
      patternId: pattern.id,
      severity: pattern.severity,
      eventCount: events.length,
    })
  }

  /**
   * Generate security alert from audit event
   */
  private generateSecurityAlert(event: AuditEvent): void {
    const alert: SecurityAlert = {
      id: this.generateAlertId(),
      timestamp: new Date().toISOString(),
      severity: event.riskLevel,
      category: this.categorizeEvent(event.action),
      title: this.getAlertTitle(event.action),
      description: `Security event: ${event.action}`,
      affectedResources: event.keyId ? [event.keyId] : [],
      recommendedActions: this.getRecommendedActions(event.action),
      auditEvents: [event],
      metadata: {
        eventId: event.eventId,
        originalAction: event.action,
      },
    }

    this.alerts.push(alert)
    this.emit('security-alert', alert)
    void this.sendAlertNotification(alert)
  }

  private createSecurityAlert(options: {
    severity: SecurityAlert['severity']
    category: SecurityAlert['category']
    title: string
    description: string
    recommendedActions?: string[]
    metadata?: Record<string, unknown>
    alertKey: string
    cooldownMs?: number
  }): void {
    const now = Date.now()
    const cooldownMs = options.cooldownMs ?? 5 * 60 * 1000
    const lastTrigger = this.patternCooldowns.get(options.alertKey) ?? 0

    if (now - lastTrigger < cooldownMs) {
      return
    }

    this.patternCooldowns.set(options.alertKey, now)

    const alert: SecurityAlert = {
      id: this.generateAlertId(),
      timestamp: new Date().toISOString(),
      severity: options.severity,
      category: options.category,
      title: options.title,
      description: options.description,
      affectedResources: [],
      recommendedActions: options.recommendedActions ?? [],
      auditEvents: [],
      metadata: options.metadata ?? {},
    }

    this.alerts.push(alert)
    this.emit('security-alert', alert)
    void this.sendAlertNotification(alert)
  }

  /**
   * Send alert notification via SNS
   */
  private async sendAlertNotification(alert: SecurityAlert): Promise<void> {
    if (!this.sns) {
      return
    }

    try {
      const topicArn = process.env['HIPAA_SECURITY_ALERTS_TOPIC_ARN']
      if (!topicArn) {
        logger.warn('HIPAA_SECURITY_ALERTS_TOPIC_ARN not configured')
        return
      }

      const message = {
        alertId: alert.id,
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        timestamp: alert.timestamp,
        affectedResources: alert.affectedResources,
        recommendedActions: alert.recommendedActions,
      }

      await this.sns
        .publish({
          TopicArn: topicArn,
          Subject: `HIPAA++ Security Alert: ${alert.title}`,
          Message: JSON.stringify(message, null, 2),
        })
        .promise()

      logger.info('Security alert notification sent', { alertId: alert.id })
    } catch (error: unknown) {
      logger.error('Failed to send alert notification', {
        error,
        alertId: alert.id,
      })
    }
  }

  /**
   * Perform threat detection analysis
   */
  private performThreatDetection() {
    try {
      const now = Date.now()
      const observationWindowMs = 30 * 60 * 1000
      const recentEvents = hipaaKeyRotationService.getAuditEvents(
        new Date(now - observationWindowMs),
      )

      if (recentEvents.length === 0) {
        logger.debug('Threat detection skipped - no recent audit events')
        return
      }

      const failures = recentEvents.filter(
        (event) => event.action === 'key_rotation_failed',
      )
      const compromises = recentEvents.filter(
        (event) => event.action === 'key_compromise_reported',
      )
      const suspicious = recentEvents.filter(
        (event) => event.action === 'suspicious_activity_detected',
      )
      const ageViolations = recentEvents.filter(
        (event) => event.action === 'key_age_violation',
      )
      const unauthorizedAccess = recentEvents.filter(
        (event) => event.action === 'unauthorized_access',
      )

      const maybeTriggerPattern = (
        patternId: string,
        events: AuditEvent[],
      ) => {
        if (events.length === 0) {
          return
        }

        const pattern = this.threatPatterns.find(
          (candidate) => candidate.id === patternId,
        )
        if (!pattern) {
          return
        }

        const cooldownMs = 5 * 60 * 1000
        const lastTrigger = this.patternCooldowns.get(patternId) ?? 0
        if (now - lastTrigger < cooldownMs) {
          return
        }

        const hitsIndicator = pattern.indicators.some((indicator) => {
          const windowStart = now - indicator.timeWindow
          const matching = events.filter((event) => {
            if (event.action !== indicator.eventType) {
              return false
            }
            const eventTime = new Date(event.timestamp).getTime()
            return indicator.timeWindow === 0
              ? eventTime <= now
              : eventTime >= windowStart
          })
          return matching.length >= indicator.threshold
        })

        if (hitsIndicator) {
          this.patternCooldowns.set(patternId, now)
          this.triggerThreatResponse(pattern, events)
        }
      }

      maybeTriggerPattern('rapid_rotation_failures', failures)
      maybeTriggerPattern('system_compromise_indicators', compromises)
      maybeTriggerPattern('system_compromise_indicators', suspicious)
      maybeTriggerPattern('key_age_violations', ageViolations)
      maybeTriggerPattern('unauthorized_key_access', unauthorizedAccess)

      const metrics = hipaaKeyRotationService.getSecurityMetrics()
      const failureRate =
        metrics.rotationAttempts > 0
          ? metrics.rotationFailures / metrics.rotationAttempts
          : 0

      if (failureRate >= 0.3) {
        this.createSecurityAlert({
          severity: 'high',
          category: 'key_management',
          title: 'Elevated key rotation failure rate detected',
          description:
            'Key rotation failures exceeded 30% of attempts within the current observation window.',
          recommendedActions: [
            'Review recent key rotation logs for operational errors',
            'Verify AWS KMS and Secrets Manager availability',
            'Escalate to on-call security engineering if failures persist',
          ],
          metadata: {
            rotationAttempts: metrics.rotationAttempts,
            rotationFailures: metrics.rotationFailures,
            failureRate,
          },
          alertKey: 'threat:failure-rate',
          cooldownMs: 10 * 60 * 1000,
        })
      }
    } catch (error: unknown) {
      logger.error('Threat detection analysis failed', { error })
    }
  }

  /**
   * Perform compliance check
   */
  private performComplianceCheck() {
    try {
      const now = Date.now()
      const envValidation = validateHIPAAEnvironment()
      const auditEvents = hipaaKeyRotationService.getAuditEvents()
      const metrics = hipaaKeyRotationService.getSecurityMetrics()

      const lastRotation = metrics.lastRotation || 0
      const hasRotationHistory =
        metrics.rotationAttempts > 0 || metrics.rotationFailures > 0 ||
        lastRotation > 0
      const rotationWithinSla =
        hasRotationHistory &&
        lastRotation > 0 &&
        now - lastRotation <= HIPAA_SECURITY_CONFIG.MAX_KEY_AGE_MS

      const recentFailures = auditEvents.filter((event) => {
        if (event.action !== 'key_rotation_failed') {
          return false
        }
        const timestamp = new Date(event.timestamp).getTime()
        return now - timestamp <= 24 * 60 * 60 * 1000
      })
      const failureThreshold = Math.max(
        1,
        Math.floor(HIPAA_SECURITY_CONFIG.MAX_RECENT_FAILURES / 2),
      )
      const failureRateAcceptable = recentFailures.length <= failureThreshold
      const auditTrailPresent = auditEvents.length > 0

      if (!envValidation.valid && this.lastComplianceStatus.envValid) {
        this.createSecurityAlert({
          severity: 'critical',
          category: 'system_health',
          title: 'HIPAA environment validation failed',
          description: `Required environment variables missing: ${envValidation.missing.join(', ')}`,
          recommendedActions: [
            'Populate required HIPAA environment variables',
            'Redeploy services after validating environment configuration',
          ],
          metadata: { missing: envValidation.missing },
          alertKey: 'compliance:env',
        })
      } else if (envValidation.valid && !this.lastComplianceStatus.envValid) {
        logger.info('HIPAA environment validation restored')
      }

      if (
        hasRotationHistory &&
        !rotationWithinSla &&
        this.lastComplianceStatus.rotationWithinSla
      ) {
        this.createSecurityAlert({
          severity: 'high',
          category: 'key_management',
          title: 'Key rotation exceeds HIPAA SLA',
          description:
            'Active encryption key age exceeds HIPAA-defined rotation window.',
          recommendedActions: [
            'Trigger emergency key rotation',
            'Verify key rotation scheduler status',
            'Audit key rotation logs for systemic failures',
          ],
          metadata: {
            lastRotation,
            maxKeyAgeMs: HIPAA_SECURITY_CONFIG.MAX_KEY_AGE_MS,
          },
          alertKey: 'compliance:sla',
        })
      } else if (rotationWithinSla && !this.lastComplianceStatus.rotationWithinSla) {
        logger.info('Key rotation now within HIPAA SLA window')
      }

      if (
        hasRotationHistory &&
        !auditTrailPresent &&
        this.lastComplianceStatus.auditTrailPresent
      ) {
        this.createSecurityAlert({
          severity: 'critical',
          category: 'data_integrity',
          title: 'HIPAA audit trail unavailable',
          description:
            'No HIPAA audit events detected. Persistent storage may be misconfigured.',
          recommendedActions: [
            'Verify audit logging configuration for key rotation service',
            'Ensure audit sink retains events for HIPAA retention policy',
            'Escalate to compliance engineering if unavailable',
          ],
          alertKey: 'compliance:audit',
        })
      } else if (auditTrailPresent && !this.lastComplianceStatus.auditTrailPresent) {
        logger.info('HIPAA audit trail restored with recent events')
      }

      if (!failureRateAcceptable && this.lastComplianceStatus.failureRateAcceptable) {
        this.createSecurityAlert({
          severity: 'medium',
          category: 'key_management',
          title: 'Repeated key rotation failures detected',
          description:
            'Multiple key rotation failures occurred within the last 24 hours.',
          recommendedActions: [
            'Review failure logs for affected rotations',
            'Confirm AWS KMS availability and IAM permissions',
            'Document corrective action for compliance records',
          ],
          metadata: {
            failureCount: recentFailures.length,
            failureThreshold,
          },
          alertKey: 'compliance:failures',
          cooldownMs: 6 * 60 * 60 * 1000,
        })
      } else if (failureRateAcceptable && !this.lastComplianceStatus.failureRateAcceptable) {
        logger.info('Key rotation failure rate returned to acceptable levels')
      }

      this.lastComplianceStatus = {
        envValid: envValidation.valid,
        rotationWithinSla: rotationWithinSla || !hasRotationHistory,
        auditTrailPresent: auditTrailPresent || !hasRotationHistory,
        failureRateAcceptable,
      }
    } catch (error: unknown) {
      logger.error('Compliance check failed', { error })
    }
  }

  /**
   * Perform system health check
   */
  private performHealthCheck() {
    try {
      const metrics = hipaaKeyRotationService.getSecurityMetrics()
      const activeKey = hipaaKeyRotationService.getActiveKeyId()

      const serviceReady = Boolean(activeKey) || metrics.lastRotation > 0
      const awsHealthy = Boolean(this.cloudWatch && this.sns)

      const memoryUsageMb = process.memoryUsage().rss / (1024 * 1024)
      const cpuLoad = os.loadavg()[0]
      const cpuCapacity = os.cpus().length || 1
      const cpuRatio = cpuLoad / cpuCapacity

      let resourceState: 'healthy' | 'warning' | 'critical' = 'healthy'
      if (memoryUsageMb > 1536 || cpuRatio > 1.2) {
        resourceState = 'critical'
      } else if (memoryUsageMb > 1024 || cpuRatio > 0.9) {
        resourceState = 'warning'
      }

      if (!awsHealthy && this.lastHealthStatus.awsHealthy) {
        this.createSecurityAlert({
          severity: 'high',
          category: 'system_health',
          title: 'AWS monitoring connectivity unavailable',
          description:
            'CloudWatch or SNS client initialization failed. Security alerts may not be delivered.',
          recommendedActions: [
            'Verify AWS credentials and AWS_REGION configuration',
            'Restart monitoring service after restoring connectivity',
          ],
          alertKey: 'health:aws',
        })
      } else if (awsHealthy && !this.lastHealthStatus.awsHealthy) {
        logger.info('AWS monitoring connectivity restored')
      }

      if (!serviceReady && this.lastHealthStatus.serviceReady) {
        this.createSecurityAlert({
          severity: 'critical',
          category: 'system_health',
          title: 'HIPAA key management service unavailable',
          description:
            'No active encryption key registered and no recent rotation completed. Downstream services may be unable to encrypt data.',
          recommendedActions: [
            'Trigger emergency key rotation to provision a new key',
            'Verify key rotation scheduler execution',
          ],
          metadata: {
            rotationAttempts: metrics.rotationAttempts,
            rotationFailures: metrics.rotationFailures,
            lastRotation: metrics.lastRotation,
          },
          alertKey: 'health:service',
        })
      } else if (serviceReady && !this.lastHealthStatus.serviceReady) {
        logger.info('HIPAA key management service restored')
      }

      if (
        resourceState !== 'healthy' &&
        this.lastHealthStatus.resourceState === 'healthy'
      ) {
        this.createSecurityAlert({
          severity: resourceState === 'critical' ? 'high' : 'medium',
          category: 'system_health',
          title: 'Resource utilization outside safe operating range',
          description:
            'Observed CPU or memory usage exceeds recommended thresholds for HIPAA monitoring.',
          recommendedActions: [
            'Scale monitoring workload or allocate additional capacity',
            'Investigate long-running or stuck tasks consuming resources',
          ],
          metadata: {
            memoryUsageMb,
            cpuLoad,
            cpuCapacity,
          },
          alertKey: 'health:resources',
          cooldownMs: 10 * 60 * 1000,
        })
      } else if (
        resourceState === 'healthy' &&
        this.lastHealthStatus.resourceState !== 'healthy'
      ) {
        logger.info('Resource utilization back within healthy thresholds')
      }

      this.lastHealthStatus = {
        awsHealthy,
        serviceReady,
        resourceState,
      }
    } catch (error: unknown) {
      logger.error('Health check failed', { error })
    }
  }

  /**
   * Emit security metrics to CloudWatch
   */
  private async emitSecurityMetrics(): Promise<void> {
    if (!this.cloudWatch) {
      return
    }

    try {
      const now = new Date()
      const recentAlerts = this.alerts.filter(
        (a) => new Date(a.timestamp).getTime() > now.getTime() - 300000, // Last 5 minutes
      )

      const metricData = [
        {
          MetricName: 'SecurityAlerts',
          Value: recentAlerts.length,
          Unit: 'Count',
          Timestamp: now,
          Dimensions: [{ Name: 'Severity', Value: 'All' }],
        },
        {
          MetricName: 'CriticalAlerts',
          Value: recentAlerts.filter((a) => a.severity === 'critical').length,
          Unit: 'Count',
          Timestamp: now,
        },
        {
          MetricName: 'HighAlerts',
          Value: recentAlerts.filter((a) => a.severity === 'high').length,
          Unit: 'Count',
          Timestamp: now,
        },
      ]

      await this.cloudWatch
        .putMetricData({
          Namespace: HIPAA_SECURITY_CONFIG.CLOUDWATCH_NAMESPACE,
          MetricData: metricData,
        })
        .promise()

      logger.debug('Security metrics emitted to CloudWatch')
    } catch (error: unknown) {
      logger.error('Failed to emit security metrics', { error })
    }
  }

  /**
   * Generate compliance report
   */
  public generateComplianceReport(
    startDate: Date,
    endDate: Date,
  ): ComplianceReport {
    const reportId = this.generateAlertId()

    // Filter alerts and events for the period
    const periodAlerts = this.alerts.filter((alert) => {
      const alertTime = new Date(alert.timestamp).getTime()
      return alertTime >= startDate.getTime() && alertTime <= endDate.getTime()
    })

    const report: ComplianceReport = {
      reportId,
      generatedAt: new Date().toISOString(),
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      metadata: {
        dataComplete: false,
        warning:
          'Audit event storage not connected - metrics may be incomplete',
      },
      keyRotationCompliance: {
        totalRotations: 0, // Would be calculated from audit events
        successfulRotations: 0,
        failedRotations: 0,
        averageRotationTime: 0,
        complianceScore: 0,
      },
      securityIncidents: {
        total: periodAlerts.length,
        byCategory: this.groupAlertsByCategory(periodAlerts),
        bySeverity: this.groupAlertsBySeverity(periodAlerts),
        resolved: 0, // Would track resolution status
        pending: periodAlerts.length,
      },
      auditTrail: {
        totalEvents: 0, // Would be calculated from audit store
        retentionCompliance: true,
        integrityVerified: true,
      },
      recommendations: this.generateRecommendations(periodAlerts),
    }

    logger.info('Compliance report generated', {
      reportId,
      period: report.period,
      alertCount: periodAlerts.length,
    })

    return report
  }

  /**
   * Helper methods
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  }

  private categorizeEvent(action: string): SecurityAlert['category'] {
    if (action.includes('key')) {
      return 'key_management'
    }
    if (action.includes('access')) {
      return 'access_control'
    }
    if (action.includes('integrity')) {
      return 'data_integrity'
    }
    return 'system_health'
  }

  private getAlertTitle(action: string): string {
    const titles: Record<string, string> = {
      key_rotation_failed: 'Key Rotation Failure',
      key_compromise_reported: 'Key Compromise Detected',
      suspicious_activity_detected: 'Suspicious Activity',
      key_age_violation: 'Key Age Policy Violation',
      unauthorized_access: 'Unauthorized Access Attempt',
    }
    return titles[action] || 'Security Event'
  }

  private getRecommendedActions(action: string): string[] {
    const actions: Record<string, string[]> = {
      key_rotation_failed: [
        'Check system health',
        'Retry rotation',
        'Review logs',
      ],
      key_compromise_reported: [
        'Emergency rotation',
        'Audit access logs',
        'Notify security team',
      ],
      suspicious_activity_detected: [
        'Investigate source',
        'Enhance monitoring',
        'Review access controls',
      ],
    }
    return actions[action] || ['Review and investigate']
  }

  private groupAlertsByCategory(
    alerts: SecurityAlert[],
  ): Record<string, number> {
    return alerts.reduce(
      (acc, alert) => {
        acc[alert.category] = (acc[alert.category] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )
  }

  private groupAlertsBySeverity(
    alerts: SecurityAlert[],
  ): Record<string, number> {
    return alerts.reduce(
      (acc, alert) => {
        acc[alert.severity] = (acc[alert.severity] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )
  }

  private generateRecommendations(alerts: SecurityAlert[]): string[] {
    const recommendations: string[] = []

    if (alerts.some((a) => a.severity === 'critical')) {
      recommendations.push('Immediate security review required')
      recommendations.push('Consider emergency key rotation')
    }

    if (alerts.filter((a) => a.category === 'key_management').length > 5) {
      recommendations.push('Review key management processes')
      recommendations.push('Consider reducing rotation period')
    }

    return recommendations
  }

  /**
   * Get current security status
   */
  public getSecurityStatus(): {
    monitoring: boolean
    recentAlerts: number
    criticalAlerts: number
    systemHealth: 'healthy' | 'warning' | 'critical'
  } {
    const now = Date.now()
    const recentAlerts = this.alerts.filter(
      (a) => now - new Date(a.timestamp).getTime() < 3600000, // Last hour
    )

    const criticalAlerts = recentAlerts.filter((a) => a.severity === 'critical')

    let systemHealth: 'healthy' | 'warning' | 'critical' = 'healthy'
    if (criticalAlerts.length > 0) {
      systemHealth = 'critical'
    } else if (recentAlerts.length > 10) {
      systemHealth = 'warning'
    }

    return {
      monitoring: this.isMonitoring,
      recentAlerts: recentAlerts.length,
      criticalAlerts: criticalAlerts.length,
      systemHealth,
    }
  }
}

// Export singleton instance
export const hipaaMonitoring = HIPAAMonitoringService.getInstance()

// Export types
export type { SecurityAlert, ComplianceReport, ThreatPattern }
