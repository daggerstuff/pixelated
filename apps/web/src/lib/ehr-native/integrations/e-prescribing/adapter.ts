/**
 * E-Prescribing Adapter Interface
 *
 * Defines the contract for e-prescribing network integration including
 * pharmacy lookup, controlled substance verification, prescription transmission,
 * drug interaction checking, and status tracking.
 */

import type {
  PharmacySearchRequest,
  PharmacySearchResponse,
  ControlledSubstanceCheckRequest,
  ControlledSubstanceCheckResult,
  PrescriptionTransmissionRequest,
  PrescriptionTransmissionResponse,
  PrescriptionStatusRequest,
  PrescriptionStatusResponse,
  PrescriptionCancelRequest,
  PrescriptionCancelResponse,
  DrugInteractionCheckRequest,
  DrugInteractionCheckResponse,
} from './types'

export interface EPrescribingAdapter {
  /** Search for pharmacies by ZIP code. */
  searchPharmacies(
    request: PharmacySearchRequest,
  ): Promise<PharmacySearchResponse>

  /** Verify controlled substance prescribing eligibility (PDMP + EPCS). */
  checkControlledSubstance(
    request: ControlledSubstanceCheckRequest,
  ): Promise<ControlledSubstanceCheckResult>

  /** Check for drug interactions with active medications. */
  checkDrugInteractions(
    request: DrugInteractionCheckRequest,
  ): Promise<DrugInteractionCheckResponse>

  /** Transmit a prescription to a pharmacy. */
  transmitPrescription(
    request: PrescriptionTransmissionRequest,
  ): Promise<PrescriptionTransmissionResponse>

  /** Check the status of a transmitted prescription. */
  checkPrescriptionStatus(
    request: PrescriptionStatusRequest,
  ): Promise<PrescriptionStatusResponse>

  /** Cancel a transmitted prescription. */
  cancelPrescription(
    request: PrescriptionCancelRequest,
  ): Promise<PrescriptionCancelResponse>
}
