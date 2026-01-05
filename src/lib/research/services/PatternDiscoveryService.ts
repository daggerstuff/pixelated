import { createBuildSafeLogger } from '@/lib/logger'
import {
  PatternDiscoveryResult,
  CorrelationPattern,
  TrendPattern,
  AnomalyPattern,
  ClusterPattern,
} from '@/lib/research/types/research-types'
import { ResearchQueryEngine } from './ResearchQueryEngine'

const logger = createBuildSafeLogger('PatternDiscoveryService')

export interface PatternDiscoveryConfig {
  significanceThreshold: number
  minSampleSize: number
  maxPatterns: number
  correlationThreshold: number
  anomalyThreshold: number
  clusterCount: number
}

export interface DiscoveryRequest {
  patternTypes: ('correlation' | 'trend' | 'anomaly' | 'cluster')[]
  metrics: string[]
  timeRange: { start: Date; end: Date }
  demographicFilters?: Record<string, unknown>
  techniqueFilters?: Record<string, unknown>
}

export class PatternDiscoveryService {
  private config: PatternDiscoveryConfig
  private queryEngine: ResearchQueryEngine

  constructor(
    config: PatternDiscoveryConfig = {
      significanceThreshold: 0.05,
      minSampleSize: 30,
      maxPatterns: 10,
      correlationThreshold: 0.3,
      anomalyThreshold: 2.0,
      clusterCount: 5,
    },
    queryEngine: ResearchQueryEngine,
  ) {
    this.config = config
    this.queryEngine = queryEngine
  }

  /**
   * Main pattern discovery pipeline
   */
  async discoverPatterns(
    request: DiscoveryRequest,
  ): Promise<PatternDiscoveryResult> {
    logger.info('Starting pattern discovery', { request })

    try {
      const startTime = Date.now()
      const patterns: Array<
        CorrelationPattern | TrendPattern | AnomalyPattern | ClusterPattern
      > = []

      // Execute queries for each pattern type
      for (const patternType of request.patternTypes) {
        const patternResults = await this.discoverPatternType(
          patternType,
          request,
        )
        patterns.push(...patternResults)
      }

      // Sort by confidence and statistical significance
      const sortedPatterns = patterns
        .filter((p) => {
          const conf = 'confidence' in p ? (p.confidence as number) : 1
          return conf >= 0.7
        })
        .sort((a, b) => {
          const confA = 'confidence' in a ? (a.confidence as number) : 1
          const confB = 'confidence' in b ? (b.confidence as number) : 1
          return confB - confA
        })
        .slice(0, this.config.maxPatterns)

      const totalRecords = await this.getTotalRecords(request)
      const processingTime = Date.now() - startTime

      // Return the first pattern type or default to correlation
      const primaryPatternType = request.patternTypes[0] || 'correlation'

      const result: PatternDiscoveryResult = {
        patternType: primaryPatternType,
        patterns: sortedPatterns.map((p, index) => ({
          id: `pattern_${index + 1}`,
          description: this.describePattern(p),
          confidence: 'confidence' in p ? (p.confidence as number) : 1,
          statisticalSignificance: 'pValue' in p ? (p.pValue as number) : 0.05,
          supportingData: p,
        })),
        metadata: {
          totalRecords,
          processingTime,
          significanceThreshold: this.config.significanceThreshold,
        },
      }

      logger.info('Pattern discovery completed', {
        patternCount: sortedPatterns.length,
        processingTime: result.metadata.processingTime,
      })

      return result
    } catch (error) {
      logger.error('Pattern discovery failed', { error })
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Pattern discovery failed: ${errorMessage}`, {
        cause: error,
      })
    }
  }

  /**
   * Discover correlation patterns
   */
  async discoverCorrelations(
    variables: string[],
    _request: DiscoveryRequest,
  ): Promise<CorrelationPattern[]> {
    logger.info('Discovering correlations', { variables })

    const query = await this.queryEngine.naturalLanguageToQuery({
      text: `Find correlations between ${variables.join(' and ')} in therapeutic sessions`,
      context: 'research-analysis',
    })

    const result = await this.queryEngine.executeQuery(
      query,
      'system',
      'data-scientist',
    )

    if (!result.data) {
      return []
    }

    return result.data.map((row: Record<string, unknown>) => ({
      variables: [row.variable1, row.variable2],
      correlation: row.correlation,
      pValue: row.p_value,
      sampleSize: row.sample_size,
      confidenceInterval: [row.ci_lower, row.ci_upper],
    }))
  }

  /**
   * Discover trend patterns
   */
  async discoverTrends(
    metrics: string[],
    _request: DiscoveryRequest,
  ): Promise<TrendPattern[]> {
    logger.info('Discovering trends', { metrics })

    const trends: TrendPattern[] = []

    for (const metric of metrics) {
      const query = await this.queryEngine.naturalLanguageToQuery({
        text: `Analyze trend for ${metric} over time`,
        context: 'temporal-analysis',
      })

      const result = await this.queryEngine.executeQuery(
        query,
        'system',
        'data-scientist',
      )

      if (result.data && result.data.length > 0) {
        const trend = this.calculateTrend(result.data, metric)
        if (trend) {
          trends.push(trend)
        }
      }
    }

    return trends
  }

  /**
   * Discover anomaly patterns
   */
  async discoverAnomalies(
    metrics: string[],
    _request: DiscoveryRequest,
  ): Promise<AnomalyPattern[]> {
    logger.info('Discovering anomalies', { metrics })

    const anomalies: AnomalyPattern[] = []

    for (const metric of metrics) {
      const query = await this.queryEngine.naturalLanguageToQuery({
        text: `Find anomalies in ${metric} values`,
        context: 'anomaly-detection',
      })

      const result = await this.queryEngine.executeQuery(
        query,
        'system',
        'data-scientist',
      )

      if (result.data) {
        const metricAnomalies = this.detectAnomalies(result.data, metric)
        anomalies.push(...metricAnomalies)
      }
    }

    return anomalies
  }

  /**
   * Discover cluster patterns
   */
  async discoverClusters(
    features: string[],
    _request: DiscoveryRequest,
  ): Promise<ClusterPattern[]> {
    logger.info('Discovering clusters', { features })

    const query = await this.queryEngine.naturalLanguageToQuery({
      text: `Cluster clients based on ${features.join(', ')}`,
      context: 'clustering-analysis',
    })

    const result = await this.queryEngine.executeQuery(
      query,
      'system',
      'data-scientist',
    )

    if (!result.data) {
      return []
    }

    return this.performClustering(result.data, features)
  }

  /**
   * Generate automated insights
   */
  async generateInsights(
    patterns: PatternDiscoveryResult,
    _request: DiscoveryRequest,
  ): Promise<{
    insights: Array<{
      type: string
      description: string
      confidence: number
      implications: string[]
      recommendations: string[]
    }>
    summary: string
  }> {
    logger.info('Generating insights from patterns')

    const insights: Array<{
      type: string
      description: string
      confidence: number
      implications: string[]
      recommendations: string[]
    }> = []

    // Analyze correlations
    const correlations = patterns.patterns.filter((p) => 'correlation' in p)
    if (correlations.length > 0) {
      insights.push({
        type: 'correlation',
        description: `Found ${correlations.length} significant correlations`,
        confidence: Math.min(...correlations.map((c) => c.confidence || 0.8)),
        implications: [
          'These relationships may indicate effective therapeutic approaches',
          'Consider further investigation of causal relationships',
        ],
        recommendations: [
          'Validate findings with clinical experts',
          'Test interventions based on strong correlations',
        ],
      })
    }

    // Analyze trends
    const trends = patterns.patterns.filter((p) => 'direction' in p)
    if (trends.length > 0) {
      insights.push({
        type: 'trend',
        description: `Identified ${trends.length} temporal trends`,
        confidence: Math.min(...trends.map((t) => t.confidence || 0.8)),
        implications: [
          'Therapeutic effectiveness may change over time',
          'Seasonal or contextual factors may influence outcomes',
        ],
        recommendations: [
          'Monitor trend persistence',
          'Adjust therapeutic approaches based on temporal patterns',
        ],
      })
    }

    // Analyze anomalies
    const anomalies = patterns.patterns.filter((p) => 'zScore' in p)
    if (anomalies.length > 0) {
      insights.push({
        type: 'anomaly',
        description: `Detected ${anomalies.length} anomalous patterns`,
        confidence: Math.min(...anomalies.map((a) => a.confidence || 0.9)),
        implications: [
          'Unusual cases may represent edge cases or new phenomena',
          'Anomalies could indicate data quality issues',
        ],
        recommendations: [
          'Investigate high-severity anomalies',
          'Consider excluding outliers from general analysis',
        ],
      })
    }

    // Generate summary
    const summary = this.generateSummary(insights, patterns)

    return { insights, summary }
  }

  /**
   * Validate pattern significance
   */
  async validatePatterns(patterns: PatternDiscoveryResult): Promise<{
    validPatterns: PatternDiscoveryResult['patterns']
    invalidPatterns: PatternDiscoveryResult['patterns']
    validationReport: string[]
  }> {
    const validPatterns: PatternDiscoveryResult['patterns'] = []
    const invalidPatterns: PatternDiscoveryResult['patterns'] = []
    const validationReport: string[] = []

    for (const pattern of patterns.patterns) {
      const validation = await this.validateSinglePattern(pattern)

      if (validation.valid) {
        validPatterns.push(pattern)
      } else {
        invalidPatterns.push(pattern)
        validationReport.push(...validation.issues)
      }
    }

    return { validPatterns, invalidPatterns, validationReport }
  }

  /**
   * Export patterns for external analysis
   */
  async exportPatterns(
    patterns: PatternDiscoveryResult,
    format: 'json' | 'csv' | 'r',
  ): Promise<{
    data: string
    format: string
    metadata: Record<string, unknown>
  }> {
    logger.info('Exporting patterns', { format })

    let exportedData: string
    const metadata = {
      exportDate: new Date().toISOString(),
      patternCount: patterns.patterns.length,
      format,
    }

    switch (format) {
      case 'json':
        exportedData = JSON.stringify(patterns, null, 2)
        break
      case 'csv':
        exportedData = this.convertToCSV(patterns.patterns)
        break
      case 'r':
        exportedData = this.convertToRData(patterns.patterns)
        break
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }

    return { data: exportedData, format, metadata }
  }

  /**
   * Private methods
   */
  private async discoverPatternType(
    patternType: string,
    request: DiscoveryRequest,
  ): Promise<
    Array<CorrelationPattern | TrendPattern | AnomalyPattern | ClusterPattern>
  > {
    switch (patternType) {
      case 'correlation':
        return this.discoverCorrelations(request.metrics, request)
      case 'trend':
        return this.discoverTrends(request.metrics, request)
      case 'anomaly':
        return this.discoverAnomalies(request.metrics, request)
      case 'cluster':
        return this.discoverClusters(request.metrics, request)
      default:
        return []
    }
  }

  private calculateTrend(
    data: Record<string, unknown>[],
    metric: string,
  ): TrendPattern | null {
    if (data.length < this.config.minSampleSize) {
      return null
    }

    // Simple linear regression
    const x = data.map((_, i) => i)
    const y = data.map((row) => {
      const val = row[metric]
      return typeof val === 'number' ? val : parseFloat(String(val)) || 0
    })

    const n = x.length
    const sumX = x.reduce((a, b) => a + b, 0)
    const sumY = y.reduce((a, b) => a + b, 0)
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0)
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n

    const yMean = sumY / n
    const ssTotal = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0)
    const ssResidual = y.reduce(
      (sum, yi, i) => sum + Math.pow(yi - (slope * x[i] + intercept), 2),
      0,
    )
    const rSquared = 1 - ssResidual / ssTotal

    let direction: 'increasing' | 'decreasing' | 'stable'
    if (Math.abs(slope) < 0.01) {
      direction = 'stable'
    } else if (slope > 0) {
      direction = 'increasing'
    } else {
      direction = 'decreasing'
    }

    const firstTimestamp = data[0].timestamp
    const lastTimestamp = data[data.length - 1].timestamp

    return {
      metric,
      direction,
      slope,
      rSquared,
      timeRange: {
        start: new Date(
          typeof firstTimestamp === 'string' ||
          typeof firstTimestamp === 'number'
            ? firstTimestamp
            : Date.now(),
        ),
        end: new Date(
          typeof lastTimestamp === 'string' || typeof lastTimestamp === 'number'
            ? lastTimestamp
            : Date.now(),
        ),
      },
    }
  }

  private detectAnomalies(
    data: Record<string, unknown>[],
    metric: string,
  ): AnomalyPattern[] {
    const values = data.map((row) => {
      const val = row[metric]
      return typeof val === 'number' ? val : parseFloat(String(val)) || 0
    })
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const stdDev = Math.sqrt(
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
        values.length,
    )

    const anomalies: AnomalyPattern[] = []

    values.forEach((value) => {
      const zScore = (value - mean) / stdDev
      const expectedRange: [number, number] = [
        mean - 2 * stdDev,
        mean + 2 * stdDev,
      ]

      if (Math.abs(zScore) > this.config.anomalyThreshold) {
        anomalies.push({
          metric,
          value,
          zScore,
          expectedRange,
          severity:
            Math.abs(zScore) > 3
              ? 'high'
              : Math.abs(zScore) > 2
                ? 'medium'
                : 'low',
        })
      }
    })

    return anomalies
  }

  private performClustering(
    data: Record<string, unknown>[],
    features: string[],
  ): ClusterPattern[] {
    // Simple k-means clustering implementation
    const k = Math.min(this.config.clusterCount, data.length)
    if (k < 2) return []

    // Extract feature vectors
    const vectors = data.map((row) =>
      features.map((feature) => {
        const val = row[feature]
        return typeof val === 'number' ? val : parseFloat(String(val)) || 0
      }),
    )

    // Initialize centroids randomly
    const centroids = this.initializeCentroids(vectors, k)

    // Run k-means iterations
    const maxIterations = 100
    let clusters: number[][] = []

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      // Assign points to nearest centroid
      clusters = Array(k)
        .fill(null)
        .map(() => [])
      vectors.forEach((vector, index) => {
        const nearest = this.findNearestCentroid(vector, centroids)
        clusters[nearest].push(index)
      })

      // Update centroids
      const newCentroids = clusters.map((cluster) => {
        if (cluster.length === 0) return centroids[clusters.indexOf(cluster)]

        const sum = Array(features.length).fill(0)
        cluster.forEach((index) => {
          vectors[index].forEach((val, i) => (sum[i] += val))
        })
        return sum.map((val) => val / cluster.length)
      })

      // Check convergence
      if (this.hasConverged(centroids, newCentroids)) {
        break
      }

      centroids.splice(0, centroids.length, ...newCentroids)
    }

    // Create cluster patterns
    return clusters.map((cluster, index) => ({
      clusterId: `cluster_${index + 1}`,
      centroid: Object.fromEntries(
        features.map((feature, i) => [feature, centroids[index][i]]),
      ),
      members: cluster.map((i) => {
        const clientId = data[i].client_id
        return typeof clientId === 'string' ? clientId : `client_${i}`
      }),
      size: cluster.length,
      characteristics: this.describeClusterCharacteristics(
        cluster.map((i) => data[i]),
        features,
      ),
    }))
  }

  private initializeCentroids(vectors: number[][], k: number): number[][] {
    const centroids: number[][] = []
    const usedIndices = new Set<number>()

    for (let i = 0; i < k; i++) {
      let index
      do {
        index = Math.floor(Math.random() * vectors.length)
      } while (usedIndices.has(index))

      usedIndices.add(index)
      centroids.push([...vectors[index]])
    }

    return centroids
  }

  private findNearestCentroid(vector: number[], centroids: number[][]): number {
    let minDistance = Infinity
    let nearestIndex = 0

    centroids.forEach((centroid, index) => {
      const distance = Math.sqrt(
        vector.reduce((sum, val, i) => sum + Math.pow(val - centroid[i], 2), 0),
      )
      if (distance < minDistance) {
        minDistance = distance
        nearestIndex = index
      }
    })

    return nearestIndex
  }

  private hasConverged(
    oldCentroids: number[][],
    newCentroids: number[][],
  ): boolean {
    const threshold = 0.001
    return oldCentroids.every(
      (old, i) =>
        Math.sqrt(
          old.reduce(
            (sum, val, j) => sum + Math.pow(val - newCentroids[i][j], 2),
            0,
          ),
        ) < threshold,
    )
  }

  private describeClusterCharacteristics(
    clusterData: Record<string, unknown>[],
    features: string[],
  ): Record<
    string,
    { mean: number; stdDev: number; min: number; max: number }
  > {
    const characteristics: Record<
      string,
      { mean: number; stdDev: number; min: number; max: number }
    > = {}

    features.forEach((feature) => {
      const values = clusterData.map((d) => {
        const val = d[feature]
        return typeof val === 'number' ? val : parseFloat(String(val)) || 0
      })
      const mean = values.reduce((a, b) => a + b, 0) / values.length
      const stdDev = Math.sqrt(
        values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
          values.length,
      )

      characteristics[feature] = {
        mean,
        stdDev,
        min: Math.min(...values),
        max: Math.max(...values),
      }
    })

    return characteristics
  }

  private generateSummary(
    insights: Array<{
      type: string
      description: string
      confidence: number
      implications: string[]
      recommendations: string[]
    }>,
    patterns: PatternDiscoveryResult,
  ): string {
    const parts: string[] = []

    if (insights.length > 0) {
      parts.push(
        `Discovered ${insights.length} key insights from ${patterns.patterns.length} patterns.`,
      )
    }

    const correlations = patterns.patterns.filter(
      (p) => 'correlation' in p,
    ).length
    const trends = patterns.patterns.filter((p) => 'direction' in p).length
    const anomalies = patterns.patterns.filter((p) => 'zScore' in p).length
    const clusters = patterns.patterns.filter((p) => 'clusterId' in p).length

    if (correlations > 0)
      parts.push(`${correlations} significant correlations identified.`)
    if (trends > 0) parts.push(`${trends} temporal trends detected.`)
    if (anomalies > 0) parts.push(`${anomalies} anomalous patterns found.`)
    if (clusters > 0)
      parts.push(`${clusters} distinct client clusters discovered.`)

    return parts.join(' ')
  }

  private async validateSinglePattern(
    pattern: PatternDiscoveryResult['patterns'][0],
  ): Promise<{
    valid: boolean
    issues: string[]
  }> {
    const issues: string[] = []
    const supportingData = pattern.supportingData as Record<string, unknown>

    if (
      supportingData?.sampleSize &&
      typeof supportingData.sampleSize === 'number' &&
      supportingData.sampleSize < this.config.minSampleSize
    ) {
      issues.push(
        `Sample size ${supportingData.sampleSize} below minimum ${this.config.minSampleSize}`,
      )
    }

    if (pattern.statisticalSignificance > this.config.significanceThreshold) {
      issues.push(
        `p-value ${pattern.statisticalSignificance} above significance threshold ${this.config.significanceThreshold}`,
      )
    }

    if (pattern.confidence < 0.7) {
      issues.push(
        `Confidence ${pattern.confidence} below acceptable threshold 0.7`,
      )
    }

    return { valid: issues.length === 0, issues }
  }

  private convertToCSV(patterns: PatternDiscoveryResult['patterns']): string {
    if (patterns.length === 0) return ''

    const headers = Object.keys(patterns[0]).join(',')
    const rows = patterns.map((p) => Object.values(p).join(','))

    return [headers, ...rows].join('\n')
  }

  private convertToRData(patterns: PatternDiscoveryResult['patterns']): string {
    return JSON.stringify(patterns, null, 2)
  }

  private async getTotalRecords(_request: DiscoveryRequest): Promise<number> {
    // In real implementation, query database
    return 1000 // Placeholder
  }

  private describePattern(
    pattern:
      | CorrelationPattern
      | TrendPattern
      | AnomalyPattern
      | ClusterPattern,
  ): string {
    if ('correlation' in pattern) {
      return `Correlation between ${pattern.variables.join(' and ')}: ${pattern.correlation.toFixed(2)}`
    }
    if ('direction' in pattern) {
      return `${pattern.metric} trend: ${pattern.direction} (R²=${pattern.rSquared.toFixed(2)})`
    }
    if ('zScore' in pattern) {
      return `Anomaly in ${pattern.metric}: value ${pattern.value} (z-score=${pattern.zScore.toFixed(2)})`
    }
    if ('clusterId' in pattern) {
      return `Cluster ${pattern.clusterId} with ${pattern.size} members`
    }
    return 'Unknown pattern type'
  }
}
