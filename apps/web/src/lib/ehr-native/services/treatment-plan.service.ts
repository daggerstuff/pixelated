/**
 * Treatment Plan Suggestions Service (F2.3 — PIX-4412)
 *
 * AI-assisted treatment plan generation: SMART goals, measurable objectives,
 * and modality-specific interventions from ICD-10 codes, outcome trends,
 * and treatment history.
 *
 * AI is decision-support only — a clinician must review and approve all
 * suggestions before they become part of a patient's care plan.
 *
 * @see docs/adr/ADR-002-fhir-r4-canonical.md
 * @see docs/adr/ADR-003-rls.md
 * @see docs/adr/ADR-004-audit-hash-chain.md
 */

import type { RLSContext } from '../repositories/base-repository.js'

/* ────────────────────────────────────────────────────────────────────────── */
/* Types — mirror Python models from ai/ehr/treatment_plan_suggestions/models.py */

export type TreatmentModality =
  | 'CBT'
  | 'DBT'
  | 'Psychodynamic'
  | 'Humanistic'
  | 'Family'
  | 'Group'
  | 'Integrative'
  | 'Supportive'

export type GoalStatus =
  'proposed' | 'in_progress' | 'achieved' | 'discontinued'

export type ObjectiveStatus =
  | 'not_started'
  | 'in_progress'
  | 'achieved'
  | 'partially_achieved'
  | 'not_achieved'

export interface ICD10Code {
  code: string
  description?: string
}

export interface OutcomeTrendPoint {
  measure: string
  score: number
  measured_at: string
  trend?: 'improving' | 'stable' | 'declining'
}

export interface TreatmentHistoryEntry {
  modality: TreatmentModality
  start_date: string
  end_date?: string
  outcome?: string
  reason_for_change?: string
}

export interface SmartGoal {
  goal: string
  specific: string
  measurable: string
  achievable: string
  relevant: string
  time_bound: string
  status: GoalStatus
}

export interface MeasurableObjective {
  objective: string
  target_date: string
  status: ObjectiveStatus
  progress_indicator?: string
}

export interface ModalityIntervention {
  modality: TreatmentModality
  intervention: string
  rationale: string
  frequency: string
  target_goals: string[]
}

export interface SuggestionRequestInput {
  patientId: string
  sessionId: string
  icd10Codes: ICD10Code[]
  outcomeTrends?: OutcomeTrendPoint[]
  treatmentHistory?: TreatmentHistoryEntry[]
  preferredModalities?: TreatmentModality[]
  clinicianNotes?: string
}

export interface SuggestionResponseResult {
  goals: SmartGoal[]
  objectives: MeasurableObjective[]
  interventions: ModalityIntervention[]
  summary: string
  confidence: number
  warnings: string[]
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Configuration */

const TREATMENT_PLAN_API_URL =
  process.env['TREATMENT_PLAN_API_URL'] ?? 'http://localhost:8101'

const TREATMENT_PLAN_TIMEOUT_MS = Number(
  process.env['TREATMENT_PLAN_TIMEOUT_MS'] ?? '30000',
)

/* ────────────────────────────────────────────────────────────────────────── */
/* Service */

/**
 * Service for AI-assisted treatment plan suggestions.
 *
 * Follows the RLS-Context pattern (Pattern A): instantiated per-request
 * with an RLS context. The service calls the Python FastAPI treatment
 * plan suggestions service (port 8101) which uses a NIM model on Hetzner
 * to generate SMART goals, measurable objectives, and modality-specific
 * interventions.
 *
 * AI is decision-support only — clinicians must review and approve all
 * suggestions before adoption.
 */
export class TreatmentPlanService {
  private readonly rlsContext: RLSContext
  private readonly apiUrl: string
  private readonly timeoutMs: number

  constructor(rlsContext: RLSContext) {
    this.rlsContext = rlsContext
    this.apiUrl = TREATMENT_PLAN_API_URL
    this.timeoutMs = TREATMENT_PLAN_TIMEOUT_MS
  }

  /**
   * Request treatment plan suggestions from the AI service.
   *
   * @throws {TreatmentPlanError} on BAA gate rejection (403),
   *   validation failure (422), timeout, or service unavailable (502/503).
   */
  async getSuggestions(
    input: SuggestionRequestInput,
  ): Promise<SuggestionResponseResult> {
    this.validateInput(input)

    const payload = {
      patient_id: input.patientId,
      session_id: input.sessionId,
      icd10_codes: input.icd10Codes.map((c) => ({
        code: c.code,
        description: c.description,
      })),
      outcome_trends: input.outcomeTrends ?? [],
      treatment_history: input.treatmentHistory ?? [],
      preferred_modalities: input.preferredModalities ?? [],
      clinician_notes: input.clinicianNotes ?? '',
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await fetch(`${this.apiUrl}/suggest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw await this.handleError(response)
      }

      const data = (await response.json()) as RawSuggestionResponse
      return this.normalizeResponse(data)
    } catch (error) {
      if (error instanceof TreatmentPlanError) throw error
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TreatmentPlanError(
          'Treatment plan service timed out',
          'TIMEOUT',
        )
      }
      throw new TreatmentPlanError(
        'Unable to reach treatment plan service',
        'SERVICE_UNAVAILABLE',
        error,
      )
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Check the health of the treatment plan AI service.
   */
  async checkHealth(): Promise<{
    status: string
    service: string
    nim_configured: boolean
    baa_confirmed: boolean
  }> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    try {
      const response = await fetch(`${this.apiUrl}/health`, {
        signal: controller.signal,
      })
      if (!response.ok) {
        throw new TreatmentPlanError(
          `Health check failed: ${response.status}`,
          'SERVICE_UNAVAILABLE',
        )
      }
      return (await response.json()) as {
        status: string
        service: string
        nim_configured: boolean
        baa_confirmed: boolean
      }
    } catch (error) {
      if (error instanceof TreatmentPlanError) throw error
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TreatmentPlanError('Health check timed out', 'TIMEOUT')
      }
      throw new TreatmentPlanError(
        'Unable to reach treatment plan service',
        'SERVICE_UNAVAILABLE',
        error,
      )
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /* ──────────────────────────────────────────────────────────────────────── */
  /* Private helpers */

  private validateInput(input: SuggestionRequestInput): void {
    if (!input.patientId || input.patientId.trim().length === 0) {
      throw new TreatmentPlanError('patientId is required', 'VALIDATION_ERROR')
    }
    if (!input.icd10Codes || input.icd10Codes.length === 0) {
      throw new TreatmentPlanError(
        'At least one ICD-10 code is required',
        'VALIDATION_ERROR',
      )
    }
    if (input.icd10Codes.length > 20) {
      throw new TreatmentPlanError(
        'Maximum 20 ICD-10 codes allowed',
        'VALIDATION_ERROR',
      )
    }
    for (const entry of input.icd10Codes) {
      if (!entry.code || entry.code.trim().length === 0) {
        throw new TreatmentPlanError(
          'ICD-10 code cannot be empty',
          'VALIDATION_ERROR',
        )
      }
    }
    if (input.clinicianNotes && input.clinicianNotes.length > 5000) {
      throw new TreatmentPlanError(
        'clinicianNotes must be 5000 characters or fewer',
        'VALIDATION_ERROR',
      )
    }
  }

  private async handleError(response: Response): Promise<TreatmentPlanError> {
    let detail = `Treatment plan service returned ${response.status}`
    try {
      const body = (await response.json()) as { detail?: string }
      if (body.detail) {
        detail = body.detail
      }
    } catch {
      // Response body not JSON; use default message
    }

    switch (response.status) {
      case 403:
        return new TreatmentPlanError(detail, 'BAA_GATE')
      case 422:
        return new TreatmentPlanError(detail, 'VALIDATION_ERROR')
      case 502:
        return new TreatmentPlanError(detail, 'NIM_UNAVAILABLE')
      case 503:
        return new TreatmentPlanError(detail, 'SERVICE_UNAVAILABLE')
      default:
        return new TreatmentPlanError(detail, 'SERVICE_ERROR')
    }
  }

  private normalizeResponse(
    data: RawSuggestionResponse,
  ): SuggestionResponseResult {
    return {
      goals: (data.goals ?? []).map(normalizeGoal),
      objectives: (data.objectives ?? []).map(normalizeObjective),
      interventions: (data.interventions ?? []).map(normalizeIntervention),
      summary: data.summary ?? '',
      confidence: typeof data.confidence === 'number' ? data.confidence : 0,
      warnings: data.warnings ?? [],
    }
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Error class */

export type TreatmentPlanErrorCode =
  | 'BAA_GATE'
  | 'VALIDATION_ERROR'
  | 'TIMEOUT'
  | 'SERVICE_UNAVAILABLE'
  | 'NIM_UNAVAILABLE'
  | 'SERVICE_ERROR'

export class TreatmentPlanError extends Error {
  readonly code: TreatmentPlanErrorCode
  override readonly cause?: unknown

  constructor(message: string, code: TreatmentPlanErrorCode, cause?: unknown) {
    super(message)
    this.name = 'TreatmentPlanError'
    this.code = code
    if (cause !== undefined) {
      this.cause = cause
    }
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Response normalization helpers */

interface RawSuggestionResponse {
  goals?: RawSmartGoal[]
  objectives?: RawMeasurableObjective[]
  interventions?: RawModalityIntervention[]
  summary?: string
  confidence?: number
  warnings?: string[]
}

interface RawSmartGoal {
  goal?: string
  specific?: string
  measurable?: string
  achievable?: string
  relevant?: string
  time_bound?: string
  status?: string
}

interface RawMeasurableObjective {
  objective?: string
  target_date?: string
  status?: string
  progress_indicator?: string
}

interface RawModalityIntervention {
  modality?: string
  intervention?: string
  rationale?: string
  frequency?: string
  target_goals?: string[]
}

function normalizeGoal(raw: RawSmartGoal): SmartGoal {
  return {
    goal: raw.goal ?? '',
    specific: raw.specific ?? '',
    measurable: raw.measurable ?? '',
    achievable: raw.achievable ?? '',
    relevant: raw.relevant ?? '',
    time_bound: raw.time_bound ?? '',
    status: normalizeGoalStatus(raw.status),
  }
}

function normalizeObjective(raw: RawMeasurableObjective): MeasurableObjective {
  return {
    objective: raw.objective ?? '',
    target_date: raw.target_date ?? '',
    status: normalizeObjectiveStatus(raw.status),
    progress_indicator: raw.progress_indicator,
  }
}

function normalizeIntervention(
  raw: RawModalityIntervention,
): ModalityIntervention {
  return {
    modality: normalizeModality(raw.modality),
    intervention: raw.intervention ?? '',
    rationale: raw.rationale ?? '',
    frequency: raw.frequency ?? '',
    target_goals: raw.target_goals ?? [],
  }
}

const VALID_MODALITIES: TreatmentModality[] = [
  'CBT',
  'DBT',
  'Psychodynamic',
  'Humanistic',
  'Family',
  'Group',
  'Integrative',
  'Supportive',
]

const VALID_GOAL_STATUSES: GoalStatus[] = [
  'proposed',
  'in_progress',
  'achieved',
  'discontinued',
]

const VALID_OBJECTIVE_STATUSES: ObjectiveStatus[] = [
  'not_started',
  'in_progress',
  'achieved',
  'partially_achieved',
  'not_achieved',
]

function normalizeModality(value?: string): TreatmentModality {
  if (value && VALID_MODALITIES.includes(value as TreatmentModality)) {
    return value as TreatmentModality
  }
  return 'Supportive'
}

function normalizeGoalStatus(value?: string): GoalStatus {
  if (value && VALID_GOAL_STATUSES.includes(value as GoalStatus)) {
    return value as GoalStatus
  }
  return 'proposed'
}

function normalizeObjectiveStatus(value?: string): ObjectiveStatus {
  if (value && VALID_OBJECTIVE_STATUSES.includes(value as ObjectiveStatus)) {
    return value as ObjectiveStatus
  }
  return 'not_started'
}
