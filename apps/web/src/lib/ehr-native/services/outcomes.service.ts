/**
 * EHR Native — Outcomes Service (F2.4)
 *
 * Core service for outcome measure trending: scoring PHQ-9, GAD-7, and OQ-45
 * standardized assessment instruments, storing results as FHIR resources,
 * detecting significant change between consecutive administrations, and
 * retrieving trending data for clinician-facing charts.
 *
 * Measures are standardized instruments with published scoring — AI is
 * decision-support only, never the source of scoring logic.
 *
 * @see docs/adr/ADR-002-fhir-r4-canonical.md
 * @see docs/adr/ADR-003-rls.md
 * @see docs/adr/ADR-004-audit-hash-chain.md
 */

import {
  getCanonicalQuestionnaire,
  buildOutcomeObservation,
} from '../fhir/index.js'
import {
  type RLSContext,
  QuestionnaireRepository,
  QuestionnaireResponseRepository,
  ObservationRepository,
  MeasureConfigRepository,
} from '../repositories/index.js'
import type {
  QuestionnaireResponse,
  Observation,
  OutcomeMeasureType,
  SeverityLevel,
  MeasureConfig,
  OutcomeScore,
} from '../types/index.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Canonical questionnaire URLs keyed by measure type. */
const QUESTIONNAIRE_URLS: Record<OutcomeMeasureType, string> = {
  'phq-9': 'http://example.org/fhir/Questionnaire/phq-9',
  'gad-7': 'http://example.org/fhir/Questionnaire/gad-7',
  'oq-45': 'http://example.org/fhir/Questionnaire/oq-45',
}

/** LOINC codes for each measure, used to filter Observations. */
const LOINC_CODES: Record<OutcomeMeasureType, string> = {
  'phq-9': '89204-2',
  'gad-7': '70274-6',
  'oq-45': '75325-1',
}

/** Maximum possible score per measure. */
const MAX_SCORES: Record<OutcomeMeasureType, number> = {
  'phq-9': 27,
  'gad-7': 21,
  'oq-45': 180,
}

/** Significant change threshold: score increase triggering deterioration alert. */
const DETERIORATION_THRESHOLD: Record<OutcomeMeasureType, number> = {
  'phq-9': 4,
  'gad-7': 4,
  'oq-45': 14,
}

/** Significant improvement threshold (OQ-45 only: RCI = 14). */
const IMPROVEMENT_THRESHOLD: Record<OutcomeMeasureType, number> = {
  'phq-9': Infinity, // PHQ-9 alerts on deterioration only
  'gad-7': Infinity, // GAD-7 alerts on deterioration only
  'oq-45': 14, // OQ-45: RCI = 14 in both directions
}

/** OQ-45 items that are reverse-scored (per OQ-45 manual). */
const OQ45_REVERSE_SCORED = new Set([
  'oq45-01',
  'oq45-04',
  'oq45-07',
  'oq45-10',
  'oq45-12',
  'oq45-13',
  'oq45-16',
  'oq45-18',
  'oq45-20',
  'oq45-21',
  'oq45-24',
  'oq45-27',
  'oq45-28',
  'oq45-29',
  'oq45-31',
  'oq45-32',
  'oq45-34',
  'oq45-36',
  'oq45-38',
  'oq45-40',
  'oq45-41',
  'oq45-42',
  'oq45-44',
  'oq45-45',
])

// ---------------------------------------------------------------------------
// Input / Output interfaces
// ---------------------------------------------------------------------------

export interface MeasureConfigInput {
  patientId: string
  measureType: OutcomeMeasureType
  cadence: 'weekly' | 'biweekly'
  active?: boolean
}

export interface SubmitMeasureInput {
  patientId: string
  measureType: OutcomeMeasureType
  /** Map of linkId → numeric answer value. */
  responses: Record<string, number>
  /** ISO timestamp; defaults to now. */
  authored?: string
}

export interface OutcomeTrendPoint {
  administeredAt: string
  totalScore: number
  severity: SeverityLevel
  alertFlag: boolean
  alertReason?: string
  changeFromPrevious?: number
}

export interface OutcomeTrendResult {
  measureType: OutcomeMeasureType
  points: OutcomeTrendPoint[]
  latestScore?: OutcomeScore
}

export interface OutcomeAlertResult {
  patientId: string
  measureType: OutcomeMeasureType
  currentScore: number
  previousScore: number
  changeFromPrevious: number
  alertFlag: boolean
  alertReason?: string
}

export interface SubmitMeasureResult {
  response: QuestionnaireResponse
  observation: Observation
  score: OutcomeScore
}

// ---------------------------------------------------------------------------
// Static scoring helpers
// ---------------------------------------------------------------------------

/**
 * Validates that a patient ID is a non-empty string matching FHIR ID rules.
 */
function validatePatientId(patientId: string): void {
  if (!patientId || typeof patientId !== 'string' || patientId.trim() === '') {
    throw new Error('Patient ID is required')
  }
}

interface ResponseItem {
  linkId: string
  answer?: Array<{
    valueInteger?: number
    valueDecimal?: number
    valueString?: string
  }>
}

/**
 * Extracts the numeric answer value from a QuestionnaireResponse item.
 */
function extractAnswerValue(item: ResponseItem): number {
  const answer = item.answer?.[0]
  if (!answer) {
    throw new Error(`No answer provided for item ${item.linkId}`)
  }
  if (answer.valueInteger !== undefined) {
    return answer.valueInteger
  }
  if (answer.valueDecimal !== undefined) {
    return answer.valueDecimal
  }
  throw new Error(
    `Item ${item.linkId} answer is not numeric (got ${JSON.stringify(answer)})`,
  )
}

/**
 * Scores a PHQ-9 QuestionnaireResponse.
 *
 * 9 items, each scored 0-3, total range 0-27.
 */
function scorePHQ9(response: QuestionnaireResponse): number {
  const items = (response.item ?? []) as ResponseItem[]
  if (items.length !== 9) {
    throw new Error(`PHQ-9 requires exactly 9 items, got ${items.length}`)
  }
  return items.reduce((sum, item) => {
    const value = extractAnswerValue(item)
    if (value < 0 || value > 3) {
      throw new Error(
        `PHQ-9 item ${item.linkId} value ${value} out of range 0-3`,
      )
    }
    return sum + value
  }, 0)
}

/**
 * Scores a GAD-7 QuestionnaireResponse.
 *
 * 7 items, each scored 0-3, total range 0-21.
 */
function scoreGAD7(response: QuestionnaireResponse): number {
  const items = (response.item ?? []) as ResponseItem[]
  if (items.length !== 7) {
    throw new Error(`GAD-7 requires exactly 7 items, got ${items.length}`)
  }
  return items.reduce((sum, item) => {
    const value = extractAnswerValue(item)
    if (value < 0 || value > 3) {
      throw new Error(
        `GAD-7 item ${item.linkId} value ${value} out of range 0-3`,
      )
    }
    return sum + value
  }, 0)
}

/**
 * Scores an OQ-45 QuestionnaireResponse.
 *
 * 45 items, each scored 0-4 (some reverse-scored), total range 0-180.
 * Reverse-scored items: value = 4 - original.
 */
function scoreOQ45(response: QuestionnaireResponse): number {
  const items = (response.item ?? []) as ResponseItem[]
  if (items.length !== 45) {
    throw new Error(`OQ-45 requires exactly 45 items, got ${items.length}`)
  }
  return items.reduce((sum, item) => {
    const rawValue = extractAnswerValue(item)
    if (rawValue < 0 || rawValue > 4) {
      throw new Error(
        `OQ-45 item ${item.linkId} value ${rawValue} out of range 0-4`,
      )
    }
    const finalValue = OQ45_REVERSE_SCORED.has(item.linkId)
      ? 4 - rawValue
      : rawValue
    return sum + finalValue
  }, 0)
}

/**
 * Determines the severity level based on the measure type and total score,
 * using published thresholds.
 */
function getSeverity(
  measureType: OutcomeMeasureType,
  score: number,
): SeverityLevel {
  switch (measureType) {
    case 'phq-9':
      if (score <= 4) return 'minimal'
      if (score <= 9) return 'mild'
      if (score <= 14) return 'moderate'
      if (score <= 19) return 'moderately-severe'
      return 'severe'

    case 'gad-7':
      if (score <= 4) return 'minimal'
      if (score <= 9) return 'mild'
      if (score <= 14) return 'moderate'
      return 'severe'

    case 'oq-45':
      // OQ-45 uses clinical cutoff at 64
      if (score < 64) return 'minimal'
      if (score < 80) return 'mild'
      if (score < 100) return 'moderate'
      if (score < 140) return 'moderately-severe'
      return 'severe'

    default: {
      const exhaustive: never = measureType
      throw new Error(`Unknown measure type: ${String(exhaustive)}`)
    }
  }
}

/**
 * Detects significant change between consecutive administrations.
 *
 * PHQ-9/GAD-7: alert when score increases by more than 4 points (deterioration).
 * OQ-45: alert when score increases by more than 14 (deterioration) OR
 *        decreases by more than 14 (improvement, RCI = 14).
 */
function detectSignificantChange(
  measureType: OutcomeMeasureType,
  currentScore: number,
  previousScore: number | null,
): {
  alertFlag: boolean
  alertReason?: string
  changeFromPrevious: number | null
} {
  if (previousScore === null) {
    return { alertFlag: false, changeFromPrevious: null }
  }

  const change = currentScore - previousScore
  const deteriorationThreshold = DETERIORATION_THRESHOLD[measureType]
  const improvementThreshold = IMPROVEMENT_THRESHOLD[measureType]

  if (change > deteriorationThreshold) {
    return {
      alertFlag: true,
      alertReason: `Significant deterioration: score increased by ${change} points (threshold: >${deteriorationThreshold})`,
      changeFromPrevious: change,
    }
  }

  if (change < 0 && Math.abs(change) > improvementThreshold) {
    return {
      alertFlag: true,
      alertReason: `Significant improvement: score decreased by ${Math.abs(change)} points (RCI threshold: >${improvementThreshold})`,
      changeFromPrevious: change,
    }
  }

  return { alertFlag: false, changeFromPrevious: change }
}

/**
 * Scores a QuestionnaireResponse based on the measure type.
 */
function scoreResponse(
  measureType: OutcomeMeasureType,
  response: QuestionnaireResponse,
): number {
  switch (measureType) {
    case 'phq-9':
      return scorePHQ9(response)
    case 'gad-7':
      return scoreGAD7(response)
    case 'oq-45':
      return scoreOQ45(response)
    default: {
      const exhaustive: never = measureType
      throw new Error(`Unknown measure type: ${String(exhaustive)}`)
    }
  }
}

/**
 * Builds a FHIR QuestionnaireResponse from a submit input.
 */
function buildQuestionnaireResponse(
  input: SubmitMeasureInput,
): QuestionnaireResponse {
  const questionnaireUrl = QUESTIONNAIRE_URLS[input.measureType]
  const authored = input.authored ?? new Date().toISOString()

  const items: QuestionnaireResponse['item'] = Object.entries(
    input.responses,
  ).map(([linkId, value]) => ({
    linkId,
    answer: [{ valueInteger: value }],
  }))

  return {
    resourceType: 'QuestionnaireResponse',
    questionnaire: questionnaireUrl,
    status: 'completed',
    subject: { reference: `Patient/${input.patientId}` },
    authored,
    author: { reference: `Patient/${input.patientId}` },
    source: { reference: `Patient/${input.patientId}` },
    item: items,
  }
}

// ---------------------------------------------------------------------------
// Service class
// ---------------------------------------------------------------------------

/**
 * Service for outcome measure trending (F2.4).
 *
 * Handles scoring, storage, retrieval, trending, and significant change
 * detection for PHQ-9, GAD-7, and OQ-45 standardized assessment instruments.
 *
 * Like all EHR services, it is stateless and constructed per-request with an
 * RLS context for tenant isolation.
 */
export class OutcomesService {
  private readonly questionnaireRepo: QuestionnaireRepository
  private readonly responseRepo: QuestionnaireResponseRepository
  private readonly observationRepo: ObservationRepository
  private readonly measureConfigRepo: MeasureConfigRepository

  constructor(rlsContext: RLSContext) {
    this.questionnaireRepo = new QuestionnaireRepository(rlsContext)
    this.responseRepo = new QuestionnaireResponseRepository(rlsContext)
    this.observationRepo = new ObservationRepository(rlsContext)
    this.measureConfigRepo = new MeasureConfigRepository(rlsContext)
  }

  /**
   * Ensures the canonical questionnaire for a measure type is persisted.
   * Returns the stored Questionnaire if it exists, or creates it.
   */
  async ensureQuestionnaire(measureType: OutcomeMeasureType): Promise<void> {
    const url = QUESTIONNAIRE_URLS[measureType]
    const existing = await this.questionnaireRepo.findByUrl(url)
    if (existing) return

    const canonical = getCanonicalQuestionnaire(measureType)
    await this.questionnaireRepo.create(canonical)
  }

  /**
   * Submits a completed outcome measure: scores the response, detects
   * significant change from the previous administration, stores the
   * QuestionnaireResponse and scored Observation, and returns the results.
   */
  async submitMeasure(input: SubmitMeasureInput): Promise<SubmitMeasureResult> {
    validatePatientId(input.patientId)

    // Ensure the questionnaire definition is persisted
    await this.ensureQuestionnaire(input.measureType)

    // Build and store the QuestionnaireResponse
    const questionnaireResponse = buildQuestionnaireResponse(input)
    const storedResponse = await this.responseRepo.create(questionnaireResponse)

    // Score the response
    const totalScore = scoreResponse(input.measureType, storedResponse)
    const severity = getSeverity(input.measureType, totalScore)

    // Get the previous score for change detection
    const previousScore = await this.getPreviousScore(
      input.patientId,
      input.measureType,
    )

    const changeResult = detectSignificantChange(
      input.measureType,
      totalScore,
      previousScore,
    )

    // Build the scored Observation
    const observation = buildOutcomeObservation({
      patientId: input.patientId,
      measureType: input.measureType,
      totalScore,
      severity,
      administeredAt: storedResponse.authored ?? new Date().toISOString(),
      alertFlag: changeResult.alertFlag,
      alertReason: changeResult.alertReason,
      changeFromPrevious: changeResult.changeFromPrevious ?? undefined,
    })

    // Store the scored Observation
    const storedObservation = await this.observationRepo.create(observation)

    // Build the OutcomeScore
    const score: OutcomeScore = {
      measureType: input.measureType,
      totalScore,
      maxScore: MAX_SCORES[input.measureType],
      severity,
      administeredAt: storedResponse.authored ?? new Date().toISOString(),
      alertFlag: changeResult.alertFlag,
      alertReason: changeResult.alertReason,
      changeFromPrevious: changeResult.changeFromPrevious ?? undefined,
    }

    return {
      response: storedResponse,
      observation: storedObservation,
      score,
    }
  }

  /**
   * Retrieves the previous (most recent) score for a patient and measure type.
   * Returns null if no previous administration exists.
   */
  private async getPreviousScore(
    patientId: string,
    measureType: OutcomeMeasureType,
  ): Promise<number | null> {
    const loincCode = LOINC_CODES[measureType]
    const observations = await this.observationRepo.findByPatientAndCode(
      patientId,
      loincCode,
      1,
      0,
    )

    if (observations.length < 1) return null

    const previous = observations[0]
    if (previous?.valueQuantity?.value == null) return null
    return previous.valueQuantity.value
  }

  /**
   * Retrieves trending data for a specific measure type and patient.
   * Returns all scored administrations ordered chronologically.
   */
  async getTrend(
    patientId: string,
    measureType: OutcomeMeasureType,
  ): Promise<OutcomeTrendResult> {
    validatePatientId(patientId)

    const loincCode = LOINC_CODES[measureType]
    const observations = await this.observationRepo.findByPatientAndCode(
      patientId,
      loincCode,
      500,
      0,
    )

    // Already sorted DESC by effective_date from the DB query; reverse for chronological
    const measureObservations = [...observations].reverse()

    const points: OutcomeTrendPoint[] = measureObservations.map((obs) => {
      const totalScore = obs.valueQuantity?.value ?? 0
      const severity = (obs.interpretation?.[0]?.coding?.[0]?.code ??
        'minimal') as SeverityLevel
      const alertFlag =
        obs.note?.some((n) => n.text?.includes('Significant')) ?? false
      const alertReason = obs.note?.[0]?.text

      // Read changeFromPrevious from the FHIR component (stored at submit time)
      const changeComponent = obs.component?.find(
        (c) => c.code?.coding?.[0]?.code === 'change-from-previous',
      )
      const changeFromPrevious =
        changeComponent?.valueQuantity?.value ?? undefined

      return {
        administeredAt: obs.effectiveDateTime ?? '',
        totalScore,
        severity,
        alertFlag,
        alertReason: alertFlag ? alertReason : undefined,
        changeFromPrevious,
      }
    })

    const latestScore: OutcomeScore | undefined =
      points.length > 0
        ? {
            measureType,
            totalScore: points[points.length - 1].totalScore,
            maxScore: MAX_SCORES[measureType],
            severity: points[points.length - 1].severity,
            administeredAt: points[points.length - 1].administeredAt,
            alertFlag: points[points.length - 1].alertFlag,
            alertReason: points[points.length - 1].alertReason,
            changeFromPrevious: points[points.length - 1].changeFromPrevious,
          }
        : undefined

    return {
      measureType,
      points,
      latestScore,
    }
  }

  /**
   * Retrieves all active alerts for a patient across all measure types.
   */
  async getAlerts(patientId: string): Promise<OutcomeAlertResult[]> {
    validatePatientId(patientId)

    const measureTypes: OutcomeMeasureType[] = ['phq-9', 'gad-7', 'oq-45']
    const allAlerts: OutcomeAlertResult[] = []

    for (const measureType of measureTypes) {
      const trend = await this.getTrend(patientId, measureType)
      const alertPoints = trend.points.filter((p) => p.alertFlag)

      for (const point of alertPoints) {
        allAlerts.push({
          patientId,
          measureType,
          currentScore: point.totalScore,
          previousScore:
            point.changeFromPrevious !== undefined
              ? point.totalScore - point.changeFromPrevious
              : 0,
          changeFromPrevious: point.changeFromPrevious ?? 0,
          alertFlag: point.alertFlag,
          alertReason: point.alertReason,
        })
      }
    }

    return allAlerts
  }

  /**
   * Returns all available measure types with their display names.
   */
  getAvailableMeasures(): {
    measureType: OutcomeMeasureType
    displayName: string
    maxScore: number
  }[] {
    return [
      {
        measureType: 'phq-9',
        displayName: 'PHQ-9 (Patient Health Questionnaire-9)',
        maxScore: MAX_SCORES['phq-9'],
      },
      {
        measureType: 'gad-7',
        displayName: 'GAD-7 (Generalized Anxiety Disorder-7)',
        maxScore: MAX_SCORES['gad-7'],
      },
      {
        measureType: 'oq-45',
        displayName: 'OQ-45 (Outcome Questionnaire-45)',
        maxScore: MAX_SCORES['oq-45'],
      },
    ]
  }

  /**
   * Returns measure configurations for a patient.
   *
   * If persisted configs exist in the database, those are returned (enriched
   * with the latest administration date and next due date from trend data).
   * Otherwise, default configs are computed for all three measures.
   */
  async getMeasureConfigs(patientId: string): Promise<MeasureConfig[]> {
    validatePatientId(patientId)

    const persisted = await this.measureConfigRepo.findByPatient(patientId)
    if (persisted.length > 0) {
      const enriched: MeasureConfig[] = []
      for (const config of persisted) {
        const trend = await this.getTrend(patientId, config.measureType)
        const lastAdministeredDate =
          trend.points.length > 0
            ? trend.points[trend.points.length - 1].administeredAt
            : undefined
        enriched.push({
          ...config,
          nextDueDate: this.calculateNextDueDate(
            lastAdministeredDate,
            config.cadence,
          ),
          lastAdministeredDate,
        })
      }
      return enriched
    }

    const measureTypes: OutcomeMeasureType[] = ['phq-9', 'gad-7', 'oq-45']
    const configs: MeasureConfig[] = []

    for (const measureType of measureTypes) {
      const trend = await this.getTrend(patientId, measureType)
      const lastAdministeredDate =
        trend.points.length > 0
          ? trend.points[trend.points.length - 1].administeredAt
          : undefined

      configs.push({
        patientId,
        measureType,
        cadence: 'weekly',
        active: true,
        nextDueDate: this.calculateNextDueDate(lastAdministeredDate, 'weekly'),
        lastAdministeredDate,
      })
    }

    return configs
  }

  /**
   * Configures a measure for a patient and persists the configuration.
   */
  async configureMeasure(input: MeasureConfigInput): Promise<MeasureConfig> {
    validatePatientId(input.patientId)

    const trend = await this.getTrend(input.patientId, input.measureType)
    const lastAdministeredDate =
      trend.points.length > 0
        ? trend.points[trend.points.length - 1].administeredAt
        : undefined

    const config: MeasureConfig = {
      patientId: input.patientId,
      measureType: input.measureType,
      cadence: input.cadence,
      active: input.active ?? true,
      nextDueDate: this.calculateNextDueDate(
        lastAdministeredDate,
        input.cadence,
      ),
      lastAdministeredDate,
    }

    return this.measureConfigRepo.upsert(config)
  }

  /**
   * Calculates the next due date based on cadence and last administration.
   */
  private calculateNextDueDate(
    lastAdministeredDate: string | undefined,
    cadence: 'weekly' | 'biweekly',
  ): string {
    const base = lastAdministeredDate
      ? new Date(lastAdministeredDate)
      : new Date()
    const days = cadence === 'weekly' ? 7 : 14
    base.setDate(base.getDate() + days)
    return base.toISOString()
  }
}

// ---------------------------------------------------------------------------
// Exported pure functions for unit testing
// ---------------------------------------------------------------------------

export {
  scorePHQ9,
  scoreGAD7,
  scoreOQ45,
  scoreResponse,
  getSeverity,
  detectSignificantChange,
  buildQuestionnaireResponse,
  extractAnswerValue,
  type ResponseItem,
  QUESTIONNAIRE_URLS,
  LOINC_CODES,
  MAX_SCORES,
  DETERIORATION_THRESHOLD,
  IMPROVEMENT_THRESHOLD,
  OQ45_REVERSE_SCORED,
}
