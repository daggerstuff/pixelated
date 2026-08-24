/**
 * E-Prescribing Integration Types
 *
 * Types for medication prescribing workflow including controlled substance
 * classification, pharmacy lookup, prescription transmission, and status tracking.
 * Per ADR-004 (to be written): e-prescribing integrates with Surescripts or similar.
 */

import type { MedicationRequest } from '../../types/medication-request'

/** DEA controlled substance schedules. */
export type ControlledSubstanceSchedule =
  | 'I'
  | 'II'
  | 'III'
  | 'IV'
  | 'V'
  | 'non-controlled'

/** Medication information for prescribing. */
export interface MedicationInfo {
  /** RxNorm or NDC code. */
  readonly code: string
  /** Medication display name. */
  readonly name: string
  /** Controlled substance schedule. */
  readonly schedule: ControlledSubstanceSchedule
  /** DEA number of the prescribing practitioner (required for controlled substances). */
  readonly deaNumber?: string
  /** NPI of the prescriber. */
  readonly prescriberNPI: string
}

/** Pharmacy search request. */
export interface PharmacySearchRequest {
  /** ZIP code for nearby pharmacy lookup. */
  readonly zipCode: string
  /** Maximum results to return (default 10). */
  readonly limit?: number
  /** Optional pharmacy type filter. */
  readonly type?: 'retail' | 'mail-order' | 'hospital'
}

/** Individual pharmacy result. */
export interface PharmacyInfo {
  /** NCPDP pharmacy identifier. */
  readonly ncpdpId: string
  /** Pharmacy name. */
  readonly name: string
  /** Address lines. */
  readonly address: readonly string[]
  /** City. */
  readonly city: string
  /** State. */
  readonly state: string
  /** ZIP code. */
  readonly zipCode: string
  /** Phone number. */
  readonly phone: string
  /** Fax number (optional). */
  readonly fax?: string
  /** Pharmacy type. */
  readonly type: 'retail' | 'mail-order' | 'hospital'
  /** Whether 24-hour service is available. */
  readonly twentyFourHours?: boolean
}

/** Pharmacy search response. */
export interface PharmacySearchResponse {
  readonly pharmacies: readonly PharmacyInfo[]
  readonly total: number
}

/** Controlled substance verification request. */
export interface ControlledSubstanceCheckRequest {
  readonly medication: MedicationInfo
  readonly patientId: string
  readonly prescriberNPI: string
  /** Optional prior prescription history for PDMP check. */
  readonly priorPrescriptions?: readonly MedicationRequest[]
}

/** Controlled substance check result. */
export interface ControlledSubstanceCheckResult {
  readonly allowed: boolean
  /** Reason if not allowed. */
  readonly reason?: string
  /** Whether PDMP (Prescription Drug Monitoring Program) check was performed. */
  readonly pdmpChecked: boolean
  /** PDMP findings if checked. */
  readonly pdmpFindings?: string
  /** Whether EPCS (Electronic Prescribing of Controlled Substances) is required. */
  readonly epcsRequired: boolean
}

/** Prescription transmission request. */
export interface PrescriptionTransmissionRequest {
  readonly medicationRequest: MedicationRequest
  readonly pharmacy: PharmacyInfo
  readonly prescriber: {
    readonly npi: string
    readonly name: string
    readonly deaNumber?: string
  }
}

/** Prescription transmission response. */
export interface PrescriptionTransmissionResponse {
  /** Transmission ID from the e-prescribing network. */
  readonly transmissionId: string
  /** Current status of the prescription. */
  readonly status: PrescriptionStatus
  /** Timestamp of transmission. */
  readonly transmittedAt: string
  /** Any error or warning messages. */
  readonly message?: string
}

/** Prescription status values. */
export type PrescriptionStatus =
  | 'pending'
  | 'transmitted'
  | 'received'
  | 'filled'
  | 'cancelled'
  | 'error'

/** Prescription status query request. */
export interface PrescriptionStatusRequest {
  readonly transmissionId: string
}

/** Prescription status query response. */
export interface PrescriptionStatusResponse {
  readonly transmissionId: string
  readonly status: PrescriptionStatus
  readonly updatedAt: string
  readonly message?: string
}

/** Prescription cancel request. */
export interface PrescriptionCancelRequest {
  readonly transmissionId: string
  readonly reason: string
}

/** Prescription cancel response. */
export interface PrescriptionCancelResponse {
  readonly transmissionId: string
  readonly cancelled: boolean
  readonly cancelledAt: string
  readonly message?: string
}

/** Drug interaction alert. */
export interface DrugInteractionAlert {
  readonly severity: 'critical' | 'major' | 'moderate' | 'minor'
  readonly description: string
  readonly interactingDrugs: readonly string[]
}

/** Drug interaction check request. */
export interface DrugInteractionCheckRequest {
  readonly medication: MedicationInfo
  readonly patientId: string
  /** Currently active medications for the patient. */
  readonly activeMedications: readonly MedicationRequest[]
}

/** Drug interaction check response. */
export interface DrugInteractionCheckResponse {
  readonly hasInteractions: boolean
  readonly alerts: readonly DrugInteractionAlert[]
}
