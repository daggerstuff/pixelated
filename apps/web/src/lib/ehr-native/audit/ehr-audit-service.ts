/**
 * EHR Native — Audit Service (F2.4)
 *
 * Wraps the existing hash-chain AuditLogger with EHR-specific event
 * builders.  Each method constructs a properly typed AuditEvent and
 * delegates to AuditLogger.logEvent for persistence into the
 * tamper-evident SHA-256 hash chain.
 *
 * Usage:
 *   const audit = EHRAuditService.getInstance()
 *   await audit.logPatientAccess({ userId, patientId, action: 'view_patient', ... })
 *
 * @see docs/adr/ADR-006-audit-chain-ehr.md
 * @see src/lib/audit/logger.ts for AuditLogger
 */

import type { AuditEvent } from '../../audit/events'
import { AuditSeverity } from '../../audit/events'
import { AuditLogger } from '../../audit/logger'
import {
  EHRAuditAction,
  EHRResourceType,
  EHRSeverity,
  ehrActionToEventType,
  type EHRAuditActionType,
  type EHRAuditMetadata,
  type EHRResourceTypeValue,
} from './events'

// ---------------------------------------------------------------------------
// Input interfaces for typed audit builders
// ---------------------------------------------------------------------------

/** Base input for any EHR audit event. */
export interface EHRAuditInput {
  /** User performing the action (FHIR practitioner ID or system user ID) */
  userId: string
  /** Whether the action succeeded or failed */
  status: 'success' | 'failure'
  /** Error message (when status is failure) */
  errorMessage?: string
  /** IP address of the request */
  ipAddress?: string
  /** User agent of the request */
  userAgent?: string
  /** EHR-specific metadata */
  metadata?: EHRAuditMetadata
}

/** Input for patient-related audit events. */
export interface PatientAuditInput extends EHRAuditInput {
  patientId: string
}

/** Input for encounter-related audit events. */
export interface EncounterAuditInput extends EHRAuditInput {
  encounterId: string
  patientId?: string
}

/** Input for appointment-related audit events. */
export interface AppointmentAuditInput extends EHRAuditInput {
  appointmentId: string
  patientId?: string
  practitionerId?: string
}

/** Input for observation-related audit events. */
export interface ObservationAuditInput extends EHRAuditInput {
  observationId: string
  patientId?: string
}

/** Input for note-related audit events. */
export interface NoteAuditInput extends EHRAuditInput {
  noteId: string
  patientId?: string
  encounterId?: string
}

/** Input for claim-related audit events. */
export interface ClaimAuditInput extends EHRAuditInput {
  claimId: string
  patientId?: string
}

/** Input for consent-related audit events. */
export interface ConsentAuditInput extends EHRAuditInput {
  consentId: string
  patientId?: string
}

/** Input for medication-related audit events. */
export interface MedicationAuditInput extends EHRAuditInput {
  medicationRequestId?: string
  patientId: string
}

/** Input for integration-related audit events. */
export interface IntegrationAuditInput extends EHRAuditInput {
  integrationSource: string
  externalTransactionId?: string
  patientId?: string
}

/** Input for e-prescribing audit events. */
export interface EPrescribeAuditInput extends IntegrationAuditInput {
  medicationRequestId?: string
  patientId: string
}

/** Input for break-glass audit events. */
export interface BreakGlassAuditInput extends EHRAuditInput {
  patientId: string
  reason: string
  permission: string
}

/** Input for telehealth-related audit events (F1.12). */
export interface TelehealthAuditInput extends EHRAuditInput {
  sessionId: string
  patientId?: string
  practitionerId?: string
  encounterId?: string
  providerType?: 'webrtc' | 'zoom'
}

/** Input for supervisor-related audit events (F3.2). */
export interface SupervisorAuditInput extends EHRAuditInput {
  supervisorId?: string
  clinicianId?: string
  patientId?: string
  noteId?: string
  reviewId?: string
  flagId?: string
  sessionId?: string
}

// ---------------------------------------------------------------------------
// EHRAuditService
// ---------------------------------------------------------------------------

/**
 * EHR-specific audit service.
 *
 * Singleton wrapping the existing AuditLogger with typed builders for
 * common EHR operations.  Each builder constructs an AuditEvent with
 * the correct type, action, severity, resourceType, and metadata,
 * then delegates to AuditLogger.logEvent for hash-chain persistence.
 *
 * The service does NOT catch or suppress errors from AuditLogger —
 * audit failures propagate to the caller so the EHR write path can
 * decide whether to proceed (fail-open for reads) or abort (fail-closed
 * for writes, depending on policy).
 */
export class EHRAuditService {
  private static instance: EHRAuditService
  private readonly logger: AuditLogger

  private constructor() {
    this.logger = AuditLogger.getInstance()
  }

  static getInstance(): EHRAuditService {
    if (!EHRAuditService.instance) {
      EHRAuditService.instance = new EHRAuditService()
    }
    return EHRAuditService.instance
  }

  // -------------------------------------------------------------------------
  // Core: build and persist an event
  // -------------------------------------------------------------------------

  /**
   * Build an AuditEvent from EHR-specific inputs and delegate to AuditLogger.
   *
   * This is the generic entry point used by all typed builders below.
   * Callers should prefer the typed builders for type safety.
   */
  async log(
    action: EHRAuditActionType,
    resourceType: EHRResourceTypeValue | undefined,
    resourceId: string | undefined,
    input: EHRAuditInput,
    severityOverride?: AuditSeverity,
  ): Promise<string> {
    const type = ehrActionToEventType(action)
    const severity =
      severityOverride ??
      (input.status === 'failure'
        ? EHRSeverity.FAILED_ACCESS
        : this.defaultSeverity(action))

    const event: Omit<AuditEvent, 'id' | 'timestamp'> = {
      userId: input.userId,
      type,
      action,
      severity,
      resourceId,
      resourceType,
      status: input.status,
      errorMessage: input.errorMessage,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: input.metadata as Record<string, unknown> | undefined,
    }

    return this.logger.logEvent(event)
  }

  /**
   * Determine default severity for a successful action.
   */
  private defaultSeverity(action: EHRAuditActionType): AuditSeverity {
    if (action === EHRAuditAction.VERIFY_CONSENT)
      return EHRSeverity.CONSENT_FAILURE
    if (
      action === EHRAuditAction.CHECK_IN_APPOINTMENT ||
      action === EHRAuditAction.COMPLETE_APPOINTMENT
    )
      return EHRSeverity.UPDATE
    // Supervisor (F3.2) oversight actions are write operations (Sentry 16294287/0).
    if (
      action === EHRAuditAction.COSIGN_NOTE ||
      action === EHRAuditAction.REJECT_NOTE ||
      action === EHRAuditAction.REQUEST_NOTE_CHANGES ||
      action === EHRAuditAction.ACKNOWLEDGE_RISK_FLAG ||
      action === EHRAuditAction.RESOLVE_RISK_FLAG
    )
      return EHRSeverity.UPDATE
    if (action === EHRAuditAction.OBSERVE_SESSION) return EHRSeverity.CREATE
    if (action === EHRAuditAction.LEAVE_SESSION_OBSERVATION)
      return EHRSeverity.UPDATE
    if (action.startsWith('view_') || action.startsWith('check_'))
      return EHRSeverity.READ
    if (
      action.startsWith('create_') ||
      action.startsWith('book_') ||
      action.startsWith('prescribe_') ||
      action.startsWith('start_') ||
      action.startsWith('join_')
    )
      return EHRSeverity.CREATE
    if (
      action.startsWith('update_') ||
      action.startsWith('amend_') ||
      action.startsWith('sign_') ||
      action.startsWith('reschedule_') ||
      action.startsWith('submit_') ||
      action.startsWith('close_') ||
      action.startsWith('end_') ||
      action.startsWith('stop_')
    )
      return EHRSeverity.UPDATE
    if (
      action.startsWith('cancel_') ||
      action.startsWith('deactivate_') ||
      action.startsWith('revoke_') ||
      action.startsWith('no_show')
    )
      return EHRSeverity.DELETE
    if (action.startsWith('break_glass')) return EHRSeverity.BREAK_GLASS
    if (action.startsWith('hie_') || action.startsWith('clearinghouse_'))
      return EHRSeverity.INTEGRATION
    if (
      action.startsWith('eprescribe_new_') ||
      action.startsWith('eprescribe_refill')
    )
      return EHRSeverity.CREATE
    if (action.startsWith('eprescribe_cancel')) return EHRSeverity.DELETE
    if (
      action.startsWith('eprescribe_medication_history') ||
      action.startsWith('eprescribe_drug_interaction')
    )
      return EHRSeverity.READ
    return EHRSeverity.READ
  }

  // -------------------------------------------------------------------------
  // Patient audit builders
  // -------------------------------------------------------------------------

  async logPatientAccess(
    action:
      | typeof EHRAuditAction.VIEW_PATIENT
      | typeof EHRAuditAction.CREATE_PATIENT
      | typeof EHRAuditAction.UPDATE_PATIENT
      | typeof EHRAuditAction.DEACTIVATE_PATIENT,
    input: PatientAuditInput,
  ): Promise<string> {
    return this.log(action, EHRResourceType.PATIENT, input.patientId, {
      ...input,
      metadata: {
        ...input.metadata,
        patientId: input.patientId,
        resourceType: EHRResourceType.PATIENT,
        resourceId: input.patientId,
      },
    })
  }

  // -------------------------------------------------------------------------
  // Encounter audit builders
  // -------------------------------------------------------------------------

  async logEncounterAccess(
    action:
      | typeof EHRAuditAction.VIEW_ENCOUNTER
      | typeof EHRAuditAction.CREATE_ENCOUNTER
      | typeof EHRAuditAction.UPDATE_ENCOUNTER
      | typeof EHRAuditAction.CLOSE_ENCOUNTER,
    input: EncounterAuditInput,
  ): Promise<string> {
    return this.log(action, EHRResourceType.ENCOUNTER, input.encounterId, {
      ...input,
      metadata: {
        ...input.metadata,
        encounterId: input.encounterId,
        patientId: input.patientId,
        resourceType: EHRResourceType.ENCOUNTER,
        resourceId: input.encounterId,
      },
    })
  }

  // -------------------------------------------------------------------------
  // Appointment audit builders
  // -------------------------------------------------------------------------

  async logAppointmentAccess(
    action:
      | typeof EHRAuditAction.VIEW_SCHEDULE
      | typeof EHRAuditAction.BOOK_APPOINTMENT
      | typeof EHRAuditAction.CANCEL_APPOINTMENT
      | typeof EHRAuditAction.RESCHEDULE_APPOINTMENT
      | typeof EHRAuditAction.CHECK_IN_APPOINTMENT
      | typeof EHRAuditAction.COMPLETE_APPOINTMENT
      | typeof EHRAuditAction.NO_SHOW_APPOINTMENT,
    input: AppointmentAuditInput,
  ): Promise<string> {
    return this.log(action, EHRResourceType.APPOINTMENT, input.appointmentId, {
      ...input,
      metadata: {
        ...input.metadata,
        patientId: input.patientId,
        practitionerId: input.practitionerId,
        resourceType: EHRResourceType.APPOINTMENT,
        resourceId: input.appointmentId,
      },
    })
  }

  // -------------------------------------------------------------------------
  // Observation audit builders
  // -------------------------------------------------------------------------

  async logObservationAccess(
    action:
      | typeof EHRAuditAction.VIEW_OBSERVATION
      | typeof EHRAuditAction.CREATE_OBSERVATION
      | typeof EHRAuditAction.UPDATE_OBSERVATION,
    input: ObservationAuditInput,
  ): Promise<string> {
    return this.log(action, EHRResourceType.OBSERVATION, input.observationId, {
      ...input,
      metadata: {
        ...input.metadata,
        patientId: input.patientId,
        resourceType: EHRResourceType.OBSERVATION,
        resourceId: input.observationId,
      },
    })
  }

  // -------------------------------------------------------------------------
  // Note audit builders
  // -------------------------------------------------------------------------

  async logNoteAccess(
    action:
      | typeof EHRAuditAction.VIEW_NOTE
      | typeof EHRAuditAction.CREATE_NOTE
      | typeof EHRAuditAction.SIGN_NOTE
      | typeof EHRAuditAction.AMEND_NOTE,
    input: NoteAuditInput,
  ): Promise<string> {
    return this.log(action, EHRResourceType.DOCUMENT_REFERENCE, input.noteId, {
      ...input,
      metadata: {
        ...input.metadata,
        patientId: input.patientId,
        encounterId: input.encounterId,
        resourceType: EHRResourceType.DOCUMENT_REFERENCE,
        resourceId: input.noteId,
      },
    })
  }

  // -------------------------------------------------------------------------
  // Claim audit builders
  // -------------------------------------------------------------------------

  async logClaimAccess(
    action:
      | typeof EHRAuditAction.VIEW_CLAIM
      | typeof EHRAuditAction.CREATE_CLAIM
      | typeof EHRAuditAction.SUBMIT_CLAIM
      | typeof EHRAuditAction.CANCEL_CLAIM
      | typeof EHRAuditAction.UPDATE_CLAIM_STATUS,
    input: ClaimAuditInput,
  ): Promise<string> {
    return this.log(action, EHRResourceType.CLAIM, input.claimId, {
      ...input,
      metadata: {
        ...input.metadata,
        patientId: input.patientId,
        resourceType: EHRResourceType.CLAIM,
        resourceId: input.claimId,
      },
    })
  }

  // -------------------------------------------------------------------------
  // Consent audit builders
  // -------------------------------------------------------------------------

  async logConsentAccess(
    action:
      | typeof EHRAuditAction.VIEW_CONSENT
      | typeof EHRAuditAction.VERIFY_CONSENT
      | typeof EHRAuditAction.REVOKE_CONSENT,
    input: ConsentAuditInput,
  ): Promise<string> {
    const severity =
      input.status === 'failure' && action === EHRAuditAction.VERIFY_CONSENT
        ? EHRSeverity.CONSENT_FAILURE
        : undefined
    return this.log(
      action,
      EHRResourceType.CONSENT,
      input.consentId,
      {
        ...input,
        metadata: {
          ...input.metadata,
          patientId: input.patientId,
          resourceType: EHRResourceType.CONSENT,
          resourceId: input.consentId,
        },
      },
      severity,
    )
  }

  // -------------------------------------------------------------------------
  // Medication audit builders
  // -------------------------------------------------------------------------

  async logMedicationAccess(
    action:
      | typeof EHRAuditAction.VIEW_MEDICATION
      | typeof EHRAuditAction.PRESCRIBE_MEDICATION
      | typeof EHRAuditAction.CANCEL_PRESCRIPTION
      | typeof EHRAuditAction.CHECK_DRUG_INTERACTION,
    input: MedicationAuditInput,
  ): Promise<string> {
    return this.log(
      action,
      EHRResourceType.MEDICATION_REQUEST,
      input.medicationRequestId,
      {
        ...input,
        metadata: {
          ...input.metadata,
          patientId: input.patientId,
          resourceType: EHRResourceType.MEDICATION_REQUEST,
          resourceId: input.medicationRequestId,
        },
      },
    )
  }

  // -------------------------------------------------------------------------
  // Integration audit builders (HIE, clearinghouse)
  // -------------------------------------------------------------------------

  async logIntegration(
    action:
      | typeof EHRAuditAction.HIE_PATIENT_DISCOVERY
      | typeof EHRAuditAction.HIE_DOCUMENT_QUERY
      | typeof EHRAuditAction.HIE_DOCUMENT_RETRIEVE
      | typeof EHRAuditAction.HIE_DOCUMENT_SUBMIT
      | typeof EHRAuditAction.CLEARINGHOUSE_ELIGIBILITY
      | typeof EHRAuditAction.CLEARINGHOUSE_SUBMIT_CLAIM
      | typeof EHRAuditAction.CLEARINGHOUSE_CHECK_STATUS
      | typeof EHRAuditAction.CLEARINGHOUSE_REMITTANCE,
    input: IntegrationAuditInput,
  ): Promise<string> {
    return this.log(action, undefined, undefined, {
      ...input,
      metadata: {
        ...input.metadata,
        integrationSource: input.integrationSource,
        externalTransactionId: input.externalTransactionId,
        patientId: input.patientId,
      },
    })
  }

  // -------------------------------------------------------------------------
  // E-prescribing audit builders
  // -------------------------------------------------------------------------

  async logEPrescribeNewRx(input: EPrescribeAuditInput): Promise<string> {
    return this.log(
      EHRAuditAction.EPRESCRIBE_NEW_RX,
      EHRResourceType.EPRESCRIPTION,
      input.medicationRequestId,
      {
        ...input,
        metadata: {
          ...input.metadata,
          integrationSource: input.integrationSource,
          externalTransactionId: input.externalTransactionId,
          patientId: input.patientId,
          medicationRequestId: input.medicationRequestId,
        },
      },
    )
  }

  async logEPrescribeRefill(input: EPrescribeAuditInput): Promise<string> {
    return this.log(
      EHRAuditAction.EPRESCRIBE_REFILL,
      EHRResourceType.EPRESCRIPTION,
      input.medicationRequestId,
      {
        ...input,
        metadata: {
          ...input.metadata,
          integrationSource: input.integrationSource,
          externalTransactionId: input.externalTransactionId,
          patientId: input.patientId,
          medicationRequestId: input.medicationRequestId,
        },
      },
    )
  }

  async logEPrescribeCancel(input: EPrescribeAuditInput): Promise<string> {
    return this.log(
      EHRAuditAction.EPRESCRIBE_CANCEL,
      EHRResourceType.EPRESCRIPTION,
      input.medicationRequestId,
      {
        ...input,
        metadata: {
          ...input.metadata,
          integrationSource: input.integrationSource,
          externalTransactionId: input.externalTransactionId,
          patientId: input.patientId,
          medicationRequestId: input.medicationRequestId,
        },
      },
    )
  }

  async logEPrescribePrescriptionStatusCheck(
    input: EPrescribeAuditInput,
  ): Promise<string> {
    return this.log(
      EHRAuditAction.EPRESCRIBE_PRESCRIPTION_STATUS_CHECK,
      EHRResourceType.EPRESCRIPTION,
      input.medicationRequestId,
      {
        ...input,
        metadata: {
          ...input.metadata,
          integrationSource: input.integrationSource,
          externalTransactionId: input.externalTransactionId,
          patientId: input.patientId,
          medicationRequestId: input.medicationRequestId,
        },
      },
    )
  }

  async logEPrescribeMedicationHistory(
    input: EPrescribeAuditInput,
  ): Promise<string> {
    return this.log(
      EHRAuditAction.EPRESCRIBE_MEDICATION_HISTORY,
      EHRResourceType.EPRESCRIPTION,
      input.medicationRequestId,
      {
        ...input,
        metadata: {
          ...input.metadata,
          integrationSource: input.integrationSource,
          externalTransactionId: input.externalTransactionId,
          patientId: input.patientId,
          medicationRequestId: input.medicationRequestId,
        },
      },
    )
  }

  async logEPrescribeControlledSubstanceCheck(
    input: EPrescribeAuditInput,
  ): Promise<string> {
    return this.log(
      EHRAuditAction.EPRESCRIBE_CONTROLLED_SUBSTANCE_CHECK,
      EHRResourceType.EPRESCRIPTION,
      input.medicationRequestId,
      {
        ...input,
        metadata: {
          ...input.metadata,
          integrationSource: input.integrationSource,
          externalTransactionId: input.externalTransactionId,
          patientId: input.patientId,
          medicationRequestId: input.medicationRequestId,
        },
      },
    )
  }

  async logEPrescribeDrugInteractionCheck(
    input: EPrescribeAuditInput,
  ): Promise<string> {
    return this.log(
      EHRAuditAction.EPRESCRIBE_DRUG_INTERACTION_CHECK,
      EHRResourceType.EPRESCRIPTION,
      input.medicationRequestId,
      {
        ...input,
        metadata: {
          ...input.metadata,
          integrationSource: input.integrationSource,
          externalTransactionId: input.externalTransactionId,
          patientId: input.patientId,
          medicationRequestId: input.medicationRequestId,
        },
      },
    )
  }

  // -------------------------------------------------------------------------
  // Break-glass audit
  // -------------------------------------------------------------------------

  /**
   * Log a break-glass access event.
   *
   * Break-glass events are always HIGH severity because they represent
   * an override of normal access controls.  The reason and permission
   * are captured for compliance review.
   */
  async logBreakGlass(input: BreakGlassAuditInput): Promise<string> {
    return this.log(
      EHRAuditAction.BREAK_GLASS_ACCESS,
      EHRResourceType.PATIENT,
      input.patientId,
      {
        ...input,
        metadata: {
          ...input.metadata,
          patientId: input.patientId,
          breakGlass: true,
          breakGlassReason: input.reason,
          permission: input.permission,
        },
      },
      // Break-glass events are always HIGH severity — including failed
      // attempts, which would otherwise be downgraded to FAILED_ACCESS.
      EHRSeverity.BREAK_GLASS,
    )
  }

  // -------------------------------------------------------------------------
  // Telehealth audit builders (F1.12)
  // -------------------------------------------------------------------------

  async logTelehealthAccess(
    action:
      | typeof EHRAuditAction.START_TELEHEALTH_SESSION
      | typeof EHRAuditAction.JOIN_TELEHEALTH_SESSION
      | typeof EHRAuditAction.END_TELEHEALTH_SESSION
      | typeof EHRAuditAction.START_RECORDING
      | typeof EHRAuditAction.STOP_RECORDING
      | typeof EHRAuditAction.CHECK_DEVICES,
    input: TelehealthAuditInput,
  ): Promise<string> {
    return this.log(
      action,
      EHRResourceType.TELEHEALTH_SESSION,
      input.sessionId,
      {
        ...input,
        metadata: {
          ...input.metadata,
          sessionId: input.sessionId,
          patientId: input.patientId,
          practitionerId: input.practitionerId,
          encounterId: input.encounterId,
          providerType: input.providerType,
          resourceType: EHRResourceType.TELEHEALTH_SESSION,
          resourceId: input.sessionId,
        },
      },
    )
  }

  // -------------------------------------------------------------------------
  // Supervisor audit builders (F3.2)
  // -------------------------------------------------------------------------

  async logSupervisorAccess(
    action:
      | typeof EHRAuditAction.VIEW_SUPERVISOR_CASELOAD
      | typeof EHRAuditAction.VIEW_REVIEW_QUEUE
      | typeof EHRAuditAction.VIEW_NOTE_REVIEW
      | typeof EHRAuditAction.COSIGN_NOTE
      | typeof EHRAuditAction.REJECT_NOTE
      | typeof EHRAuditAction.REQUEST_NOTE_CHANGES
      | typeof EHRAuditAction.VIEW_RISK_QUEUE
      | typeof EHRAuditAction.ACKNOWLEDGE_RISK_FLAG
      | typeof EHRAuditAction.RESOLVE_RISK_FLAG
      | typeof EHRAuditAction.OBSERVE_SESSION
      | typeof EHRAuditAction.LEAVE_SESSION_OBSERVATION
      | typeof EHRAuditAction.VIEW_SUPERVISOR_METRICS,
    input: SupervisorAuditInput,
    resourceType: EHRResourceTypeValue = EHRResourceType.SUPERVISOR_REVIEW,
    resourceId?: string,
  ): Promise<string> {
    return this.log(
      action,
      resourceType,
      resourceId ??
        input.reviewId ??
        input.flagId ??
        input.noteId ??
        input.sessionId,
      {
        ...input,
        metadata: {
          ...input.metadata,
          supervisorId: input.supervisorId,
          clinicianId: input.clinicianId,
          patientId: input.patientId,
          noteId: input.noteId,
          reviewId: input.reviewId,
          flagId: input.flagId,
          sessionId: input.sessionId,
          resourceType,
          resourceId:
            resourceId ??
            input.reviewId ??
            input.flagId ??
            input.noteId ??
            input.sessionId,
        },
      },
    )
  }

  // -------------------------------------------------------------------------
  // Query helpers (delegate to AuditLogger)
  // -------------------------------------------------------------------------

  /**
   * Retrieve audit events for a specific user.
   * Delegates to AuditLogger.getUserEvents.
   */
  async getUserEvents(
    userId: string,
    limit = 100,
    offset = 0,
  ): Promise<AuditEvent[]> {
    return this.logger.getUserEvents(userId, limit, offset)
  }
}
