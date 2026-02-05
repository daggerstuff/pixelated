import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WebSocket, WebSocketServer as WSServer } from 'ws'
import { TrainingWebSocketServer } from '../TrainingWebSocketServer'

// Mock dependencies
vi.mock('ws', () => {
  const mockServer = {
    on: vi.fn(),
    close: vi.fn(),
    clients: new Set(),
    emit: vi.fn(),
  }

  const mockWS: any = vi.fn(function() {
    return {
      on: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
      readyState: 1 // OPEN
    }
  })
  mockWS.OPEN = 1
  mockWS.CLOSED = 3

  return {
    WebSocketServer: vi.fn(function() { return mockServer }),
    WebSocket: mockWS,
  }
})

vi.mock('../../auth/jwt-service', () => ({
  validateToken: vi.fn().mockResolvedValue({ valid: true, userId: 'test-user', role: 'therapist' })
}))

// Mock logger
vi.mock('../../logging/build-safe-logger', () => ({
  createBuildSafeLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

describe('TrainingWebSocketServer', () => {
  let server: TrainingWebSocketServer
  let mockWss: any

  beforeEach(() => {
    vi.clearAllMocks()
    server = new TrainingWebSocketServer(8084)
    // Get the mock instance
    mockWss = vi.mocked(WSServer).mock.results[0].value
  })

  it('should initialize correctly', () => {
    expect(WSServer).toHaveBeenCalledWith({ port: 8084 })
    expect(mockWss.on).toHaveBeenCalledWith('connection', expect.any(Function))
  })

  describe('handleMessage', () => {
    let mockWs: any
    let clientId: string

    beforeEach(() => {
        mockWs = {
            on: vi.fn(),
            send: vi.fn(),
            close: vi.fn(),
            readyState: 1
        }
        clientId = 'test-client-id'

        // Setup client in server
        ;(server as any).clients.set(clientId, {
            id: clientId,
            ws: mockWs,
            userId: 'test-user',
            role: 'trainee',
            isAuthenticated: true,
            sessionId: 'test-session'
        })

        // Make the trainee the owner of the session
        ;(server as any).sessionOwners.set('test-session', 'test-user')
    })

    it('should implement rate limiting', () => {
        const handleSessionMessage = (server as any).handleSessionMessage.bind(server)

        // Send 30 messages (the limit)
        for (let i = 0; i < 30; i++) {
            handleSessionMessage(clientId, { content: 'test', role: 'therapist' })
        }

        expect(mockWs.send).toHaveBeenCalledTimes(30)

        // The 31st message should fail
        mockWs.send.mockClear()
        handleSessionMessage(clientId, { content: 'test', role: 'therapist' })

        expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('Rate limit exceeded'))
    })

    it('should block muted users', () => {
        (server as any).mutedUsers.add('test-user:test-session')
        const handleSessionMessage = (server as any).handleSessionMessage.bind(server)

        handleSessionMessage(clientId, { content: 'test', role: 'therapist' })

        expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('You are muted'))
    })

    it('should block and disconnect banned users', () => {
        (server as any).bannedUsers.add('test-user:test-session')
        const handleSessionMessage = (server as any).handleSessionMessage.bind(server)

        handleSessionMessage(clientId, { content: 'test', role: 'therapist' })

        expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('You have been banned'))
        expect(mockWs.close).toHaveBeenCalledWith(4003, 'Banned from session')
    })

    it('should enforce role-based permissions for session messages', () => {
        const handleSessionMessage = (server as any).handleSessionMessage.bind(server)

        // Change role to observer
        const client = (server as any).clients.get(clientId)
        client.role = 'observer'
        // And remove ownership for this test
        ;(server as any).sessionOwners.delete('test-session')

        handleSessionMessage(clientId, { content: 'test', role: 'therapist' })

        expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('Unauthorized: Only the session owner or a supervisor can send messages'))
    })

    it('should allow supervisors to mute users', () => {
        const supervisorId = 'supervisor-client'
        const supervisorWs = { send: vi.fn(), readyState: 1 }

        ;(server as any).clients.set(supervisorId, {
            id: supervisorId,
            ws: supervisorWs,
            userId: 'supervisor-user',
            role: 'supervisor',
            isAuthenticated: true,
            sessionId: 'test-session'
        })

        const handleMuteUser = (server as any).handleMuteUser.bind(server)
        handleMuteUser(supervisorId, { userId: 'test-user', mute: true })

        expect((server as any).mutedUsers.has('test-user:test-session')).toBe(true)
    })

    it('should allow supervisors to ban users', () => {
        const supervisorId = 'supervisor-client'
        const supervisorWs = { send: vi.fn(), readyState: 1 }

        ;(server as any).clients.set(supervisorId, {
            id: supervisorId,
            ws: supervisorWs,
            userId: 'supervisor-user',
            role: 'supervisor',
            isAuthenticated: true,
            sessionId: 'test-session'
        })

        const handleBanUser = (server as any).handleBanUser.bind(server)
        handleBanUser(supervisorId, { userId: 'test-user' })

        expect((server as any).bannedUsers.has('test-user:test-session')).toBe(true)
        // Trainee should be disconnected
        expect(mockWs.close).toHaveBeenCalledWith(4003, 'Banned by supervisor')
    })
  })
})
