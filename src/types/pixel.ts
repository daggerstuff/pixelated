/**
 * Pixel Model API Type Definitions
 *
 * Complete TypeScript types for Pixel inference API request/response models
 */

/**
 * Single message in conversation history
 */
export interface PixelConversationMessage {
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp?: string
}

/**
 * Request model for Pixel inference
 */
export interface PixelInferenceRequest {
    /** User query text */
    user_query: string

    /** Prior conversation messages for context */
    conversation_history: PixelConversationMessage[]

    /** Context type: educational, support, crisis, clinical, informational */
    context_type?: string

    /** User identifier for tracking */
    user_id?: string

    /** Session identifier */
    session_id?: string

    /** Enable EQ-aware response generation */
    use_eq_awareness?: boolean

    /** Include quality metrics in response */
    include_metrics?: boolean

    /** Max tokens to generate */
    max_tokens?: number
}

/**
 * EQ measurement scores (0-1 normalized)
 */
export interface EQScores {
    /** Ability to recognize and understand one's own emotions */
    emotional_awareness: number

    /** Ability to recognize and understand others' emotions */
    empathy_recognition: number

    /** Ability to manage and regulate emotional responses */
    emotional_regulation: number

    /** Understanding of social dynamics and interactions */
    social_cognition: number

    /** Ability to manage relationships effectively */
    interpersonal_skills: number

    /** Overall EQ composite score */
    overall_eq: number
}

/**
 * Metadata about conversation analysis
 */
export interface ConversationMetadata {
    /** Detected therapeutic techniques (CBT, DBT, etc.) */
    detected_techniques: string[]

    /** Consistency of technique application (0-1) */
    technique_consistency: number

    /** Bias score in response (0-1, lower is better) */
    bias_score: number

    /** Safety score of response (0-1, higher is better) */
    safety_score: number

    /** Crisis signals detected (empty array if none) */
    crisis_signals?: string[]

    /** Therapeutic effectiveness score (0-1) */
    therapeutic_effectiveness_score: number
}

/**
 * Response model for Pixel inference
 */
export interface PixelInferenceResponse {
    /** Generated response text */
    response: string

    /** Inference time in milliseconds */
    inference_time_ms: number

    /** EQ scores for this turn (if requested) */
    eq_scores?: EQScores

    /** Conversation analysis metadata */
    conversation_metadata?: ConversationMetadata

    /** Detected persona: therapy or assistant */
    persona_mode: 'therapy' | 'assistant'

    /** Confidence in response (0-1) */
    confidence: number

    /** Warning if response exceeded latency targets */
    warning?: string
}

/**
 * Model status information
 */
export interface PixelModelStatus {
    /** Is model loaded and ready */
    model_loaded: boolean

    /** Model name */
    model_name: string

    /** Inference engine (PyTorch, TorchScript, etc.) */
    inference_engine: string

    /** Available features */
    available_features: string[]

    /** Performance metrics */
    performance_metrics: {
        inference_count: number
        average_inference_time_ms?: number
        total_inference_time_ms: number
        device: string
    }

    /** Last inference time in milliseconds */
    last_inference_time_ms?: number
}

/**
 * Health check response
 */
export interface PixelHealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy'
    model_loaded: boolean
    timestamp: string
}

/**
 * Batch inference request
 */
export interface PixelBatchInferenceRequest {
    requests: PixelInferenceRequest[]
}

/**
 * Batch inference response
 */
export interface PixelBatchInferenceResponse {
    results: Array<PixelInferenceResponse | { error: string }>
}

/**
 * API error response
 */
export interface PixelAPIError {
    detail: string
    status_code: number
    error_type?: string
}
