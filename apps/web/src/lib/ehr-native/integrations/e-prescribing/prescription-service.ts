/**
 * Prescription Service
 *
 * Wraps the e-prescribing adapter to provide a domain-level API for
 * prescribing workflows: pharmacy lookup, controlled substance verification,
 * drug interaction checking, prescription transmission, and status tracking.
 */

import type { MedicationRequest } from '../../types/medication-request'
import type { EPrescribingAdapter } from './adapter'
import type {
  PharmacySearchRequest,
  PharmacySearchResponse,
  PharmacyInfo,
  ControlledSubstanceCheckRequest,
  ControlledSubstanceCheckResult,
  DrugInteractionCheckRequest,
  DrugInteractionCheckResponse,
  PrescriptionTransmissionRequest,
  PrescriptionTransmissionResponse,
  PrescriptionStatusRequest,
  PrescriptionStatusResponse,
  PrescriptionCancelRequest,
  PrescriptionCancelResponse,
  MedicationInfo,
  ControlledSubstanceSchedule,
} from './types'

export class PrescriptionService {
  constructor(private readonly adapter: EPrescribingAdapter) {}

  /**
   * Search for pharmacies near a ZIP code.
   */
  async searchPharmacies(
    zipCode: string,
    limit?: number,
    type?: PharmacySearchRequest['type'],
  ): Promise<PharmacySearchResponse> {
    return this.adapter.searchPharmacies({
      zipCode: sanitizeZipCode(zipCode),
      limit,
      type,
    })
  }

  /**
   * Verify controlled substance prescribing eligibility.
   * Checks DEA number, PDMP history, and EPCS requirements.
   */
  async checkControlledSubstance(
    medication: MedicationInfo,
    patientId: string,
    priorPrescriptions?: readonly MedicationRequest[],
  ): Promise<ControlledSubstanceCheckResult> {
    const request: ControlledSubstanceCheckRequest = {
      medication,
      patientId,
      prescriberNPI: medication.prescriberNPI,
      priorPrescriptions,
    }
    return this.adapter.checkControlledSubstance(request)
  }

  /**
   * Check for drug interactions with active medications.
   */
  async checkDrugInteractions(
    medication: MedicationInfo,
    patientId: string,
    activeMedications: readonly MedicationRequest[],
  ): Promise<DrugInteractionCheckResponse> {
    const request: DrugInteractionCheckRequest = {
      medication,
      patientId,
      activeMedications,
    }
    return this.adapter.checkDrugInteractions(request)
  }

  /**
   * Transmit a prescription to a pharmacy.
   * Performs controlled substance check and drug interaction check before transmission.
   */
  async transmitPrescription(
    medicationRequest: MedicationRequest,
    pharmacy: PharmacyInfo,
    prescriber: {
      readonly npi: string
      readonly name: string
      readonly deaNumber?: string
    },
    activeMedications: readonly MedicationRequest[] = [],
  ): Promise<PrescriptionTransmissionResponse> {
    // Extract medication info from MedicationRequest
    const medCode =
      medicationRequest.medicationCodeableConcept?.coding?.[0]?.code ?? ''
    const medName =
      medicationRequest.medicationCodeableConcept?.text ?? 'Unknown medication'

    // Determine schedule from known controlled substances (simplified)
    const schedule: ControlledSubstanceSchedule = inferSchedule(medCode)

    const medication: MedicationInfo = {
      code: medCode,
      name: medName,
      schedule,
      deaNumber: prescriber.deaNumber,
      prescriberNPI: prescriber.npi,
    }

    const patientId = extractPatientId(medicationRequest)

    // Safety gate: controlled substance eligibility must pass before any
    // transmission (DEA/EPCS/PDMP requirements).
    const controlledResult = await this.checkControlledSubstance(
      medication,
      patientId,
    )
    if (!controlledResult.allowed) {
      throw new Error(
        `Transmission blocked by controlled substance check: ${
          controlledResult.reason ?? 'not allowed'
        }`,
      )
    }

    // Safety gate: critical or major drug interactions prevent transmission;
    // moderate/minor alerts are surfaced to reviewers but do not block.
    const interactionResult = await this.checkDrugInteractions(
      medication,
      patientId,
      activeMedications,
    )
    const blockingAlerts = interactionResult.alerts.filter(
      (alert) => alert.severity === 'critical' || alert.severity === 'major',
    )
    if (blockingAlerts.length > 0) {
      const details = blockingAlerts
        .map((alert) => alert.description)
        .join('; ')
      throw new Error(
        `Transmission blocked by ${blockingAlerts.length} major/critical drug interaction(s): ${details}`,
      )
    }

    const request: PrescriptionTransmissionRequest = {
      medicationRequest,
      pharmacy,
      prescriber,
    }
    return this.adapter.transmitPrescription(request)
  }

  /**
   * Check the status of a transmitted prescription.
   */
  async checkPrescriptionStatus(
    transmissionId: string,
  ): Promise<PrescriptionStatusResponse> {
    return this.adapter.checkPrescriptionStatus({ transmissionId })
  }

  /**
   * Cancel a transmitted prescription.
   */
  async cancelPrescription(
    transmissionId: string,
    reason: string,
  ): Promise<PrescriptionCancelResponse> {
    return this.adapter.cancelPrescription({ transmissionId, reason })
  }
}

/**
 * Extract the bare patient ID from a FHIR R4 subject reference.
 *
 * The subject reference is formatted as "Patient/{id}". Extracting here (not
 * passing the raw reference through) keeps the patient identifier format
 * consistent across the safety gates, the adapter, and the orchestration
 * consent gate — DoseSpot must receive the same bare patient ID the rest of
 * the orchestration flow uses. Throws (fail closed) on missing or malformed
 * references so patient lookup / PDMP checks never run against an
 * identifier like "Patient/123".
 */
export function extractPatientId(
  medicationRequest: Pick<MedicationRequest, 'subject'>,
): string {
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
 * Validate a US ZIP code (5 digits or ZIP+4) before adapter search so
 * unsanitized input never reaches FHIR/pharmacy lookup paths.
 */
export function sanitizeZipCode(zipCode: string): string {
  const trimmed = zipCode.trim()
  if (!/^\d{5}(-\d{4})?$/.test(trimmed)) {
    throw new Error(
      'Invalid ZIP code: expected 5 digits or ZIP+4 (e.g. 45202 or 45202-1234)',
    )
  }
  return trimmed
}

/**
 * Infer controlled substance schedule from medication code.
 * Uses the same known controlled substance map as the stub adapter.
 */
const KNOWN_SCHEDULES: Record<string, ControlledSubstanceSchedule> = {
  '1043400': 'II',
  '1043402': 'II',
  '1043560': 'II',
  '1043620': 'II',
  '1043700': 'II',
  '1043800': 'II',
  '1043450': 'III',
  '1043500': 'III',
  '1043600': 'IV',
  '1043650': 'IV',
  '1043670': 'IV',
  '1043705': 'IV',
  '1043750': 'V',
}

/**
 * Infer controlled substance schedule from medication code.
 *
 * A medication with NO code fails closed: it is escalated to the
 * adapter's controlled-substance gate instead of being silently treated
 * as non-controlled, so the transmission path can never bypass
 * controlled-substance safety checks on missing data. Codes outside the
 * known formulary are also routed through the adapter's gate, which uses
 * real drug data to catch unlisted controlled substances.
 */
function inferSchedule(code: string): ControlledSubstanceSchedule {
  if (!code) {
    throw new Error(
      'Medication code is required for controlled substance schedule inference',
    )
  }
  return KNOWN_SCHEDULES[code] ?? 'non-controlled'
}
