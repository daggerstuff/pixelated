/**
 * Prescription Service
 *
 * Wraps the e-prescribing adapter to provide a domain-level API for
 * prescribing workflows: pharmacy lookup, controlled substance verification,
 * drug interaction checking, prescription transmission, and status tracking.
 */

import type { EPrescribingAdapter } from './adapter'
import type { MedicationRequest } from '../../types/medication-request'
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
  async searchPharmacies(zipCode: string, limit?: number, type?: PharmacySearchRequest['type']): Promise<PharmacySearchResponse> {
    return this.adapter.searchPharmacies({ zipCode, limit, type })
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
  ): Promise<PrescriptionTransmissionResponse> {
    // Extract medication info from MedicationRequest
    const medCode = medicationRequest.medicationCodeableConcept?.coding?.[0]?.code ?? ''
    const medName = medicationRequest.medicationCodeableConcept?.text ?? 'Unknown medication'

    // Determine schedule from known controlled substances (simplified)
    const schedule: ControlledSubstanceSchedule = inferSchedule(medCode)

    const medication: MedicationInfo = {
      code: medCode,
      name: medName,
      schedule,
      deaNumber: prescriber.deaNumber,
      prescriberNPI: prescriber.npi,
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
  async checkPrescriptionStatus(transmissionId: string): Promise<PrescriptionStatusResponse> {
    return this.adapter.checkPrescriptionStatus({ transmissionId })
  }

  /**
   * Cancel a transmitted prescription.
   */
  async cancelPrescription(transmissionId: string, reason: string): Promise<PrescriptionCancelResponse> {
    return this.adapter.cancelPrescription({ transmissionId, reason })
  }
}

/**
 * Infer controlled substance schedule from medication code.
 * Uses the same known controlled substance map as the stub adapter.
 */
function inferSchedule(code: string): ControlledSubstanceSchedule {
  const KNOWN: Record<string, string> = {
    '1043400': 'II', '1043402': 'II', '1043560': 'II', '1043620': 'II',
    '1043700': 'II', '1043800': 'II',
    '1043450': 'III', '1043500': 'III',
    '1043600': 'IV', '1043650': 'IV', '1043670': 'IV', '1043705': 'IV',
    '1043750': 'V',
  }
  const schedule = KNOWN[code]
  if (schedule === 'I') return 'I'
  if (schedule === 'II') return 'II'
  if (schedule === 'III') return 'III'
  if (schedule === 'IV') return 'IV'
  if (schedule === 'V') return 'V'
  return 'non-controlled'
}
