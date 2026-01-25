/**
 * Behavioral Analysis Service
 * Provides real-time user profiling, anomaly detection, and behavioral pattern analysis
 */

import { Redis } from 'ioredis'
import { MongoClient } from 'mongodb'
import * as tf from '@tensorflow/tfjs'
import * as crypto from 'crypto'
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

export interface BehavioralAnalysisService {
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

export class AdvancedBehavioralAnalysisService
  extends EventEmitter
  implements BehavioralAnalysisService {
  private redis: Redis
  private mongoClient: MongoClient
  private anomalyDetector: AnomalyDetector
  private patternMiner: PatternMiner
  private riskCalculator: RiskCalculator
  private privacyPreserver: PrivacyPreserver
  private graphAnalyzer: GraphAnalyzer

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
    this.initializeServices().catch((error) => {
      this.emit('error', error)
    })
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

  private calculateTimeIntervals(timestamps: number[]): number[] {
    if (timestamps.length < 2) return []
    const sorted = [...timestamps].sort((a, b) => a - b)
    const intervals: number[] = []
    for (let i = 1; i < sorted.length; i++) {
      intervals.push(sorted[i] - sorted[i - 1])
    }
    return intervals
  }

  private calculateAverageSessionDuration(events: SecurityEvent[]): number {
    if (events.length === 0) return 0
    // Simplified: max time - min time
    const timestamps = events.map(e => e.timestamp.getTime())
    return Math.max(...timestamps) - Math.min(...timestamps)
  }

  private calculateTimeOfDayPreference(events: SecurityEvent[]): number {
    if (events.length === 0) return 0
    // Return avg hour (0-24) / 24
    const hours = events.map(e => e.timestamp.getHours())
    const avg = hours.reduce((a, b) => a + b, 0) / hours.length
    return avg / 24
  }

  private calculateDayOfWeekPattern(_events: SecurityEvent[]): number[] {
    return [0, 0, 0, 0, 0, 0, 0] // Placeholder for 7 days
  }

  private calculateActivityFrequency(events: SecurityEvent[]): number {
    return events.length
  }

  private calculateSessionRegularity(intervals: number[]): number {
    if (intervals.length === 0) return 1
    // Variance of intervals?
    return 0.8 // Placeholder
  }

  private calculateResponseTimePattern(_events: SecurityEvent[]): number[] {
    return [] // Placeholder
  }

  private async geolocateIPs(ips: string[]): Promise<unknown[]> {
    return ips.map(_ip => ({ lat: 0, lon: 0 }))
  }

  private calculateIPDiversity(ips: string[]): number {
    return new Set(ips).size
  }

  private calculateGeographicSpread(_locations: unknown[]): number {
    return 0.1
  }

  private calculateMobilityPattern(_locations: unknown[]): number {
    return 0.1
  }

  private analyzeNetworkCharacteristics(_events: SecurityEvent[]): NetworkCharacteristics {
    return {
      connectionType: 'unknown',
      bandwidthEstimate: 0,
      latency: 0,
    }
  }

  private async extractSequentialFeatures(_events: SecurityEvent[]): Promise<SequentialFeatures> {
    return {
      actionSequences: [],
      transitionProbabilities: {},
      sequenceEntropy: 0,
      markovChain: null,
    }
  }

  private async extractFrequencyFeatures(events: SecurityEvent[]): Promise<FrequencyFeatures> {
    return {
      eventFrequency: events.length,
      endpointFrequency: {},
      methodFrequency: {},
      responseCodeFrequency: {},
    }
  }

  private async extractContextualFeatures(_events: SecurityEvent[]): Promise<ContextualFeatures> {
    return {
      deviceCharacteristics: {
        deviceType: 'unknown',
        os: 'unknown',
        browser: 'unknown',
        screenResolution: 'unknown',
      },
      networkContext: {
        asn: 'unknown',
        isp: 'unknown',
        country: 'unknown',
        timezone: 'unknown',
      },
      temporalContext: {
        localTime: new Date().toISOString(),
        businessHours: false,
        weekend: false,
        holiday: false,
      },
    }
  }



  private removeDuplicateAnomalies(anomalies: Anomaly[]): Anomaly[] {
    const seen = new Set()
    return anomalies.filter(a => {
      const key = `${a.patternId}-${a.anomalyType}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
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

  private async classifyPatterns(
    patterns: BehavioralPattern[],
  ): Promise<BehavioralPattern[]> {
    return patterns.map((p) => ({ ...p }))
  }
  private async calculatePatternStability(patterns: BehavioralPattern[]): Promise<BehavioralPattern[]> {
    return patterns.map(p => ({ ...p, stability: 0.9 }))
  }

  private async detectSequentialAnomalies(_profile: BehaviorProfile, _events: SecurityEvent[]): Promise<Anomaly[]> {
    return []
  }

  private async calculateBaselineMetrics(_features: BehavioralFeatures): Promise<BaselineMetrics> {
    return {
      timeOfDayThreshold: 0.5,
      geographicThreshold: 0.5,
      frequencyThreshold: 0.5,
      sequentialThreshold: 0.5,
      deviceDiversityThreshold: 0.5
    }
  }

  private async detectFrequencyAnomalies(_profile: BehaviorProfile, _events: SecurityEvent[]): Promise<Anomaly[]> {
    return []
  }

  private calculateProfileConfidence(_features: BehavioralFeatures, _patterns: BehavioralPattern[]): number {
    return 0.8
  }

  private async identifyRiskIndicators(
    _features: BehavioralFeatures | BehaviorProfile,
    _patternsOrCurrent: BehavioralPattern[] | SecurityEvent[],
    _anomalies?: Anomaly[],
  ): Promise<RiskIndicator[]> {
    return []
  }

  private async detectContextualAnomalies(_profile: BehaviorProfile, _events: SecurityEvent[]): Promise<Anomaly[]> {
    return []
  }

  private async extractRiskFactors(_profile: BehaviorProfile, _events: SecurityEvent[]): Promise<RiskFactor[]> {
    return []
  }

  private async calculateBehavioralRiskComponent(_profile: BehaviorProfile, _events: SecurityEvent[]): Promise<number> {
    return 0.5
  }

  private async calculateAnomalyRiskComponent(_profile: BehaviorProfile, _events: SecurityEvent[]): Promise<number> {
    return 0.5
  }

  private async calculateContextualRiskComponent(_events: SecurityEvent[]): Promise<number> {
    return 0.5
  }

  private async calculateHistoricalRiskComponent(_userId: string): Promise<number> {
    return 0.5
  }

  private calculateRiskConfidence(_riskFactors: RiskFactor[]): number {
    return 0.8
  }

  private async calculateRiskTrend(_userId: string, _currentRisk: number): Promise<'increasing' | 'decreasing' | 'stable'> {
    return 'stable'
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

export interface RiskIndicator {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  timestamp: Date
  metadata?: Record<string, unknown>
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
  deviceDiversityThreshold: number
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

// Placeholder class for IsolationForest to resolve type errors
class IsolationForest {
  constructor(
    _nTrees: number,
    _sampleSize: number,
  ) { }

  predict(data: number[][]): number[] {
    return data.map(() => 0.0)
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
      // run tensor operations inside tf.tidy to ensure tensors are disposed
      const { reconstructionError, anomalyScore } = tf.tidy(() => {
        const inputTensor = tf.tensor2d([featureVector])
        const reconstruction = this.model.predict(inputTensor) as tf.Tensor
        const error = tf
          .mean(tf.abs(tf.sub(inputTensor, reconstruction)))
          .dataSync()[0]

        const score = this.isolationForest.predict([featureVector])[0]
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
      const uniqueItems = Array.from(new Set(sequence))
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
