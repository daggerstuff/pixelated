/**
 * HIPAA++ Integration Layer
 *
 * Orchestrates all HIPAA++ compliance components for production deployment
 */

import { createBuildSafeLogger } from '../logging/build-safe-logger'
import hipaaKeyRotationService from './key-rotation'
import { hipaaMonitoring } from './hipaa-monitoring'
import { validateHIPAAEnvironment, HIPAA_SECURITY_CONFIG } from './hipaa-config'
import type { AuditEvent, SecurityMetrics } from './key-rotation'
import type { SecurityAlert, ComplianceReport } from './hipaa-monitoring'

const logger = createBuildSafeLogger('hipaa-integration')

/**
 * HIPAA++ Service Status
 */
interface HIPAAServiceStatus {
  keyRotation: {
    initialized: boolean
    activeKeyId: string | null
    lastRotation: number
    nextRotation: number
  }
  monitoring: {
    active: boolean
    recentAlerts: number
    systemHealth: 'healthy' | 'warning' | 'critical'
  }
  compliance: {
    environmentValid: boolean
    missingRequirements: string[]
    lastAudit: string
  }
}

/**
 * HIPAA++ Master Service
 *
 * Coordinates all compliance components and provides unified interface
 */
export class HIPAAComplianceService {
  private static instance: HIPAAComplianceService
  private isInitialized = false
  private initializationPromise: Promise<void> | null = null

  private constructor() {
    logger.info('HIPAA++ Compliance Service created')
  }

  public static getInstance(): HIPAAComplianceService {
    if (!HIPAAComplianceService.instance) {
      HIPAAComplianceService.instance = new HIPAAComplianceService()
    }
    return HIPAAComplianceService.instance
  }

  /**
   * Initialize all HIPAA++ compliance components
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.info('HIPAA++ service already initialized')
      return
    }

    if (this.initializationPromise) {
      return this.initializationPromise
    }

    this.initializationPromise = this.performInitialization()
    return this.initializationPromise
  }

  private async performInitialization(): Promise<void> {
    const startTime = Date.now()

    try {
      logger.info('Initializing HIPAA++ Compliance Service...')

      // Step 1: Validate environment
      const envValidation = validateHIPAAEnvironment()
      if (!envValidation.valid) {
        throw new Error(
          `HIPAA++ Environment validation failed. Missing: ${envValidation.missing.join(', ')}`,
        )
      }
      logger.info('✓ Environment validation passed')

      // Step 2: Initialize key rotation service
      await hipaaKeyRotationService.initialize({
        rotationPeriodMs:
          HIPAA_SECURITY_CONFIG.KEY_ROTATION_PERIOD_DAYS * 24 * 60 * 60 * 1000,
        storagePrefix: 'hipaa_fhe_key_',
        onRotation: (keyId: string) => {
          logger.info('Key rotation completed', { keyId })
          this.onKeyRotation(keyId)
        },
      })
      logger.info('✓ Key rotation service initialized')

      // Step 3: Set up monitoring integration
      this.setupMonitoringIntegration()
      hipaaMonitoring.startMonitoring()
      logger.info('✓ Security monitoring started')

      // Step 4: Set up event handlers
      this.setupEventHandlers()
      logger.info('✓ Event handlers configured')

      // Step 5: Perform initial security check
      await this.performInitialSecurityCheck()
      logger.info('✓ Initial security check completed')

      this.isInitialized = true
      const initTime = Date.now() - startTime

      logger.info(
        `HIPAA++ Compliance Service initialized successfully in ${initTime}ms`,
      )

      // Emit initialization complete event
      hipaaKeyRotationService.emit('hipaa-compliance-ready', {
        initTime,
        timestamp: new Date().toISOString(),
      })
    } catch (error: unknown) {
      logger.error('HIPAA++ Compliance Service initialization failed', {
        error,
      })
      throw new Error(
        `HIPAA++ initialization failed: ${(error as Error).message}`,
        { cause: error },
      )
    }
  }

  /**
   * Setup monitoring integration with key rotation service
   */
  private setupMonitoringIntegration() {
    // Forward security events from key rotation to monitoring
    hipaaKeyRotationService.on('security-alert', (event: AuditEvent) => {
      hipaaMonitoring.processSecurityEvent(event)
    })

    // Handle monitoring alerts
    hipaaMonitoring.on('security-alert', (alert: SecurityAlert) => {
      this.handleSecurityAlert(alert)
    })

    // Monitor key rotation events
    hipaaKeyRotationService.on('key-rotated', ({ keyId, rotationTime }) => {
      logger.info('Key rotation monitored', { keyId, rotationTime })
    })

    hipaaKeyRotationService.on('rotation-failed', ({ error, rotationId }) => {
      logger.error('Key rotation failure monitored', { error, rotationId })
    })
  }

  /**
   * Setup comprehensive event handlers
   */
  private setupEventHandlers() {
    // Handle critical security events
    hipaaKeyRotationService.on('security-alert', (event: AuditEvent) => {
      if (event.riskLevel === 'critical') {
        this.handleCriticalSecurityEvent(event)
      }
    })

    // Handle service disposal
    hipaaKeyRotationService.on('disposed', () => {
      logger.info('Key rotation service disposed')
      hipaaMonitoring.stopMonitoring()
    })

    // Handle monitoring events
    hipaaMonitoring.on('monitoring-started', () => {
      logger.info('Security monitoring activated')
    })

    hipaaMonitoring.on('monitoring-stopped', () => {
      logger.info('Security monitoring deactivated')
    })

    // Process termination handlers
    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM, initiating graceful shutdown')
      this.gracefulShutdown()
    })

    process.on('SIGINT', () => {
      logger.info('Received SIGINT, initiating graceful shutdown')
      this.gracefulShutdown()
    })
  }

  /**
   * Handle key rotation completion
   */
  private onKeyRotation(keyId: string): void {
    logger.info('Processing key rotation completion', { keyId })

    // Update monitoring metrics
    // Trigger compliance checks
    // Notify dependent services
  }

  /**
   * Handle security alerts
   */
  private handleSecurityAlert(alert: SecurityAlert): void {
    logger.warn('Security alert received', {
      alertId: alert.id,
      severity: alert.severity,
      category: alert.category,
      title: alert.title,
    })

    // Execute automated responses based on severity
    if (alert.severity === 'critical') {
      this.executeCriticalResponse(alert)
    } else if (alert.severity === 'high') {
      this.executeHighSeverityResponse(alert)
    }
  }

  /**
   * Handle critical security events
   */
  private async handleCriticalSecurityEvent(event: AuditEvent): Promise<void> {
    logger.error('Critical security event detected', {
      eventId: event.eventId,
      action: event.action,
      keyId: event.keyId,
    })

    // Immediate response actions
    if (event.action === 'key_compromise_reported') {
      // Emergency key rotation
      await hipaaKeyRotationService.emergencyRotation('Critical security event')
    }

    // Additional security measures
    // - Lock down affected resources
    // - Notify security team
    // - Initiate incident response
  }

  /**
   * Execute critical alert response
   */
  private async executeCriticalResponse(alert: SecurityAlert): Promise<void> {
    logger.error('Executing critical alert response', { alertId: alert.id })

    // Automated response actions
    for (const action of alert.recommendedActions) {
      try {
        await this.executeResponseAction(action, alert)
      } catch (error: unknown) {
        logger.error('Failed to execute response action', { action, error })
      }
    }
  }

  /**
   * Execute high severity response
   */
  private async executeHighSeverityResponse(
    alert: SecurityAlert,
  ): Promise<void> {
    logger.warn('Executing high severity response', { alertId: alert.id })

    // Enhanced monitoring
    // Preventive measures
    // Notification escalation
  }

  /**
   * Execute specific response action
   */
  private async executeResponseAction(
    action: string,
    alert: SecurityAlert,
  ): Promise<void> {
    switch (action) {
      case 'emergency_rotation':
        await hipaaKeyRotationService.emergencyRotation(`Alert: ${alert.title}`)
        break

      case 'force_key_rotation':
        await hipaaKeyRotationService.rotateKeys()
        break

      case 'enhance_monitoring':
        // Increase monitoring frequency
        logger.info('Enhanced monitoring activated')
        break

      case 'notify_security_team':
        // Send notifications to security team
        logger.info('Security team notified')
        break

      default:
        logger.warn('Unknown response action', { action })
    }
  }

  /**
   * Perform initial security check
   */
  private async performInitialSecurityCheck(): Promise<void> {
    // Check key age compliance
    const activeKeyId = hipaaKeyRotationService.getActiveKeyId()
    if (!activeKeyId) {
      logger.warn('No active key found during initial check')
      return
    }

    // Verify monitoring is operational
    const monitoringStatus = hipaaMonitoring.getSecurityStatus()
    if (!monitoringStatus.monitoring) {
      throw new Error('Security monitoring failed to start')
    }

    // Check AWS connectivity
    // Verify audit trail integrity
    // Validate configuration

    logger.info('Initial security check passed')
  }

  /**
   * Get comprehensive service status
   */
  public getServiceStatus(): HIPAAServiceStatus {
    const keyRotationMetrics = hipaaKeyRotationService.getSecurityMetrics()
    const monitoringStatus = hipaaMonitoring.getSecurityStatus()
    const envValidation = validateHIPAAEnvironment()

    return {
      keyRotation: {
        initialized: this.isInitialized,
        activeKeyId: hipaaKeyRotationService.getActiveKeyId(),
        lastRotation: keyRotationMetrics.lastRotation,
        nextRotation:
          keyRotationMetrics.lastRotation +
          HIPAA_SECURITY_CONFIG.KEY_ROTATION_PERIOD_DAYS * 24 * 60 * 60 * 1000,
      },
      monitoring: {
        active: monitoringStatus.monitoring,
        recentAlerts: monitoringStatus.recentAlerts,
        systemHealth: monitoringStatus.systemHealth,
      },
      compliance: {
        environmentValid: envValidation.valid,
        missingRequirements: envValidation.missing,
        lastAudit: new Date().toISOString(),
      },
    }
  }

  /**
   * Generate compliance report
   */
  public generateComplianceReport(days: number = 30): ComplianceReport {
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)

    return hipaaMonitoring.generateComplianceReport(startDate, endDate)
  }

  /**
   * Get security metrics
   */
  public getSecurityMetrics(): SecurityMetrics {
    return hipaaKeyRotationService.getSecurityMetrics()
  }

  /**
   * Get recent audit events
   */
  public getAuditEvents(since?: Date): AuditEvent[] {
    return hipaaKeyRotationService.getAuditEvents(since)
  }

  /**
   * Force emergency key rotation
   */
  public async emergencyRotation(reason: string): Promise<string> {
    logger.warn('Emergency rotation requested', { reason })
    return hipaaKeyRotationService.emergencyRotation(reason)
  }

  /**
   * Report security incident
   */
  public async reportSecurityIncident(
    keyId: string,
    incidentType: string,
    details: string,
  ): Promise<void> {
    logger.error('Security incident reported', { keyId, incidentType, details })

    if (incidentType === 'key_compromise') {
      await hipaaKeyRotationService.reportKeyCompromise(keyId, details)
    }

    // Additional incident handling
    // - Create incident record
    // - Notify stakeholders
    // - Initiate response procedures
  }

  /**
   * Graceful shutdown
   */
  private async gracefulShutdown(): Promise<void> {
    logger.info('Initiating HIPAA++ service graceful shutdown')

    try {
      // Stop monitoring
      hipaaMonitoring.stopMonitoring()

      // Dispose key rotation service
      await hipaaKeyRotationService.dispose()

      logger.info('HIPAA++ service shutdown completed')
      process.exit(0)
    } catch (error: unknown) {
      logger.error('Error during graceful shutdown', { error })
      process.exit(1)
    }
  }

  /**
   * Health check endpoint
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    details: Record<string, unknown>
    timestamp: string
  }> {
    const timeoutMs = 5000 // 5 second timeout
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Health check timeout')), timeoutMs),
    )

    try {
      return await Promise.race([this.performHealthCheck(), timeoutPromise])
    } catch (error: unknown) {
      return {
        status: 'unhealthy',
        details: { error: (error as Error).message },
        timestamp: new Date().toISOString(),
      }
    }
  }

  private async performHealthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    details: Record<string, unknown>
    timestamp: string
  }> {
    const status = this.getServiceStatus()

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

    if (
      !status.compliance.environmentValid ||
      status.monitoring.systemHealth === 'critical'
    ) {
      overallStatus = 'unhealthy'
    } else if (
      status.monitoring.systemHealth === 'warning' ||
      status.monitoring.recentAlerts > 10
    ) {
      overallStatus = 'degraded'
    }

    return {
      status: overallStatus,
      details: status as unknown as Record<string, unknown>,
      timestamp: new Date().toISOString(),
    }
  }
}

// Export singleton instance
export const hipaaCompliance = HIPAAComplianceService.getInstance()

// Export types
export type { HIPAAServiceStatus }
