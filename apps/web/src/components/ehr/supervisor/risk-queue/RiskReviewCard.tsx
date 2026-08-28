/**
 * Risk Review Card (F2.2 / PIX-4411) — Stub for F3.2
 *
 * Individual card showing a pending risk stratification review.
 * Supervisor can approve or reject the AI-generated risk score.
 *
 * Full interactive review flow will be implemented in F3.2
 * (Supervisor Review Queue).
 *
 * @see apps/web/src/lib/ehr-native/gates/risk-stratification-gate.ts
 */

import type { RiskStratificationReview } from '@/lib/ehr-native/gates/types'

export interface RiskReviewCardProps {
  review: RiskStratificationReview
  /** Called when supervisor approves the risk score */
  onApprove: (reviewId: string) => void
  /** Called when supervisor rejects the risk score */
  onReject: (reviewId: string, reason: string) => void
  /** Disable actions (e.g., during async processing) */
  disabled?: boolean
}

const RISK_LEVEL_STYLES: Record<string, string> = {
  low: 'bg-green-100 text-green-800 border-green-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  crisis: 'bg-red-100 text-red-800 border-red-300',
}

const AI_SOURCE_LABELS: Record<string, string> = {
  'nim-hetzner': 'NIM (Hetzner)',
  'nvidia': 'NVIDIA NIM',
  'local-fallback': 'Local Fallback',
}

export function RiskReviewCard({
  review,
  onApprove,
  onReject,
  disabled = false,
}: RiskReviewCardProps) {
  const riskStyle = RISK_LEVEL_STYLES[review.riskLevel] ?? RISK_LEVEL_STYLES.low
  const aiLabel =
    AI_SOURCE_LABELS[review.aiSystemSource] ?? review.aiSystemSource
  const isPending = review.state === 'pending_clinician_review'

  return (
    <div
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      data-testid={`risk-review-card-${review.id}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${riskStyle}`}
            data-testid="risk-level-badge"
          >
            {review.riskLevel.toUpperCase()}
          </span>
          <span className="text-sm text-gray-500">
            Score: {review.riskScore.toFixed(2)}
          </span>
        </div>
        <span className="text-xs text-gray-400">{aiLabel}</span>
      </div>

      <div className="mt-3 space-y-1 text-sm text-gray-600">
        <p>
          <span className="font-medium">Patient:</span> {review.patientId}
        </p>
        <p>
          <span className="font-medium">Submitted:</span>{' '}
          {new Date(review.submittedAt).toLocaleString()}
        </p>
        <p>
          <span className="font-medium">State:</span> {review.state}
        </p>
        {review.reviewedAt && (
          <p>
            <span className="font-medium">Reviewed:</span>{' '}
            {new Date(review.reviewedAt).toLocaleString()}
          </p>
        )}
        {review.rejectionReason && (
          <p className="text-red-600">
            <span className="font-medium">Rejection reason:</span>{' '}
            {review.rejectionReason}
          </p>
        )}
      </div>

      {isPending && (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => onApprove(review.id)}
            disabled={disabled}
            className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            data-testid="approve-btn"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => onReject(review.id, 'Pending detailed review')}
            disabled={disabled}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            data-testid="reject-btn"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  )
}
