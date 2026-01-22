import { env } from '@/config/env.config'
import { NotificationService } from '@/lib/services/notification/NotificationService'
import { WebSocketServer } from '@/lib/services/notification/WebSocketServer'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

// Extend the WebSocketServer interface for testing
declare module '@/lib/services/notification/WebSocketServer' {
  interface WebSocketServer {
    close: () => void
    emit: (event: string, ...args: any[]) => void
  }
}

// Provide a factory for the logger and service mocks
const { mockLoggerInstance, startProcessingMock } = vi.hoisted(() => {
  return {
    mockLoggerInstance: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
    startProcessingMock: vi.fn().mockResolvedValue(undefined)
  }
})

// Mock dependencies
vi.mock('@/lib/services/notification/NotificationService', () => {
  return {
    NotificationService: vi.fn().mockImplementation(() => ({
      startProcessing: startProcessingMock
    }))
  }
})
vi.mock('@/lib/services/notification/WebSocketServer')
vi.mock('@/config/env.config')

vi.mock('@/lib/utils/logger', () => ({
  logger: mockLoggerInstance,
  getLogger: vi.fn(() => mockLoggerInstance), // Mock getLogger to return the instance
}))

vi.mock('@/lib/logging/build-safe-logger', () => ({
  createBuildSafeLogger: vi.fn(() => mockLoggerInstance),
}))

// Mock process.exit to prevent tests from actually exiting
const mockExit = vi
  .spyOn(process, 'exit')
  .mockImplementation(() => undefined as never)

describe('notification-worker', () => {
  let mockNotificationService: NotificationService
  let mockWebSocketServer: WebSocketServer

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    vi.resetModules()

      // Reset environment variables
      ; (vi.mocked(env) as any).NOTIFICATION_WS_PORT = '8082'

    // Initialize mocks
    // Initialize mocks
    mockNotificationService = new NotificationService()
    mockWebSocketServer = new WebSocketServer(8082, mockNotificationService)

    // Add mock implementations
    vi.mocked(mockWebSocketServer).close = vi.fn()
    vi.mocked(mockWebSocketServer).emit = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('startWorker', () => {
    it('should start processing notifications at the specified interval', async () => {
      // Import worker module
      await import('../notification-worker.js')

      // Wait for initial setup
      await vi.runAllTimersAsync()

      expect(
        createBuildSafeLogger('notification-worker').info,
      ).toHaveBeenCalledWith(
        expect.stringContaining('Starting notification worker'),
        expect.objectContaining({ workerId: expect.any(String) }),
      )

      // Verify WebSocket server initialization
      expect(WebSocketServer).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(NotificationService),
      )

      // Verify notification processing
      expect(startProcessingSpy).toHaveBeenCalledWith(1000)
    })

    it('should handle startup errors gracefully', async () => {
      // Mock NotificationService constructor to throw error
      vi.mocked(NotificationService).mockImplementationOnce(() => {
        throw new Error('Startup error')
      })

      // Import worker module
      await import('../notification-worker.js')

      expect(
        createBuildSafeLogger('notification-worker').error,
      ).toHaveBeenCalledWith(
        expect.stringContaining('Notification worker failed'),
        expect.objectContaining({
          workerId: expect.any(String),
          error: expect.stringContaining('Startup error'),
        }),
      )
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('should handle processing errors gracefully', async () => {
      // Mock startProcessing to throw error
      startProcessingSpy.mockRejectedValueOnce(
        new Error('Processing error'),
      )

      // Import worker module
      await import('../notification-worker.js')

      // Wait for error to be logged
      await vi.runAllTimersAsync()

      expect(
        createBuildSafeLogger('notification-worker').error,
      ).toHaveBeenCalledWith(
        expect.stringContaining('Notification worker failed'),
        expect.objectContaining({
          workerId: expect.any(String),
          error: expect.stringContaining('Processing error'),
        }),
      )
    })
  })

  describe('shutdown handling', () => {
    it('should handle SIGTERM signal', async () => {
      // Import worker module
      await import('../notification-worker.js')

      // Simulate SIGTERM signal
      process.emit('SIGTERM', 'SIGTERM')

      expect(
        createBuildSafeLogger('notification-worker').info,
      ).toHaveBeenCalledWith(
        expect.stringContaining('Shutting down notification worker'),
        expect.objectContaining({ workerId: expect.any(String) }),
      )
      expect(mockExit).toHaveBeenCalledWith(0)
    })

    it('should handle SIGINT signal', async () => {
      // Import worker module
      await import('../notification-worker.js')

      // Simulate SIGINT signal
      process.emit('SIGINT', 'SIGINT')

      expect(
        createBuildSafeLogger('notification-worker').info,
      ).toHaveBeenCalledWith(
        expect.stringContaining('Shutting down notification worker'),
        expect.objectContaining({ workerId: expect.any(String) }),
      )
      expect(mockExit).toHaveBeenCalledWith(0)
    })

    it('should close WebSocket server on shutdown', async () => {
      // Import worker module
      await import('../notification-worker.js')

      // Simulate SIGTERM signal
      process.emit('SIGTERM', 'SIGTERM')

      expect(mockWebSocketServer.close).toHaveBeenCalled()
    })
  })

  describe('environment configuration', () => {
    it('should use default WebSocket port if not configured', async () => {
      // Remove port from environment
      ; (vi.mocked(env) as any).NOTIFICATION_WS_PORT = undefined

      // Import worker module
      await import('../notification-worker.js')

      expect(WebSocketServer).toHaveBeenCalledWith(
        expect.objectContaining({ port: 8082 }),
        expect.any(NotificationService),
      )
    })

    it('should use configured WebSocket port', async () => {
      // Set custom port in environment
      ; (vi.mocked(env) as any).NOTIFICATION_WS_PORT = '8090'

      // Import worker module
      await import('../notification-worker.js')

      expect(WebSocketServer).toHaveBeenCalledWith(
        expect.objectContaining({ port: 8090 }),
        expect.any(NotificationService),
      )
    })
  })

  describe('error handling', () => {
    it('should continue processing after non-fatal errors', async () => {
      // Mock startProcessing to throw error once then succeed
      startProcessingSpy
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce(undefined)

      // Import worker module
      await import('../notification-worker.js')

      // Wait for multiple processing cycles
      await vi.runAllTimersAsync()

      expect(startProcessingMock).toHaveBeenCalledTimes(2)
      expect(
        createBuildSafeLogger('notification-worker').error,
      ).toHaveBeenCalledWith(
        expect.stringContaining('Notification worker failed'),
        expect.objectContaining({
          workerId: expect.any(String),
          error: expect.stringContaining('Processing error'),
        }),
      )
    })

    it.skip('should handle WebSocket server errors', async () => {
      // Mock WebSocket server error
      const mockError = new Error('WebSocket error')
      mockWebSocketServer.emit('error', mockError)

      // Import worker module
      await import('../notification-worker.js')

      expect(
        createBuildSafeLogger('notification-worker').error,
      ).toHaveBeenCalledWith(
        expect.stringContaining('WebSocket server error'),
        expect.objectContaining({
          workerId: expect.any(String),
          error: 'WebSocket error',
        })
      )
    })
  })
})
