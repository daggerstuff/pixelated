/**
 * Human Oversight Types
 * Type definitions for intervention approval queue, manual override, and audit trail
 */

import type { TherapeuticResponse } from '../models/ai-types'
export type { TherapeuticResponse }

/** Oversight mode: supervised (human approval required) or autonomous (AI operates independently) */
export type OversightMode = 'supervised' | 'autonomous'

/** Status of a queued intervention awaiting review */
export type ApprovalStatus =
  'pending' | 'approved' | 'rejected' | 'overridden' | 'expired'

/** Priority of an intervention in the queue */
export type InterventionPriority = 'low' | 'medium' | 'high' | 'critical'

/** A queued AI intervention awaiting human review */
export interface QueuedIntervention {
  /** Unique request ID */
  requestId: string
  /** Session ID this intervention belongs to */
  sessionId: string
  /** AI-generated therapeutic response */
  response: TherapeuticResponse
  /** Input prompt/context that generated this response */
  inputContext: string
  /** Timestamp the intervention was queued */
  queuedAt: string
  /** Timestamp of decision (null if still pending) */
  decidedAt: string | null
  /** Therapist ID who made the decision (null if still pending) */
  decidedBy: string | null
  /** Current approval status */
  status: ApprovalStatus
  /** Priority level */
  priority: InterventionPriority
  /** Reason for rejection or override (if applicable) */
  reason: string | null
  /** Replacement response (for overrides only) */
  replacementResponse: TherapeuticResponse | null
  /** Clinical governance checklist result */
  checklistResult: GovernanceChecklistResult | null
  /** Additional metadata */
  metadata: Record<string, unknown>
}

/** Result of a governance checklist evaluation */
export interface GovernanceChecklistResult {
  /** Whether all items passed */
  passed: boolean
  /** Individual item results */
  items: GovernanceChecklistItem[]
  /** Timestamp of evaluation */
  evaluatedAt: string
  /** Therapist ID who completed the checklist */
  evaluatedBy: string
}

/** A single governance checklist item */
export interface GovernanceChecklistItem {
  /** Item identifier */
  id: string
  /** Human-readable label */
  label: string
  /** Whether this item was satisfied */
  satisfied: boolean
  /** Optional notes from the reviewer */
  notes: string | null
}

/** A manual override action replacing or rejecting an AI response */
export interface ManualOverrideAction {
  /** Unique override ID */
  overrideId: string
  /** Session ID */
  sessionId: string
  /** Original AI response */
  originalResponse: TherapeuticResponse
  /** Replacement response (null if response was rejected without replacement) */
  replacementResponse: TherapeuticResponse | null
  /** Therapist ID performing the override */
  therapistId: string
  /** Timestamp of the override */
  timestamp: string
  /** Reason for the override */
  reason: string
  /** Type of override action */
  action: 'replace' | 'reject'
  /** Additional metadata */
  metadata: Record<string, unknown>
}

/** Audit trail entry for any oversight action */
export interface AuditTrailEntry {
  /** Unique entry ID */
  entryId: string
  /** Type of action */
  actionType:
    'approval' | 'rejection' | 'override' | 'queue' | 'expire' | 'checklist'
  /** Session ID */
  sessionId: string
  /** Request ID (if related to a queued intervention) */
  requestId: string | null
  /** Therapist ID who performed the action */
  therapistId: string
  /** Timestamp */
  timestamp: string
  /** Original response (snapshot at time of action) */
  originalResponse: TherapeuticResponse | null
  /** Replacement or approved response */
  resultingResponse: TherapeuticResponse | null
  /** Reason provided */
  reason: string | null
  /** Governance checklist result (if applicable) */
  checklistResult: GovernanceChecklistResult | null
  /** Additional context */
  metadata: Record<string, unknown>
}

/** Queue statistics */
export interface QueueStats {
  total: number
  pending: number
  approved: number
  rejected: number
  overridden: number
  expired: number
  oldestPendingAge: number | null
}

/** Options for enqueuing an intervention */
export interface EnqueueOptions {
  priority: InterventionPriority
  metadata: Record<string, unknown>
}

/** Options for approving an intervention */
export interface ApproveOptions {
  therapistId: string
  checklistResult: GovernanceChecklistResult
  metadata: Record<string, unknown>
}

/** Options for rejecting an intervention */
export interface RejectOptions {
  therapistId: string
  reason: string
  metadata: Record<string, unknown>
}
