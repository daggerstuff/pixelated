/**
 * Threat Data Utilities
 *
 * Consolidated, minimal utilities for processing and analyzing threat data
 * used by the threat-hunting subsystem. This file intentionally keeps a
 * small, well-typed surface area: timestamp parsing, crypto-backed id
 * generation, basic pattern extraction, and export helpers.
 */

import crypto from 'crypto'
import { ThreatData, ThreatPattern, ThreatFinding } from '../types'

// crypto-backed stable id generation with safe fallback
function secureId(prefix = ''): string {
  try {
    const c: unknown = crypto
    const asObj = c as Record<string, unknown> | undefined
    if (asObj && typeof asObj['randomUUID'] === 'function') {
      return `${prefix}${(asObj['randomUUID'] as () => string)()}`
    }
    if (asObj && typeof asObj['randomBytes'] === 'function') {
      return `${prefix}${(asObj['randomBytes'] as (n: number) => Buffer)(16).toString('hex')}`
    }
  } catch (_err) {
    // ignore and fall through to fallback
  }
  return `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

function safeParseTimestamp(ts: unknown, fallback?: string): string {
  if (typeof ts === 'string') {
    const d = new Date(ts)
    if (!isNaN(d.getTime())) return d.toISOString()
  }
  return fallback ?? new Date().toISOString()
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function processThreatData(rawData: unknown[]): ThreatData[] {
  const isObject = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null

  return rawData.map((item, idx) => {
    if (!isObject(item))
      throw new Error(
        `Invalid threat data item at index ${idx}: expected object`,
      )
    const obj = item as Record<string, unknown>
    return {
      id: typeof obj.id === 'string' ? obj.id : secureId('threat_'),
      timestamp: safeParseTimestamp(obj.timestamp),
      source:
        typeof obj.source === 'string' ? (obj.source as string) : 'unknown',
      type: typeof obj.type === 'string' ? (obj.type as string) : 'unknown',
      severity:
        typeof obj.severity === 'string' ? (obj.severity as string) : 'medium',
      description:
        typeof obj.description === 'string' ? (obj.description as string) : '',
      raw_data: item,
      processed_at: new Date().toISOString(),
    } as ThreatData
  })
}

export function extractPatterns(threatData: ThreatData[]): ThreatPattern[] {
  const groups = threatData.reduce(
    (acc, t) => {
      const key = JSON.stringify({ type: t.type, source: t.source })
      ;(acc[key] = acc[key] || []).push(t)
      return acc
    },
    {} as Record<string, ThreatData[]>,
  )

  const patterns: ThreatPattern[] = []
  for (const [key, items] of Object.entries(groups)) {
    if (items.length < 3) continue
    const { type, source } = JSON.parse(key) as { type: string; source: string }
    const sorted = items
      .slice()
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      )
    const first_seen = Math.min(
      ...sorted.map((s) => new Date(s.timestamp).getTime()),
    )
    const last_seen = Math.max(
      ...sorted.map((s) => new Date(s.timestamp).getTime()),
    )

    patterns.push({
      id: secureId('pattern_'),
      type,
      source,
      frequency: items.length,
      first_seen,
      last_seen,
      confidence: calculatePatternConfidence(sorted),
      description: `Detected pattern of ${type} threats from ${source}`,
      related_threats: sorted.map((s) => s.id),
    } as ThreatPattern)
  }

  return patterns
}

function calculatePatternConfidence(threats: ThreatData[]): number {
  if (threats.length < 3) return 0
  const first = new Date(threats[0].timestamp).getTime()
  const last = new Date(threats[threats.length - 1].timestamp).getTime()
  const timeSpan = Math.max(0, last - first)
  const frequencyScore = Math.min(threats.length / 10, 1)
  const timeSpanScore =
    timeSpan > 0 ? Math.min(timeSpan / (24 * 60 * 60 * 1000), 1) : 0
  return +(frequencyScore * 0.7 + timeSpanScore * 0.3).toFixed(3)
}

export function generateFindings(
  patterns: ThreatPattern[],
  threatData: ThreatData[],
): ThreatFinding[] {
  return patterns.map((pattern) => {
    const related = threatData.filter((t) =>
      pattern.related_threats.includes(t.id),
    )
    const patRec = pattern as unknown as Record<string, unknown>
    const confidence =
      typeof patRec.confidence === 'number' ? (patRec.confidence as number) : 0
    return {
      id: secureId('finding_'),
      pattern_id: pattern.id,
      title: `Pattern: ${pattern.type} from ${pattern.source}`,
      description: pattern.description,
      severity: calculateFindingSeverity(pattern, related),
      confidence,
      related_threats: pattern.related_threats,
      created_at: new Date().toISOString(),
      status: 'new',
    } as ThreatFinding
  })
}

function calculateFindingSeverity(
  pattern: ThreatPattern,
  threats: ThreatData[],
): 'low' | 'medium' | 'high' | 'critical' {
  if (!threats || threats.length === 0) {
    return 'low'
  }
  const severityMap: Record<string, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  }
  const avgSeverity =
    threats.reduce(
      (sum, t) => sum + (severityMap[(t as ThreatData).severity] || 2),
      0,
    ) / threats.length
  const frequencyScore = Math.min(
    ((pattern as ThreatPattern).frequency || 0) / 20,
    1,
  )
  const confidenceScore =
    typeof (pattern as ThreatPattern).confidence === 'number'
      ? ((pattern as ThreatPattern).confidence as number)
      : 0
  const combined =
    avgSeverity * 0.4 + frequencyScore * 0.3 + confidenceScore * 0.3
  if (combined >= 3.5) {
    return 'critical'
  }
  if (combined >= 2.5) {
    return 'high'
  }
  if (combined >= 1.5) {
    return 'medium'
  }
  return 'low'
}

export function filterByTimeRange(
  threatData: ThreatData[],
  startTime: Date,
  endTime: Date,
): ThreatData[] {
  return threatData.filter((t) => {
    const ts = new Date(t.timestamp)
    return ts >= startTime && ts <= endTime
  })
}

export function filterBySeverity(
  threatData: ThreatData[],
  severities: ('low' | 'medium' | 'high' | 'critical')[],
): ThreatData[] {
  return threatData.filter((t) =>
    severities.includes((t as ThreatData).severity),
  )
}

export function filterByType(
  threatData: ThreatData[],
  types: string[],
): ThreatData[] {
  return threatData.filter((t) => types.includes((t as ThreatData).type))
}

export function aggregateThreatStats(threatData: ThreatData[]) {
  const timestamps = threatData
    .map((t) => new Date((t as ThreatData).timestamp).getTime())
    .filter((n) => !isNaN(n))
  const earliest =
    timestamps.length > 0 ? new Date(Math.min(...timestamps)) : null
  const latest =
    timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null
  const stats = {
    total: threatData.length,
    by_type: {} as Record<string, number>,
    by_severity: {} as Record<string, number>,
    by_source: {} as Record<string, number>,
    time_range: { earliest, latest },
  }
  threatData.forEach((threat) => {
    const t = threat as ThreatData
    stats.by_type[t.type] = (stats.by_type[t.type] || 0) + 1
    stats.by_severity[t.severity] = (stats.by_severity[t.severity] || 0) + 1
    stats.by_source[t.source] = (stats.by_source[t.source] || 0) + 1
  })
  return stats
}

export function exportThreatData(
  data: ThreatData[],
  format: 'json' | 'csv' | 'xml',
): string {
  switch (format) {
    case 'json':
      return JSON.stringify(data, null, 2)
    case 'csv': {
      const headers = [
        'id',
        'timestamp',
        'source',
        'type',
        'severity',
        'description',
      ]
      const rows = data.map((threat) => {
        const t = threat as ThreatData
        return [
          t.id,
          t.timestamp,
          t.source,
          t.type,
          t.severity,
          `"${(t.description || '').replace(/"/g, '""')}"`,
        ]
      })
      return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    }
    case 'xml': {
      const xmlItems = data
        .map((threat) => {
          const t = threat as ThreatData
          return `  <threat>\n    <id>${escapeXml(String(t.id || ''))}</id>\n    <timestamp>${escapeXml(String(t.timestamp || ''))}</timestamp>\n    <source>${escapeXml(String(t.source || ''))}</source>\n    <type>${escapeXml(String(t.type || ''))}</type>\n    <severity>${escapeXml(String(t.severity || ''))}</severity>\n    <description>${escapeXml(String(t.description || ''))}</description>\n  </threat>`
        })
        .join('\n')
      return `<?xml version="1.0" encoding="UTF-8"?>\n<threat_data>\n  <count>${data.length}</count>\n  <items>\n${xmlItems}\n  </items>\n</threat_data>`
    }
    default:
      throw new Error(`Unsupported export format: ${format}`)
  }
}
