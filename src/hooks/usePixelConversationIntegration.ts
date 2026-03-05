/**
 * usePixelConversationIntegration
 *
 * React hook for integrating Pixel model analysis with conversation system.
 * Manages real-time EQ metrics, bias detection, and crisis intervention.
 *
 * Usage:
 *   const { analyzeMessage, eqMetrics, crisisStatus, biasFlags } =
 *     usePixelConversationIntegration(sessionId, userId)
 *
 *   // In message handler:
 *   await analyzeMessage(userMessage, 'support')
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
    PixelConversationIntegration,
    createPixelIntegration,
    type PixelIntegrationConfig,
    type PixelInferenceResponse,
    type EQMetricsAggregate,
    type CrisisDetectionStatus,
    type BiasFlag,
} from '@/lib/pixel-conversation-integration'

export interface UsePixelConversationIntegrationOptions
    extends PixelIntegrationConfig {
    sessionId: string
    userId: string
    autoInitialize?: boolean
}

export interface UsePixelConversationIntegrationReturn {
    // Analysis methods
    analyzeMessage: (
        message: string,
        contextType?: string
    ) => Promise<PixelInferenceResponse | null>

    // State accessors
    eqMetrics: EQMetricsAggregate | null
    crisisStatus: CrisisDetectionStatus | null
    biasFlags: BiasFlag[]
    lastAnalysis: PixelInferenceResponse | null

    // Loading states
    isAnalyzing: boolean
    error: string | null

    // Control methods
    clearBiasFlags: () => void
    resetSession: () => void
    getConversationHistory: () => Array<{
        id: string
        role: 'user' | 'assistant'
        content: string
        timestamp: number
    }>

    // Direct service access
    integration: PixelConversationIntegration | null
}

/**
 * usePixelConversationIntegration Hook
 *
 * Manages Pixel model integration with conversation system
 */
export function usePixelConversationIntegration(
    options: UsePixelConversationIntegrationOptions
): UsePixelConversationIntegrationReturn {
    const {
        sessionId,
        userId,
        autoInitialize = true,
        ...pixelConfig
    } = options

    // Service reference
    const integrationRef = useRef<PixelConversationIntegration | null>(null)

    // State
    const [eqMetrics, setEQMetrics] = useState<EQMetricsAggregate | null>(null)
    const [crisisStatus, setCrisisStatus] =
        useState<CrisisDetectionStatus | null>(null)
    const [biasFlags, setBiasFlags] = useState<BiasFlag[]>([])
    const [lastAnalysis, setLastAnalysis] =
        useState<PixelInferenceResponse | null>(null)
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Initialize service on mount
    useEffect(() => {
        if (autoInitialize && !integrationRef.current) {
            integrationRef.current = createPixelIntegration(pixelConfig)
            integrationRef.current.initializeSession(sessionId, userId)
        }

        return () => {
            // Cleanup if needed
        }
    }, [autoInitialize, pixelConfig, sessionId, userId])

    // Update session if props change
    useEffect(() => {
        if (integrationRef.current) {
            integrationRef.current.initializeSession(sessionId, userId)
        }
    }, [sessionId, userId])

    // Analyze message
    const analyzeMessage = useCallback(
        async (
            message: string,
            contextType?: string
        ): Promise<PixelInferenceResponse | null> => {
            if (!integrationRef.current) {
                setError('Integration service not initialized')
                return null
            }

            setIsAnalyzing(true)
            setError(null)

            try {
                // Add message to history
                integrationRef.current.addMessage('user', message)

                // Analyze with Pixel
                const response =
                    await integrationRef.current.analyzeConversationTurn(
                        message,
                        contextType
                    )

                // Update state with fresh data
                setEQMetrics(integrationRef.current.getEQMetricsTrend())
                setCrisisStatus(integrationRef.current.getCrisisStatus())
                setBiasFlags(integrationRef.current.getBiasFlags())
                setLastAnalysis(response)

                return response
            } catch (err) {
                const errorMessage =
                    err instanceof Error ? err.message : 'Analysis failed'
                setError(errorMessage)
                console.error('Pixel analysis error:', errorMessage)
                return null
            } finally {
                setIsAnalyzing(false)
            }
        },
        []
    )

    // Clear bias flags
    const clearBiasFlags = useCallback(() => {
        if (integrationRef.current) {
            integrationRef.current.clearBiasFlags()
            setBiasFlags([])
        }
    }, [])

    // Reset session
    const resetSession = useCallback(() => {
        if (integrationRef.current) {
            integrationRef.current.resetSession()
            setEQMetrics(integrationRef.current.getEQMetricsTrend())
            setCrisisStatus(integrationRef.current.getCrisisStatus())
            setBiasFlags([])
            setLastAnalysis(null)
            setError(null)
        }
    }, [])

    // Get conversation history
    const getConversationHistory = useCallback(() => {
        if (!integrationRef.current) {
            return []
        }
        return integrationRef.current.getConversationHistory()
    }, [])

    return {
        analyzeMessage,
        eqMetrics,
        crisisStatus,
        biasFlags,
        lastAnalysis,
        isAnalyzing,
        error,
        clearBiasFlags,
        resetSession,
        getConversationHistory,
        integration: integrationRef.current,
    }
}

/**
 * usePixelEQMetrics Hook
 *
 * Simplified hook for accessing EQ metrics only
 */
export function usePixelEQMetrics(
    sessionId: string,
    userId: string,
    enabled = true
): {
    eqMetrics: EQMetricsAggregate | null
    isLoading: boolean
    refresh: () => void
} {
    const { eqMetrics, integration } = usePixelConversationIntegration({
        sessionId,
        userId,
        autoInitialize: enabled,
        enableMetricsTracking: true,
        enableBiasDetection: false,
        enableCrisisDetection: false,
    })

    const refresh = useCallback(() => {
        if (integration) {
            const metrics = integration.getEQMetricsTrend()
            // State would be updated via the hook's internal mechanism
        }
    }, [integration])

    return {
        eqMetrics,
        isLoading: eqMetrics === null,
        refresh,
    }
}

/**
 * usePixelCrisisDetection Hook
 *
 * Simplified hook for crisis detection and intervention
 */
export function usePixelCrisisDetection(
    sessionId: string,
    userId: string,
    onCrisisDetected?: (status: CrisisDetectionStatus) => void
): {
    crisisStatus: CrisisDetectionStatus | null
    isCrisis: boolean
    riskLevel: string
    signals: Array<{ type: string; severity: number }>
} {
    const { crisisStatus, integration } = usePixelConversationIntegration({
        sessionId,
        userId,
        autoInitialize: true,
        enableCrisisDetection: true,
        enableMetricsTracking: false,
        enableBiasDetection: false,
    })

    useEffect(() => {
        if (crisisStatus?.isCrisis && onCrisisDetected) {
            onCrisisDetected(crisisStatus)
        }
    }, [crisisStatus, onCrisisDetected])

    return {
        crisisStatus,
        isCrisis: crisisStatus?.isCrisis ?? false,
        riskLevel: crisisStatus?.riskLevel ?? 'low',
        signals: crisisStatus?.signals ?? [],
    }
}

/**
 * usePixelBiasDetection Hook
 *
 * Simplified hook for bias detection
 */
export function usePixelBiasDetection(
    sessionId: string,
    userId: string,
    onBiasDetected?: (flags: BiasFlag[]) => void
): {
    biasFlags: BiasFlag[]
    hasBias: boolean
    severeBiasCount: number
    clearFlags: () => void
} {
    const { biasFlags, integration } = usePixelConversationIntegration({
        sessionId,
        userId,
        autoInitialize: true,
        enableBiasDetection: true,
        enableMetricsTracking: false,
        enableCrisisDetection: false,
    })

    useEffect(() => {
        if (biasFlags.length > 0 && onBiasDetected) {
            onBiasDetected(biasFlags)
        }
    }, [biasFlags, onBiasDetected])

    const severeBiasCount = biasFlags.filter(
        (f) => f.severity === 'high'
    ).length

    return {
        biasFlags,
        hasBias: biasFlags.length > 0,
        severeBiasCount,
        clearFlags: () => {
            if (integration) {
                integration.clearBiasFlags()
            }
        },
    }
}
