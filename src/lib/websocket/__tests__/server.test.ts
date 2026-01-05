import type { WebSocket } from 'ws'
import { fheService } from '../../fhe'
import TherapyChatWebSocketServer from '../server'

// Define mock interface for FHEService
interface MockFHEService {
  initialize: ReturnType<typeof vi.fn>
  processEncrypted: ReturnType<typeof vi.fn>
}

// Define the mock type correctly based on vi.fn() return type
type MockFn = ReturnType<typeof vi.fn>

// Cast fheService to our mock type
const mockedFHEService = fheService as unknown as MockFHEService

// Mock dependencies
vi.mock('../../fhe')
vi.mock('../../logging')

// Define WebSocket event handler types
type WSMessageHandler = (data: string) => void
type WSCloseHandler = () => void

// Define type for mock calls
type MockCall = [string, WSMessageHandler | WSCloseHandler]

// Helper function to type-check mock calls
const findMockCall = (calls: unknown[], type: string): MockCall | undefined => {
  return calls.find(
    (call: unknown): call is MockCall =>
      Array.isArray(call) && call.length === 2 && call[0] === type,
  )
}

// --- Mock for 'ws' module ---
const mockWssInstance = {
  on: vi.fn(),
  // Add other methods/properties if TherapyChatWebSocketServer uses them later
}
vi.mock('ws', () => ({
  // Mock the WebSocketServer class constructor
  WebSocketServer: vi.fn().mockImplementation(() => mockWssInstance),
  // Mock the WebSocket class constructor
  WebSocket: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
    on: vi.fn(),
    readyState: 1, // Simulate WebSocket.OPEN
    // Add other necessary WebSocket properties/methods if needed by the code
  })),
}))
// --- End Mock ---

describe('therapyChatWebSocketServer', () => {
  let wss: TherapyChatWebSocketServer
  let mockWebSocket: WebSocket & {
    send: MockFn
    on: MockFn
    readyState: number
  }
  let mockClients: Map<string, WebSocket>
  let mockHttpServer: any

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Mock the underlying HTTP server (minimal object, likely sufficient)
    mockHttpServer = {}

    // Create a mock WebSocket client instance for tests using the mock constructor
    mockWebSocket = new MockWebSocket() as WebSocket & {
      send: MockFn
      on: MockFn
      readyState: number
    }

    // Create TherapyChatWebSocketServer instance, passing the mock HTTP server.
    // Its internal `new WebSocketServer({ server })` will use the mock from vi.mock('ws').
    wss = new TherapyChatWebSocketServer(mockHttpServer)

    // Store reference to internal clients map (optional, if needed for assertions)
    mockClients = (wss as unknown).clients

    // Important: Clear the listeners attached to the *mock server instance* before each test
    vi.mocked(mockWssInstance.on).mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // Helper to simulate a connection event on the mocked WebSocketServer
  const simulateConnection = (wsInstance: WebSocket) => {
    // Find the 'connection' handler registered by TherapyChatWebSocketServer constructor
    const connectionHandler = vi
      .mocked(mockWssInstance.on)
      .mock.calls.find(
        (call: [string, ConnectionHandler]) => call[0] === 'connection',
      )?.[1] as ConnectionHandler
    if (connectionHandler) {
      // Invoke the handler, passing the mock WebSocket client
      connectionHandler(wsInstance)
    } else {
      // This error means TherapyChatWebSocketServer didn't attach its listener as expected
      throw new Error(
        "WebSocketServer 'connection' handler not registered by TherapyChatWebSocketServer constructor",
      )
    }
  }

  describe('handleConnection', () => {
    it('should add new client on connection', () => {
      const handleConnection = (wss as unknown).handleConnection.bind(wss)
      handleConnection(mockWebSocket)

      expect(mockClients.size).toBe(1)
      expect(mockWebSocket.on).toHaveBeenCalledWith(
        'message',
        expect.any(Function),
      )
      expect(mockWebSocket.on).toHaveBeenCalledWith(
        'close',
        expect.any(Function),
      )
    })

    it('should handle message events', async () => {
      // Simulate connection
      simulateConnection(mockWebSocket)

      // Get message handler attached to the mock *client*
      const messageHandler = findMockCall(
        vi.mocked(mockWebSocket.on).mock.calls, // Get handler from the client mock
        'message',
      )?.[1] as WSMessageHandler

      if (!messageHandler) {
        throw new Error('Message handler not attached to WebSocket client')
      }

      // Test chat message
      const chatMessage = {
        type: 'message',
        data: { content: 'test message' },
        sessionId: '123',
      }

      await messageHandler(JSON.stringify(chatMessage))
      expect(mockWebSocket.send).toHaveBeenCalled()
    })

    it('should handle encrypted messages with FHE', async () => {
      const handleConnection = (wss as unknown).handleConnection.bind(wss)
      handleConnection(mockWebSocket)

      const messageHandler = findMockCall(
        vi.mocked(mockWebSocket.on).mock.calls,
        'message',
      )?.[1] as WSMessageHandler

      if (!messageHandler) {
        throw new Error('Message handler not found')
      }

      const encryptedMessage = {
        type: 'message',
        data: { content: 'encrypted content' },
        sessionId: '123',
        encrypted: true,
      }

      // Mock FHE service
      const mockProcessedData = { content: 'processed content' }
      vi.mocked(mockedFHEService.processEncrypted).mockResolvedValue(
        mockProcessedData,
      )

      await messageHandler(JSON.stringify(encryptedMessage))

      expect(mockedFHEService.initialize).toHaveBeenCalled()
      expect(mockedFHEService.processEncrypted).toHaveBeenCalledWith(
        encryptedMessage.data,
        'CHAT',
      )
      expect(mockWebSocket.send).toHaveBeenCalled()
    })

    it('should handle status updates', async () => {
      const handleConnection = (wss as unknown).handleConnection.bind(wss)
      handleConnection(mockWebSocket)

      const messageHandler = findMockCall(
        vi.mocked(mockWebSocket.on).mock.calls,
        'message',
      )?.[1] as WSMessageHandler

      if (!messageHandler) {
        throw new Error('Message handler not found')
      }

      const statusMessage = {
        type: 'status',
        data: { status: 'typing' },
        sessionId: '123',
      }

      await messageHandler(JSON.stringify(statusMessage))
      expect(mockWebSocket.send).toHaveBeenCalled()
    })

    it('should handle client disconnection', () => {
      const handleConnection = (wss as unknown).handleConnection.bind(wss)
      handleConnection(mockWebSocket)

      // Get close handler using type-safe helper
      const closeHandler = findMockCall(
        vi.mocked(mockWebSocket.on).mock.calls,
        'close',
      )?.[1] as WSCloseHandler

      if (!closeHandler) {
        throw new Error('Close handler not found')
      }

      closeHandler()
      expect(mockClients.size).toBe(0)
    })

    it('should handle message parsing errors', async () => {
      const handleConnection = (wss as unknown).handleConnection.bind(wss)
      handleConnection(mockWebSocket)

      const messageHandler = findMockCall(
        vi.mocked(mockWebSocket.on).mock.calls,
        'message',
      )?.[1] as WSMessageHandler

      if (!messageHandler) {
        throw new Error('Message handler not found')
      }

      await messageHandler('invalid json')
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('Failed to process message'),
      )
    })
  })

  describe('broadcast methods', () => {
    it('should broadcast to specific session', () => {
      const sessionId = '123'
      const clientId = process.env.CLIENT_ID || 'example-client-id'

      // Add client to session
      mockClients.set(clientId, mockWebSocket)
      ;(wss as unknown).sessions.set(sessionId, new Set([clientId]))

      // Broadcast message
      ;(wss as unknown).broadcastToSession(sessionId, {
        type: 'message',
        data: { content: 'test' },
      })

      expect(mockWebSocket.send).toHaveBeenCalled()
    })

    it('should broadcast to all clients', () => {
      // Add multiple clients
      mockClients.set('1', mockWebSocket)
      mockClients.set('2', {
        ...mockWebSocket,
        send: vi.fn(),
      } as unknown as WebSocket)

      // Broadcast message
      wss.broadcast({ id: '1', role: 'user', content: 'test' })

      expect(mockWebSocket.send).toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should handle FHE initialization errors', async () => {
      const handleConnection = (wss as unknown).handleConnection.bind(wss)
      handleConnection(mockWebSocket)

      const messageHandler = findMockCall(
        vi.mocked(mockWebSocket.on).mock.calls,
        'message',
      )?.[1] as WSMessageHandler

      if (!messageHandler) {
        throw new Error('Message handler not found')
      }

      // Mock FHE error
      vi.mocked(mockedFHEService.initialize).mockRejectedValue(
        new Error('FHE error'),
      )

      const encryptedMessage = {
        type: 'message',
        data: { content: 'test' },
        sessionId: '123',
        encrypted: true,
      }

      await messageHandler(JSON.stringify(encryptedMessage))
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('Encryption error'),
      )
    })

    it('should handle missing session ID', async () => {
      const handleConnection = (wss as unknown).handleConnection.bind(wss)
      handleConnection(mockWebSocket)

      const messageHandler = findMockCall(
        vi.mocked(mockWebSocket.on).mock.calls,
        'message',
      )?.[1] as WSMessageHandler

      if (!messageHandler) {
        throw new Error('Message handler not found')
      }

      const message = {
        type: 'message',
        data: { content: 'test' },
      }

      await messageHandler(JSON.stringify(message))
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('Session ID required'),
      )
    })
  })
})
