/**
 * Risk Review Queue (F2.2 / PIX-4411) — Stub for F3.2
 *
 * Supervisor review queue for high/crisis risk stratification results.
 * Lists all pending reviews and routes approve/reject actions through
 * the compliance gate (G2.2 / PIX-4427).
 *
 * Full implementation with filtering, pagination, real-time updates,
 * and clinician notification will be delivered in F3.2.
 *
 * @see apps/web/src/lib/ehr-native/services/risk.service.ts
 * @see apps/web/src/lib/ehr-native/gates/risk-stratification-gate.ts
 */

import { useState, useCallback } from 'react'

import type { ClinicalRole } from '@/lib/ehr-native/auth/types'
import type { RiskStratificationReview } from '@/lib/ehr-native/gates/types'
import type { RLSContext } from '@/lib/ehr-native/repositories/base-repository'
import { RiskStratificationService } from '@/lib/ehr-native/services/risk.service'

import { RiskReviewCard } from './RiskReviewCard'

export interface RiskReviewQueueProps {
  /** RLS context for the supervisor viewing the queue */
  rlsContext: RLSContext
  /** Clinical role of the supervisor (must be physician or nurse) */
  clinicianRole: ClinicalRole
  /** Patient ID to filter reviews by (optional — shows all if omitted) */
  patientId?: string
}

export function RiskReviewQueue({
  rlsContext,
  clinicianRole,
  patientId,
}: RiskReviewQueueProps) {
  const service = new RiskStratificationService(rlsContext)
  const [reviews, setReviews] = useState<RiskStratificationReview[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadReviews = useCallback(() => {
    setLoading(true)
    setError(null)
    try {
      const loaded = patientId ? service.getReviewsForPatient(patientId) : []
      // Filter to pending reviews only — full queue will have filters in F3.2
      setReviews(loaded.filter((r) => r.state === 'pending_clinician_review'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reviews')
    } finally {
      setLoading(false)
    }
  }, [service, patientId])

  const handleApprove = useCallback((_reviewId: string) => {
    // Stub: F3.2 will call service.reviewRiskScore({ approved: true })
    // and refresh the queue
  }, [])

  const handleReject = useCallback((_reviewId: string, _reason: string) => {
    // Stub: F3.2 will call service.reviewRiskScore({ approved: false, rejectionReason })
    // and refresh the queue
  }, [])

  return (
    <div className="space-y-4" data-testid="risk-review-queue">
      <div className="flex items-center justify-between">
        <h2 className="text-gray-900 text-lg font-semibold">
          Risk Review Queue
        </h2>
        <button
          type="button"
          onClick={loadReviews}
          disabled={loading}
          className="bg-blue-600 text-white hover:bg-blue-700 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          data-testid="refresh-btn"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div
          className="border-red-200 bg-red-50 text-red-700 rounded-md border p-3 text-sm"
          data-testid="error-message"
        >
          {error}
        </div>
      )}

      {!loading && !error && reviews.length === 0 && (
        <div
          className="border-gray-200 bg-gray-50 text-gray-500 rounded-md border p-6 text-center text-sm"
          data-testid="empty-state"
        >
          No pending risk reviews.
        </div>
      )}

      <div className="space-y-3">
        {reviews.map((review) => (
          <RiskReviewCard
            key={review.id}
            review={review}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        ))}
      </div>

      {/* Stub notice: full implementation in F3.2 */}
      <p className="text-gray-400 text-xs">
        Supervisor review queue — stub for F3.2. Full filtering, pagination, and
        clinician notification will be implemented in F3.2.
      </p>
    </div>
  )
}
