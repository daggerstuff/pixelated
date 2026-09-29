/**
 * Bias Audit Runner
 *
 * Samples N responses per demographic segment, computes quality metric
 * variance across segments, and produces a structured JSON report.
 * Flags alerts when variance exceeds the 2% threshold (PIX-4046).
 */

import type {
  AlertLevel,
  TherapeuticSession,
  AIResponse,
  ParticipantDemographics,
} from './types'
import { getAuditLogger } from './audit'

/**
 * Quality metrics computed for each demographic segment.
 */
export interface SegmentQualityMetrics {
  /** Average AI response confidence (0-1) */
  averageConfidence: number
  /** Average response length (chars) */
  averageResponseLength: number
  /** Fraction of responses with confidence >= 0.7 */
  highConfidenceRate: number
  /** Average sentiment accuracy (0-1, from expected outcomes) */
  outcomeAchievementRate: number
  /** Number of responses sampled */
  sampleSize: number
  /** Number of expected outcomes evaluated for outcomeAchievementRate */
  outcomeCount: number
}

/**
 * Result for a single demographic segment.
 */
export interface SegmentResult {
  /** Demographic dimension (e.g., "age", "gender", "ethnicity") */
  segmentKey: string
  /** Segment value (e.g., "18-25", "male", "asian") */
  segmentValue: string
  /** Number of sessions in this segment */
  sessionCount: number
  /** Number of responses sampled */
  sampleSize: number
  /** Computed quality metrics */
  metrics: SegmentQualityMetrics
}

/**
 * Variance result for a single metric across segments.
 */
export interface VarianceResult {
  /** Metric name */
  metric: string
  /** Maximum value across segments */
  max: number
  /** Minimum value across segments */
  min: number
  /** Spread across segments, in `unit` */
  variance: number
  /** Threshold in `unit` */
  threshold: number
  /** Unit the variance is expressed in */
  unit: 'percentage-points' | 'relative-percent'
  /**
   * For proportion metrics (highConfidenceRate, outcomeAchievementRate):
   * whether the max/min gap clears a two-proportion z-test at p < 0.01.
   * Non-proportion metrics are always true (threshold is the only gate).
   */
  statisticallySignificant: boolean
  /** True if variance exceeds threshold AND the gap is statistically significant */
  exceeded: boolean
}

/**
 * Complete bias audit report.
 */
export interface BiasAuditReport {
  /** Unique report ID */
  reportId: string
  /** Audit month in YYYY-MM format */
  month: string
  /** ISO timestamp of report generation */
  generatedAt: string
  /** Total sessions analyzed */
  totalSessions: number
  /** Total responses sampled */
  totalResponses: number
  /** Per-segment results */
  segments: SegmentResult[]
  /** Variance results per metric */
  varianceResults: VarianceResult[]
  /** True if any variance exceeds threshold */
  thresholdExceeded: boolean
  /** Alert level based on severity */
  alertLevel: AlertLevel
  /** Summary text */
  summary: string
  /** Recommendations */
  recommendations: string[]
}

/**
 * Options for running a bias audit.
 */
export interface BiasAuditOptions {
  /** Month in YYYY-MM format (defaults to current month) */
  month?: string
  /** Variance threshold in percentage points (default 2.0) */
  varianceThreshold?: number
  /** Minimum sample size per segment */
  minSampleSize?: number
  /** Demographic dimensions to audit */
  dimensions?: (keyof ParticipantDemographics)[]
}

const DEFAULT_DIMENSIONS: (keyof ParticipantDemographics)[] = [
  'age',
  'gender',
  'ethnicity',
  'culturalBackground',
  'socioeconomicStatus',
]

const DEFAULT_VARIANCE_THRESHOLD = 2.0 // 2 percentage points
const DEFAULT_MIN_SAMPLE_SIZE = 10
const MAX_SAMPLE_SIZE = 500

/**
 * Metrics audited for cross-segment variance (every quality metric except sampleSize).
 */
const AUDITED_METRICS = [
  'averageConfidence',
  'averageResponseLength',
  'highConfidenceRate',
  'outcomeAchievementRate',
] as const

type AuditedMetric = (typeof AUDITED_METRICS)[number]

/**
 * Unit per audited metric. Rate/confidence metrics are 0-1 ratios whose spread
 * is naturally expressed in percentage points. averageResponseLength is in
 * characters — an absolute spread there is meaningless without a scale, so it
 * is expressed as relative percent of the max segment mean.
 */
const METRIC_UNITS: Record<AuditedMetric, VarianceResult['unit']> = {
  averageConfidence: 'percentage-points',
  highConfidenceRate: 'percentage-points',
  outcomeAchievementRate: 'percentage-points',
  averageResponseLength: 'relative-percent',
}

/**
 * Threshold for relative-percent metrics (averageResponseLength), in relative
 * percent. A 2pp threshold would misfire on length: real sessions differ by
 * tens of characters, so a spread below 10% of the max segment mean is not
 * actionable.
 */
const RELATIVE_LENGTH_THRESHOLD = 10

/** Two-proportion z-test critical value for p < 0.01 (two-tailed). */
const Z_CRITICAL = 2.576

/**
 * Proportion metrics are gated behind a two-proportion z-test so that small
 * samples cannot turn sampling noise into a bias alert.
 */
const PROPORTION_METRICS: readonly AuditedMetric[] = [
  'highConfidenceRate',
  'outcomeAchievementRate',
]

/**
 * Two-proportion pooled z statistic. Returns +/-Infinity when the pooled
 * standard error collapses to 0 (degenerate 0/1 rates with a real gap).
 */
function twoProportionZ(
  successes1: number,
  n1: number,
  successes2: number,
  n2: number,
): number {
  const p1 = n1 > 0 ? successes1 / n1 : 0
  const p2 = n2 > 0 ? successes2 / n2 : 0
  const pooled = (successes1 + successes2) / (n1 + n2)
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2))
  if (se === 0) {
    if (p1 === p2) return 0
    return p1 > p2 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY
  }
  return (p1 - p2) / se
}

/**
 * Compute quality metrics for a set of AI responses.
 */
function computeMetrics(
  responses: AIResponse[],
  sessions: TherapeuticSession[],
): SegmentQualityMetrics {
  if (responses.length === 0) {
    return {
      averageConfidence: 0,
      averageResponseLength: 0,
      highConfidenceRate: 0,
      outcomeAchievementRate: 0,
      sampleSize: 0,
      outcomeCount: 0,
    }
  }

  const confidences = responses
    .map((r) => r.confidence ?? 0)
    .filter((c) => typeof c === 'number' && !Number.isNaN(c))
  const lengths = responses
    .map((r) => (r.text ?? r.content ?? '').length)
    .filter((l) => l > 0)

  const avgConfidence =
    confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0

  const avgLength =
    lengths.length > 0 ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0

  const highConfRate =
    confidences.length > 0
      ? confidences.filter((c) => c >= 0.7).length / confidences.length
      : 0

  // Outcome achievement: fraction of expected outcomes marked as achieved
  const allOutcomes = sessions.flatMap((s) => s.expectedOutcomes ?? [])
  const achievedCount = allOutcomes.filter((o) => o.achieved).length
  const outcomeRate =
    allOutcomes.length > 0 ? achievedCount / allOutcomes.length : 0

  return {
    averageConfidence: avgConfidence,
    averageResponseLength: avgLength,
    highConfidenceRate: highConfRate,
    outcomeAchievementRate: outcomeRate,
    sampleSize: responses.length,
    outcomeCount: allOutcomes.length,
  }
}

/**
 * Sample up to N responses from sessions, uniformly.
 */
function sampleResponses(
  sessions: TherapeuticSession[],
  maxN: number,
): { responses: AIResponse[]; sampledSessions: TherapeuticSession[] } {
  const allResponses: Array<{
    response: AIResponse
    session: TherapeuticSession
  }> = []
  for (const session of sessions) {
    for (const resp of session.aiResponses ?? []) {
      allResponses.push({ response: resp, session })
    }
  }

  if (allResponses.length <= maxN) {
    return {
      responses: allResponses.map((x) => x.response),
      sampledSessions: sessions,
    }
  }

  // Uniform sampling: stride through the array
  const stride = allResponses.length / maxN
  const sampled: AIResponse[] = []
  const sampledSessionIds = new Set<string>()
  const sampledSessions: TherapeuticSession[] = []

  for (let i = 0; i < maxN; i++) {
    const idx = Math.floor(i * stride)
    sampled.push(allResponses[idx].response)
    sampledSessionIds.add(allResponses[idx].session.sessionId ?? `s${idx}`)
  }

  // Collect unique sessions
  for (const s of sessions) {
    if (sampledSessionIds.has(s.sessionId ?? '')) {
      sampledSessions.push(s)
    }
  }

  return { responses: sampled, sampledSessions }
}

/**
 * Group sessions by a demographic dimension.
 */
function groupByDemographic(
  sessions: TherapeuticSession[],
  dimension: keyof ParticipantDemographics,
): Map<string, TherapeuticSession[]> {
  const groups = new Map<string, TherapeuticSession[]>()

  for (const session of sessions) {
    const demo = session.participantDemographics
    if (!demo) continue

    let value: string | undefined
    if (dimension === 'culturalBackground') {
      // Array field — use each value as a separate segment
      const arr = demo.culturalBackground ?? []
      for (const v of arr) {
        if (!groups.has(v)) groups.set(v, [])
        groups.get(v)!.push(session)
      }
      continue
    }

    value = demo[dimension]
    if (!value) continue

    if (!groups.has(value)) groups.set(value, [])
    groups.get(value)!.push(session)
  }

  return groups
}

/**
 * Compute variance across segments for a given metric.
 *
 * The spread is expressed in the metric's unit (percentage points for ratios,
 * relative percent for length). For proportion metrics a spread is only
 * actionable when it clears a two-proportion z-test at p < 0.01 between the
 * highest and lowest segments — a raw max/min gap on small samples is
 * indistinguishable from sampling noise.
 */
function computeVariance(
  segments: SegmentResult[],
  metric: AuditedMetric,
  threshold: number,
): VarianceResult {
  const unit = METRIC_UNITS[metric]
  const eligible = segments.filter((s) => s.sampleSize > 0)

  if (eligible.length < 2) {
    return {
      metric,
      max: 0,
      min: 0,
      variance: 0,
      threshold,
      unit,
      statisticallySignificant: false,
      exceeded: false,
    }
  }

  let maxSegment = eligible[0]
  let minSegment = eligible[0]
  for (const s of eligible) {
    if (s.metrics[metric] > maxSegment.metrics[metric]) maxSegment = s
    if (s.metrics[metric] < minSegment.metrics[metric]) minSegment = s
  }
  const max = maxSegment.metrics[metric]
  const min = minSegment.metrics[metric]

  const variance =
    unit === 'relative-percent'
      ? max === 0
        ? 0
        : ((max - min) / max) * 100
      : (max - min) * 100

  let statisticallySignificant = true
  if (variance > 0 && PROPORTION_METRICS.includes(metric)) {
    if (metric === 'highConfidenceRate') {
      const n1 = maxSegment.metrics.sampleSize
      const n2 = minSegment.metrics.sampleSize
      const k1 = Math.round(maxSegment.metrics.highConfidenceRate * n1)
      const k2 = Math.round(minSegment.metrics.highConfidenceRate * n2)
      statisticallySignificant =
        Math.abs(twoProportionZ(k1, n1, k2, n2)) >= Z_CRITICAL
    } else {
      const n1 = maxSegment.metrics.outcomeCount
      const n2 = minSegment.metrics.outcomeCount
      statisticallySignificant =
        n1 > 0 &&
        n2 > 0 &&
        Math.abs(
          twoProportionZ(
            Math.round(maxSegment.metrics.outcomeAchievementRate * n1),
            n1,
            Math.round(minSegment.metrics.outcomeAchievementRate * n2),
            n2,
          ),
        ) >= Z_CRITICAL
    }
  }

  return {
    metric,
    max,
    min,
    variance,
    threshold,
    unit,
    statisticallySignificant,
    exceeded: variance > threshold && statisticallySignificant,
  }
}

function formatVarianceValue(v: VarianceResult): string {
  return v.unit === 'relative-percent'
    ? `${v.variance.toFixed(2)}% relative`
    : `${v.variance.toFixed(2)} pp`
}

function formatThresholdValue(v: VarianceResult): string {
  return v.unit === 'relative-percent'
    ? `${v.threshold}% relative`
    : `${v.threshold} pp`
}

/**
 * Generate recommendations based on variance results.
 */
function generateRecommendations(
  varianceResults: VarianceResult[],
  segments: SegmentResult[],
): string[] {
  const recs: string[] = []

  const exceeded = varianceResults.filter((v) => v.exceeded)
  for (const v of exceeded) {
    recs.push(
      `Variance for ${v.metric} exceeds threshold: ${formatVarianceValue(v)} > ${formatThresholdValue(v)}`,
    )
  }

  // Above threshold but not statistically significant — sampling noise, not bias
  const noiseOnly = varianceResults.filter(
    (v) => !v.exceeded && v.variance > v.threshold,
  )
  for (const v of noiseOnly) {
    recs.push(
      `Variance for ${v.metric} is ${formatVarianceValue(v)} (threshold ${formatThresholdValue(v)}) but not statistically significant at p<0.01 — likely sampling noise; monitor next cycle`,
    )
  }

  // Check for underrepresented segments
  const underrepresented = segments.filter((s) => s.sessionCount < 10)
  if (underrepresented.length > 0) {
    recs.push(
      `${underrepresented.length} segment(s) have fewer than 10 samples — consider collecting more data for: ${underrepresented.map((s) => s.segmentValue).join(', ')}`,
    )
  }

  if (recs.length === 0) {
    recs.push(
      'No bias variance issues detected. All metrics within acceptable threshold.',
    )
  }

  return recs
}

/**
 * Determine alert level based on variance results.
 */
function determineAlertLevel(varianceResults: VarianceResult[]): AlertLevel {
  const exceeded = varianceResults.filter((v) => v.exceeded)
  if (exceeded.length === 0) return 'low'
  if (exceeded.length <= 1) return 'medium'
  if (exceeded.length < 3) return 'high'
  return 'critical'
}

/**
 * Bias Audit Runner — executes bias audits across demographic segments.
 */
export class BiasAuditRunner {
  /**
   * Run a complete bias audit.
   *
   * @param sessions - Therapeutic sessions to audit
   * @param options - Audit configuration options
   * @returns Complete bias audit report
   */
  async runAudit(
    sessions: TherapeuticSession[],
    options: BiasAuditOptions = {},
  ): Promise<BiasAuditReport> {
    const month = options.month ?? new Date().toISOString().slice(0, 7)
    const threshold = options.varianceThreshold ?? DEFAULT_VARIANCE_THRESHOLD
    const minSampleSize = options.minSampleSize ?? DEFAULT_MIN_SAMPLE_SIZE
    const dimensions = options.dimensions ?? DEFAULT_DIMENSIONS

    const segments: SegmentResult[] = []

    for (const dim of dimensions) {
      const groups = groupByDemographic(sessions, dim)

      for (const [segmentValue, groupSessions] of groups) {
        const { responses, sampledSessions } = sampleResponses(
          groupSessions,
          MAX_SAMPLE_SIZE,
        )
        const metrics = computeMetrics(responses, sampledSessions)

        segments.push({
          segmentKey: dim,
          segmentValue,
          sessionCount: groupSessions.length,
          sampleSize: metrics.sampleSize,
          metrics,
        })
      }
    }

    // Compute variance for each quality metric
    const varianceResults = AUDITED_METRICS.map((k) =>
      computeVariance(
        segments,
        k,
        k === 'averageResponseLength' ? RELATIVE_LENGTH_THRESHOLD : threshold,
      ),
    )

    const thresholdExceeded = varianceResults.some((v) => v.exceeded)
    const alertLevel = determineAlertLevel(varianceResults)
    const recommendations = generateRecommendations(varianceResults, segments)
    // Count actual responses — segments overlap across dimensions, so summing
    // per-segment sample sizes multi-counts sessions by the number of dimensions.
    const totalResponses = sessions.reduce(
      (sum, s) => sum + (s.aiResponses?.length ?? 0),
      0,
    )

    const report: BiasAuditReport = {
      reportId: `bias-audit-${month}-${Date.now()}`,
      month,
      generatedAt: new Date().toISOString(),
      totalSessions: sessions.length,
      totalResponses,
      segments,
      varianceResults,
      thresholdExceeded,
      alertLevel,
      summary: thresholdExceeded
        ? `BIAS DETECTED: ${varianceResults.filter((v) => v.exceeded).length} metric(s) exceed ${threshold}% variance threshold`
        : `PASS: All metrics within ${threshold}% variance threshold across ${segments.length} segments`,
      recommendations,
    }

    // Log the audit action
    try {
      const auditLogger = getAuditLogger()
      await auditLogger.logAction(
        { userId: 'audit-runner', email: 'audit-runner@pixelated.dev', role: { id: 'admin', name: 'Admin', description: 'System audit', level: 10 }, permissions: ['audit:write'] },
        { type: 'create', category: 'bias-audit', description: `Bias audit completed for ${month}: ${report.summary}`, sensitivityLevel: 'low' },
        'bias-audit',
        {
          reportId: report.reportId,
          alertLevel: report.alertLevel,
          thresholdExceeded: report.thresholdExceeded,
          segmentCount: segments.length,
          totalSessions: sessions.length,
        },
        { ipAddress: '', userAgent: 'audit-runner' },
        undefined,
      )
    } catch {
      // Audit logging is best-effort — don't fail the audit
    }

    return report
  }

  /**
   * Serialize report to JSON string.
   */
  serializeReport(report: BiasAuditReport): string {
    return JSON.stringify(report, null, 2)
  }

  /**
   * Get the file path for a monthly report.
   */
  getReportPath(month: string): string {
    return `ai/data/reports/bias-audit-${month}.json`
  }
}

/**
 * Get the singleton BiasAuditRunner instance.
 */
let runnerInstance: BiasAuditRunner | null = null

export function getBiasAuditRunner(): BiasAuditRunner {
  runnerInstance ??= new BiasAuditRunner();
  return runnerInstance
}

export function resetBiasAuditRunner(): void {
  runnerInstance = null
}
