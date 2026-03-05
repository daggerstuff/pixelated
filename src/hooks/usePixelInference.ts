/**
 * Pixel Model Client Hook
 *
 * React hook for integrating Pixel model inference into components.
 * Handles loading states, error handling, and real-time response streaming.
 */

import { useState, useCallback, useRef } from 'react'

interface ConversationMessage {
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp?: string
}

interface EQScores {
    emotional_awareness: number
    empathy_recognition: number
    emotional_regulation: number
    social_cognition: number
    interpersonal_skills: number
    overall_eq: number
}

interface ConversationMetadata {
    detected_techniques: string[]
    technique_consistency: number
    bias_score: number
    safety_score: number
    crisis_signals?: string[]
    therapeutic_effectiveness_score: number
}

interface PixelInferenceResponse {
    response: string
    inference_time_ms: number
    eq_scores?: EQScores
    conversation_metadata?: ConversationMetadata
    persona_mode: 'therapy' | 'assistant'
    confidence: number
    warning?: string
}

interface UsePixelInferenceOptions {
    includeMetrics?: boolean
    useEQAwareness?: boolean
    maxTokens?: number
    contextType?: string
}

interface UsePixelInferenceState {
    loading: boolean
    error: Error | null
    response: PixelInferenceResponse | null
    inferenceTime: number | null
}

/**
 * Hook for Pixel model inference
 *
 * @example
 * ```ts
 * const { infer, loading, response, error } = usePixelInference()
 *
 * const handleSubmit = async (query: string) => {
 *   const result = await infer(query, conversationHistory)
 *   console.log(result.response)
 * }
 * ```
 */
export function usePixelInference(options: UsePixelInferenceOptions = {}) {
    const [state, setState] = useState<UsePixelInferenceState>({
        loading: false,
        error: null,
        response: null,
        inferenceTime: null,
    })

    const abortControllerRef = useRef<AbortController | null>(null)

    const infer = useCallback(
        async (
            userQuery: string,
            conversationHistory: ConversationMessage[] = [],
            sessionId?: string,
        ): Promise<PixelInferenceResponse> => {
            // Cancel previous request
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
            }

            abortControllerRef.current = new AbortController()

            setState({
                loading: true,
                error: null,
                response: null,
                inferenceTime: null,
            })

            const startTime = performance.now()

            try {
                const requestBody = {
                    user_query: userQuery,
                    conversation_history: conversationHistory,
                    context_type: options.contextType,
                    session_id: sessionId,
                    use_eq_awareness: options.useEQAwareness !== false,
                    include_metrics: options.includeMetrics !== false,
                    max_tokens: options.maxTokens || 200,
                }

                const response = await fetch('/api/ai/pixel/infer', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                    signal: abortControllerRef.current.signal,
                })

                if (!response.ok) {
                    const errorData = await response.json()
                    throw new Error(
                        errorData.message || `API error: ${response.status}`,
                    )
                }

                const data = (await response.json()) as PixelInferenceResponse
                const endTime = performance.now()
                const totalTime = endTime - startTime

                setState({
                    loading: false,
                    error: null,
                    response: data,
                    inferenceTime: totalTime,
                })

                return data
            } catch (err: unknown) {
                if (err instanceof Error && err.name !== 'AbortError') {
                    setState({
                        loading: false,
                        error: err,
                        response: null,
                        inferenceTime: null,
                    })

                    throw err
                }

                // Request was aborted, don't update state
                return Promise.reject(new Error('Request cancelled'))
            }
        },
        [options],
    )

    const cancel = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
            setState((prev) => ({
                ...prev,
                loading: false,
            }))
        }
    }, [])

    const reset = useCallback(() => {
        setState({
            loading: false,
            error: null,
            response: null,
            inferenceTime: null,
        })
    }, [])

    return {
        infer,
        cancel,
        reset,
        ...state,
    }
}

/**
 * Hook for monitoring EQ metrics across conversations
 */
export function useEQMetrics() {
    const [metrics, setMetrics] = useState<EQScores | null>(null)
    const [history, setHistory] = useState<EQScores[]>([])

    const recordMetrics = useCallback((eqScores: EQScores) => {
        setMetrics(eqScores)
        setHistory((prev) => [...prev, eqScores])
    }, [])

    const getAverageMetrics = useCallback((): EQScores | null => {
        if (history.length === 0) return null

        const sum = history.reduce(
            (acc, scores) => ({
                emotional_awareness: acc.emotional_awareness + scores.emotional_awareness,
                empathy_recognition: acc.empathy_recognition + scores.empathy_recognition,
                emotional_regulation: acc.emotional_regulation + scores.emotional_regulation,
                social_cognition: acc.social_cognition + scores.social_cognition,
                interpersonal_skills: acc.interpersonal_skills + scores.interpersonal_skills,
                overall_eq: acc.overall_eq + scores.overall_eq,
            }),
            {
                emotional_awareness: 0,
                empathy_recognition: 0,
                emotional_regulation: 0,
                social_cognition: 0,
                interpersonal_skills: 0,
                overall_eq: 0,
            },
        )

        return {
            emotional_awareness: sum.emotional_awareness / history.length,
            empathy_recognition: sum.empathy_recognition / history.length,
            emotional_regulation: sum.emotional_regulation / history.length,
            social_cognition: sum.social_cognition / history.length,
            interpersonal_skills: sum.interpersonal_skills / history.length,
            overall_eq: sum.overall_eq / history.length,
        }
    }, [history])

    const reset = useCallback(() => {
        setMetrics(null)
        setHistory([])
    }, [])

    return {
        currentMetrics: metrics,
        metricsHistory: history,
        recordMetrics,
        getAverageMetrics,
        reset,
    }
}

/**
 * Hook for crisis detection across conversations
 */
export function useCrisisDetection() {
    const [crisisSignals, setCrisisSignals] = useState<string[]>([])
    const [isCrisis, setIsCrisis] = useState(false)

    const updateCrisisSignals = useCallback((signals: string[] | undefined) => {
        if (signals && signals.length > 0) {
            setCrisisSignals(signals)
            setIsCrisis(true)
        } else {
            setCrisisSignals([])
            setIsCrisis(false)
        }
    }, [])

    const clearCrisis = useCallback(() => {
        setCrisisSignals([])
        setIsCrisis(false)
    }, [])

    return {
        crisisSignals,
        isCrisis,
        updateCrisisSignals,
        clearCrisis,
    }
}
