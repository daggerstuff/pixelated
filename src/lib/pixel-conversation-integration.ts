/**
 * Pixel-Conversation Integration Service
 *
 * Connects Pixel model inference API with the existing conversation system
 * to provide real-time EQ metrics, bias detection, and crisis intervention.
 *
 * Key responsibilities:
 * - Call Pixel inference for each conversation turn
 * - Track EQ metrics across conversation history
 * - Detect and flag bias in responses
 * - Monitor for crisis signals and trigger interventions
 * - Maintain conversation context for multi-turn awareness
 */

import type {
    PixelInferenceRequest,
    PixelInferenceResponse,
    EQScores,
    ConversationMetadata,
} from '@/types/pixel'

export interface ConversationTurn {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: number
    pixelMetrics?: PixelInferenceResponse
}

export interface ConversationIntegrationState {
    sessionId: string
    userId: string
    conversationHistory: ConversationTurn[]
    eqMetricsAggregate: EQMetricsAggregate
    crisisStatus: CrisisDetectionStatus
    biasFlags: BiasFlag[]
    lastPixelAnalysis?: PixelInferenceResponse
    isAnalyzing: boolean
    error?: string
}

export interface EQMetricsAggregate {
    overallEQTrend: number[] // Rolling average of overall_eq scores
    emotionalAwareness: number[] // Per-turn scores
    empathyRecognition: number[]
    emotionalRegulation: number[]
    socialCognition: number[]
    interpersonalSkills: number[]
    turnsAnalyzed: number
}

export interface CrisisDetectionStatus {
    isCrisis: boolean
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
    signals: CrisisSignal[]
    interventionTriggered: boolean
    interventionType?: string
    lastUpdated: number
}

export interface CrisisSignal {
    type: string
    severity: number // 0-1
    detected: string
    confidence: number
}

export interface BiasFlag {
    detected: string
    severity: 'low' | 'medium' | 'high'
    domain: string
    suggestedCorrection?: string
    timestamp: number
}

export interface PixelIntegrationConfig {
    pixelApiUrl?: string
    pixelApiKey?: string
    autoAnalyzeResponses?: boolean
    crisisThreshold?: number
    biasThreshold?: number
    contextWindowSize?: number
    enableMetricsTracking?: boolean
    enableBiasDetection?: boolean
    enableCrisisDetection?: boolean
}

// ============================================================================
// Pixel Conversation Integration Service
// ============================================================================

export class PixelConversationIntegration {
    private state: ConversationIntegrationState
    private config: Required<PixelIntegrationConfig>
    private pixelApiUrl: string

    constructor(config: PixelIntegrationConfig = {}) {
        this.config = {
            pixelApiUrl: config.pixelApiUrl || 'http://localhost:8001',
            pixelApiKey: config.pixelApiKey || '',
            autoAnalyzeResponses: config.autoAnalyzeResponses !== false,
            crisisThreshold: config.crisisThreshold || 0.7,
            biasThreshold: config.biasThreshold || 0.3,
            contextWindowSize: config.contextWindowSize || 10,
            enableMetricsTracking: config.enableMetricsTracking !== false,
            enableBiasDetection: config.enableBiasDetection !== false,
            enableCrisisDetection: config.enableCrisisDetection !== false,
        }

        this.pixelApiUrl = this.config.pixelApiUrl

        this.state = {
            sessionId: '',
            userId: '',
            conversationHistory: [],
            eqMetricsAggregate: {
                overallEQTrend: [],
                emotionalAwareness: [],
                empathyRecognition: [],
                emotionalRegulation: [],
                socialCognition: [],
                interpersonalSkills: [],
                turnsAnalyzed: 0,
            },
            crisisStatus: {
                isCrisis: false,
                riskLevel: 'low',
                signals: [],
                interventionTriggered: false,
                lastUpdated: Date.now(),
            },
            biasFlags: [],
            isAnalyzing: false,
        }
    }

    /**
     * Initialize conversation session
     */
    initializeSession(sessionId: string, userId: string): void {
        this.state.sessionId = sessionId
        this.state.userId = userId
        this.state.conversationHistory = []
        this.state.eqMetricsAggregate = {
            overallEQTrend: [],
            emotionalAwareness: [],
            empathyRecognition: [],
            emotionalRegulation: [],
            socialCognition: [],
            interpersonalSkills: [],
            turnsAnalyzed: 0,
        }
        this.state.crisisStatus = {
            isCrisis: false,
            riskLevel: 'low',
            signals: [],
            interventionTriggered: false,
            lastUpdated: Date.now(),
        }
        this.state.biasFlags = []
    }

    /**
     * Add message to conversation history
     */
    addMessage(role: 'user' | 'assistant', content: string): ConversationTurn {
        const turn: ConversationTurn = {
            id: `turn-${Date.now()}-${Math.random()}`,
            role,
            content,
            timestamp: Date.now(),
        }

        this.state.conversationHistory.push(turn)

        // Keep context window within limit
        if (this.state.conversationHistory.length > this.config.contextWindowSize) {
            this.state.conversationHistory = this.state.conversationHistory.slice(
                -this.config.contextWindowSize
            )
        }

        return turn
    }

    /**
     * Analyze conversation turn with Pixel model
     * Returns EQ metrics, bias detection, and crisis signals
     */
    async analyzeConversationTurn(
        userQuery: string,
        contextType?: string
    ): Promise<PixelInferenceResponse> {
        if (this.state.isAnalyzing) {
            throw new Error('Analysis already in progress')
        }

        this.state.isAnalyzing = true
        this.state.error = undefined

        try {
            const request: PixelInferenceRequest = {
                user_query: userQuery,
                conversation_history: this.state.conversationHistory
                    .map((turn) => ({
                        role: turn.role,
                        content: turn.content,
                        timestamp: new Date(turn.timestamp).toISOString(),
                    })),
                context_type: contextType || 'support',
                user_id: this.state.userId,
                session_id: this.state.sessionId,
                use_eq_awareness: this.config.enableMetricsTracking,
                include_metrics: this.config.enableBiasDetection || this.config.enableCrisisDetection,
                max_tokens: 200,
            }

            const response = await this.callPixelApi(request)

            // Update metrics if enabled
            if (this.config.enableMetricsTracking && response.eq_scores) {
                this.updateEQMetrics(response.eq_scores)
            }

            // Detect bias if enabled
            if (this.config.enableBiasDetection && response.conversation_metadata) {
                this.processBiasDetection(response.conversation_metadata)
            }

            // Check for crisis signals if enabled
            if (this.config.enableCrisisDetection && response.conversation_metadata) {
                this.processCrisisDetection(response.conversation_metadata)
            }

            this.state.lastPixelAnalysis = response

            return response
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            this.state.error = message
            throw error
        } finally {
            this.state.isAnalyzing = false
        }
    }

    /**
     * Get current session state
     */
    getState(): ConversationIntegrationState {
        return { ...this.state }
    }

    /**
     * Get EQ metrics trend
     */
    getEQMetricsTrend(): EQMetricsAggregate {
        return { ...this.state.eqMetricsAggregate }
    }

    /**
     * Get crisis status
     */
    getCrisisStatus(): CrisisDetectionStatus {
        return { ...this.state.crisisStatus }
    }

    /**
     * Get all bias flags
     */
    getBiasFlags(): BiasFlag[] {
        return [...this.state.biasFlags]
    }

    /**
     * Clear bias flags
     */
    clearBiasFlags(): void {
        this.state.biasFlags = []
    }

    /**
     * Reset session
     */
    resetSession(): void {
        this.initializeSession(this.state.sessionId, this.state.userId)
    }

    /**
     * Get conversation history
     */
    getConversationHistory(): ConversationTurn[] {
        return [...this.state.conversationHistory]
    }

    // ========================================================================
    // Private Methods
    // ========================================================================

    /**
     * Call Pixel inference API
     */
    private async callPixelApi(
        request: PixelInferenceRequest
    ): Promise<PixelInferenceResponse> {
        const response = await fetch(`${this.pixelApiUrl}/infer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(this.config.pixelApiKey && {
                    Authorization: `Bearer ${this.config.pixelApiKey}`,
                }),
            },
            body: JSON.stringify(request),
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(
                `Pixel API error: ${error.detail || response.statusText}`
            )
        }

        return response.json() as Promise<PixelInferenceResponse>
    }

    /**
     * Update EQ metrics aggregate
     */
    private updateEQMetrics(eqScores: EQScores): void {
        this.state.eqMetricsAggregate.emotionalAwareness.push(
            eqScores.emotional_awareness
        )
        this.state.eqMetricsAggregate.empathyRecognition.push(
            eqScores.empathy_recognition
        )
        this.state.eqMetricsAggregate.emotionalRegulation.push(
            eqScores.emotional_regulation
        )
        this.state.eqMetricsAggregate.socialCognition.push(eqScores.social_cognition)
        this.state.eqMetricsAggregate.interpersonalSkills.push(
            eqScores.interpersonal_skills
        )
        this.state.eqMetricsAggregate.overallEQTrend.push(eqScores.overall_eq)
        this.state.eqMetricsAggregate.turnsAnalyzed += 1

        // Keep only recent history (last 20 turns)
        const maxHistory = 20
        Object.keys(this.state.eqMetricsAggregate).forEach((key) => {
            const val = this.state.eqMetricsAggregate[key as keyof EQMetricsAggregate]
            if (Array.isArray(val) && val.length > maxHistory) {
                (this.state.eqMetricsAggregate[key as keyof EQMetricsAggregate] as any) =
                    val.slice(-maxHistory)
            }
        })
    }

    /**
     * Process bias detection from metadata
     */
    private processBiasDetection(metadata: ConversationMetadata): void {
        if (metadata.bias_score > this.config.biasThreshold) {
            const flag: BiasFlag = {
                detected: `High bias score: ${metadata.bias_score.toFixed(2)}`,
                severity: metadata.bias_score > 0.6 ? 'high' : 'medium',
                domain: 'response_generation',
                timestamp: Date.now(),
            }

            this.state.biasFlags.push(flag)

            // Keep only recent flags (last 50)
            if (this.state.biasFlags.length > 50) {
                this.state.biasFlags = this.state.biasFlags.slice(-50)
            }
        }
    }

    /**
     * Process crisis detection from metadata
     */
    private processCrisisDetection(metadata: ConversationMetadata): void {
        const crisisSignals = metadata.crisis_signals || []

        if (crisisSignals.length > 0) {
            const signals: CrisisSignal[] = crisisSignals.map((signal) => ({
                type: signal,
                severity: signal === 'immediate_harm' ? 1.0 : 0.7,
                detected: new Date().toISOString(),
                confidence: 0.9,
            }))

            this.state.crisisStatus.signals.push(...signals)

            // Determine risk level
            const maxSeverity = Math.max(...signals.map((s) => s.severity))
            if (maxSeverity >= 1.0) {
                this.state.crisisStatus.riskLevel = 'critical'
            } else if (maxSeverity >= 0.8) {
                this.state.crisisStatus.riskLevel = 'high'
            } else if (maxSeverity >= 0.5) {
                this.state.crisisStatus.riskLevel = 'medium'
            }

            this.state.crisisStatus.isCrisis = true
            this.state.crisisStatus.interventionTriggered = true
            this.state.crisisStatus.interventionType = this.determineInterventionType(
                crisisSignals
            )
            this.state.crisisStatus.lastUpdated = Date.now()
        }
    }

    /**
     * Determine appropriate intervention type
     */
    private determineInterventionType(signals: string[]): string {
        if (signals.includes('immediate_harm')) {
            return 'safety_protocol'
        }
        if (signals.includes('self_harm')) {
            return 'risk_assessment'
        }
        return 'crisis_response'
    }
}

// ============================================================================
// Factory and Singleton
// ============================================================================

let instance: PixelConversationIntegration | null = null

/**
 * Get or create Pixel conversation integration singleton
 */
export function getPixelIntegration(
    config?: PixelIntegrationConfig
): PixelConversationIntegration {
    if (!instance) {
        instance = new PixelConversationIntegration(config)
    }
    return instance
}

/**
 * Create new Pixel conversation integration instance
 */
export function createPixelIntegration(
    config?: PixelIntegrationConfig
): PixelConversationIntegration {
    return new PixelConversationIntegration(config)
}
