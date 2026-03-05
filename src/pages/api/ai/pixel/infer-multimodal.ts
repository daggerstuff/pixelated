/**
 * Multimodal Pixel Inference API
 *
 * Accepts text + audio input, forwards to the Pixel multimodal service, and
 * returns fused emotional insights. Supports form-data uploads with optional
 * audio attachment; falls back to text-only inference when audio is absent.
 */

import type { APIRoute, APIContext } from 'astro'
import { applyRateLimit } from '@/lib/api/rate-limit'
import { createAuditLog, AuditEventStatus, AuditEventType } from '@/lib/audit'
import { getSessionFromRequest } from '@/utils/auth'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

const logger = createBuildSafeLogger('pixel-infer-multimodal')

const PIXEL_API_URL = process.env.PIXEL_API_URL || 'http://localhost:8001'
const PIXEL_API_KEY = process.env.PIXEL_API_KEY || ''
const REQUEST_TIMEOUT_MS = 45000
const MAX_AUDIO_BYTES = 25 * 1024 * 1024 // 25MB safety cap

async function forwardToPixel(form: FormData) {
    const headers: Record<string, string> = {}
    if (PIXEL_API_KEY) {
        headers['Authorization'] = `Bearer ${PIXEL_API_KEY}`
    }

    const response = await fetch(`${PIXEL_API_URL}/infer-multimodal`, {
        method: 'POST',
        headers,
        body: form,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Pixel multimodal error: ${response.status} ${errorText}`)
    }

    return response.json() as Promise<Record<string, unknown>>
}

export const POST: APIRoute = async ({ request }: APIContext) => {
    try {
        const session = await getSessionFromRequest(request)
        if (!session?.userId) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        const { result: rateLimitResult } = await applyRateLimit(
            request,
            '/api/ai/pixel/infer-multimodal',
        )
        if (!rateLimitResult.allowed) {
            return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
                status: 429,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        const inbound = await request.formData()
        const text = (inbound.get('text') || '').toString().trim()
        const contextType = (inbound.get('context_type') || 'therapeutic').toString()
        const sessionId = (inbound.get('session_id') || '').toString() || undefined
        const audio = inbound.get('audio')

        if (!text && !audio) {
            return new Response(JSON.stringify({ error: 'Text or audio is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        if (audio && !(audio instanceof File)) {
            return new Response(JSON.stringify({ error: 'Invalid audio payload' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        if (audio instanceof File) {
            if (!audio.type.startsWith('audio/')) {
                return new Response(JSON.stringify({ error: 'Audio must be an audio/* mime type' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                })
            }

            if (audio.size > MAX_AUDIO_BYTES) {
                return new Response(JSON.stringify({ error: 'Audio file too large (max 25MB)' }), {
                    status: 413,
                    headers: { 'Content-Type': 'application/json' },
                })
            }
        }

        const outbound = new FormData()
        if (text) outbound.append('text', text)
        outbound.append('context_type', contextType)
        if (sessionId) outbound.append('session_id', sessionId)
        if (audio instanceof File) {
            outbound.append('audio', audio, audio.name || 'audio.webm')
        }

        const start = performance.now()
        const pixelResponse = await forwardToPixel(outbound)
        const latencyMs = performance.now() - start

        await createAuditLog(
            AuditEventType.AI_OPERATION,
            'multimodal_inference',
            session.userId,
            'pixel-multimodal-api',
            {
                model: 'Pixel Multimodal',
                context_type: contextType,
                session_id: sessionId,
                audio_included: Boolean(audio),
                latency_ms: latencyMs,
            },
            AuditEventStatus.SUCCESS,
        )

        return new Response(
            JSON.stringify({ ...pixelResponse, latency_ms: pixelResponse['latency_ms'] || latencyMs }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            },
        )
    } catch (error: unknown) {
        logger.error('Multimodal inference failed', {
            error: error instanceof Error ? error.message : String(error),
        })

        return new Response(
            JSON.stringify({
                error: 'Multimodal inference failed',
                message: error instanceof Error ? error.message : 'Unknown error',
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            },
        )
    }
}
