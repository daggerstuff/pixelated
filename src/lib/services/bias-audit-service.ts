/**
 * Bias Audit Service
 *
 * Service layer for performing bias audits on datasets before they are merged
 * into the training pool. Integrates with BiasDetectionEngine for analysis
 * and provides quarantine workflow management.
 */

import { BiasDetectionEngine } from '@/lib/ai/bias-detection/BiasDetectionEngine'
import type { AnalysisResult } from '@/lib/ai/bias-detection/types'
import type {
  DatasetForAudit,
  DatasetAuditResult,
  AuditConfig,
  AuditSummary,
  QuarantineActionPayload,
  AuditHistoryEntry,
  BiasScoreDistribution,
  BiasMetricResult,
  DemographicBiasBreakdown,
  QuarantineStatus,
  AuditProgressUpdate,
} from '@/lib/api/journal-research/bias-audit-types'

// Default audit configuration
const DEFAULT_AUDIT_CONFIG: AuditConfig = {
  sampleSize: 1000,
  thresholds: {
    overall: 0.3,
    gender: 0.25,
    racial: 0.25,
    age: 0.25,
    cultural: 0.25,
  },
  enabledMetrics: [
    'genderBias',
    'racialBias',
    'ageBias',
    'culturalBias',
    'sentimentBias',
    'representationBias',
  ],
  autoQuarantine: true,
  requireManualApproval: true,
}

// In-memory storage for audit results (would be replaced with database in production)
const auditResultsStore = new Map<string, DatasetAuditResult>()
const datasetsStore = new Map<string, DatasetForAudit>()
const auditHistoryStore = new Map<string, AuditHistoryEntry[]>()

export interface BiasAuditServiceConfig {
  biasDetectionEngine?: BiasDetectionEngine
  onProgressUpdate?: (update: AuditProgressUpdate) => void
}

export class BiasAuditService {
  private biasEngine: BiasDetectionEngine
  private onProgressUpdate?: (update: AuditProgressUpdate) => void

  constructor(config: BiasAuditServiceConfig = {}) {
    this.biasEngine = config.biasDetectionEngine ?? new BiasDetectionEngine({
      thresholds: {
        warning: DEFAULT_AUDIT_CONFIG.thresholds.overall,
        high: 0.5,
        critical: 0.7,
      },
    })
    this.onProgressUpdate = config.onProgressUpdate
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    await this.biasEngine.initialize()
  }

  /**
   * Get summary statistics for the audit dashboard
   */
  async getAuditSummary(): Promise<AuditSummary> {
    const datasets = Array.from(datasetsStore.values())
    const results = Array.from(auditResultsStore.values())

    const statusCounts = datasets.reduce(
      (acc, d) => {
        acc[d.quarantineStatus] = (acc[d.quarantineStatus] || 0) + 1
        return acc
      },
      {} as Record<QuarantineStatus, number>
    )

    const totalBiasScore = results.reduce((sum, r) => sum + r.overallBiasScore, 0)
    const averageBiasScore = results.length > 0 ? totalBiasScore / results.length : 0

    const sortedResults = [...results].sort(
      (a, b) => b.auditedAt.getTime() - a.auditedAt.getTime()
    )

    return {
      totalDatasets: datasets.length,
      pendingReview: statusCounts['pending_review'] || 0,
      underAudit: statusCounts['under_audit'] || 0,
      approved: statusCounts['approved'] || 0,
      quarantined: statusCounts['quarantined'] || 0,
      rejected: statusCounts['rejected'] || 0,
      averageBiasScore,
      lastAuditDate: sortedResults[0]?.auditedAt,
    }
  }

  /**
   * Get all datasets pending audit or review
   */
  async getDatasetsForAudit(options: {
    status?: QuarantineStatus
    page?: number
    pageSize?: number
  } = {}): Promise<{
    items: DatasetForAudit[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }> {
    const { status, page = 1, pageSize = 20 } = options
    let datasets = Array.from(datasetsStore.values())

    if (status) {
      datasets = datasets.filter((d) => d.quarantineStatus === status)
    }

    const total = datasets.length
    const totalPages = Math.ceil(total / pageSize)
    const startIndex = (page - 1) * pageSize
    const items = datasets.slice(startIndex, startIndex + pageSize)

    return { items, total, page, pageSize, totalPages }
  }

  /**
   * Get a specific dataset by ID
   */
  async getDataset(datasetId: string): Promise<DatasetForAudit | null> {
    return datasetsStore.get(datasetId) ?? null
  }

  /**
   * Register a new dataset for audit
   */
  async registerDataset(dataset: Omit<DatasetForAudit, 'quarantineStatus'>): Promise<DatasetForAudit> {
    const datasetWithStatus: DatasetForAudit = {
      ...dataset,
      quarantineStatus: 'pending_review',
    }
    datasetsStore.set(dataset.datasetId, datasetWithStatus)
    return datasetWithStatus
  }

  /**
   * Initiate bias audit for one or more datasets
   */
  async initiateAudit(
    datasetIds: string[],
    config: Partial<AuditConfig> = {}
  ): Promise<DatasetAuditResult[]> {
    const auditConfig: AuditConfig = { ...DEFAULT_AUDIT_CONFIG, ...config }
    const results: DatasetAuditResult[] = []

    for (const datasetId of datasetIds) {
      const dataset = datasetsStore.get(datasetId)
      if (!dataset) {
        throw new Error(`Dataset not found: ${datasetId}`)
      }

      // Update status to under_audit
      dataset.quarantineStatus = 'under_audit'
      datasetsStore.set(datasetId, dataset)

      try {
        const result = await this.performAudit(dataset, auditConfig)
        results.push(result)
        auditResultsStore.set(result.auditId, result)

        // Update dataset with audit results
        dataset.lastAuditId = result.auditId
        dataset.lastAuditScore = result.overallBiasScore
        dataset.quarantineStatus = result.quarantineStatus
        datasetsStore.set(datasetId, dataset)

        // Record history
        this.recordHistory(datasetId, result.auditId, 'audit_completed', 'under_audit', result.quarantineStatus, 'system')
      } catch (error) {
        // On error, revert to pending_review
        dataset.quarantineStatus = 'pending_review'
        datasetsStore.set(datasetId, dataset)
        throw error
      }
    }

    return results
  }

  /**
   * Perform the actual bias audit on a dataset
   */
  private async performAudit(
    dataset: DatasetForAudit,
    config: AuditConfig
  ): Promise<DatasetAuditResult> {
    const auditId = `audit_${Date.now()}_${dataset.datasetId}`

    // Emit progress update: started
    this.emitProgress({
      auditId,
      datasetId: dataset.datasetId,
      status: 'started',
      progress: 0,
      currentStep: 'Initializing audit',
    })

    // Simulate sampling from dataset
    this.emitProgress({
      auditId,
      datasetId: dataset.datasetId,
      status: 'sampling',
      progress: 10,
      currentStep: `Sampling ${config.sampleSize} records from dataset`,
    })

    // Generate sample sessions for analysis
    const sampleSessions = this.generateSampleSessions(
      dataset,
      Math.min(config.sampleSize, dataset.recordCount)
    )

    // Emit progress update: analyzing
    this.emitProgress({
      auditId,
      datasetId: dataset.datasetId,
      status: 'analyzing',
      progress: 30,
      currentStep: 'Running bias detection analysis',
    })

    // Run batch analysis using BiasDetectionEngine
    const batchResult = await this.biasEngine.batchAnalyzeSessions(sampleSessions, {
      concurrency: 4,
      batchSize: 50,
      onProgress: ({ completed, total }) => {
        const progress = 30 + Math.round((completed / total) * 50)
        this.emitProgress({
          auditId,
          datasetId: dataset.datasetId,
          status: 'analyzing',
          progress,
          currentStep: `Analyzed ${completed}/${total} samples`,
        })
      },
    })

    // Emit progress update: computing metrics
    this.emitProgress({
      auditId,
      datasetId: dataset.datasetId,
      status: 'computing_metrics',
      progress: 85,
      currentStep: 'Computing aggregate metrics',
    })

    // Compute aggregate metrics from results
    const metrics = this.computeMetrics(batchResult.results, config)
    const demographicBreakdown = this.computeDemographicBreakdown(batchResult.results)
    const scoreDistribution = this.computeScoreDistribution(batchResult.results)
    const overallBiasScore = this.computeOverallScore(batchResult.results)
    const passesThreshold = overallBiasScore <= config.thresholds.overall
    const recommendations = this.generateRecommendations(metrics, demographicBreakdown, overallBiasScore)

    // Determine quarantine status
    let quarantineStatus: QuarantineStatus
    if (passesThreshold && !config.requireManualApproval) {
      quarantineStatus = 'approved'
    } else if (!passesThreshold && config.autoQuarantine) {
      quarantineStatus = 'quarantined'
    } else {
      quarantineStatus = 'pending_review'
    }

    const result: DatasetAuditResult = {
      auditId,
      datasetId: dataset.datasetId,
      datasetName: dataset.name,
      auditedAt: new Date(),
      auditedBy: 'system',
      overallBiasScore,
      passesThreshold,
      quarantineStatus,
      sampleSize: sampleSessions.length,
      totalRecords: dataset.recordCount,
      metrics,
      demographicBreakdown,
      scoreDistribution,
      recommendations,
    }

    // Emit progress update: completed
    this.emitProgress({
      auditId,
      datasetId: dataset.datasetId,
      status: 'completed',
      progress: 100,
      currentStep: 'Audit completed',
    })

    return result
  }

  /**
   * Generate sample sessions for bias analysis
   */
  private generateSampleSessions(dataset: DatasetForAudit, count: number) {
    // In production, this would read actual data from the dataset file
    // For now, generate synthetic samples for demonstration
    const sessions = []
    for (let i = 0; i < count; i++) {
      sessions.push({
        sessionId: `${dataset.datasetId}_sample_${i}`,
        messages: [
          {
            role: 'user' as const,
            content: `Sample message ${i} from dataset ${dataset.name}`,
            timestamp: new Date(),
          },
          {
            role: 'assistant' as const,
            content: `Sample response ${i}`,
            timestamp: new Date(),
          },
        ],
        demographics: {
          age: Math.floor(Math.random() * 60) + 18,
          gender: ['male', 'female', 'non-binary', 'prefer_not_to_say'][Math.floor(Math.random() * 4)],
          ethnicity: ['caucasian', 'african_american', 'hispanic', 'asian', 'other'][Math.floor(Math.random() * 5)],
          primaryLanguage: 'en',
        },
        metadata: {
          sessionStartTime: new Date(),
          sessionEndTime: new Date(),
        },
      })
    }
    return sessions
  }

  /**
   * Compute bias metrics from analysis results
   */
  private computeMetrics(results: AnalysisResult[], config: AuditConfig): BiasMetricResult[] {
    const metrics: BiasMetricResult[] = []

    // Compute average scores for each metric type
    const genderScores = results
      .map((r) => r.layerResults.preprocessing?.linguisticBias?.genderBiasScore)
      .filter((s): s is number => s !== undefined)
    const racialScores = results
      .map((r) => r.layerResults.preprocessing?.linguisticBias?.racialBiasScore)
      .filter((s): s is number => s !== undefined)
    const ageScores = results
      .map((r) => r.layerResults.preprocessing?.linguisticBias?.ageBiasScore)
      .filter((s): s is number => s !== undefined)
    const culturalScores = results
      .map((r) => r.layerResults.preprocessing?.linguisticBias?.culturalBiasScore)
      .filter((s): s is number => s !== undefined)

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0

    if (config.enabledMetrics.includes('genderBias')) {
      const score = avg(genderScores)
      metrics.push({
        metricName: 'Gender Bias',
        score,
        threshold: config.thresholds.gender,
        passed: score <= config.thresholds.gender,
        details: `Detected gender-related bias patterns in ${Math.round(score * 100)}% of samples`,
      })
    }

    if (config.enabledMetrics.includes('racialBias')) {
      const score = avg(racialScores)
      metrics.push({
        metricName: 'Racial Bias',
        score,
        threshold: config.thresholds.racial,
        passed: score <= config.thresholds.racial,
        details: `Detected racial bias patterns in ${Math.round(score * 100)}% of samples`,
      })
    }

    if (config.enabledMetrics.includes('ageBias')) {
      const score = avg(ageScores)
      metrics.push({
        metricName: 'Age Bias',
        score,
        threshold: config.thresholds.age,
        passed: score <= config.thresholds.age,
        details: `Detected age-related bias patterns in ${Math.round(score * 100)}% of samples`,
      })
    }

    if (config.enabledMetrics.includes('culturalBias')) {
      const score = avg(culturalScores)
      metrics.push({
        metricName: 'Cultural Bias',
        score,
        threshold: config.thresholds.cultural,
        passed: score <= config.thresholds.cultural,
        details: `Detected cultural bias patterns in ${Math.round(score * 100)}% of samples`,
      })
    }

    return metrics
  }

  /**
   * Compute demographic breakdown from results
   */
  private computeDemographicBreakdown(results: AnalysisResult[]): DemographicBiasBreakdown[] {
    const breakdowns: DemographicBiasBreakdown[] = []

    // Group results by demographic categories
    const genderGroups = this.groupByDemographic(results, 'gender')
    const ageGroups = this.groupByDemographic(results, 'age')
    const ethnicityGroups = this.groupByDemographic(results, 'ethnicity')

    const computeBreakdown = (
      category: string,
      groups: Record<string, AnalysisResult[]>
    ): DemographicBiasBreakdown => {
      const scores: Record<string, number> = {}
      let totalScore = 0
      let count = 0

      for (const [group, groupResults] of Object.entries(groups)) {
        const avgScore = groupResults.reduce((sum, r) => sum + r.overallBiasScore, 0) / groupResults.length
        scores[group] = avgScore
        totalScore += avgScore
        count++
      }

      const overallScore = count > 0 ? totalScore / count : 0
      let concernLevel: 'low' | 'medium' | 'high' | 'critical'
      if (overallScore < 0.2) concernLevel = 'low'
      else if (overallScore < 0.4) concernLevel = 'medium'
      else if (overallScore < 0.6) concernLevel = 'high'
      else concernLevel = 'critical'

      return { category, scores, overallScore, concernLevel }
    }

    breakdowns.push(computeBreakdown('gender', genderGroups))
    breakdowns.push(computeBreakdown('age', ageGroups))
    breakdowns.push(computeBreakdown('ethnicity', ethnicityGroups))

    return breakdowns
  }

  /**
   * Group results by demographic attribute
   */
  private groupByDemographic(
    results: AnalysisResult[],
    attribute: 'gender' | 'age' | 'ethnicity'
  ): Record<string, AnalysisResult[]> {
    const groups: Record<string, AnalysisResult[]> = {}

    for (const result of results) {
      const demo = result.demographics
      let key: string

      if (attribute === 'age' && demo?.age) {
        // Group ages into ranges
        const age = demo.age
        if (age < 25) key = '18-24'
        else if (age < 35) key = '25-34'
        else if (age < 45) key = '35-44'
        else if (age < 55) key = '45-54'
        else if (age < 65) key = '55-64'
        else key = '65+'
      } else if (attribute === 'gender' && demo?.gender) {
        key = demo.gender
      } else if (attribute === 'ethnicity' && demo?.ethnicity) {
        key = demo.ethnicity
      } else {
        key = 'unknown'
      }

      if (!groups[key]) groups[key] = []
      groups[key].push(result)
    }

    return groups
  }

  /**
   * Compute score distribution for histogram
   */
  private computeScoreDistribution(results: AnalysisResult[]): BiasScoreDistribution[] {
    const buckets = 10
    const distribution: BiasScoreDistribution[] = []
    const counts: number[] = new Array(buckets).fill(0)

    for (const result of results) {
      const bucketIndex = Math.min(Math.floor(result.overallBiasScore * buckets), buckets - 1)
      counts[bucketIndex]++
    }

    for (let i = 0; i < buckets; i++) {
      const rangeStart = (i / buckets).toFixed(1)
      const rangeEnd = ((i + 1) / buckets).toFixed(1)
      distribution.push({
        range: `${rangeStart}-${rangeEnd}`,
        count: counts[i],
        percentage: results.length > 0 ? (counts[i] / results.length) * 100 : 0,
      })
    }

    return distribution
  }

  /**
   * Compute overall bias score
   */
  private computeOverallScore(results: AnalysisResult[]): number {
    if (results.length === 0) return 0
    return results.reduce((sum, r) => sum + r.overallBiasScore, 0) / results.length
  }

  /**
   * Generate recommendations based on audit results
   */
  private generateRecommendations(
    metrics: BiasMetricResult[],
    demographicBreakdown: DemographicBiasBreakdown[],
    overallScore: number
  ): string[] {
    const recommendations: string[] = []

    // Check for failing metrics
    const failingMetrics = metrics.filter((m) => !m.passed)
    for (const metric of failingMetrics) {
      recommendations.push(
        `Address ${metric.metricName.toLowerCase()} issues: Score ${(metric.score * 100).toFixed(1)}% exceeds threshold of ${(metric.threshold * 100).toFixed(1)}%`
      )
    }

    // Check for demographic concerns
    const criticalDemographics = demographicBreakdown.filter((d) => d.concernLevel === 'critical' || d.concernLevel === 'high')
    for (const demo of criticalDemographics) {
      recommendations.push(
        `Review ${demo.category} representation: ${demo.concernLevel} concern level detected`
      )
    }

    // Overall recommendations
    if (overallScore > 0.5) {
      recommendations.push('Consider substantial data preprocessing or filtering before training use')
      recommendations.push('Manual review by domain expert is strongly recommended')
    } else if (overallScore > 0.3) {
      recommendations.push('Apply bias mitigation techniques during training')
      recommendations.push('Monitor model outputs for bias after training')
    } else if (overallScore > 0.1) {
      recommendations.push('Dataset shows acceptable bias levels for training use')
      recommendations.push('Continue routine monitoring of bias metrics')
    }

    if (recommendations.length === 0) {
      recommendations.push('Dataset meets all bias thresholds and is suitable for training')
    }

    return recommendations
  }

  /**
   * Process quarantine action (approve, quarantine, reject)
   */
  async processQuarantineAction(payload: QuarantineActionPayload): Promise<DatasetForAudit> {
    const dataset = datasetsStore.get(payload.datasetId)
    if (!dataset) {
      throw new Error(`Dataset not found: ${payload.datasetId}`)
    }

    const previousStatus = dataset.quarantineStatus
    let newStatus: QuarantineStatus

    switch (payload.action) {
      case 'approve':
        newStatus = 'approved'
        break
      case 'quarantine':
        newStatus = 'quarantined'
        break
      case 'reject':
        newStatus = 'rejected'
        break
      case 'request_reaudit':
        newStatus = 'pending_review'
        break
      default:
        throw new Error(`Unknown action: ${payload.action}`)
    }

    dataset.quarantineStatus = newStatus
    datasetsStore.set(payload.datasetId, dataset)

    // Record history
    this.recordHistory(
      payload.datasetId,
      dataset.lastAuditId ?? 'manual',
      payload.action,
      previousStatus,
      newStatus,
      payload.reviewedBy,
      payload.reason
    )

    return dataset
  }

  /**
   * Get audit result by ID
   */
  async getAuditResult(auditId: string): Promise<DatasetAuditResult | null> {
    return auditResultsStore.get(auditId) ?? null
  }

  /**
   * Get audit results for a dataset
   */
  async getAuditResultsForDataset(datasetId: string): Promise<DatasetAuditResult[]> {
    return Array.from(auditResultsStore.values()).filter(
      (r) => r.datasetId === datasetId
    )
  }

  /**
   * Get audit history for a dataset
   */
  async getAuditHistory(datasetId: string): Promise<AuditHistoryEntry[]> {
    return auditHistoryStore.get(datasetId) ?? []
  }

  /**
   * Record audit history entry
   */
  private recordHistory(
    datasetId: string,
    auditId: string,
    action: string,
    previousStatus: QuarantineStatus,
    newStatus: QuarantineStatus,
    performedBy: string,
    reason?: string
  ): void {
    const history = auditHistoryStore.get(datasetId) ?? []
    history.push({
      historyId: `history_${Date.now()}`,
      datasetId,
      auditId,
      action,
      previousStatus,
      newStatus,
      performedBy,
      performedAt: new Date(),
      reason,
    })
    auditHistoryStore.set(datasetId, history)
  }

  /**
   * Emit progress update
   */
  private emitProgress(update: AuditProgressUpdate): void {
    if (this.onProgressUpdate) {
      this.onProgressUpdate(update)
    }
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    await this.biasEngine.dispose()
  }
}

// Singleton instance
let biasAuditServiceInstance: BiasAuditService | null = null

export function getBiasAuditService(config?: BiasAuditServiceConfig): BiasAuditService {
  if (!biasAuditServiceInstance) {
    biasAuditServiceInstance = new BiasAuditService(config)
  }
  return biasAuditServiceInstance
}

export function resetBiasAuditService(): void {
  if (biasAuditServiceInstance) {
    biasAuditServiceInstance.dispose()
    biasAuditServiceInstance = null
  }
}
