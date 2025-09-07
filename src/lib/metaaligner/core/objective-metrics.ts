/**
 * Objective evaluation metrics system for MetaAligner
 * Provides comprehensive metrics for evaluating objective performance and alignment quality
 */

import {
  ObjectiveDefinition,
  AlignmentContext,
  ObjectiveCriteria,
} from './objectives'
import {
  ObjectiveEvaluationResult,
  AlignmentEvaluationResult,
} from './objective-interfaces'

/**
 * Detailed metrics for objective evaluation
 */
export interface ObjectiveMetrics {
  objectiveId: string
  score: number
  criteriaBreakdown: CriteriaMetrics[]
  confidence: number
  reliability: number
  consistency: number
  improvement: number // Compared to baseline
  trend: EvaluationTrend
  contextualFit: number // How well the objective fits the context
}

export interface CriteriaMetrics {
  criterion: string
  score: number
  weight: number
  contribution: number // To overall objective score
  confidence: number
  evidence: string[] // Supporting evidence for the score
}

export interface EvaluationTrend {
  direction: 'improving' | 'declining' | 'stable'
  magnitude: number // 0-1, how significant the trend is
  period: number // Number of evaluations considered
  confidence: number
}

/**
 * Comprehensive alignment metrics
 */
export interface AlignmentMetrics {
  overallScore: number
  objectiveMetrics: Record<string, ObjectiveMetrics>
  balanceScore: number // How well balanced the objectives are
  consistencyScore: number // How consistent across evaluations
  improvementScore: number // Overall improvement trend
  contextualAlignment: number // How well aligned with context
  qualityIndicators: QualityIndicators
  performanceProfile: PerformanceProfile
}

export interface QualityIndicators {
  reliability: number // Consistency of measurements
  validity: number // How well metrics capture intended concepts
  sensitivity: number // Ability to detect meaningful changes
  specificity: number // Ability to avoid false positives
  coverage: number // How comprehensively objectives are evaluated
}

export interface PerformanceProfile {
  strengths: string[] // Best performing objectives/criteria
  weaknesses: string[] // Underperforming areas
  opportunities: string[] // Areas for improvement
  risks: string[] // Potential concerns
}

/**
 * Historical evaluation tracking
 */
export interface EvaluationHistory {
  evaluations: TimestampedEvaluation[]
  trends: Record<string, EvaluationTrend>
  patterns: EvaluationPattern[]
  benchmarks: EvaluationBenchmark[]
}

export interface TimestampedEvaluation {
  timestamp: Date
  evaluation: AlignmentEvaluationResult
  context: AlignmentContext
  metrics: AlignmentMetrics
}

export interface EvaluationPattern {
  name: string
  description: string
  frequency: number
  significance: number
  examples: TimestampedEvaluation[]
}

export interface EvaluationBenchmark {
  name: string
  description: string
  targetScore: number
  currentScore: number
  achievementRate: number
  lastAchieved?: Date
}

/**
 * Metrics calculation configuration
 */
export interface MetricsConfig {
  historyWindow: number // Number of past evaluations to consider
  trendSensitivity: number // How sensitive to detect trends
  benchmarkThresholds: Record<string, number>
  weightDecay: number // How much to weight recent vs old evaluations
  confidenceThreshold: number // Minimum confidence for reliable metrics
}

/**
 * Objective evaluation metrics engine
 */
export class ObjectiveMetricsEngine {
  private evaluationHistory: EvaluationHistory
  private config: MetricsConfig
  private baselines: Map<string, number> = new Map()

  constructor(config: MetricsConfig) {
    this.config = config
    this.evaluationHistory = {
      evaluations: [],
      trends: {},
      patterns: [],
      benchmarks: [],
    }
  }

  /**
   * Calculate comprehensive metrics for an objective evaluation
   */
  calculateObjectiveMetrics(
    objective: ObjectiveDefinition,
    evaluationResult: ObjectiveEvaluationResult,
    context: AlignmentContext,
  ): ObjectiveMetrics {
    const criteriaBreakdown = this.calculateCriteriaMetrics(
      objective.criteria,
      evaluationResult.criteriaScores,
      context,
    )

    const confidence = this.calculateConfidence(evaluationResult, context)
    const reliability = this.calculateReliability(objective.id)
    const consistency = this.calculateConsistency(objective.id)
    const improvement = this.calculateImprovement(
      objective.id,
      evaluationResult.score,
    )
    const trend = this.calculateTrend(objective.id)
    const contextualFit = this.calculateContextualFit(objective, context)

    return {
      objectiveId: objective.id,
      score: evaluationResult.score,
      criteriaBreakdown,
      confidence,
      reliability,
      consistency,
      improvement,
      trend,
      contextualFit,
    }
  }

  /**
   * Calculate comprehensive alignment metrics
   */
  calculateAlignmentMetrics(
    evaluationResult: AlignmentEvaluationResult,
    objectives: ObjectiveDefinition[],
  ): AlignmentMetrics {
    const objectiveMetrics: Record<string, ObjectiveMetrics> = {}

    // Calculate metrics for each objective
    for (const objective of objectives) {
      const objResult = evaluationResult.objectiveResults[objective.id]
      if (objResult) {
        objectiveMetrics[objective.id] = this.calculateObjectiveMetrics(
          objective,
          objResult,
          evaluationResult.evaluationContext,
        )
      }
    }

    const balanceScore = this.calculateBalanceScore(objectiveMetrics)
    const consistencyScore = this.calculateOverallConsistency(objectiveMetrics)
    const improvementScore = this.calculateOverallImprovement(objectiveMetrics)
    const contextualAlignment =
      this.calculateOverallContextualAlignment(objectiveMetrics)
    const qualityIndicators = this.calculateQualityIndicators(objectiveMetrics)
    const performanceProfile = this.generatePerformanceProfile(objectiveMetrics)

    return {
      overallScore: evaluationResult.overallScore,
      objectiveMetrics,
      balanceScore,
      consistencyScore,
      improvementScore,
      contextualAlignment,
      qualityIndicators,
      performanceProfile,
    }
  }

  /**
   * Add evaluation to history and update trends
   */
  addEvaluation(
    evaluation: AlignmentEvaluationResult,
    objectives: ObjectiveDefinition[],
  ): void {
    const metrics = this.calculateAlignmentMetrics(evaluation, objectives)

    const timestampedEvaluation: TimestampedEvaluation = {
      timestamp: evaluation.timestamp,
      evaluation,
      context: evaluation.evaluationContext,
      metrics,
    }

    this.evaluationHistory.evaluations.push(timestampedEvaluation)

    // Keep only recent history
    if (
      this.evaluationHistory.evaluations.length >
      this.config.historyWindow * 2
    ) {
      this.evaluationHistory.evaluations =
        this.evaluationHistory.evaluations.slice(-this.config.historyWindow)
    }

    // Update trends
    this.updateTrends()
    this.updatePatterns()
    this.updateBenchmarks()
  }

  /**
   * Get evaluation trends for specific objective
   */
  getTrend(objectiveId: string): EvaluationTrend | undefined {
    return this.evaluationHistory.trends[objectiveId]
  }

  /**
   * Get performance benchmarks
   */
  getBenchmarks(): EvaluationBenchmark[] {
    return this.evaluationHistory.benchmarks
  }

  /**
   * Set baseline scores for improvement calculations
   */
  setBaseline(objectiveId: string, score: number): void {
    this.baselines.set(objectiveId, score)
  }

  private calculateCriteriaMetrics(
    criteria: ObjectiveCriteria[],
    criteriaScores: Record<string, number>,
    context: AlignmentContext,
  ): CriteriaMetrics[] {
    return criteria.map((criterion) => {
      const score = criteriaScores[criterion.criterion] || 0
      const contribution = score * criterion.weight
      const confidence = this.calculateCriterionConfidence(
        criterion,
        score,
        context,
      )
      const evidence = this.generateEvidence(criterion, score)

      return {
        criterion: criterion.criterion,
        score,
        weight: criterion.weight,
        contribution,
        confidence,
        evidence,
      }
    })
  }

  private calculateConfidence(
    evaluationResult: ObjectiveEvaluationResult,
    context: AlignmentContext,
  ): number {
    const { confidence: baseConfidence } = evaluationResult

    // Adjust based on context clarity
    const contextClarity = this.assessContextClarity(context)
    let confidence = baseConfidence * contextClarity

    // Adjust based on historical consistency
    const historicalConfidence = this.getHistoricalConfidence(
      evaluationResult.objectiveId,
    )
    confidence = (confidence + historicalConfidence) / 2

    return Math.max(0, Math.min(1, confidence))
  }

  private calculateReliability(objectiveId: string): number {
    const recentEvaluations = this.getRecentEvaluations(objectiveId, 5)

    if (recentEvaluations.length < 2) {
      return 0.5 // Default reliability for insufficient data
    }

    const scores = recentEvaluations.map(
      (e) => e.evaluation.objectiveResults[objectiveId]?.score || 0,
    )

    // Calculate reliability as inverse of normalized standard deviation
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length
    const variance =
      scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) /
      scores.length
    const stdDev = Math.sqrt(variance)

    // Normalize std dev by the theoretical maximum (assuming scores are 0-1)
    const normalizedStdDev = stdDev / 0.5 // 0.5 is max std dev for 0-1 range

    // Reliability is inverse of normalized std dev
    return Math.max(0, Math.min(1, 1 - normalizedStdDev))
  }

  private calculateConsistency(objectiveId: string): number {
    const recentEvaluations = this.getRecentEvaluations(objectiveId, 10)

    if (recentEvaluations.length < 3) {
      return 0.5 // Default consistency for insufficient data
    }

    const scores = recentEvaluations.map(
      (e) => e.evaluation.objectiveResults[objectiveId]?.score || 0,
    )

    // Calculate consistency as inverse of normalized variance
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length
    const variance =
      scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) /
      scores.length

    // Normalize variance by the theoretical maximum (0.25 for 0-1 range)
    const normalizedVariance = variance / 0.25

    return Math.max(0, Math.min(1, 1 - normalizedVariance))
  }

  private calculateImprovement(
    objectiveId: string,
    currentScore: number,
  ): number {
    const baseline = this.baselines.get(objectiveId)

    if (baseline === undefined) {
      // Use first evaluation as baseline
      const firstEvaluation = this.evaluationHistory.evaluations.find(
        (e) => e.evaluation.objectiveResults[objectiveId],
      )

      if (firstEvaluation) {
        const objectiveResult =
          firstEvaluation.evaluation.objectiveResults[objectiveId]
        if (objectiveResult) {
          const firstScore = objectiveResult.score
          this.baselines.set(objectiveId, firstScore)
          return currentScore - firstScore
        }
      }

      return 0 // No baseline available
    }

    return currentScore - baseline
  }

  private calculateTrend(objectiveId: string): EvaluationTrend {
    const recentEvaluations = this.getRecentEvaluations(
      objectiveId,
      this.config.historyWindow,
    )

    if (recentEvaluations.length < 3) {
      return {
        direction: 'stable',
        magnitude: 0,
        period: recentEvaluations.length,
        confidence: 0.5,
      }
    }

    const scores = recentEvaluations.map((e) => {
      const objectiveResult = e.evaluation.objectiveResults[objectiveId]
      return objectiveResult?.score || 0
    })

    // Simple linear regression to detect trend
    const n = scores.length
    const x = Array.from({ length: n }, (_, i) => i)
    const sumX = x.reduce((sum, val) => sum + val, 0)
    const sumY = scores.reduce((sum, val) => sum + val, 0)
    const sumXY = x.reduce((sum, val, i) => sum + val * (scores[i] || 0), 0)
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    const magnitude = Math.abs(slope)

    let direction: 'improving' | 'declining' | 'stable'
    if (magnitude < this.config.trendSensitivity) {
      direction = 'stable'
    } else {
      direction = slope > 0 ? 'improving' : 'declining'
    }

    // Calculate R² for confidence
    const meanY = sumY / n
    const totalSumSquares = scores.reduce(
      (sum, score) => sum + Math.pow(score - meanY, 2),
      0,
    )
    const residualSumSquares = scores.reduce((sum, score, i) => {
      const predicted = slope * i + (sumY - slope * sumX) / n
      return sum + Math.pow(score - predicted, 2)
    }, 0)

    const rSquared =
      totalSumSquares > 0 ? 1 - residualSumSquares / totalSumSquares : 0

    return {
      direction,
      magnitude: Math.min(1, magnitude * 10), // Scale magnitude
      period: n,
      confidence: Math.max(0, Math.min(1, rSquared)),
    }
  }

  private calculateContextualFit(
    objective: ObjectiveDefinition,
    context: AlignmentContext,
  ): number {
    // Simple heuristic for how well an objective fits the context
    let fit = 0.5 // Base fit

    // Adjust based on objective type and context
    switch (context.detectedContext) {
      case 'crisis':
        if (objective.id === 'safety' || objective.id === 'empathy') {
          fit += 0.4
        }
        break
      case 'clinical_assessment':
        if (
          objective.id === 'correctness' ||
          objective.id === 'professionalism'
        ) {
          fit += 0.4
        }
        break
      case 'educational':
        if (
          objective.id === 'informativeness' ||
          objective.id === 'correctness'
        ) {
          fit += 0.4
        }
        break
    }

    return Math.max(0, Math.min(1, fit))
  }

  private calculateBalanceScore(
    objectiveMetrics: Record<string, ObjectiveMetrics>,
  ): number {
    const scores = Object.values(objectiveMetrics).map((m) => m.score)

    if (scores.length === 0) {
      return 0
    }

    // Calculate how balanced the scores are (lower variance = better balance)
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length
    const variance =
      scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) /
      scores.length

    return Math.max(0, Math.min(1, 1 - variance))
  }

  private calculateOverallConsistency(
    objectiveMetrics: Record<string, ObjectiveMetrics>,
  ): number {
    const consistencyScores = Object.values(objectiveMetrics).map(
      (m) => m.consistency,
    )

    if (consistencyScores.length === 0) {
      return 0
    }

    return (
      consistencyScores.reduce((sum, score) => sum + score, 0) /
      consistencyScores.length
    )
  }

  private calculateOverallImprovement(
    objectiveMetrics: Record<string, ObjectiveMetrics>,
  ): number {
    const improvementScores = Object.values(objectiveMetrics).map(
      (m) => m.improvement,
    )

    if (improvementScores.length === 0) {
      return 0
    }

    return (
      improvementScores.reduce((sum, score) => sum + score, 0) /
      improvementScores.length
    )
  }

  private calculateOverallContextualAlignment(
    objectiveMetrics: Record<string, ObjectiveMetrics>,
  ): number {
    const alignmentScores = Object.values(objectiveMetrics).map(
      (m) => m.contextualFit,
    )

    if (alignmentScores.length === 0) {
      return 0
    }

    return (
      alignmentScores.reduce((sum, score) => sum + score, 0) /
      alignmentScores.length
    )
  }

  private calculateQualityIndicators(
    objectiveMetrics: Record<string, ObjectiveMetrics>,
  ): QualityIndicators {
    const metrics = Object.values(objectiveMetrics)

    const reliability =
      metrics.reduce((sum, m) => sum + m.reliability, 0) / metrics.length || 0
    const validity = this.calculateValidity(metrics)
    const sensitivity = this.calculateSensitivity()
    const specificity = this.calculateSpecificity()
    const coverage = this.calculateCoverage(metrics)

    return {
      reliability,
      validity,
      sensitivity,
      specificity,
      coverage,
    }
  }

  private generatePerformanceProfile(
    objectiveMetrics: Record<string, ObjectiveMetrics>,
  ): PerformanceProfile {
    const sortedMetrics = Object.entries(objectiveMetrics).sort(
      ([, a], [, b]) => b.score - a.score,
    )

    const strengths = sortedMetrics.slice(0, 2).map(([id]) => id)

    const weaknesses = sortedMetrics.slice(-2).map(([id]) => id)

    const opportunities = Object.entries(objectiveMetrics)
      .filter(
        ([, metrics]) =>
          metrics.improvement < 0 && metrics.trend.direction === 'improving',
      )
      .map(([id]) => id)

    const risks = Object.entries(objectiveMetrics)
      .filter(
        ([, metrics]) =>
          metrics.score < 0.5 && metrics.trend.direction === 'declining',
      )
      .map(([id]) => id)

    return {
      strengths,
      weaknesses,
      opportunities,
      risks,
    }
  }

  private updateTrends() {
    // Update trends for all objectives with sufficient history
    const objectiveIds = new Set<string>()
    this.evaluationHistory.evaluations.forEach((e) => {
      Object.keys(e.evaluation.objectiveResults).forEach((id) =>
        objectiveIds.add(id),
      )
    })

    objectiveIds.forEach((objectiveId) => {
      this.evaluationHistory.trends[objectiveId] =
        this.calculateTrend(objectiveId)
    })
  }

  private updatePatterns() {
    // Simple pattern detection - could be more sophisticated
    // For now, just identify consistent high/low performance patterns
    const patterns: EvaluationPattern[] = []

    // Add pattern detection logic here
    // This is a simplified implementation
    this.evaluationHistory.patterns = patterns
  }

  private updateBenchmarks() {
    // Update benchmark achievement tracking
    const benchmarks: EvaluationBenchmark[] = [
      {
        name: 'High Performance',
        description: 'Overall score above 0.8',
        targetScore: 0.8,
        currentScore: this.getLatestOverallScore(),
        achievementRate: this.calculateAchievementRate(0.8),
      },
      {
        name: 'Consistent Quality',
        description: 'Consistency score above 0.7',
        targetScore: 0.7,
        currentScore: this.getLatestConsistencyScore(),
        achievementRate: this.calculateConsistencyAchievementRate(0.7),
      },
    ]

    this.evaluationHistory.benchmarks = benchmarks
  }

  private getRecentEvaluations(
    objectiveId: string,
    count: number,
  ): TimestampedEvaluation[] {
    return this.evaluationHistory.evaluations
      .filter((e) => e.evaluation.objectiveResults[objectiveId])
      .slice(-count)
  }

  private calculateCriterionConfidence(
    _criterion: ObjectiveCriteria,
    score: number,
    _context: AlignmentContext,
  ): number {
    // Simple confidence calculation based on score and context
    let confidence = 0.8 // Base confidence

    // Adjust based on score extremes (very high or low scores might be less reliable)
    if (score < 0.1 || score > 0.9) {
      confidence -= 0.2
    }

    return Math.max(0.1, Math.min(1, confidence))
  }

  private generateEvidence(
    criterion: ObjectiveCriteria,
    score: number,
  ): string[] {
    // Generate simple evidence based on score
    const evidence: string[] = []

    if (score > 0.8) {
      evidence.push(`Strong performance in ${criterion.criterion}`)
    } else if (score < 0.4) {
      evidence.push(`Needs improvement in ${criterion.criterion}`)
    } else {
      evidence.push(`Moderate performance in ${criterion.criterion}`)
    }

    return evidence
  }

  private assessContextClarity(context: AlignmentContext): number {
    // Simple context clarity assessment
    let clarity = 0.7 // Base clarity

    if (context.userQuery && context.userQuery.length > 10) {
      clarity += 0.1
    }

    if (context.conversationHistory && context.conversationHistory.length > 0) {
      clarity += 0.1
    }

    return Math.max(0.1, Math.min(1, clarity))
  }

  private getHistoricalConfidence(objectiveId: string): number {
    const recentEvaluations = this.getRecentEvaluations(objectiveId, 5)

    if (recentEvaluations.length === 0) {
      return 0.5
    }

    const confidenceScores = recentEvaluations.map(
      (e) => e.evaluation.objectiveResults[objectiveId]?.confidence || 0.5,
    )

    return (
      confidenceScores.reduce((sum, conf) => sum + conf, 0) /
      confidenceScores.length
    )
  }

  private calculateValidity(_metrics: ObjectiveMetrics[]): number {
    // Simple validity calculation - could be more sophisticated
    return 0.8 // Placeholder
  }

  private calculateSensitivity(): number {
    // Calculate ability to detect meaningful changes
    return 0.75 // Placeholder
  }

  private calculateSpecificity(): number {
    // Calculate ability to avoid false positives
    return 0.85 // Placeholder
  }

  private calculateCoverage(metrics: ObjectiveMetrics[]): number {
    // Calculate how comprehensively objectives are evaluated
    return Math.min(1, metrics.length / 5) // Assuming 5 core objectives
  }

  private getLatestOverallScore(): number {
    const latest =
      this.evaluationHistory.evaluations[
        this.evaluationHistory.evaluations.length - 1
      ]
    return latest?.evaluation.overallScore || 0
  }

  private getLatestConsistencyScore(): number {
    const latest =
      this.evaluationHistory.evaluations[
        this.evaluationHistory.evaluations.length - 1
      ]
    return latest?.metrics.consistencyScore || 0
  }

  private calculateAchievementRate(threshold: number): number {
    const recentScores = this.evaluationHistory.evaluations
      .slice(-10)
      .map((e) => e.evaluation.overallScore)

    if (recentScores.length === 0) {
      return 0
    }

    const achievements = recentScores.filter(
      (score) => score >= threshold,
    ).length
    return achievements / recentScores.length
  }

  private calculateConsistencyAchievementRate(threshold: number): number {
    const recentScores = this.evaluationHistory.evaluations
      .slice(-10)
      .map((e) => e.metrics.consistencyScore)

    if (recentScores.length === 0) {
      return 0
    }

    const achievements = recentScores.filter(
      (score) => score >= threshold,
    ).length
    return achievements / recentScores.length
  }
}

/**
 * Default metrics configuration
 */
export const DEFAULT_METRICS_CONFIG: MetricsConfig = {
  historyWindow: 20,
  trendSensitivity: 0.05,
  benchmarkThresholds: {
    excellent: 0.9,
    good: 0.8,
    acceptable: 0.7,
    poor: 0.5,
  },
  weightDecay: 0.9,
  confidenceThreshold: 0.6,
}
