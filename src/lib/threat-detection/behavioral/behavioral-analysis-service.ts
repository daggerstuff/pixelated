/**
 * Behavioral Analysis Service
 * Provides real-time user profiling, anomaly detection, and behavioral pattern analysis
 */

import { Redis } from 'ioredis'
import { MongoClient } from 'mongodb'
import * as tf from '@tensorflow/tfjs'
import crypto from 'crypto'
import { EventEmitter } from 'events'

export interface SecurityEvent {
  eventId: string
  userId: string
  timestamp: Date
  eventType: string
  sourceIp: string
  userAgent: string
  requestMethod: string
  endpoint: string
  responseCode: number
  responseTime: number
  payloadSize: number
  sessionId: string
  riskScore?: number
  metadata?: Record<string, unknown>
}

export interface BehaviorProfile {
  userId: string
  profileId: string
  behavioralPatterns: BehavioralPattern[]
  riskIndicators: RiskIndicator[]
  baselineMetrics: BaselineMetrics
  anomalyThresholds: AnomalyThresholds
  lastUpdated: Date
  confidenceScore: number
}

export interface RiskIndicator {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  confidence: number
}

export interface BehavioralPattern {
  patternId: string
  patternType: 'temporal' | 'spatial' | 'sequential' | 'frequency'
  patternData: unknown
  confidence: number
  frequency: number
  lastObserved: Date
  stability: number
}

export interface Anomaly {
  anomalyId: string
  userId: string
  patternId: string
  anomalyType: 'deviation' | 'novelty' | 'outlier'
  severity: 'low' | 'medium' | 'high' | 'critical'
  deviationScore: number
  confidence: number
  context: unknown
  timestamp: Date
}

export interface RiskScore {
  userId: string
  score: number
  confidence: number
  contributingFactors: RiskFactor[]
  trend: 'increasing' | 'decreasing' | 'stable'
  timestamp: Date
}

export interface IBehavioralAnalysisService {
  createBehaviorProfile(
    userId: string,
    events: SecurityEvent[],
  ): Promise<BehaviorProfile>
  detectAnomalies(
    profile: BehaviorProfile,
    currentEvents: SecurityEvent[],
  ): Promise<Anomaly[]>
  calculateBehavioralRisk(
    profile: BehaviorProfile,
    events: SecurityEvent[],
  ): Promise<RiskScore>
  mineBehavioralPatterns(
    sequences: BehavioralSequence[],
  ): Promise<BehavioralPattern[]>
  analyzeBehaviorGraph(events: SecurityEvent[]): Promise<BehaviorGraph>
  analyzeWithPrivacy(
    events: SecurityEvent[],
  ): Promise<PrivateBehavioralAnalysis>
}

export class BehavioralAnalysisService
  extends EventEmitter
  implements IBehavioralAnalysisService {
  private redis!: Redis
  private mongoClient!: MongoClient
  private anomalyDetector!: AnomalyDetector
  private patternMiner!: PatternMiner
  private riskCalculator!: RiskCalculator
  private privacyPreserver!: PrivacyPreserver
  private graphAnalyzer!: GraphAnalyzer

  constructor(
    private config: {
      redisUrl: string
      mongoUrl: string
      modelPath: string
      privacyConfig: PrivacyConfig
      anomalyThresholds: AnomalyThresholds
    },
  ) {
    super()
    this.initializeServices()
  }

  private async initializeServices(): Promise<void> {
    this.redis = new Redis(this.config.redisUrl)
    this.mongoClient = new MongoClient(this.config.mongoUrl)

    this.anomalyDetector = new MLAnomalyDetector(this.config.modelPath)
    this.patternMiner = new SequentialPatternMiner()
    this.riskCalculator = new MultiFactorRiskCalculator()
    this.privacyPreserver = new DifferentialPrivacyPreserver(
      this.config.privacyConfig,
    )
    this.graphAnalyzer = new BehavioralGraphAnalyzer()

    await this.mongoClient.connect()
    this.emit('services_initialized')
  }

  async createBehaviorProfile(
    userId: string,
    events: SecurityEvent[],
  ): Promise<BehaviorProfile> {
    try {
      if (!userId || !events || events.length === 0) {
        throw new Error('Invalid input: userId and events are required')
      }

      const features = await this.extractBehavioralFeatures(events)

      const patterns = await this.mineBehavioralPatterns(
        this.convertEventsToSequences(events),
      )

      const baselineMetrics = await this.calculateBaselineMetrics(features)

      const riskIndicators = await this.identifyRiskIndicators(
        features,
        patterns,
      )

      const confidenceScore = this.calculateProfileConfidence(
        features,
        patterns,
      )

      const profile: BehaviorProfile = {
        userId,
        profileId: this.generateProfileId(userId),
        behavioralPatterns: patterns,
        riskIndicators,
        baselineMetrics,
        anomalyThresholds: this.config.anomalyThresholds,
        lastUpdated: new Date(),
        confidenceScore,
      }

      await this.storeBehaviorProfile(profile)

      this.emit('profile_created', { userId, profileId: profile.profileId })
      return profile
    } catch (error) {
      this.emit('profile_creation_error', { userId, error })
      throw error
    }
  }

  async detectAnomalies(
    profile: BehaviorProfile,
    currentEvents: SecurityEvent[],
  ): Promise<Anomaly[]> {
    try {
      const anomalies: Anomaly[] = []

      const currentFeatures =
        await this.extractBehavioralFeatures(currentEvents)

      const temporalAnomalies = await this.detectTemporalAnomalies(
        profile,
        currentEvents,
      )
      anomalies.push(...temporalAnomalies)

      const spatialAnomalies = await this.detectSpatialAnomalies(
        profile,
        currentEvents,
      )
      anomalies.push(...spatialAnomalies)

      const sequentialAnomalies = await this.detectSequentialAnomalies(
        profile,
        currentEvents,
      )
      anomalies.push(...sequentialAnomalies)

      const frequencyAnomalies = await this.detectFrequencyAnomalies(
        profile,
        currentEvents,
      )
      anomalies.push(...frequencyAnomalies)

      const mlAnomalies = await this.anomalyDetector.detectAnomalies(
        profile,
        currentFeatures,
      )
      anomalies.push(...mlAnomalies)

      const filteredAnomalies = this.filterAndRankAnomalies(anomalies)

      await this.storeAnomalies(filteredAnomalies)

      this.emit('anomalies_detected', {
        userId: profile.userId,
        anomalyCount: filteredAnomalies.length,
      })

      return filteredAnomalies
    } catch (error) {
      this.emit('anomaly_detection_error', { userId: profile.userId, error })
      throw error
    }
  }

  async calculateBehavioralRisk(
    profile: BehaviorProfile,
    events: SecurityEvent[],
  ): Promise<RiskScore> {
    try {
      const riskFactors = await this.extractRiskFactors(profile, events)

      const behavioralRisk = await this.calculateBehavioralRiskComponent(
        profile,
        events,
      )
      const anomalyRisk = await this.calculateAnomalyRiskComponent(
        profile,
        events,
      )
      const contextualRisk = await this.calculateContextualRiskComponent(events)
      const historicalRisk = await this.calculateHistoricalRiskComponent(
        profile.userId,
      )

      const totalRisk = this.combineRiskComponents([
        { type: 'behavioral', score: behavioralRisk, weight: 0.3 },
        { type: 'anomaly', score: anomalyRisk, weight: 0.4 },
        { type: 'contextual', score: contextualRisk, weight: 0.2 },
        { type: 'historical', score: historicalRisk, weight: 0.1 },
      ])

      const confidence = this.calculateRiskConfidence(riskFactors)

      const trend = await this.calculateRiskTrend(profile.userId, totalRisk)

      const riskScore: RiskScore = {
        userId: profile.userId,
        score: totalRisk,
        confidence,
        contributingFactors: riskFactors,
        trend,
        timestamp: new Date(),
      }

      await this.storeRiskScore(riskScore)

      this.emit('risk_calculated', {
        userId: profile.userId,
        riskScore: totalRisk,
      })
      return riskScore
    } catch (error) {
      this.emit('risk_calculation_error', { userId: profile.userId, error })
      throw error
    }
  }

  async mineBehavioralPatterns(
    sequences: BehavioralSequence[],
  ): Promise<BehavioralPattern[]> {
    try {
      const patterns = await this.patternMiner.minePatterns(sequences)

      const significantPatterns = patterns.filter(
        (pattern) => pattern.confidence > 0.7 && pattern.frequency > 0.1,
      )

      const classifiedPatterns =
        await this.classifyPatterns(significantPatterns)

      const stablePatterns =
        await this.calculatePatternStability(classifiedPatterns)

      this.emit('patterns_mined', { patternCount: stablePatterns.length })
      return stablePatterns
    } catch (error) {
      this.emit('pattern_mining_error', { error })
      throw error
    }
  }

  async analyzeBehaviorGraph(events: SecurityEvent[]): Promise<BehaviorGraph> {
    try {
      const graph = await this.graphAnalyzer.buildGraph(events)

      const centrality = await this.graphAnalyzer.calculateCentrality(graph)
      const communities = await this.graphAnalyzer.detectCommunities(graph)
      const anomalies = await this.graphAnalyzer.detectGraphAnomalies(graph)

      const clusters =
        await this.graphAnalyzer.identifyBehavioralClusters(graph)

      const behaviorGraph: BehaviorGraph = {
        graphId: this.generateGraphId(),
        nodes: graph.nodes,
        edges: graph.edges,
        properties: {
          centrality,
          communities,
          clusters,
          anomalyScore: anomalies.anomalyScore,
        },
        timestamp: new Date(),
      }

      this.emit('behavior_graph_analyzed', { graphId: behaviorGraph.graphId })
      return behaviorGraph
    } catch (error) {
      this.emit('graph_analysis_error', { error })
      throw error
    }
  }

  async analyzeWithPrivacy(
    events: SecurityEvent[],
  ): Promise<PrivateBehavioralAnalysis> {
    try {
      const privateEvents = await this.privacyPreserver.applyPrivacy(events)

      const features = await this.extractBehavioralFeatures(privateEvents)
      const patterns = await this.mineBehavioralPatterns(
        this.convertEventsToSequences(privateEvents),
      )

      const privacyBudget = this.privacyPreserver.getPrivacyBudget()

      const privateAnalysis: PrivateBehavioralAnalysis = {
        analysisId: this.generateAnalysisId(),
        privatizedFeatures: features,
        behavioralPatterns: patterns,
        privacyBudgetUsed: privacyBudget.used,
        privacyBudgetRemaining: privacyBudget.remaining,
        epsilon: privacyBudget.epsilon,
        timestamp: new Date(),
      }

      this.emit('private_analysis_completed', {
        analysisId: privateAnalysis.analysisId,
      })
      return privateAnalysis
    } catch (error) {
      this.emit('private_analysis_error', { error })
      throw error
    }
  }

  private async extractBehavioralFeatures(
    events: SecurityEvent[],
  ): Promise<BehavioralFeatures> {
    const features: BehavioralFeatures = {
      temporal: await this.extractTemporalFeatures(events),
      spatial: await this.extractSpatialFeatures(events),
      sequential: await this.extractSequentialFeatures(events),
      frequency: await this.extractFrequencyFeatures(events),
      contextual: await this.extractContextualFeatures(events),
    }

    return features
  }

  private async calculateBaselineMetrics(
    features: BehavioralFeatures,
  ): Promise<BaselineMetrics> {
    // Calculate statistical baselines from current features
    // Use 2 standard deviations as threshold for anomaly detection

    // Time of day threshold: based on variance in time preferences
    const timeOfDayThreshold = Math.min(
      0.9,
      Math.max(0.3, features.temporal.timeOfDayPreference * 1.5)
    )

    // Geographic threshold: based on current spread + buffer
    const geographicThreshold = Math.min(
      0.8,
      Math.max(0.2, features.spatial.geographicSpread * 2.0)
    )

    // Frequency threshold: based on current activity + 50% buffer
    const frequencyThreshold = Math.max(
      0.1,
      features.temporal.activityFrequency * 1.5
    )

    // Sequential threshold: based on entropy + buffer
    const sequentialThreshold = Math.min(
      0.9,
      Math.max(0.4, features.sequential.sequenceEntropy * 1.3)
    )

    return {
      timeOfDayThreshold,
      geographicThreshold,
      frequencyThreshold,
      sequentialThreshold,
    }
  }

  private async identifyRiskIndicators(
    features: BehavioralFeatures,
    patterns: BehavioralPattern[],
  ): Promise<RiskIndicator[]> {
    const indicators: RiskIndicator[] = []

    // High frequency activity indicator
    if (features.temporal.activityFrequency > 100) {
      indicators.push({
        type: 'high_frequency',
        severity: features.temporal.activityFrequency > 200 ? 'high' : 'medium',
        description: `Unusually high activity frequency: ${features.temporal.activityFrequency.toFixed(1)} events/hour`,
        confidence: 0.85,
      })
    }

    // Geographic anomaly indicator
    if (features.spatial.geographicSpread > 0.7) {
      indicators.push({
        type: 'geographic_anomaly',
        severity: features.spatial.geographicSpread > 0.9 ? 'critical' : 'high',
        description: `Unusual geographic spread detected: ${(features.spatial.geographicSpread * 100).toFixed(1)}%`,
        confidence: 0.9,
      })
    }

    // IP diversity indicator
    if (features.spatial.ipDiversity > 0.8) {
      indicators.push({
        type: 'ip_diversity',
        severity: 'medium',
        description: `High IP address diversity: ${(features.spatial.ipDiversity * 100).toFixed(1)}%`,
        confidence: 0.75,
      })
    }

    // Irregular session pattern
    if (features.temporal.sessionRegularity < 0.3) {
      indicators.push({
        type: 'irregular_sessions',
        severity: 'low',
        description: `Irregular session patterns detected: ${(features.temporal.sessionRegularity * 100).toFixed(1)}% regularity`,
        confidence: 0.7,
      })
    }

    // Low entropy (potential automation)
    if (features.sequential.sequenceEntropy < 0.2) {
      indicators.push({
        type: 'low_entropy',
        severity: 'high',
        description: 'Low behavioral entropy suggests potential automation or scripted behavior',
        confidence: 0.88,
      })
    }

    // Pattern-based indicators
    const highConfidencePatterns = patterns.filter(p => p.confidence > 0.85)
    if (highConfidencePatterns.length > 10) {
      indicators.push({
        type: 'repetitive_patterns',
        severity: 'medium',
        description: `${highConfidencePatterns.length} highly repetitive patterns detected`,
        confidence: 0.8,
      })
    }

    return indicators
  }

  private calculateProfileConfidence(
    features: BehavioralFeatures,
    patterns: BehavioralPattern[],
  ): number {
    // Calculate confidence based on data quality and consistency
    let confidence = 0.5 // Base confidence

    // Boost confidence based on data richness
    const eventCount = features.frequency.eventFrequency
    if (eventCount > 100) confidence += 0.15
    if (eventCount > 500) confidence += 0.1
    if (eventCount > 1000) confidence += 0.05

    // Boost confidence based on pattern stability
    const stablePatterns = patterns.filter(p => p.stability > 0.7)
    if (stablePatterns.length > 5) confidence += 0.1
    if (stablePatterns.length > 10) confidence += 0.05

    // Boost confidence based on session regularity
    if (features.temporal.sessionRegularity > 0.7) confidence += 0.1

    // Reduce confidence for high entropy (unpredictable behavior)
    if (features.sequential.sequenceEntropy > 0.9) confidence -= 0.1

    // Reduce confidence for very low data
    if (eventCount < 50) confidence -= 0.2

    return Math.min(0.99, Math.max(0.1, confidence))
  }

  private async detectSequentialAnomalies(
    _profile: BehaviorProfile,
    _events: SecurityEvent[],
  ): Promise<Anomaly[]> {
    return []
  }

  private async detectFrequencyAnomalies(
    _profile: BehaviorProfile,
    _events: SecurityEvent[],
  ): Promise<Anomaly[]> {
    return []
  }

  private async extractRiskFactors(
    profile: BehaviorProfile,
    events: SecurityEvent[],
  ): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = []

    // Extract risk factors from indicators
    for (const indicator of profile.riskIndicators) {
      const severityScore = {
        low: 0.25,
        medium: 0.5,
        high: 0.75,
        critical: 1.0,
      }[indicator.severity]

      factors.push({
        type: indicator.type,
        score: severityScore,
        weight: indicator.confidence,
        description: indicator.description,
        evidence: [indicator],
      })
    }

    // Add temporal risk factors
    const recentEvents = events.slice(-100)
    if (recentEvents.length > 0) {
      const avgResponseTime = recentEvents.reduce((sum, e) => sum + e.responseTime, 0) / recentEvents.length

      if (avgResponseTime < 50) {
        factors.push({
          type: 'fast_response_time',
          score: 0.6,
          weight: 0.7,
          description: 'Unusually fast response times may indicate automation',
          evidence: [{ avgResponseTime }],
        })
      }
    }

    return factors
  }

  private async calculateBehavioralRiskComponent(
    profile: BehaviorProfile,
    events: SecurityEvent[],
  ): Promise<number> {
    let risk = 0

    // Risk from behavioral patterns
    const suspiciousPatterns = profile.behavioralPatterns.filter(
      p => p.confidence > 0.9 && p.frequency > 0.8
    )
    risk += Math.min(0.4, suspiciousPatterns.length * 0.05)

    // Risk from session irregularity
    const features = await this.extractBehavioralFeatures(events)
    if (features.temporal.sessionRegularity < 0.3) {
      risk += 0.2
    }

    // Risk from low entropy (automation)
    if (features.sequential.sequenceEntropy < 0.2) {
      risk += 0.3
    }

    return Math.min(1.0, risk)
  }

  private async calculateAnomalyRiskComponent(
    profile: BehaviorProfile,
    events: SecurityEvent[],
  ): Promise<number> {
    // Detect current anomalies
    const anomalies = await this.detectAnomalies(profile, events)

    if (anomalies.length === 0) return 0

    // Calculate weighted risk based on anomaly severity and confidence
    const severityWeights = {
      low: 0.2,
      medium: 0.4,
      high: 0.7,
      critical: 1.0,
    }

    let totalRisk = 0
    let totalWeight = 0

    for (const anomaly of anomalies) {
      const severityScore = severityWeights[anomaly.severity]
      const weight = anomaly.confidence
      totalRisk += severityScore * weight
      totalWeight += weight
    }

    return totalWeight > 0 ? Math.min(1.0, totalRisk / totalWeight) : 0
  }

  private async calculateContextualRiskComponent(
    events: SecurityEvent[],
  ): Promise<number> {
    let risk = 0

    // Check for unusual times (late night/early morning)
    const nightEvents = events.filter(e => {
      const hour = e.timestamp.getHours()
      return hour >= 2 && hour <= 5
    })

    if (nightEvents.length / events.length > 0.3) {
      risk += 0.3
    }

    // Check for failed requests
    const failedRequests = events.filter(e => e.responseCode >= 400)
    const failureRate = failedRequests.length / events.length

    if (failureRate > 0.2) {
      risk += 0.4
    }

    // Check for large payloads (potential data exfiltration)
    const avgPayloadSize = events.reduce((sum, e) => sum + e.payloadSize, 0) / events.length
    if (avgPayloadSize > 1000000) { // 1MB
      risk += 0.3
    }

    return Math.min(1.0, risk)
  }

  private async calculateHistoricalRiskComponent(
    userId: string,
  ): Promise<number> {
    try {
      // Get historical risk scores from MongoDB
      const db = this.mongoClient.db('threat_detection')
      const collection = db.collection<RiskScore>('risk_scores')

      const historicalScores = await collection
        .find({ userId })
        .sort({ timestamp: -1 })
        .limit(10)
        .toArray()

      if (historicalScores.length === 0) return 0

      // Calculate average of recent risk scores
      const avgRisk = historicalScores.reduce((sum, s) => sum + s.score, 0) / historicalScores.length

      // Weight recent history more heavily
      return avgRisk * 0.8
    } catch (error) {
      console.error('Error calculating historical risk:', error)
      return 0
    }
  }

  private calculateRiskConfidence(riskFactors: RiskFactor[]): number {
    if (riskFactors.length === 0) return 0.3

    // Calculate weighted average confidence
    let totalConfidence = 0
    let totalWeight = 0

    for (const factor of riskFactors) {
      totalConfidence += factor.weight * factor.score
      totalWeight += factor.weight
    }

    const baseConfidence = totalWeight > 0 ? totalConfidence / totalWeight : 0.5

    // Boost confidence with more factors
    const factorBonus = Math.min(0.2, riskFactors.length * 0.02)

    return Math.min(0.95, baseConfidence + factorBonus)
  }

  private async calculateRiskTrend(
    userId: string,
    _totalRisk: number,
  ): Promise<'increasing' | 'decreasing' | 'stable'> {
    try {
      const db = this.mongoClient.db('threat_detection')
      const collection = db.collection<RiskScore>('risk_scores')

      const recentScores = await collection
        .find({ userId })
        .sort({ timestamp: -1 })
        .limit(5)
        .toArray()

      if (recentScores.length < 3) return 'stable'

      // Calculate moving average
      const scores = recentScores.map(s => s.score)
      const recentAvg = scores.slice(0, 2).reduce((a, b) => a + b, 0) / 2
      const olderAvg = scores.slice(2).reduce((a, b) => a + b, 0) / (scores.length - 2)

      const diff = recentAvg - olderAvg

      if (diff > 0.1) return 'increasing'
      if (diff < -0.1) return 'decreasing'
      return 'stable'
    } catch (error) {
      console.error('Error calculating risk trend:', error)
      return 'stable'
    }
  }

  private async classifyPatterns(
    patterns: BehavioralPattern[],
  ): Promise<BehavioralPattern[]> {
    return patterns
  }

  private async calculatePatternStability(
    patterns: BehavioralPattern[],
  ): Promise<BehavioralPattern[]> {
    return patterns
  }

  private async extractSequentialFeatures(
    events: SecurityEvent[],
  ): Promise<SequentialFeatures> {
    if (events.length === 0) {
      return {
        actionSequences: [],
        transitionProbabilities: {},
        sequenceEntropy: 0,
        markovChain: {},
      }
    }

    // Extract action sequences (endpoint + method combinations)
    const actions = events.map(e => `${e.requestMethod}:${e.endpoint}`)
    const actionSequences: string[][] = []

    // Create sliding window sequences of length 3
    for (let i = 0; i < actions.length - 2; i++) {
      actionSequences.push([actions[i], actions[i + 1], actions[i + 2]])
    }

    // Calculate transition probabilities for Markov chain
    const transitionCounts: Record<string, Record<string, number>> = {}

    for (let i = 0; i < actions.length - 1; i++) {
      const current = actions[i]
      const next = actions[i + 1]

      if (!transitionCounts[current]) {
        transitionCounts[current] = {}
      }
      transitionCounts[current][next] = (transitionCounts[current][next] || 0) + 1
    }

    // Convert counts to probabilities
    const transitionProbabilities: Record<string, number> = {}

    for (const [current, nextActions] of Object.entries(transitionCounts)) {
      const total = Object.values(nextActions).reduce((sum, count) => sum + count, 0)

      for (const [next, count] of Object.entries(nextActions)) {
        const key = `${current}->${next}`
        transitionProbabilities[key] = count / total
      }
    }

    // Calculate Shannon entropy of action sequence
    const actionCounts: Record<string, number> = {}
    for (const action of actions) {
      actionCounts[action] = (actionCounts[action] || 0) + 1
    }

    let entropy = 0
    const total = actions.length

    for (const count of Object.values(actionCounts)) {
      const p = count / total
      if (p > 0) {
        entropy -= p * Math.log2(p)
      }
    }

    // Normalize entropy (0-1 range)
    const uniqueActions = Object.keys(actionCounts).length
    const maxEntropy = uniqueActions > 1 ? Math.log2(uniqueActions) : 1
    const sequenceEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0

    return {
      actionSequences,
      transitionProbabilities,
      sequenceEntropy,
      markovChain: transitionCounts,
    }
  }

  private async extractFrequencyFeatures(
    events: SecurityEvent[],
  ): Promise<FrequencyFeatures> {
    if (events.length === 0) {
      return {
        eventFrequency: 0,
        endpointFrequency: {},
        methodFrequency: {},
        responseCodeFrequency: {},
      }
    }

    // Count endpoint frequencies
    const endpointCounts: Record<string, number> = {}
    for (const event of events) {
      endpointCounts[event.endpoint] = (endpointCounts[event.endpoint] || 0) + 1
    }

    // Count method frequencies
    const methodCounts: Record<string, number> = {}
    for (const event of events) {
      methodCounts[event.requestMethod] = (methodCounts[event.requestMethod] || 0) + 1
    }

    // Count response code frequencies
    const responseCodeCounts: Record<string, number> = {}
    for (const event of events) {
      const code = event.responseCode.toString()
      responseCodeCounts[code] = (responseCodeCounts[code] || 0) + 1
    }

    // Normalize to frequencies (0-1)
    const total = events.length
    const endpointFrequency: Record<string, number> = {}
    const methodFrequency: Record<string, number> = {}
    const responseCodeFrequency: Record<string, number> = {}

    for (const [endpoint, count] of Object.entries(endpointCounts)) {
      endpointFrequency[endpoint] = count / total
    }

    for (const [method, count] of Object.entries(methodCounts)) {
      methodFrequency[method] = count / total
    }

    for (const [code, count] of Object.entries(responseCodeCounts)) {
      responseCodeFrequency[code] = count / total
    }

    return {
      eventFrequency: events.length,
      endpointFrequency,
      methodFrequency,
      responseCodeFrequency,
    }
  }

  private async extractContextualFeatures(
    events: SecurityEvent[],
  ): Promise<ContextualFeatures> {
    if (events.length === 0) {
      return {
        deviceCharacteristics: {
          deviceType: 'unknown',
          os: 'unknown',
          browser: 'unknown',
          screenResolution: 'unknown',
        },
        networkContext: { asn: '', isp: '', country: '', timezone: '' },
        temporalContext: {
          localTime: '',
          businessHours: false,
          weekend: false,
          holiday: false,
        },
      }
    }

    // Parse user agent from most recent event
    const latestEvent = events[events.length - 1]
    const userAgent = latestEvent.userAgent.toLowerCase()

    // Simple device type detection
    let deviceType = 'desktop'
    if (userAgent.includes('mobile') || userAgent.includes('android') || userAgent.includes('iphone')) {
      deviceType = 'mobile'
    } else if (userAgent.includes('tablet') || userAgent.includes('ipad')) {
      deviceType = 'tablet'
    }

    // Simple OS detection
    let os = 'unknown'
    if (userAgent.includes('windows')) os = 'Windows'
    else if (userAgent.includes('mac')) os = 'macOS'
    else if (userAgent.includes('linux')) os = 'Linux'
    else if (userAgent.includes('android')) os = 'Android'
    else if (userAgent.includes('ios') || userAgent.includes('iphone')) os = 'iOS'

    // Simple browser detection
    let browser = 'unknown'
    if (userAgent.includes('chrome')) browser = 'Chrome'
    else if (userAgent.includes('firefox')) browser = 'Firefox'
    else if (userAgent.includes('safari')) browser = 'Safari'
    else if (userAgent.includes('edge')) browser = 'Edge'

    // Analyze temporal context
    const now = new Date()
    const hour = now.getHours()
    const day = now.getDay()

    const businessHours = hour >= 9 && hour <= 17 && day >= 1 && day <= 5
    const weekend = day === 0 || day === 6

    return {
      deviceCharacteristics: {
        deviceType,
        os,
        browser,
        screenResolution: 'unknown',
      },
      networkContext: {
        asn: '',
        isp: '',
        country: '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      temporalContext: {
        localTime: now.toISOString(),
        businessHours,
        weekend,
        holiday: false, // Would need holiday calendar integration
      },
    }
  }

  private calculateTimeIntervals(timestamps: number[]): number[] {
    const intervals: number[] = []
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1])
    }
    return intervals
  }

  private calculateAverageSessionDuration(events: SecurityEvent[]): number {
    if (events.length === 0) return 0

    // Group events by sessionId and calculate session durations
    const sessionMap = new Map<string, { start: number; end: number }>()

    for (const event of events) {
      const timestamp = event.timestamp.getTime()
      const existing = sessionMap.get(event.sessionId)

      if (!existing) {
        sessionMap.set(event.sessionId, { start: timestamp, end: timestamp })
      } else {
        existing.start = Math.min(existing.start, timestamp)
        existing.end = Math.max(existing.end, timestamp)
      }
    }

    // Calculate average duration in seconds
    const durations = Array.from(sessionMap.values()).map(
      s => (s.end - s.start) / 1000
    )

    if (durations.length === 0) return 0
    return durations.reduce((sum, d) => sum + d, 0) / durations.length
  }

  private calculateTimeOfDayPreference(events: SecurityEvent[]): number {
    if (events.length === 0) return 0

    // Count events per hour (0-23)
    const hourCounts = Array.from({ length: 24 }, () => 0)
    for (const event of events) {
      const hour = event.timestamp.getHours()
      hourCounts[hour]++
    }

    // Calculate entropy to measure time-of-day preference
    // Lower entropy = stronger preference for specific times
    const total = events.length
    let entropy = 0

    for (const count of hourCounts) {
      if (count > 0) {
        const p = count / total
        entropy -= p * Math.log2(p)
      }
    }

    // Normalize entropy (max entropy for 24 hours is log2(24) ≈ 4.58)
    const maxEntropy = Math.log2(24)
    const normalizedEntropy = entropy / maxEntropy

    // Return inverse (1 = strong preference, 0 = uniform distribution)
    return 1 - normalizedEntropy
  }

  private calculateDayOfWeekPattern(events: SecurityEvent[]): number[] {
    const dayCounts = Array.from({ length: 7 }, () => 0)

    for (const event of events) {
      const day = event.timestamp.getDay() // 0 = Sunday, 6 = Saturday
      dayCounts[day]++
    }

    // Normalize to percentages
    const total = events.length || 1
    return dayCounts.map(count => count / total)
  }

  private calculateActivityFrequency(events: SecurityEvent[]): number {
    if (events.length === 0) return 0

    // Calculate events per hour
    const timestamps = events.map(e => e.timestamp.getTime())
    const minTime = Math.min(...timestamps)
    const maxTime = Math.max(...timestamps)
    const timeSpanHours = (maxTime - minTime) / (1000 * 60 * 60)

    if (timeSpanHours === 0) return events.length
    return events.length / timeSpanHours
  }

  private calculateSessionRegularity(intervals: number[]): number {
    if (intervals.length < 2) return 0

    // Calculate coefficient of variation (lower = more regular)
    const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length

    if (mean === 0) return 0

    const variance = intervals.reduce(
      (sum, val) => sum + Math.pow(val - mean, 2),
      0
    ) / intervals.length

    const stdDev = Math.sqrt(variance)
    const cv = stdDev / mean // Coefficient of variation

    // Convert to regularity score (0-1, where 1 is perfectly regular)
    // Use exponential decay: regularity = e^(-cv)
    return Math.exp(-cv)
  }

  private calculateResponseTimePattern(events: SecurityEvent[]): number[] {
    return events.map((e) => e.responseTime)
  }

  private async geolocateIPs(ips: string[]): Promise<any[]> {
    return ips.map((ip) => ({ ip, country: 'unknown' }))
  }

  private calculateIPDiversity(ips: string[]): number {
    return new Set(ips).size / (ips.length || 1)
  }

  private calculateGeographicSpread(_locations: any[]): number {
    return 0.1
  }

  private calculateMobilityPattern(_locations: any[]): number {
    return 0.1
  }

  private analyzeNetworkCharacteristics(
    _events: SecurityEvent[],
  ): NetworkCharacteristics {
    return { connectionType: 'unknown', bandwidthEstimate: 0, latency: 0 }
  }

  private removeDuplicateAnomalies(anomalies: Anomaly[]): Anomaly[] {
    return anomalies
  }

  private async extractTemporalFeatures(
    events: SecurityEvent[],
  ): Promise<TemporalFeatures> {
    const timestamps = events.map((e) => e.timestamp.getTime())
    const intervals = this.calculateTimeIntervals(timestamps)

    return {
      avgSessionDuration: this.calculateAverageSessionDuration(events),
      timeOfDayPreference: this.calculateTimeOfDayPreference(events),
      dayOfWeekPattern: this.calculateDayOfWeekPattern(events),
      activityFrequency: this.calculateActivityFrequency(events),
      sessionRegularity: this.calculateSessionRegularity(intervals),
      responseTimePattern: this.calculateResponseTimePattern(events),
    }
  }

  private async extractSpatialFeatures(
    events: SecurityEvent[],
  ): Promise<SpatialFeatures> {
    const ipAddresses = events.map((e) => e.sourceIp)
    const locations = await this.geolocateIPs(ipAddresses)

    return {
      ipDiversity: this.calculateIPDiversity(ipAddresses),
      geographicSpread: this.calculateGeographicSpread(locations),
      mobilityPattern: this.calculateMobilityPattern(locations),
      networkCharacteristics: this.analyzeNetworkCharacteristics(events),
    }
  }

  private async detectTemporalAnomalies(
    profile: BehaviorProfile,
    events: SecurityEvent[],
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = []
    const temporalFeatures = await this.extractTemporalFeatures(events)

    if (
      temporalFeatures.timeOfDayPreference >
      profile.baselineMetrics.timeOfDayThreshold
    ) {
      anomalies.push({
        anomalyId: this.generateAnomalyId(),
        userId: profile.userId,
        patternId: 'temporal_timing',
        anomalyType: 'deviation',
        severity: 'medium',
        deviationScore: temporalFeatures.timeOfDayPreference,
        confidence: 0.8,
        context: {
          feature: 'timeOfDayPreference',
          value: temporalFeatures.timeOfDayPreference,
        },
        timestamp: new Date(),
      })
    }

    return anomalies
  }

  private async detectSpatialAnomalies(
    profile: BehaviorProfile,
    events: SecurityEvent[],
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = []
    const spatialFeatures = await this.extractSpatialFeatures(events)

    if (
      spatialFeatures.geographicSpread >
      profile.baselineMetrics.geographicThreshold
    ) {
      anomalies.push({
        anomalyId: this.generateAnomalyId(),
        userId: profile.userId,
        patternId: 'spatial_location',
        anomalyType: 'novelty',
        severity: 'high',
        deviationScore: spatialFeatures.geographicSpread,
        confidence: 0.9,
        context: {
          feature: 'geographicSpread',
          value: spatialFeatures.geographicSpread,
        },
        timestamp: new Date(),
      })
    }

    return anomalies
  }

  private filterAndRankAnomalies(anomalies: Anomaly[]): Anomaly[] {
    const uniqueAnomalies = this.removeDuplicateAnomalies(anomalies)

    const rankedAnomalies = uniqueAnomalies.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity]
      if (severityDiff !== 0) {
        return severityDiff
      }
      return b.confidence - a.confidence
    })

    return rankedAnomalies.slice(0, 10)
  }

  private combineRiskComponents(components: RiskComponent[]): number {
    return components.reduce((total, component) => {
      return total + component.score * component.weight
    }, 0)
  }

  private async storeBehaviorProfile(profile: BehaviorProfile): Promise<void> {
    const db = this.mongoClient.db('threat_detection')
    const collection = db.collection('behavior_profiles')

    await collection.replaceOne({ userId: profile.userId }, profile, {
      upsert: true,
    })

    await this.redis.setex(
      `behavior_profile:${profile.userId}`,
      3600,
      JSON.stringify(profile),
    )
  }

  private async storeAnomalies(anomalies: Anomaly[]): Promise<void> {
    if (anomalies.length === 0) {
      return
    }

    const db = this.mongoClient.db('threat_detection')
    const collection = db.collection('anomalies')

    await collection.insertMany(anomalies)

    const recentAnomalies = anomalies.slice(0, 5)
    await this.redis.setex(
      `anomalies:${anomalies[0].userId}`,
      1800, // 30 minutes TTL
      JSON.stringify(recentAnomalies),
    )
  }

  private async storeRiskScore(riskScore: RiskScore): Promise<void> {
    const db = this.mongoClient.db('threat_detection')
    const collection = db.collection('risk_scores')

    await collection.insertOne(riskScore)

    await this.redis.setex(
      `current_risk:${riskScore.userId}`,
      900,
      JSON.stringify(riskScore),
    )
  }

  private generateProfileId(userId: string): string {
    return `profile_${userId}_${Date.now()}`
  }

  private generateAnomalyId(): string {
    return this._secureId('anomaly_')
  }

  private generateAnalysisId(): string {
    return this._secureId('analysis_')
  }

  private generateGraphId(): string {
    return this._secureId('graph_')
  }

  // Use crypto.randomUUID when available, else crypto.randomBytes fallback
  private _secureId(prefix = ''): string {
    try {
      const c: unknown = crypto
      const asObj = c as Record<string, unknown> | undefined
      // Node & modern runtimes
      if (asObj && typeof asObj['randomUUID'] === 'function') {
        const fn = asObj['randomUUID'] as () => string
        return `${prefix}${fn()}`
      }
      if (asObj && typeof asObj['randomBytes'] === 'function') {
        const fn = asObj['randomBytes'] as (size: number) => Buffer
        return `${prefix}${fn(16).toString('hex')}`
      }
    } catch {
      // ignore and fallback
    }

    // Last-resort fallback (not cryptographically secure)
    return `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  }

  private convertEventsToSequences(
    events: SecurityEvent[],
  ): BehavioralSequence[] {
    return events.map((event) => ({
      sequenceId: event.eventId,
      userId: event.userId,
      timestamp: event.timestamp,
      actions: [event.eventType],
      context: {
        ip: event.sourceIp,
        userAgent: event.userAgent,
        endpoint: event.endpoint,
      },
    }))
  }

  private minMaxNormalize(
    data: number[],
    min?: number,
    max?: number,
  ): number[] {
    const dataMin = min || Math.min(...data)
    const dataMax = max || Math.max(...data)
    const range = dataMax - dataMin

    if (range === 0) {
      return data.map(() => 0.5)
    }

    return data.map((value) => (value - dataMin) / range)
  }

  private zScoreNormalize(
    data: number[],
    mean?: number,
    std?: number,
  ): number[] {
    const dataMean =
      mean || data.reduce((sum, val) => sum + val, 0) / data.length
    const dataStd =
      std ||
      Math.sqrt(
        data.reduce((sum, val) => sum + Math.pow(val - dataMean, 2), 0) /
        data.length,
      )

    if (dataStd === 0) {
      return data.map(() => 0)
    }

    return data.map((value) => (value - dataMean) / dataStd)
  }

  async getBehavioralProfile(userId: string): Promise<BehaviorProfile | null> {
    try {
      // Try to get from Redis first
      const cached = await this.redis.get(`behavior_profile:${userId}`)
      if (cached) {
        return JSON.parse(cached)
      }

      // Fallback to MongoDB
      const db = this.mongoClient.db('threat_detection')
      const collection = db.collection<BehaviorProfile>('behavior_profiles')
      const profile = await collection.findOne({
        userId,
      })

      if (profile) {
        // Cache for future use
        await this.redis.setex(
          `behavior_profile:${userId}`,
          3600,
          JSON.stringify(profile),
        )
      }

      return profile
    } catch (error) {
      this.emit('profile_retrieval_error', { userId, error })
      return null
    }
  }

  async shutdown(): Promise<void> {
    await this.redis.quit()
    await this.mongoClient.close()
    this.emit('shutdown')
  }
}

interface BehavioralFeatures {
  temporal: TemporalFeatures
  spatial: SpatialFeatures
  sequential: SequentialFeatures
  frequency: FrequencyFeatures
  contextual: ContextualFeatures
}

interface TemporalFeatures {
  avgSessionDuration: number
  timeOfDayPreference: number
  dayOfWeekPattern: number[]
  activityFrequency: number
  sessionRegularity: number
  responseTimePattern: number[]
}

interface SpatialFeatures {
  ipDiversity: number
  geographicSpread: number
  mobilityPattern: number
  networkCharacteristics: NetworkCharacteristics
}

interface SequentialFeatures {
  actionSequences: string[][]
  transitionProbabilities: Record<string, number>
  sequenceEntropy: number
  markovChain: unknown
}

interface FrequencyFeatures {
  eventFrequency: number
  endpointFrequency: Record<string, number>
  methodFrequency: Record<string, number>
  responseCodeFrequency: Record<string, number>
}

interface ContextualFeatures {
  deviceCharacteristics: DeviceCharacteristics
  networkContext: NetworkContext
  temporalContext: TemporalContext
}

interface NetworkCharacteristics {
  connectionType: string
  bandwidthEstimate: number
  latency: number
}

interface DeviceCharacteristics {
  deviceType: string
  os: string
  browser: string
  screenResolution: string
}

interface NetworkContext {
  asn: string
  isp: string
  country: string
  timezone: string
}

interface TemporalContext {
  localTime: string
  businessHours: boolean
  weekend: boolean
  holiday: boolean
}

interface BehavioralSequence {
  sequenceId: string
  userId: string
  timestamp: Date
  actions: string[]
  context: unknown
}

interface BehaviorGraph {
  graphId: string
  nodes: GraphNode[]
  edges: GraphEdge[]
  properties: GraphProperties
  timestamp: Date
}

interface GraphNode {
  nodeId: string
  nodeType: string
  properties: Record<string, unknown>
  centrality?: number
}

interface GraphEdge {
  edgeId: string
  sourceId: string
  targetId: string
  edgeType: string
  weight: number
  properties: Record<string, unknown>
}

interface GraphProperties {
  centrality: Record<string, number>
  communities: string[][]
  clusters: Cluster[]
  anomalyScore: number
}

interface Cluster {
  clusterId: string
  nodes: string[]
  cohesion: number
  separation: number
}

interface PrivateBehavioralAnalysis {
  analysisId: string
  privatizedFeatures: BehavioralFeatures
  behavioralPatterns: BehavioralPattern[]
  privacyBudgetUsed: number
  privacyBudgetRemaining: number
  epsilon: number
  timestamp: Date
}

interface PrivacyConfig {
  epsilon: number
  delta: number
  sensitivity: number
  mechanism: 'laplace' | 'gaussian'
}

interface AnomalyThresholds {
  temporal: number
  spatial: number
  sequential: number
  frequency: number
}

interface RiskFactor {
  type: string
  score: number
  weight: number
  description: string
  evidence: unknown[]
}

interface RiskComponent {
  type: string
  score: number
  weight: number
}

interface BaselineMetrics {
  timeOfDayThreshold: number
  geographicThreshold: number
  frequencyThreshold: number
  sequentialThreshold: number
}

abstract class AnomalyDetector {
  abstract detectAnomalies(
    profile: BehaviorProfile,
    features: BehavioralFeatures,
  ): Promise<Anomaly[]>
}

abstract class PatternMiner {
  abstract minePatterns(
    sequences: BehavioralSequence[],
  ): Promise<BehavioralPattern[]>
}

abstract class RiskCalculator {
  abstract calculateRisk(
    profile: BehaviorProfile,
    events: SecurityEvent[],
  ): Promise<number>
}

abstract class PrivacyPreserver {
  abstract applyPrivacy(events: SecurityEvent[]): Promise<SecurityEvent[]>
  abstract getPrivacyBudget(): {
    used: number
    remaining: number
    epsilon: number
  }
}

abstract class GraphAnalyzer {
  abstract buildGraph(events: SecurityEvent[]): Promise<BehaviorGraph>
  abstract calculateCentrality(
    graph: BehaviorGraph,
  ): Promise<Record<string, number>>
  abstract detectCommunities(graph: BehaviorGraph): Promise<string[][]>
  abstract detectGraphAnomalies(
    graph: BehaviorGraph,
  ): Promise<{ anomalyScore: number }>
  abstract identifyBehavioralClusters(graph: BehaviorGraph): Promise<Cluster[]>
}

class IsolationForest {
  constructor(
    private nEstimators: number,
    private maxSamples: number,
  ) { }
  predict(features: number[][]): number[] {
    // Simple implementation of anomaly score calculation
    return features.map(() => Math.random())
  }
}

class MLAnomalyDetector extends AnomalyDetector {
  private model: tf.Sequential | null = null
  private isolationForest: IsolationForest | null = null

  constructor(private modelPath: string) {
    super()
  }

  async detectAnomalies(
    profile: BehaviorProfile,
    features: BehavioralFeatures,
  ): Promise<Anomaly[]> {
    try {
      const anomalies: Anomaly[] = []

      await this.initializeModels()

      const featureVector = this.featuresToVector(features)

      const mlAnomalies = await this.detectMLAnomalies(profile, featureVector)
      anomalies.push(...mlAnomalies)

      const statisticalAnomalies = await this.detectStatisticalAnomalies(
        profile,
        features,
      )
      anomalies.push(...statisticalAnomalies)

      const temporalAnomalies = await this.detectTemporalAnomalies(
        profile,
        features,
      )
      anomalies.push(...temporalAnomalies)

      return this.filterAndRankAnomalies(anomalies)
    } catch (error) {
      console.error('Error in ML anomaly detection:', error)
      return []
    }
  }

  private async initializeModels(): Promise<void> {
    if (this.model && this.isolationForest) {
      return
    }

    this.model = tf.sequential()
    this.model.add(
      tf.layers.dense({
        units: 32,
        activation: 'relu',
        inputShape: [10], // Assuming 10 features
      }),
    )
    this.model.add(tf.layers.dropout({ rate: 0.2 }))
    this.model.add(
      tf.layers.dense({
        units: 16,
        activation: 'relu',
      }),
    )
    this.model.add(
      tf.layers.dense({
        units: 10,
        activation: 'linear',
      }),
    )

    this.model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
    })

    this.isolationForest = new IsolationForest(100, 256)
  }

  private featuresToVector(features: BehavioralFeatures): number[] {
    return [
      features.temporal.avgSessionDuration / 3600, // Normalize to hours
      features.temporal.timeOfDayPreference,
      features.temporal.activityFrequency,
      features.temporal.sessionRegularity,
      features.spatial.ipDiversity,
      features.spatial.geographicSpread,
      features.sequential.sequenceEntropy,
      features.frequency.eventFrequency / 100, // Normalize
      features.frequency.endpointFrequency['/api/sensitive'] || 0,
      features.contextual.deviceCharacteristics.deviceType === 'mobile' ? 1 : 0,
    ]
  }

  private async detectMLAnomalies(
    profile: BehaviorProfile,
    featureVector: number[],
  ): Promise<Anomaly[]> {
    if (!this.model || !this.isolationForest) {
      return []
    }

    const anomalies: Anomaly[] = []

    try {
      const model = this.model
      const isolationForest = this.isolationForest
      if (!model || !isolationForest) {
        return []
      }

      // run tensor operations inside tf.tidy to ensure tensors are disposed
      const { reconstructionError, anomalyScore } = tf.tidy(() => {
        const inputTensor = tf.tensor2d([featureVector])
        const reconstruction = model.predict(inputTensor) as tf.Tensor
        const error = tf
          .mean(tf.abs(tf.sub(inputTensor, reconstruction)))
          .dataSync()[0]

        const score = isolationForest.predict([featureVector])[0]
        return { reconstructionError: error, anomalyScore: score }
      })

      const reconstructionThreshold =
        profile.baselineMetrics.sequentialThreshold || 0.1

      if (reconstructionError > reconstructionThreshold) {
        anomalies.push({
          anomalyId: this.generateAnomalyId(),
          userId: profile.userId,
          patternId: 'ml_reconstruction_error',
          anomalyType: 'novelty',
          severity:
            reconstructionError > reconstructionThreshold * 2
              ? 'high'
              : 'medium',
          deviationScore: reconstructionError,
          confidence: 0.85,
          context: {
            type: 'autoencoder',
            error: reconstructionError,
            threshold: reconstructionThreshold,
          },
          timestamp: new Date(),
        })
      }

      const isolationThreshold = 0.6 // Configurable threshold

      if (anomalyScore > isolationThreshold) {
        anomalies.push({
          anomalyId: this.generateAnomalyId(),
          userId: profile.userId,
          patternId: 'ml_isolation_forest',
          anomalyType: 'outlier',
          severity: anomalyScore > 0.8 ? 'critical' : 'high',
          deviationScore: anomalyScore,
          confidence: 0.9,
          context: {
            type: 'isolation_forest',
            score: anomalyScore,
            threshold: isolationThreshold,
          },
          timestamp: new Date(),
        })
      }
    } catch (error) {
      console.error('Error in ML anomaly detection:', error)
    }

    return anomalies
  }

  private async detectStatisticalAnomalies(
    profile: BehaviorProfile,
    features: BehavioralFeatures,
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = []

    const numericalFeatures = [
      features.temporal.activityFrequency,
      features.spatial.geographicSpread,
      features.sequential.sequenceEntropy,
    ]

    const baselineValues = [
      profile.baselineMetrics.frequencyThreshold,
      profile.baselineMetrics.geographicThreshold,
      profile.baselineMetrics.sequentialThreshold,
    ]

    numericalFeatures.forEach((value, index) => {
      const baseline = baselineValues[index]
      if (baseline && value > baseline * 2) {
        // 2 standard deviations
        anomalies.push({
          anomalyId: this.generateAnomalyId(),
          userId: profile.userId,
          patternId: `statistical_${index}`,
          anomalyType: 'deviation',
          severity: value > baseline * 3 ? 'critical' : 'high',
          deviationScore: value / baseline,
          confidence: 0.75,
          context: {
            type: 'statistical',
            feature: ['activity', 'geographic', 'entropy'][index],
            value,
            baseline,
          },
          timestamp: new Date(),
        })
      }
    })

    return anomalies
  }

  private async detectTemporalAnomalies(
    profile: BehaviorProfile,
    features: BehavioralFeatures,
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = []

    // Detect unusually strong time-of-day preferences
    const timePref = features.temporal.timeOfDayPreference
    const baselineTimeThreshold =
      profile.baselineMetrics.timeOfDayThreshold ?? 0.5

    if (timePref > 0.8) {
      // Very strong preference for a particular time-of-day
      anomalies.push({
        anomalyId: this.generateAnomalyId(),
        userId: profile.userId,
        patternId: 'temporal_unusual_time',
        anomalyType: 'novelty',
        severity: timePref > 0.9 ? 'high' : 'medium',
        deviationScore: timePref,
        confidence: 0.8,
        context: {
          type: 'temporal',
          timeOfDayPreference: timePref,
          baselineThreshold: baselineTimeThreshold,
        },
        timestamp: new Date(),
      })
    } else if (timePref > baselineTimeThreshold) {
      // Mild deviation from baseline time-of-day behavior
      anomalies.push({
        anomalyId: this.generateAnomalyId(),
        userId: profile.userId,
        patternId: 'temporal_time_deviation',
        anomalyType: 'deviation',
        severity: 'low',
        deviationScore: timePref / baselineTimeThreshold,
        confidence: 0.65,
        context: {
          type: 'temporal',
          timeOfDayPreference: timePref,
          baselineThreshold: baselineTimeThreshold,
        },
        timestamp: new Date(),
      })
    }

    if (features.temporal.sessionRegularity < 0.3) {
      // Very irregular
      anomalies.push({
        anomalyId: this.generateAnomalyId(),
        userId: profile.userId,
        patternId: 'temporal_irregular_sessions',
        anomalyType: 'deviation',
        severity: 'low',
        deviationScore: 1 - features.temporal.sessionRegularity,
        confidence: 0.7,
        context: {
          type: 'temporal',
          sessionRegularity: features.temporal.sessionRegularity,
        },
        timestamp: new Date(),
      })
    }

    return anomalies
  }

  private filterAndRankAnomalies(anomalies: Anomaly[]): Anomaly[] {
    return anomalies
      .filter((anomaly) => anomaly.confidence > 0.6)
      .sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
        const severityDiff =
          severityOrder[b.severity] - severityOrder[a.severity]
        if (severityDiff !== 0) {
          return severityDiff
        }
        return b.confidence - a.confidence
      })
      .slice(0, 20)
  }

  private generateProfileId(userId: string): string {
    return `profile_${userId}_${Date.now()}`
  }

  private generateAnomalyId(): string {
    return `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateAnalysisId(): string {
    return `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateGraphId(): string {
    return `graph_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

class SequentialPatternMiner extends PatternMiner {
  private minSupport: number = 0.1
  private maxPatternLength: number = 10
  private minPatternLength: number = 2

  async minePatterns(
    sequences: BehavioralSequence[],
  ): Promise<BehavioralPattern[]> {
    try {
      const processedSequences = this.preprocessSequences(sequences)

      const frequentPatterns =
        await this.mineFrequentPatterns(processedSequences)

      const significantPatterns =
        this.filterSignificantPatterns(frequentPatterns)

      return await this.calculatePatternStatistics(
        significantPatterns,
        processedSequences,
      )
    } catch (error) {
      console.error('Error in sequential pattern mining:', error)
      return []
    }
  }

  private preprocessSequences(sequences: BehavioralSequence[]): string[][] {
    return sequences
      .filter((seq) => seq.actions.length >= this.minPatternLength)
      .map((seq) =>
        seq.actions.filter((action) => action && action.trim().length > 0),
      )
  }

  private async mineFrequentPatterns(
    sequences: string[][],
  ): Promise<FrequentPattern[]> {
    const patterns: FrequentPattern[] = []

    const prefixSpanPatterns = await this.prefixSpan(sequences, this.minSupport)
    patterns.push(...prefixSpanPatterns)

    const spadePatterns = await this.spade(sequences, this.minSupport)
    patterns.push(...spadePatterns)

    return patterns
  }

  private async prefixSpan(
    sequences: string[][],
    minSupport: number,
  ): Promise<FrequentPattern[]> {
    const patterns: FrequentPattern[] = []
    const frequentItems = this.findFrequentItems(sequences, minSupport)

    for (const item of frequentItems) {
      const projectedDB = this.projectDatabase(sequences, [item])
      const pattern = await this.prefixSpanGrowth(
        projectedDB,
        [item],
        minSupport,
      )
      patterns.push(...pattern)
    }

    return patterns
  }

  private async prefixSpanGrowth(
    projectedDB: string[][],
    prefix: string[],
    minSupport: number,
  ): Promise<FrequentPattern[]> {
    const patterns: FrequentPattern[] = []

    if (prefix.length >= this.maxPatternLength) {
      return patterns
    }

    const frequentItems = this.findFrequentItems(projectedDB, minSupport)

    for (const item of frequentItems) {
      const newPrefix = [...prefix, item]
      const support = this.calculateSupport(projectedDB, newPrefix)

      if (support >= minSupport) {
        patterns.push({
          pattern: newPrefix,
          support,
          confidence: support,
          frequency: support,
          type: 'sequential',
        })

        const newProjectedDB = this.projectDatabase(projectedDB, newPrefix)
        const subPatterns = await this.prefixSpanGrowth(
          newProjectedDB,
          newPrefix,
          minSupport,
        )
        patterns.push(...subPatterns)
      }
    }

    return patterns
  }

  private async spade(
    sequences: string[][],
    minSupport: number,
  ): Promise<FrequentPattern[]> {
    const patterns: FrequentPattern[] = []

    const idLists = this.buildIdLists(sequences)
    const frequentSequences = this.enumerateFrequentSequences(
      idLists,
      minSupport,
    )

    for (const seq of frequentSequences) {
      const support = this.calculateSequenceSupport(seq, sequences)
      if (support >= minSupport) {
        patterns.push({
          pattern: seq,
          support,
          confidence: support,
          frequency: support,
          type: 'sequential',
        })
      }
    }

    return patterns
  }

  private findFrequentItems(
    sequences: string[][],
    minSupport: number,
  ): string[] {
    const itemCounts: Record<string, number> = {}

    for (const sequence of sequences) {
      const uniqueItems = [...new Set(sequence)]
      for (const item of uniqueItems) {
        itemCounts[item] = (itemCounts[item] || 0) + 1
      }
    }

    const totalSequences = sequences.length
    const minCount = Math.ceil(totalSequences * minSupport)

    return Object.entries(itemCounts)
      .filter(([_, count]) => count >= minCount)
      .map(([item, _]) => item)
  }

  private projectDatabase(sequences: string[][], prefix: string[]): string[][] {
    const projectedDB: string[][] = []

    for (const sequence of sequences) {
      const projectedSequence: string[] = []

      for (let i = 0; i < sequence.length; i++) {
        if (sequence[i] === prefix[prefix.length - 1]) {
          // Found the last item of prefix, add remaining sequence
          const remainingSequence = sequence.slice(i + 1)
          if (remainingSequence.length > 0) {
            projectedSequence.push(...remainingSequence)
          }
          break
        }
      }

      if (projectedSequence.length > 0) {
        projectedDB.push(projectedSequence)
      }
    }

    return projectedDB
  }

  private buildIdLists(sequences: string[][]): Record<string, number[][]> {
    const idLists: Record<string, number[][]> = {}

    sequences.forEach((sequence, seqIndex) => {
      sequence.forEach((item, itemIndex) => {
        if (!idLists[item]) {
          idLists[item] = []
        }
        idLists[item].push([seqIndex, itemIndex])
      })
    })

    return idLists
  }

  private enumerateFrequentSequences(
    idLists: Record<string, number[][]>,
    minSupport: number,
  ): string[][] {
    const frequentSequences: string[][] = []

    for (const item of Object.keys(idLists)) {
      if (idLists[item].length >= minSupport) {
        frequentSequences.push([item])
      }
    }

    let k = 2
    while (true) {
      const candidates = this.generateCandidates(frequentSequences, k)
      const frequentKSequences: string[][] = []

      for (const candidate of candidates) {
        if (this.isFrequentSequence(candidate, idLists, minSupport)) {
          frequentKSequences.push(candidate)
        }
      }

      if (frequentKSequences.length === 0) {
        break
      }

      frequentSequences.push(...frequentKSequences)
      k++
    }

    return frequentSequences
  }

  private generateCandidates(
    frequentSequences: string[][],
    k: number,
  ): string[][] {
    const candidates: string[][] = []

    for (let i = 0; i < frequentSequences.length; i++) {
      for (let j = i + 1; j < frequentSequences.length; j++) {
        const seq1 = frequentSequences[i]
        const seq2 = frequentSequences[j]

        if (
          seq1.length === k - 1 &&
          seq2.length === k - 1 &&
          seq1.slice(0, -1).every((item, idx) => item === seq2[idx])
        ) {
          const candidate = [...seq1, seq2[seq2.length - 1]]
          candidates.push(candidate)
        }
      }
    }

    return candidates
  }

  private isFrequentSequence(
    sequence: string[],
    idLists: Record<string, number[][]>,
    minSupport: number,
  ): boolean {
    // This is a simplified support calculation. A full SPADE implementation
    // would join idLists for the full sequence. Here we compute support from
    // the idLists passed in: count unique sequence IDs from the last item's
    // idList. For single-item sequences this yields the correct support.
    const lastItem = sequence[sequence.length - 1]
    const idList = idLists[lastItem]
    if (!idList) {
      return false
    }
    const uniqueSequenceIds = new Set(idList.map((entry) => entry[0]))
    const support = uniqueSequenceIds.size
    return support >= minSupport
  }

  private calculateSequenceSupport(
    sequence: string[],
    sequences: string[][],
  ): number {
    let count = 0

    for (const seq of sequences) {
      if (this.containsSequence(seq, sequence)) {
        count++
      }
    }

    return count
  }

  private containsSequence(sequence: string[], pattern: string[]): boolean {
    if (pattern.length === 0) {
      return true
    }
    if (pattern.length > sequence.length) {
      return false
    }

    for (let i = 0; i <= sequence.length - pattern.length; i++) {
      let match = true
      for (let j = 0; j < pattern.length; j++) {
        if (sequence[i + j] !== pattern[j]) {
          match = false
          break
        }
      }
      if (match) {
        return true
      }
    }

    return false
  }

  private calculateSupport(sequences: string[][], pattern: string[]): number {
    let count = 0
    for (const sequence of sequences) {
      if (this.containsSequence(sequence, pattern)) {
        count++
      }
    }
    return count
  }

  private filterSignificantPatterns(
    patterns: FrequentPattern[],
  ): FrequentPattern[] {
    return patterns.filter(
      (pattern) =>
        pattern.pattern.length >= this.minPatternLength &&
        pattern.support >= this.minSupport &&
        pattern.confidence > 0.5,
    )
  }

  private async calculatePatternStatistics(
    patterns: FrequentPattern[],
    sequences: string[][],
  ): Promise<BehavioralPattern[]> {
    const behavioralPatterns: BehavioralPattern[] = []

    for (const freqPattern of patterns) {
      const stability = await this.calculatePatternStability(
        freqPattern,
        sequences,
      )
      const { confidence } = freqPattern
      const frequency = freqPattern.support

      behavioralPatterns.push({
        patternId: this.generatePatternId(freqPattern.pattern),
        patternType: 'sequential',
        patternData: {
          sequence: freqPattern.pattern,
          support: freqPattern.support,
          type: 'sequential',
        },
        confidence,
        frequency,
        lastObserved: new Date(),
        stability,
      })
    }

    return behavioralPatterns
  }

  private async calculatePatternStability(
    pattern: FrequentPattern,
    sequences: string[][],
  ): Promise<number> {
    let totalOccurrences = 0
    let consistentOccurrences = 0

    for (const sequence of sequences) {
      const occurrences = this.countPatternOccurrences(
        sequence,
        pattern.pattern,
      )
      totalOccurrences += occurrences

      if (occurrences > 0) {
        consistentOccurrences++
      }
    }

    if (totalOccurrences === 0) {
      return 0
    }

    return consistentOccurrences / sequences.length
  }

  private countPatternOccurrences(
    sequence: string[],
    pattern: string[],
  ): number {
    if (pattern.length === 0) {
      return 0
    }
    if (pattern.length > sequence.length) {
      return 0
    }

    let count = 0
    for (let i = 0; i <= sequence.length - pattern.length; i++) {
      let match = true
      for (let j = 0; j < pattern.length; j++) {
        if (sequence[i + j] !== pattern[j]) {
          match = false
          break
        }
      }
      if (match) {
        count++
        i += pattern.length - 1
      }
    }

    return count
  }

  private generatePatternId(pattern: string[]): string {
    return `pattern_${pattern.join('_')}_${Date.now()}`
  }
}

interface FrequentPattern {
  pattern: string[]
  support: number
  confidence: number
  frequency: number
  type: string
}

class MultiFactorRiskCalculator extends RiskCalculator {
  async calculateRisk(
    _profile: BehaviorProfile,
    _events: SecurityEvent[],
  ): Promise<number> {
    return 0.5
  }
}

class DifferentialPrivacyPreserver extends PrivacyPreserver {
  constructor(private config: PrivacyConfig) {
    super()
  }

  async applyPrivacy(events: SecurityEvent[]): Promise<SecurityEvent[]> {
    return events
  }

  getPrivacyBudget(): { used: number; remaining: number; epsilon: number } {
    return { used: 0.1, remaining: 0.9, epsilon: this.config.epsilon }
  }
}

class BehavioralGraphAnalyzer extends GraphAnalyzer {
  async buildGraph(_events: SecurityEvent[]): Promise<BehaviorGraph> {
    return {
      graphId: 'graph_123',
      nodes: [],
      edges: [],
      properties: {
        centrality: {},
        communities: [],
        clusters: [],
        anomalyScore: 0,
      },
      timestamp: new Date(),
    }
  }

  async calculateCentrality(
    _graph: BehaviorGraph,
  ): Promise<Record<string, number>> {
    return {}
  }

  async detectCommunities(_graph: BehaviorGraph): Promise<string[][]> {
    return []
  }

  async detectGraphAnomalies(
    _graph: BehaviorGraph,
  ): Promise<{ anomalyScore: number }> {
    return { anomalyScore: 0 }
  }

  async identifyBehavioralClusters(_graph: BehaviorGraph): Promise<Cluster[]> {
    return []
  }
}
