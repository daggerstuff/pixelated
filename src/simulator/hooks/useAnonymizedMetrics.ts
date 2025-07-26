import { useState, useEffect, useCallback } from 'react'
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

/**
 * Simplified hook for anonymized metrics that provides data for the MetricsDialog
 * This implementation is focused on the UI needs rather than the full data model
 */
export function useAnonymizedMetrics(): SimpleMetrics {
  const [metrics, setMetrics] = useState<Omit<SimpleMetrics, 'updateMetrics'>>({
    sessionCount: 0,
    averageScore: 0,
    skillsImproving: [],
    skillsNeeding: [],
    lastSessionDate: null,
  })

  // Load metrics from localStorage on mount
  useEffect(() => {
    try {
      const storedMetrics = localStorage.getItem(METRICS_STORAGE_KEY)

      if (storedMetrics) {
        // Use stored metrics if available
        const parsedMetrics = JSON.parse(storedMetrics)
        setMetrics(parsedMetrics)
      } else {
        // Generate demo data for first-time users
        const demoMetrics = {
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
          lastSessionDate: Date.now() - 24 * 60 * 60 * 1000, // 1 day ago
        }

        setMetrics(demoMetrics)
        localStorage.setItem(METRICS_STORAGE_KEY, JSON.stringify(demoMetrics))
      }
    } catch (error) {
      console.error('Failed to load metrics from localStorage:', error)
      // Fall back to default empty metrics
    }
  }, [])

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
