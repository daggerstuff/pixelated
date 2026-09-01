/**
 * EHR Native — Audit Event Types (F2.4)
 *
 * Extends the base audit system (src/lib/audit/) with EHR-specific
 * audit actions, resource types, and severity conventions.
 *
 * Every EHR write path and sensitive read path should emit an audit
 * event through EHRAuditService.  Events are persisted into the
 * existing SHA-256 hash-chain audit trail via AuditLogger.
 *
 * @see docs/adr/ADR-006-audit-chain-ehr.md
 * @see src/lib/audit/events.ts for base AuditEvent, AuditEventType, AuditSeverity
 * @see src/lib/audit/logger.ts for AuditLogger hash-chain persistence
 */

import { AuditEventType, AuditSeverity } from '../../audit/events'

// ---------------------------------------------------------------------------
// EHR-specific audit actions (string constants, not enum extensions)
// ---------------------------------------------------------------------------

/**
 * EHR audit actions beyond the generic AuditAction enum.
 *
 * These are passed as the `action` field of an AuditEvent.  The base
 * AuditEvent interface accepts `AuditAction | string`, so these string
 * constants are type-safe at the call site without modifying the
 * shared audit module.
 */
export const EHRAuditAction = {
  // Patient
  VIEW_PATIENT: 'view_patient',
  CREATE_PATIENT: 'create_patient',
  UPDATE_PATIENT: 'update_patient',
  DEACTIVATE_PATIENT: 'deactivate_patient',

  // Encounter
  VIEW_ENCOUNTER: 'view_encounter',
  CREATE_ENCOUNTER: 'create_encounter',
  UPDATE_ENCOUNTER: 'update_encounter',
  CLOSE_ENCOUNTER: 'close_encounter',

  // Appointment / Scheduling
  VIEW_SCHEDULE: 'view_schedule',
  BOOK_APPOINTMENT: 'book_appointment',
  CANCEL_APPOINTMENT: 'cancel_appointment',
  RESCHEDULE_APPOINTMENT: 'reschedule_appointment',
  CHECK_IN_APPOINTMENT: 'check_in_appointment',
  COMPLETE_APPOINTMENT: 'complete_appointment',
  NO_SHOW_APPOINTMENT: 'no_show_appointment',

  // Observation / Lab
  VIEW_OBSERVATION: 'view_observation',
  CREATE_OBSERVATION: 'create_observation',
  UPDATE_OBSERVATION: 'update_observation',

  // Clinical Notes
  VIEW_NOTE: 'view_note',
  CREATE_NOTE: 'create_note',
  SIGN_NOTE: 'sign_note',
  AMEND_NOTE: 'amend_note',

  // Claims / Billing
  VIEW_CLAIM: 'view_claim',
  CREATE_CLAIM: 'create_claim',
  SUBMIT_CLAIM: 'submit_claim',
  CANCEL_CLAIM: 'cancel_claim',
  UPDATE_CLAIM_STATUS: 'update_claim_status',

  // Consent
  VIEW_CONSENT: 'view_consent',
  VERIFY_CONSENT: 'verify_consent',
  REVOKE_CONSENT: 'revoke_consent',

  // Medication / Prescribing
  VIEW_MEDICATION: 'view_medication',
  PRESCRIBE_MEDICATION: 'prescribe_medication',
  CANCEL_PRESCRIPTION: 'cancel_prescription',
  CHECK_DRUG_INTERACTION: 'check_drug_interaction',

  // E-Prescribing
  EPRESCRIBE_NEW_RX: 'eprescribe_new_rx',
  EPRESCRIBE_REFILL: 'eprescribe_refill',
  EPRESCRIBE_CANCEL: 'eprescribe_cancel',
  EPRESCRIBE_PRESCRIPTION_STATUS_CHECK: 'eprescribe_prescription_status_check',
  EPRESCRIBE_MEDICATION_HISTORY: 'eprescribe_medication_history',
  EPRESCRIBE_CONTROLLED_SUBSTANCE_CHECK:
    'eprescribe_controlled_substance_check',
  EPRESCRIBE_DRUG_INTERACTION_CHECK: 'eprescribe_drug_interaction_check',

  // HIE / Integration
  HIE_PATIENT_DISCOVERY: 'hie_patient_discovery',
  HIE_DOCUMENT_QUERY: 'hie_document_query',
  HIE_DOCUMENT_RETRIEVE: 'hie_document_retrieve',
  HIE_DOCUMENT_SUBMIT: 'hie_document_submit',

  // Clearinghouse
  CLEARINGHOUSE_ELIGIBILITY: 'clearinghouse_eligibility',
  CLEARINGHOUSE_SUBMIT_CLAIM: 'clearinghouse_submit_claim',
  CLEARINGHOUSE_CHECK_STATUS: 'clearinghouse_check_status',
  CLEARINGHOUSE_REMITTANCE: 'clearinghouse_remittance',

  // Telehealth (F1.12)
  START_TELEHEALTH_SESSION: 'start_telehealth_session',
  JOIN_TELEHEALTH_SESSION: 'join_telehealth_session',
  END_TELEHEALTH_SESSION: 'end_telehealth_session',
  START_RECORDING: 'start_recording',
  STOP_RECORDING: 'stop_recording',
  CHECK_DEVICES: 'check_devices',

  // Break-glass
  BREAK_GLASS_ACCESS: 'break_glass_access',

  // Supervisor Operations (F3.2)
  VIEW_SUPERVISOR_CASELOAD: 'view_supervisor_caseload',
  VIEW_REVIEW_QUEUE: 'view_review_queue',
  VIEW_NOTE_REVIEW: 'view_note_review',
  COSIGN_NOTE: 'cosign_note',
  REJECT_NOTE: 'reject_note',
  REQUEST_NOTE_CHANGES: 'request_note_changes',
  VIEW_RISK_QUEUE: 'view_risk_queue',
  ACKNOWLEDGE_RISK_FLAG: 'acknowledge_risk_flag',
  RESOLVE_RISK_FLAG: 'resolve_risk_flag',
  OBSERVE_SESSION: 'observe_session',
  LEAVE_SESSION_OBSERVATION: 'leave_session_observation',
  VIEW_SUPERVISOR_METRICS: 'view_supervisor_metrics',

  // Integration Marketplace (F2.5)
  INTEGRATION_CONNECT: 'integration_connect',
  INTEGRATION_DISCONNECT: 'integration_disconnect',
  INTEGRATION_WEBHOOK_RECEIVED: 'integration_webhook_received',
  INTEGRATION_OAUTH_CALLBACK: 'integration_oauth_callback',
  INTEGRATION_TOKEN_REFRESH: 'integration_token_refresh',
} as const

export type EHRAuditActionType =
  (typeof EHRAuditAction)[keyof typeof EHRAuditAction]

// ---------------------------------------------------------------------------
// EHR resource types
// ---------------------------------------------------------------------------

export const EHRResourceType = {
  PATIENT: 'Patient',
  ENCOUNTER: 'Encounter',
  APPOINTMENT: 'Appointment',
  OBSERVATION: 'Observation',
  DOCUMENT_REFERENCE: 'DocumentReference',
  CLAIM: 'Claim',
  CONSENT: 'Consent',
  MEDICATION_REQUEST: 'MedicationRequest',
  EPRESCRIPTION: 'EPrescription',
  COVERAGE: 'Coverage',
  TELEHEALTH_SESSION: 'TelehealthSession',
  PROVENANCE: 'Provenance',
  SUPERVISOR_REVIEW: 'SupervisorReview',
  RISK_FLAG: 'RiskFlag',
  INTEGRATION: 'Integration',
} as const

export type EHRResourceTypeValue =
  (typeof EHRResourceType)[keyof typeof EHRResourceType]

// ---------------------------------------------------------------------------
// Severity conventions for EHR events
// ---------------------------------------------------------------------------

/**
 * Maps EHR operation categories to default severity levels.
 *
 * - Read/access of PHI: LOW (routine, but must be audited)
 * - Create/write of clinical data: INFO (expected workflow)
 * - Update/modify of clinical data: MEDIUM (changes to existing records)
 * - Delete/deactivate: HIGH (data lifecycle events)
 * - Break-glass access: HIGH (override of normal access controls)
 * - Consent verification failure: HIGH (potential compliance issue)
 * - Failed access attempt: MEDIUM (possible unauthorized access)
 */
export const EHRSeverity = {
  READ: AuditSeverity.LOW,
  CREATE: AuditSeverity.INFO,
  UPDATE: AuditSeverity.MEDIUM,
  DELETE: AuditSeverity.HIGH,
  BREAK_GLASS: AuditSeverity.HIGH,
  CONSENT_FAILURE: AuditSeverity.HIGH,
  FAILED_ACCESS: AuditSeverity.MEDIUM,
  INTEGRATION: AuditSeverity.LOW,
} as const

// ---------------------------------------------------------------------------
// EHR audit metadata
// ---------------------------------------------------------------------------

/**
 * Structured metadata for EHR audit events.
 *
 * Extends the generic Record<string, unknown> with commonly used
 * EHR-specific fields so builders get type hints without restricting
 * flexibility.
 */
export interface EHRAuditMetadata {
  /** Tenant / practice ID for multi-tenant RLS */
  tenantId?: string
  /** Patient FHIR ID (when the event pertains to a specific patient) */
  patientId?: string
  /** Encounter FHIR ID (when scoped to a visit) */
  encounterId?: string
  /** Practitioner FHIR ID (when different from userId) */
  practitionerId?: string
  /** FHIR resource type being accessed (e.g. 'Patient', 'Observation') */
  resourceType?: string
  /** FHIR resource ID being accessed */
  resourceId?: string
  /** Permission that was checked (e.g. 'read_patient', 'write_encounter') */
  permission?: string
  /** Whether break-glass was invoked */
  breakGlass?: boolean
  /** Reason for break-glass access (if applicable) */
  breakGlassReason?: string
  /** Integration source (e.g. 'clearinghouse', 'hie', 'e-prescribing') */
  integrationSource?: string
  /** External transaction ID from integration partner */
  externalTransactionId?: string
  /** Any additional metadata */
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Event type helpers
// ---------------------------------------------------------------------------

/**
 * Maps EHR audit action categories to AuditEventType.
 *
 * Read operations → ACCESS
 * Create operations → CREATE
 * Update/modify operations → UPDATE
 * Delete/deactivate operations → DELETE
 * Integration operations → SYSTEM
 * Break-glass → SECURITY
 */
export function ehrActionToEventType(
  action: EHRAuditActionType,
): AuditEventType {
  // Exact appointment write actions are checked before the read-oriented
  // prefixes so check_in/complete classify as updates consistently with
  // defaultSeverity.
  if (
    action === EHRAuditAction.CHECK_IN_APPOINTMENT ||
    action === EHRAuditAction.COMPLETE_APPOINTMENT
  ) {
    return AuditEventType.UPDATE
  }
  // Supervisor (F3.2) oversight actions are clinical write operations;
  // classify explicitly so they never fall through to the read-access default.
  if (
    action === EHRAuditAction.COSIGN_NOTE ||
    action === EHRAuditAction.REJECT_NOTE ||
    action === EHRAuditAction.REQUEST_NOTE_CHANGES ||
    action === EHRAuditAction.ACKNOWLEDGE_RISK_FLAG ||
    action === EHRAuditAction.RESOLVE_RISK_FLAG
  ) {
    return AuditEventType.UPDATE
  }
  if (action === EHRAuditAction.OBSERVE_SESSION) {
    return AuditEventType.CREATE
  }
  if (action === EHRAuditAction.LEAVE_SESSION_OBSERVATION) {
    return AuditEventType.UPDATE
  }
  if (action.startsWith('view_') || action.startsWith('check_')) {
    return AuditEventType.ACCESS
  }
  if (
    action.startsWith('create_') ||
    action.startsWith('book_') ||
    action.startsWith('prescribe_') ||
    action.startsWith('start_') ||
    action.startsWith('join_')
  ) {
    return AuditEventType.CREATE
  }
  if (
    action.startsWith('update_') ||
    action.startsWith('amend_') ||
    action.startsWith('sign_') ||
    action.startsWith('reschedule_') ||
    action.startsWith('submit_') ||
    action.startsWith('close_') ||
    action.startsWith('end_') ||
    action.startsWith('stop_')
  ) {
    return AuditEventType.UPDATE
  }
  if (
    action.startsWith('cancel_') ||
    action.startsWith('deactivate_') ||
    action.startsWith('revoke_') ||
    action.startsWith('no_show')
  ) {
    return AuditEventType.DELETE
  }
  if (
    action.startsWith('hie_') ||
    action.startsWith('clearinghouse_') ||
    action.startsWith('integration_')
  ) {
    return AuditEventType.SYSTEM
  }
  // E-prescribing: new/refill are create operations, cancel is a delete,
  // medication history and drug interaction checks are read accesses.
  if (
    action === EHRAuditAction.EPRESCRIBE_NEW_RX ||
    action === EHRAuditAction.EPRESCRIBE_REFILL
  ) {
    return AuditEventType.CREATE
  }
  if (action === EHRAuditAction.EPRESCRIBE_CANCEL) {
    return AuditEventType.DELETE
  }
  if (
    action === EHRAuditAction.EPRESCRIBE_PRESCRIPTION_STATUS_CHECK ||
    action === EHRAuditAction.EPRESCRIBE_MEDICATION_HISTORY ||
    action === EHRAuditAction.EPRESCRIBE_CONTROLLED_SUBSTANCE_CHECK ||
    action === EHRAuditAction.EPRESCRIBE_DRUG_INTERACTION_CHECK
  ) {
    return AuditEventType.ACCESS
  }
  if (action.startsWith('break_glass')) {
    return AuditEventType.SECURITY
  }
  return AuditEventType.ACCESS
}
