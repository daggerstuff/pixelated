import { describe, it, expect, beforeEach, vi } from 'vitest'
import { WebSocket, WebSocketServer as WSServer } from 'ws'
import { NotificationService } from '../NotificationService'
import { WebSocketServer } from '../WebSocketServer'
import type { IncomingMessage } from 'http'
import * as logger from '../../../logging/build-safe-logger'

// Define the mock type correctly based on vi.fn() return type
type MockFn = ReturnType<typeof vi.fn>

// Mock dependencies
vi.mock('ws', () => {
  const mockServer = {
    on: vi.fn(),
    close: vi.fn(),
    clients: new Set(),
    emit: vi.fn(),
  }

  return {
    WebSocketServer: vi.fn(function() { return mockServer; }),
    WebSocket: vi.fn().mockImplementation(function() { return {
      on: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
    }; }),
  }
})

vi.mock('../NotificationService')
vi.mock('../../../logging/build-safe-logger', () => ({
  createBuildSafeLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

describe('WebSocketServer', () => {
  let mockPort: number
  let mockNotificationService: NotificationService
  let wsServer: WebSocketServer

  beforeEach(() => {
    vi.clearAllMocks()
    mockPort = 8082
    mockNotificationService = new NotificationService()
    wsServer = new WebSocketServer(mockPort, mockNotificationService)
  })

  describe('constructor', () => {
    it('should initialize with provided port and notification service', () => {
      expect(WSServer).toHaveBeenCalledWith({ port: mockPort })
      expect(logger.createBuildSafeLogger).toHaveBeenCalledWith('websocket')
    })

    it('should set up connection handler', () => {
      const wsInstance: any = vi.mocked(WSServer).mock.results[0].value
      expect(wsInstance.on).toHaveBeenCalledWith('connection', expect.any(Function))
    })

    it('should set up error handler', () => {
      const wsInstance: any = vi.mocked(WSServer).mock.results[0].value
      expect(wsInstance.on).toHaveBeenCalledWith('error', expect.any(Function))
    })
  })

  describe('connection handling', () => {
    let mockWs: any
    let mockReq: any
    const mockToken = 'valid-token'
    const mockUserId = 'mock-user-id'

    beforeEach(() => {
      mockWs = {
        send: vi.fn(),
        close: vi.fn(),
        on: vi.fn(),
      }
      mockReq = {
        headers: {
          authorization: `Bearer ${mockToken}`,
        },
      }
    })

    it('should handle client authentication and setup connection', async () => {
      const wsInstance: any = vi.mocked(WSServer).mock.results[0].value
      const connectionHandler = wsInstance.on.mock.calls.find(
        (call: any) => call[0] === 'connection'
      )[1]

      await connectionHandler(mockWs, mockReq)

      expect(mockNotificationService.registerClient).toHaveBeenCalledWith(mockUserId, mockWs)
      expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function))
      expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function))
      expect(mockWs.on).toHaveBeenCalledWith('error', expect.any(Function))
    })

    it('should handle wrapped client messages', async () => {
      const wsInstance: any = vi.mocked(WSServer).mock.results[0].value
      const connectionHandler = wsInstance.on.mock.calls.find(
        (call: any) => call[0] === 'connection'
      )[1]

      await connectionHandler(mockWs, mockReq)

      const messageHandler = mockWs.on.mock.calls.find(
        (call: any) => call[0] === 'message'
      )[1]

      const wrappedMessage = JSON.stringify({
        type: 'message',
        data: {
          content: JSON.stringify({
            type: 'get_notifications',
            limit: 10
          })
        }
      })

      await messageHandler(wrappedMessage)

      expect(mockNotificationService.getNotifications).toHaveBeenCalledWith(
        mockUserId,
        10,
        undefined
      )
    })

    it('should wrap outgoing messages in ChatMessage structure', async () => {
       const wsInstance: any = vi.mocked(WSServer).mock.results[0].value
       const connectionHandler = wsInstance.on.mock.calls.find(
         (call: any) => call[0] === 'connection'
       )[1]

       await connectionHandler(mockWs, mockReq)

       // setupAuthenticatedConnection triggers sendUnreadCount
       await vi.waitFor(() => {
         expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('message'))
         expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('system'))
         expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('unreadCount'))
       })
    })
  })

  describe('error handling', () => {
    it('should log server errors', () => {
      const wsInstance: any = vi.mocked(WSServer).mock.results[0].value
      const errorHandler = wsInstance.on.mock.calls.find(
        (call: any) => call[0] === 'error'
      )[1]

      const mockError = new Error('Server error')
      errorHandler(mockError)

      const websocketLogger = vi.mocked(logger.createBuildSafeLogger('websocket'))
      expect(websocketLogger.error).toHaveBeenCalledWith(expect.stringContaining('WebSocket server error'), expect.any(Object))
    })
  })

  describe('close', () => {
    it('should close the underlying wss', () => {
      const wsInstance: any = vi.mocked(WSServer).mock.results[0].value
      wsServer.close()
      expect(wsInstance.close).toHaveBeenCalled()
    })
  })
})
