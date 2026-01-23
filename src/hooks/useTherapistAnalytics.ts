import { useState, useEffect, useCallback, useRef } from 'react'
import { createBuildSafeLogger } from '../lib/logging/build-safe-logger'
// design tokens mapping is handled externally for chart color literals
// Runtime import (class/value) for AnalyticsError - used for instantiation and instanceof checks
import { AnalyticsError as AnalyticsErrorClass } from '@/types/analytics'
// Type-only imports
import type {
  TherapistAnalyticsChartData,
  AnalyticsFilters,
  TherapistSessionData,
  TherapistSkillProgressData,
  TherapistMetricSummary,
  AnalyticsError as AnalyticsErrorType,
} from '@/types/analytics'
import type { TherapistSession } from '@/types/dashboard'

const _rawLogger = createBuildSafeLogger('use-therapist-analytics')
const normalizeLogger = (raw: unknown) => {
  const safeFn = (fn: unknown, fallback: (...args: any[]) => void) =>
    typeof fn === 'function' ? (fn as (...args: any[]) => any) : fallback

  // If the module mock returned a bare function (e.g. vi.fn()), call it for all
  // log levels but still provide the standard method names.
  if (typeof raw === 'function') {
    const fn = raw as (...args: any[]) => any
    return {
      info: (...args: any[]) => {
        try {
          fn(...args)
        } catch {
          /* swallow */
        }
      },
      warn: (...args: any[]) => {
        try {
          fn(...args)
        } catch {
          /* swallow */
        }
      },
      error: (...args: any[]) => {
        try {
          fn(...args)
        } catch {
          /* swallow */
        }
      },
      debug: (...args: any[]) => {
        try {
          fn(...args)
        } catch {
          /* swallow */
        }
      },
      child: (/* name: string */) => normalizeLogger(raw),
    }
  }

  // If it's an object, pick methods or fall back to console
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, any>
    return {
      info: safeFn(obj['info'], console.info.bind(console)),
      warn: safeFn(obj['warn'], console.warn.bind(console)),
      error: safeFn(obj['error'], console.error.bind(console)),
      debug: safeFn(
        obj['debug'],
        console.debug ? console.debug.bind(console) : console.log.bind(console),
      ),
      child: (name?: string) =>
        normalizeLogger(obj['child'] ? obj['child'](name) : obj),
    }
  }

  // Fallback to console
  return {
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug
      ? console.debug.bind(console)
      : console.log.bind(console),
    child: () => normalizeLogger(console),
  }
}

const logger = normalizeLogger(_rawLogger)

interface UseTherapistAnalyticsResult {
  data: TherapistAnalyticsChartData | null
  isLoading: boolean
  error: AnalyticsErrorType | null
  refetch: () => Promise<void>
  clearError: () => void
}

/**
 * Custom hook for managing therapist-specific analytics data
 */
export function useTherapistAnalytics(
  _filters: AnalyticsFilters,
  sessions: TherapistSession[],
): UseTherapistAnalyticsResult {
  // State management
  const [data, setData] = useState<TherapistAnalyticsChartData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<AnalyticsErrorType | null>(null)

  // Refs for cleanup and refresh loop
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /**
   * Transform session data for therapist analytics
   */
  const transformSessionData = useCallback(
    (sessions: TherapistSession[]): TherapistSessionData[] => {
      // Apply incoming filters (lightweight - detailed filtering delegated to helper)
      const filtered = applyAnalyticsFilters(sessions, _filters)

      return filtered.map((session) => ({
        date: session.startTime,
        sessions: 1,
        therapistSessions: 1,
        averageSessionProgress: session.progress,
        sessionId: session.id,
        therapistId: session.therapistId,
        milestonesAchieved:
          session.progressMetrics?.milestonesReached?.length ?? 0,
        averageResponseTime: session.progressMetrics?.responseTime ?? 0,
      }))
    },
    [_filters],
  )

  /**
   * Transform skill progress data for therapist analytics
   */
  const transformSkillProgressData = useCallback(
    (sessions: TherapistSession[]): TherapistSkillProgressData[] => {
      // Sort sessions by date ascending
      const sorted = [...sessions].sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      )
      // Build per-skill score history
      const perSkill: Record<string, { scores: number[]; sessions: number }> =
        {}
      sorted.forEach((session) => {
        const scores = session.progressMetrics?.skillScores
        if (!scores) {
          return
        }
        Object.entries(scores).forEach(([skill, score]) => {
          if (!perSkill[skill]) {
            perSkill[skill] = { scores: [], sessions: 0 }
          }
          perSkill[skill].scores.push(score)
          perSkill[skill].sessions += 1
        })
      })
      return Object.entries(perSkill).map(([skill, agg]) => {
        const count = agg.scores.length
        const avg = Math.round(
          agg.scores.reduce((a, b) => a + b, 0) / (count || 1),
        )
        const last = count > 0 ? agg.scores[count - 1] : undefined
        const prev = count > 1 ? agg.scores[count - 2] : undefined
        const first = count > 0 ? agg.scores[0] : undefined

        let trend: 'up' | 'down' | 'stable' = 'stable'
        if (typeof last === 'number' && typeof prev === 'number') {
          if (last > prev) {
            trend = 'up'
          } else if (last < prev) {
            trend = 'down'
          } else {
            trend = 'stable'
          }
        }

        const averageImprovement =
          typeof last === 'number' && typeof first === 'number' && count > 1
            ? last - first
            : 0

        return {
          skill,
          skillId: skill.toLowerCase().replace(/\s+/g, '-'),
          score: avg,
          trend,
          category: 'therapeutic',
          sessionsPracticed: agg.sessions,
          averageImprovement,
        }
      })
    },
    [],
  )

  /**
   * Lightweight filter applier - keeps hook decoupled from filter shape.
   * Currently supports timeRange and skillCategory from AnalyticsFilters.
   */
  const applyAnalyticsFilters = (
    allSessions: TherapistSession[],
    filters: AnalyticsFilters,
  ) => {
    // Clone input
    let out = [...allSessions]

    // Time range filter - quick heuristic
    if (filters?.timeRange) {
      const now = Date.now()
      const cutoff = ((): number => {
        switch (filters.timeRange) {
          case '7d':
            return now - 7 * 24 * 60 * 60 * 1000
          case '30d':
            return now - 30 * 24 * 60 * 60 * 1000
          case '90d':
            return now - 90 * 24 * 60 * 60 * 1000
          case '1y':
            return now - 365 * 24 * 60 * 60 * 1000
          default:
            return 0
        }
      })()
      console.log(`DEBUG: now=${new Date(now).toISOString()}, cutoff=${new Date(cutoff).toISOString()}`)
      out = out.filter((s) => {
        const t = new Date(s.startTime).getTime()
        console.log(`DEBUG: session=${s.startTime}, t=${t}, kept=${t >= cutoff}`)
        return t >= cutoff
      })
    }

    // skillCategory placeholder - if provided, filter sessions practicing skills in that category.
    if (filters?.skillCategory && filters.skillCategory !== 'all') {
      out = out.filter((s) => {
        const scores = s.progressMetrics?.skillScores ?? {}
        return Object.keys(scores).some((sk) =>
          sk.toLowerCase().includes(filters.skillCategory!),
        )
      })
    }

    return out
  }

  /**
   * Transform summary stats for therapist analytics
   */
  const transformSummaryStats = useCallback(
    (sessions: TherapistSession[]): TherapistMetricSummary[] => {
      const totalSessions = sessions.length
      const completedSessions = sessions.filter(
        (s) => s.status === 'completed',
      ).length
      const avgProgress =
        sessions.length > 0
          ? Math.round(
            sessions.reduce((sum, s) => sum + s.progress, 0) /
            sessions.length,
          )
          : 0

      const avgDuration =
        sessions.length > 0
          ? Math.round(
            sessions.reduce((sum, s) => {
              const start = new Date(s.startTime)
              const end = s.endTime ? new Date(s.endTime) : new Date()
              return sum + (end.getTime() - start.getTime()) / 1000
            }, 0) / sessions.length,
          )
          : 0

      return [
        {
          value: totalSessions,
          label: 'Total Sessions',
          therapistId: sessions[0]?.therapistId ?? 'unknown',
          trend:
            totalSessions > 0
              ? { value: totalSessions, direction: 'up', period: 'all time' }
              : undefined,
          // Use semantic chart color token mapping; legacy hook consumers expect
          // one of the defined literal names. Map to semantic literal.
          color: 'blue',
        },
        {
          value: avgProgress,
          label: 'Avg Progress',
          therapistId: sessions[0]?.therapistId ?? 'unknown',
          trend:
            avgProgress > 50
              ? { value: avgProgress - 50, direction: 'up', period: 'recent' }
              : undefined,
          color: 'green',
        },
        {
          value: completedSessions,
          label: 'Completed',
          therapistId: sessions[0]?.therapistId ?? 'unknown',
          trend:
            completedSessions > 0
              ? { value: completedSessions, direction: 'up', period: 'recent' }
              : undefined,
          color: 'purple',
        },
        {
          value: avgDuration,
          label: 'Avg Duration (s)',
          therapistId: sessions[0]?.therapistId ?? 'unknown',
          color: 'orange',
        },
      ]
    },
    [],
  )

  /**
   * Generate comparative data for session comparison
   */
  const generateComparativeData = useCallback(
    (sessions: TherapistSession[]) => {
      if (sessions.length < 2) {
        return undefined
      }

      const sortedSessions = [...sessions].sort(
        (a, b) =>
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
      )

      const currentSession = sortedSessions[0]
      const previousSession = sortedSessions[1]

      if (!currentSession || !previousSession) {
        return undefined
      }

      const currentProgress = currentSession.progress ?? 0
      const previousProgress = previousSession.progress ?? 0
      const trend: 'improving' | 'declining' | 'stable' =
        currentProgress > previousProgress
          ? 'improving'
          : currentProgress < previousProgress
            ? 'declining'
            : 'stable'

      const currentSessionData = transformSessionData([currentSession])[0]
      const previousSessionData = transformSessionData([previousSession])[0]

      if (!currentSessionData) {
        return undefined
      }

      return {
        currentSession: currentSessionData,
        previousSession: previousSessionData,
        trend,
      }
    },
    [transformSessionData],
  )

  /**
   * Generate therapist analytics data from sessions
   */
  const generateTherapistData = useCallback((): TherapistAnalyticsChartData => {
    const sessionMetrics = transformSessionData(sessions)
    const skillProgress = transformSkillProgressData(sessions)
    const summaryStats = transformSummaryStats(sessions)
    const comparativeData = generateComparativeData(sessions)

    // Generate progress snapshots from session data
    const progressSnapshots = sessions.flatMap(
      (session) => session.progressSnapshots || [],
    )

    return {
      sessionMetrics,
      skillProgress,
      summaryStats,
      progressSnapshots,
      comparativeData,
    }
  }, [
    sessions,
    transformSessionData,
    transformSkillProgressData,
    transformSummaryStats,
    generateComparativeData,
  ])

  /**
   * Load therapist analytics data
   */
  const loadData = useCallback(
    async (showLoading = true) => {
      try {
        if (showLoading) {
          setIsLoading(true)
        }
        setError(null)

        // Generate data from local sessions (in a real app, this would fetch from API)
        const therapistData = generateTherapistData()
        setData(therapistData)

        logger.info('Therapist analytics data generated successfully')
      } catch (loadError) {
        const message =
          loadError instanceof Error && loadError.message
            ? loadError.message
            : 'Unknown error occurred'
        const analyticsError = new AnalyticsErrorClass(
          'GENERATION_ERROR',
          message,
          loadError,
        )

        setError(analyticsError as unknown as AnalyticsErrorType)
        logger.error('Failed to generate therapist analytics data', {
          error: analyticsError,
        })
      } finally {
        if (showLoading) {
          setIsLoading(false)
        }
      }
    },
    [generateTherapistData],
  )

  /**
   * Manual refetch function
   */
  const refetch = useCallback(async () => {
    await loadData(true)
  }, [loadData])

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  /**
   * Load data when sessions change
   */
  useEffect(() => {
    // Always load data, even if sessions is empty (will result in empty data structure)
    void loadData(true)
  }, [sessions, loadData])

  // Auto-refresh (silent) based on options passed in via filters.config (if present)
  useEffect(() => {
    // Securely extract config from _filters, avoiding unsafe dynamic access
    let config: { enableAutoRefresh?: boolean; refreshInterval?: number } = {}
    if (
      typeof _filters === 'object' &&
      _filters !== null &&
      'config' in _filters &&
      typeof (_filters as any).config === 'object' &&
      (_filters as any).config !== null
    ) {
      const rawConfig = (_filters as any).config
      config.enableAutoRefresh = Boolean(rawConfig.enableAutoRefresh)
      // Only allow safe, finite numbers for refreshInterval
      if (
        typeof rawConfig.refreshInterval === 'number' &&
        Number.isFinite(rawConfig.refreshInterval) &&
        rawConfig.refreshInterval > 0 &&
        rawConfig.refreshInterval < 3600000 // max 1 hour
      ) {
        config.refreshInterval = rawConfig.refreshInterval
      }
    }

    if (!config.enableAutoRefresh || !config.refreshInterval) {
      return
    }

    refreshIntervalRef.current = setInterval(() => {
      // silent refresh: do not toggle isLoading
      void loadData(false)
    }, config.refreshInterval)

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
        refreshIntervalRef.current = null
      }
    }
  }, [(_filters as any).config, loadData, _filters])

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      // Clear refresh interval
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current as unknown as number)
        refreshIntervalRef.current = null
      }
    }
  }, [])

  return {
    data,
    isLoading,
    error,
    refetch,
    clearError,
  }
}
