import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WebSocket, WebSocketServer } from 'ws'
import { TrainingWebSocketServer } from '../TrainingWebSocketServer'
import * as jwtService from '../../../auth/jwt-service'

const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }
}))

vi.mock('ws', () => {
  const mockServer = {
    on: vi.fn(),
    close: vi.fn(),
    clients: new Set(),
  }

  const MockWS = vi.fn().mockImplementation(function() {
    return {
      on: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
      readyState: 1,
    }
  })
  // @ts-ignore
  MockWS.OPEN = 1
  // @ts-ignore
  MockWS.CLOSED = 3

  return {
    WebSocketServer: vi.fn().mockImplementation(function() {
      return mockServer
    }),
    WebSocket: MockWS,
  }
})

vi.mock('../../../auth/jwt-service', () => ({
  validateToken: vi.fn(),
}))

vi.mock('../../../logging/build-safe-logger', () => ({
  createBuildSafeLogger: () => mockLogger,
}))

describe('TrainingWebSocketServer', () => {
  let server: TrainingWebSocketServer
  let mockWss: any

  beforeEach(() => {
    vi.clearAllMocks()
    server = new TrainingWebSocketServer(8084)
    // @ts-ignore
    mockWss = vi.mocked(WebSocketServer).mock.results[0].value
  })

  const authenticateClient = async (ws: any, userId: string, role: string) => {
    const connectionHandler = mockWss.on.mock.calls.find(c => c[0] === 'connection')[1]

    vi.mocked(jwtService.validateToken).mockResolvedValue({
      valid: true,
      userId,
      role: role as any
    })

    connectionHandler(ws, { url: `/?token=${userId}`, headers: {} })

    // Wait for async auth to complete
    await new Promise(resolve => {
      const start = Date.now()
      const interval = setInterval(() => {
        if (ws.send.mock.calls.some(call => call[0].includes('authenticated'))) {
          clearInterval(interval)
          resolve(null)
        }
        if (Date.now() - start > 1000) {
          clearInterval(interval)
          resolve(null)
        }
      }, 10)
    })
  }

  const getHandler = (ws: any, type: string) => {
    const call = ws.on.mock.calls.find(c => c[0] === type)
    return call ? call[1] : null
  }

  const joinSession = (ws: any, sessionId: string, role: string, userId: string) => {
    const handler = getHandler(ws, 'message')
    if (!handler) throw new Error('No message handler')
    handler(Buffer.from(JSON.stringify({
      type: 'join_session',
      payload: { sessionId, role, userId }
    })))
  }

  const sendMessage = (ws: any, content: string, role: string = 'therapist') => {
    const handler = getHandler(ws, 'message')
    if (!handler) throw new Error('No message handler')
    handler(Buffer.from(JSON.stringify({
      type: 'session_message',
      payload: { content, role }
    })))
  }

  it('should assign session owner to the first trainee who joins', async () => {
    const ws1 = new WebSocket('ws://localhost') as any
    await authenticateClient(ws1, 'user-1', 'trainee')
    joinSession(ws1, 'session-1', 'trainee', 'user-1')

    expect(ws1.send).toHaveBeenCalledWith(expect.stringContaining('session_joined'))

    sendMessage(ws1, 'Hello')
    expect(ws1.send).toHaveBeenCalledWith(expect.stringContaining('session_message'))
  })

  it('should not allow non-owner trainee to send messages', async () => {
    const ws1 = new WebSocket('ws://localhost') as any
    await authenticateClient(ws1, 'user-1', 'trainee')
    joinSession(ws1, 'session-1', 'trainee', 'user-1')

    const ws2 = new WebSocket('ws://localhost') as any
    await authenticateClient(ws2, 'user-2', 'trainee')
    joinSession(ws2, 'session-1', 'trainee', 'user-2')

    sendMessage(ws2, 'Unauthorized')

    const lastCall = ws2.send.mock.calls[ws2.send.mock.calls.length - 1][0]
    expect(lastCall).toContain('error')
    expect(lastCall).toContain('Only the session owner or a supervisor can send messages')
  })

  it('should allow supervisor to send messages even if not owner', async () => {
    const ws1 = new WebSocket('ws://localhost') as any
    await authenticateClient(ws1, 'user-1', 'trainee')
    joinSession(ws1, 'session-1', 'trainee', 'user-1')

    const ws2 = new WebSocket('ws://localhost') as any
    await authenticateClient(ws2, 'user-2', 'therapist')
    joinSession(ws2, 'session-1', 'supervisor', 'user-2')

    sendMessage(ws2, 'Supervisor message')

    const lastCall = ws2.send.mock.calls[ws2.send.mock.calls.length - 1][0]
    expect(lastCall).not.toContain('error')
    expect(lastCall).toContain('session_message')
  })

  it('should allow trainee to become owner even if supervisor joined first', async () => {
    const wsSupervisor = new WebSocket('ws://localhost') as any
    await authenticateClient(wsSupervisor, 'supervisor-1', 'therapist')
    joinSession(wsSupervisor, 'session-2', 'supervisor', 'supervisor-1')

    const wsTrainee = new WebSocket('ws://localhost') as any
    await authenticateClient(wsTrainee, 'trainee-1', 'trainee')
    joinSession(wsTrainee, 'session-2', 'trainee', 'trainee-1')

    sendMessage(wsTrainee, 'Hello from trainee')
    const lastCall = wsTrainee.send.mock.calls[wsTrainee.send.mock.calls.length - 1][0]
    expect(lastCall).toContain('session_message')
    expect(lastCall).not.toContain('error')
  })

  it('should clean up session state when all participants leave', async () => {
    const ws1 = new WebSocket('ws://localhost') as any
    await authenticateClient(ws1, 'user-1', 'trainee')
    joinSession(ws1, 'session-3', 'trainee', 'user-1')

    // Disconnect
    const closeHandler = getHandler(ws1, 'close')
    closeHandler()

    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Cleaned up session state'), expect.anything())
  })

  it('should block messages from muted users', async () => {
    const ws1 = new WebSocket('ws://localhost') as any
    await authenticateClient(ws1, 'user-1', 'trainee')
    joinSession(ws1, 'session-1', 'trainee', 'user-1')

    server.muteUser('session-1', 'user-1')

    sendMessage(ws1, 'Muted message')

    const lastCall = ws1.send.mock.calls[ws1.send.mock.calls.length - 1][0]
    expect(lastCall).toContain('error')
    expect(lastCall).toContain('You are muted in this session')
  })

  it('should block banned users from joining', async () => {
    server.banUser('session-1', 'user-1')

    const ws1 = new WebSocket('ws://localhost') as any
    await authenticateClient(ws1, 'user-1', 'trainee')
    joinSession(ws1, 'session-1', 'trainee', 'user-1')

    const lastCall = ws1.send.mock.calls[ws1.send.mock.calls.length - 1][0]
    expect(lastCall).toContain('error')
    expect(lastCall).toContain('You are banned from this session')
  })

  it('should enforce rate limiting', async () => {
    const ws1 = new WebSocket('ws://localhost') as any
    await authenticateClient(ws1, 'user-1', 'trainee')
    joinSession(ws1, 'session-1', 'trainee', 'user-1')

    for (let i = 0; i < 30; i++) {
      sendMessage(ws1, `Msg ${i}`)
    }

    sendMessage(ws1, 'Msg 31')

    const lastCall = ws1.send.mock.calls[ws1.send.mock.calls.length - 1][0]
    expect(lastCall).toContain('error')
    expect(lastCall).toContain('Message rate limit exceeded')
  })
})
