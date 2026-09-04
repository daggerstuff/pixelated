/**
 * Global threat intelligence network types and small helpers.
 * Extracted from GlobalThreatIntelligenceNetwork.ts.
 */

import crypto from 'crypto'
import type {
  RealTimeThreatData,
  GlobalThreatIntelligence,
  CorrelationData,
  ValidationStatus,
  HealthStatus,
  HuntingConfig,
  FeedConfig,
} from './types'
import type { ValidationMetrics as ValidationSystemMetrics } from '../validation/ThreatValidationSystem'

export interface GlobalThreatIntelligenceNetwork {
  initialize(): Promise<void>
  processThreatIntelligence(
    threatData: RealTimeThreatData,
  ): Promise<GlobalThreatIntelligence>
  correlateThreatsAcrossRegions(threatIds: string[]): Promise<CorrelationData[]>
  validateThreatIntelligence(intelligenceId: string): Promise<ValidationStatus>
  getGlobalThreatSummary(region?: string): Promise<GlobalThreatSummary>
  getHealthStatus(): Promise<HealthStatus>
  shutdown(): Promise<void>
}

export interface GlobalThreatSummary {
  totalThreats: number
  activeThreats: number
  threatsByRegion: Record<string, number>
  threatsBySeverity: Record<string, number>
  recentThreats: GlobalThreatIntelligence[]
  correlationCount: number
  validationMetrics: ValidationMetrics
}

export interface ValidationMetrics extends ValidationSystemMetrics {}


export interface RegionStatus {
  regionId: string
  status: 'healthy' | 'degraded' | 'unhealthy' | 'initializing'
  lastUpdate: Date
  threatCount: number
  activeNodes: number
  healthScore: number
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  message?: string
  lastCheck: Date
  responseTime?: number
}

export interface SystemMetrics {
  cpuUsage: number
  memoryUsage: number
  diskUsage: number
  networkLatency: number
  activeConnections: number
  queueSize: number
}


export function mapSeverityToLevel(
  severity: number,
): 'low' | 'medium' | 'high' | 'critical' {
  if (severity >= 0.8) return 'critical'
  if (severity >= 0.6) return 'high'
  if (severity >= 0.4) return 'medium'
  return 'low'
}

export function generateGlobalThreatId(): string {
  return `global_threat_${secureId()}`
}

export function generateIntelligenceId(): string {
  return `intelligence_${secureId()}`
}

export function secureId(): string {
  try {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    // Fallback to timestamp-based ID
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

export function createPendingValidationStatus(): ValidationStatus {
  const now = new Date()
  return {
    validationId: `validation_${secureId()}`,
    status: 'pending',
    accuracy: 0,
    completeness: 0,
    consistency: 0,
    timeliness: 0,
    relevance: 0,
    validator: 'pending',
    validationDate: now,
    feedback: [],
  }
}

export function createDefaultHuntingConfig(): HuntingConfig {
  return {
    enabled: false,
    maxHunts: 10,
    defaultTimeout: 60_000,
    autoEscalate: false,
    huntPatterns: [],
  }
}

export function createDefaultFeedConfig(): FeedConfig {
  return {
    feedId: 'default-feed',
    provider: 'default',
    feedType: 'generic',
    endpoint: 'https://localhost',
    requiresAuth: false,
    updateFrequency: 'hourly',
    parameters: {},
    filters: {},
  }
}

