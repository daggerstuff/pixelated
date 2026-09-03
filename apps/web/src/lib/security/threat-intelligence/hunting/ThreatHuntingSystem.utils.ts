/**
 * Threat Hunting System - Utility Functions & Constants
 */

import { type Document } from 'mongodb'

import { createBuildSafeLogger } from '../../logging/build-safe-logger'

import {
  type GlobalThreatIntelligence,
  type HuntExecution,
  type HuntFinding,
  type HuntPattern,
  type HuntQuery,
  type HuntSchedule,
} from '../global/types'

import type {
  DocumentRecord,
  RawHuntFinding,
  TimeRange,
} from './ThreatHuntingSystem.types'

const logger = createBuildSafeLogger('threat-hunting-utils')

// --- Constants ---

export const SEVERITY_LEVELS = ['low', 'medium', 'high', 'critical'] as const

export const SCHEDULE_INTERVALS: Record<string, number> = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
}

export const VALID_FREQUENCIES = ['hourly', 'daily', 'weekly', 'monthly']

export const THREAT_TYPE_MAP: Record<string, string> = {
  suspicious_connection: 'network_intrusion',
  unusual_dns_query: 'dns_tunneling',
  port_scanning: 'reconnaissance',
  data_exfiltration: 'data_breach',
  suspicious_process: 'malware',
  file_system_anomaly: 'persistence',
  registry_modification: 'persistence',
  persistence_mechanism: 'persistence',
  unusual_login_pattern: 'account_compromise',
  privilege_escalation: 'privilege_escalation',
  unusual_access_pattern: 'insider_threat',
  account_compromise: 'account_compromise',
  known_malware_signature: 'malware',
  suspicious_file_hash: 'malware',
  malware_behavioral_indicator: 'malware',
  c2_communication: 'c2',
  credential_dumping: 'credential_access',
  network_enumeration: 'discovery',
  service_exploitation: 'exploitation',
  remote_access_tool: 'remote_access',
}

// --- Type Guards & Parsers ---

export function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function toDate(value: unknown, fallback: Date = new Date()): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }

  return fallback
}

export function parseDate(value: unknown): Date | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
  }

  return undefined
}

export function getNestedValue(obj: unknown, path: string): unknown {
  if (!isRecord(obj)) {
    return undefined
  }

  return path.split('.').reduce<unknown>((current, key) => {
    if (!isRecord(current)) {
      return undefined
    }

    return current[key]
  }, obj)
}

export function toDocumentRecord(value: Document): DocumentRecord {
  const result: DocumentRecord = {}
  for (const [key, entry] of Object.entries(value)) {
    result[key] = entry as unknown
  }

  return result
}

export function parseTimeRange(value: unknown): TimeRange | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const startTime = parseDate(value['startTime'])
  const endTime = parseDate(value['endTime'])

  if (!startTime || !endTime) {
    return undefined
  }

  return {
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
  }
}

export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((entry): entry is string => typeof entry === 'string')
}

export function toStringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export function toConfidence(value: unknown): number {
  return typeof value === 'number' ? value : 0.5
}

export function normalizeSeverity(
  severity: unknown,
): 'low' | 'medium' | 'high' | 'critical' {
  if (
    severity === 'low' ||
    severity === 'medium' ||
    severity === 'high' ||
    severity === 'critical'
  ) {
    return severity
  }

  return 'medium'
}

export function increaseSeverity(severity: string): string {
  const currentIndex = SEVERITY_LEVELS.indexOf(
    severity as (typeof SEVERITY_LEVELS)[number],
  )
  if (currentIndex < SEVERITY_LEVELS.length - 1) {
    return SEVERITY_LEVELS[currentIndex + 1]
  }
  return severity
}

// --- Time Range Helpers ---

export function getDefaultTimeRange(): TimeRange {
  const endTime = new Date()
  const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000)

  return {
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
  }
}

export function getExecutionTimeRange(execution: HuntExecution): TimeRange {
  const configuredTimeRange = parseTimeRange(
    getNestedValue(execution.parameters, 'timeRange'),
  )
  if (configuredTimeRange) {
    return configuredTimeRange
  }

  const directTimeRange = parseTimeRange(execution.parameters)
  if (directTimeRange) {
    return directTimeRange
  }

  return getDefaultTimeRange()
}

// --- Grouping & Analysis Helpers ---

export function groupBy(
  array: RawHuntFinding[],
  keyPath: string,
): Record<string, RawHuntFinding[]> {
  const groups: Record<string, RawHuntFinding[]> = {}

  for (const item of array) {
    const key = getNestedValue(item, keyPath)
    if (typeof key !== 'string') {
      continue
    }

    ;(groups[key] ??= []).push(item)
  }

  return groups
}

export function calculateOverallConfidence(results: RawHuntFinding[]): number {
  if (results.length === 0) return 0

  const totalConfidence = results.reduce(
    (sum, result) => sum + result.confidence,
    0,
  )
  return totalConfidence / results.length
}

// --- ID Generators ---

export function generateThreatId(): string {
  return `threat_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

export function generateExecutionId(): string {
  return `hunt_exec_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

export function generateThreatKey(threat: GlobalThreatIntelligence): string {
  const indicatorKeys = threat.indicators
    .map((ind) => `${ind.indicatorType}:${ind.value}`)
    .sort()
    .join('|')

  return `${threat.threatType}:${indicatorKeys}`
}

// --- Schedule Helpers ---

export function calculateScheduleInterval(frequency: string): number {
  return SCHEDULE_INTERVALS[frequency] ?? 24 * 60 * 60 * 1000
}

export function validateHuntSchedule(schedule: HuntSchedule): void {
  if (!schedule.scheduleId) {
    throw new Error('Schedule ID is required')
  }

  if (!schedule.patternId) {
    throw new Error('Pattern ID is required')
  }

  if (!schedule.frequency) {
    throw new Error('Frequency is required')
  }

  if (!VALID_FREQUENCIES.includes(schedule.frequency)) {
    throw new Error(`Invalid frequency: ${schedule.frequency}`)
  }
}

// --- Pattern Helpers ---

export function validateHuntPattern(pattern: HuntPattern): void {
  if (!pattern.patternId || !pattern.name || !pattern.patternType) {
    throw new Error('Invalid hunt pattern: missing required fields')
  }

  if (pattern.confidence < 0 || pattern.confidence > 1) {
    throw new Error(
      'Invalid hunt pattern: confidence must be between 0 and 1',
    )
  }
}

export function createCustomPattern(query: HuntQuery): HuntPattern {
  return {
    patternId: `custom_${Date.now()}`,
    type: 'anomaly',
    name: 'Custom Hunt Pattern',
    description: 'User-defined custom hunt pattern',
    patternType: 'custom',
    query: query.customQuery!,
    severity: 'medium',
    confidence: 0.7,
    indicators: [],
    conditions: [],
    actions: [],
    metadata: {
      custom: true,
      createdBy: 'user',
      createdAt: new Date(),
    },
  }
}

export function determineDataSources(
  pattern: HuntPattern,
  query: HuntQuery,
): string[] {
  const dataSources: string[] = []

  const resolvedPatternType = pattern.patternType ?? 'anomaly'
  switch (resolvedPatternType) {
    case 'network':
      dataSources.push('network_logs', 'firewall_logs', 'dns_logs')
      break
    case 'endpoint':
      dataSources.push('endpoint_logs', 'process_logs', 'file_system_logs')
      break
    case 'user_behavior':
      dataSources.push(
        'user_activity_logs',
        'authentication_logs',
        'access_logs',
      )
      break
    case 'malware':
      dataSources.push('file_hashes', 'process_hashes', 'network_connections')
      break
    case 'lateral_movement':
      dataSources.push(
        'network_connections',
        'authentication_logs',
        'process_creation',
      )
      break
    case 'anomaly':
    case 'custom':
      dataSources.push('security_logs', 'system_logs')
  }

  if (query.dataSources) {
    dataSources.push(...query.dataSources)
  }

  return [...new Set(dataSources)]
}

// --- Mapping Helpers ---

export function mapResultToThreatType(result: RawHuntFinding): string {
  return THREAT_TYPE_MAP[result.type] ?? 'general'
}

export function mapToHuntFinding(result: RawHuntFinding): HuntFinding {
  const findingId =
    toStringValue(result.data['findingId']) ?? `finding_${Date.now()}`
  const evidence = toStringArray(result.data['evidence'])
  const description = toStringValue(result.data['description'])

  return {
    findingId,
    severity: normalizeSeverity(result.severity),
    confidence: toConfidence(result.confidence),
    description: `${result.type}: ${description ?? 'Threat hunting anomaly detected'}`,
    evidence,
    remediation:
      toStringValue(result.data['remediation']) ??
      'Investigate and validate the alert.',
  }
}

export function deduplicateThreats(
  threats: GlobalThreatIntelligence[],
): GlobalThreatIntelligence[] {
  const seen = new Set<string>()
  const uniqueThreats: GlobalThreatIntelligence[] = []

  for (const threat of threats) {
    const key = generateThreatKey(threat)
    if (!seen.has(key)) {
      seen.add(key)
      uniqueThreats.push(threat)
    }
  }

  return uniqueThreats
}

export { logger }
