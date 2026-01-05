/**
 * Data Loss Prevention (DLP) Service
 *
 * Prevents unauthorized transmission or exfiltration of sensitive PHI/PII data.
 * Integrates with PHI detection to scan content before transmission.
 */

import { detectAndRedactPHI } from './phiDetection'
import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { AuditEventType, logAuditEvent, type AuditDetails } from '../audit'

const logger = createBuildSafeLogger('dlp-service')

// Simple class to wrap audit logging functionality
class AuditLogger {
  log({
    type,
    userId,
    data,
  }: {
    type: AuditEventType
    userId: string
    action: string
    data?: Record<string, unknown>
    severity?: string
  }) {
    logAuditEvent(type, 'dlp', userId, 'security', data as AuditDetails)
  }
}

const auditLogger = new AuditLogger()

/**
 * DLP policy levels determining how to handle detected sensitive data
 */
export enum DLPAction {
  /** Allow transmission with logging */
  ALLOW = 'allow',
  /** Allow transmission after redaction */
  REDACT = 'redact',
  /** Block transmission and log as security event */
  BLOCK = 'block',
  /** Block transmission and alert security team */
  BLOCK_AND_ALERT = 'block_and_alert',
}

/**
 * Configuration for a DLP rule
 */
export interface DLPRule {
  /** Unique rule identifier */
  id: string
  /** Human readable name */
  name: string
  /** Rule description */
  description: string
  /** What action to take when rule is triggered */
  action: DLPAction
  /** Whether this rule is currently active */
  isActive: boolean
  /** Function determining if a piece of content matches this rule */
  matches: (content: string, metadata?: Record<string, unknown>) => boolean
  /** Optional custom redaction function */
  redact?: (content: string) => string
}

/**
 * Result of a DLP policy check
 */
export interface DLPResult {
  /** Whether the content is allowed to be transmitted */
  allowed: boolean
  /** If not allowed, the reason for blocking */
  reason?: string
  /** If redaction was applied, the redacted content */
  redactedContent?: string
  /** IDs of the triggered rules */
  triggeredRules: string[]
}

/**
 * Data Loss Prevention service to control data exfiltration
 */
export class DLPService {
  processSensitiveContent(
    _dataStr: string,
    _arg1: { action: string; contentType: string; preserveFormat: boolean },
  ) {
    throw new Error('Method not implemented.')
  }
  private rules: DLPRule[] = []

  constructor() {
    // Initialize with default rules
    this.addDefaultRules()
  }

  /**
   * Add built-in default rules
   */
  private addDefaultRules() {
    // Rule to detect and redact PHI/PII
    this.addRule({
      id: 'phi-detection',
      name: 'PHI/PII Detection',
      description: 'Detects and redacts PHI/PII in outgoing content',
      action: DLPAction.REDACT,
      isActive: true,
      matches: (content) => {
        // If the redacted version differs from original, PHI was found
        return detectAndRedactPHI(content) !== content
      },
      redact: (content) => detectAndRedactPHI(content),
    })

    // Rule to prevent large data dumps that might contain excessive PHI
    this.addRule({
      id: 'large-data-volume',
      name: 'Large Data Volume Protection',
      description:
        'Prevents large volumes of data export that might contain PHI',
      action: DLPAction.BLOCK,
      isActive: true,
      matches: (content, metadata) => {
        const maxSize = 100 * 1024 // 100KB default threshold
        const dataSize = (metadata?.['dataSize'] as number) || content.length
        return dataSize > maxSize && this.containsPotentialPHI(content)
      },
    })
  }

  /**
   * Add a DLP rule to the service
   * @param rule Rule configuration
   */
  addRule(rule: DLPRule): void {
    const existingIndex = this.rules.findIndex((r) => r.id === rule.id)
    if (existingIndex >= 0) {
      this.rules[existingIndex] = rule
    } else {
      this.rules.push(rule)
    }
    logger.info(`DLP rule added: ${rule.id} - ${rule.name}`)
  }

  /**
   * Remove a DLP rule by ID
   * @param ruleId Rule ID to remove
   */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter((rule) => rule.id !== ruleId)
    logger.info(`DLP rule removed: ${ruleId}`)
  }

  /**
   * Alias for removeRule
   * @param ruleId Rule ID to delete
   */
  deleteRule(ruleId: string): void {
    this.removeRule(ruleId)
  }

  /**
   * Get all DLP rules
   * @returns Array of all DLP rules
   */
  getRules(): DLPRule[] {
    return [...this.rules] // Return a copy to prevent external modification
  }

  /**
   * Check if content contains any potential PHI
   * @param content Content to check
   * @returns True if the content might contain PHI
   */
  private containsPotentialPHI(content: string): boolean {
    // Simple check for common PHI patterns
    return detectAndRedactPHI(content) !== content
  }

  /**
   * Scan content against all active DLP rules
   * @param content Content to scan
   * @param context Additional context about the transmission
   * @returns Result of DLP policy check
   */
  scanContent(
    content: string,
    context: {
      userId: string
      action: string
      destination?: string
      metadata?: Record<string, unknown>
    },
  ): DLPResult {
    const activeRules = this.rules.filter((rule) => rule.isActive)
    const triggeredRules: DLPRule[] = []
    let currentContent = content
    let allowed = true
    let reason = ''

    // First pass: identify all triggered rules
    for (const rule of activeRules) {
      if (rule.matches(content, context.metadata)) {
        triggeredRules.push(rule)

        // Find the most restrictive action
        if (
          rule.action === DLPAction.BLOCK ||
          rule.action === DLPAction.BLOCK_AND_ALERT
        ) {
          allowed = false
          reason = `Blocked by DLP rule: ${rule.name}`
        }
      }
    }

    // Second pass: apply redactions if needed
    if (
      allowed &&
      triggeredRules.some((rule) => rule.action === DLPAction.REDACT)
    ) {
      // Apply redactions from all matching rules
      for (const rule of triggeredRules) {
        if (rule.action === DLPAction.REDACT && rule.redact) {
          currentContent = rule.redact(currentContent)
        }
      }
    }

    // Log the DLP event
    this.logDLPEvent({
      userId: context.userId,
      action: context.action,
      allowed,
      triggeredRules: triggeredRules.map((r) => r.id),
      reason,
      destination: context.destination,
    })

    // Generate alerts for high-severity blocks
    if (
      !allowed &&
      triggeredRules.some((rule) => rule.action === DLPAction.BLOCK_AND_ALERT)
    ) {
      this.generateSecurityAlert({
        userId: context.userId,
        action: context.action,
        destination: context.destination,
        triggeredRules: triggeredRules
          .filter((r) => r.action === DLPAction.BLOCK_AND_ALERT)
          .map((r) => r.id),
      })
    }

    return {
      allowed,
      reason: allowed ? undefined : reason,
      redactedContent:
        allowed && currentContent !== content ? currentContent : undefined,
      triggeredRules: triggeredRules.map((rule) => rule.id),
    }
  }

  /**
   * Log a DLP event for audit purposes
   */
  private logDLPEvent(event: {
    userId: string
    action: string
    allowed: boolean
    triggeredRules: string[]
    reason?: string | undefined
    destination?: string | undefined
  }): void {
    // Log to application logs
    logger.info(
      `DLP ${event.allowed ? 'allowed' : 'blocked'} ${event.action}`,
      {
        userId: event.userId,
        action: event.action,
        allowed: event.allowed,
        triggeredRules: event.triggeredRules,
        reason: event.reason,
        destination: event.destination,
      },
    )

    // Log to audit trail
    auditLogger.log({
      type: event.allowed
        ? AuditEventType.DLP_ALLOWED
        : AuditEventType.DLP_BLOCKED,
      userId: event.userId,
      action: event.action,
      data: {
        triggeredRules: event.triggeredRules,
        reason: event.reason,
        destination: event.destination,
      },
    })
  }

  /**
   * Generate a security alert for a blocked DLP event
   */
  private generateSecurityAlert(event: {
    userId: string
    action: string
    destination?: string | undefined
    triggeredRules: string[]
  }): void {
    logger.warn('DLP security alert generated', {
      userId: event.userId,
      action: event.action,
      destination: event.destination,
      triggeredRules: event.triggeredRules,
    })

    // In a real implementation, this would send alerts through
    // notification systems, security incident management, etc.
    // For now, we just log it as a serious security event
    auditLogger.log({
      type: AuditEventType.SECURITY_ALERT,
      severity: 'high',
      userId: event.userId,
      action: 'dlp_violation',
      data: {
        action: event.action,
        destination: event.destination,
        triggeredRules: event.triggeredRules,
      },
    })
  }
}

// Export singleton instance
export const dlpService = new DLPService()
