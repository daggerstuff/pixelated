/**
 * Audit Trail Service for Human Oversight
 * Records all intervention approval, rejection, override, and governance actions
 */

import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import type {
  AuditTrailEntry,
  GovernanceChecklistResult,
  QueuedIntervention,
  ManualOverrideAction,
  TherapeuticResponse,
} from './types'

const logger = createBuildSafeLogger('OversightAuditTrail')

class AuditTrailService {
  private entries: AuditTrailEntry[] = []
  private readonly maxEntries = 10000

  private generateId(): string {
    return `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  /** Log an intervention approval */
  logApproval(
    intervention: QueuedIntervention,
    therapistId: string,
    checklistResult: GovernanceChecklistResult,
  ): AuditTrailEntry {
    const entry: AuditTrailEntry = {
      entryId: this.generateId(),
      actionType: 'approval',
      sessionId: intervention.sessionId,
      requestId: intervention.requestId,
      therapistId,
      timestamp: new Date().toISOString(),
      originalResponse: intervention.response,
      resultingResponse: intervention.response,
      reason: null,
      checklistResult,
      metadata: { ...intervention.metadata, priority: intervention.priority },
    }

    this.addEntry(entry)
    logger.info('Intervention approved', {
      requestId: intervention.requestId,
      sessionId: intervention.sessionId,
      therapistId,
      checklistPassed: checklistResult.passed,
    })

    return entry
  }

  /** Log an intervention rejection */
  logRejection(
    intervention: QueuedIntervention,
    therapistId: string,
    reason: string,
  ): AuditTrailEntry {
    const entry: AuditTrailEntry = {
      entryId: this.generateId(),
      actionType: 'rejection',
      sessionId: intervention.sessionId,
      requestId: intervention.requestId,
      therapistId,
      timestamp: new Date().toISOString(),
      originalResponse: intervention.response,
      resultingResponse: null,
      reason,
      checklistResult: null,
      metadata: { ...intervention.metadata },
    }

    this.addEntry(entry)
    logger.info('Intervention rejected', {
      requestId: intervention.requestId,
      sessionId: intervention.sessionId,
      therapistId,
      reason,
    })

    return entry
  }

  /** Log a manual override (replace or reject) */
  logOverride(action: ManualOverrideAction): AuditTrailEntry {
    const entry: AuditTrailEntry = {
      entryId: this.generateId(),
      actionType: 'override',
      sessionId: action.sessionId,
      requestId: null,
      therapistId: action.therapistId,
      timestamp: action.timestamp,
      originalResponse: action.originalResponse,
      resultingResponse: action.replacementResponse,
      reason: action.reason,
      checklistResult: null,
      metadata: { overrideAction: action.action, ...action.metadata },
    }

    this.addEntry(entry)
    logger.info('Manual override performed', {
      overrideId: action.overrideId,
      sessionId: action.sessionId,
      therapistId: action.therapistId,
      action: action.action,
      reason: action.reason,
    })

    return entry
  }

  /** Log an intervention being queued */
  logQueue(intervention: QueuedIntervention): AuditTrailEntry {
    const entry: AuditTrailEntry = {
      entryId: this.generateId(),
      actionType: 'queue',
      sessionId: intervention.sessionId,
      requestId: intervention.requestId,
      therapistId: 'system',
      timestamp: intervention.queuedAt,
      originalResponse: null,
      resultingResponse: intervention.response,
      reason: null,
      checklistResult: null,
      metadata: { priority: intervention.priority, ...intervention.metadata },
    }

    this.addEntry(entry)
    logger.debug('Intervention queued', {
      requestId: intervention.requestId,
      sessionId: intervention.sessionId,
      priority: intervention.priority,
    })

    return entry
  }

  /** Log an intervention expiring without decision */
  logExpiration(intervention: QueuedIntervention): AuditTrailEntry {
    const entry: AuditTrailEntry = {
      entryId: this.generateId(),
      actionType: 'expire',
      sessionId: intervention.sessionId,
      requestId: intervention.requestId,
      therapistId: 'system',
      timestamp: new Date().toISOString(),
      originalResponse: intervention.response,
      resultingResponse: null,
      reason: 'Intervention expired without human review',
      checklistResult: null,
      metadata: { queuedAt: intervention.queuedAt, ...intervention.metadata },
    }

    this.addEntry(entry)
    logger.warn('Intervention expired without review', {
      requestId: intervention.requestId,
      sessionId: intervention.sessionId,
    })

    return entry
  }

  /** Log a governance checklist completion */
  logChecklist(
    intervention: QueuedIntervention,
    checklistResult: GovernanceChecklistResult,
  ): AuditTrailEntry {
    const entry: AuditTrailEntry = {
      entryId: this.generateId(),
      actionType: 'checklist',
      sessionId: intervention.sessionId,
      requestId: intervention.requestId,
      therapistId: checklistResult.evaluatedBy,
      timestamp: checklistResult.evaluatedAt,
      originalResponse: intervention.response,
      resultingResponse: null,
      reason: null,
      checklistResult,
      metadata: { passed: checklistResult.passed },
    }

    this.addEntry(entry)
    logger.debug('Governance checklist completed', {
      requestId: intervention.requestId,
      passed: checklistResult.passed,
    })

    return entry
  }

  /** Get all audit entries for a session */
  getSessionEntries(sessionId: string): AuditTrailEntry[] {
    return this.entries.filter((e) => e.sessionId === sessionId)
  }

  /** Get all audit entries for a request */
  getRequestEntries(requestId: string): AuditTrailEntry[] {
    return this.entries.filter((e) => e.requestId === requestId)
  }

  /** Get all entries (for admin views) */
  getAllEntries(): AuditTrailEntry[] {
    return [...this.entries]
  }

  /** Get entries by action type */
  getByActionType(
    actionType: AuditTrailEntry['actionType'],
  ): AuditTrailEntry[] {
    return this.entries.filter((e) => e.actionType === actionType)
  }

  /** Get recent entries */
  getRecent(limit = 50): AuditTrailEntry[] {
    return [...this.entries].slice(-limit).reverse()
  }

  /** Clear all entries (for testing) */
  reset(): void {
    this.entries = []
  }

  private addEntry(entry: AuditTrailEntry): void {
    this.entries.push(entry)
    if (this.entries.length > this.maxEntries) {
      this.entries.shift()
    }
  }
}

const auditTrailService = new AuditTrailService()

export function getAuditTrailService(): AuditTrailService {
  return auditTrailService
}

export function resetAuditTrailService(): void {
  auditTrailService.reset()
}

export { AuditTrailService }
