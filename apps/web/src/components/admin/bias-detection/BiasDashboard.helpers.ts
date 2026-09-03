/**
 * Pure helper functions for BiasDashboard.
 * Extracted from BiasDashboard.tsx to reduce file size and improve testability.
 */

import type { FilterableData } from './BiasDashboard.types'

// ─── Color helpers (pure) ─────────────────────────────────────────────────

/** Alert severity background color (neutral grayscale ramp). */
export const getAlertColor = (level: string): string => {
  switch (level) {
    case 'critical':
      return 'bg-neutral-900'
    case 'high':
      return 'bg-neutral-800'
    case 'medium':
      return 'bg-neutral-700'
    case 'low':
      return 'bg-neutral-600'
    default:
      return 'bg-neutral-500'
  }
}

/** Bias score text color based on severity (neutral grayscale ramp). */
export const getBiasScoreColor = (score: number): string => {
  if (score >= 0.8) return 'text-neutral-900'
  if (score >= 0.6) return 'text-neutral-800'
  if (score >= 0.3) return 'text-neutral-700'
  return 'text-neutral-600'
}

/** Chart series color — zero-chroma grayscale HSL ramp (DESIGN.md). */
export const getChartColors = (index: number, total: number): string => {
  const lightness = 90 - (index * 60) / Math.max(total, 1)
  return `hsl(0, 0%, ${lightness}%)`
}

// ─── Filter functions (refactored to accept params, not closures) ──────────

export interface DateRange {
  start: string
  end: string
}

/** Filter data by time range. Pure — accepts customDateRange as param. */
export const filterDataByTimeRange = (
  data: FilterableData,
  timeRange: string,
  customDateRange?: DateRange,
): FilterableData => {
  if (!data || data.length === 0) return data

  const now = new Date()
  let startTime: Date

  switch (timeRange) {
    case '1h':
      startTime = new Date(now.getTime() - 60 * 60 * 1000)
      break
    case '6h':
      startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000)
      break
    case '24h':
      startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      break
    case '7d':
      startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case '30d':
      startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
    case '90d':
      startTime = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      break
    case 'custom':
      if (customDateRange?.start) {
        startTime = new Date(customDateRange.start)
      } else {
        return data
      }
      break
    default:
      return data
  }

  const endTime =
    timeRange === 'custom' && customDateRange?.end
      ? new Date(customDateRange.end)
      : now

  return data.filter((item) => {
    const itemDate = new Date(item.timestamp ?? item.date ?? '')
    return itemDate >= startTime && itemDate <= endTime
  })
}

/** Filter data by bias score threshold. Pure. */
export const filterDataByBiasScore = (
  data: FilterableData,
  filter: string,
): FilterableData => {
  if (filter === 'all' || !data) return data

  return data.filter((item) => {
    let score = 0
    if ('biasScore' in item && typeof item.biasScore === 'number') {
      score = item.biasScore
    } else if (
      'overallBiasScore' in item &&
      typeof item.overallBiasScore === 'number'
    ) {
      score = item.overallBiasScore
    }
    switch (filter) {
      case 'low':
        return score < 0.3
      case 'medium':
        return score >= 0.3 && score < 0.6
      case 'high':
        return score >= 0.6
      default:
        return true
    }
  })
}

/** Filter data by alert level. Pure. */
export const filterDataByAlertLevel = (
  data: FilterableData,
  filter: string,
): FilterableData => {
  if (filter === 'all' || !data) return data
  return data.filter((item) => {
    const level =
      'level' in item
        ? item.level
        : 'alertLevel' in item
          ? item.alertLevel
          : ''
    return level === filter
  })
}

export interface FilterParams {
  selectedTimeRange: string
  alertLevelFilter: string
  biasScoreFilter: string
  customDateRange?: DateRange
}

/** Apply all filters to data. Pure — accepts all filter params. */
export const getFilteredData = (
  data: FilterableData,
  type: 'trends' | 'alerts' | 'sessions',
  params: FilterParams,
): FilterableData => {
  if (!data) return data

  let filtered = filterDataByTimeRange(data, params.selectedTimeRange, params.customDateRange)

  if (type === 'alerts') {
    filtered = filterDataByAlertLevel(filtered, params.alertLevelFilter)
  }

  if (type === 'sessions' || type === 'trends') {
    filtered = filterDataByBiasScore(filtered, params.biasScoreFilter)
  }

  return filtered
}

// ─── Responsive helpers (pure, accept viewport state) ──────────────────────

export const getResponsiveChartHeight = (
  isMobile: boolean,
  isTablet: boolean,
): number => {
  if (isMobile) return 200
  if (isTablet) return 300
  return 400
}

export const getResponsiveGridCols = (
  defaultCols: number,
  isMobile: boolean,
  isTablet: boolean,
): number => {
  if (isMobile) return 1
  if (isTablet) return Math.min(defaultCols, 2)
  return defaultCols
}
