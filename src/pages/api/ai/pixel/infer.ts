/**
 * Pixel Model Inference API Endpoints
 *
 * TypeScript API routes for calling the Pixel model inference service.
 * Provides unified interface for conversation generation with EQ awareness,
 * crisis detection, and bias mitigation.
 */

import type { APIRoute, APIContext } from 'astro'
import { getSession } from '@/lib/auth/session'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { applyRateLimit } from '@/lib/api/rate-limit'
import { validateRequestBody } from '@/lib/validation/index'
import { createAuditLog, AuditEventType, AuditEventStatus } from '@/lib/audit'

const logger = createBuildSafeLogger('pixel-inference')

// ============================================================================
// Types
// ============================================================================

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

interface PixelInferenceRequest {
    user_query: string
    conversation_history?: ConversationMessage[]
    context_type?: string
    user_id?: string
    session_id?: string
    use_eq_awareness?: boolean
    include_metrics?: boolean
    max_tokens?: number
}

interface ModelStatusResponse {
    model_loaded: boolean
    model_name: string
    inference_engine: string
    available_features: string[]
    performance_metrics: Record<string, unknown>
    last_inference_time_ms?: number
}

// ============================================================================
// Configuration
// ============================================================================

const PIXEL_API_URL = process.env.PIXEL_API_URL || 'http://localhost:8001'
const PIXEL_API_KEY = process.env.PIXEL_API_KEY || ''
const REQUEST_TIMEOUT_MS = 30000
const MAX_RETRIES = 3

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Call Pixel inference service with error handling and retries
 */
async function callPixelService(
    endpoint: string,
    method: 'GET' | 'POST' = 'POST',
    body?: unknown,
    retries = 0,
): Promise<unknown> {
    try {
        const url = `${PIXEL_API_URL}${endpoint}`
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        }

        if (PIXEL_API_KEY) {
            headers['Authorization'] = `Bearer ${PIXEL_API_KEY}`
        }

        const response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })

        if (!response.ok) {
            const error = await response.text()
            throw new Error(`Pixel API error: ${response.status} ${error}`)
        }

        return await response.json()
    } catch (error) {
        if (retries < MAX_RETRIES) {
            logger.warn(`Pixel API call failed, retrying (${retries + 1}/${MAX_RETRIES})`, {
                error: error instanceof Error ? error.message : String(error),
            })
            // Exponential backoff
            await new Promise((resolve) => setTimeout(resolve, Math.pow(2, retries) * 1000))
            return callPixelService(endpoint, method, body, retries + 1)
        }

        logger.error('Pixel API call failed after retries', {
            endpoint,
            error: error instanceof Error ? error.message : String(error),
        })
        throw error
    }
}

// ============================================================================
// API Routes
// ============================================================================

/**
 * GET /api/ai/pixel/status
 * Get Pixel model status and performance metrics
 */
export const GET: APIRoute = async ({ request }: APIContext) => {
    try {
        const session = await getSession(request)
        if (!session?.user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        // Apply rate limit
        const rateLimitResult = await applyRateLimit(session.user.id, 'pixel-status', 100)
        if (!rateLimitResult.allowed) {
            return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
                status: 429,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        const status = (await callPixelService('/status', 'GET')) as ModelStatusResponse

        // Create audit log
        await createAuditLog({
            userId: session.user.id,
            eventType: AuditEventType.AI_MODEL_ACCESS,
            status: AuditEventStatus.SUCCESS,
            details: { model: 'Pixel', action: 'status_check' },
        })

        return new Response(JSON.stringify(status), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        })
    } catch (error: unknown) {
        logger.error('Failed to get Pixel status', {
            error: error instanceof Error ? error.message : String(error),
        })

        return new Response(
            JSON.stringify({
                error: 'Failed to get Pixel model status',
                message: error instanceof Error ? error.message : 'Unknown error',
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            },
        )
    }
}

/**
 * POST /api/ai/pixel/infer
 * Generate response using Pixel model
 */
export const POST: APIRoute = async ({ request }: APIContext) => {
    try {
        const session = await getSession(request)
        if (!session?.user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        // Apply rate limit
        const rateLimitResult = await applyRateLimit(
            session.user.id,
            'pixel-inference',
            session.user.role === 'admin' ? 120 : session.user.role === 'therapist' ? 80 : 40,
        )
        if (!rateLimitResult.allowed) {
            return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
                status: 429,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        const body = await request.json()

        // Validate request
        const validation = await validateRequestBody(body, {
            user_query: 'string',
            conversation_history: 'array|optional',
            context_type: 'string|optional',
            user_id: 'string|optional',
            use_eq_awareness: 'boolean|optional',
            include_metrics: 'boolean|optional',
        })

        if (!validation.valid) {
            return new Response(JSON.stringify({ error: 'Invalid request', details: validation.errors }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        const pixelRequest: PixelInferenceRequest = {
            user_query: body.user_query,
            conversation_history: body.conversation_history || [],
            context_type: body.context_type,
            user_id: body.user_id || session.user.id,
            session_id: body.session_id,
            use_eq_awareness: body.use_eq_awareness !== false,
            include_metrics: body.include_metrics !== false,
            max_tokens: body.max_tokens || 200,
        }

        // Call Pixel inference service
        const response = (await callPixelService('/infer', 'POST', pixelRequest)) as PixelInferenceResponse

        // Check for crisis signals
        let crisisDetected = false
        if (
            response.conversation_metadata?.crisis_signals &&
            response.conversation_metadata.crisis_signals.length > 0
        ) {
            crisisDetected = true
            logger.warn('Crisis signal detected in Pixel inference', {
                userId: session.user.id,
                signals: response.conversation_metadata.crisis_signals,
            })
        }

        // Create audit log
        await createAuditLog({
            userId: session.user.id,
            eventType: AuditEventType.AI_GENERATION,
            status: crisisDetected ? AuditEventStatus.WARNING : AuditEventStatus.SUCCESS,
            details: {
                model: 'Pixel',
                inference_time_ms: response.inference_time_ms,
                eq_overall: response.eq_scores?.overall_eq,
                persona_mode: response.persona_mode,
                crisis_detected: crisisDetected,
            },
        })

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        })
    } catch (error: unknown) {
        logger.error('Pixel inference failed', {
            error: error instanceof Error ? error.message : String(error),
        })

        return new Response(
            JSON.stringify({
                error: 'Pixel inference failed',
                message: error instanceof Error ? error.message : 'Unknown error',
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            },
        )
    }
}
