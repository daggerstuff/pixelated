/**
 * HIPAA Audit Report Generator
 *
 * Collects PHI access events, PHI modification events, and break-glass
 * events from the audit chain, verifies chain integrity, and produces
 * a HIPAAAuditReport.
 */

import type {
  ReportPeriod,
  ChainVerificationResult,
  HIPAAAuditReport,
  PHIAccessEvent,
  PHIModificationEvent,
  BreakGlassEvent,
  HIPAAAuditSummary,
} from './types'

import { AuditEventType } from '@/lib/audit/events'
import type { AuditEvent } from '@/lib/audit/events'
import { queryAuditEvents } from './report-generator'

// ---------------------------------------------------------------------------
// Event classification helpers
// ---------------------------------------------------------------------------

/** Actions that represent PHI access (read-type actions) */
const PHI_ACCESS_ACTIONS = new Set([
  'patient_view',
  'patient_record_access',
  'record_view',
  'read_patient',
  'ehr_patient_view',
  'encounter_view',
  'consent_view',
  'record_export',
  'export_phi',
])

/** Actions that represent PHI modifications (write-type actions) */
const PHI_MODIFICATION_ACTIONS = new Set([
  'patient_create',
  'patient_update',
  'patient_delete',
  'record_create',
  'record_update',
  'record_delete',
  'encounter_create',
  'encounter_update',
  'encounter_delete',
  'consent_create',
  'consent_update',
  'consent_revoke',
])

/** Actions related to break-glass access */
const BREAK_GLASS_ACTIONS = new Set([
  'break_glass',
  'break_glass_activate',
  'break_glass_access',
])

/**
 * Check if an action falls into the given set, case-insensitively.
 */
function actionMatches(action: string, set: Set<string>): boolean {
  const lower = action.toLowerCase()
  // Direct match
  if (set.has(lower)) return true
  // Partial match (action contains a known PHI access verb)
  for (const s of set) {
    if (lower.includes(s)) return true
  }
  return false
}

/**
 * Check whether an event is a PHI access event.
 * Uses action + resource type heuristics.
 */
function isPhiAccess(event: AuditEvent): boolean {
  if (actionMatches(String(event.action), PHI_ACCESS_ACTIONS)) return true
  // Any successful access to a patient-linked resource is PHI access
  if (
    event.metadata &&
    typeof event.metadata === 'object' &&
    'patientId' in event.metadata &&
    event.metadata.patientId
  ) {
    return event.type === AuditEventType.ACCESS
  }
  return false
}

/**
 * Check whether an event is a PHI modification event.
 */
function isPhiModification(event: AuditEvent): boolean {
  return actionMatches(String(event.action), PHI_MODIFICATION_ACTIONS)
}

/**
 * Check whether an event is a break-glass event.
 */
function isBreakGlass(event: AuditEvent): boolean {
  if (actionMatches(String(event.action), BREAK_GLASS_ACTIONS)) return true
  if (
    event.metadata &&
    typeof event.metadata === 'object' &&
    'breakGlass' in event.metadata &&
    event.metadata.breakGlass === true
  ) {
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Event mapping
// ---------------------------------------------------------------------------

function mapToPHIAccessEvent(event: AuditEvent): PHIAccessEvent {
  const meta = event.metadata as Record<string, unknown> | undefined
  return {
    eventId: event.id,
    timestamp: event.timestamp,
    userId: event.userId,
    action: String(event.action),
    resourceType: event.resourceType ?? String(meta?.resourceType ?? ''),
    resourceId: event.resourceId ?? String(meta?.resourceId ?? ''),
    patientId: meta?.patientId ? String(meta.patientId) : undefined,
    severity: String(event.severity),
    status: event.status,
    ipAddress: event.ipAddress,
    userAgent: event.userAgent,
    hash: event.hash,
  }
}

function mapToPHIModificationEvent(event: AuditEvent): PHIModificationEvent {
  return {
    eventId: event.id,
    timestamp: event.timestamp,
    userId: event.userId,
    action: String(event.action),
    resourceType: event.resourceType ?? '',
    resourceId: event.resourceId ?? '',
    previousHash: event.previousHash,
    hash: event.hash,
    status: event.status,
  }
}

function mapToBreakGlassEvent(event: AuditEvent): BreakGlassEvent {
  const meta = event.metadata as Record<string, unknown> | undefined
  return {
    eventId: event.id,
    timestamp: event.timestamp,
    userId: event.userId,
    reason: String(meta?.breakGlassReason ?? 'Not specified'),
    resourceType: event.resourceType ?? '',
    resourceId: event.resourceId ?? '',
    severity: String(event.severity),
  }
}

// ---------------------------------------------------------------------------
// Summary builder
// ---------------------------------------------------------------------------

function buildSummary(
  accessEvents: PHIAccessEvent[],
  modificationEvents: PHIModificationEvent[],
  breakGlassEvents: BreakGlassEvent[],
  chain: ChainVerificationResult,
): HIPAAAuditSummary {
  const userSet = new Set<string>()
  const patientSet = new Set<string>()
  let failedAccess = 0

  for (const e of accessEvents) {
    userSet.add(e.userId)
    if (e.patientId) patientSet.add(e.patientId)
    if (e.status === 'failure') failedAccess += 1
  }

  for (const e of modificationEvents) {
    userSet.add(e.userId)
  }

  for (const e of breakGlassEvents) {
    userSet.add(e.userId)
  }

  return {
    totalPhiAccess: accessEvents.length,
    totalPhiModifications: modificationEvents.length,
    totalBreakGlass: breakGlassEvents.length,
    failedAccess,
    uniqueUsers: userSet.size,
    uniquePatients: patientSet.size,
    chainValid: chain.valid,
  }
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

export async function generateHIPAAAuditReport(
  period: ReportPeriod,
  tenantId: string,
  chainVerification: ChainVerificationResult,
): Promise<HIPAAAuditReport> {
  // Fetch audit events in the period
  const events = await queryAuditEvents(
    period.startDate,
    period.endDate,
    tenantId,
  )

  // Update chain totalEvents count
  chainVerification.totalEvents = events.length

  // Classify events
  const phiAccessEvents: PHIAccessEvent[] = []
  const phiModificationEvents: PHIModificationEvent[] = []
  const breakGlassEvents: BreakGlassEvent[] = []

  for (const event of events) {
    if (isBreakGlass(event)) {
      breakGlassEvents.push(mapToBreakGlassEvent(event))
    }
    if (isPhiAccess(event)) {
      phiAccessEvents.push(mapToPHIAccessEvent(event))
    }
    if (isPhiModification(event)) {
      phiModificationEvents.push(mapToPHIModificationEvent(event))
    }
  }

  const summary = buildSummary(
    phiAccessEvents,
    phiModificationEvents,
    breakGlassEvents,
    chainVerification,
  )

  return {
    reportType: 'hipaa_audit',
    reportId: '', // Will be set by orchestrator
    generatedAt: new Date().toISOString(),
    period,
    tenantId,
    chainVerification,
    phiAccessEvents,
    phiModificationEvents,
    breakGlassEvents,
    summary,
  }
}
