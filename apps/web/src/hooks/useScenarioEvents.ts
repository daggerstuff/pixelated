import { useCallback, useEffect, useRef, useState } from 'react'

export interface Vitals {
  heart_rate?: number
  oxygen_saturation?: number
  blood_pressure_systolic?: number
  blood_pressure_diastolic?: number
  respiratory_rate?: number
  temperature?: number
}

export interface ScenarioEvent {
  updated_vitals?: Vitals
  emotional_state?: string
  branch?: string
}

interface UseScenarioEventsOptions {
  sessionId: string
  wsUrl?: string
  onEvent?: (event: ScenarioEvent) => void
}

type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'

const MAX_RECONNECT_ATTEMPTS = 5
const BASE_RECONNECT_DELAY_MS = 1000

function defaultWsUrl(): string {
  const configured: unknown = import.meta.env.PUBLIC_WS_URL
  if (typeof configured === 'string' && configured.length > 0) {
    return configured
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}`
}

function isValidVitals(value: unknown): value is Vitals {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    (v['heart_rate'] === undefined || typeof v['heart_rate'] === 'number') &&
    (v['oxygen_saturation'] === undefined ||
      typeof v['oxygen_saturation'] === 'number')
  )
}

function parseScenarioEvent(data: unknown): ScenarioEvent | null {
  if (typeof data !== 'object' || data === null) return null
  const d = data as Record<string, unknown>

  // Wire format from the simulation service:
  // { updated_vitals, emotional_state, branch }
  // and the backend ServerMessage form:
  // { type: 'vitals_update', payload: { vitals } }
  let updated_vitals: Vitals | undefined
  let emotional_state: string | undefined
  let branch: string | undefined

  if (typeof d['type'] === 'string' && d['type'] === 'vitals_update') {
    const payload = d['payload']
    if (typeof payload === 'object' && payload !== null) {
      const p = payload as Record<string, unknown>
      if (isValidVitals(p['vitals'])) updated_vitals = p['vitals']
      if (typeof p['emotional_state'] === 'string')
        emotional_state = p['emotional_state']
      if (typeof p['branch'] === 'string') branch = p['branch']
    }
  } else {
    if (isValidVitals(d['updated_vitals'])) updated_vitals = d['updated_vitals']
    if (typeof d['emotional_state'] === 'string')
      emotional_state = d['emotional_state']
    if (typeof d['branch'] === 'string') branch = d['branch']
  }

  if (
    updated_vitals === undefined &&
    emotional_state === undefined &&
    branch === undefined
  ) {
    return null
  }
  return { updated_vitals, emotional_state, branch }
}

export function useScenarioEvents({
  sessionId,
  wsUrl,
  onEvent,
}: UseScenarioEventsOptions) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [latestEvent, setLatestEvent] = useState<ScenarioEvent | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttempts = useRef(0)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onEventRef = useRef<((event: ScenarioEvent) => void) | undefined>(
    undefined,
  )
  const wsUrlRef = useRef(wsUrl)
  const sessionIdRef = useRef(sessionId)

  useEffect(() => {
    onEventRef.current = onEvent
    wsUrlRef.current = wsUrl
    sessionIdRef.current = sessionId
  }, [onEvent, wsUrl, sessionId])

  function connect(): void {
    if (reconnectTimer.current !== null) {
      clearTimeout(reconnectTimer.current)
      reconnectTimer.current = null
    }
    setStatus((prev) => (prev === 'connected' ? prev : 'connecting'))

    try {
      const ws = new WebSocket(
        `${wsUrlRef.current ?? defaultWsUrl()}/sessions/${sessionIdRef.current}/events`,
      )
      wsRef.current = ws

      ws.onopen = () => {
        reconnectAttempts.current = 0
        setStatus('connected')
      }

      ws.onmessage = (e: MessageEvent<string>) => {
        try {
          const event = parseScenarioEvent(JSON.parse(e.data))
          if (event) {
            setLatestEvent(event)
            onEventRef.current?.(event)
          }
        } catch {
          // Non-JSON frame — ignore
        }
      }

      ws.onclose = () => {
        setStatus('reconnecting')
        if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
          setStatus('disconnected')
          return
        }
        const delay = BASE_RECONNECT_DELAY_MS * 2 ** reconnectAttempts.current
        reconnectAttempts.current += 1
        reconnectTimer.current = setTimeout(connect, delay)
      }

      ws.onerror = () => {
        ws.close()
      }
    } catch {
      setStatus('disconnected')
    }
  }

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimer.current !== null) {
        clearTimeout(reconnectTimer.current)
        reconnectTimer.current = null
      }
      const ws = wsRef.current
      if (ws) {
        ws.onclose = null
        ws.close()
      }
    }
  }, [sessionId, wsUrl])

  function reconnect(): void {
    reconnectAttempts.current = 0
    connect()
  }

  return { status, latestEvent, reconnect }
}
