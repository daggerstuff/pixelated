import { logGovernanceDecision } from '@/lib/audit/log'

import { getLogger } from '../logging'
import type { UnifiedMonitor } from './unified-monitor'

const logger = getLogger('compliance-validator')

export interface ComplianceContext {
  operation: string
  fheActive: boolean
  auditEnabled: boolean
  consentVerified: boolean
  /** Actor performing the operation; when present, the decision is audited. */
  userId?: string
  /** Resource the operation targets; defaults to `operation` when omitted. */
  resourceId?: string
  [key: string]: unknown
}

export interface ComplianceResult {
  compliant: boolean
  reasons: string[]
  timestamp: string
}

export class ComplianceValidator {
  constructor(private readonly monitor?: UnifiedMonitor) {}

  async validate(ctx: ComplianceContext): Promise<ComplianceResult> {
    const reasons: string[] = []

    // HIPAA++ required conditions
    if (!ctx.fheActive) {
      reasons.push('FHE encryption required')
    }
    if (!ctx.auditEnabled) {
      reasons.push('Audit trail required')
    }
    if (!ctx.consentVerified) {
      reasons.push('Consent verification required')
    }

    const compliant = reasons.length === 0

    logger.info(
      `Compliance validation for ${ctx.operation}: ${compliant ? 'PASS' : 'FAIL'}`,
    )
    if (!compliant) {
      logger.warn(`Compliance failures: ${reasons.join(', ')}`)
    }

    // Emit the governance decision to the audit trail. The audit call is
    // fire-and-forget and failures are swallowed so they never break the
    // validation result. Only emit when we know the actor (userId).
    if (ctx.userId) {
      try {
        await logGovernanceDecision(
          ctx.userId,
          ctx.resourceId ?? ctx.operation,
          compliant,
          {
            operation: ctx.operation,
            reasons,
          },
        )
      } catch (err) {
        logger.warn('Failed to emit governance audit event', { error: err })
      }
    }

    // Record the decision to the unified monitor when wired at composition root.
    if (this.monitor) {
      try {
        await this.monitor.record({
          source: 'governance',
          event: compliant ? 'compliance_allow' : 'compliance_failure',
          timestamp: new Date().toISOString(),
          details: { operation: ctx.operation, reasons, userId: ctx.userId },
        })
      } catch (err) {
        logger.warn('Failed to record governance event to monitor', {
          error: err,
        })
      }
    }

    return {
      compliant,
      reasons,
      timestamp: new Date().toISOString(),
    }
  }
}
