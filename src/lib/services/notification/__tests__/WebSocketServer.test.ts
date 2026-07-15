/* @vitest-environment node */
import type { IncomingMessage } from 'http'

import { WebSocket, WebSocketServer as WSServer } from 'ws'
import type { Server } from 'ws'

import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

import { NotificationService } from '../NotificationService'
import { WebSocketServer } from '../WebSocketServer'

// Define the mock type correctly based on vi.fn() return type
type MockFn = ReturnType<typeof vi.fn>

const websocketLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}))

// Mock dependencies
vi.mock('ws', () => {
  const mockServer = {
    on: vi.fn(),
    close: vi.fn(),
    clients: new Set(),
    emit: vi.fn(),
  }

  return {
    WebSocketServer: vi.fn(function () {
      return mockServer
    }),
    WebSocket: vi.fn(function () {
      return {
        send: vi.fn(),
        close: vi.fn(),
        on: vi.fn(),
      }
    }),
  }
})

vi.mock('../NotificationService', () => ({
  NotificationService: vi.fn(function () {
    return {
      registerClient: vi.fn(),
      unregisterClient: vi.fn(),
      markAsRead: vi.fn(),
      getNotifications: vi.fn<() => Promise<never[]>>().mockResolvedValue([]),
      getUnreadCount: vi.fn<() => Promise<number>>().mockResolvedValue(3),
    }
  }),
}))
vi.mock('@/lib/logging/build-safe-logger', () => ({
  createBuildSafeLogger: vi.fn(() => websocketLogger),
}))

const logger = createBuildSafeLogger('websocket')

// Mock Supabase
vi.mock('@/lib/supabase', () => {
  const mockUser = { id: 'test-user' }
  const mockProfile = { role: 'user' }
  const mockSession = { user_id: 'test-user' }

  return {
    mongoClient: {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
        getSession: vi.fn().mockResolvedValue({
          data: { session: mockSession },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockProfile,
          error: null,
        }),
      })),
    },
  }
})

type WSEventHandler = (ws: WebSocket, req: IncomingMessage) => void
type WSErrorHandler = (error: Error) => void
type WSMessageHandler = (data: string) => void
type WSCloseHandler = () => void

type MockCall = [
  string,
  WSEventHandler | WSErrorHandler | WSMessageHandler | WSCloseHandler,
]

// Helper type for mocked WebSocket server
type MockedWSServer = Server & {
  on: MockFn
  mock: {
    calls: MockCall[]
    instances: MockedWSServer[]
  }
}

// Helper function to type-check mock calls
const findMockCall = (calls: unknown[], type: string): MockCall | undefined => {
  return calls.find(
    (call: unknown): call is MockCall =>
      Array.isArray(call) && call.length === 2 && call[0] === type,
  )
}

describe('WebSocketServer', () => {
  let mockPort: number
  let mockNotificationService: NotificationService
  let server: WebSocketServer
  const defaultUserId = 'mock-user-id'

  beforeEach(() => {
    vi.clearAllMocks()
    mockPort = 8082
    mockNotificationService = new NotificationService()
    server = new WebSocketServer(mockPort, mockNotificationService)
  })

  describe('constructor', () => {
    it('should initialize with provided port and notification service', () => {
      expect(WSServer).toHaveBeenCalledWith({ port: mockPort })
      expect(logger.info).toHaveBeenCalledWith('WebSocket server started', {
        port: mockPort,
      })
    })

    it('should set up connection handler', () => {
      const wsInstance = vi.mocked(WSServer).mock
        .instances[0] as unknown as MockedWSServer
      expect(wsInstance.on).toHaveBeenCalledWith(
        'connection',
        expect.any(Function),
      )
    })

    it('should set up error handler', () => {
      const wsInstance = vi.mocked(WSServer).mock
        .instances[0] as unknown as MockedWSServer
      expect(wsInstance.on).toHaveBeenCalledWith('error', expect.any(Function))
    })
  })

  describe('connection handling', () => {
    let mockWs: WebSocket & {
      send: MockFn
      close: MockFn
      on: MockFn
    }
    let mockReq: IncomingMessage
    const mockToken = 'valid-token'
    const mockUserId = defaultUserId

    beforeEach(() => {
      mockWs = new WebSocket(null) as unknown as WebSocket & {
        send: MockFn
        close: MockFn
        on: MockFn
      }
      mockReq = {
        headers: {
          authorization: `Bearer ${mockToken}`,
        },
      } as IncomingMessage

      vi.mocked(mockWs.on).mockImplementation(
        (event: string, listener: WSMessageHandler | WSCloseHandler) => {
          if (event === 'message') {
            listener.bind(mockWs)(
              JSON.stringify({
                type: 'mark_read',
                notificationId: 'test-id',
              }),
            )
          }
          return mockWs
        },
      )
    })

    it('should handle client authentication', async () => {
      const wsInstance = vi.mocked(WSServer).mock
        .instances[0] as unknown as MockedWSServer
      const connectionHandler = wsInstance.on.mock.calls.find(
        (call: unknown): call is [string, WSEventHandler] =>
          Array.isArray(call) && call.length === 2 && call[0] === 'connection',
      )?.[1]

      if (!connectionHandler) {
        throw new Error('Connection handler not found')
      }

      connectionHandler.bind(wsInstance)(mockWs, mockReq)
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(mockNotificationService.registerClient).toHaveBeenCalledWith(
        mockUserId,
        mockWs,
      )
    })

    it('should handle authentication failure', async () => {
      vi.spyOn(
        server as unknown as {
          verifyToken: (token: string) => Promise<string>
        },
        'verifyToken',
      ).mockRejectedValue(new Error('Invalid token'))

      const mockWs = new WebSocket(null) as unknown as WebSocket & {
        send: MockFn
        close: MockFn
        on: MockFn
      }
      const mockReq = {
        headers: {
          authorization: 'Bearer invalid-token',
        },
      } as IncomingMessage

      const wsInstance = vi.mocked(WSServer).mock
        .instances[0] as unknown as MockedWSServer
      const connectionHandler = findMockCall(
        wsInstance.on.mock.calls,
        'connection',
      )?.[1] as WSEventHandler

      if (!connectionHandler) {
        throw new Error('Connection handler not found')
      }

      connectionHandler.bind(wsInstance)(mockWs, mockReq)
      await new Promise((resolve) => setTimeout(resolve, 0))

      // Verify error handling
      expect(mockWs.close).toHaveBeenCalledWith(
        1008,
        expect.stringContaining('Unauthorized'),
      )
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('Authentication failed'),
      )
    })

    it('should handle client messages', async () => {
      const wsInstance = vi.mocked(WSServer).mock
        .instances[0] as unknown as MockedWSServer
      const connectionHandler = findMockCall(
        wsInstance.on.mock.calls,
        'connection',
      )?.[1] as WSEventHandler

      if (!connectionHandler) {
        throw new Error('Connection handler not found')
      }

      connectionHandler.bind(wsInstance)(mockWs, mockReq)
      await new Promise((resolve) => setTimeout(resolve, 0))
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(mockNotificationService.markAsRead).toHaveBeenCalledWith(
        mockUserId,
        'test-id',
      )
    })

    it('should handle client disconnection', async () => {
      const wsInstance = vi.mocked(WSServer).mock
        .instances[0] as unknown as MockedWSServer
      const connectionHandler = findMockCall(
        wsInstance.on.mock.calls,
        'connection',
      )?.[1] as WSEventHandler

      if (!connectionHandler) {
        throw new Error('Connection handler not found')
      }

      connectionHandler.bind(wsInstance)(mockWs, mockReq)
      await new Promise((resolve) => setTimeout(resolve, 0))

      const closeHandler = findMockCall(
        vi.mocked(mockWs.on).mock.calls,
        'close',
      )?.[1] as WSCloseHandler

      if (closeHandler) {
        closeHandler.bind(mockWs)()
      }

      expect(mockNotificationService.unregisterClient).toHaveBeenCalledWith(
        mockUserId,
      )
    })
  })

  describe('error handling', () => {
    it('should log server errors', () => {
      const wsInstance = vi.mocked(WSServer).mock
        .instances[0] as unknown as MockedWSServer
      const errorHandler = findMockCall(
        wsInstance.on.mock.calls,
        'error',
      )?.[1] as WSErrorHandler

      if (!errorHandler) {
        throw new Error('Error handler not found')
      }

      const mockError = new Error('Server error')
      errorHandler.bind(wsInstance)(mockError)

      expect(logger.error).toHaveBeenCalledWith('WebSocket server error', {
        error: String(mockError),
      })
    })
  })
})
