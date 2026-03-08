/**
 * Pixel Multimodal Streaming WebSocket
 *
 * Provides a lightweight WebSocket server for streaming audio chunks and text
 * to the Pixel multimodal inference service. Clients send:
 *  - { type: 'text', text, contextType?, sessionId? }
 *  - { type: 'chunk', chunk: base64Audio, mimeType?, sessionId? }
 *  - { type: 'complete', text?, contextType?, sessionId? }
 *
 * The server buffers audio chunks up to MAX_AUDIO_BYTES and, on 'complete',
 * forwards the aggregated audio (if any) plus text to PIXEL_API_URL/infer-multimodal.
 * Responses are streamed back as JSON messages:
 *  - { type: 'status', status }
 *  - { type: 'result', data }
 *  - { type: 'error', message }
 */

import { WebSocketServer, WebSocket } from 'ws'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

const logger = createBuildSafeLogger('pixel-multimodal-ws')

const PIXEL_API_URL = process.env.PIXEL_API_URL || 'http://localhost:8001'
const PIXEL_API_KEY = process.env.PIXEL_API_KEY || ''
const WS_PORT = Number(process.env.WS_PIXEL_PORT || 8091)
const REQUEST_TIMEOUT_MS = 45000
const MAX_AUDIO_BYTES = 25 * 1024 * 1024 // 25MB safety cap

interface ClientState {
    sessionId?: string
    contextType?: string
    text?: string
    chunks: Buffer[]
    totalBytes: number
}

let wss: WebSocketServer | null = null

function ensureServer(): WebSocketServer {
    if (wss) return wss

    wss = new WebSocketServer({ port: WS_PORT })

    wss.on('connection', (ws) => {
        const state: ClientState = { chunks: [], totalBytes: 0 }

        ws.send(JSON.stringify({ type: 'status', status: 'connected', port: WS_PORT }))

        ws.on('message', async (data) => {
            try {
                const message = JSON.parse(data.toString()) as Record<string, unknown>
                const type = message.type as string

                switch (type) {
                    case 'text': {
                        state.text = (message.text as string) || ''
                        state.contextType = (message.contextType as string) || 'therapeutic'
                        state.sessionId = (message.sessionId as string) || state.sessionId
                        ws.send(
                            JSON.stringify({
                                type: 'status',
                                status: 'text_received',
                                contextType: state.contextType,
                            }),
                        )
                        break
                    }
                    case 'chunk': {
                        const base64 = (message.chunk as string) || ''
                        const mimeType = (message.mimeType as string) || 'audio/webm'
                        if (!base64) break
                        const buffer = Buffer.from(base64, 'base64')
                        state.totalBytes += buffer.length
                        if (state.totalBytes > MAX_AUDIO_BYTES) {
                            ws.send(
                                JSON.stringify({
                                    type: 'error',
                                    message: 'Audio too large (max 25MB)',
                                }),
                            )
                            ws.close(1009, 'payload too large')
                            return
                        }
                        state.chunks.push(buffer)
                        ws.send(
                            JSON.stringify({
                                type: 'status',
                                status: 'chunk_received',
                                bytes: state.totalBytes,
                                mimeType,
                            }),
                        )
                        break
                    }
                    case 'complete': {
                        const text = (message.text as string) || state.text || ''
                        const contextType =
                            (message.contextType as string) || state.contextType || 'therapeutic'
                        const sessionId = (message.sessionId as string) || state.sessionId
                        await handleComplete(ws, state, { text, contextType, sessionId })
                        break
                    }
                    default: {
                        ws.send(
                            JSON.stringify({ type: 'error', message: 'Unknown message type' }),
                        )
                    }
                }
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Invalid message'
                ws.send(JSON.stringify({ type: 'error', message }))
            }
        })

        ws.on('error', (err) => {
            logger.error('WebSocket error', { error: err })
        })

        ws.on('close', () => {
            state.chunks = []
            state.totalBytes = 0
        })
    })

    logger.info('Pixel multimodal WebSocket server started', { port: WS_PORT })
    return wss
}

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

async function handleComplete(
    ws: WebSocket,
    state: ClientState,
    {
        text,
        contextType,
        sessionId,
    }: { text: string; contextType: string; sessionId?: string }
) {
    try {
        ws.send(
            JSON.stringify({ type: 'status', status: 'processing', contextType, sessionId }),
        )

        const form = new FormData()
        if (text) form.append('text', text)
        form.append('context_type', contextType)
        if (sessionId) form.append('session_id', sessionId)

        if (state.chunks.length > 0) {
            const buffer = Buffer.concat(state.chunks)
            const blob = new Blob([buffer], { type: 'audio/webm' })
            form.append('audio', blob, 'stream.webm')
        }

        const start = performance.now()
        const pixelResponse = await forwardToPixel(form)
        const latencyMs = performance.now() - start

        ws.send(
            JSON.stringify({
                type: 'result',
                data: { ...pixelResponse, latency_ms: pixelResponse['latency_ms'] || latencyMs },
            }),
        )

        // reset buffered audio after a successful call
        state.chunks = []
        state.totalBytes = 0
        state.text = ''
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Inference failed'
        ws.send(JSON.stringify({ type: 'error', message }))
    }
}

// GET handler: ensures server is initialized and returns status
export const GET = async () => {
    const server = ensureServer()
    const clientCount = server.clients.size
    return new Response(
        JSON.stringify({
            success: true,
            status: 'listening',
            port: WS_PORT,
            clients: clientCount,
        }),
        {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        },
    )
}

// POST handler: allows programmatic shutdown (optional)
export const POST = async ({ request }: { request: Request }) => {
    const body = await request.json().catch(() => ({}))
    if (body.action === 'stop' && wss) {
        wss.close()
        wss = null
        return new Response(JSON.stringify({ success: true, stopped: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    return new Response(JSON.stringify({ success: true, message: 'noop' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    })
}

// Initialize immediately on import for environments where GET is not hit first
ensureServer()
