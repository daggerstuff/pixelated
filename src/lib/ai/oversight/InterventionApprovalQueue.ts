/**
 * Intervention Approval Queue
 * Queues AI-generated therapeutic responses for human review before delivery
 * In supervised mode, all AI responses must pass through this queue
 */

import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import { getAuditTrailService } from './audit-trail'
import type {
  ApprovalStatus,
  ApproveOptions,
  EnqueueOptions,
  InterventionPriority,
  QueuedIntervention,
  QueueStats,
  RejectOptions,
  TherapeuticResponse,
  GovernanceChecklistResult,
} from './types'

const logger = createBuildSafeLogger('InterventionApprovalQueue')

/** Default timeout for pending interventions (30 minutes) */
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000

class InterventionApprovalQueue {
  private queue: Map<string, QueuedIntervention> = new Map()
  private order: string[] = []
  private timeoutMs: number = DEFAULT_TIMEOUT_MS
  private expiredIds: Set<string> = new Set()

  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  /** Add an AI response to the approval queue */
  enqueue(
    sessionId: string,
    response: TherapeuticResponse,
    inputContext: string,
    options: EnqueueOptions,
  ): QueuedIntervention {
    const requestId = this.generateRequestId()

    const intervention: QueuedIntervention = {
      requestId,
      sessionId,
      response,
      inputContext,
      queuedAt: new Date().toISOString(),
      decidedAt: null,
      decidedBy: null,
      status: 'pending',
      priority: options.priority,
      reason: null,
      replacementResponse: null,
      checklistResult: null,
      metadata: { ...options.metadata },
    }

    this.queue.set(requestId, intervention)
    this.order.push(requestId)

    getAuditTrailService().logQueue(intervention)

    logger.info('Intervention queued for review', {
      requestId,
      sessionId,
      priority: options.priority,
    })

    return intervention
  }

  /** Approve a queued intervention */
  approve(requestId: string, options: ApproveOptions): QueuedIntervention {
    const intervention = this.queue.get(requestId)

    if (!intervention) {
      throw new Error(`Intervention not found: ${requestId}`)
    }

    if (intervention.status !== 'pending') {
      throw new Error(
        `Cannot approve intervention with status ${intervention.status}`,
      )
    }

    if (!options.checklistResult.passed) {
      throw new Error('Cannot approve: governance checklist did not pass')
    }

    intervention.status = 'approved'
    intervention.decidedAt = new Date().toISOString()
    intervention.decidedBy = options.therapistId
    intervention.checklistResult = options.checklistResult
    intervention.metadata = {
      ...intervention.metadata,
      ...options.metadata,
    }

    getAuditTrailService().logApproval(
      intervention,
      options.therapistId,
      options.checklistResult,
    )

    logger.info('Intervention approved', {
      requestId,
      therapistId: options.therapistId,
    })

    return intervention
  }

  /** Reject a queued intervention */
  reject(requestId: string, options: RejectOptions): QueuedIntervention {
    const intervention = this.queue.get(requestId)

    if (!intervention) {
      throw new Error(`Intervention not found: ${requestId}`)
    }

    if (intervention.status !== 'pending') {
      throw new Error(
        `Cannot reject intervention with status ${intervention.status}`,
      )
    }

    intervention.status = 'rejected'
    intervention.decidedAt = new Date().toISOString()
    intervention.decidedBy = options.therapistId
    intervention.reason = options.reason
    intervention.metadata = {
      ...intervention.metadata,
      ...options.metadata,
    }

    getAuditTrailService().logRejection(
      intervention,
      options.therapistId,
      options.reason,
    )

    logger.info('Intervention rejected', {
      requestId,
      therapistId: options.therapistId,
      reason: options.reason,
    })

    return intervention
  }

  /** Override a queued intervention with a replacement response */
  override(
    requestId: string,
    therapistId: string,
    replacementResponse: TherapeuticResponse,
    reason: string,
  ): QueuedIntervention {
    const intervention = this.queue.get(requestId)

    if (!intervention) {
      throw new Error(`Intervention not found: ${requestId}`)
    }

    if (intervention.status !== 'pending') {
      throw new Error(
        `Cannot override intervention with status ${intervention.status}`,
      )
    }

    intervention.status = 'overridden'
    intervention.decidedAt = new Date().toISOString()
    intervention.decidedBy = therapistId
    intervention.replacementResponse = replacementResponse
    intervention.reason = reason

    getAuditTrailService().logOverride({
      overrideId: `override-${requestId}`,
      sessionId: intervention.sessionId,
      originalResponse: intervention.response,
      replacementResponse,
      therapistId,
      timestamp: intervention.decidedAt,
      reason,
      action: 'replace',
      metadata: { ...intervention.metadata },
    })

    logger.info('Intervention overridden', {
      requestId,
      therapistId,
      reason,
    })

    return intervention
  }

  /** Get a specific intervention by ID */
  getById(requestId: string): QueuedIntervention | null {
    return this.queue.get(requestId) ?? null
  }

  /** Get all pending interventions, sorted by priority then age */
  getPending(): QueuedIntervention[] {
    const priorityOrder: Record<InterventionPriority, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    }

    return this.order
      .map((id) => this.queue.get(id))
      .filter(
        (item): item is QueuedIntervention =>
          item !== undefined && item.status === 'pending',
      )
      .sort((a, b) => {
        const priorityDiff =
          priorityOrder[b.priority] - priorityOrder[a.priority]
        return priorityDiff !== 0
          ? priorityDiff
          : a.queuedAt.localeCompare(b.queuedAt)
      })
  }

  /** Get all interventions for a session */
  getBySession(sessionId: string): QueuedIntervention[] {
    return this.order
      .map((id) => this.queue.get(id))
      .filter(
        (item): item is QueuedIntervention =>
          item !== undefined && item.sessionId === sessionId,
      )
  }

  /** Get all interventions */
  getAll(): QueuedIntervention[] {
    return this.order
      .map((id) => this.queue.get(id))
      .filter((item): item is QueuedIntervention => item !== undefined)
  }

  /** Get queue statistics */
  getStats(): QueueStats {
    const items = Array.from(this.queue.values())
    const pending = items.filter((i) => i.status === 'pending')
    const oldestPending = pending
      .map((i) => Date.now() - new Date(i.queuedAt).getTime())
      .sort((a, b) => b - a)[0]

    return {
      total: items.length,
      pending: pending.length,
      approved: items.filter((i) => i.status === 'approved').length,
      rejected: items.filter((i) => i.status === 'rejected').length,
      overridden: items.filter((i) => i.status === 'overridden').length,
      expired: items.filter((i) => i.status === 'expired').length,
      oldestPendingAge: oldestPending ?? null,
    }
  }

  /** Expire pending interventions that have exceeded the timeout */
  expireStale(): number {
    const now = Date.now()
    let expired = 0

    for (const intervention of this.queue.values()) {
      if (
        intervention.status === 'pending' &&
        !this.expiredIds.has(intervention.requestId)
      ) {
        const age = now - new Date(intervention.queuedAt).getTime()
        if (age > this.timeoutMs) {
          intervention.status = 'expired'
          intervention.decidedAt = new Date().toISOString()
          intervention.decidedBy = 'system'
          intervention.reason = 'Timed out awaiting human review'
          getAuditTrailService().logExpiration(intervention)
          this.expiredIds.add(intervention.requestId)
          expired++
        }
      }
    }

    if (expired > 0) {
      logger.warn(`${expired} interventions expired`, { expired })
    }

    return expired
  }

  /** Set the timeout for pending interventions */
  setTimeout(timeoutMs: number): void {
    this.timeoutMs = timeoutMs
  }

  /** Clear all interventions (for testing) */
  reset(): void {
    this.queue.clear()
    this.order = []
    this.expiredIds.clear()
  }

  /** Get the current timeout setting */
  getTimeout(): number {
    return this.timeoutMs
  }
}

const queueInstance = new InterventionApprovalQueue()

export function getInterventionApprovalQueue(): InterventionApprovalQueue {
  return queueInstance
}

export function resetInterventionApprovalQueue(): void {
  queueInstance.reset()
}

export { InterventionApprovalQueue }
