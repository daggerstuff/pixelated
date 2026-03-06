/**
 * Threat Data Utilities
 *
 * Consolidated, minimal utilities for processing and analyzing threat data
 * used by the threat-hunting subsystem. This file intentionally keeps a
 * small, well-typed surface area: timestamp parsing, crypto-backed id
 * generation, basic pattern extraction, and export helpers.
 */

import crypto from 'crypto'

import { isObject } from '@/lib/utils'
import { ThreatData, ThreatPattern, ThreatFinding, ThreatSeverity } from '../types'

// crypto-backed stable id generation with safe fallback
function secureId(prefix = ''): string {
  try {
    if (typeof crypto.randomUUID === 'function') {
      return `${prefix}${crypto.randomUUID()}`
    }
    if (typeof crypto.randomBytes === 'function') {
      return `${prefix}${crypto.randomBytes(16).toString('hex')}`
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
  return rawData.map((item, idx) => {
    if (!isObject(item))
      throw new Error(
        `Invalid threat data item at index ${idx}: expected object`,
      )
    const obj = item
    return {
      id: typeof obj['id'] === 'string' ? obj['id'] : secureId('threat_'),
      timestamp: safeParseTimestamp(obj['timestamp']),
      source:
        typeof obj['source'] === 'string' ? obj['source'] : 'unknown',
      type: typeof obj['type'] === 'string' ? obj['type'] : 'unknown',
      severity:
        (typeof obj['severity'] === 'string' ? obj['severity'] : 'medium') as ThreatSeverity,
      description:
        typeof obj['description'] === 'string' ? obj['description'] : '',
      raw_data: item,
      processed_at: new Date().toISOString(),
    }
  })
}

export function extractPatterns(threatData: ThreatData[]): ThreatPattern[] {
  const groups = threatData.reduce<Record<string, ThreatData[]>>(
    (acc, t) => {
      const key = JSON.stringify({ type: t.type, source: t.source })
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(t)
      return acc
    },
    {},
  )

  const patterns: ThreatPattern[] = []
  for (const [key, items] of Object.entries(groups)) {
    if (items.length < 3) continue
    const parsedKey = JSON.parse(key) as { type: string; source: string }
    const { type, source } = parsedKey

    const sorted = [...items].sort(
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
    })
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

    return {
      id: secureId('finding_'),
      pattern_id: pattern.id,
      title: `Pattern: ${pattern.type} from ${pattern.source}`,
      description: pattern.description,
      severity: calculateFindingSeverity(pattern, related),
      confidence: pattern.confidence,
      related_threats: pattern.related_threats,
      created_at: new Date().toISOString(),
      status: 'new',
    }
  })
}

function calculateFindingSeverity(
  pattern: ThreatPattern,
  threats: ThreatData[],
): ThreatSeverity {
  if (!threats || threats.length === 0) {
    return 'low'
  }
  const severityMap: Record<ThreatSeverity, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  }
  const avgSeverity =
    threats.reduce(
      (sum, t) => sum + (severityMap[t.severity] || 2),
      0,
    ) / threats.length

  const frequencyScore = Math.min(pattern.frequency / 20, 1)
  const confidenceScore = pattern.confidence

  const combined =
    avgSeverity * 0.4 + frequencyScore * 0.3 + confidenceScore * 0.3

  if (combined >= 3.5) return 'critical'
  if (combined >= 2.5) return 'high'
  if (combined >= 1.5) return 'medium'
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
  severities: ThreatSeverity[],
): ThreatData[] {
  return threatData.filter((t) =>
    severities.includes(t.severity),
  )
}

export function filterByType(
  threatData: ThreatData[],
  types: string[],
): ThreatData[] {
  return threatData.filter((t) => types.includes(t.type))
}

export function aggregateThreatStats(threatData: ThreatData[]) {
  const timestamps = threatData
    .map((t) => new Date(t.timestamp).getTime())
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
  threatData.forEach((t) => {
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
      const rows = data.map((t) => [
        t.id,
        t.timestamp,
        t.source,
        t.type,
        t.severity,
        `"${(t.description || '').replace(/"/g, '""')}"`,
      ])
      return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    }
    case 'xml': {
      const xmlItems = data
        .map((t) => `  <threat>\n    <id>${escapeXml(t.id)}</id>\n    <timestamp>${escapeXml(t.timestamp)}</timestamp>\n    <source>${escapeXml(t.source)}</source>\n    <type>${escapeXml(t.type)}</type>\n    <severity>${escapeXml(t.severity)}</severity>\n    <description>${escapeXml(t.description)}</description>\n  </threat>`)
        .join('\n')
      return `<?xml version="1.0" encoding="UTF-8"?>\n<threat_data>\n  <count>${data.length}</count>\n  <items>\n${xmlItems}\n  </items>\n</threat_data>`
    }
    default: {
      const unsupported = format as string
      throw new Error(`Unsupported export format: ${unsupported}`)
    }
  }
}
