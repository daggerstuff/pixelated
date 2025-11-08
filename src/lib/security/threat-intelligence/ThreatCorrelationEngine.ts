/**
 * Threat Correlation Engine
 * Cross-region threat analysis using ML algorithms for pattern recognition
 * Integrates with Pixelated's AI infrastructure for advanced correlation
 */

import { EventEmitter } from 'events'
import { MongoClient, Db, Collection } from 'mongodb'
import { Redis } from 'ioredis'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '../../logger'

import { auditLog } from '../audit-logging'

// Types
export interface ThreatCorrelation {
  id: string
  timestamp: Date
  correlation_type: 'temporal' | 'spatial' | 'behavioral' | 'attribution'
  confidence: number
  threats: CorrelatedThreat[]
  patterns: ThreatPattern[]
  analysis: CorrelationAnalysis
  recommendations: string[]
  metadata: Record<string, unknown>
}

export interface CorrelatedThreat {
  threat_id: string
  region: string
  location: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
  indicators: ThreatIndicator[]
  timestamp: Date
}

export interface ThreatIndicator {
  type: string
  value: string
  confidence: number
  source: string
}

export interface ThreatPattern {
  pattern_id: string
  pattern_type: string
  description: string
  confidence: number
  frequency: number
  temporal_span: number // seconds
  spatial_span: number // kilometers
  indicators: string[]
}

export interface CorrelationAnalysis {
  similarity_score: number
  relationship_strength: number
  common_attributes: string[]
  unique_attributes: string[]
  statistical_significance: number
  machine_learning_insights: MLInsight[]
}

export interface MLInsight {
  algorithm: string
  insight: string
  confidence: number
  evidence: string[]
}

export interface CorrelationEngineConfig {
  mongodb: {
    url: string
    database: string
  }
  redis: {
    url: string
    password?: string
  }
  algorithms: {
    temporal: AlgorithmConfig
    spatial: AlgorithmConfig
    behavioral: AlgorithmConfig
    attribution: AlgorithmConfig
  }
  thresholds: {
    min_correlation_confidence: number
    min_similarity_score: number
    max_correlation_distance: number
    temporal_window: number // seconds
  }
  performance: {
    batch_size: number
    processing_interval: number
    max_concurrent_correlations: number
  }
}

export interface AlgorithmConfig {
  name: string
  enabled: boolean
  parameters: Record<string, unknown>
  weight: number
}

// Add new interfaces for threat data structures
export interface ThreatData {
  id: string
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
  region: string
  location?: {
    name?: string
    coordinates?: {
      latitude: number
      longitude: number
    }
  }
  indicators?: ThreatIndicator[]
  timestamp: string | Date
  tactics?: string
  tools?: string
  attribution?: {
    actor?: string
    campaign?: string
    motivation?: string
    sophistication?: string
    region?: string
  }
}

export interface TimeGroup {
  start_time: string | Date
  end_time: string | Date
  threats: ThreatData[]
}

export interface SpatialGroup {
  threats: ThreatData[]
  distance: number
  center: {
    latitude: number
    longitude: number
  }
}

export interface BehavioralGroup {
  threats: ThreatData[]
  pattern: string
}

export interface AttributionGroup {
  threats: ThreatData[]
  attribution: Record<string, string>
}

export interface CorrelationResult {
  confidence: number
  patterns: ThreatPattern[]
  analysis: CorrelationAnalysis
  time_span?: number
  geographic_span?: number
  similarity_metrics?: Record<string, number>
  confidence_factors?: Record<string, number>
}

export interface SpatialCorrelationResult extends CorrelationResult {
  geographic_span: number
}

export interface TemporalCorrelationResult extends CorrelationResult {
  time_span: number
}

export interface BehavioralCorrelationResult extends CorrelationResult {
  similarity_metrics: Record<string, number>
}

export interface AttributionCorrelationResult extends CorrelationResult {
  confidence_factors: Record<string, number>
}

export interface Recommendation {
  id: string
  type: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  description: string
  action: string
  context: Record<string, unknown>
}

export interface CorrelationMetrics {
  confidence: number
  similarity_score: number
  relationship_strength: number
  threat_count: number
  patterns: ThreatPattern[]
  span_value?: number
}

export interface CorrelationStats {
  total_correlations: number
  type_distribution: Record<string, number>
  confidence_distribution: Array<{
    _id: string
    count: number
  }>
  recent_correlations_24h: number
}

export interface DistanceCoordinates {
  latitude: number
  longitude: number
}

export class ThreatCorrelationEngine extends EventEmitter {
  private config: CorrelationEngineConfig
  private mongoClient: MongoClient
  private db: Db
  private threatsCollection: Collection<ThreatData>
  private correlationsCollection: Collection<ThreatCorrelation>
  private redis: Redis
  private isInitialized = false
  private processingInterval: NodeJS.Timeout | null = null
  private correlationQueue: string[] = []
  private isProcessing = false

  constructor(config: CorrelationEngineConfig) {
    super()
    this.config = config
    this.setMaxListeners(0)
  }

  /**
   * Initialize the threat correlation engine
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Threat Correlation Engine')

      // Initialize MongoDB connection
      this.mongoClient = new MongoClient(this.config.mongodb.url)
      await this.mongoClient.connect()
      this.db = this.mongoClient.db(this.config.mongodb.database)

      // Initialize collections
      this.threatsCollection = this.db.collection('threat_intelligence')
      this.correlationsCollection = this.db.collection('threat_correlations')

      // Create indexes for performance
      await this.createIndexes()

      // Initialize Redis connection
      this.redis = new Redis(this.config.redis.url, {
        password: this.config.redis.password,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
      })

      // Set up Redis pub/sub for real-time correlation
      await this.setupRedisPubSub()

      // Start background processing
      this.startCorrelationProcessing()

      this.isInitialized = true
      logger.info('Threat Correlation Engine initialized successfully')

      this.emit('initialized', { timestamp: new Date() })
    } catch (error) {
      logger.error('Failed to initialize Threat Correlation Engine', {
        error: error.message,
      })
      throw new Error(
        `Failed to initialize threat correlation engine: ${error.message}`,
        { cause: error },
      )
    }
  }

  /**
   * Create database indexes for optimal performance
   */
  private async createIndexes(): Promise<void> {
    try {
      await Promise.all([
        // Threat intelligence indexes
        this.threatsCollection.createIndex({ id: 1 }),
        this.threatsCollection.createIndex({ region: 1, timestamp: -1 }),
        this.threatsCollection.createIndex({ type: 1, severity: 1 }),
        this.threatsCollection.createIndex({ 'indicators.value': 1 }),
        this.threatsCollection.createIndex({ location: '2dsphere' }),

        // Correlations indexes
        this.correlationsCollection.createIndex({ id: 1 }, { unique: true }),
        this.correlationsCollection.createIndex({ timestamp: -1 }),
        this.correlationsCollection.createIndex({ correlation_type: 1 }),
        this.correlationsCollection.createIndex({ confidence: -1 }),
        this.correlationsCollection.createIndex({ 'threats.threat_id': 1 }),
      ])

      logger.info('Database indexes created successfully')
    } catch (error) {
      logger.error('Failed to create database indexes', {
        error: error.message,
      })
      throw error
    }
  }

  /**
   * Set up Redis pub/sub for real-time correlation
   */
  private async setupRedisPubSub(): Promise<void> {
    try {
      const subscriber = this.redis.duplicate()
      await subscriber.connect()

      // Subscribe to new threat notifications
      await subscriber.subscribe('new-threat', async (message) => {
        try {
          const threatData = JSON.parse(message)
          await this.queueThreatForCorrelation(threatData.threat_id)
        } catch (error) {
          logger.error('Failed to process new threat notification', {
            error: error.message,
          })
        }
      })

      logger.info('Redis pub/sub setup completed')
    } catch (error) {
      logger.error('Failed to setup Redis pub/sub', { error: error.message })
      throw error
    }
  }

  /**
   * Queue threat for correlation analysis
   */
  async queueThreatForCorrelation(threatId: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Threat correlation engine not initialized')
    }

    try {
      // Add to correlation queue
      this.correlationQueue.push(threatId)

      // Limit queue size to prevent memory issues
      if (this.correlationQueue.length > 1000) {
        this.correlationQueue = this.correlationQueue.slice(-500)
      }

      logger.debug('Threat queued for correlation', { threatId })
    } catch (error) {
      logger.error('Failed to queue threat for correlation', {
        error: error.message,
        threatId,
      })
      throw error
    }
  }

  /**
   * Start correlation processing service
   */
  private startCorrelationProcessing(): void {
    this.processingInterval = setInterval(async () => {
      if (this.correlationQueue.length > 0 && !this.isProcessing) {
        await this.processCorrelationQueue()
      }
    }, this.config.performance.processing_interval)
  }

  /**
   * Process correlation queue
   */
  private async processCorrelationQueue(): Promise<void> {
    this.isProcessing = true

    try {
      const batchSize = Math.min(
        this.correlationQueue.length,
        this.config.performance.batch_size,
      )

      const threatIds = this.correlationQueue.splice(0, batchSize)
      logger.info('Processing correlation batch', { count: threatIds.length })

      // Get threat details
      const threats = await this.getThreatsByIds(threatIds)

      // Perform correlation analysis
      const correlations = await this.analyzeCorrelations(threats)

      // Store correlation results
      for (const correlation of correlations) {
        await this.storeCorrelation(correlation)
      }

      logger.info('Correlation batch processing completed', {
        count: correlations.length,
      })
    } catch (error) {
      logger.error('Failed to process correlation queue', {
        error: error.message,
      })
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Get threats by IDs
   */
  private async getThreatsByIds(threatIds: string[]): Promise<ThreatData[]> {
    try {
      return await this.threatsCollection
        .find({ id: { $in: threatIds } })
        .toArray()
    } catch (error) {
      logger.error('Failed to get threats by IDs', { error: error.message })
      throw error
    }
  }

  /**
   * Analyze correlations between threats
   */
  private async analyzeCorrelations(
    threats: ThreatData[],
  ): Promise<ThreatCorrelation[]> {
    const correlations: ThreatCorrelation[] = []

    try {
      // Temporal correlation
      if (this.config.algorithms.temporal.enabled) {
        const temporalCorrelations =
          await this.analyzeTemporalCorrelations(threats)
        correlations.push(...temporalCorrelations)
      }

      // Spatial correlation
      if (this.config.algorithms.spatial.enabled) {
        const spatialCorrelations =
          await this.analyzeSpatialCorrelations(threats)
        correlations.push(...spatialCorrelations)
      }

      // Behavioral correlation
      if (this.config.algorithms.behavioral.enabled) {
        const behavioralCorrelations =
          await this.analyzeBehavioralCorrelations(threats)
        correlations.push(...behavioralCorrelations)
      }

      // Attribution correlation
      if (this.config.algorithms.attribution.enabled) {
        const attributionCorrelations =
          await this.analyzeAttributionCorrelations(threats)
        correlations.push(...attributionCorrelations)
      }

      logger.info('Correlation analysis completed', {
        total_correlations: correlations.length,
        temporal: correlations.filter((c) => c.correlation_type === 'temporal')
          .length,
        spatial: correlations.filter((c) => c.correlation_type === 'spatial')
          .length,
        behavioral: correlations.filter(
          (c) => c.correlation_type === 'behavioral',
        ).length,
        attribution: correlations.filter(
          (c) => c.correlation_type === 'attribution',
        ).length,
      })

      return correlations
    } catch (error) {
      logger.error('Failed to analyze correlations', { error: error.message })
      throw error
    }
  }

  /**
   * Analyze temporal correlations
   */
  private async analyzeTemporalCorrelations(
    threats: ThreatData[],
  ): Promise<ThreatCorrelation[]> {
    const correlations: ThreatCorrelation[] = []

    try {
      // Group threats by time windows
      const timeWindow = this.config.thresholds.temporal_window
      const timeGroups = this.groupThreatsByTimeWindow(threats, timeWindow)

      for (const group of timeGroups) {
        if (group.threats.length < 2) continue

        // Calculate temporal correlation metrics
        const correlation = this.calculateTemporalCorrelation(group.threats)

        if (
          correlation.confidence >=
          this.config.thresholds.min_correlation_confidence
        ) {
          correlations.push({
            id: uuidv4(),
            timestamp: new Date(),
            correlation_type: 'temporal',
            confidence: correlation.confidence,
            threats: group.threats.map((t) => this.mapToCorrelatedThreat(t)),
            patterns: correlation.patterns,
            analysis: correlation.analysis,
            recommendations: this.generateTemporalRecommendations(correlation),
            metadata: {
              time_window: timeWindow,
              threat_count: group.threats.length,
              time_span: correlation.time_span,
            },
          })
        }
      }

      return correlations
    } catch (error) {
      logger.error('Failed to analyze temporal correlations', {
        error: error.message,
      })
      throw error
    }
  }

  /**
   * Group threats by time windows
   */
  private groupThreatsByTimeWindow(threats: ThreatData[], windowSize: number): TimeGroup[] {
    const groups: TimeGroup[] = []
    const sortedThreats = [...threats].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    )

    let currentGroup: TimeGroup | null = null

    for (const threat of sortedThreats) {
      const threatTime = new Date(threat.timestamp).getTime()

      if (
        !currentGroup ||
        threatTime - new Date(currentGroup.end_time).getTime() >
        windowSize * 1000
      ) {
        // Start new group
        if (currentGroup) {
          groups.push(currentGroup)
        }
        currentGroup = {
          start_time: threat.timestamp,
          end_time: threat.timestamp,
          threats: [threat],
        }
      } else {
        // Add to current group
        currentGroup.threats.push(threat)
        currentGroup.end_time = threat.timestamp
      }
    }

    if (currentGroup) {
      groups.push(currentGroup)
    }

    return groups
  }

  /**
   * Calculate temporal correlation
   */
  private calculateTemporalCorrelation(threats: ThreatData[]): TemporalCorrelationResult {
    try {
      // Calculate time span
      const timestamps = threats.map((t) => new Date(t.timestamp).getTime())
      const minTime = Math.min(...timestamps)
      const maxTime = Math.max(...timestamps)
      const timeSpan = (maxTime - minTime) / 1000 // seconds

      // Calculate similarity score based on various factors
      let similarityScore = 0
      let patterns: ThreatPattern[] = []

      // Check for similar threat types
      const typeGroups = this.groupBy(threats, 'type')
      for (const [type, typeThreats] of Object.entries(typeGroups)) {
        if (typeThreats.length > 1) {
          similarityScore += 0.3
          patterns.push({
            pattern_id: `temporal_type_${type}`,
            pattern_type: 'threat_type_clustering',
            description: `Multiple ${type} threats in temporal proximity`,
            confidence: 0.8,
            frequency: typeThreats.length,
            temporal_span: timeSpan,
            spatial_span: this.calculateSpatialSpan(typeThreats),
            indicators: [type],
          })
        }
      }

      // Check for similar indicators
      const allIndicators = threats.flatMap(
        (t) => t.indicators?.map((i: ThreatIndicator) => i.value) || [],
      )
      const indicatorCounts = this.countOccurrences(allIndicators)

      for (const [indicator, count] of Object.entries(indicatorCounts)) {
        if (count > 1) {
          similarityScore += 0.2
          patterns.push({
            pattern_id: `temporal_indicator_${indicator}`,
            pattern_type: 'indicator_reuse',
            description: `Indicator ${indicator} appears in multiple threats`,
            confidence: 0.7,
            frequency: count,
            temporal_span: timeSpan,
            spatial_span: 0,
            indicators: [indicator],
          })
        }
      }

      // Calculate final confidence
      const confidence = Math.min(similarityScore, 1.0)

      return {
        confidence,
        patterns,
        analysis: {
          similarity_score: similarityScore,
          relationship_strength: confidence,
          common_attributes: Object.keys(typeGroups).filter(
            (type) => typeGroups[type].length > 1,
          ),
          unique_attributes: [],
          statistical_significance: this.calculateStatisticalSignificance(
            threats.length,
            timeSpan,
          ),
          machine_learning_insights: [],
        },
        time_span,
      }
    } catch (error) {
      logger.error('Failed to calculate temporal correlation', {
        error: error.message,
      })
      throw error
    }
  }

  /**
   * Analyze spatial correlations
   */
  private async analyzeSpatialCorrelations(
    threats: ThreatData[],
  ): Promise<ThreatCorrelation[]> {
    const correlations: ThreatCorrelation[] = []

    try {
      // Group threats by geographic proximity
      const spatialGroups = this.groupThreatsByProximity(threats)

      for (const group of spatialGroups) {
        if (group.threats.length < 2) continue

        const correlation = this.calculateSpatialCorrelation(
          group.threats,
          group.distance,
        )

        if (
          correlation.confidence >=
          this.config.thresholds.min_correlation_confidence
        ) {
          correlations.push({
            id: uuidv4(),
            timestamp: new Date(),
            correlation_type: 'spatial',
            confidence: correlation.confidence,
            threats: group.threats.map((t) => this.mapToCorrelatedThreat(t)),
            patterns: correlation.patterns,
            analysis: correlation.analysis,
            recommendations: this.generateSpatialRecommendations(correlation),
            metadata: {
              max_distance: group.distance,
              threat_count: group.threats.length,
              geographic_span: correlation.geographic_span,
            },
          })
        }
      }

      return correlations
    } catch (error) {
      logger.error('Failed to analyze spatial correlations', {
        error: error.message,
      })
      throw error
    }
  }

  /**
   * Group threats by geographic proximity
   */
  private groupThreatsByProximity(threats: ThreatData[]): SpatialGroup[] {
    const groups: SpatialGroup[] = []
    const processed = new Set<string>()

    for (const threat of threats) {
      if (processed.has(threat.id)) continue

      const group: SpatialGroup = {
        threats: [threat],
        distance: 0,
        center: threat.location?.coordinates || { latitude: 0, longitude: 0 },
      }

      // Find nearby threats
      for (const otherThreat of threats) {
        if (otherThreat.id === threat.id || processed.has(otherThreat.id))
          continue

        const distance = this.calculateDistance(
          threat.location?.coordinates,
          otherThreat.location?.coordinates,
        )

        if (distance <= this.config.thresholds.max_correlation_distance) {
          group.threats.push(otherThreat)
          group.distance = Math.max(group.distance, distance)
          processed.add(otherThreat.id)
        }
      }

      if (group.threats.length > 1) {
        groups.push(group)
      }

      processed.add(threat.id)
    }

    return groups
  }

  /**
   * Calculate distance between two coordinates
   */
  private calculateDistance(coord1: DistanceCoordinates, coord2: DistanceCoordinates): number {
    if (!coord1 || !coord2) return Infinity

    const R = 6371 // Earth's radius in kilometers
    const dLat = this.toRadians(coord2.latitude - coord1.latitude)
    const dLon = this.toRadians(coord2.longitude - coord1.longitude)

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(coord1.latitude)) *
      Math.cos(this.toRadians(coord2.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180)
  }

  /**
   * Calculate spatial correlation
   */
  private calculateSpatialCorrelation(
    threats: ThreatData[],
    maxDistance: number,
  ): SpatialCorrelationResult {
    try {
      const geographicSpan = this.computeGeographicSpan(threats)

      // Validate threats are within max distance threshold
      if (geographicSpan > maxDistance) {
        logger.warn('Geographic span exceeds max distance threshold', {
          geographicSpan,
          maxDistance,
        })
      }

      const patterns = this.detectSpatialPatterns(threats, geographicSpan)
      const similarityScore = this.scoreSpatialSimilarity(threats, patterns)
      const confidence = Math.min(similarityScore, 1.0)

      return {
        confidence,
        patterns,
        analysis: this.buildSpatialAnalysis(
          threats,
          similarityScore,
          confidence,
          geographicSpan,
        ),
        geographic_span: geographicSpan,
      }
    } catch (error) {
      logger.error('Failed to calculate spatial correlation', {
        error: error.message,
      })
      throw error
    }
  }

  /**
   * Compute geographic span of threats
   */
  private computeGeographicSpan(threats: ThreatData[]): number {
    const coordinates = threats
      .map((t) => t.location?.coordinates)
      .filter((coord) => coord && coord.latitude && coord.longitude)

    if (coordinates.length < 2) return 0

    let maxDistance = 0
    for (let i = 0; i < coordinates.length; i++) {
      for (let j = i + 1; j < coordinates.length; j++) {
        const distance = this.calculateDistance(coordinates[i], coordinates[j])
        maxDistance = Math.max(maxDistance, distance)
      }
    }

    return maxDistance
  }

  /**
   * Detect spatial patterns in threats
   */
  private detectSpatialPatterns(
    threats: ThreatData[],
    geographicSpan: number,
  ): ThreatPattern[] {
    const patterns: ThreatPattern[] = []

    // Check for coordinated attacks (similar types in close proximity)
    const typeGroups = this.groupBy(threats, 'type')
    for (const [type, typeThreats] of Object.entries(typeGroups)) {
      if (typeThreats.length > 1) {
        patterns.push({
          pattern_id: `spatial_type_${type}`,
          pattern_type: 'coordinated_attack',
          description: `Multiple ${type} threats in geographic proximity`,
          confidence: 0.9,
          frequency: typeThreats.length,
          temporal_span: this.calculateTemporalSpan(typeThreats),
          spatial_span: geographicSpan,
          indicators: [type],
        })
      }
    }

    // Check for indicator sharing across locations
    const allIndicators = threats.flatMap(
      (t) => t.indicators?.map((i) => i.value) || [],
    )
    const indicatorCounts = this.countOccurrences(allIndicators)

    for (const [indicator, count] of Object.entries(indicatorCounts)) {
      if (count > 1) {
        patterns.push({
          pattern_id: `spatial_indicator_${indicator}`,
          pattern_type: 'indicator_propagation',
          description: `Indicator ${indicator} spans multiple geographic locations`,
          confidence: 0.8,
          frequency: count,
          temporal_span: this.calculateTemporalSpan(threats),
          spatial_span: geographicSpan,
          indicators: [indicator],
        })
      }
    }

    return patterns
  }

  /**
   * Score spatial similarity
   */
  private scoreSpatialSimilarity(
    threats: ThreatData[],
    patterns: ThreatPattern[],
  ): number {
    let score = 0

    // Score based on coordinated attack patterns
    const coordinatedPatterns = patterns.filter(
      (p) => p.pattern_type === 'coordinated_attack',
    )
    score += coordinatedPatterns.length * 0.4

    // Score based on indicator propagation
    const propagationPatterns = patterns.filter(
      (p) => p.pattern_type === 'indicator_propagation',
    )
    score += propagationPatterns.length * 0.3

    return Math.min(score, 1.0)
  }

  /**
   * Build spatial analysis
   */
  private buildSpatialAnalysis(
    threats: ThreatData[],
    similarityScore: number,
    confidence: number,
    geographicSpan: number,
  ): CorrelationAnalysis {
    const typeGroups = this.groupBy(threats, 'type')

    return {
      similarity_score: similarityScore,
      relationship_strength: confidence,
      common_attributes: Object.keys(typeGroups).filter(
        (type) => typeGroups[type].length > 1,
      ),
      unique_attributes: [],
      statistical_significance: this.calculateStatisticalSignificance(
        threats.length,
        geographicSpan,
      ),
      machine_learning_insights: [],
    }
  }

  /**
   * Analyze behavioral correlations
   */
  private async analyzeBehavioralCorrelations(
    threats: ThreatData[],
  ): Promise<ThreatCorrelation[]> {
    const correlations: ThreatCorrelation[] = []

    try {
      // Group threats by behavioral patterns
      const behavioralGroups = this.groupThreatsByBehavior(threats)

      for (const group of behavioralGroups) {
        if (group.threats.length < 2) continue

        const correlation = this.calculateBehavioralCorrelation(
          group.threats,
          group.pattern,
        )

        if (
          correlation.confidence >=
          this.config.thresholds.min_correlation_confidence
        ) {
          correlations.push({
            id: uuidv4(),
            timestamp: new Date(),
            correlation_type: 'behavioral',
            confidence: correlation.confidence,
            threats: group.threats.map((t) => this.mapToCorrelatedThreat(t)),
            patterns: correlation.patterns,
            analysis: correlation.analysis,
            recommendations:
              this.generateBehavioralRecommendations(correlation),
            metadata: {
              behavior_pattern: group.pattern,
              threat_count: group.threats.length,
              similarity_metrics: correlation.similarity_metrics,
            },
          })
        }
      }

      return correlations
    } catch (error) {
      logger.error('Failed to analyze behavioral correlations', {
        error: error.message,
      })
      throw error
    }
  }

  /**
   * Group threats by behavioral patterns
   */
  private groupThreatsByBehavior(threats: ThreatData[]): BehavioralGroup[] {
    const groups: BehavioralGroup[] = []

    // Define behavioral patterns to look for
    const behavioralPatterns = [
      'similar_tactics',
      'similar_tools',
      'similar_timing',
      'similar_targets',
      'escalation_pattern',
    ]

    for (const pattern of behavioralPatterns) {
      const grouped = this.groupThreatsByPattern(threats, pattern)
      groups.push(...grouped)
    }

    return groups
  }

  /**
   * Group threats by specific pattern
   */
  private groupThreatsByPattern(threats: ThreatData[], pattern: string): BehavioralGroup[] {
    const groups: BehavioralGroup[] = []

    switch (pattern) {
      case 'similar_tactics': {
        // Group by similar attack tactics
        const tacticGroups = this.groupBy(threats, 'tactics')
        for (const [tactic, tacticThreats] of Object.entries(tacticGroups)) {
          if (tacticThreats.length > 1) {
            groups.push({
              threats: tacticThreats,
              pattern: `similar_tactics_${tactic}`,
            })
          }
        }
        break
      }

      case 'similar_tools': {
        // Group by similar tools/techniques
        const toolGroups = this.groupBy(threats, 'tools')
        for (const [tool, toolThreats] of Object.entries(toolGroups)) {
          if (toolThreats.length > 1) {
            groups.push({
              threats: toolThreats,
              pattern: `similar_tools_${tool}`,
            })
          }
        }
        break
      }

      case 'escalation_pattern': {
        // Group by escalation patterns (increasing severity)
        const escalationGroups = this.identifyEscalationPatterns(threats)
        groups.push(...escalationGroups)
        break
      }
    }

    return groups
  }

  /**
   * Identify escalation patterns
   */
  private identifyEscalationPatterns(threats: ThreatData[]): BehavioralGroup[] {
    const groups: BehavioralGroup[] = []
    const sortedThreats = [...threats].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    )

    // Look for sequences of increasing severity
    const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 }

    for (let i = 0; i < sortedThreats.length - 1; i++) {
      const sequence = [sortedThreats[i]]
      let currentSeverity =
        severityOrder[
        sortedThreats[i].severity as keyof typeof severityOrder
        ] || 0

      for (let j = i + 1; j < sortedThreats.length; j++) {
        const nextSeverity =
          severityOrder[
          sortedThreats[j].severity as keyof typeof severityOrder
          ] || 0

        if (nextSeverity > currentSeverity) {
          sequence.push(sortedThreats[j] as ThreatData)
          currentSeverity = nextSeverity
        } else {
          break
        }
      }

      if (sequence.length >= 3) {
        groups.push({
          threats: sequence,
          pattern: 'escalation_pattern',
        })
      }
    }

    return groups
  }

  /**
   * Calculate behavioral correlation
   */
  private calculateBehavioralCorrelation(threats: ThreatData[], pattern: string): BehavioralCorrelationResult {
    try {
      let similarityScore = 0
      let patterns: ThreatPattern[] = []
      let similarityMetrics: Record<string, number> = {}

      // Calculate similarity based on behavioral attributes
      switch (pattern) {
        case 'similar_tactics':
          similarityScore = 0.9 // High confidence for same tactics
          patterns.push({
            pattern_id: `behavioral_tactics_${pattern}`,
            pattern_type: 'behavioral_similarity',
            description: `Threats exhibit similar tactical approaches`,
            confidence: 0.9,
            frequency: threats.length,
            temporal_span: this.calculateTemporalSpan(threats),
            spatial_span: this.calculateSpatialSpan(threats),
            indicators: ['tactics'],
          })
          break

        case 'escalation_pattern':
          similarityScore = 0.95 // Very high confidence for escalation
          patterns.push({
            pattern_id: `behavioral_escalation_${pattern}`,
            pattern_type: 'escalation_pattern',
            description: `Threats show escalating severity pattern`,
            confidence: 0.95,
            frequency: threats.length,
            temporal_span: this.calculateTemporalSpan(threats),
            spatial_span: this.calculateSpatialSpan(threats),
            indicators: ['severity_progression'],
          })
          similarityMetrics = {
            severity_increase_rate: this.calculateSeverityIncreaseRate(threats),
            time_between_escalations:
              this.calculateAverageTimeBetweenThreats(threats),
          }
          break
      }

      const confidence = Math.min(similarityScore, 1.0)

      return {
        confidence,
        patterns,
        analysis: {
          similarity_score: similarityScore,
          relationship_strength: confidence,
          common_attributes: [pattern],
          unique_attributes: [],
          statistical_significance: this.calculateStatisticalSignificance(
            threats.length,
            0,
          ),
          machine_learning_insights: [],
        },
        similarity_metrics: similarityMetrics,
      }
    } catch (error) {
      logger.error('Failed to calculate behavioral correlation', {
        error: error.message,
      })
      throw error
    }
  }

  /**
   * Analyze attribution correlations
   */
  private async analyzeAttributionCorrelations(
    threats: ThreatData[],
  ): Promise<ThreatCorrelation[]> {
    const correlations: ThreatCorrelation[] = []

    try {
      // Group threats by attribution attributes
      const attributionGroups = this.groupThreatsByAttribution(threats)

      for (const group of attributionGroups) {
        if (group.threats.length < 2) continue

        const correlation = this.calculateAttributionCorrelation(
          group.threats,
          group.attribution,
        )

        if (
          correlation.confidence >=
          this.config.thresholds.min_correlation_confidence
        ) {
          correlations.push({
            id: uuidv4(),
            timestamp: new Date(),
            correlation_type: 'attribution',
            confidence: correlation.confidence,
            threats: group.threats.map((t) => this.mapToCorrelatedThreat(t)),
            patterns: correlation.patterns,
            analysis: correlation.analysis,
            recommendations:
              this.generateAttributionRecommendations(correlation),
            metadata: {
              attribution_data: group.attribution,
              threat_count: group.threats.length,
              confidence_factors: correlation.confidence_factors,
            },
          })
        }
      }

      return correlations
    } catch (error) {
      logger.error('Failed to analyze attribution correlations', {
        error: error.message,
      })
      throw error
    }
  }

  /**
   * Group threats by attribution
   */
  private groupThreatsByAttribution(threats: ThreatData[]): AttributionGroup[] {
    const groups: AttributionGroup[] = []

    // Group by attribution attributes
    const attributionFields = [
      'actor',
      'campaign',
      'motivation',
      'sophistication',
      'region',
    ]

    for (const field of attributionFields) {
      const fieldGroups = this.groupBy(threats, `attribution.${field}`)
      for (const [value, valueThreats] of Object.entries(fieldGroups)) {
        if (value && valueThreats.length > 1) {
          groups.push({
            threats: valueThreats as ThreatData[],
            attribution: { [field]: value },
          })
        }
      }
    }

    return groups
  }

  /**
   * Calculate attribution correlation
   */
  private calculateAttributionCorrelation(
    threats: ThreatData[],
    attribution: Record<string, string>,
  ): CorrelationResult {
    try {
      let similarityScore = 0
      let patterns: ThreatPattern[] = []
      let confidenceFactors: Record<string, number> = {}

      // Calculate confidence based on attribution strength
      for (const [key, value] of Object.entries(attribution)) {
        if (value) {
          const factorScore = 0.8 // High confidence for attribution matches
          similarityScore += factorScore
          confidenceFactors[key] = factorScore

          patterns.push({
            pattern_id: `attribution_${key}_${value}`,
            pattern_type: 'attribution_match',
            description: `Threats share common ${key}: ${value}`,
            confidence: factorScore,
            frequency: threats.length,
            temporal_span: this.calculateTemporalSpan(threats),
            spatial_span: this.calculateSpatialSpan(threats),
            indicators: [key],
          })
        }
      }

      const confidence = Math.min(similarityScore, 1.0)

      return {
        confidence,
        patterns,
        analysis: {
          similarity_score: similarityScore,
          relationship_strength: confidence,
          common_attributes: Object.keys(attribution),
          unique_attributes: [],
          statistical_significance: this.calculateStatisticalSignificance(
            threats.length,
            0,
          ),
          machine_learning_insights: [],
        },
        confidence_factors: confidenceFactors,
      }
    } catch (error) {
      logger.error('Failed to calculate attribution correlation', {
        error: error.message,
      })
      throw error
    }
  }

  /**
   * Utility functions
   */
  private groupBy<T>(array: T[], key: string): Record<string, T[]> {
    return array.reduce(
      (groups, item) => {
        const value = this.getNestedValue(item, key) || 'unknown'
        groups[value] = groups[value] || []
        groups[value].push(item)
        return groups
      },
      {} as Record<string, T[]>,
    )
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  private countOccurrences(array: string[]): Record<string, number> {
    return array.reduce(
      (counts, item) => {
        counts[item] = (counts[item] || 0) + 1
        return counts
      },
      {} as Record<string, number>,
    )
  }

  private calculateTemporalSpan(threats: ThreatData[]): number {
    const timestamps = threats.map((t) => new Date(t.timestamp).getTime())
    const minTime = Math.min(...timestamps)
    const maxTime = Math.max(...timestamps)
    return (maxTime - minTime) / 1000 // seconds
  }

  private calculateSpatialSpan(threats: ThreatData[]): number {
    const coordinates = threats
      .map((t) => t.location?.coordinates)
      .filter((coord) => coord && coord.latitude && coord.longitude)

    if (coordinates.length < 2) return 0

    let maxDistance = 0
    for (let i = 0; i < coordinates.length; i++) {
      for (let j = i + 1; j < coordinates.length; j++) {
        const distance = this.calculateDistance(coordinates[i], coordinates[j])
        maxDistance = Math.max(maxDistance, distance)
      }
    }

    return maxDistance
  }

  private calculateStatisticalSignificance(
    threatCount: number,
    span: number,
  ): number {
    // Simplified statistical significance calculation
    // In a real implementation, this would use proper statistical methods
    const baseSignificance = Math.min(threatCount / 10, 1.0)
    const spanFactor = span > 0 ? Math.min(1 / span, 1.0) : 1.0
    return Math.min(baseSignificance * (1 + spanFactor), 1.0)
  }

  private calculateSeverityIncreaseRate(threats: ThreatData[]): number {
    const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 }
    let totalIncrease = 0

    for (let i = 1; i < threats.length; i++) {
      const prevSeverity =
        severityOrder[threats[i - 1].severity as keyof typeof severityOrder] ||
        0
      const currSeverity =
        severityOrder[threats[i].severity as keyof typeof severityOrder] || 0
      totalIncrease += Math.max(0, currSeverity - prevSeverity)
    }

    return threats.length > 1 ? totalIncrease / (threats.length - 1) : 0
  }

  private calculateAverageTimeBetweenThreats(threats: ThreatData[]): number {
    if (threats.length < 2) return 0

    const timestamps = threats
      .map((t) => new Date(t.timestamp).getTime())
      .sort()
    let totalTime = 0

    for (let i = 1; i < timestamps.length; i++) {
      totalTime += timestamps[i] - timestamps[i - 1]
    }

    return totalTime / (timestamps.length - 1) / 1000 // seconds
  }

  private mapToCorrelatedThreat(threat: ThreatData): CorrelatedThreat {
    return {
      threat_id: threat.id,
      region: threat.region,
      location: threat.location?.name || threat.location,
      severity: threat.severity,
      confidence: threat.confidence,
      indicators: threat.indicators || [],
      timestamp: new Date(threat.timestamp),
    }
  }

  /**
   * Generate recommendations for different correlation types
   */
  private generateTemporalRecommendations(
    correlation: TemporalCorrelationResult,
  ): string[] {
    const recommendations: string[] = []
    const metrics: CorrelationMetrics = {
      confidence: correlation.confidence,
      similarity_score: correlation.analysis.similarity_score,
      relationship_strength: correlation.analysis.relationship_strength,
      threat_count: correlation.patterns.length,
      patterns: correlation.patterns,
      span_value: correlation.time_span,
    }

    recommendations.push(
      `Monitor for similar threats within ${Math.round(metrics.span_value || 0)}s time windows (confidence: ${(metrics.confidence * 100).toFixed(1)}%)`,
    )

    if (metrics.confidence > 0.8) {
      recommendations.push(
        'HIGH PRIORITY: Review security logs for coordinated attack patterns',
      )
    }

    if (metrics.threat_count > 3) {
      recommendations.push(
        `Implement temporal-based blocking rules for ${metrics.threat_count} detected patterns`,
      )
    }

    recommendations.push(
      'Investigate potential coordinated attack campaigns across time periods',
    )

    return recommendations
  }

  private generateSpatialRecommendations(
    correlation: SpatialCorrelationResult,
  ): string[] {
    const recommendations: string[] = []
    const metrics: CorrelationMetrics = {
      confidence: correlation.confidence,
      similarity_score: correlation.analysis.similarity_score,
      relationship_strength: correlation.analysis.relationship_strength,
      threat_count: correlation.patterns.length,
      patterns: correlation.patterns,
      span_value: correlation.geographic_span,
    }

    recommendations.push(
      `Implement geographic-based access controls for ${Math.round(metrics.span_value || 0)}km radius (confidence: ${(metrics.confidence * 100).toFixed(1)}%)`,
    )

    if (metrics.confidence > 0.8) {
      recommendations.push(
        'HIGH PRIORITY: Coordinate with regional security teams immediately',
      )
    }

    const regions = new Set(
      correlation.patterns.flatMap((p) => p.indicators || []),
    )
    if (regions.size > 1) {
      recommendations.push(
        `Monitor network traffic from ${regions.size} affected regions`,
      )
    }

    recommendations.push(
      'Consider location-based threat intelligence sharing with partners',
    )

    return recommendations
  }

  private generateBehavioralRecommendations(
    correlation: BehavioralCorrelationResult,
  ): string[] {
    const recommendations: string[] = []
    const metrics: CorrelationMetrics = {
      confidence: correlation.confidence,
      similarity_score: correlation.analysis.similarity_score,
      relationship_strength: correlation.analysis.relationship_strength,
      threat_count: correlation.patterns.length,
      patterns: correlation.patterns,
    }

    const behaviorTypes = new Set(
      correlation.patterns.map((p) => p.pattern_type),
    )

    recommendations.push(
      `Update behavioral detection rules for ${behaviorTypes.size} pattern types (confidence: ${(metrics.confidence * 100).toFixed(1)}%)`,
    )

    if (metrics.similarity_score > 0.9) {
      recommendations.push(
        'HIGH PRIORITY: Implement immediate user behavior analytics',
      )
    }

    if (correlation.similarity_metrics?.severity_increase_rate) {
      recommendations.push(
        `Monitor for escalation patterns (rate: ${correlation.similarity_metrics.severity_increase_rate.toFixed(2)})`,
      )
    }

    recommendations.push(
      `Review and update security policies based on ${metrics.threat_count} detected patterns`,
    )

    return recommendations
  }

  private generateAttributionRecommendations(
    correlation: AttributionCorrelationResult,
  ): string[] {
    const recommendations: string[] = []
    const metrics: CorrelationMetrics = {
      confidence: correlation.confidence,
      similarity_score: correlation.analysis.similarity_score,
      relationship_strength: correlation.analysis.relationship_strength,
      threat_count: correlation.patterns.length,
      patterns: correlation.patterns,
    }

    const attributionFactors = Object.keys(
      correlation.confidence_factors || {},
    ).length

    recommendations.push(
      `Investigate attributed threat actor activities (${attributionFactors} attribution factors, confidence: ${(metrics.confidence * 100).toFixed(1)}%)`,
    )

    if (metrics.confidence > 0.85) {
      recommendations.push(
        'HIGH PRIORITY: Share attribution intelligence with security partners',
      )
    }

    const actors = new Set(
      correlation.patterns.flatMap((p) => p.indicators || []),
    )
    if (actors.size > 0) {
      recommendations.push(
        `Implement actor-specific countermeasures for ${actors.size} identified actors`,
      )
    }

    recommendations.push(
      `Monitor for related campaign indicators across ${metrics.threat_count} patterns`,
    )

    return recommendations
  }

  /**
   * Store correlation result
   */
  private async storeCorrelation(
    correlation: ThreatCorrelation,
  ): Promise<void> {
    try {
      await this.correlationsCollection.insertOne({
        ...correlation,
        created_at: new Date(),
      })

      // Emit correlation event
      this.emit('correlation:detected', correlation)

      // Audit log
      await auditLog({
        action: 'threat_correlation',
        resource: `correlation:${correlation.id}`,
        details: {
          type: correlation.correlation_type,
          confidence: correlation.confidence,
          threat_count: correlation.threats.length,
        },
        userId: 'system',
        ip: 'internal',
      })

      logger.info('Correlation stored successfully', {
        correlationId: correlation.id,
        type: correlation.correlation_type,
        confidence: correlation.confidence,
      })
    } catch (error) {
      logger.error('Failed to store correlation', {
        error: error.message,
        correlationId: correlation.id,
      })
      throw error
    }
  }

  /**
   * Get correlations by type
   */
  async getCorrelationsByType(
    type: string,
    limit: number = 100,
  ): Promise<ThreatCorrelation[]> {
    try {
      return await this.correlationsCollection
        .find({ correlation_type: type })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray()
    } catch (error) {
      logger.error('Failed to get correlations by type', {
        error: error.message,
        type,
      })
      throw error
    }
  }

  /**
   * Get correlations by threat ID
   */
  async getCorrelationsByThreatId(
    threatId: string,
  ): Promise<ThreatCorrelation[]> {
    try {
      return await this.correlationsCollection
        .find({ 'threats.threat_id': threatId })
        .sort({ timestamp: -1 })
        .toArray()
    } catch (error) {
      logger.error('Failed to get correlations by threat ID', {
        error: error.message,
        threatId,
      })
      throw error
    }
  }

  /**
   * Search correlations
   */
  async searchCorrelations(query: {
    types?: string[]
    minConfidence?: number
    startDate?: Date
    endDate?: Date
    regions?: string[]
    limit?: number
  }): Promise<ThreatCorrelation[]> {
    try {
      const filter: Record<string, unknown> = {}

      if (query.types && query.types.length > 0) {
        filter.correlation_type = { $in: query.types }
      }

      if (query.minConfidence) {
        filter.confidence = { $gte: query.minConfidence }
      }

      if (query.startDate || query.endDate) {
        filter.timestamp = {}
        if (query.startDate) filter.timestamp.$gte = query.startDate
        if (query.endDate) filter.timestamp.$lte = query.endDate
      }

      if (query.regions && query.regions.length > 0) {
        filter['threats.region'] = { $in: query.regions }
      }

      return await this.correlationsCollection
        .find(filter)
        .sort({ timestamp: -1 })
        .limit(query.limit || 100)
        .toArray()
    } catch (error) {
      logger.error('Failed to search correlations', {
        error: error.message,
        query,
      })
      throw error
    }
  }

  /**
   * Get correlation statistics
   */
  async getCorrelationStats(): Promise<CorrelationStats> {
    try {
      const [
        totalCorrelations,
        typeDistribution,
        confidenceDistribution,
        recentCorrelations,
      ] = await Promise.all([
        this.correlationsCollection.countDocuments(),
        this.correlationsCollection
          .aggregate([
            { $group: { _id: '$correlation_type', count: { $sum: 1 } } },
          ])
          .toArray(),
        this.correlationsCollection
          .aggregate([
            {
              $bucket: {
                groupBy: '$confidence',
                boundaries: [0, 0.3, 0.6, 0.8, 1.0],
                default: 'other',
                output: { count: { $sum: 1 } },
              },
            },
          ])
          .toArray(),
        this.correlationsCollection
          .find({
            timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          })
          .count(),
      ])

      return {
        total_correlations: totalCorrelations,
        type_distribution: typeDistribution.reduce(
          (acc, item) => {
            acc[item._id] = item.count
            return acc
          },
          {} as Record<string, number>,
        ),
        confidence_distribution: confidenceDistribution,
        recent_correlations_24h: recentCorrelations,
      }
    } catch (error) {
      logger.error('Failed to get correlation statistics', {
        error: error.message,
      })
      throw error
    }
  }

  /**
   * Shutdown the engine
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down Threat Correlation Engine')

      if (this.processingInterval) {
        clearInterval(this.processingInterval)
      }

      await this.redis.quit()
      await this.mongoClient.close()

      this.isInitialized = false
      this.emit('shutdown', { timestamp: new Date() })

      logger.info('Threat Correlation Engine shutdown completed')
    } catch (error) {
      logger.error('Error during shutdown', { error: error.message })
      throw error
    }
  }

  /**
   * Get initialization status
   */
  get isReady(): boolean {
    return this.isInitialized
  }
}

export default ThreatCorrelationEngine
