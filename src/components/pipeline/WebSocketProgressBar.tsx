import React, { useEffect, useMemo, useState } from 'react'

type ProgressMessage = {
  type: 'progress_update' | 'status_update'
  executionId?: string
  data?: unknown
}

function isProgressMessage(obj: unknown): obj is ProgressMessage {
  if (typeof obj !== 'object' || obj === null) return false
  const o = obj as Record<string, unknown>
  return (
    typeof o['type'] === 'string' &&
    (o['type'] === 'progress_update' || o['type'] === 'status_update')
  )
}

export function WebSocketProgressBar(props: {
  executionId: string
  webSocket?: WebSocket | null
  onProgressUpdate?: (progress: number, stage?: string) => void
  showMetrics?: boolean
  autoReconnect?: boolean
  reconnectDelay?: number
  connectionAttempts?: number
}) {
  const {
    executionId,
    webSocket = null,
    onProgressUpdate = () => {},
    showMetrics = false,
    connectionAttempts = 0,
  } = props
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('initializing')
  const [statusText, setStatusText] = useState('connecting')

  useEffect(() => {
    if (!webSocket) {
      setStatusText('disconnected')
      return
    }

    const handleMessage = (ev: MessageEvent<unknown>) => {
      try {
        const parsed =
          typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data
        if (!isProgressMessage(parsed)) return
        const msg = parsed
        if (msg.executionId && msg.executionId !== executionId) return
        if (msg.type === 'progress_update') {
          const data = msg.data as Record<string, unknown> | undefined
          const p = Number(
            (data?.['progress'] as number) ?? Number(data?.['progress'] ?? 0),
          )
          const st = (data?.['stage'] as string) ?? ''
          setProgress(p)
          setStage(st)
          onProgressUpdate(p, st)
        } else if (msg.type === 'status_update') {
          const status =
            ((msg.data as Record<string, unknown> | undefined)?.[
              'status'
            ] as string) ?? ''
          setStatusText(status)
        }
      } catch (err) {
        // swallow parse errors
        // eslint-disable-next-line no-console
        console.error('Failed to parse WebSocket message:', err)
      }
    }

    const handleOpen = () => setStatusText('live updates')
    const handleError = () => setStatusText('connection error')
    const handleClose = () => setStatusText('disconnected')

    webSocket.addEventListener('message', handleMessage)
    webSocket.addEventListener('open', handleOpen)
    webSocket.addEventListener('error', handleError)
    webSocket.addEventListener('close', handleClose)

    return () => {
      webSocket.removeEventListener('message', handleMessage)
      webSocket.removeEventListener('open', handleOpen)
      webSocket.removeEventListener('error', handleError)
      webSocket.removeEventListener('close', handleClose)
    }
  }, [webSocket, executionId, onProgressUpdate])

  const progressColor = useMemo(() => {
    if (progress < 40) return 'bg-orange-500'
    if (progress < 60) return 'bg-yellow-500'
    if (progress < 80) return 'bg-blue-500'
    return 'bg-green-500'
  }, [progress])

  return (
    <div>
      <div>WebSocket status</div>
      <div role="status">{statusText}</div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
        aria-valuetext={`${stage} ${progress.toFixed(1)}%`}
      >
        <div
          className={`h-3 rounded-full ${progressColor}`}
          style={{ width: `${progress}%` }}
          data-testid="progress-fill"
        />
      </div>
      <div>{progress.toFixed(1)}%</div>
      <div>{stage}</div>
      {showMetrics && (
        <div>
          <div>Updates per second</div>
          <div data-testid="trending-up-icon">^</div>
        </div>
      )}
      {connectionAttempts ? (
        <div>Reconnection attempt {connectionAttempts}/5</div>
      ) : null}
    </div>
  )
}

export function WebSocketConnectionManager(props: {
  url: string
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (err: unknown) => void
  onMessage?: (msg: unknown) => void
  maxRetries?: number
  retryDelay?: number
}) {
  const { url } = props
  const [socket, setSocket] = useState<WebSocket | null>(null)

  const handleConnect = () => {
    const ws = new WebSocket(url)
    setSocket(ws)
  }

  const handleDisconnect = () => {
    if (socket) socket.close()
    setSocket(null)
  }

  return (
    <div>
      <div>WebSocket Connection Manager</div>
      <button onClick={handleConnect}>Connect</button>
      <button onClick={handleDisconnect}>Disconnect</button>
    </div>
  )
}

type MessageRecord = {
  id?: string
  timestamp?: Date
  type?: 'sent' | 'received' | string
  data?: unknown
  executionId?: string
}

export function WebSocketMessageLogger(props: {
  messages: Array<MessageRecord>
  maxMessages?: number
  autoScroll?: boolean
}) {
  const { messages = [], maxMessages = 100 } = props
  const shown = messages.slice(0, maxMessages)

  if (messages.length === 0) {
    return <div>No messages yet</div>
  }

  return (
    <div>
      <div>WebSocket message log</div>
      <div>
        Showing {shown.length} of {messages.length} messages
      </div>
      <ul>
        {shown.map((m) => (
          <li key={m.id}>
            {m.type} - {JSON.stringify(m.data).toLowerCase()}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default WebSocketProgressBar
