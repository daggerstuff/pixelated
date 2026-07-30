/**
 * PIX-536: Evidence-based reprioritization engine — TypeScript mirror.
 *
 * Matches the Python implementation in ai/pkg_mera/core/pipelines/reprioritization_engine.py.
 * Consumes feedback reports from PIX-508, produces reprioritized backlog items
 * for Workstreams A, B, C.
 *
 * PIX-3898: Integrates with the outcome evaluation layer so that
 * {@link ReflectionContext} entries from the reflection loop are converted
 * into {@link EvidencePoint}s and fed into the prioritization accumulator.
 */

import type { ReflectionContext } from '@pixelated/memory-schema'

import {
  evaluateReflectionOutcome,
  type EvaluationResult,
} from './reflection/outcome-evaluator'

export const DEFAULT_ACTION_THRESHOLD = 0.3

export enum UpstreamDomain {
  ACQUISITION = 'acquisition',
  CURATION = 'curation',
  PRIVACY = 'privacy',
  REVIEW = 'review',
  PACKAGING = 'packaging',
}

export enum InterventionType {
  PRIORITY_CHANGE = 'priority_change',
  RULE_UPDATE = 'rule_update',
  THRESHOLD_ADJUSTMENT = 'threshold_adjustment',
  DATASET_FILTER = 'dataset_filter',
  REVIEW_FOCUS = 'review_focus',
  SOURCE_INTAKE = 'source_intake',
  NORMALIZATION_UPDATE = 'normalization_update',
  VALIDATION_GATE_UPDATE = 'validation_gate_update',
}

export enum EvidenceSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum PriorityTier {
  URGENT = 'urgent',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  BACKLOG = 'backlog',
}

// ─── Config ──────────────────────────────────────────────────────────────────

export interface ReprioritizationConfig {
  actionThreshold: number
  churnPreventionWindowDays: number
  evidenceDecayRate: number
  maxTrackedPatterns: number
  maxEvidenceAgeDays: number
  urgentThreshold: number
  highThreshold: number
  mediumThreshold: number
  lowThreshold: number
  reprioritizeScoreDeltaRatio: number
}

export function defaultConfig(
  overrides?: Partial<ReprioritizationConfig>,
): ReprioritizationConfig {
  return {
    actionThreshold: DEFAULT_ACTION_THRESHOLD,
    churnPreventionWindowDays: 7,
    evidenceDecayRate: 0.05,
    maxTrackedPatterns: 10_000,
    maxEvidenceAgeDays: 30,
    urgentThreshold: 3.0,
    highThreshold: 2.0,
    mediumThreshold: 1.0,
    lowThreshold: 0.5,
    reprioritizeScoreDeltaRatio: 0.2,
    ...overrides,
  }
}

// ─── Data types ──────────────────────────────────────────────────────────────

export interface EvidencePoint {
  patternId: string
  patternType: string
  description: string
  domain: UpstreamDomain
  severity: EvidenceSeverity
  frequency: number
  confidence: number
  rootCauseHypothesis: string
  metricsImpacted: string[]
  timestamp: string
}

export interface EvidenceAccumulation {
  patternId: string
  domain: UpstreamDomain
  description: string
  evidencePoints: EvidencePoint[]
  firstSeen: string
  lastSeen: string
  totalWeight: number
  actionThreshold: number
  evidenceDecayRate: number
  maxEvidenceAgeDays: number
  isActionable: boolean
}

export interface BacklogItem {
  itemId: string
  domain: UpstreamDomain
  interventionType: InterventionType
  title: string
  description: string
  priorityTier: PriorityTier
  priorityScore: number
  evidencePatternIds: string[]
  rootCauseHypothesis: string
  validationCriteria: string[]
  createdAt: string
  previousPriorityTier: PriorityTier | null
  reasonForChange: string
}

export interface PriorityChange {
  itemId: string
  domain: UpstreamDomain
  previousTier: PriorityTier | null
  newTier: PriorityTier
  previousScore: number
  newScore: number
  reason: string
  evidencePatternIds: string[]
  changedAt: string
}

export interface ReprioritizationReport {
  runId: string
  timestamp: string
  evidenceSourcesConsumed: number
  totalEvidencePoints: number
  actionablePatterns: number
  backlogItemsCreated: number
  backlogItemsReprioritized: number
  priorityChanges: PriorityChange[]
  newBacklogItems: BacklogItem[]
  reprioritizedItems: BacklogItem[]
  unchangedItems: BacklogItem[]
  byDomain: Record<string, Record<string, unknown>>
}

// ─── Severity weight helper ──────────────────────────────────────────────────

const SEVERITY_WEIGHTS: Record<string, number | undefined> = {
  [EvidenceSeverity.CRITICAL]: 4.0,
  [EvidenceSeverity.HIGH]: 3.0,
  [EvidenceSeverity.MEDIUM]: 2.0,
  [EvidenceSeverity.LOW]: 1.0,
}

export function severityWeight(severity: EvidenceSeverity | string): number {
  return SEVERITY_WEIGHTS[severity] ?? 1.0
}

// ─── ID generation helpers ───────────────────────────────────────────────────

async function generateItemId(
  patternId: string,
  domain: UpstreamDomain,
): Promise<string> {
  const raw = `${domain}:${patternId}`
  let hex = crypto.randomUUID().replace(/-/g, '').slice(0, 6)
  const encoder = new TextEncoder()
  const data = encoder.encode(raw)
  let hashHex = ''
  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    hashHex = Array.from(new Uint8Array(hashBuffer))
      .slice(0, 6)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    // fallback path uses random hex above
  }
  return `reprio-${hashHex || hex}`
}

function generateRunId(): string {
  const now = new Date()
  const ts = now
    .toISOString()
    .replace(/[-:T.]/g, '')
    .slice(0, 14)
  return `run-${ts}`
}

function generateTitle(
  point: EvidencePoint,
  accumulation: EvidenceAccumulation,
): string {
  const domainLabel =
    point.domain.charAt(0).toUpperCase() + point.domain.slice(1)
  const severityLabel = point.severity.toUpperCase()
  const evidenceCount = accumulation.evidencePoints.length
  return `[${severityLabel}] ${domainLabel}: ${point.description} (${evidenceCount} evidence points)`
}

function generateDescription(
  point: EvidencePoint,
  accumulation: EvidenceAccumulation,
): string {
  return [
    `**Domain**: ${point.domain}`,
    `**Pattern**: ${point.patternType}`,
    `**Severity**: ${point.severity}`,
    `**Frequency**: ${(point.frequency * 100).toFixed(1)}%`,
    `**Confidence**: ${point.confidence.toFixed(2)}`,
    `**Evidence Weight**: ${accumulation.totalWeight.toFixed(4)}`,
    `**Evidence Points**: ${accumulation.evidencePoints.length}`,
    `**First Seen**: ${accumulation.firstSeen}`,
    `**Last Seen**: ${accumulation.lastSeen}`,
    '',
    `**Root Cause Hypothesis**: ${point.rootCauseHypothesis}`,
    '',
    `**Description**: ${point.description}`,
    '',
    `**Metrics Impacted**: ${point.metricsImpacted.length > 0 ? point.metricsImpacted.join(', ') : 'None specified'}`,
  ].join('\n')
}

function generateValidationCriteria(
  point: EvidencePoint,
  interventionType: InterventionType,
): string[] {
  const criteria = [
    'Evidence weight exceeds action threshold',
    `Severity: ${point.severity}`,
    `Frequency: ${(point.frequency * 100).toFixed(1)}%`,
  ]
  const typeCriteria: Record<InterventionType, string[] | undefined> = {
    [InterventionType.SOURCE_INTAKE]: [
      'New source qualified per acquisition rubric',
      'Pilot acquisition completed with metadata',
    ],
    [InterventionType.RULE_UPDATE]: [
      'Rule change reviewed and approved',
      'Privacy audit trail updated',
    ],
    [InterventionType.THRESHOLD_ADJUSTMENT]: [
      'New threshold validated against holdout data',
      'No regression in existing quality metrics',
    ],
    [InterventionType.DATASET_FILTER]: [
      'Filter criteria defined and tested',
      'Impact on dataset size quantified',
    ],
    [InterventionType.REVIEW_FOCUS]: [
      'Review criteria updated',
      'Human review queue updated with new focus area',
    ],
    [InterventionType.NORMALIZATION_UPDATE]: [
      'Normalization rule tested on sample data',
      'Dedup impact assessed',
    ],
    [InterventionType.VALIDATION_GATE_UPDATE]: [
      'New gate criteria defined',
      'Gate tested against existing packages',
    ],
    [InterventionType.PRIORITY_CHANGE]: [
      'Intervention validated against evidence',
    ],
  }
  criteria.push(
    ...(typeCriteria[interventionType] ?? [
      'Intervention validated against evidence',
    ]),
  )
  return criteria
}

function generateChangeReason(
  existing: BacklogItem,
  newTier: PriorityTier,
  newScore: number,
  accumulation: EvidenceAccumulation,
): string {
  const direction =
    newScore > existing.priorityScore ? 'increased' : 'decreased'
  const evidenceCount = accumulation.evidencePoints.length
  return (
    `Priority ${direction} from ${existing.priorityTier} to ${newTier} ` +
    `(score: ${existing.priorityScore.toFixed(4)} -> ${newScore.toFixed(4)}) ` +
    `based on ${evidenceCount} accumulated evidence points for pattern ${accumulation.patternId}`
  )
}

// ─── Type Guards ─────────────────────────────────────────────────────────────

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null
}

function isRecordArray(val: unknown): val is Record<string, unknown>[] {
  return Array.isArray(val) && val.every(isRecord)
}

// ─── EvidenceAccumulator ─────────────────────────────────────────────────────

export class EvidenceAccumulator {
  private readonly accumulations: Map<string, EvidenceAccumulation> = new Map()
  private readonly config: ReprioritizationConfig

  constructor(config?: ReprioritizationConfig) {
    this.config = config ?? defaultConfig()
  }

  ingestFeedbackDict(report: Record<string, unknown>): EvidencePoint[] {
    const points = this.parseFeedbackReport(report)
    for (const point of points) {
      this.recordEvidence(point)
    }
    return points
  }

  private parseFeedbackReport(
    report: Record<string, unknown>,
  ): EvidencePoint[] {
    const evidencePoints: EvidencePoint[] = []

    const rawFailurePatterns = report['failure_patterns']
    const failurePatterns = isRecordArray(rawFailurePatterns)
      ? rawFailurePatterns
      : []

    const rawUpstreamMappings = report['upstream_mappings']
    const upstreamMappings = isRecordArray(rawUpstreamMappings)
      ? rawUpstreamMappings
      : []

    const mappingLookup: Record<string, Record<string, unknown>> = {}
    for (const mapping of upstreamMappings) {
      const fp = mapping['failure_pattern']
      if (isRecord(fp)) {
        const patternId = fp['pattern_id']
        if (typeof patternId === 'string' && patternId) {
          mappingLookup[patternId] = mapping
        }
      }
    }

    for (const pattern of failurePatterns) {
      const patternIdRaw = pattern['pattern_id']
      const patternId = typeof patternIdRaw === 'string' ? patternIdRaw : ''
      const mapping = mappingLookup[patternId] ?? {}

      const upstreamDomainRaw = mapping['upstream_domain']
      const upstreamDomain =
        typeof upstreamDomainRaw === 'string' ? upstreamDomainRaw : 'curation'

      let domain = UpstreamDomain.CURATION
      const normalizedDomain = upstreamDomain.toLowerCase()
      for (const val of Object.values(UpstreamDomain)) {
        if ((val as string) === normalizedDomain) {
          domain = val
          break
        }
      }

      const severityStrRaw = pattern['severity']
      const severityStr =
        typeof severityStrRaw === 'string' ? severityStrRaw : 'medium'

      let severity = EvidenceSeverity.MEDIUM
      const normalizedSeverity = severityStr.toLowerCase()
      for (const val of Object.values(EvidenceSeverity)) {
        if ((val as string) === normalizedSeverity) {
          severity = val
          break
        }
      }

      const confidenceRaw = mapping['confidence']
      const confidence = typeof confidenceRaw === 'number' ? confidenceRaw : 0.5

      const rootCauseHypothesisRaw = mapping['root_cause_hypothesis']
      const patternDescriptionRaw = pattern['description']

      let rootCause = ''
      if (
        typeof rootCauseHypothesisRaw === 'string' &&
        rootCauseHypothesisRaw
      ) {
        rootCause = rootCauseHypothesisRaw
      } else if (typeof patternDescriptionRaw === 'string') {
        rootCause = patternDescriptionRaw
      }

      const patternTypeRaw = pattern['pattern_type']
      const patternType =
        typeof patternTypeRaw === 'string' ? patternTypeRaw : 'unknown'

      const descriptionRaw = pattern['description']
      const description =
        typeof descriptionRaw === 'string' ? descriptionRaw : ''

      const frequencyRaw = pattern['frequency']
      const frequency = typeof frequencyRaw === 'number' ? frequencyRaw : 0.0

      const metricsImpactedRaw = pattern['metrics_impacted']
      const metricsImpacted: string[] = []
      if (Array.isArray(metricsImpactedRaw)) {
        for (const m of metricsImpactedRaw) {
          if (typeof m === 'string') {
            metricsImpacted.push(m)
          }
        }
      }

      const point: EvidencePoint = {
        patternId,
        patternType,
        description,
        domain,
        severity,
        frequency,
        confidence,
        rootCauseHypothesis: rootCause,
        metricsImpacted,
        timestamp: new Date().toISOString(),
      }
      evidencePoints.push(point)
    }

    return evidencePoints
  }

  recordEvidence(point: EvidencePoint): EvidenceAccumulation {
    let accumulation = this.accumulations.get(point.patternId)
    if (!accumulation) {
      accumulation = {
        patternId: point.patternId,
        domain: point.domain,
        description: point.description,
        evidencePoints: [],
        firstSeen: '',
        lastSeen: '',
        totalWeight: 0.0,
        actionThreshold: this.config.actionThreshold,
        evidenceDecayRate: this.config.evidenceDecayRate,
        maxEvidenceAgeDays: this.config.maxEvidenceAgeDays,
        isActionable: false,
      }
      this.accumulations.set(point.patternId, accumulation)
    }

    this.addEvidenceToAccumulation(accumulation, point)
    this.pruneAccumulationsIfNeeded()
    return accumulation
  }

  private addEvidenceToAccumulation(
    accumulation: EvidenceAccumulation,
    point: EvidencePoint,
  ): void {
    accumulation.evidencePoints.push(point)
    accumulation.lastSeen = point.timestamp
    if (!accumulation.firstSeen) {
      accumulation.firstSeen = point.timestamp
    }
    this.removeOldEvidence(accumulation)
    this.recalculateWeight(accumulation)
    accumulation.isActionable =
      accumulation.totalWeight >= accumulation.actionThreshold
  }

  private removeOldEvidence(accumulation: EvidenceAccumulation): void {
    const cutoffMs = Date.now() - accumulation.maxEvidenceAgeDays * 86_400_000
    accumulation.evidencePoints = accumulation.evidencePoints.filter(
      (p) => new Date(p.timestamp).getTime() >= cutoffMs,
    )
  }

  private recalculateWeight(accumulation: EvidenceAccumulation): void {
    const now = Date.now()
    let total = 0.0
    for (const point of accumulation.evidencePoints) {
      const pointTime = new Date(point.timestamp).getTime()
      const ageDays = (now - pointTime) / 86_400_000
      const decay = Math.exp(-accumulation.evidenceDecayRate * ageDays)
      const sevWeight = severityWeight(point.severity)
      const pointWeight = sevWeight * point.frequency * point.confidence * decay
      total += pointWeight
    }
    accumulation.totalWeight = Math.round(total * 10_000) / 10_000
  }

  private pruneAccumulationsIfNeeded(): void {
    const limit = this.config.maxTrackedPatterns
    if (this.accumulations.size <= limit) return

    const inactive = Array.from(this.accumulations.entries())
      .filter(([, a]) => !a.isActionable)
      .sort((a, b) =>
        (a[1].lastSeen || a[1].firstSeen).localeCompare(
          b[1].lastSeen || b[1].firstSeen,
        ),
      )

    while (this.accumulations.size > limit && inactive.length > 0) {
      const [patternId] = inactive.shift()!
      this.accumulations.delete(patternId)
    }
  }

  getActionablePatterns(): EvidenceAccumulation[] {
    return Array.from(this.accumulations.values()).filter((a) => a.isActionable)
  }

  getAccumulation(patternId: string): EvidenceAccumulation | undefined {
    return this.accumulations.get(patternId)
  }

  getAllAccumulations(): Map<string, EvidenceAccumulation> {
    return new Map(this.accumulations)
  }

  clear(): void {
    this.accumulations.clear()
  }

  summary(): Record<string, unknown> {
    const actionable = Array.from(this.accumulations.values()).filter(
      (a) => a.isActionable,
    )
    const byDomain: Record<string, number> = {}
    for (const a of Array.from(this.accumulations.values())) {
      byDomain[a.domain] = (byDomain[a.domain] ?? 0) + 1
    }
    return {
      totalPatterns: this.accumulations.size,
      actionablePatterns: actionable.length,
      totalEvidencePoints: Array.from(this.accumulations.values()).reduce(
        (sum, a) => sum + a.evidencePoints.length,
        0,
      ),
      byDomain,
    }
  }
}

// ─── PriorityCalculator ──────────────────────────────────────────────────────

export class PriorityCalculator {
  private static readonly DOMAIN_URGENCY: Record<
    UpstreamDomain,
    number | undefined
  > = {
    [UpstreamDomain.PRIVACY]: 1.5,
    [UpstreamDomain.ACQUISITION]: 1.2,
    [UpstreamDomain.CURATION]: 1.0,
    [UpstreamDomain.REVIEW]: 1.1,
    [UpstreamDomain.PACKAGING]: 0.9,
  }

  private readonly config: ReprioritizationConfig

  constructor(config?: ReprioritizationConfig) {
    this.config = config ?? defaultConfig()
  }

  calculatePriority(
    evidenceWeight: number,
    severity: EvidenceSeverity,
    frequency: number,
    domain: UpstreamDomain,
    coverageGap = 0.0,
  ): [number, PriorityTier] {
    const urgencyScore =
      severityWeight(severity) *
      (PriorityCalculator.DOMAIN_URGENCY[domain] ?? 1.0)
    const evidenceComponent = evidenceWeight * 0.4
    const urgencyComponent = urgencyScore * frequency * 0.3
    const coverageComponent = coverageGap * 0.3
    const priorityScore =
      Math.round(
        (evidenceComponent + urgencyComponent + coverageComponent) * 10_000,
      ) / 10_000
    const tier = this.scoreToTier(priorityScore)
    return [priorityScore, tier]
  }

  calculateInterventionType(
    domain: UpstreamDomain,
    patternType: string,
    severity: EvidenceSeverity,
  ): InterventionType {
    const patternInterventionMap: Record<string, InterventionType> = {
      memory_deficiency: InterventionType.SOURCE_INTAKE,
      memory_noise: InterventionType.NORMALIZATION_UPDATE,
      context_alignment: InterventionType.NORMALIZATION_UPDATE,
      reflection_quality: InterventionType.REVIEW_FOCUS,
      generation_quality: InterventionType.VALIDATION_GATE_UPDATE,
      privacy_risk: InterventionType.RULE_UPDATE,
      quality_degradation: InterventionType.THRESHOLD_ADJUSTMENT,
      dataset_gap: InterventionType.DATASET_FILTER,
    }

    if (domain === UpstreamDomain.PRIVACY) return InterventionType.RULE_UPDATE
    if (domain === UpstreamDomain.ACQUISITION)
      return InterventionType.SOURCE_INTAKE
    if (
      severity === EvidenceSeverity.CRITICAL &&
      !(patternType in patternInterventionMap)
    ) {
      return InterventionType.THRESHOLD_ADJUSTMENT
    }
    return (
      patternInterventionMap[patternType] ?? InterventionType.PRIORITY_CHANGE
    )
  }

  private scoreToTier(score: number): PriorityTier {
    if (score >= this.config.urgentThreshold) return PriorityTier.URGENT
    if (score >= this.config.highThreshold) return PriorityTier.HIGH
    if (score >= this.config.mediumThreshold) return PriorityTier.MEDIUM
    if (score >= this.config.lowThreshold) return PriorityTier.LOW
    return PriorityTier.BACKLOG
  }
}

// ─── ReprioritizationEngine ──────────────────────────────────────────────────

export class ReprioritizationEngine {
  private readonly config: ReprioritizationConfig
  accumulator: EvidenceAccumulator
  calculator: PriorityCalculator
  private readonly backlog: Map<string, BacklogItem> = new Map()
  private readonly priorityChanges: PriorityChange[] = []

  constructor(config?: ReprioritizationConfig) {
    this.config = config ?? defaultConfig()
    this.accumulator = new EvidenceAccumulator(this.config)
    this.calculator = new PriorityCalculator(this.config)
  }

  loadFeedbackDict(report: Record<string, unknown>): EvidencePoint[] {
    return this.accumulator.ingestFeedbackDict(report)
  }

  /**
   * Evaluate a reflection context and feed the result into the evidence
   * accumulator as an {@link EvidencePoint}.
   *
   * This bridges the reflection loop (PIX-3898) with the reprioritization
   * engine so that action outcomes from the reflexion module directly inform
   * backlog priority calculations.
   *
   * @param context - A reflection context from the reflexion loop.
   * @param groundTruth - Optional ground-truth signal (user override, downstream success).
   * @returns The evaluation result and the generated evidence point.
   */
  ingestReflectionContext(
    context: ReflectionContext,
    groundTruth?: {
      success?: boolean
      userOverride?: import('./reflection/outcome-evaluator').ReflectionOutcome
    },
  ): { evaluation: EvaluationResult; evidence: EvidencePoint } {
    const evaluation = evaluateReflectionOutcome(context, groundTruth)
    const outcomeSeverity: EvidenceSeverity =
      evaluation.outcome === 'failure'
        ? EvidenceSeverity.HIGH
        : evaluation.outcome === 'partial'
          ? EvidenceSeverity.MEDIUM
          : EvidenceSeverity.LOW
    const frequency = Math.round(evaluation.confidence * 10) / 10
    const patternId = `reflection:${context.actionType}:${context.actionId}`

    const evidence: EvidencePoint = {
      patternId,
      patternType: `reflection_${evaluation.outcome}`,
      description: evaluation.rationale,
      domain: UpstreamDomain.REVIEW,
      severity: outcomeSeverity,
      frequency,
      confidence: evaluation.confidence,
      rootCauseHypothesis:
        context.cognitivePatterns.join('; ') || evaluation.rationale,
      metricsImpacted: context.insights.map((i) => i.summary),
      timestamp: new Date().toISOString(),
    }

    this.accumulator.recordEvidence(evidence)
    return { evaluation, evidence }
  }

  addExistingBacklog(items: BacklogItem[]): void {
    for (const item of items) {
      this.backlog.set(item.itemId, item)
    }
  }

  async runReprioritization(): Promise<ReprioritizationReport> {
    const actionable = this.accumulator.getActionablePatterns()
    const allAccumulations = this.accumulator.getAllAccumulations()

    const newItems: BacklogItem[] = []
    const reprioritized: BacklogItem[] = []
    const unchanged: BacklogItem[] = []
    const priorityChanges: PriorityChange[] = []

    for (const accumulation of actionable) {
      if (accumulation.evidencePoints.length === 0) continue
      const latestPoint =
        accumulation.evidencePoints[accumulation.evidencePoints.length - 1]
      const [score, tier] = this.calculator.calculatePriority(
        accumulation.totalWeight,
        latestPoint.severity,
        latestPoint.frequency,
        latestPoint.domain,
      )
      const interventionType = this.calculator.calculateInterventionType(
        latestPoint.domain,
        latestPoint.patternType,
        latestPoint.severity,
      )
      const itemId = await generateItemId(
        accumulation.patternId,
        latestPoint.domain,
      )
      const title = generateTitle(latestPoint, accumulation)
      const description = generateDescription(latestPoint, accumulation)
      const validationCriteria = generateValidationCriteria(
        latestPoint,
        interventionType,
      )

      const existing = this.backlog.get(itemId)
      if (existing) {
        if (!this.shouldReprioritize(existing, tier, score)) {
          unchanged.push(existing)
          continue
        }

        const change: PriorityChange = {
          itemId,
          domain: existing.domain,
          previousTier: existing.priorityTier,
          newTier: tier,
          previousScore: existing.priorityScore,
          newScore: score,
          reason: generateChangeReason(existing, tier, score, accumulation),
          evidencePatternIds: [accumulation.patternId],
          changedAt: new Date().toISOString(),
        }
        priorityChanges.push(change)
        existing.previousPriorityTier = existing.priorityTier
        existing.priorityTier = tier
        existing.priorityScore = score
        existing.reasonForChange = change.reason
        const idSet = new Set(existing.evidencePatternIds)
        idSet.add(accumulation.patternId)
        existing.evidencePatternIds = Array.from(idSet)
        reprioritized.push(existing)
      } else {
        const newItem: BacklogItem = {
          itemId,
          domain: latestPoint.domain,
          interventionType,
          title,
          description,
          priorityTier: tier,
          priorityScore: score,
          evidencePatternIds: [accumulation.patternId],
          rootCauseHypothesis: latestPoint.rootCauseHypothesis,
          validationCriteria,
          createdAt: new Date().toISOString(),
          previousPriorityTier: null,
          reasonForChange: '',
        }
        this.backlog.set(itemId, newItem)
        newItems.push(newItem)
      }
    }

    for (const [, item] of Array.from(this.backlog.entries())) {
      if (!reprioritized.includes(item) && !newItems.includes(item)) {
        unchanged.push(item)
      }
    }

    const sortByScore = (a: BacklogItem, b: BacklogItem) =>
      b.priorityScore - a.priorityScore
    newItems.sort(sortByScore)
    reprioritized.sort(sortByScore)
    unchanged.sort(sortByScore)

    const byDomain = this.buildDomainSummary(
      newItems,
      reprioritized,
      unchanged,
      allAccumulations,
    )

    return {
      runId: generateRunId(),
      timestamp: new Date().toISOString(),
      evidenceSourcesConsumed: allAccumulations.size,
      totalEvidencePoints: Array.from(allAccumulations.values()).reduce(
        (sum, a) => sum + a.evidencePoints.length,
        0,
      ),
      actionablePatterns: actionable.length,
      backlogItemsCreated: newItems.length,
      backlogItemsReprioritized: reprioritized.length,
      priorityChanges,
      newBacklogItems: newItems,
      reprioritizedItems: reprioritized,
      unchangedItems: unchanged,
      byDomain,
    }
  }

  private shouldReprioritize(
    existing: BacklogItem,
    newTier: PriorityTier,
    newScore: number,
  ): boolean {
    if (existing.priorityTier !== newTier) return true
    if (existing.priorityScore === 0) return newScore > 0
    const scoreChange =
      Math.abs(newScore - existing.priorityScore) / existing.priorityScore
    return scoreChange > this.config.reprioritizeScoreDeltaRatio
  }

  private buildDomainSummary(
    newItems: BacklogItem[],
    reprioritized: BacklogItem[],
    unchanged: BacklogItem[],
    accumulations: Map<string, EvidenceAccumulation>,
  ): Record<string, Record<string, unknown>> {
    // Use numeric records to avoid unknown addition errors
    const byDomain: Record<string, Record<string, number>> = {}

    const allItems = [...newItems, ...reprioritized, ...unchanged]

    for (const item of allItems) {
      let d = byDomain[item.domain]
      if (!d) {
        d = {
          totalItems: 0,
          newItems: 0,
          reprioritizedItems: 0,
          unchangedItems: 0,
          urgentCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          backlogCount: 0,
          actionableEvidenceCount: 0,
        }
        byDomain[item.domain] = d
      }
      const rec = d
      rec['totalItems'] = (rec['totalItems'] ?? 0) + 1
      if (newItems.includes(item)) rec['newItems'] = (rec['newItems'] ?? 0) + 1
      else if (reprioritized.includes(item))
        rec['reprioritizedItems'] = (rec['reprioritizedItems'] ?? 0) + 1
      else rec['unchangedItems'] = (rec['unchangedItems'] ?? 0) + 1

      const tierKey = `${item.priorityTier}Count`
      rec[tierKey] = (rec[tierKey] ?? 0) + 1
    }

    for (const acc of Array.from(accumulations.values())) {
      const rec = byDomain[acc.domain]
      if (rec && acc.isActionable) {
        rec['actionableEvidenceCount'] =
          (rec['actionableEvidenceCount'] ?? 0) + 1
      }
    }

    return byDomain
  }

  getBacklog(): BacklogItem[] {
    return Array.from(this.backlog.values()).sort(
      (a, b) => b.priorityScore - a.priorityScore,
    )
  }

  getBacklogByDomain(domain: UpstreamDomain): BacklogItem[] {
    return this.getBacklog().filter((item) => item.domain === domain)
  }

  getPriorityChanges(): PriorityChange[] {
    return [...this.priorityChanges]
  }
}

// ─── Factory functions ───────────────────────────────────────────────────────

export function createEngine(
  config?: ReprioritizationConfig,
): ReprioritizationEngine {
  return new ReprioritizationEngine(config)
}
