/**
 * Threat Correlation Engine for Cross-Region Analysis
 * Analyzes threats across multiple regions to identify patterns and correlations
 */

import { EventEmitter } from 'events'
import { Redis } from 'ioredis'
import { MongoClient, Db } from 'mongodb'
import * as tf from '@tensorflow/tfjs'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'

import {
  CorrelationConfig,
  CorrelationAlgorithm,
  GlobalThreatIntelligence,
  CorrelationData,
  ThreatIndicator,
  TimeWindow,
  RealTimeThreatData,
} from '../global/types'

const logger = createBuildSafeLogger('threat-correlation-engine')

export interface ThreatCorrelationEngine {
  initialize(): Promise<void>
  correlateThreat(threatData: RealTimeThreatData): Promise<CorrelationData>
  correlateThreats(
    threats: GlobalThreatIntelligence[],
  ): Promise<CorrelationData[]>
  findSimilarThreats(
    threatId: string,
    similarityThreshold: number,
  ): Promise<GlobalThreatIntelligence[]>
  getCorrelationPatterns(timeWindow: TimeWindow): Promise<CorrelationPattern[]>
  updateCorrelationAlgorithm(algorithm: CorrelationAlgorithm): Promise<boolean>
  getHealthStatus(): Promise<HealthStatus>
  shutdown(): Promise<void>
}

export interface CorrelationPattern {
  patternId: string
  patternType: 'temporal' | 'spatial' | 'behavioral' | 'attribution'
  description: string
  confidence: number
  frequency: number
  affectedRegions: string[]
  indicators: string[]
  firstSeen: Date
  lastSeen: Date
  trend: 'increasing' | 'decreasing' | 'stable'
}

export interface SimilarityResult {
  threatId: string
  similarityScore: number
  matchingIndicators: string[]
  matchingAttributes: string[]
  confidence: number
}

export interface HealthStatus {
  healthy: boolean
  message: string
  responseTime?: number
  activeCorrelations?: number
  patternCount?: number
}

export class ThreatCorrelationEngineCore
  extends EventEmitter
  implements ThreatCorrelationEngine
{
  private redis: Redis
  private mongoClient: MongoClient
  private db: Db
  private correlationAlgorithms: Map<string, CorrelationAlgorithm> = new Map()
  private activeCorrelations: Map<string, CorrelationData> = new Map()
  private correlationPatterns: Map<string, CorrelationPattern> = new Map()
  private mlModel: tf.Sequential | null = null

  constructor(private config: CorrelationConfig) {
    super()
    this.initializeAlgorithms()
  }

  private initializeAlgorithms(): void {
    // Initialize default correlation algorithms
    for (const algorithm of this.config.algorithms) {
      this.correlationAlgorithms.set(algorithm.algorithmId, algorithm)
    }
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Threat Correlation Engine')

      // Initialize Redis connection
      await this.initializeRedis()

      // Initialize MongoDB connection
      await this.initializeMongoDB()

      // Load ML model for advanced correlation
      await this.loadMLModel()

      // Load existing correlation patterns
      await this.loadCorrelationPatterns()

      // Start correlation monitoring
      await this.startCorrelationMonitoring()

      this.emit('engine_initialized')
      logger.info('Threat Correlation Engine initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize Threat Correlation Engine:', { error })
      this.emit('initialization_error', { error })
      throw error
    }
  }

  private async initializeRedis(): Promise<void> {
    try {
      this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
      await this.redis.ping()
      logger.info('Redis connection established for correlation engine')
    } catch (error) {
      logger.error('Failed to connect to Redis:', { error })
      throw new Error('Redis connection failed', { cause: error })
    }
  }

  private async initializeMongoDB(): Promise<void> {
    try {
      this.mongoClient = new MongoClient(
        process.env.MONGODB_URI ||
          'mongodb://localhost:27017/threat_correlation',
      )
      await this.mongoClient.connect()
      this.db = this.mongoClient.db('threat_correlation')
      logger.info('MongoDB connection established for correlation engine')
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', { error })
      throw new Error('MongoDB connection failed', { cause: error })
    }
  }

  private async loadMLModel(): Promise<void> {
    try {
      // Create a simple neural network for threat similarity analysis
      this.mlModel = tf.sequential()

      this.mlModel.add(
        tf.layers.dense({
          units: 64,
          activation: 'relu',
          inputShape: [20], // Feature vector size
        }),
      )

      this.mlModel.add(tf.layers.dropout({ rate: 0.2 }))

      this.mlModel.add(
        tf.layers.dense({
          units: 32,
          activation: 'relu',
        }),
      )

      this.mlModel.add(tf.layers.dropout({ rate: 0.2 }))

      this.mlModel.add(
        tf.layers.dense({
          units: 1,
          activation: 'sigmoid',
        }),
      )

      this.mlModel.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy'],
      })

      logger.info('ML model loaded for correlation analysis')
    } catch (error) {
      logger.error('Failed to load ML model:', { error })
      // Continue without ML model - will use rule-based correlation
    }
  }

  private async loadCorrelationPatterns(): Promise<void> {
    try {
      const patterns = await this.db
        .collection('correlation_patterns')
        .find({})
        .toArray()

      for (const pattern of patterns) {
        this.correlationPatterns.set(pattern.patternId, pattern)
      }

      logger.info(`Loaded ${patterns.length} correlation patterns`)
    } catch (error) {
      logger.error('Failed to load correlation patterns:', { error })
    }
  }

  private async startCorrelationMonitoring(): Promise<void> {
    // Monitor for new correlations every 30 seconds
    setInterval(async () => {
      try {
        await this.monitorNewCorrelations()
      } catch (error) {
        logger.error('Correlation monitoring error:', { error })
      }
    }, 30000)
  }

  async correlateThreat(
    threatData: RealTimeThreatData,
  ): Promise<CorrelationData> {
    try {
      logger.info('Correlating threat', {
        threatId: threatData.threatId,
        region: threatData.region,
      })

      // Find similar threats in the same time window
      const timeWindow = this.getDefaultTimeWindow()
      const similarThreats = await this.findSimilarThreatsInWindow(
        threatData,
        timeWindow,
      )

      // Analyze correlations
      const correlationAnalysis = await this.analyzeCorrelations(
        threatData,
        similarThreats,
      )

      // Create correlation data
      const correlationData: CorrelationData = {
        correlationId: this.generateCorrelationId(),
        correlatedThreats: [
          threatData.threatId,
          ...similarThreats.map((t) => t.threatId),
        ],
        correlationStrength: correlationAnalysis.strength,
        correlationType: correlationAnalysis.type,
        confidence: correlationAnalysis.confidence,
        analysisMethod: correlationAnalysis.method,
        timestamp: new Date(),
      }

      // Store correlation data
      await this.storeCorrelationData(correlationData)

      // Update correlation patterns
      await this.updateCorrelationPatterns(correlationData)

      // Cache for real-time access
      await this.cacheCorrelationData(correlationData)

      this.emit('threat_correlated', {
        correlationId: correlationData.correlationId,
        threatId: threatData.threatId,
        correlationStrength: correlationData.correlationStrength,
      })

      return correlationData
    } catch (error) {
      logger.error('Failed to correlate threat:', {
        error,
        threatId: threatData.threatId,
      })
      this.emit('correlation_error', { error, threatId: threatData.threatId })
      throw error
    }
  }

  async correlateThreats(
    threats: GlobalThreatIntelligence[],
  ): Promise<CorrelationData[]> {
    try {
      logger.info('Correlating multiple threats', {
        threatCount: threats.length,
      })

      if (threats.length < 2) {
        return []
      }

      const correlations: CorrelationData[] = []

      // Compare each threat with others
      for (let i = 0; i < threats.length; i++) {
        for (let j = i + 1; j < threats.length; j++) {
          const correlation = await this.correlateThreatPair(
            threats[i],
            threats[j],
          )
          if (
            correlation &&
            correlation.correlationStrength > this.config.similarityThreshold
          ) {
            correlations.push(correlation)
          }
        }
      }

      // Group related correlations
      const groupedCorrelations = await this.groupCorrelations(correlations)

      this.emit('threats_correlated', {
        threatCount: threats.length,
        correlationCount: groupedCorrelations.length,
      })

      return groupedCorrelations
    } catch (error) {
      logger.error('Failed to correlate threats:', { error })
      this.emit('correlation_error', { error })
      throw error
    }
  }

  private async correlateThreatPair(
    threat1: GlobalThreatIntelligence,
    threat2: GlobalThreatIntelligence,
  ): Promise<CorrelationData | null> {
    try {
      // Calculate similarity score
      const similarityScore = await this.calculateSimilarityScore(
        threat1,
        threat2,
      )

      if (similarityScore < this.config.similarityThreshold) {
        return null
      }

      // Determine correlation type
      const correlationType = await this.determineCorrelationType(
        threat1,
        threat2,
        similarityScore,
      )

      // Calculate confidence
      const confidence = await this.calculateCorrelationConfidence(
        threat1,
        threat2,
        similarityScore,
      )

      return {
        correlationId: this.generateCorrelationId(),
        correlatedThreats: [threat1.threatId, threat2.threatId],
        correlationStrength: similarityScore,
        correlationType,
        confidence,
        analysisMethod: 'pairwise_comparison',
        timestamp: new Date(),
      }
    } catch (error) {
      logger.error('Failed to correlate threat pair:', { error })
      return null
    }
  }

  private async calculateSimilarityScore(
    threat1: GlobalThreatIntelligence,
    threat2: GlobalThreatIntelligence,
  ): Promise<number> {
    try {
      let totalScore = 0
      let weightSum = 0

      // Compare indicators (40% weight)
      const indicatorScore = await this.compareIndicators(
        threat1.indicators,
        threat2.indicators,
      )
      totalScore += indicatorScore * 0.4
      weightSum += 0.4

      // Compare severity (20% weight)
      const severityScore = this.compareSeverity(
        threat1.severity,
        threat2.severity,
      )
      totalScore += severityScore * 0.2
      weightSum += 0.2

      // Compare regions (15% weight)
      const regionScore = this.compareRegions(threat1.regions, threat2.regions)
      totalScore += regionScore * 0.15
      weightSum += 0.15

      // Compare timing (15% weight)
      const timingScore = this.compareTiming(
        threat1.firstSeen,
        threat2.firstSeen,
      )
      totalScore += timingScore * 0.15
      weightSum += 0.15

      // Compare attribution (10% weight)
      if (threat1.attribution && threat2.attribution) {
        const attributionScore = this.compareAttribution(
          threat1.attribution,
          threat2.attribution,
        )
        totalScore += attributionScore * 0.1
        weightSum += 0.1
      }

      // Normalize score
      return weightSum > 0 ? totalScore / weightSum : 0
    } catch (error) {
      logger.error('Failed to calculate similarity score:', { error })
      return 0
    }
  }

  private async compareIndicators(
    indicators1: ThreatIndicator[],
    indicators2: ThreatIndicator[],
  ): Promise<number> {
    try {
      if (indicators1.length === 0 || indicators2.length === 0) {
        return 0
      }

      let matchingIndicators = 0
      let totalComparisons = 0

      // Compare each indicator from first threat with indicators from second threat
      for (const indicator1 of indicators1) {
        for (const indicator2 of indicators2) {
          totalComparisons++

          // Check if indicators are of the same type and have similar values
          if (indicator1.indicatorType === indicator2.indicatorType) {
            const valueSimilarity = this.calculateValueSimilarity(
              indicator1.value,
              indicator2.value,
            )

            if (valueSimilarity > 0.7) {
              // Threshold for considering indicators similar
              matchingIndicators++
            }
          }
        }
      }

      return totalComparisons > 0 ? matchingIndicators / totalComparisons : 0
    } catch (error) {
      logger.error('Failed to compare indicators:', { error })
      return 0
    }
  }

  private calculateValueSimilarity(value1: string, value2: string): number {
    // Simple string similarity using Levenshtein distance
    const distance = this.levenshteinDistance(
      value1.toLowerCase(),
      value2.toLowerCase(),
    )
    const maxLength = Math.max(value1.length, value2.length)

    return maxLength > 0 ? 1 - distance / maxLength : 0
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = []

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          )
        }
      }
    }

    return matrix[str2.length][str1.length]
  }

  private compareSeverity(severity1: string, severity2: string): number {
    const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 }
    const score1 = severityOrder[severity1] || 1
    const score2 = severityOrder[severity2] || 1

    // Similarity decreases as the difference increases
    const difference = Math.abs(score1 - score2)
    return Math.max(0, 1 - difference / 3)
  }

  private compareRegions(regions1: string[], regions2: string[]): number {
    if (regions1.length === 0 || regions2.length === 0) {
      return 0
    }

    const intersection = regions1.filter((region) => regions2.includes(region))
    const union = [...new Set([...regions1, ...regions2])]

    return union.length > 0 ? intersection.length / union.length : 0
  }

  private compareTiming(time1: Date, time2: Date): number {
    const timeDiff = Math.abs(time1.getTime() - time2.getTime())
    const hoursDiff = timeDiff / (1000 * 60 * 60)

    // Consider threats within 24 hours as potentially related
    if (hoursDiff <= 24) {
      return Math.max(0, 1 - hoursDiff / 24)
    }

    return 0
  }

  private compareAttribution(
    attribution1: unknown,
    attribution2: unknown,
  ): number {
    let score = 0
    let factors = 0

    // Type guard to check if attribution has the expected structure
    const isValidAttribution = (
      attribution: unknown,
    ): attribution is {
      actor?: string
      campaign?: string
      family?: string
    } => {
      return typeof attribution === 'object' && attribution !== null
    }

    if (isValidAttribution(attribution1) && isValidAttribution(attribution2)) {
      if (attribution1.actor && attribution2.actor) {
        factors++
        score += attribution1.actor === attribution2.actor ? 1 : 0
      }

      if (attribution1.campaign && attribution2.campaign) {
        factors++
        score += attribution1.campaign === attribution2.campaign ? 1 : 0
      }

      if (attribution1.family && attribution2.family) {
        factors++
        score += attribution1.family === attribution2.family ? 1 : 0
      }
    }

    return factors > 0 ? score / factors : 0
  }

  private async determineCorrelationType(
    threat1: GlobalThreatIntelligence,
    threat2: GlobalThreatIntelligence,
    similarityScore: number,
  ): Promise<string> {
    try {
      // Analyze different aspects to determine correlation type

      if (similarityScore < 0.3) {
        return 'weak'
      }

      // Check for temporal correlation
      const timeDiff = Math.abs(
        threat1.firstSeen.getTime() - threat2.firstSeen.getTime(),
      )
      const isTemporal = timeDiff < 24 * 60 * 60 * 1000 // Within 24 hours

      // Check for spatial correlation
      const commonRegions = threat1.regions.filter((region) =>
        threat2.regions.includes(region),
      )
      const isSpatial = commonRegions.length > 0

      // Check for behavioral correlation (similar indicators)
      const similarIndicators = await this.countSimilarIndicators(
        threat1.indicators,
        threat2.indicators,
      )
      const isBehavioral = similarIndicators > 2

      // Check for attribution correlation
      const isAttribution = this.hasSimilarAttribution(
        threat1.attribution,
        threat2.attribution,
      )

      // Determine primary correlation type
      if (isAttribution && similarityScore > 0.7) {
        return 'attribution'
      } else if (isBehavioral && similarityScore > 0.6) {
        return 'behavioral'
      } else if (isSpatial && similarityScore > 0.5) {
        return 'spatial'
      } else if (isTemporal && similarityScore > 0.4) {
        return 'temporal'
      } else {
        return 'general'
      }
    } catch (error) {
      logger.error('Failed to determine correlation type:', { error })
      return 'unknown'
    }
  }

  private async countSimilarIndicators(
    indicators1: ThreatIndicator[],
    indicators2: ThreatIndicator[],
  ): Promise<number> {
    let count = 0

    for (const indicator1 of indicators1) {
      for (const indicator2 of indicators2) {
        if (indicator1.indicatorType === indicator2.indicatorType) {
          const similarity = this.calculateValueSimilarity(
            indicator1.value,
            indicator2.value,
          )
          if (similarity > 0.7) {
            count++
          }
        }
      }
    }

    return count
  }

  private hasSimilarAttribution(
    attribution1: unknown,
    attribution2: unknown,
  ): boolean {
    if (!attribution1 || !attribution2) {
      return false
    }

    // Type guard to check if attribution has the expected structure
    const isValidAttribution = (
      attribution: unknown,
    ): attribution is {
      actor?: string
      campaign?: string
      family?: string
    } => {
      return typeof attribution === 'object' && attribution !== null
    }

    if (
      !isValidAttribution(attribution1) ||
      !isValidAttribution(attribution2)
    ) {
      return false
    }

    return (
      (attribution1.actor &&
        attribution2.actor &&
        attribution1.actor === attribution2.actor) ||
      (attribution1.campaign &&
        attribution2.campaign &&
        attribution1.campaign === attribution2.campaign) ||
      (attribution1.family &&
        attribution2.family &&
        attribution1.family === attribution2.family)
    )
  }

  private async calculateCorrelationConfidence(
    threat1: GlobalThreatIntelligence,
    threat2: GlobalThreatIntelligence,
    similarityScore: number,
  ): Promise<number> {
    try {
      // Base confidence on similarity score
      let confidence = similarityScore

      // Adjust based on data quality
      const qualityFactor = Math.min(threat1.confidence, threat2.confidence)
      confidence *= qualityFactor

      // Adjust based on number of indicators
      const indicatorFactor = Math.min(
        threat1.indicators.length / 10,
        threat2.indicators.length / 10,
        1,
      )
      confidence *= 0.8 + 0.2 * indicatorFactor

      // Adjust based on regional spread
      const regionFactor = this.calculateRegionalSpreadFactor(
        threat1.regions,
        threat2.regions,
      )
      confidence *= regionFactor

      return Math.min(confidence, 1)
    } catch (error) {
      logger.error('Failed to calculate correlation confidence:', { error })
      return similarityScore * 0.8 // Fallback confidence
    }
  }

  private calculateRegionalSpreadFactor(
    regions1: string[],
    regions2: string[],
  ): number {
    const allRegions = [...new Set([...regions1, ...regions2])]

    // More regions generally mean higher confidence in correlation
    if (allRegions.length >= 3) return 1.0
    if (allRegions.length === 2) return 0.9
    return 0.7 // Single region
  }

  private async findSimilarThreatsInWindow(
    threatData: RealTimeThreatData,
    timeWindow: TimeWindow,
  ): Promise<GlobalThreatIntelligence[]> {
    try {
      // Query database for threats in the same time window
      const query = {
        $and: [
          { firstSeen: { $gte: timeWindow.start } },
          { firstSeen: { $lte: timeWindow.end } },
          { threatId: { $ne: threatData.threatId } }, // Exclude current threat
        ],
      }

      const similarThreats = await this.db
        .collection('global_threat_intelligence')
        .find(query)
        .limit(50) // Limit to prevent excessive processing
        .toArray()

      return similarThreats
    } catch (error) {
      logger.error('Failed to find similar threats in window:', { error })
      return []
    }
  }

  private getDefaultTimeWindow(): TimeWindow {
    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    return {
      start: twentyFourHoursAgo,
      end: now,
    }
  }

  private async analyzeCorrelations(
    threatData: RealTimeThreatData,
    similarThreats: GlobalThreatIntelligence[],
  ): Promise<CorrelationAnalysis> {
    try {
      if (similarThreats.length === 0) {
        return {
          strength: 0,
          type: 'none',
          confidence: 0,
          method: 'no_similar_threats',
        }
      }

      // Calculate average similarity score
      let totalSimilarity = 0
      let correlationCount = 0

      for (const similarThreat of similarThreats) {
        const similarity = await this.calculateThreatSimilarity(
          threatData,
          similarThreat,
        )
        if (similarity > this.config.similarityThreshold) {
          totalSimilarity += similarity
          correlationCount++
        }
      }

      if (correlationCount === 0) {
        return {
          strength: 0,
          type: 'none',
          confidence: 0,
          method: 'no_significant_correlations',
        }
      }

      const averageSimilarity = totalSimilarity / correlationCount
      const correlationType = await this.determineSingleThreatCorrelationType(
        threatData,
        similarThreats,
      )

      return {
        strength: averageSimilarity,
        type: correlationType,
        confidence: Math.min(averageSimilarity * 0.9, 1),
        method: 'similarity_analysis',
      }
    } catch (error) {
      logger.error('Failed to analyze correlations:', { error })
      return {
        strength: 0,
        type: 'unknown',
        confidence: 0,
        method: 'error',
      }
    }
  }

  private async calculateThreatSimilarity(
    threatData: RealTimeThreatData,
    existingThreat: GlobalThreatIntelligence,
  ): Promise<number> {
    try {
      let score = 0
      let weights = 0

      // Compare severity
      const dataSeverity = this.mapSeverityToLevel(threatData.severity)
      const existingSeverity = existingThreat.severity
      const severityScore = this.compareSeverity(dataSeverity, existingSeverity)
      score += severityScore * 0.3
      weights += 0.3

      // Compare regions
      const regionScore = existingThreat.regions.includes(threatData.region)
        ? 1
        : 0
      score += regionScore * 0.2
      weights += 0.2

      // Compare indicators
      const dataIndicators = threatData.indicators.map((i) => ({
        indicatorType: i.indicatorType,
        value: i.value,
      }))

      const indicatorScore = await this.compareIndicators(
        dataIndicators,
        existingThreat.indicators,
      )
      score += indicatorScore * 0.4
      weights += 0.4

      // Compare timing
      const timingScore = this.compareTiming(
        threatData.timestamp,
        existingThreat.firstSeen,
      )
      score += timingScore * 0.1
      weights += 0.1

      return weights > 0 ? score / weights : 0
    } catch (error) {
      logger.error('Failed to calculate threat similarity:', { error })
      return 0
    }
  }

  private mapSeverityToLevel(
    severity: number,
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (severity >= 0.8) return 'critical'
    if (severity >= 0.6) return 'high'
    if (severity >= 0.4) return 'medium'
    return 'low'
  }

  private async determineSingleThreatCorrelationType(
    threatData: RealTimeThreatData,
    similarThreats: GlobalThreatIntelligence[],
  ): Promise<string> {
    try {
      // Analyze the group of similar threats to determine correlation type
      const hasTemporalOverlap = similarThreats.some(
        (t) =>
          Math.abs(t.firstSeen.getTime() - threatData.timestamp.getTime()) <
          6 * 60 * 60 * 1000, // 6 hours
      )

      const hasSpatialOverlap = similarThreats.some((t) =>
        t.regions.includes(threatData.region),
      )

      const hasSimilarIndicators = await this.hasSimilarIndicators(
        threatData.indicators,
        similarThreats,
      )

      if (hasTemporalOverlap && hasSpatialOverlap && hasSimilarIndicators) {
        return 'strong_multi_factor'
      } else if (hasTemporalOverlap && hasSpatialOverlap) {
        return 'temporal_spatial'
      } else if (hasSimilarIndicators) {
        return 'behavioral'
      } else if (hasTemporalOverlap) {
        return 'temporal'
      } else if (hasSpatialOverlap) {
        return 'spatial'
      } else {
        return 'weak'
      }
    } catch (error) {
      logger.error('Failed to determine single threat correlation type:', {
        error,
      })
      return 'unknown'
    }
  }

  private async hasSimilarIndicators(
    dataIndicators: ThreatIndicator[],
    similarThreats: GlobalThreatIntelligence[],
  ): Promise<boolean> {
    for (const threat of similarThreats) {
      const similarity = await this.compareIndicators(
        dataIndicators,
        threat.indicators,
      )
      if (similarity > 0.5) {
        return true
      }
    }
    return false
  }

  async findSimilarThreats(
    threatId: string,
    similarityThreshold: number,
  ): Promise<GlobalThreatIntelligence[]> {
    try {
      logger.info('Finding similar threats', { threatId, similarityThreshold })

      // Get the target threat
      const targetThreat = await this.db
        .collection('global_threat_intelligence')
        .findOne({ threatId })

      if (!targetThreat) {
        throw new Error(`Threat not found: ${threatId}`)
      }

      // Find potential similar threats
      const candidateThreats = await this.db
        .collection('global_threat_intelligence')
        .find({
          threatId: { $ne: threatId },
          $or: [
            { regions: { $in: targetThreat.regions } },
            { severity: targetThreat.severity },
            {
              'indicators.indicatorType': {
                $in: targetThreat.indicators.map(
                  (i: { indicatorType: string }) => i.indicatorType,
                ),
              },
            },
          ],
        })
        .limit(100)
        .toArray()

      // Calculate similarity scores
      const similarThreats: SimilarityResult[] = []

      for (const candidate of candidateThreats) {
        const similarityScore = await this.calculateSimilarityScore(
          targetThreat,
          candidate,
        )

        if (similarityScore >= similarityThreshold) {
          similarThreats.push({
            threatId: candidate.threatId,
            similarityScore,
            matchingIndicators: await this.findMatchingIndicators(
              targetThreat.indicators,
              candidate.indicators,
            ),
            matchingAttributes: this.findMatchingAttributes(
              targetThreat,
              candidate,
            ),
            confidence: Math.min(similarityScore * 0.9, 1),
          })
        }
      }

      // Sort by similarity score
      similarThreats.sort((a, b) => b.similarityScore - a.similarityScore)

      // Get full threat data for top matches
      const topThreatIds = similarThreats.slice(0, 10).map((s) => s.threatId)
      const similarThreatData = await this.db
        .collection('global_threat_intelligence')
        .find({ threatId: { $in: topThreatIds } })
        .toArray()

      this.emit('similar_threats_found', {
        originalThreatId: threatId,
        similarCount: similarThreats.length,
      })

      return similarThreatData
    } catch (error) {
      logger.error('Failed to find similar threats:', { error, threatId })
      this.emit('similarity_search_error', { error, threatId })
      throw error
    }
  }

  private async findMatchingIndicators(
    indicators1: ThreatIndicator[],
    indicators2: ThreatIndicator[],
  ): Promise<string[]> {
    const matching: string[] = []

    for (const indicator1 of indicators1) {
      for (const indicator2 of indicators2) {
        if (indicator1.indicatorType === indicator2.indicatorType) {
          const similarity = this.calculateValueSimilarity(
            indicator1.value,
            indicator2.value,
          )
          if (similarity > 0.7) {
            matching.push(`${indicator1.indicatorType}:${indicator1.value}`)
          }
        }
      }
    }

    return matching
  }

  private findMatchingAttributes(
    threat1: GlobalThreatIntelligence,
    threat2: GlobalThreatIntelligence,
  ): string[] {
    const matching: string[] = []

    if (threat1.severity === threat2.severity) {
      matching.push(`severity:${threat1.severity}`)
    }

    const commonRegions = threat1.regions.filter((region) =>
      threat2.regions.includes(region),
    )
    if (commonRegions.length > 0) {
      matching.push(`regions:${commonRegions.join(',')}`)
    }

    if (threat1.attribution && threat2.attribution) {
      if (threat1.attribution.actor === threat2.attribution.actor) {
        matching.push(`attribution.actor:${threat1.attribution.actor}`)
      }
      if (threat1.attribution.campaign === threat2.attribution.campaign) {
        matching.push(`attribution.campaign:${threat1.attribution.campaign}`)
      }
    }

    return matching
  }

  async getCorrelationPatterns(
    timeWindow: TimeWindow,
  ): Promise<CorrelationPattern[]> {
    try {
      logger.info('Getting correlation patterns', { timeWindow })

      // Filter patterns by time window
      const relevantPatterns: CorrelationPattern[] = []

      for (const pattern of this.correlationPatterns.values()) {
        if (
          pattern.lastSeen >= timeWindow.start &&
          pattern.firstSeen <= timeWindow.end
        ) {
          relevantPatterns.push(pattern)
        }
      }

      // Sort by confidence and frequency
      relevantPatterns.sort((a, b) => {
        const scoreA = a.confidence * a.frequency
        const scoreB = b.confidence * b.frequency
        return scoreB - scoreA
      })

      this.emit('correlation_patterns_retrieved', {
        patternCount: relevantPatterns.length,
        timeWindow,
      })

      return relevantPatterns
    } catch (error) {
      logger.error('Failed to get correlation patterns:', { error })
      throw error
    }
  }

  async updateCorrelationAlgorithm(
    algorithm: CorrelationAlgorithm,
  ): Promise<boolean> {
    try {
      logger.info('Updating correlation algorithm', {
        algorithmId: algorithm.algorithmId,
      })

      // Validate algorithm configuration
      this.validateAlgorithm(algorithm)

      // Update algorithm
      this.correlationAlgorithms.set(algorithm.algorithmId, algorithm)

      // Store in database
      await this.db
        .collection('correlation_algorithms')
        .replaceOne({ algorithmId: algorithm.algorithmId }, algorithm, {
          upsert: true,
        })

      this.emit('algorithm_updated', { algorithmId: algorithm.algorithmId })
      return true
    } catch (error) {
      logger.error('Failed to update correlation algorithm:', { error })
      return false
    }
  }

  private validateAlgorithm(algorithm: CorrelationAlgorithm): void {
    if (!algorithm.algorithmId || !algorithm.algorithmType) {
      throw new Error('Algorithm ID and type are required')
    }

    if (
      !['graph', 'statistical', 'ml', 'rule_based'].includes(
        algorithm.algorithmType,
      )
    ) {
      throw new Error('Invalid algorithm type')
    }

    if (
      algorithm.performance.accuracy < 0 ||
      algorithm.performance.accuracy > 1
    ) {
      throw new Error('Algorithm accuracy must be between 0 and 1')
    }
  }

  async getHealthStatus(): Promise<HealthStatus> {
    try {
      const startTime = Date.now()

      // Check Redis connection
      const redisHealthy = await this.checkRedisHealth()
      if (!redisHealthy) {
        return {
          healthy: false,
          message: 'Redis connection failed',
        }
      }

      // Check MongoDB connection
      const mongodbHealthy = await this.checkMongoDBHealth()
      if (!mongodbHealthy) {
        return {
          healthy: false,
          message: 'MongoDB connection failed',
        }
      }

      // Check algorithm availability
      if (this.correlationAlgorithms.size === 0) {
        return {
          healthy: false,
          message: 'No correlation algorithms available',
        }
      }

      const responseTime = Date.now() - startTime

      return {
        healthy: true,
        message: 'Threat Correlation Engine is healthy',
        responseTime,
        activeCorrelations: this.activeCorrelations.size,
        patternCount: this.correlationPatterns.size,
      }
    } catch (error) {
      logger.error('Health check failed:', { error })
      return {
        healthy: false,
        message: `Health check failed: ${error}`,
      }
    }
  }

  private async checkRedisHealth(): Promise<boolean> {
    try {
      const result = await this.redis.ping()
      return result === 'PONG'
    } catch (error) {
      logger.error('Redis health check failed:', { error })
      return false
    }
  }

  private async checkMongoDBHealth(): Promise<boolean> {
    try {
      await this.db.admin().ping()
      return true
    } catch (error) {
      logger.error('MongoDB health check failed:', { error })
      return false
    }
  }

  private async storeCorrelationData(
    correlationData: CorrelationData,
  ): Promise<void> {
    try {
      await this.db.collection('correlation_data').insertOne(correlationData)
      this.activeCorrelations.set(
        correlationData.correlationId,
        correlationData,
      )
    } catch (error) {
      logger.error('Failed to store correlation data:', { error })
      throw error
    }
  }

  private async cacheCorrelationData(
    correlationData: CorrelationData,
  ): Promise<void> {
    try {
      const cacheKey = `correlation:${correlationData.correlationId}`
      const cacheData = {
        correlationId: correlationData.correlationId,
        correlationStrength: correlationData.correlationStrength,
        correlationType: correlationData.correlationType,
        confidence: correlationData.confidence,
        timestamp: correlationData.timestamp,
      }

      await this.redis.setex(cacheKey, 1800, JSON.stringify(cacheData)) // 30 minutes TTL
    } catch (error) {
      logger.error('Failed to cache correlation data:', { error })
    }
  }

  private async updateCorrelationPatterns(
    correlationData: CorrelationData,
  ): Promise<void> {
    try {
      // Extract pattern information from correlation data
      const patternInfo = this.extractPatternInfo(correlationData)

      if (!patternInfo) {
        return
      }

      // Find existing pattern or create new one
      let pattern = await this.findMatchingPattern(patternInfo)

      if (pattern) {
        // Update existing pattern
        pattern.frequency++
        pattern.lastSeen = new Date()
        pattern.confidence = Math.min(pattern.confidence * 1.05, 1) // Increase confidence slightly
        pattern.affectedRegions = [
          ...new Set([...pattern.affectedRegions, ...patternInfo.regions]),
        ]
      } else {
        // Create new pattern
        pattern = {
          patternId: this.generatePatternId(),
          patternType: patternInfo.type,
          description: patternInfo.description,
          confidence: correlationData.confidence,
          frequency: 1,
          affectedRegions: patternInfo.regions,
          indicators: patternInfo.indicators,
          firstSeen: new Date(),
          lastSeen: new Date(),
          trend: 'stable',
        }
      }

      // Update trend analysis
      pattern.trend = await this.analyzePatternTrend(pattern)

      // Store pattern
      this.correlationPatterns.set(pattern.patternId, pattern)

      await this.db
        .collection('correlation_patterns')
        .replaceOne({ patternId: pattern.patternId }, pattern, { upsert: true })
    } catch (error) {
      logger.error('Failed to update correlation patterns:', { error })
    }
  }

  private extractPatternInfo(
    correlationData: CorrelationData,
  ): PatternInfo | null {
    try {
      if (correlationData.correlationStrength < 0.5) {
        return null // Only extract patterns from strong correlations
      }

      return {
        type: this.mapCorrelationTypeToPatternType(
          correlationData.correlationType,
        ),
        description: `Correlation pattern with strength ${correlationData.correlationStrength}`,
        regions: [], // Will be populated from correlated threats
        indicators: [], // Will be populated from correlated threats
      }
    } catch (error) {
      logger.error('Failed to extract pattern info:', { error })
      return null
    }
  }

  private mapCorrelationTypeToPatternType(correlationType: string): string {
    const mapping: Record<string, string> = {
      temporal: 'temporal',
      spatial: 'spatial',
      behavioral: 'behavioral',
      attribution: 'attribution',
      temporal_spatial: 'spatial',
      strong_multi_factor: 'behavioral',
    }

    return mapping[correlationType] || 'general'
  }

  private async findMatchingPattern(
    patternInfo: PatternInfo,
  ): Promise<CorrelationPattern | null> {
    // Simple pattern matching logic
    // In a real implementation, this would use more sophisticated matching
    for (const pattern of this.correlationPatterns.values()) {
      if (pattern.patternType === patternInfo.type) {
        return pattern
      }
    }
    return null
  }

  private async analyzePatternTrend(
    pattern: CorrelationPattern,
  ): Promise<'increasing' | 'decreasing' | 'stable'> {
    try {
      // Analyze recent frequency changes
      const recentCorrelations = await this.db
        .collection('correlation_data')
        .find({
          correlationType: pattern.patternType,
          timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
        })
        .sort({ timestamp: -1 })
        .limit(10)
        .toArray()

      if (recentCorrelations.length < 3) {
        return 'stable'
      }

      // Simple trend analysis based on recent activity
      const recentCount = recentCorrelations.length
      const expectedCount = pattern.frequency / 4 // Rough estimate

      if (recentCount > expectedCount * 1.2) {
        return 'increasing'
      } else if (recentCount < expectedCount * 0.8) {
        return 'decreasing'
      } else {
        return 'stable'
      }
    } catch (error) {
      logger.error('Failed to analyze pattern trend:', { error })
      return 'stable'
    }
  }

  private async groupCorrelations(
    correlations: CorrelationData[],
  ): Promise<CorrelationData[]> {
    try {
      // Group correlations that share common threats
      const groups: CorrelationData[][] = []

      for (const correlation of correlations) {
        let addedToGroup = false

        for (const group of groups) {
          // Check if this correlation shares threats with any group member
          const sharesThreats = group.some((groupCorrelation) =>
            correlation.correlatedThreats.some((threatId) =>
              groupCorrelation.correlatedThreats.includes(threatId),
            ),
          )

          if (sharesThreats) {
            group.push(correlation)
            addedToGroup = true
            break
          }
        }

        if (!addedToGroup) {
          groups.push([correlation])
        }
      }

      // Merge correlations within each group
      const mergedCorrelations: CorrelationData[] = []

      for (const group of groups) {
        if (group.length === 1) {
          mergedCorrelations.push(group[0])
        } else {
          const merged = await this.mergeCorrelationGroup(group)
          if (merged) {
            mergedCorrelations.push(merged)
          }
        }
      }

      return mergedCorrelations
    } catch (error) {
      logger.error('Failed to group correlations:', { error })
      return correlations
    }
  }

  private async mergeCorrelationGroup(
    correlations: CorrelationData[],
  ): Promise<CorrelationData | null> {
    try {
      if (correlations.length === 0) {
        return null
      }

      // Collect all unique threat IDs
      const allThreats = new Set<string>()
      for (const correlation of correlations) {
        correlation.correlatedThreats.forEach((threatId) =>
          allThreats.add(threatId),
        )
      }

      // Calculate average correlation strength
      const avgStrength =
        correlations.reduce((sum, c) => sum + c.correlationStrength, 0) /
        correlations.length

      // Determine dominant correlation type
      const typeCounts = new Map<string, number>()
      for (const correlation of correlations) {
        const count = typeCounts.get(correlation.correlationType) || 0
        typeCounts.set(correlation.correlationType, count + 1)
      }

      let dominantType = 'merged'
      let maxCount = 0
      for (const [type, count] of typeCounts) {
        if (count > maxCount) {
          maxCount = count
          dominantType = type
        }
      }

      return {
        correlationId: this.generateCorrelationId(),
        correlatedThreats: Array.from(allThreats),
        correlationStrength: avgStrength,
        correlationType: dominantType,
        confidence: Math.min(avgStrength * 0.95, 1),
        analysisMethod: 'grouped_correlation',
        timestamp: new Date(),
      }
    } catch (error) {
      logger.error('Failed to merge correlation group:', { error })
      return null
    }
  }

  private generateCorrelationId(): string {
    return `correlation_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  }

  private generatePatternId(): string {
    return `pattern_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  }

  private async monitorNewCorrelations(): Promise<void> {
    try {
      // Check for new correlations in the last monitoring period
      const recentCorrelations = await this.db
        .collection('correlation_data')
        .find({
          timestamp: { $gte: new Date(Date.now() - 30000) }, // Last 30 seconds
        })
        .toArray()

      if (recentCorrelations.length > 0) {
        this.emit('new_correlations_detected', {
          correlationCount: recentCorrelations.length,
          recentCorrelations,
        })
      }
    } catch (error) {
      logger.error('Correlation monitoring error:', { error })
    }
  }

  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down Threat Correlation Engine')

      // Dispose of ML model
      if (this.mlModel) {
        this.mlModel.dispose()
      }

      // Close database connections
      if (this.mongoClient) {
        await this.mongoClient.close()
      }

      if (this.redis) {
        await this.redis.quit()
      }

      this.emit('engine_shutdown')
      logger.info('Threat Correlation Engine shutdown completed')
    } catch (error) {
      logger.error('Error during shutdown:', { error })
      throw error
    }
  }
}

// Supporting interfaces
interface CorrelationAnalysis {
  strength: number
  type: string
  confidence: number
  method: string
}

interface PatternInfo {
  type: string
  description: string
  regions: string[]
  indicators: string[]
}
