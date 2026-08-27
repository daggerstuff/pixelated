import { ClaimsService } from '../../services/claims-service'
import type { Claim } from '../../types/claim'
/**
 * Clearinghouse Service
 *
 * Application service that coordinates clearinghouse operations with the
 * ClaimsService. Handles eligibility checks before claim creation, claim
 * submission after preparation, and remittance-driven status updates.
 *
 * @see ADR-003 (Clearinghouse Integration) — to be created
 */
import type { ClearinghouseAdapter } from './adapter'
import type {
  EligibilityRequest,
  EligibilityResponse,
  ClaimSubmissionRequest,
  ClaimSubmissionResponse,
  ClaimStatusRequest,
  ClaimStatusResponse,
  PrepareAndSubmitResult,
  RemittanceAdvice,
} from './types'

/**
 * Service for clearinghouse operations.
 *
 * Wraps a ClearinghouseAdapter and coordinates with ClaimsService for
 * claim lifecycle management. The adapter handles external communication;
 * this service handles application-level concerns like state transitions.
 */
export class ClearinghouseService {
  constructor(
    private readonly adapter: ClearinghouseAdapter,
    private readonly claimsService: ClaimsService,
  ) {}

  /**
   * Verify patient eligibility before creating or submitting a claim.
   *
   * @param request - Eligibility verification parameters
   * @returns Eligibility response with coverage details
   */
  async verifyEligibility(
    request: EligibilityRequest,
  ): Promise<EligibilityResponse> {
    return this.adapter.verifyEligibility(request)
  }

  /**
   * Prepare a draft claim and submit it to the clearinghouse.
   *
   * This combines ClaimsService.prepareForSubmission (validates and
   * transitions draft → active) with adapter.submitClaim (sends to
   * clearinghouse). If the clearinghouse rejects the claim, the claim
   * remains in "active" status locally — only the submission failed.
   *
   * @param claim - The draft claim to prepare and submit
   * @param payerId - Optional payer routing override
   * @returns Prepared claim and submission response with tracking ID
   */
  async prepareAndSubmit(
    claim: Claim,
    payerId?: string,
  ): Promise<PrepareAndSubmitResult> {
    const prepared = this.claimsService.prepareForSubmission(claim)
    const submissionResponse = await this.adapter.submitClaim({
      claim: prepared,
      payerId,
    })
    return { preparedClaim: prepared, submissionResponse }
  }

  /**
   * Submit an already-prepared (active) claim to the clearinghouse.
   *
   * @param claim - The active claim to submit
   * @param payerId - Optional payer routing override
   * @returns Submission response with tracking ID
   */
  async submitClaim(
    claim: Claim,
    payerId?: string,
  ): Promise<ClaimSubmissionResponse> {
    if (claim.status !== 'active') {
      throw new Error(
        `Cannot submit claim: expected status "active", got "${claim.status}"`,
      )
    }
    return this.adapter.submitClaim({ claim, payerId })
  }

  /**
   * Check the adjudication status of a submitted claim.
   *
   * @param trackingId - Tracking ID from the submission response
   * @returns Current claim status from the clearinghouse
   */
  async checkClaimStatus(trackingId: string): Promise<ClaimStatusResponse> {
    return this.adapter.checkClaimStatus({ trackingId })
  }

  /**
   * Process an incoming remittance advice and return parsed line items.
   *
   * The caller is responsible for updating local claim records based on
   * the returned line items — this service does not mutate any stored data.
   *
   * @param rawRemittance - Raw remittance advice data
   * @returns Parsed remittance advice with per-claim line items
   */
  async processRemittance(rawRemittance: string): Promise<RemittanceAdvice> {
    return this.adapter.processRemittance(rawRemittance)
  }

  /**
   * Update a local claim based on a remittance line item.
   *
   * Applies the adjudication status to the claim using ClaimsService
   * status transitions. Only "paid", "denied", and "partially-paid"
   * statuses trigger a local status change; other statuses are informational.
   *
   * @param claim - The local claim to update
   * @param line - The remittance line item with adjudication results
   * @returns Updated claim, or the original claim if no transition applies
   */
  applyRemittanceLine(
    claim: Claim,
    line: RemittanceAdvice['lines'][number],
  ): Claim {
    // Remittance statuses map to local claim status transitions.
    // The local Claim FHIR resource only supports: active, cancelled,
    // draft, entered-in-error. Adjudication results are informational
    // metadata — the local status stays "active" unless the claim is
    // cancelled or entered-in-error.
    if (line.status === 'denied') {
      // A denied claim can be cancelled locally.
      if (claim.status === 'active') {
        return this.claimsService.updateStatus(claim, 'cancelled')
      }
    }
    // For paid, partially-paid, and other statuses, the local FHIR Claim
    // remains "active" — adjudication details are tracked separately
    // (e.g. in a ClaimResponse resource or billing metadata).
    return claim
  }
}
