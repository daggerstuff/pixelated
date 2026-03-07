import { useEffect, useRef, useState, useCallback } from 'react'
import { FeedbackService } from '../services/FeedbackService'
import type { EmotionState, SpeechPattern, DetectedTechnique } from '../types'

// Ensure FeedbackService implements our interface
declare module '../services/FeedbackService' {
  // Extend the interface with the required methods instead of using empty interface
  interface FeedbackService {
    getEmotionState(): EmotionState
    getSpeechPatterns(): SpeechPattern[]
    getDetectedTechniques(): DetectedTechnique[]
    stopProcessing(): void
    updateConsent(hasConsent: boolean): void
    on(event: 'error', callback: (data: Error) => void): void
    on(event: 'connectionChange', callback: (data: boolean) => void): void
  }
}

export interface RealTimeAnalysisState {
  isConnected: boolean
  isProcessing: boolean
  emotionState: EmotionState
  speechPatterns: SpeechPattern[]
  detectedTechniques: DetectedTechnique[]
  lastError: string | null
}

const INITIAL_STATE: RealTimeAnalysisState = {
  isConnected: false,
  isProcessing: false,
  emotionState: {
    energy: 0,
    valence: 0,
    dominance: 0,
    trends: [],
  },
  speechPatterns: [],
  detectedTechniques: [],
  lastError: null,
}

export function useRealTimeAnalysis() {
  const [state, setState] = useState<RealTimeAnalysisState>(INITIAL_STATE)
  const feedbackServiceRef = useRef<FeedbackService | null>(null)
  const updateIntervalRef = useRef<number | null>(null)

  // Initialize feedback service
  useEffect(() => {
    feedbackServiceRef.current = new FeedbackService()
    return () => {
      if (updateIntervalRef.current) {
        window.clearInterval(updateIntervalRef.current)
      }
    }
  }, [])

  // Start real-time analysis
  const startAnalysis = useCallback(async () => {
    if (!feedbackServiceRef.current) {
      setState((prev) => ({
        ...prev,
        lastError: 'Feedback service not initialized',
      }))
      return
    }

    try {
      setState((prev) => ({ ...prev, isProcessing: true, lastError: null }))

      // Start update interval for smooth UI updates
      updateIntervalRef.current = window.setInterval(() => {
        if (feedbackServiceRef.current) {
          const service = feedbackServiceRef.current
          setState((prev) => ({
            ...prev,
            isConnected: true,
            emotionState: service.getEmotionState(),
            speechPatterns: service.getSpeechPatterns(),
            detectedTechniques: service.getDetectedTechniques(),
          }))
        }
      }, 100) // Update UI every 100ms for smooth transitions

      // Subscribe to error events
      feedbackServiceRef.current.on('error', (error: Error) => {
        setState((prev) => ({ ...prev, lastError: String(error) }))
      })

      // Subscribe to connection status changes
      feedbackServiceRef.current.on(
        'connectionChange',
        (isConnected: boolean) => {
          setState((prev) => ({ ...prev, isConnected }))
        },
      )
    } catch (error: unknown) {
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        lastError:
          error instanceof Error ? String(error) : 'Failed to start analysis',
      }))
    }
  }, [])

  // Stop real-time analysis
  const stopAnalysis = useCallback(() => {
    if (updateIntervalRef.current) {
      window.clearInterval(updateIntervalRef.current)
      updateIntervalRef.current = null
    }

    if (feedbackServiceRef.current) {
      feedbackServiceRef.current.stopProcessing()
    }

    setState((prev) => ({
      ...prev,
      isProcessing: false,
      isConnected: false,
    }))
  }, [])

  // Reset analysis state
  const resetAnalysis = useCallback(() => {
    stopAnalysis()
    setState(INITIAL_STATE)
  }, [stopAnalysis])

  // Update consent status
  const updateConsent = useCallback((hasConsent: boolean) => {
    if (feedbackServiceRef.current) {
      feedbackServiceRef.current.updateConsent(hasConsent)
    }
  }, [])

  return {
    ...state,
    startAnalysis,
    stopAnalysis,
    resetAnalysis,
    updateConsent,
  }
}
