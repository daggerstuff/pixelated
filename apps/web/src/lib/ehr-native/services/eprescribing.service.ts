/**
 * E-Prescribing Orchestration Service (F3.4)
 *
 * Wraps the existing PrescriptionService with:
 * 1. Patient consent verification (consentService.hasActiveConsent)
 * 2. Comprehensive audit logging (EHRAuditService.logEPrescribe*)
 * 3. Delegation to PrescriptionService for input sanitization + safety gates
 *
 * @see docs/adr/ADR-004-eprescribing-vendor.md
 */

import { consentService } from '../../security/consent/ConsentService'
import { EHRAuditService } from '../audit/ehr-audit-service'
import type { EPrescribeAuditInput } from '../audit/ehr-audit-service'
import { EHRAuditAction } from '../audit/events'
import type { EPrescribingAdapter } from '../integrations/e-prescribing/adapter'
import {
  PrescriptionService,
  sanitizeZipCode,
} from '../integrations/e-prescribing/prescription-service'
import type {
  PharmacySearchRequest,
  PharmacySearchResponse,
  PharmacyInfo,
  MedicationInfo,
  ControlledSubstanceCheckResult,
  DrugInteractionCheckResponse,
  PrescriptionTransmissionResponse,
  PrescriptionStatusResponse,
  PrescriptionCancelResponse,
} from '../integrations/e-prescribing/types'
import type { MedicationRequest } from '../types/medication-request'

/** Consent type ID for e-prescribing operations */
export const EPRESCRIBING_CONSENT_TYPE_ID = 'eprescribing'

/** Narrow union of e-prescribe audit actions only */
type EPrescribeAction =
  | typeof EHRAuditAction.EPRESCRIBE_NEW_RX
  | typeof EHRAuditAction.EPRESCRIBE_REFILL
  | typeof EHRAuditAction.EPRESCRIBE_CANCEL
  | typeof EHRAuditAction.EPRESCRIBE_MEDICATION_HISTORY
  | typeof EHRAuditAction.EPRESCRIBE_DRUG_INTERACTION_CHECK

/**
 * Configuration for the e-prescribing orchestration service.
 */
export interface EPrescribingOrchestrationConfig {
  readonly adapter: EPrescribingAdapter
}

/**
 * Result when consent is denied — caller should handle gracefully.
 */
export class EPrescribeConsentDeniedError extends Error {
  constructor(
    readonly userId: string,
    readonly consentTypeId: string,
  ) {
    super(`Consent denied for user ${userId} (consent type: ${consentTypeId})`)
    this.name = 'EPrescribeConsentDeniedError'
  }
}

/**
 * E-prescribing orchestration service — consent gate + audit + delegation.
 *
 * Each method:
 * 1. Verifies patient consent via `consentService.hasActiveConsent`
 * 2. Delegates to `PrescriptionService` (which sanitizes inputs, runs safety
 *    gates for controlled substances and drug interactions, then calls the adapter)
 * 3. Logs the outcome to `EHRAuditService` via e-prescribe builder methods
 */
export class EPrescribingOrchestrationService {
  private readonly prescriptionService: PrescriptionService
  private readonly auditService: EHRAuditService

  constructor(config: EPrescribingOrchestrationConfig) {
    this.prescriptionService = new PrescriptionService(config.adapter)
    this.auditService = EHRAuditService.getInstance()
  }

  /**
   * Search for pharmacies by ZIP code.
   * No patient data involved — consent not required.
   */
  async searchPharmacies(
    _userId: string,
    zipCode: string,
    limit?: number,
    type?: PharmacySearchRequest['type'],
  ): Promise<PharmacySearchResponse> {
    const validatedZip = sanitizeZipCode(zipCode)
    const validatedLimit =
      limit === undefined ? undefined : Math.max(1, Math.min(limit, 100))
    return this.prescriptionService.searchPharmacies(
      validatedZip,
      validatedLimit,
      type,
    )
  }

  /**
   * Check if a controlled substance can be prescribed.
   * Requires active e-prescribing consent.
   */
  async checkControlledSubstance(
    userId: string,
    medication: MedicationInfo,
    patientId: string,
    _prescriberNPI: string,
    priorPrescriptions?: MedicationRequest[],
  ): Promise<ControlledSubstanceCheckResult> {
    await this.requireConsent(userId, patientId)

    let result: ControlledSubstanceCheckResult
    try {
      result = await this.prescriptionService.checkControlledSubstance(
        medication,
        patientId,
        priorPrescriptions,
      )
    } catch (error) {
      await this.auditError(
        EHRAuditAction.EPRESCRIBE_DRUG_INTERACTION_CHECK,
        userId,
        patientId,
        error,
      )
      throw error
    }

    await this.auditSuccess(
      EHRAuditAction.EPRESCRIBE_DRUG_INTERACTION_CHECK,
      userId,
      patientId,
      { allowed: result.allowed, epcsRequired: result.epcsRequired },
    )

    return result
  }

  /**
   * Check for drug interactions against active medications.
   * Requires active e-prescribing consent.
   */
  async checkDrugInteractions(
    userId: string,
    medication: MedicationInfo,
    patientId: string,
    activeMedications: MedicationRequest[],
  ): Promise<DrugInteractionCheckResponse> {
    await this.requireConsent(userId, patientId)

    let result: DrugInteractionCheckResponse
    try {
      result = await this.prescriptionService.checkDrugInteractions(
        medication,
        patientId,
        activeMedications,
      )
    } catch (error) {
      await this.auditError(
        EHRAuditAction.EPRESCRIBE_DRUG_INTERACTION_CHECK,
        userId,
        patientId,
        error,
      )
      throw error
    }

    await this.auditSuccess(
      EHRAuditAction.EPRESCRIBE_DRUG_INTERACTION_CHECK,
      userId,
      patientId,
      {
        hasInteractions: result.hasInteractions,
        alertCount: result.alerts.length,
      },
    )

    return result
  }

  /**
   * Transmit a new prescription to a pharmacy.
   * Requires active e-prescribing consent.
   * Safety gates (controlled substance + drug interaction) run inside PrescriptionService.
   */
  async transmitPrescription(
    userId: string,
    medicationRequest: MedicationRequest,
    pharmacy: PharmacyInfo,
    prescriber: { npi: string; name: string; deaNumber?: string },
    activeMedications: MedicationRequest[] = [],
  ): Promise<PrescriptionTransmissionResponse> {
    const patientId = this.extractPatientId(medicationRequest)
    await this.requireConsent(userId, patientId)

    let result: PrescriptionTransmissionResponse
    try {
      result = await this.prescriptionService.transmitPrescription(
        medicationRequest,
        pharmacy,
        prescriber,
        activeMedications,
      )
    } catch (error) {
      await this.auditError(
        EHRAuditAction.EPRESCRIBE_NEW_RX,
        userId,
        patientId,
        error,
        {
          medicationRequestId:
            this.extractMedicationRequestId(medicationRequest),
        },
      )
      throw error
    }

    await this.auditSuccess(
      EHRAuditAction.EPRESCRIBE_NEW_RX,
      userId,
      patientId,
      {
        transmissionId: result.transmissionId,
        status: result.status,
        medicationRequestId: this.extractMedicationRequestId(medicationRequest),
      },
    )

    return result
  }

  /**
   * Check the status of a previously transmitted prescription.
   * Requires active e-prescribing consent.
   */
  async checkPrescriptionStatus(
    userId: string,
    patientId: string,
    transmissionId: string,
  ): Promise<PrescriptionStatusResponse> {
    await this.requireConsent(userId, patientId)

    let result: PrescriptionStatusResponse
    try {
      result =
        await this.prescriptionService.checkPrescriptionStatus(transmissionId)
    } catch (error) {
      await this.auditError(
        EHRAuditAction.EPRESCRIBE_MEDICATION_HISTORY,
        userId,
        patientId,
        error,
      )
      throw error
    }

    await this.auditSuccess(
      EHRAuditAction.EPRESCRIBE_MEDICATION_HISTORY,
      userId,
      patientId,
      { transmissionId: result.transmissionId, status: result.status },
    )

    return result
  }

  /**
   * Cancel a previously transmitted prescription.
   * Requires active e-prescribing consent.
   */
  async cancelPrescription(
    userId: string,
    patientId: string,
    transmissionId: string,
    reason: string,
  ): Promise<PrescriptionCancelResponse> {
    await this.requireConsent(userId, patientId)

    let result: PrescriptionCancelResponse
    try {
      result = await this.prescriptionService.cancelPrescription(
        transmissionId,
        reason,
      )
    } catch (error) {
      await this.auditError(
        EHRAuditAction.EPRESCRIBE_CANCEL,
        userId,
        patientId,
        error,
      )
      throw error
    }

    await this.auditSuccess(
      EHRAuditAction.EPRESCRIBE_CANCEL,
      userId,
      patientId,
      { transmissionId: result.transmissionId, cancelled: result.cancelled },
    )

    return result
  }

  // ─── Private helpers ───────────────────────────────────────────

  /**
   * Verify the user has active e-prescribing consent for this patient.
   * @throws {EPrescribeConsentDeniedError} if consent is not active
   */
  private async requireConsent(
    userId: string,
    _patientId: string,
  ): Promise<void> {
    const hasConsent = await consentService.hasActiveConsent(
      userId,
      EPRESCRIBING_CONSENT_TYPE_ID,
    )
    if (!hasConsent) {
      throw new EPrescribeConsentDeniedError(
        userId,
        EPRESCRIBING_CONSENT_TYPE_ID,
      )
    }
  }

  /**
   * Extract patient ID from a FHIR R4 MedicationRequest.
   * The subject reference is formatted as "Patient/{id}".
   */
  private extractPatientId(medicationRequest: MedicationRequest): string {
    const ref = medicationRequest.subject?.reference
    if (!ref) {
      throw new Error('MedicationRequest.subject.reference is required')
    }
    const match = ref.match(/^Patient\/(.+)$/)
    if (!match) {
      throw new Error(`Invalid subject reference: ${ref}`)
    }
    return match[1]
  }

  /**
   * Extract the medication request ID from a FHIR R4 MedicationRequest.
   * The identifier field is an array of {value} objects.
   */
  private extractMedicationRequestId(
    medicationRequest: MedicationRequest,
  ): string | undefined {
    const idEntry = medicationRequest.identifier?.[0]
    return idEntry?.value
  }

  private async auditSuccess(
    action: EPrescribeAction,
    userId: string,
    patientId: string,
    metadata: Record<string, unknown> = {},
    extra?: { medicationRequestId?: string },
  ): Promise<void> {
    const input: EPrescribeAuditInput = {
      userId,
      status: 'success',
      patientId,
      integrationSource: 'dosespot',
      medicationRequestId: extra?.medicationRequestId,
      metadata,
    }
    this.routeAudit(action, input)
  }

  private async auditError(
    action: EPrescribeAction,
    userId: string,
    patientId: string,
    error: unknown,
    extra?: { medicationRequestId?: string },
  ): Promise<void> {
    const input: EPrescribeAuditInput = {
      userId,
      status: 'failure',
      errorMessage: error instanceof Error ? error.message : String(error),
      patientId,
      integrationSource: 'dosespot',
      medicationRequestId: extra?.medicationRequestId,
    }
    this.routeAudit(action, input)
  }

  /**
   * Route the audit call to the appropriate builder method.
   */
  private routeAudit(
    action: EPrescribeAction,
    input: EPrescribeAuditInput,
  ): void {
    switch (action) {
      case EHRAuditAction.EPRESCRIBE_NEW_RX:
        void this.auditService.logEPrescribeNewRx(input)
        break
      case EHRAuditAction.EPRESCRIBE_REFILL:
        void this.auditService.logEPrescribeRefill(input)
        break
      case EHRAuditAction.EPRESCRIBE_CANCEL:
        void this.auditService.logEPrescribeCancel(input)
        break
      case EHRAuditAction.EPRESCRIBE_MEDICATION_HISTORY:
        void this.auditService.logEPrescribeMedicationHistory(input)
        break
      case EHRAuditAction.EPRESCRIBE_DRUG_INTERACTION_CHECK:
        void this.auditService.logEPrescribeDrugInteractionCheck(input)
        break
    }
  }
}
