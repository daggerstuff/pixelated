/**
 * Clearinghouse Integration Types
 *
 * Types for eligibility verification, claim submission, status tracking,
 * and remittance advice processing through a clearinghouse adapter.
 *
 * @see ADR-003 (Clearinghouse Integration) — to be created
 */
import type { Claim } from '../../types/claim'

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

/** Request to verify patient insurance eligibility for a specific service. */
export interface EligibilityRequest {
  /** Patient identifier (FHIR Patient reference, e.g. "Patient/123"). */
  patientId: string
  /** Payer/insurer identifier (e.g. NPI or payer ID). */
  payerId: string
  /** Payer name (human-readable). */
  payerName?: string
  /** Member/subscriber ID as printed on the insurance card. */
  memberId: string
  /** Service type code (e.g. "30" for health benefit plan, "76" for pharmacy). */
  serviceTypeCode?: string
  /** Date of service to check eligibility for (ISO 8601). */
  serviceDate?: string
}

/** Result of an eligibility verification check. */
export interface EligibilityResponse {
  /** Whether the patient is eligible for the requested service. */
  eligible: boolean
  /** Payer confirmation that coverage is active. */
  activeCoverage: boolean
  /** Co-pay amount in cents, if known. */
  copay?: number
  /** Coinsurance percentage (0-100), if known. */
  coinsurancePercent?: number
  /** Deductible remaining in cents, if known. */
  deductibleRemaining?: number
  /** Visit limit remaining, if applicable. */
  visitLimitRemaining?: number
  /** Plan year start date (ISO 8601), if known. */
  planYearStart?: string
  /** Plan year end date (ISO 8601), if known. */
  planYearEnd?: string
  /** Free-form messages from the payer. */
  messages: string[]
  /** Any errors encountered during verification. */
  errors: string[]
}

// ---------------------------------------------------------------------------
// Claim Submission
// ---------------------------------------------------------------------------

/** Request to submit a prepared FHIR Claim to a clearinghouse. */
export interface ClaimSubmissionRequest {
  /** The FHIR R4 Claim resource to submit. Must have status "active". */
  claim: Claim
  /** Optional payer-specific routing override. */
  payerId?: string
  /** Optional correlation/trace ID for tracking. */
  correlationId?: string
}

/** Result of submitting a claim to a clearinghouse. */
export interface ClaimSubmissionResponse {
  /** Whether the submission was accepted by the clearinghouse. */
  accepted: boolean
  /** Clearinghouse-assigned tracking/claim ID. */
  trackingId?: string
  /** Payer-assigned claim ID, if available immediately. */
  payerClaimId?: string
  /** Submission status. */
  status: SubmissionStatus
  /** Timestamp of submission (ISO 8601). */
  submittedAt: string
  /** Rejection reason, if rejected. */
  rejectionReason?: string
  /** Rejection code, if rejected. */
  rejectionCode?: string
  /** Free-form messages from the clearinghouse. */
  messages: string[]
}

/** Result of preparing and submitting a claim in one step. */
export interface PrepareAndSubmitResult {
  /** The prepared claim (status transitioned to 'active'). */
  readonly preparedClaim: Claim
  /** The clearinghouse submission response. */
  readonly submissionResponse: ClaimSubmissionResponse
}

/** Status of a submitted claim. */
export type SubmissionStatus =
  | 'accepted'
  | 'rejected'
  | 'pending'
  | 'queued'

// ---------------------------------------------------------------------------
// Claim Status Tracking
// ---------------------------------------------------------------------------

/** Request to check the status of a previously submitted claim. */
export interface ClaimStatusRequest {
  /** Clearinghouse-assigned tracking ID from the submission response. */
  trackingId: string
  /** Optional payer-assigned claim ID. */
  payerClaimId?: string
}

/** Current status of a submitted claim from the clearinghouse. */
export interface ClaimStatusResponse {
  /** Internal tracking ID. */
  trackingId: string
  /** Payer-assigned claim ID, if available. */
  payerClaimId?: string
  /** Current adjudication status. */
  status: ClaimAdjudicationStatus
  /** Timestamp of last status update (ISO 8601). */
  updatedAt: string
  /** Amount paid by payer in cents, if adjudicated. */
  paidAmount?: number
  /** Amount the patient owes in cents, if adjudicated. */
  patientResponsibility?: number
  /** Denial reason, if denied. */
  denialReason?: string
  /** Denial code, if denied. */
  denialCode?: string
  /** Free-form messages from the clearinghouse. */
  messages: string[]
}

/** Adjudication status of a submitted claim. */
export type ClaimAdjudicationStatus =
  | 'received'
  | 'in-review'
  | 'adjudicated'
  | 'paid'
  | 'denied'
  | 'partially-paid'
  | 'pended'
  | 'cancelled'

// ---------------------------------------------------------------------------
// Remittance Advice (ERA/835)
// ---------------------------------------------------------------------------

/** A single line item in a remittance advice. */
export interface RemittanceLine {
  /** Clearinghouse tracking ID for the original claim. */
  trackingId: string
  /** Payer-assigned claim ID. */
  payerClaimId: string
  /** Patient identifier (FHIR Patient reference). */
  patientId: string
  /** Charged amount in cents. */
  billedAmount: number
  /** Amount paid by payer in cents. */
  paidAmount: number
  /** Amount the patient owes in cents. */
  patientResponsibility: number
  /** Adjustment reason code (e.g. CO-45, PR-1). */
  adjustmentCode?: string
  /** Adjustment reason description. */
  adjustmentReason?: string
  /** Final adjudication status. */
  status: ClaimAdjudicationStatus
}

/** An Electronic Remittance Advice (ERA/835) from a payer. */
export interface RemittanceAdvice {
  /** Payer identifier. */
  payerId: string
  /** Payer name. */
  payerName?: string
  /** Remittance advice number from the payer. */
  adviceNumber: string
  /** Date of the remittance (ISO 8601). */
  remittanceDate: string
  /** Total amount paid in cents. */
  totalPaid: number
  /** Number of claims in this remittance. */
  claimCount: number
  /** Individual claim line items. */
  lines: RemittanceLine[]
}
