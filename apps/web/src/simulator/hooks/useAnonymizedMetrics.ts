import { useState, useCallback } from 'react'

import { TherapeuticTechnique } from '../types'

// Local storage key for metrics
const METRICS_STORAGE_KEY = 'simulator_anonymized_metrics'

// Type for anonymized metrics events
export type MetricsEvent =
  | { type: 'startSession'; domain: string }
  | { type: 'recordTechniques'; techniques: TherapeuticTechnique[] }
  | { type: 'recordFeedback'; feedbackType: string }

// Type for simplified metrics used in the UI
export interface SimpleMetrics {
  sessionCount: number
  averageScore: number
  skillsImproving: string[]
  skillsNeeding: string[]
  lastSessionDate: number | null
  updateMetrics: (event: MetricsEvent) => void
}

type PersistedMetrics = Omit<SimpleMetrics, 'updateMetrics'>

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isPersistedMetrics(value: unknown): value is PersistedMetrics {
  if (!value || typeof value !== 'object') {
    return false
  }

  if (!('sessionCount' in value) || !('averageScore' in value)) {
    return false
  }

  const metrics = value as Record<string, unknown>
  return (
    typeof metrics['sessionCount'] === 'number' &&
    typeof metrics['averageScore'] === 'number' &&
    isStringArray(metrics['skillsImproving']) &&
    isStringArray(metrics['skillsNeeding']) &&
    (metrics['lastSessionDate'] === null ||
      typeof metrics['lastSessionDate'] === 'number')
  )
}

function createInitialMetrics(): PersistedMetrics {
  try {
    const storedMetrics = localStorage.getItem(METRICS_STORAGE_KEY)

    if (storedMetrics) {
      const parsedMetrics: unknown = JSON.parse(storedMetrics)
      if (isPersistedMetrics(parsedMetrics)) {
        return parsedMetrics
      }
    }

    const demoMetrics: PersistedMetrics = {
      sessionCount: 12,
      averageScore: 75,
      skillsImproving: [
        formatTechniqueName(TherapeuticTechnique.REFLECTIVE_STATEMENTS),
        formatTechniqueName(TherapeuticTechnique.OPEN_ENDED_QUESTIONS),
      ],
      skillsNeeding: [
        formatTechniqueName(TherapeuticTechnique.COGNITIVE_RESTRUCTURING),
        formatTechniqueName(TherapeuticTechnique.MINDFULNESS),
      ],
      lastSessionDate: Date.now() - 24 * 60 * 60 * 1000,
    }

    localStorage.setItem(METRICS_STORAGE_KEY, JSON.stringify(demoMetrics))
    return demoMetrics
  } catch (error: unknown) {
    console.error('Failed to load metrics from localStorage:', error)
    return {
      sessionCount: 0,
      averageScore: 0,
      skillsImproving: [],
      skillsNeeding: [],
      lastSessionDate: null,
    }
  }
}

/**
 * Simplified hook for anonymized metrics that provides data for the MetricsDialog.
 *
 * Why this exists:
 * This implementation is focused on the immediate UI needs (displaying simple metrics
 * like session count and average score) rather than maintaining the full complex
 * data model of all user interactions. It caches data in localStorage to persist
 * between sessions for demo purposes.
 *
 * @returns {SimpleMetrics} An object containing the simplified metrics and an update function.
 */
export function useAnonymizedMetrics(): SimpleMetrics {
  const [metrics, setMetrics] = useState<PersistedMetrics>(() =>
    createInitialMetrics(),
  )

  // Update metrics based on events
  const updateMetrics = useCallback((event: MetricsEvent) => {
    // In a real implementation, this would update the metrics in a meaningful way
    setMetrics((currentMetrics) => {
      const updatedMetrics = { ...currentMetrics }

      // Simple updates for demo purposes
      if (event.type === 'startSession') {
        updatedMetrics.sessionCount += 1
        updatedMetrics.lastSessionDate = Date.now()
      }

      // Save to localStorage
      localStorage.setItem(METRICS_STORAGE_KEY, JSON.stringify(updatedMetrics))
      return updatedMetrics
    })
  }, [])

  return {
    ...metrics,
    updateMetrics,
  }
}

/**
 * Format technique enum values to readable text
 * Converts snake_case to Title Case with spaces
 */
function formatTechniqueName(technique: string): string {
  return technique
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}
