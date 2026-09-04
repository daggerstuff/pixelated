/**
 * Edge threat detection types — extracted from EdgeThreatDetectionSystem.ts.
 */

import type {
  EdgeDetectionResult,
  EdgeNodeStatus,
  AIModelConfig,
  ThreatIndicator,
  ThreatContext,
  RealTimeThreatData,
} from '../global/types'

export interface EdgeThreatDetectionSystem {
  initialize(): Promise<void>
  detectThreat(threatData: RealTimeThreatData): Promise<EdgeDetectionResult>
  getEdgeNodeStatus(nodeId: string): Promise<EdgeNodeStatus>
  deployAIModel(modelConfig: AIModelConfig, nodeIds: string[]): Promise<boolean>
  updateDetectionThresholds(thresholds: DetectionThresholds): Promise<boolean>
  getHealthStatus(): Promise<HealthStatus>
  shutdown(): Promise<void>
}

export interface DetectionThresholds {
  anomaly: number
  threat: number
  confidence: number
  severity: {
    low: number
    medium: number
    high: number
    critical: number
  }
}

export interface HealthStatus {
  healthy: boolean
  message: string
  responseTime?: number
  activeNodes?: number
  totalNodes?: number
}

export interface ModelPerformance {
  modelId: string
  accuracy: number
  precision: number
  recall: number
  f1Score: number
  inferenceTime: number
  memoryUsage: number
}


export interface ProcessedThreatData {
  threatId: string
  timestamp: Date
  region: string
  severity: number
  confidence: number
  indicators: ThreatIndicator[]
  context: ThreatContext
  normalizedSeverity: number
  featureVector: number[]
}

export interface ClassificationResult {
  threatType: string
  confidence: number
  probabilities: number[]
}

export interface CombinedResult {
  threatType: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
  primaryModel: string
  scores: {
    anomaly: number
    classification: number
    prediction: number
    combined: number
  }
}
