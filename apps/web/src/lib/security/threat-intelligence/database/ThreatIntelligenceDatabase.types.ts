/**
 * Threat intelligence database types — extracted from
 * ThreatIntelligenceDatabase.ts.
 */

import type {
  GlobalThreatIntelligence,
  CorrelationData,
  PaginationParams,
  ApiResponse,
} from '../global/types'

export interface SearchQuery {
  threatId?: string
  intelligenceId?: string
  globalThreatId?: string
  regions?: string[]
  severity?: string
  confidence?: {
    min?: number
    max?: number
  }
  timeRange?: {
    start?: string | Date
    end?: string | Date
  }
  indicators?: {
    types?: string[]
    values?: string[]
  }
}

export interface ThreatIntelligenceDatabase {
  initialize(): Promise<void>
  storeThreatIntelligence(threat: GlobalThreatIntelligence): Promise<void>
  updateThreatIntelligence(threat: GlobalThreatIntelligence): Promise<void>
  getThreatById(threatId: string): Promise<GlobalThreatIntelligence | null>
  getThreatByIntelligenceId(
    intelligenceId: string,
  ): Promise<GlobalThreatIntelligence | null>
  getThreatByIndicator(
    indicatorType: string,
    indicatorValue: string,
  ): Promise<GlobalThreatIntelligence | null>
  getThreatsByRegion(region?: string): Promise<Record<string, number>>
  getThreatsBySeverity(region?: string): Promise<Record<string, number>>
  getRecentThreats(
    region?: string,
    limit?: number,
  ): Promise<GlobalThreatIntelligence[]>
  getTotalThreatCount(region?: string): Promise<number>
  getActiveThreatCount(region?: string): Promise<number>
  getCorrelationCount(region?: string): Promise<number>
  storeCorrelationData(correlation: CorrelationData): Promise<void>
  getSTIXObjects(
    objectType: string,
    filters?: Record<string, unknown>,
  ): Promise<Record<string, unknown>[]>
  getTAXIICollections(): Promise<Record<string, unknown>[]>
  getTAXIIObjects(
    collectionId: string,
    filters?: Record<string, unknown>,
  ): Promise<Record<string, unknown>[]>
  searchThreats(
    query: SearchQuery,
    pagination: PaginationParams,
  ): Promise<ApiResponse<GlobalThreatIntelligence[]>>
  getHealthStatus(): Promise<HealthStatus>
  shutdown(): Promise<void>
}

export interface HealthStatus {
  healthy: boolean
  message: string
  responseTime?: number
  databaseStats?: DatabaseStats
}

export interface DatabaseStats {
  totalThreats: number
  totalCorrelations: number
  totalSTIXObjects: number
  totalTAXIIObjects: number
  lastUpdate: Date
}

export interface STIXObject {
  id: string
  type: string
  spec_version: string
  created: Date
  modified: Date
  created_by_ref?: string
  labels?: string[]
  object_marking_refs?: string[]
  granular_markings?: Record<string, unknown>[]
  [key: string]: unknown
}

export interface TAXIICollection {
  id: string
  title: string
  description: string
  can_read: boolean
  can_write: boolean
  media_types: string[]
  created: Date
  modified: Date
}

