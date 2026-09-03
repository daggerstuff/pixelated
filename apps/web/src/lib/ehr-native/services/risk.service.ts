/**
 * Risk Stratification Service (F2.2 / PIX-4411)
 *
 * Client-side service that calls the Python FastAPI risk stratification
 * backend and routes high/crisis results through the compliance gate
 * (G2.2 / PIX-4427) for mandatory supervisor review.
 *
 * Architecture:
 *   API Route → requireEHRPermission() → RLSContext → RiskStratificationService
 *   → POST /stratify (Python FastAPI) → interceptRiskScore (gate) → response
 *
 * The Python service performs deterministic scoring (PHQ-9, GAD-7, C-SSRS)
 * with optional NIM model enhancement. The TS client adds:
 *   - RLS-aware tenant/user context
 *   - Compliance gate routing for high/crisis flags
 *   - Clinician notification metadata
 *
 * @see ai/ehr/risk_stratification/ — Python FastAPI service
 * @see apps/web/src/lib/ehr-native/gates/risk-stratification-gate.ts — G2.2 gate
 */

import {
  interceptRiskScore,
  getReview,
  getReviewsForPatient,
  getAuditTrail,
  type RiskStratificationReview,
  type RiskGateResult,
  type RiskAISystemSource,
  type RiskGateAuditEntry,
} from '../gates/risk-stratification-gate'
import type { RLSContext } from '../repositories/base-repository'

// ---------------------------------------------------------------------------
// Types — mirror the Python FastAPI models (ai/ehr/risk_stratification/models.py)
// ---------------------------------------------------------------------------

/** Risk level classification */
export type RiskLevel = 'low' | 'medium' | 'high' | 'crisis'

/** PHQ-9 assessment: 9 items, each scored 0-3 */
export interface PHQ9Scores {
  responses: number[]
}

/** GAD-7 assessment: 7 items, each scored 0-3 */
export interface GAD7Scores {
  responses: number[]
}

/** C-SSRS screen: 6 boolean items (Q1-Q6) */
export interface CSSRSScreen {
  responses: boolean[]
}

/** Clinical context accompanying the assessment scores */
export interface ClinicalContext {
  note_text: string
  session_id: string
  patient_id: string
}

/** Request body for POST /stratify */
export interface RiskStratificationRequest {
  phq9: PHQ9Scores
  gad7: GAD7Scores
  cssrs: CSSRSScreen
  clinical_context: ClinicalContext
}

/** Breakdown of deterministic scoring results */
export interface RiskScoreBreakdown {
  phq9_total: number
  phq9_severity: string
  gad7_total: number
  gad7_severity: string
  cssrs_highest_positive: number
  cssrs_risk_label: string
}

/** Response from POST /stratify */
export interface RiskStratificationResponse {
  patient_id: string
  session_id: string
  risk_level: RiskLevel
  confidence_score: number
  score_breakdown: RiskScoreBreakdown
  recommended_actions: string[]
  requires_supervisor_review: boolean
  requires_crisis_protocol: boolean
  model_source: string
  warnings: string[]
  audit_entry_id: string
}

/** Health check response from GET /health */
export interface RiskServiceHealth {
  status: string
  service: string
  baa_confirmed: boolean
  nim_configured: boolean
}

// ---------------------------------------------------------------------------
// Combined result type (API response + gate review)
// ---------------------------------------------------------------------------

/** Result of stratifyRisk: API response + optional gate review */
export interface RiskStratificationResult {
  response: RiskStratificationResponse
  /** Gate review record if risk was high/crisis and routed to supervisor queue */
  gateReview: RiskStratificationReview | null
  /** Whether the gate accepted the risk score (BAA compliant) */
  gateAccepted: boolean
  /** Gate error message if the gate blocked the submission */
  gateError: string | null
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const DEFAULT_API_URL = 'http://localhost:8000'

/**
 * Risk Stratification Service
 *
 * Per-request service instantiated with RLSContext. Calls the Python FastAPI
 * backend for risk scoring and routes high/crisis results through the
 * compliance gate (G2.2) for supervisor review.
 */
export class RiskStratificationService {
  private readonly apiUrl: string
  private readonly apiTimeoutMs: number

  constructor(private readonly rlsContext: RLSContext) {
    this.apiUrl = process.env['RISK_STRATIFICATION_API_URL'] ?? DEFAULT_API_URL
    this.apiTimeoutMs = Number(
      process.env['RISK_STRATIFICATION_TIMEOUT_MS'] ?? '30000',
    )
  }

  /**
   * Stratify risk by calling the Python FastAPI backend.
   *
   * For high/crisis results, routes through the compliance gate
   * (interceptRiskScore) for mandatory supervisor review.
   */
  async stratifyRisk(
    request: RiskStratificationRequest,
  ): Promise<RiskStratificationResult> {
    const response = await this.callStratifyApi(request)

    let gateReview: RiskStratificationReview | null = null
    let gateAccepted = false
    let gateError: string | null = null

    // Route high/crisis through the compliance gate
    if (
      response.requires_supervisor_review ||
      response.risk_level === 'high' ||
      response.risk_level === 'crisis'
    ) {
      const aiSource: RiskAISystemSource = this.resolveAISystemSource(
        response.model_source,
      )
      const gateResult: RiskGateResult<RiskStratificationReview> =
        interceptRiskScore({
          patientId: request.clinical_context.patient_id,
          tenantId: this.rlsContext.tenantId,
          riskScore: response.confidence_score,
          riskLevel: response.risk_level,
          aiSystemSource: aiSource,
          submittedByUserId: this.rlsContext.userId,
        })

      if (gateResult.ok && gateResult.data) {
        gateReview = gateResult.data
        gateAccepted = true
      } else {
        gateError = gateResult.error
      }
    } else {
      // Low/medium: gate not required, mark as accepted (no review needed)
      gateAccepted = true
    }

    return {
      response,
      gateReview,
      gateAccepted,
      gateError,
    }
  }

  /**
   * Check the health of the Python risk stratification service.
   * Does NOT require BAA (the /health endpoint is public).
   */
  async checkHealth(): Promise<RiskServiceHealth> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.apiTimeoutMs)

    try {
      const res = await fetch(`${this.apiUrl}/health`, {
        signal: controller.signal,
      })
      if (!res.ok) {
        throw new Error(`Health check failed: ${res.status} ${res.statusText}`)
      }
      return (await res.json()) as RiskServiceHealth
    } finally {
      clearTimeout(timeout)
    }
  }

  /**
   * Retrieve a gate review by ID.
   */
  getReview(reviewId: string): RiskStratificationReview | null {
    return getReview(reviewId)
  }

  /**
   * Retrieve all gate reviews for a patient.
   */
  getReviewsForPatient(patientId: string): RiskStratificationReview[] {
    return getReviewsForPatient(patientId)
  }

  /**
   * Retrieve the audit trail for a gate review.
   */
  getAuditTrail(reviewId: string): RiskGateAuditEntry[] {
    return getAuditTrail(reviewId)
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Call the Python FastAPI /stratify endpoint.
   */
  private async callStratifyApi(
    request: RiskStratificationRequest,
  ): Promise<RiskStratificationResponse> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.apiTimeoutMs)

    try {
      const res = await fetch(`${this.apiUrl}/stratify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      })

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        if (res.status === 403) {
          throw new Error(
            `BAA not confirmed — risk stratification requires BAA coverage (Gate G2.3)`,
          )
        }
        if (res.status === 422) {
          throw new Error(
            `Validation error from risk stratification service: ${body}`,
          )
        }
        throw new Error(
          `Risk stratification service error (${res.status}): ${body}`,
        )
      }

      return (await res.json()) as RiskStratificationResponse
    } finally {
      clearTimeout(timeout)
    }
  }

  /**
   * Map the Python service's model_source string to the gate's RiskAISystemSource.
   */
  private resolveAISystemSource(modelSource: string): RiskAISystemSource {
    if (modelSource === 'nim-hetzner') return 'nim-hetzner'
    if (modelSource === 'nvidia') return 'nvidia'
    return 'local-fallback'
  }
}
