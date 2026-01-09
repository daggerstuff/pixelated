/**
 * WebSocket Multimodal Streaming Endpoint
 *
 * Real-time bidirectional streaming for Pixel multimodal inference.
 * Handles incoming audio chunks and text, sends back real-time analysis.
 *
 * Usage:
 *   const ws = new WebSocket('ws://localhost:3000/ws/ai/pixel/multimodal-stream')
 *   ws.onopen = () => {
 *     ws.send(JSON.stringify({
 *       type: 'audio-chunk',
 *       data: audioBuffer,
 *       metadata: { sessionId, chunkIndex }
 *     }))
 *   }
 */

import type { APIRoute } from 'astro'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { getSession } from '@/lib/auth/session'
import { applyRateLimit } from '@/lib/api/rate-limit'

const logger = createBuildSafeLogger('pixel-ws-multimodal')

interface StreamMessage {
    type: 'audio-chunk' | 'text-input' | 'start-session' | 'end-session' | 'ping'
    sessionId: string
    timestamp: number
    data?: {
        chunk?: ArrayBuffer
        text?: string
        metadata?: Record<string, unknown>
    }
}

interface StreamResponse {
    type: 'audio-received' | 'analysis-partial' | 'analysis-complete' | 'error' | 'pong'
    sessionId: string
    timestamp: number
    data?: {
        transcription?: string
        confidence?: number
        emotions?: {
            valence: number
            arousal: number
            dominance: number
        }
        eqScores?: number[]
        biasDetected?: boolean
        biasScore?: number
        error?: string
    }
}

/**
 * Track active WebSocket connections
 */
const activeConnections = new Map<
    string,
    {
        ws: WebSocket
        sessionId: string
        userId: string
        startTime: number
        audioBuffer: Uint8Array
        transcriptionBuffer: string[]
    }
>()

/**
 * Main WebSocket handler for multimodal streaming
 */
export const GET: APIRoute = async context => {
    const session = await getSession(context)

    if (!session?.user) {
        return new Response('Unauthorized', { status: 401 })
    }

    // Rate limiting
    try {
        await applyRateLimit(context, 'pixel-ws', { points: 1 })
    } catch (error) {
        logger.error('Rate limit exceeded', { error })
        return new Response('Too many connections', { status: 429 })
    }

    // Check if the environment supports WebSocket
    if (!context.request.headers.get('upgrade')?.toLowerCase().includes('websocket')) {
        return new Response('Expected WebSocket upgrade', { status: 400 })
    }

    const { socket, response } = Astro.getWebSocket(context)
    const connectionId = crypto.randomUUID()
    const sessionId = context.url.searchParams.get('sessionId') || crypto.randomUUID()

    logger.info('WebSocket connection opened', { connectionId, sessionId, userId: session.user.id })

    // Store connection metadata
    const connectionData = {
        ws: socket,
        sessionId,
        userId: session.user.id,
        startTime: Date.now(),
        audioBuffer: new Uint8Array(),
        transcriptionBuffer: [] as string[],
    }

    activeConnections.set(connectionId, connectionData)

    // Setup message handler
    socket.onmessage = async event => {
        try {
            const message = parseMessage(event.data)

            switch (message.type) {
                case 'start-session':
                    await handleStartSession(socket, message, connectionData)
                    break

                case 'audio-chunk':
                    await handleAudioChunk(socket, message, connectionData)
                    break

                case 'text-input':
                    await handleTextInput(socket, message, connectionData)
                    break

                case 'end-session':
                    await handleEndSession(socket, message, connectionData)
                    break

                case 'ping':
                    sendMessage(socket, {
                        type: 'pong',
                        sessionId: message.sessionId,
                        timestamp: Date.now(),
                    })
                    break

                default:
                    logger.warn('Unknown message type', { type: message.type })
            }
        } catch (error) {
            logger.error('Error processing message', { error })
            sendMessage(socket, {
                type: 'error',
                sessionId: connectionData.sessionId,
                timestamp: Date.now(),
                data: {
                    error: error instanceof Error ? error.message : 'Unknown error',
                },
            })
        }
    }

    // Cleanup on close
    socket.onclose = () => {
        activeConnections.delete(connectionId)
        logger.info('WebSocket connection closed', { connectionId, sessionId })
    }

    socket.onerror = error => {
        logger.error('WebSocket error', { connectionId, sessionId, error })
        activeConnections.delete(connectionId)
    }

    // Set connection timeout (15 minutes)
    setTimeout(() => {
        if (activeConnections.has(connectionId)) {
            socket.close()
            activeConnections.delete(connectionId)
            logger.warn('WebSocket connection timeout', { connectionId, sessionId })
        }
    }, 15 * 60 * 1000)

    return response
}

/**
 * Parse incoming message
 */
function parseMessage(data: string | ArrayBuffer): StreamMessage {
    if (typeof data === 'string') {
        return JSON.parse(data)
    }

    // For binary data (audio chunks), wrap in default message
    return {
        type: 'audio-chunk',
        sessionId: '',
        timestamp: Date.now(),
        data: {
            chunk: data as ArrayBuffer,
        },
    }
}

/**
 * Send message to WebSocket client
 */
function sendMessage(socket: WebSocket, message: StreamResponse) {
    try {
        socket.send(JSON.stringify(message))
    } catch (error) {
        logger.error('Error sending message', { error })
    }
}

/**
 * Handle session start
 */
async function handleStartSession(
    socket: WebSocket,
    message: StreamMessage,
    connectionData: typeof activeConnections extends Map<string, infer T> ? T : never
) {
    logger.info('Session started', { sessionId: message.sessionId })

    connectionData.transcriptionBuffer = []
    connectionData.audioBuffer = new Uint8Array()

    sendMessage(socket, {
        type: 'audio-received',
        sessionId: message.sessionId,
        timestamp: Date.now(),
        data: {
            transcription: 'Session ready for audio streaming',
        },
    })
}

/**
 * Handle incoming audio chunk
 */
async function handleAudioChunk(
    socket: WebSocket,
    message: StreamMessage,
    connectionData: typeof activeConnections extends Map<string, infer T> ? T : never
) {
    if (!message.data?.chunk) {
        logger.warn('Audio chunk missing data')
        return
    }

    const audioData = new Uint8Array(message.data.chunk as ArrayBuffer)
    const previousLength = connectionData.audioBuffer.length
    const newBuffer = new Uint8Array(previousLength + audioData.length)
    newBuffer.set(connectionData.audioBuffer)
    newBuffer.set(audioData, previousLength)
    connectionData.audioBuffer = newBuffer

    logger.debug('Audio chunk received', {
        sessionId: message.sessionId,
        chunkSize: audioData.length,
        totalSize: newBuffer.length,
    })

    // Send acknowledgment
    sendMessage(socket, {
        type: 'audio-received',
        sessionId: message.sessionId,
        timestamp: Date.now(),
        data: {
            transcription: `Received ${audioData.length} bytes`,
        },
    })

    // Simulate real-time transcription/analysis
    // In production, this would send chunks to Whisper/speech recognition service
    if (newBuffer.length > 4096) {
        // Process accumulated audio (simulated)
        await processAudioChunk(socket, message.sessionId, newBuffer.slice(0, 4096))
    }
}

/**
 * Handle text input
 */
async function handleTextInput(
    socket: WebSocket,
    message: StreamMessage,
    connectionData: typeof activeConnections extends Map<string, infer T> ? T : never
) {
    const text = message.data?.text || ''

    if (!text) {
        logger.warn('Empty text input')
        return
    }

    connectionData.transcriptionBuffer.push(text)

    logger.debug('Text input received', {
        sessionId: message.sessionId,
        textLength: text.length,
    })

    // Simulate analysis
    await analyzeText(socket, message.sessionId, text)
}

/**
 * Handle session end
 */
async function handleEndSession(
    socket: WebSocket,
    message: StreamMessage,
    connectionData: typeof activeConnections extends Map<string, infer T> ? T : never
) {
    const fullTranscription = connectionData.transcriptionBuffer.join(' ')

    logger.info('Session ended', {
        sessionId: message.sessionId,
        durationMs: Date.now() - connectionData.startTime,
        audioSize: connectionData.audioBuffer.length,
        transcriptionLength: fullTranscription.length,
    })

    // Send final analysis
    sendMessage(socket, {
        type: 'analysis-complete',
        sessionId: message.sessionId,
        timestamp: Date.now(),
        data: {
            transcription: fullTranscription,
            eqScores: [0.8, 0.75, 0.6, 0.9, 0.7],
            biasDetected: false,
            biasScore: 0.15,
        },
    })
}

/**
 * Process audio chunk (simulated)
 * In production, sends to Whisper/audio emotion service
 */
async function processAudioChunk(socket: WebSocket, sessionId: string, audioBuffer: Uint8Array) {
    try {
        // Simulate speech recognition delay
        await new Promise(resolve => setTimeout(resolve, 100))

        const simulatedTranscription = `Audio segment with ${audioBuffer.length} bytes`

        sendMessage(socket, {
            type: 'analysis-partial',
            sessionId,
            timestamp: Date.now(),
            data: {
                transcription: simulatedTranscription,
                confidence: 0.92,
                emotions: {
                    valence: 0.6,
                    arousal: 0.5,
                    dominance: 0.7,
                },
            },
        })
    } catch (error) {
        logger.error('Error processing audio chunk', { error })

        sendMessage(socket, {
            type: 'error',
            sessionId,
            timestamp: Date.now(),
            data: {
                error: 'Failed to process audio',
            },
        })
    }
}

/**
 * Analyze text input
 */
async function analyzeText(socket: WebSocket, sessionId: string, text: string) {
    try {
        // Simulate analysis delay
        await new Promise(resolve => setTimeout(resolve, 200))

        const eqScores = calculateEQScores(text)
        const { detected: biasDetected, score: biasScore } = detectBias(text)

        sendMessage(socket, {
            type: 'analysis-partial',
            sessionId,
            timestamp: Date.now(),
            data: {
                transcription: text,
                eqScores,
                biasDetected,
                biasScore,
            },
        })
    } catch (error) {
        logger.error('Error analyzing text', { error })

        sendMessage(socket, {
            type: 'error',
            sessionId,
            timestamp: Date.now(),
            data: {
                error: 'Failed to analyze text',
            },
        })
    }
}

/**
 * Calculate EQ scores (simulated)
 */
function calculateEQScores(text: string): number[] {
    // In production, call actual Pixel model
    const positiveWords = ['happy', 'good', 'great', 'excellent', 'love']
    const negativeWords = ['sad', 'bad', 'poor', 'hate', 'angry']
    const empathyWords = ['understand', 'feel', 'sorry', 'support', 'care']

    const textLower = text.toLowerCase()
    const hasPositive = positiveWords.some(w => textLower.includes(w))
    const hasNegative = negativeWords.some(w => textLower.includes(w))
    const hasEmpathy = empathyWords.some(w => textLower.includes(w))

    return [
        hasPositive ? 0.8 : 0.5, // emotional_awareness
        hasEmpathy ? 0.85 : 0.6, // empathy_recognition
        hasNegative ? 0.4 : 0.7, // emotional_regulation
        0.75, // social_awareness
        0.7, // relationship_management
    ]
}

/**
 * Detect bias (simulated)
 */
function detectBias(text: string): { detected: boolean; score: number } {
    // In production, call actual bias detection service
    const biasKeywords = [
        'always',
        'never',
        'typical',
        'natural',
        'born',
        'inherent',
        'stereotype',
        'obviously',
    ]

    const textLower = text.toLowerCase()
    const biasCount = biasKeywords.filter(w => textLower.includes(w)).length

    const score = Math.min(biasCount * 0.15, 1.0)
    const detected = score > 0.3

    return { detected, score }
}

/**
 * Get active connection stats (for monitoring)
 */
export function getConnectionStats() {
    return {
        activeConnections: activeConnections.size,
        totalSessions: Array.from(activeConnections.values()).map(c => c.sessionId),
        uptime: Date.now(),
    }
}
