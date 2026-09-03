/**
 * Threat Hunting System - Type Definitions
 */

import { type Document } from 'mongodb'

import {
  type HuntExecution,
  type HuntFinding,
  type HuntPattern,
  type HuntQuery,
  type HuntResult,
  type HuntSchedule,
} from '../global/types'

export type {
  HuntExecution,
  HuntFinding,
  HuntPattern,
  HuntQuery,
  HuntResult,
  HuntSchedule,
}

export type DocumentRecord = Record<string, unknown>

export type TimeRange = { startTime: string; endTime: string }

export interface RawHuntFinding {
  type: string
  severity: string
  confidence: number
  data: DocumentRecord
  timestamp: Date
  [key: string]: unknown
}

export interface PortScanAggregateResult extends DocumentRecord {
  _id: { sourceIp?: string; hour?: string }
  uniquePorts: unknown[]
  connectionCount: number
  timestamps: unknown[]
}

export interface LoginAggregateResult extends DocumentRecord {
  _id: string
  loginCount: number
  uniqueLocations: unknown[]
  failureCount: number
  timestamps: unknown[]
}

export interface AccessAggregateResult extends DocumentRecord {
  _id: string
  accessCount: number
  uniqueResources: unknown[]
  accessTimes: unknown[]
}

export interface LateralAggregateResult extends DocumentRecord {
  _id: {
    sourceIp?: string
    destinationIp?: string
    destinationPort?: number
    hour?: string
  }
  sourceIp?: string
  destinationIp?: string
  destinationPort?: number
  connectionCount: number
  timestamps: unknown[]
  totalBytes?: number
  uniqueDestinations?: unknown[]
  portsScanned?: unknown[]
}

export interface PatternTypeCount {
  patternType: string
  count: number
}

export interface MalwareSignature extends Document {
  hash?: string
}

export interface SeverityCount {
  severity: string
  count: number
}

export interface ThreatNotification {
  type: string
  threatId: string
  severity: string
  confidence: number
  indicatorCount: number
  timestamp: Date
}

export interface ThreatHuntingSystem {
  initialize(): Promise<void>
  executeHunt(query: HuntQuery): Promise<HuntResult>
  scheduleHunt(schedule: HuntSchedule): Promise<string>
  cancelHunt(huntId: string): Promise<boolean>
  getHuntResults(huntId: string, limit?: number): Promise<HuntResult[]>
  getActiveHunts(): Promise<HuntExecution[]>
  updateHuntPattern(pattern: HuntPattern): Promise<boolean>
  getHuntMetrics(): Promise<HuntMetrics>
  getHealthStatus(): Promise<HealthStatus>
  shutdown(): Promise<void>
}

export interface HuntMetrics {
  totalHunts: number
  successfulHunts: number
  failedHunts: number
  averageExecutionTime: number
  threatsDiscovered: number
  falsePositives: number
  huntByType: Record<string, number>
  huntBySeverity: Record<string, number>
}

export interface HealthStatus {
  healthy: boolean
  message: string
  responseTime?: number
  activeHunts?: number
  successRate?: number
}
