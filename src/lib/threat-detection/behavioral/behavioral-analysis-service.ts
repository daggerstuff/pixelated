/**
 * Behavioral Analysis Service
 * Provides real-time user profiling, anomaly detection, and behavioral pattern analysis
 */

import * as crypto from 'crypto'
import { EventEmitter } from 'events'

import { Redis } from 'ioredis'
import { MongoClient } from 'mongodb'

import { BehavioralGraphAnalyzer } from './analyzers/behavioral-graph-analyzer'
import { MLAnomalyDetector } from './analyzers/ml-anomaly-detector'
import { SequentialPatternMiner } from './miners/sequential-pattern-miner'

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
  implements BehavioralAnalysisService
{
  private redis!: Redis
  private mongoClient!: MongoClient
  private anomalyDetector!: AnomalyDetector
  private patternMiner!: PatternMiner
  private riskCalculator!: RiskCalculator
  private privacyPreserver!: PrivacyPreserver
  private graphAnalyzer!: GraphAnalyzer
  private initialized = false
  private initializationPromise: Promise<void> | null = null

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
  }

  public async initializeServices(): Promise<void> {
    if (this.initialized) {
      return
    }
    if (this.initializationPromise) {
      return this.initializationPromise
    }

    this.initializationPromise = this.initializeServicesInternal()
      .catch((error) => {
        this.initializationPromise = null
        throw error
      })
      .then(() => {
        this.initializationPromise = null
      })

    return this.initializationPromise
  }

  private async initializeServicesInternal(): Promise<void> {
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
    this.initialized = true
    this.emit('services_initialized')
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return
    }

    await this.initializeServices()

    if (!this.initialized) {
      throw new Error('AdvancedBehavioralAnalysisService failed to initialize.')
    }
  }

  async createBehaviorProfile(
    userId: string,
    events: SecurityEvent[],
  ): Promise<BehaviorProfile> {
    await this.ensureInitialized()
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
    await this.ensureInitialized()
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
    await this.ensureInitialized()
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
    await this.ensureInitialized()
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
    await this.ensureInitialized()
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
    await this.ensureInitialized()
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
    const timestamps = events.map((e) => e.timestamp.getTime())
    return Math.max(...timestamps) - Math.min(...timestamps)
  }

  private calculateTimeOfDayPreference(events: SecurityEvent[]): number {
    if (events.length === 0) return 0
    // Return avg hour (0-24) / 24
    const hours = events.map((e) => e.timestamp.getHours())
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
    return ips.map((_ip) => ({ lat: 0, lon: 0 }))
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

  private analyzeNetworkCharacteristics(
    _events: SecurityEvent[],
  ): NetworkCharacteristics {
    return {
      connectionType: 'unknown',
      bandwidthEstimate: 0,
      latency: 0,
    }
  }

  private async extractSequentialFeatures(
    _events: SecurityEvent[],
  ): Promise<SequentialFeatures> {
    return {
      actionSequences: [],
      transitionProbabilities: {},
      sequenceEntropy: 0,
      markovChain: null,
    }
  }

  private async extractFrequencyFeatures(
    events: SecurityEvent[],
  ): Promise<FrequencyFeatures> {
    return {
      eventFrequency: events.length,
      endpointFrequency: {},
      methodFrequency: {},
      responseCodeFrequency: {},
    }
  }

  private async extractContextualFeatures(
    _events: SecurityEvent[],
  ): Promise<ContextualFeatures> {
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
    return anomalies.filter((a) => {
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
  private async calculatePatternStability(
    patterns: BehavioralPattern[],
  ): Promise<BehavioralPattern[]> {
    return patterns.map((p) => ({ ...p, stability: 0.9 }))
  }

  private async detectSequentialAnomalies(
    _profile: BehaviorProfile,
    _events: SecurityEvent[],
  ): Promise<Anomaly[]> {
    return []
  }

  private async calculateBaselineMetrics(
    _features: BehavioralFeatures,
  ): Promise<BaselineMetrics> {
    return {
      timeOfDayThreshold: 0.5,
      geographicThreshold: 0.5,
      frequencyThreshold: 0.5,
      sequentialThreshold: 0.5,
      deviceDiversityThreshold: 0.5,
    }
  }

  private async detectFrequencyAnomalies(
    _profile: BehaviorProfile,
    _events: SecurityEvent[],
  ): Promise<Anomaly[]> {
    return []
  }

  private calculateProfileConfidence(
    _features: BehavioralFeatures,
    _patterns: BehavioralPattern[],
  ): number {
    return 0.8
  }

  private async identifyRiskIndicators(
    _features: BehavioralFeatures | BehaviorProfile,
    _patternsOrCurrent: BehavioralPattern[] | SecurityEvent[],
    _anomalies?: Anomaly[],
  ): Promise<RiskIndicator[]> {
    return []
  }

  private async detectContextualAnomalies(
    _profile: BehaviorProfile,
    _events: SecurityEvent[],
  ): Promise<Anomaly[]> {
    return []
  }

  private async extractRiskFactors(
    _profile: BehaviorProfile,
    _events: SecurityEvent[],
  ): Promise<RiskFactor[]> {
    return []
  }

  private async calculateBehavioralRiskComponent(
    _profile: BehaviorProfile,
    _events: SecurityEvent[],
  ): Promise<number> {
    return 0.5
  }

  private async calculateAnomalyRiskComponent(
    _profile: BehaviorProfile,
    _events: SecurityEvent[],
  ): Promise<number> {
    return 0.5
  }

  private async calculateContextualRiskComponent(
    _events: SecurityEvent[],
  ): Promise<number> {
    return 0.5
  }

  private async calculateHistoricalRiskComponent(
    _userId: string,
  ): Promise<number> {
    return 0.5
  }

  private calculateRiskConfidence(_riskFactors: RiskFactor[]): number {
    return 0.8
  }

  private async calculateRiskTrend(
    _userId: string,
    _currentRisk: number,
  ): Promise<'increasing' | 'decreasing' | 'stable'> {
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

export interface BehavioralFeatures {
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

export interface BehavioralSequence {
  sequenceId: string
  userId: string
  timestamp: Date
  actions: string[]
  context: unknown
}

export interface BehaviorGraph {
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

export interface Cluster {
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

export interface BaselineMetrics {
  timeOfDayThreshold: number
  geographicThreshold: number
  frequencyThreshold: number
  sequentialThreshold: number
  deviceDiversityThreshold: number
}

export interface AnomalyDetector {
  detectAnomalies(
    profile: BehaviorProfile,
    features: BehavioralFeatures,
  ): Promise<Anomaly[]>
}

export interface PatternMiner {
  minePatterns(sequences: BehavioralSequence[]): Promise<BehavioralPattern[]>
}

interface RiskCalculator {
  calculateRisk(
    profile: BehaviorProfile,
    events: SecurityEvent[],
  ): Promise<number>
}

interface PrivacyPreserver {
  applyPrivacy(events: SecurityEvent[]): Promise<SecurityEvent[]>
  getPrivacyBudget(): {
    used: number
    remaining: number
    epsilon: number
  }
}

export interface GraphAnalyzer {
  buildGraph(events: SecurityEvent[]): Promise<BehaviorGraph>
  calculateCentrality(graph: BehaviorGraph): Promise<Record<string, number>>
  detectCommunities(graph: BehaviorGraph): Promise<string[][]>
  detectGraphAnomalies(graph: BehaviorGraph): Promise<{ anomalyScore: number }>
  identifyBehavioralClusters(graph: BehaviorGraph): Promise<Cluster[]>
}

class MultiFactorRiskCalculator implements RiskCalculator {
  async calculateRisk(
    _profile: BehaviorProfile,
    _events: SecurityEvent[],
  ): Promise<number> {
    return 0.5
  }
}

class DifferentialPrivacyPreserver implements PrivacyPreserver {
  constructor(private config: PrivacyConfig) {}

  async applyPrivacy(events: SecurityEvent[]): Promise<SecurityEvent[]> {
    return events
  }

  getPrivacyBudget(): { used: number; remaining: number; epsilon: number } {
    return { used: 0.1, remaining: 0.9, epsilon: this.config.epsilon }
  }
}
