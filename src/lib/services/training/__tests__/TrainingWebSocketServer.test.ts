import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TrainingWebSocketServer } from '../TrainingWebSocketServer'
import { WebSocket, WebSocketServer } from 'ws'

// Mock dependencies
vi.mock('ws', () => {
  const mockWebSocket: any = vi.fn().mockImplementation(function() {
    return {
      on: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
      readyState: 1, // OPEN
    }
  })
  mockWebSocket.OPEN = 1
  mockWebSocket.CLOSED = 3

  const mockWebSocketServer: any = vi.fn().mockImplementation(function() {
    return {
      on: vi.fn(),
      close: vi.fn(),
    }
  })

  return {
    WebSocket: mockWebSocket,
    WebSocketServer: mockWebSocketServer
  }
})

vi.mock('../../logging/build-safe-logger', () => ({
  createBuildSafeLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('../../auth/jwt-service', () => ({
  validateToken: vi.fn(),
}))

describe('TrainingWebSocketServer - Coaching Notes', () => {
  let server: any
  let mockWs: any

  beforeEach(() => {
    vi.clearAllMocks()
    server = new TrainingWebSocketServer(8084)
    // Create a mock WebSocket instance
    mockWs = {
      on: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
      readyState: 1 // OPEN
    }
  })

  it('should allow supervisors to send coaching notes', async () => {
    const clientId = 'test-client-id'
    const sessionId = 'test-session-id'

    // @ts-ignore
    server.clients.set(clientId, {
      id: clientId,
      ws: mockWs,
      sessionId,
      role: 'supervisor',
      userId: 'user-1',
      isAuthenticated: true
    })

    // @ts-ignore
    server.handleCoachingNote(clientId, { content: 'Test note' })

    // It should NOT send an error message to the sender
    expect(mockWs.send).not.toHaveBeenCalledWith(expect.stringContaining('"type":"error"'))
  })

  it('should reject trainees from sending coaching notes', async () => {
    const clientId = 'trainee-client-id'
    const sessionId = 'test-session-id'

    // @ts-ignore
    server.clients.set(clientId, {
      id: clientId,
      ws: mockWs,
      sessionId,
      role: 'trainee',
      userId: 'user-trainee',
      isAuthenticated: true
    })

    // @ts-ignore
    server.handleCoachingNote(clientId, { content: 'Illegal note' })

    expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('"type":"error"'))
    expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('Unauthorized'))
  })

  it('should reject empty coaching notes', async () => {
    const clientId = 'supervisor-client-id'
    const sessionId = 'test-session-id'

    // @ts-ignore
    server.clients.set(clientId, {
      id: clientId,
      ws: mockWs,
      sessionId,
      role: 'supervisor',
      userId: 'user-supervisor',
      isAuthenticated: true
    })

    // @ts-ignore
    server.handleCoachingNote(clientId, { content: '' })

    expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('"type":"error"'))
    expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('Invalid'))
  })
})
