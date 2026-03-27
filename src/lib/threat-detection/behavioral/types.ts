/**
 * Behavioral Analysis Types
 * Shared type definitions for behavioral analysis services
 */

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

export interface BehavioralFeatures {
  temporal: TemporalFeatures
  spatial: SpatialFeatures
  sequential: SequentialFeatures
  frequency: FrequencyFeatures
  contextual: ContextualFeatures
}

export interface TemporalFeatures {
  avgSessionDuration: number
  timeOfDayPreference: number
  dayOfWeekPattern: number[]
  activityFrequency: number
  sessionRegularity: number
  responseTimePattern: number[]
}

export interface SpatialFeatures {
  ipDiversity: number
  geographicSpread: number
  mobilityPattern: number
  networkCharacteristics: NetworkCharacteristics
}

export interface SequentialFeatures {
  actionSequences: string[][]
  transitionProbabilities: Record<string, number>
  sequenceEntropy: number
  markovChain: unknown
}

export interface FrequencyFeatures {
  eventFrequency: number
  endpointFrequency: Record<string, number>
  methodFrequency: Record<string, number>
  responseCodeFrequency: Record<string, number>
}

export interface ContextualFeatures {
  deviceCharacteristics: DeviceCharacteristics
  networkContext: NetworkContext
  temporalContext: TemporalContext
}

export interface NetworkCharacteristics {
  connectionType: string
  bandwidthEstimate: number
  latency: number
}

export interface DeviceCharacteristics {
  deviceType: string
  os: string
  browser: string
  screenResolution: string
}

export interface NetworkContext {
  asn: string
  isp: string
  country: string
  timezone: string
}

export interface TemporalContext {
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

export interface GraphNode {
  nodeId: string
  nodeType: string
  properties: Record<string, unknown>
  centrality?: number
}

export interface GraphEdge {
  edgeId: string
  sourceId: string
  targetId: string
  edgeType: string
  weight: number
  properties: Record<string, unknown>
}

export interface GraphProperties {
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

export interface RiskIndicator {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  timestamp: Date
  metadata?: Record<string, unknown>
}

export interface BaselineMetrics {
  timeOfDayThreshold: number
  geographicThreshold: number
  frequencyThreshold: number
  sequentialThreshold: number
  deviceDiversityThreshold: number
}

export interface AnomalyThresholds {
  temporal: number
  spatial: number
  sequential: number
  frequency: number
}

export interface RiskFactor {
  type: string
  score: number
  weight: number
  description: string
  evidence: unknown[]
}

export interface PrivateBehavioralAnalysis {
  analysisId: string
  privatizedFeatures: BehavioralFeatures
  behavioralPatterns: BehavioralPattern[]
  privacyBudgetUsed: number
  privacyBudgetRemaining: number
  epsilon: number
  timestamp: Date
}

export interface PrivacyConfig {
  epsilon: number
  delta: number
  sensitivity: number
  mechanism: 'laplace' | 'gaussian'
}

export interface RiskComponent {
  type: string
  score: number
  weight: number
}
