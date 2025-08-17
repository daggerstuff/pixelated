import { env } from '@/config/env.config'
import { AnalyticsService } from '@/lib/services/analytics/AnalyticsService'

import { WebSocketServer, WebSocket } from 'ws'

// Mock dependencies
const mockLoggerInstance = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}

vi.mock('@/lib/services/analytics/AnalyticsService')
vi.mock('@/lib/utils/logger', () => ({
  logger: mockLoggerInstance,
  getLogger: vi.fn(() => mockLoggerInstance),
}))
vi.mock('@/config/env.config')

// --- Mock for 'ws' module ---
const mockWssEventHandlers = new Map<string, Array<(event?: any, ...args: any[]) => void>>()

const mockWssInstance = {
  on: vi.fn((event: string, handler: (event?: any, ...args: any[]) => void) => {
    if (!mockWssEventHandlers.has(event)) {
      mockWssEventHandlers.set(event, [])
    }
    mockWssEventHandlers.get(event)!.push(handler)
  }),
  close: vi.fn(),
  emit: vi.fn((event: string, ...args: any[]) => {
    const handlers = mockWssEventHandlers.get(event) || []
    handlers.forEach(handler => handler(...args))
  }),
  // Add other methods if used by worker
}
const mockWsClientInstance = {
  on: vi.fn(),
  once: vi.fn(), // Needed for authentication test
  send: vi.fn(),
  close: vi.fn(),
  readyState: 1, // WebSocket.OPEN
}
vi.mock('ws', () => ({
  WebSocketServer: vi.fn().mockImplementation(() => mockWssInstance),
  WebSocket: vi.fn().mockImplementation(() => mockWsClientInstance),
}))
// --- End Mock ---

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-worker-id',
  },
})

// Mock process.exit to prevent tests from actually exiting
const mockExit = vi
  .spyOn(process, 'exit')
  .mockImplementation(() => undefined as never)

describe('analytics-worker', () => {
  let mockAnalyticsService: AnalyticsService

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()

    // Reset environment variables
    vi.mocked(env).ANALYTICS_WS_PORT = '8083'

    // Initialize mocks for services used BY the worker
    mockAnalyticsService = new AnalyticsService()

    // Clear the WebSocketServer mock instance's calls
    vi.mocked(mockWssInstance.on).mockClear()
    vi.mocked(mockWssInstance.close).mockClear()
    vi.mocked(mockWssInstance.emit).mockClear()
  })

  // Helper to simulate a connection
  const simulateConnection = (wsInstance: WebSocket) => {
    const connectionHandler = vi
      .mocked(mockWssInstance.on)
      .mock.calls.find(
        (call: [string, (...args: unknown[]) => void]) =>
          call[0] === 'connection',
      )?.[1]
    if (connectionHandler) {
      connectionHandler(wsInstance)
    } else {
      throw new Error(
        "WebSocketServer 'connection' handler not registered by analytics-worker",
      )
    }
  }

  describe('startWorker', () => {
    it('should start processing analytics events at the specified interval', async () => {
      // Arrange: Use fake timers for this test
      vi.useFakeTimers()
      // Act: Import worker module AFTER setting up mocks and timers
      await import('../analytics-worker')
      // Assert initial info log
      expect(mockLoggerInstance.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting analytics worker'),
      )
      // Verify WebSocket server was instantiated (implicitly via worker import)
      expect(vi.mocked(WebSocketServer)).toHaveBeenCalledWith(
        expect.objectContaining({ port: 8083 }),
      )
      // Trigger initial timer
      await vi.runOnlyPendingTimersAsync()
      // Assert processing was called
      expect(mockAnalyticsService.processEvents).toHaveBeenCalled()
      // Cleanup timers
      vi.useRealTimers()
    })

    it('should handle startup errors gracefully', async () => {
      // Mock AnalyticsService constructor to throw error
      vi.mocked(AnalyticsService).mockImplementationOnce(() => {
        throw new Error('Startup error')
      })

      // Import worker module
      await import('../analytics-worker')

      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        expect.stringContaining('Error starting analytics worker'),
        expect.any(Error),
      )
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('should handle processing errors gracefully', async () => {
      // Arrange: Use fake timers
      vi.useFakeTimers()
      // Mock processEvents to throw error
      vi.mocked(mockAnalyticsService.processEvents).mockRejectedValueOnce(
        new Error('Processing error'),
      )
      // Act: Import worker
      await import('../analytics-worker')
      // Trigger timer
      await vi.runOnlyPendingTimersAsync()
      // Assert error log
      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        expect.stringContaining('Error processing analytics events'),
        expect.any(Error),
      )
      // Cleanup timers
      vi.useRealTimers()
    })
  })

  describe('shutdown handling', () => {
    it('should handle SIGTERM signal', async () => {
      await import('../analytics-worker') // Import worker
      process.emit('SIGTERM', 'SIGTERM')
      // Assert logger and exit calls
      expect(mockLoggerInstance.info).toHaveBeenCalledWith(
        expect.stringContaining('Shutting down analytics worker'),
      )
      expect(mockExit).toHaveBeenCalledWith(0)
    })

    it('should handle SIGINT signal', async () => {
      await import('../analytics-worker')
      process.emit('SIGINT', 'SIGINT')
      expect(mockLoggerInstance.info).toHaveBeenCalledWith(
        expect.stringContaining('Shutting down analytics worker'),
      )
      expect(mockExit).toHaveBeenCalledWith(0)
    })

    it('should close WebSocket server on shutdown', async () => {
      await import('../analytics-worker')
      process.emit('SIGTERM', 'SIGTERM')
      // Assert close was called on the MOCK INSTANCE
      expect(mockWssInstance.close).toHaveBeenCalled()
    })
  })

  describe('environment configuration', () => {
    it('should use default WebSocket port if not configured', async () => {
      // Remove port from environment
      vi.mocked(env).ANALYTICS_WS_PORT = undefined

      // Import worker module
      await import('../analytics-worker')

      expect(WebSocketServer).toHaveBeenCalledWith(
        expect.objectContaining({ port: 8083 }),
      )
    })

    it('should use configured WebSocket port', async () => {
      // Set custom port in environment
      vi.mocked(env).ANALYTICS_WS_PORT = '8090'

      // Import worker module
      await import('../analytics-worker')

      expect(WebSocketServer).toHaveBeenCalledWith(
        expect.objectContaining({ port: 8090 }),
      )
    })
  })

  describe('webSocket handling', () => {
    it('should handle client authentication', async () => {
      // Arrange: Import worker to attach connection handler
      await import('../analytics-worker')
      // Create a mock client instance for this test
      const mockWsClient = new WebSocket('ws://localhost')

      // Act: Simulate connection
      simulateConnection(mockWsClient)

      // Find the message handler attached to the *client* mock
      const messageHandler = vi
        .mocked(mockWsClient.once)
        .mock.calls.find(
          (call: [string, (...args: unknown[]) => void]) =>
            call[0] === 'message',
        )?.[1]

      if (!messageHandler) {
        throw new Error('Message handler not attached to client')
      }

      // Simulate authentication message
      messageHandler(
        JSON.stringify({
          type: 'authenticate',
          userId: 'test-user',
        }),
      )

      // Assert
      expect(mockAnalyticsService.registerClient).toHaveBeenCalledWith(
        'test-user',
        mockWsClient, // Check it was called with the specific client instance
      )
      expect(mockWsClient.send).toHaveBeenCalledWith(
        expect.stringContaining('authenticated'),
      )
    })

    it('should handle invalid authentication', async () => {
      await import('../analytics-worker')
      const mockWsClient = new WebSocket('ws://localhost')
      simulateConnection(mockWsClient)
      const messageHandler = vi
        .mocked(mockWsClient.once)
        .mock.calls.find(
          (call: [string, (...args: unknown[]) => void]) =>
            call[0] === 'message',
        )?.[1]
      if (!messageHandler) {
        throw new Error('Message handler not attached')
      }

      messageHandler(JSON.stringify({ type: 'invalid' }))

      expect(mockAnalyticsService.registerClient).not.toHaveBeenCalled()
      expect(mockWsClient.close).toHaveBeenCalled()
    })

    it('should handle WebSocket server errors', async () => {
      await import('../analytics-worker')
      const mockError = new Error('WebSocket error')
      // Emit error on the mock WSS INSTANCE
      mockWssInstance.emit('error', mockError)

      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        expect.stringContaining('WebSocket server error'),
        mockError,
      )
    })
  })

  describe('cleanup handling', () => {
    // Need fake timers here
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('should run cleanup at specified interval', async () => {
      await import('../analytics-worker')
      // Assert initial setup called processEvents
      await vi.runOnlyPendingTimersAsync()
      expect(mockAnalyticsService.processEvents).toHaveBeenCalledTimes(1)

      // Assert cleanup is called after its interval
      vi.advanceTimersByTime(60 * 60 * 1000 + 1) // Advance by interval + 1ms
      expect(mockAnalyticsService.cleanup).toHaveBeenCalledTimes(1)
    })

    it('should handle cleanup errors gracefully', async () => {
      vi.mocked(mockAnalyticsService.cleanup).mockRejectedValueOnce(
        new Error('Cleanup failed'),
      )
      await import('../analytics-worker')

      // Run timers past the cleanup interval
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000 + 1)

      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        expect.stringContaining('Error during analytics cleanup'),
        expect.any(Error),
      )
    })
  })
})
