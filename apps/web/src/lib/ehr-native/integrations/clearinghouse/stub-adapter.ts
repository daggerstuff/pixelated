const VALID_ADJUDICATION_STATUSES = new Set<string>([
  'received',
  'in-review',
  'adjudicated',
  'paid',
  'denied',
  'partially-paid',
  'pended',
  'cancelled',
])

function parseAdjudicationStatus(value: string): ClaimAdjudicationStatus {
  return VALID_ADJUDICATION_STATUSES.has(value)
    ? (value as ClaimAdjudicationStatus)
    : 'received'
}

/**
 * Stub Clearinghouse Adapter
 *
 * In-memory simulation of clearinghouse operations for development and testing.
 * No real external API calls are made. Responses are deterministic based on input.
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
  RemittanceAdvice,
  ClaimAdjudicationStatus,
} from './types'

/**
 * Stub clearinghouse adapter for development and testing.
 *
 * Behavior:
 * - Eligibility: returns eligible=true for all requests with valid member IDs
 * - Submission: accepts all claims with status "active" and generates a tracking ID
 * - Status: simulates a progression through adjudication states
 * - Remittance: parses a simplified pipe-delimited format
 */
export class StubClearinghouseAdapter implements ClearinghouseAdapter {
  readonly name = 'stub-clearinghouse'

  /** Counter for generating unique tracking IDs. */
  private trackingCounter = 0

  /** In-memory store of submitted claims keyed by tracking ID. */
  private readonly submittedClaims = new Map<
    string,
    { submittedAt: string; claimId: string }
  >()

  async verifyEligibility(
    request: EligibilityRequest,
  ): Promise<EligibilityResponse> {
    if (!request.memberId) {
      return {
        eligible: false,
        activeCoverage: false,
        messages: [],
        errors: ['Member ID is required'],
      }
    }

    return {
      eligible: true,
      activeCoverage: true,
      copay: 2500,
      coinsurancePercent: 20,
      deductibleRemaining: 75000,
      visitLimitRemaining: 12,
      planYearStart: new Date(
        Date.UTC(new Date().getFullYear(), 0, 1),
      ).toISOString(),
      planYearEnd: new Date(
        Date.UTC(new Date().getFullYear(), 11, 31, 23, 59, 59, 999),
      ).toISOString(),
      messages: ['Coverage verified via stub adapter'],
      errors: [],
    }
  }

  async submitClaim(
    request: ClaimSubmissionRequest,
  ): Promise<ClaimSubmissionResponse> {
    if (request.claim.status !== 'active') {
      return {
        accepted: false,
        status: 'rejected',
        submittedAt: new Date().toISOString(),
        rejectionReason: `Claim must have status "active", got "${request.claim.status}"`,
        rejectionCode: 'STATUS_INVALID',
        messages: [],
      }
    }

    if (!request.claim.item || request.claim.item.length === 0) {
      return {
        accepted: false,
        status: 'rejected',
        submittedAt: new Date().toISOString(),
        rejectionReason: 'Claim has no line items',
        rejectionCode: 'NO_ITEMS',
        messages: [],
      }
    }

    const trackingId = `STUB-${++this.trackingCounter}-${Date.now()}`
    const submittedAt = new Date().toISOString()

    this.submittedClaims.set(trackingId, {
      submittedAt,
      claimId: request.claim.identifier?.[0]?.value ?? 'unknown',
    })

    return {
      accepted: true,
      trackingId,
      status: 'accepted',
      submittedAt,
      messages: ['Claim accepted by stub clearinghouse'],
    }
  }

  async checkClaimStatus(
    request: ClaimStatusRequest,
  ): Promise<ClaimStatusResponse> {
    const record = this.submittedClaims.get(request.trackingId)
    if (!record) {
      return {
        trackingId: request.trackingId,
        status: 'cancelled',
        updatedAt: new Date().toISOString(),
        messages: [],
        denialReason: 'Tracking ID not found in stub adapter',
        denialCode: 'NOT_FOUND',
      }
    }

    // Simulate time-based adjudication progression:
    // < 5 min: received, 5-15 min: in-review, 15-30 min: adjudicated, > 30 min: paid
    const elapsed = Date.now() - new Date(record.submittedAt).getTime()
    const minutes = elapsed / 60_000

    let status: ClaimAdjudicationStatus
    let paidAmount: number | undefined
    let patientResponsibility: number | undefined

    if (minutes < 5) {
      status = 'received'
    } else if (minutes < 15) {
      status = 'in-review'
    } else if (minutes < 30) {
      status = 'adjudicated'
      paidAmount = 0
      patientResponsibility = 0
    } else {
      status = 'paid'
      paidAmount = 15000
      patientResponsibility = 2500
    }

    return {
      trackingId: request.trackingId,
      status,
      updatedAt: new Date().toISOString(),
      paidAmount,
      patientResponsibility,
      messages: [
        `Status checked via stub adapter (${minutes.toFixed(1)} min since submission)`,
      ],
    }
  }

  async processRemittance(rawRemittance: string): Promise<RemittanceAdvice> {
    // Simplified pipe-delimited format:
    // payerId|payerName|adviceNumber|remittanceDate|totalPaid
    // trackingId|payerClaimId|patientId|billedAmount|paidAmount|patientResponsibility|adjustmentCode|adjustmentReason|status
    const lines = rawRemittance.trim().split('\n')
    if (lines.length < 2) {
      throw new Error(
        'Remittance advice must have a header line and at least one claim line',
      )
    }

    const headerParts = lines[0].split('|')
    if (headerParts.length < 5) {
      throw new Error(
        'Remittance header must have: payerId|payerName|adviceNumber|remittanceDate|totalPaid',
      )
    }

    const [payerId, payerName, adviceNumber, remittanceDate, totalPaidStr] =
      headerParts

    const lines_data: RemittanceAdvice['lines'] = []
    const skippedLines: number[] = []
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split('|')
      if (parts.length < 9) {
        skippedLines.push(i + 1)
        continue
      }

      const rawStatus = parts[8]
      if (!isClaimAdjudicationStatus(rawStatus)) {
        skippedLines.push(i + 1)
        continue
      }

      lines_data.push({
        trackingId: parts[0],
        payerClaimId: parts[1],
        patientId: parts[2],
        billedAmount: parseInt(parts[3], 10),
        paidAmount: parseInt(parts[4], 10),
        patientResponsibility: parseInt(parts[5], 10),
        adjustmentCode: parts[6] || undefined,
        adjustmentReason: parts[7] || undefined,
        status: parseAdjudicationStatus(parts[8]),
      })
    }

    return {
      payerId,
      payerName: payerName || undefined,
      adviceNumber,
      remittanceDate,
      totalPaid: parseInt(totalPaidStr, 10),
      claimCount: lines_data.length,
      lines: lines_data,
    }
  }
}

/** All valid adjudication statuses, for runtime validation of external data. */
const ADJUDICATION_STATUSES: ReadonlySet<string> = new Set([
  'received',
  'in-review',
  'adjudicated',
  'paid',
  'denied',
  'partially-paid',
  'pended',
  'cancelled',
])

/**
 * Type guard validating a raw remittance status string against the
 * ClaimAdjudicationStatus union before it is trusted downstream.
 */
function isClaimAdjudicationStatus(
  value: string,
): value is ClaimAdjudicationStatus {
  return ADJUDICATION_STATUSES.has(value)
}

/** Singleton stub adapter instance for development use. */
export const stubClearinghouseAdapter = new StubClearinghouseAdapter()
