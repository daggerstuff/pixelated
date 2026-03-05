import { z } from 'zod';

// Zod schemas for validation and type inference
export const ParticipantDemographicsSchema = z.object({
    age: z.string().optional(),
    gender: z.string().optional(),
    ethnicity: z.string().optional(),
    primary_language: z.string().optional(),
});

export const EmotionDataSchema = z.object({
    session_id: z.string(),
    detected_emotion: z.string(),
    confidence: z.number(),
    context: z.string(),
    participant_demographics: ParticipantDemographicsSchema.optional(),
    response_text: z.string().optional(),
    timestamp: z.string().optional(),
});

export const ValidationResultSchema = z.object({
    success: z.boolean(),
    is_valid: z.boolean(),
    confidence: z.number(),
    issues: z.array(z.string()),
    bias_score: z.number(),
    emotion_consistency: z.number(),
    authenticity_score: z.number(),
    contextual_appropriate: z.boolean(),
    recommendations: z.array(z.string()),
});

export const CrisisSignalSchema = z.object({
    category: z.string(),
    severity: z.number(),
    keywords: z.array(z.string()),
    context: z.string(),
});

export const CrisisResultSchema = z.object({
    success: z.boolean(),
    has_crisis_signal: z.boolean(),
    risk_level: z.string(),
    confidence: z.number(),
    action_required: z.boolean(),
    escalation_protocol: z.array(z.string()),
    signals: z.array(CrisisSignalSchema),
});

export const BiasIndicatorSchema = z.object({
    category: z.string(),
    severity: z.number(),
    evidence: z.array(z.string()),
    affected_group: z.string(),
});

export const BiasResultSchema = z.object({
    success: z.boolean(),
    overall_bias_score: z.number(),
    bias_level: z.string(),
    indicators: z.array(BiasIndicatorSchema),
    recommendations: z.array(z.string()),
    fairness_metrics: z.record(z.number()),
});

export const PIIScrubResultSchema = z.object({
    success: z.boolean(),
    original_length: z.number(),
    scrubbed_text: z.string(),
    scrubbed_length: z.number(),
    error: z.string().optional(),
});

export type EmotionData = z.infer<typeof EmotionDataSchema>;
export type ValidationResult = z.infer<typeof ValidationResultSchema>;
export type CrisisResult = z.infer<typeof CrisisResultSchema>;
export type BiasResult = z.infer<typeof BiasResultSchema>;
export type PIIScrubResult = z.infer<typeof PIIScrubResultSchema>;

export class TherapeuticClient {
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
    }

    private async post<T>(endpoint: string, data: unknown): Promise<T> {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Therapeutic API Request Failed: ${endpoint}`, error);
            throw error;
        }
    }

    async validateEmotion(data: EmotionData): Promise<ValidationResult> {
        return this.post<ValidationResult>('/api/emotion/validate', data);
    }

    async detectCrisis(text: string, sessionId?: string): Promise<CrisisResult> {
        return this.post<CrisisResult>('/api/security/detect-crisis', { text, session_id: sessionId });
    }

    async analyzeBias(data: Record<string, unknown>): Promise<BiasResult> {
        return this.post<BiasResult>('/api/bias/analyze-session', data);
    }

    async scrubPII(text: string, sessionId?: string): Promise<PIIScrubResult> {
        return this.post<PIIScrubResult>('/api/security/scrub-pii', { text, session_id: sessionId });
    }

    async healthCheck(): Promise<{ status: string; service: string; mode: string }> {
        try {
            const response = await fetch(`${this.baseUrl}/health`);
            return await response.json();
        } catch (error) {
            console.error("Health check failed", error);
            throw error;
        }
    }
}

// Singleton instance pointing to VPS
// In production, use env var: import.meta.env.PUBLIC_THERAPEUTIC_API_URL
// For now, defaulting to the known IP
export const therapeuticClient = new TherapeuticClient(
    import.meta.env?.PUBLIC_THERAPEUTIC_API_URL || 'http://3.137.216.156:5000'
);
