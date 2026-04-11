import { EventEmitter } from 'events'

import * as tf from '@tensorflow/tfjs'

import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import { IMongoClient, IRedisClient } from '../threat-hunting/types'
import { BehavioralAnalysisRepository } from './behavioral-analysis-repository'
import { BehavioralConfig } from './types'

const logger = createBuildSafeLogger('behavioral-analysis-service')

/**
 * AdvancedBehavioralAnalysisService detects anomalies based on user activities.
 * Resolves P3.1 (Init), P4.1 (Null safety), and P4.5 (Repository).
 */
export class AdvancedBehavioralAnalysisService extends EventEmitter {
  private repository: BehavioralAnalysisRepository | null = null
  private model: tf.LayersModel | null = null
  private isInitialized: boolean = false
  private mlModelLoaded: boolean = false

  constructor(private config: BehavioralConfig) {
    super()
  }

  /**
   * Initialize service with required dependencies.
   * Resolves P3.1 by providing an explicit integration gate.
   */
  async initializeServices(
    redis: IRedisClient,
    mongoClient: IMongoClient,
  ): Promise<void> {
    try {
      this.repository = new BehavioralAnalysisRepository(mongoClient, redis)

      if (this.config.mlEnabled) {
        // Load model if enabled
        try {
          this.model = await tf.loadLayersModel(this.config.modelPath)
          this.mlModelLoaded = true
          logger.info('ML model loaded successfully')
        } catch (err) {
          logger.error('Failed to load ML model', { error: err })
          // Don't set isInitialized - service should fail if ML is required but fails
          throw new Error(`ML model initialization failed: ${err}`)
        }
      }

      this.isInitialized = true
      this.emit('service_initialized')
      logger.info('Behavioral analysis service ready')
    } catch (error: unknown) {
      logger.error('Failed to initialize behavioral analysis service', {
        error,
      })
      throw error
    }
  }

  private checkInitialized(): void {
    if (!this.isInitialized || !this.repository) {
      throw new Error(
        'AdvancedBehavioralAnalysisService is not initialized. Call initializeServices(redis, mongoClient) first.',
      )
    }
  }

  /**
   * Create or update a user's behavioral profile
   */
  async createBehaviorProfile(
    userId: string,
    timeframe?: string,
  ): Promise<void> {
    this.checkInitialized()
    const events = await this.repository!.getRecentEvents(
      userId,
      500,
      timeframe,
    )

    const profile = {
      userId,
      eventCount: events.length,
      updatedAt: new Date(),
      typicalIPs: Array.from(new Set(events.map((e) => e.ip).filter(Boolean))),
      typicalLoginHours: Array.from(
        new Set(events.map((e) => new Date(e.timestamp).getHours())),
      ),
    }

    await this.repository!.storeProfile(userId, profile)
    this.emit('profile_updated', { userId, profile })
  }

  /**
   * Detect anomalies in current activity
   */
  async detectAnomalies(
    userId: string,
    currentActivity: any,
    timeframe?: string,
  ): Promise<any[]> {
    this.checkInitialized()
    const profile = await this.repository!.getProfile(userId)
    if (!profile) return []

    const anomalies: any[] = []

    // Check IP Anomaly
    if (
      currentActivity.ip &&
      profile.typicalIPs &&
      !profile.typicalIPs.includes(currentActivity.ip)
    ) {
      anomalies.push({ type: 'unusual_ip', detail: currentActivity.ip })
    }

    // Check Time Anomaly
    const hour = new Date(currentActivity.timestamp).getHours()
    if (
      profile.typicalLoginHours &&
      !profile.typicalLoginHours.includes(hour)
    ) {
      anomalies.push({ type: 'unusual_time', detail: hour })
    }

    if (anomalies.length > 0) {
      this.emit('anomalies_detected', { userId, anomalies })
    }

    return anomalies
  }

  /**
   * Analyze ML anomalies asynchronously
   */
  async detectMLAnomalies(features: number[]): Promise<number[]> {
    this.checkInitialized()
    if (!this.model) return []

    try {
      const input = tf.tensor2d([features])
      const prediction = this.model.predict(input) as tf.Tensor

      const results = await prediction.data()

      // Cleanup tensors
      input.dispose()
      prediction.dispose()

      return Array.from(results)
    } catch (error: unknown) {
      logger.error('ML anomaly detection failed', { error })
      return []
    }
  }

  /**
   * Integration with ThreatHuntingService
   */
  async analyzeUserBehavior(userId: string, timeframe: string): Promise<any[]> {
    this.checkInitialized()
    const anomalies = await this.detectAnomalies(
      userId,
      {
        timestamp: new Date().toISOString(),
        ip: 'unknown', // Default for background analysis
      },
      timeframe,
    )

    return anomalies.map((a) => ({
      ...a,
      severity: 'medium',
      confidence: 0.7,
      timestamp: new Date(),
    }))
  }
}

// Re-export types for convenience
export type {
  BehavioralConfig,
  BehavioralProfile,
  AnomalyRecord,
  ActivityEvent,
} from './types'

// Additional types needed by analyzers
export interface Anomaly {
  type: 'unusual_ip' | 'unusual_time' | 'unusual_behavior' | 'ml_anomaly'
  detail: string | number
  severity: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
  timestamp: Date
}

export interface BehaviorProfile {
  userId: string
  eventCount: number
  updatedAt: Date
  typicalIPs: string[]
  typicalLoginHours: number[]
  riskScore?: number
}

export interface BehavioralFeatures {
  timeFeatures: number[]
  ipFeatures: number[]
  actionFeatures: number[]
  metadataFeatures: number[]
}

export interface AnomalyDetector {
  detectAnomalies(
    profile: BehaviorProfile,
    features: BehavioralFeatures,
  ): Promise<Anomaly[]>
}

export interface BehavioralPattern {
  patternId: string
  type: 'sequential' | 'periodic' | 'anomalous'
  events: string[]
  frequency: number
  firstSeen: Date
  lastSeen: Date
}

export interface BehavioralSequence {
  sequenceId: string
  events: SecurityEvent[]
  startTime: Date
  endTime: Date
  pattern?: BehavioralPattern
}

export interface SecurityEvent {
  eventId: string
  userId: string
  timestamp: Date
  eventType: string
  source: string
  details: Record<string, unknown>
}

export interface PatternMiner {
  minePatterns(events: SecurityEvent[]): Promise<BehavioralPattern[]>
}

export interface BehaviorGraph {
  graphId: string
  nodes: BehaviorNode[]
  edges: BehaviorEdge[]
  properties: {
    centrality: Record<string, number>
    communities: string[][]
    clusters: Cluster[]
    anomalyScore: number
  }
  timestamp: Date
}

export interface BehaviorNode {
  nodeId: string
  type: 'event' | 'entity' | 'action'
  label: string
  properties: Record<string, unknown>
}

export interface BehaviorEdge {
  edgeId: string
  source: string
  target: string
  type: 'follows' | 'relates_to' | 'triggers'
  weight: number
}

export interface Cluster {
  clusterId: string
  nodes: string[]
  centroid?: number[]
  anomalyScore?: number
}

export interface GraphAnalyzer {
  buildGraph(events: SecurityEvent[]): Promise<BehaviorGraph>
  calculateCentrality(graph: BehaviorGraph): Promise<Record<string, number>>
  detectCommunities(graph: BehaviorGraph): Promise<string[][]>
  detectGraphAnomalies(graph: BehaviorGraph): Promise<{ anomalyScore: number }>
  identifyBehavioralClusters(graph: BehaviorGraph): Promise<Cluster[]>
}
