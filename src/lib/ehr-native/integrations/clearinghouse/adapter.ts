/**
 * Clearinghouse Adapter Interface
 *
 * Defines the contract for a clearinghouse integration adapter.
 * Implementations handle eligibility verification, claim submission,
 * status tracking, and remittance advice processing.
 *
 * @see ADR-003 (Clearinghouse Integration) — to be created
 */
import type {
  EligibilityRequest,
  EligibilityResponse,
  ClaimSubmissionRequest,
  ClaimSubmissionResponse,
  ClaimStatusRequest,
  ClaimStatusResponse,
  RemittanceAdvice,
} from './types'

/**
 * Adapter interface for clearinghouse operations.
 *
 * A clearinghouse sits between the provider (us) and the payer (insurance company),
 * handling claim routing, eligibility checks, and remittance processing.
 *
 * Implementations may be:
 * - Stub: in-memory simulation for development/testing
 * - Real: HTTP client for a specific clearinghouse (e.g. Availity, Change Healthcare)
 */
export interface ClearinghouseAdapter {
  /** Adapter name for logging and diagnostics. */
  readonly name: string

  /**
   * Verify patient insurance eligibility for a specific service.
   *
   * @param request - Eligibility verification parameters
   * @returns Eligibility response with coverage details
   */
  verifyEligibility(request: EligibilityRequest): Promise<EligibilityResponse>

  /**
   * Submit a prepared FHIR Claim to the clearinghouse for routing to the payer.
   *
   * The claim must have status "active" (validated via ClaimsService.prepareForSubmission).
   *
   * @param request - Claim submission parameters
   * @returns Submission response with tracking ID and acceptance status
   */
  submitClaim(request: ClaimSubmissionRequest): Promise<ClaimSubmissionResponse>

  /**
   * Check the current adjudication status of a previously submitted claim.
   *
   * @param request - Status tracking parameters (tracking ID from submitClaim)
   * @returns Current claim status from the clearinghouse
   */
  checkClaimStatus(request: ClaimStatusRequest): Promise<ClaimStatusResponse>

  /**
   * Process an incoming remittance advice (ERA/835) from a payer.
   *
   * Parses the remittance and returns structured line items for each claim.
   *
   * @param rawRemittance - Raw remittance advice data (format depends on adapter)
   * @returns Parsed remittance advice with per-claim line items
   */
  processRemittance(rawRemittance: string): Promise<RemittanceAdvice>
}
