import { useState, useEffect } from 'react'
import type { ProgressionAnalysis } from '@/lib/ai/temporal/types'

export interface EmotionProgressData {
  currentPeriod: ProgressionAnalysis
  previousPeriod: ProgressionAnalysis
  historicalProgress: Array<{
    date: string
    overallImprovement: number
    stabilityChange: number
    positiveEmotionChange: number
    negativeEmotionChange: number
  }>
  riskFactors: Array<{
    factor: string
    currentLevel: number
    previousLevel: number
    trend: 'improving' | 'worsening' | 'stable'
    priority: 'high' | 'medium' | 'low'
  }>
  goals: Array<{
    name: string
    target: number
    current: number
    progress: number
  }>
}

interface UseEmotionProgressOptions {
  timeRange: 'week' | 'month' | 'quarter' | 'year'
  userId?: string
}

/**
 * Hook for fetching and managing emotion progress data
 *
 * Provides data for visualizing emotional health progress over time
 * with comparison between current and previous periods.
 */
export default function useEmotionProgress({
  timeRange,
  userId,
}: UseEmotionProgressOptions) {
  const [data, setData] = useState<EmotionProgressData | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    async function fetchEmotionProgressData() {
      setIsLoading(true)
      setError(null)

      try {
        // In a real implementation, this would be an API call
        // For now, we'll simulate data fetching with a timeout and mock data
        await new Promise((resolve) => setTimeout(resolve, 1000))

        // Mock data based on timeRange
        const mockData: EmotionProgressData = {
          currentPeriod: {
            overallImprovement: 0.15,
            stabilityChange: -0.08,
            positiveEmotionChange: 0.18,
            negativeEmotionChange: -0.12,
          },
          previousPeriod: {
            overallImprovement: 0.1,
            stabilityChange: -0.05,
            positiveEmotionChange: 0.12,
            negativeEmotionChange: -0.08,
          },
          historicalProgress: generateHistoricalData(timeRange),
          riskFactors: [
            {
              factor: 'Anxiety',
              currentLevel: 0.45,
              previousLevel: 0.65,
              trend: 'improving',
              priority: 'medium',
            },
            {
              factor: 'Sleep Disruption',
              currentLevel: 0.3,
              previousLevel: 0.25,
              trend: 'worsening',
              priority: 'high',
            },
            {
              factor: 'Social Withdrawal',
              currentLevel: 0.2,
              previousLevel: 0.4,
              trend: 'improving',
              priority: 'medium',
            },
            {
              factor: 'Irritability',
              currentLevel: 0.35,
              previousLevel: 0.35,
              trend: 'stable',
              priority: 'low',
            },
          ],
          goals: [
            {
              name: 'Reduce Anxiety',
              target: 0.25,
              current: 0.45,
              progress: 0.55, // 55% of the way from original baseline to target
            },
            {
              name: 'Improve Positive Engagement',
              target: 0.75,
              current: 0.65,
              progress: 0.8, // 80% of the way to target
            },
            {
              name: 'Emotional Regulation',
              target: 0.9,
              current: 0.75,
              progress: 0.75, // 75% of the way to target
            },
            {
              name: 'Consistent Sleep Pattern',
              target: 0.8,
              current: 0.4,
              progress: 0.3, // 30% of the way to target
            },
          ],
        }

        setData(mockData)
      } catch (err) {
        setError(
          err instanceof Error
            ? err
            : new Error('Failed to fetch emotion progress data'),
        )
        console.error('Error fetching emotion progress data:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchEmotionProgressData()
  }, [timeRange, userId])

  return {
    data,
    isLoading,
    error,
  }
}

// Helper function to generate mock historical data
function generateHistoricalData(
  timeRange: 'week' | 'month' | 'quarter' | 'year',
) {
  const dataPoints =
    timeRange === 'week'
      ? 7
      : timeRange === 'month'
        ? 30
        : timeRange === 'quarter'
          ? 12
          : timeRange === 'year'
            ? 12
            : 7

  const result = []

  for (let i = 0; i < dataPoints; i++) {
    // Calculate date label based on time range
    let date: string
    if (timeRange === 'week') {
      // Daily for a week
      const d = new Date()
      d.setDate(d.getDate() - (dataPoints - 1 - i))
      date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } else if (timeRange === 'month') {
      // Daily for a month
      const d = new Date()
      d.setDate(d.getDate() - (dataPoints - 1 - i))
      date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } else if (timeRange === 'quarter') {
      // Weekly for a quarter
      const d = new Date()
      d.setDate(d.getDate() - (dataPoints - 1 - i) * 7)
      date = `Week ${i + 1}`
    } else {
      // Monthly for a year
      const d = new Date()
      d.setMonth(d.getMonth() - (dataPoints - 1 - i))
      date = d.toLocaleDateString('en-US', { month: 'short' })
    }

    // Generate slightly random but trending better data
    const improvement =
      0.05 + (i / dataPoints) * 0.2 + (Math.random() * 0.1 - 0.05)
    const stability =
      -0.02 - (i / dataPoints) * 0.1 + (Math.random() * 0.05 - 0.025)
    const positive =
      0.08 + (i / dataPoints) * 0.15 + (Math.random() * 0.08 - 0.04)
    const negative =
      -0.04 - (i / dataPoints) * 0.12 + (Math.random() * 0.06 - 0.03)

    result.push({
      date,
      overallImprovement: improvement,
      stabilityChange: stability,
      positiveEmotionChange: positive,
      negativeEmotionChange: negative,
    })
  }

  return result
}
