/**
 * useGestaltWebSocket
 *
 * Subscribes to the Pixel API WebSocket and surfaces
 * real-time ``gestalt_update`` events emitted by the Gestalt
 * Fusion Engine (PIX-147 — Live X-Ray Resistance Monitor).
 *
 * The hook manages full connection lifecycle (open → reconnect
 * → close) and guarantees exactly one active socket per
 * sessionId. All emotion / personality scores are validated to
 * [0, 1] before being exposed to consumers.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

// -------------------------------------------------------------------
// Types — mirror GestaltAnalysisResponse from GestaltClient.ts /
//          gestalt_service.py so consumers are fully type-safe.
// -------------------------------------------------------------------

export type CrisisLevel = 'none' | 'elevated' | 'high' | 'acute'

export interface GestaltUpdatePayload {
    defense_label: number
    defense_label_name: string
    defense_confidence: number
    defense_maturity: number | null
    defense_probabilities: Record<string, number>

    plutchik_scores: Record<string, number>
    dominant_emotion: string
    dominant_emotion_intensity: number

    ocean_scores: Record<string, number>

    crisis_level: CrisisLevel
    behavioral_prediction: string
    persona_directive: string
    breakthrough_score: number
}

/** Raw envelope that wraps every server → client WebSocket frame. */
interface GestaltWebSocketFrame {
    type: 'gestalt_update' | 'status' | 'error' | (string & {})
    session_id?: string
    data?: GestaltUpdatePayload
    message?: string
}

export type GestaltConnectionStatus =
    | 'idle'
    | 'connecting'
    | 'connected'
    | 'reconnecting'
    | 'disconnected'
    | 'error'

export interface UseGestaltWebSocketOptions {
    /** Full WebSocket URL, e.g. ws://localhost:8001/ws/gestalt */
    url: string
    /** Scopes the socket to a specific simulation session. */
    sessionId: string
    /** Called on every validated gestalt_update payload. */
    onUpdate?: (payload: GestaltUpdatePayload) => void
    /** Reconnect after this many ms (default: 3000). */
    reconnectDelayMs?: number
    /** Maximum consecutive reconnection attempts (default: 5). */
    maxReconnectAttempts?: number
}

export interface UseGestaltWebSocketResult {
    connectionStatus: GestaltConnectionStatus
    latestPayload: GestaltUpdatePayload | null
    error: string | null
    reconnectCount: number
    disconnect: () => void
    reconnect: () => void
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

/** Clamp all numeric keys of a score map to [0, 1]. */
function sanitiseScores(
    scores: Record<string, number>,
): Record<string, number> {
    const out: Record<string, number> = {}
    for (const [key, raw] of Object.entries(scores)) {
        const val = typeof raw === 'number' ? raw : parseFloat(String(raw))
        out[key] = Number.isFinite(val) ? Math.max(0, Math.min(1, val)) : 0
    }
    return out
}

/** Validate and sanitise a raw gestalt_update payload. */
function validatePayload(
    raw: unknown,
): GestaltUpdatePayload | null {
    if (!raw || typeof raw !== 'object') return null

    const r = raw as Record<string, unknown>

    if (
        typeof r['defense_label'] !== 'number' ||
        typeof r['defense_label_name'] !== 'string' ||
        typeof r['defense_confidence'] !== 'number'
    ) {
        return null
    }

    const validCrisisLevels: CrisisLevel[] = [
        'none',
        'elevated',
        'high',
        'acute',
    ]
    const crisisLevel: CrisisLevel = validCrisisLevels.includes(
        r['crisis_level'] as CrisisLevel,
    )
        ? (r['crisis_level'] as CrisisLevel)
        : 'none'

    return {
        defense_label: r['defense_label'] as number,
        defense_label_name: r['defense_label_name'] as string,
        defense_confidence: Math.max(
            0,
            Math.min(1, r['defense_confidence'] as number),
        ),
        defense_maturity:
            typeof r['defense_maturity'] === 'number'
                ? Math.max(0, Math.min(1, r['defense_maturity']))
                : null,
        defense_probabilities: sanitiseScores(
            (r['defense_probabilities'] as Record<string, number>) ?? {},
        ),
        plutchik_scores: sanitiseScores(
            (r['plutchik_scores'] as Record<string, number>) ?? {},
        ),
        dominant_emotion:
            typeof r['dominant_emotion'] === 'string'
                ? r['dominant_emotion']
                : 'unknown',
        dominant_emotion_intensity: Math.max(
            0,
            Math.min(
                1,
                typeof r['dominant_emotion_intensity'] === 'number'
                    ? r['dominant_emotion_intensity']
                    : 0,
            ),
        ),
        ocean_scores: sanitiseScores(
            (r['ocean_scores'] as Record<string, number>) ?? {},
        ),
        crisis_level: crisisLevel,
        behavioral_prediction:
            typeof r['behavioral_prediction'] === 'string'
                ? r['behavioral_prediction']
                : '',
        persona_directive:
            typeof r['persona_directive'] === 'string'
                ? r['persona_directive']
                : '',
        breakthrough_score: Math.max(
            0,
            Math.min(
                1,
                typeof r['breakthrough_score'] === 'number'
                    ? r['breakthrough_score']
                    : 0,
            ),
        ),
    }
}

// -------------------------------------------------------------------
// Hook
// -------------------------------------------------------------------

export function useGestaltWebSocket({
    url,
    sessionId,
    onUpdate,
    reconnectDelayMs = 3_000,
    maxReconnectAttempts = 5,
}: UseGestaltWebSocketOptions): UseGestaltWebSocketResult {
    const [connectionStatus, setConnectionStatus] =
        useState<GestaltConnectionStatus>('idle')
    const [latestPayload, setLatestPayload] =
        useState<GestaltUpdatePayload | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [reconnectCount, setReconnectCount] = useState(0)

    const wsRef = useRef<WebSocket | null>(null)
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const isMountedRef = useRef(true)
    const reconnectCountRef = useRef(0)

    // Stable callback refs so the socket handler never captures stale closures.
    const onUpdateRef = useRef(onUpdate)
    useEffect(() => {
        onUpdateRef.current = onUpdate
    })

    const clearReconnectTimer = useCallback(() => {
        if (reconnectTimerRef.current !== null) {
            clearTimeout(reconnectTimerRef.current)
            reconnectTimerRef.current = null
        }
    }, [])

    const connect = useCallback(() => {
        if (!isMountedRef.current) return
        if (
            wsRef.current?.readyState === WebSocket.OPEN ||
            wsRef.current?.readyState === WebSocket.CONNECTING
        ) {
            return
        }

        setConnectionStatus('connecting')
        setError(null)

        const ws = new WebSocket(url)
        wsRef.current = ws

        ws.onopen = () => {
            if (!isMountedRef.current) {
                ws.close()
                return
            }
            reconnectCountRef.current = 0
            setReconnectCount(0)
            setConnectionStatus('connected')

            // Send a join frame so the server can scope events to this session.
            ws.send(
                JSON.stringify({
                    type: 'join',
                    session_id: sessionId,
                }),
            )
        }

        ws.onclose = () => {
            if (!isMountedRef.current) return
            setConnectionStatus('disconnected')

            const attempts = reconnectCountRef.current
            if (attempts < maxReconnectAttempts) {
                setConnectionStatus('reconnecting')
                reconnectCountRef.current = attempts + 1
                setReconnectCount(attempts + 1)
                reconnectTimerRef.current = setTimeout(connect, reconnectDelayMs)
            } else {
                setConnectionStatus('error')
                setError(
                    `Failed to reconnect after ${maxReconnectAttempts} attempts.`,
                )
            }
        }

        ws.onerror = () => {
            if (!isMountedRef.current) return
            setError('WebSocket connection error — retrying.')
        }

        ws.onmessage = (event: MessageEvent) => {
            if (!isMountedRef.current) return
            try {
                const frame: GestaltWebSocketFrame = JSON.parse(
                    event.data as string,
                ) as GestaltWebSocketFrame

                if (frame.type !== 'gestalt_update') return

                const payload = validatePayload(frame.data)
                if (!payload) {
                    console.warn(
                        '[useGestaltWebSocket] Received malformed gestalt_update payload',
                        frame.data,
                    )
                    return
                }

                setLatestPayload(payload)
                onUpdateRef.current?.(payload)
            } catch (parseError) {
                console.error(
                    '[useGestaltWebSocket] Failed to parse message:',
                    parseError,
                )
            }
        }
    }, [url, sessionId, reconnectDelayMs, maxReconnectAttempts])

    const disconnect = useCallback(() => {
        clearReconnectTimer()
        reconnectCountRef.current = maxReconnectAttempts // Prevent auto-reconnect.
        wsRef.current?.close()
        setConnectionStatus('disconnected')
    }, [clearReconnectTimer, maxReconnectAttempts])

    const reconnect = useCallback(() => {
        disconnect()
        reconnectCountRef.current = 0
        setReconnectCount(0)
        setError(null)
        connect()
    }, [disconnect, connect])

    // Mount / unmount lifecycle.
    useEffect(() => {
        isMountedRef.current = true
        connect()

        return () => {
            isMountedRef.current = false
            clearReconnectTimer()
            wsRef.current?.close()
        }
    }, [connect, clearReconnectTimer])

    return {
        connectionStatus,
        latestPayload,
        error,
        reconnectCount,
        disconnect,
        reconnect,
    }
}
