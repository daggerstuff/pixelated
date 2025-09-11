import { useState, useEffect, useCallback, useRef } from 'react';
import { createBuildSafeLogger } from '../lib/logging/build-safe-logger';
import type {
  TherapistAnalyticsChartData,
  AnalyticsError,
  AnalyticsFilters,
  TherapistSessionData,
 TherapistSkillProgressData,
  TherapistMetricSummary,
} from '@/types/analytics';
import type { TherapistSession } from '@/types/dashboard';

const logger = createBuildSafeLogger('use-therapist-analytics');

interface UseTherapistAnalyticsOptions {
  refreshInterval?: number;
  retryAttempts?: number;
  enableAutoRefresh?: boolean;
}

interface UseTherapistAnalyticsResult {
  data: TherapistAnalyticsChartData | null;
  isLoading: boolean;
  error: AnalyticsError | null;
  refetch: () => Promise<void>;
  clearError: () => void;
}

const DEFAULT_OPTIONS: Required<UseTherapistAnalyticsOptions> = {
  refreshInterval: 300000, // 5 minutes
  retryAttempts: 3,
  enableAutoRefresh: true,
};

/**
 * Custom hook for managing therapist-specific analytics data
 */
export function useTherapistAnalytics(
  filters: AnalyticsFilters,
  sessions: TherapistSession[],
  options: UseTherapistAnalyticsOptions = {}
): UseTherapistAnalyticsResult {
  const config = { ...DEFAULT_OPTIONS, ...options };

  // State management
  const [data, setData] = useState<TherapistAnalyticsChartData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AnalyticsError | null>(null);

  // Refs for cleanup and retry logic
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Transform session data for therapist analytics
   */
  const transformSessionData = useCallback((sessions: TherapistSession[]): TherapistSessionData[] => {
    return sessions.map(session => ({
      date: session.startTime,
      sessions: 1,
      therapistSessions: 1,
      averageSessionProgress: session.progress,
      sessionId: session.id,
      therapistId: session.therapistId,
      milestonesAchieved: session.progressMetrics?.milestonesReached?.length || 0,
      averageResponseTime: session.progressMetrics?.responseTime || 0,
    }));
  }, []);

  /**
   * Transform skill progress data for therapist analytics
   */
  const transformSkillProgressData = useCallback((sessions: TherapistSession[]): TherapistSkillProgressData[] => {
    // Aggregate skill scores from all sessions
    const skillScores: Record<string, { total: number; count: number; sessions: number }> = {};

    sessions.forEach(session => {
      if (session.progressMetrics?.skillScores) {
        Object.entries(session.progressMetrics.skillScores).forEach(([skill, score]) => {
          if (!skillScores[skill]) {
            skillScores[skill] = { total: 0, count: 0, sessions: 0 };
          }
          skillScores[skill].total += score;
          skillScores[skill].count += 1;
          skillScores[skill].sessions += 1;
        });
      }
    });

    return Object.entries(skillScores).map(([skill, data]) => ({
      skill,
      skillId: skill.toLowerCase().replace(/\s+/g, '-'),
      score: Math.round(data.total / data.count),
      trend: data.count > 1 ? 'up' : 'stable', // Simplified trend calculation
      category: 'therapeutic',
      sessionsPracticed: data.sessions,
      averageImprovement: data.count > 1 ? Math.round((data.total / data.count)) : 0,
    }));
  }, []);

  /**
   * Transform summary stats for therapist analytics
   */
  const transformSummaryStats = useCallback((sessions: TherapistSession[]): TherapistMetricSummary[] => {
    const totalSessions = sessions.length;
    const completedSessions = sessions.filter(s => s.status === 'completed').length;
    const avgProgress = sessions.length > 0
      ? Math.round(sessions.reduce((sum, s) => sum + s.progress, 0) / sessions.length)
      : 0;

    const avgDuration = sessions.length > 0
      ? Math.round(sessions.reduce((sum, s) => {
          const start = new Date(s.startTime);
          const end = s.endTime ? new Date(s.endTime) : new Date();
          return sum + (end.getTime() - start.getTime()) / 1000;
        }, 0) / sessions.length)
      : 0;

    return [
      {
        value: totalSessions,
        label: 'Total Sessions',
        therapistId: sessions[0]?.therapistId || 'unknown',
        trend: totalSessions > 0 ? { value: totalSessions, direction: 'up', period: 'all time' } : undefined,
        color: 'blue',
      },
      {
        value: avgProgress,
        label: 'Avg Progress',
        therapistId: sessions[0]?.therapistId || 'unknown',
        trend: avgProgress > 50 ? { value: avgProgress - 50, direction: 'up', period: 'recent' } : undefined,
        color: 'green',
      },
      {
        value: completedSessions,
        label: 'Completed',
        therapistId: sessions[0]?.therapistId || 'unknown',
        trend: completedSessions > 0 ? { value: completedSessions, direction: 'up', period: 'recent' } : undefined,
        color: 'purple',
      },
      {
        value: avgDuration,
        label: 'Avg Duration (s)',
        therapistId: sessions[0]?.therapistId || 'unknown',
        color: 'orange',
      },
    ];
  }, []);

  /**
   * Generate comparative data for session comparison
   */
  const generateComparativeData = useCallback((sessions: TherapistSession[]) => {
    if (sessions.length < 2) return undefined;

    const sortedSessions = [...sessions].sort((a, b) =>
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );

    const currentSession = sortedSessions[0];
    const previousSession = sortedSessions[1];

    const currentProgress = currentSession.progress;
    const previousProgress = previousSession.progress;
    const trend: 'improving' | 'declining' | 'stable' =
      currentProgress > previousProgress ? 'improving' :
      currentProgress < previousProgress ? 'declining' : 'stable';

    return {
      currentSession: transformSessionData([currentSession])[0],
      previousSession: transformSessionData([previousSession])[0],
      trend,
    };
  }, [transformSessionData]);

  /**
   * Generate therapist analytics data from sessions
   */
  const generateTherapistData = useCallback((): TherapistAnalyticsChartData => {
    const sessionMetrics = transformSessionData(sessions);
    const skillProgress = transformSkillProgressData(sessions);
    const summaryStats = transformSummaryStats(sessions);
    const comparativeData = generateComparativeData(sessions);

    // Generate progress snapshots from session data
    const progressSnapshots = sessions.flatMap(session =>
      session.progressSnapshots || []
    );

    return {
      sessionMetrics,
      skillProgress,
      summaryStats,
      progressSnapshots,
      comparativeData,
    };
  }, [sessions, transformSessionData, transformSkillProgressData, transformSummaryStats, generateComparativeData]);

  /**
   * Load therapist analytics data
   */
  const loadData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setIsLoading(true);
      }
      setError(null);

      // Generate data from local sessions (in a real app, this would fetch from API)
      const therapistData = generateTherapistData();
      setData(therapistData);

      logger.info('Therapist analytics data generated successfully');

    } catch (loadError) {
import { AnalyticsError } from '@/lib/services/analytics/analytics-types';

      const analyticsError = new AnalyticsError(
        loadError instanceof Error ? loadError.message : 'Unknown error occurred',
        'GENERATION_ERROR',
        loadError
      );

      setError(analyticsError);
      logger.error('Failed to generate therapist analytics data', { error: analyticsError });
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, [generateTherapistData]);

  /**
   * Manual refetch function
   */
  const refetch = useCallback(async () => {
    await loadData(true);
  }, [loadData]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Load data when sessions change
   */
  useEffect(() => {
    if (sessions.length > 0) {
      loadData(true);
    }
  }, [sessions]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      // Cancel any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Clear timeouts
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }

      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  return {
    data,
    isLoading,
    error,
    refetch,
    clearError,
  };
}
