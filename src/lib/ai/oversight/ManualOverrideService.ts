/**
 * Manual Override Service
 * Allows therapists to reject or replace AI responses mid-session
 * Captures full audit trail for every override action
 */

import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import { getAuditTrailService } from './audit-trail'
import type { ManualOverrideAction, TherapeuticResponse } from './types'

const logger = createBuildSafeLogger('ManualOverrideService')

class ManualOverrideService {
  private overrides: ManualOverrideAction[] = []
  private maxOverrides = 10000

  private generateOverrideId(): string {
    return `override-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  /** Replace an AI response with a new one mid-session */
  replaceResponse(
    sessionId: string,
    originalResponse: TherapeuticResponse,
    replacementResponse: TherapeuticResponse,
    therapistId: string,
    reason: string,
    metadata: Record<string, unknown> = {},
  ): ManualOverrideAction {
    const action: ManualOverrideAction = {
      overrideId: this.generateOverrideId(),
      sessionId,
      originalResponse,
      replacementResponse,
      therapistId,
      timestamp: new Date().toISOString(),
      reason,
      action: 'replace',
      metadata,
    }

    this.overrides.push(action)
    if (this.overrides.length > this.maxOverrides) {
      this.overrides.shift()
    }

    getAuditTrailService().logOverride(action)

    logger.info('Response replaced', {
      overrideId: action.overrideId,
      sessionId,
      therapistId,
      reason,
    })

    return action
  }

  /** Reject an AI response without providing a replacement */
  rejectResponse(
    sessionId: string,
    originalResponse: TherapeuticResponse,
    therapistId: string,
    reason: string,
    metadata: Record<string, unknown> = {},
  ): ManualOverrideAction {
    const action: ManualOverrideAction = {
      overrideId: this.generateOverrideId(),
      sessionId,
      originalResponse,
      replacementResponse: null,
      therapistId,
      timestamp: new Date().toISOString(),
      reason,
      action: 'reject',
      metadata,
    }

    this.overrides.push(action)
    if (this.overrides.length > this.maxOverrides) {
      this.overrides.shift()
    }

    getAuditTrailService().logOverride(action)

    logger.info('Response rejected', {
      overrideId: action.overrideId,
      sessionId,
      therapistId,
      reason,
    })

    return action
  }

  /** Get all override actions for a session */
  getSessionOverrides(sessionId: string): ManualOverrideAction[] {
    return this.overrides.filter((o) => o.sessionId === sessionId)
  }

  /** Get all override actions by a therapist */
  getTherapistOverrides(therapistId: string): ManualOverrideAction[] {
    return this.overrides.filter((o) => o.therapistId === therapistId)
  }

  /** Get all override actions */
  getAllOverrides(): ManualOverrideAction[] {
    return [...this.overrides]
  }

  /** Get recent overrides */
  getRecent(limit = 50): ManualOverrideAction[] {
    return [...this.overrides].slice(-limit).reverse()
  }

  /** Clear all overrides (for testing) */
  reset(): void {
    this.overrides = []
  }
}

const manualOverrideInstance = new ManualOverrideService()

export function getManualOverrideService(): ManualOverrideService {
  return manualOverrideInstance
}

export function resetManualOverrideService(): void {
  manualOverrideInstance.reset()
}

export { ManualOverrideService }
