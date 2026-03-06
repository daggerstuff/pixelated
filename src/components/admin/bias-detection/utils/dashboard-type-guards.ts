import type {
  BiasAnalysisResult,
  BiasDashboardSummary,
  BiasDashboardData,
} from '@/lib/ai/bias-detection'

interface TrendItem {
  date?: string
  biasScore?: number
  sessionCount?: number
  alertCount?: number
}

interface AlertItem {
  alertId: string
  message: string
  level: string
  timestamp: string | Date
}

interface BiasAnalysisItem {
  sessionId: string
  overallBiasScore: number
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isExportFormat(value: string): value is 'json' | 'csv' | 'pdf' {
  return value === 'json' || value === 'csv' || value === 'pdf'
}

export function isAlertLevel(
  value: string,
): value is 'all' | 'low' | 'medium' | 'high' | 'critical' {
  return (
    value === 'all' ||
    value === 'low' ||
    value === 'medium' ||
    value === 'high' ||
    value === 'critical'
  )
}

export function isTrendItem(v: unknown): v is TrendItem {
  return (
    isObject(v) &&
    typeof v['date'] === 'string' &&
    typeof v.biasScore === 'number' &&
    typeof v.sessionCount === 'number' &&
    typeof v.alertCount === 'number'
  )
}

export function isTrendItemArray(v: unknown): v is BiasDashboardData['trends'] {
  return Array.isArray(v) && v.every(isTrendItem)
}

export function isAlertItem(v: unknown): v is AlertItem {
  return (
    isObject(v) &&
    typeof v['alertId'] === 'string' &&
    typeof v.message === 'string' &&
    typeof v.level === 'string' &&
    (typeof v['timestamp'] === 'string' || v['timestamp'] instanceof Date)
  )
}

export function isAlertItemArray(v: unknown): v is AlertItem[] {
  return Array.isArray(v) && v.every(isAlertItem)
}

export function isBiasAnalysisResult(v: unknown): v is BiasAnalysisResult {
  return (
    isObject(v) &&
    typeof v['sessionId'] === 'string' &&
    typeof v['overallBiasScore'] === 'number' &&
    typeof v['alertLevel'] === 'string'
  )
}

export function isPartialBiasDashboardSummary(
  v: unknown,
): v is Partial<BiasDashboardSummary> {
  if (!isObject(v)) return false
  const obj = v
  if (obj['totalSessions'] !== undefined && typeof obj['totalSessions'] !== 'number') return false
  if (obj['averageBiasScore'] !== undefined && typeof obj['averageBiasScore'] !== 'number') return false
  if (obj['alertsLast24h'] !== undefined && typeof obj['alertsLast24h'] !== 'number') return false
  if (obj['activeAlerts'] !== undefined && typeof obj['activeAlerts'] !== 'number') return false
  const trendDirection = obj['trendDirection']
  if (
    trendDirection !== undefined &&
    (typeof trendDirection !== 'string' ||
      !['up', 'down', 'stable'].includes(trendDirection))
  ) {
    return false
  }
  return true
}

export function isBiasAnalysisItem(v: unknown): v is BiasAnalysisItem {
  return (
    isObject(v) &&
    typeof v.sessionId === 'string' &&
    typeof v.overallBiasScore === 'number'
  )
}

export function isBiasAnalysisItemArray(v: unknown): v is BiasAnalysisItem[] {
  return Array.isArray(v) && v.every(isBiasAnalysisItem)
}

