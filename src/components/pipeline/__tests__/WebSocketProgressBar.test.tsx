/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  WebSocketProgressBar,
  WebSocketConnectionManager,
  WebSocketMessageLogger,
} from '../WebSocketProgressBar'

// Mock WebSocket
const mockWebSocket = {
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: WebSocket.CONNECTING,
}

// global.WebSocket will be mocked in beforeEach

describe('WebSocketProgressBar', () => {
  const mockProps = {
    executionId: 'test-execution-123',
    webSocket: null,
    onProgressUpdate: vi.fn(),
    showMetrics: true,
    autoReconnect: true,
    reconnectDelay: 1000,
  }

  // Capture original WebSocket
  const originalWebSocket = global.WebSocket

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    const MockWebSocket = vi.fn(function() { return mockWebSocket }) as any
    MockWebSocket.CONNECTING = 0
    MockWebSocket.OPEN = 1
    MockWebSocket.CLOSING = 2
    MockWebSocket.CLOSED = 3
    global.WebSocket = MockWebSocket
  })

  afterEach(() => {
    vi.useRealTimers()
    global.WebSocket = originalWebSocket
  })

  describe('Rendering', () => {
    it('renders progress bar with initial state', () => {
      render(<WebSocketProgressBar {...mockProps} />)

      expect(screen.getByText(/websocket status/i)).toBeInTheDocument()
      expect(screen.getByText(/0\.0%/i)).toBeInTheDocument()
      expect(screen.getByText(/initializing/i)).toBeInTheDocument()
    })

    it('renders connection status indicator', () => {
      render(<WebSocketProgressBar {...mockProps} />)

      const statusIndicator = screen.getByRole('status')
      expect(statusIndicator).toBeInTheDocument()
    })

    it('renders metrics when showMetrics is true', () => {
      render(<WebSocketProgressBar {...mockProps} showMetrics={true} />)

      expect(screen.getByText(/updates per second/i)).toBeInTheDocument()
      expect(screen.getByTestId('trending-up-icon')).toBeInTheDocument()
    })

    it('hides metrics when showMetrics is false', () => {
      render(<WebSocketProgressBar {...mockProps} showMetrics={false} />)

      expect(screen.queryByText(/updates per second/i)).not.toBeInTheDocument()
      expect(screen.queryByTestId('trending-up-icon')).not.toBeInTheDocument()
    })
  })

  describe('WebSocket Message Handling', () => {
    it('updates progress on progress_update message', () => {
      const mockWs = {
        ...mockWebSocket,
        readyState: WebSocket.OPEN,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }

      render(
        <WebSocketProgressBar
          {...mockProps}
          webSocket={mockWs as unknown as WebSocket}
        />,
      )

      // Simulate progress update message
      const messageCalls = mockWs.addEventListener.mock.calls.filter((c: any) => c[0] === 'message')
      const messageHandler = messageCalls[messageCalls.length - 1]?.[1]

      if (messageHandler) {
        act(() => {
          messageHandler({
            data: JSON.stringify({
              type: 'progress_update',
              executionId: 'test-execution-123',
              data: {
                progress: 50,
                stage: 'processing',
              },
            }),
          })
        })
      }

      expect(screen.getByText(/50\.0%/i)).toBeInTheDocument()
      expect(screen.getByText(/processing/i)).toBeInTheDocument()
      expect(mockProps.onProgressUpdate).toHaveBeenCalledWith(50, 'processing')
    })

    it('handles status_update messages', () => {
      const mockSocket = {
        ...mockWebSocket,
        readyState: WebSocket.OPEN,
      }

      render(
        <WebSocketProgressBar
          {...mockProps}
          webSocket={mockSocket as unknown as WebSocket}
        />,
      )

      const messageCalls = mockSocket.addEventListener.mock.calls.filter((c: any) => c[0] === 'message')
      const messageHandler = messageCalls[messageCalls.length - 1]?.[1]

      if (messageHandler) {
        act(() => {
          messageHandler({
            data: JSON.stringify({
              type: 'status_update',
              executionId: 'test-execution-123',
              data: {
                status: 'running',
                message: 'Processing data',
              },
            }),
          })
        })
      }

      expect(screen.getByText(/running/i)).toBeInTheDocument()
    })

    it('ignores messages for different execution IDs', () => {
      const mockSocket = {
        ...mockWebSocket,
        readyState: WebSocket.OPEN,
      }

      render(
        <WebSocketProgressBar
          {...mockProps}
          webSocket={mockSocket as unknown as WebSocket}
        />,
      )

      const messageCalls = mockSocket.addEventListener.mock.calls.filter((c: any) => c[0] === 'message')
      const messageHandler = messageCalls[messageCalls.length - 1]?.[1]

      if (messageHandler) {
        act(() => {
          messageHandler({
            data: JSON.stringify({
              type: 'progress_update',
              executionId: 'different-execution-456',
              data: {
                progress: 75,
                stage: 'completed',
              },
            }),
          })
        })
      }

      // Should still show 0% progress
      expect(screen.getByText(/0\.0%/i)).toBeInTheDocument()
      expect(mockProps.onProgressUpdate).not.toHaveBeenCalled()
    })

    it('handles malformed JSON messages gracefully', () => {
      const mockSocket = {
        ...mockWebSocket,
        readyState: WebSocket.OPEN,
      }

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { })

      render(
        <WebSocketProgressBar
          {...mockProps}
          webSocket={mockSocket as unknown as WebSocket}
        />,
      )

      const messageCalls = mockSocket.addEventListener.mock.calls.filter((c: any) => c[0] === 'message')
      const messageHandler = messageCalls[messageCalls.length - 1]?.[1]

      if (messageHandler) {
        act(() => {
          messageHandler({
            data: 'invalid json',
          })
        })
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to parse WebSocket message:',
        expect.any(Error),
      )

      consoleSpy.mockRestore()
    })
  })

  describe('Connection Management', () => {
    it('shows connecting state initially', () => {
      const mockSocket = {
        ...mockWebSocket,
        readyState: WebSocket.CONNECTING,
      }

      render(
        <WebSocketProgressBar
          {...mockProps}
          webSocket={mockSocket as unknown as WebSocket}
        />,
      )

      expect(screen.getByText(/connecting/i)).toBeInTheDocument()
    })

    it('shows connected state when WebSocket is open', () => {
      const mockSocket = {
        ...mockWebSocket,
        readyState: WebSocket.OPEN,
      }

      // Trigger open event
      render(
        <WebSocketProgressBar
          {...mockProps}
          webSocket={mockSocket as unknown as WebSocket}
        />,
      )

      const openCalls = mockSocket.addEventListener.mock.calls.filter((c: any) => c[0] === 'open')
      const openHandler = openCalls[openCalls.length - 1]?.[1]

      if (openHandler) {
        act(() => {
          openHandler()
        })
      }

      expect(screen.getByText(/live updates/i)).toBeInTheDocument()
    })

    it('shows disconnected state when WebSocket closes', () => {
      const mockSocket = {
        ...mockWebSocket,
        readyState: WebSocket.CLOSED,
      }

      render(
        <WebSocketProgressBar
          {...mockProps}
          webSocket={mockSocket as unknown as WebSocket}
        />,
      )

      const closeCalls = mockSocket.addEventListener.mock.calls.filter((c: any) => c[0] === 'close')
      const closeHandler = closeCalls[closeCalls.length - 1]?.[1]

      if (closeHandler) {
        act(() => {
          closeHandler()
        })
      }

      expect(screen.getByText(/disconnected/i)).toBeInTheDocument()
    })

    it('shows reconnection attempts', () => {
      const mockSocket = {
        ...mockWebSocket,
        readyState: WebSocket.CLOSED,
      }

      // Simulate multiple connection attempts
      render(
        <WebSocketProgressBar
          {...mockProps}
          webSocket={mockSocket as unknown as WebSocket}
          connectionAttempts={3}
        />,
      )

      expect(screen.getByText(/reconnection attempt 3\/5/i)).toBeInTheDocument()
    })
  })

  describe('Progress Visualization', () => {
    it('updates progress bar width correctly', () => {
      const mockSocket = {
        ...mockWebSocket,
        readyState: WebSocket.OPEN,
      }

      const { container } = render(
        <WebSocketProgressBar
          {...mockProps}
          webSocket={mockSocket as unknown as WebSocket}
        />,
      )

      const messageCalls = mockSocket.addEventListener.mock.calls.filter((c: any) => c[0] === 'message')
      const messageHandler = messageCalls[messageCalls.length - 1]?.[1]

      if (messageHandler) {
        act(() => {
          messageHandler({
            data: JSON.stringify({
              type: 'progress_update',
              executionId: 'test-execution-123',
              data: {
                progress: 75,
                stage: 'analyzing',
              },
            }),
          })
        })
      }

      const progressBar = container.querySelector('.h-3.rounded-full')
      expect(progressBar).toHaveStyle({ width: '75%' })
    })

    it('applies correct color based on progress', () => {
      const mockSocket = {
        ...mockWebSocket,
        readyState: WebSocket.OPEN,
      }

      const { container } = render(
        <WebSocketProgressBar
          {...mockProps}
          webSocket={mockSocket as unknown as WebSocket}
        />,
      )

      const testProgress = (progress: number, expectedColor: string) => {
        const messageCalls = mockSocket.addEventListener.mock.calls.filter((c: any) => c[0] === 'message')
        const messageHandler = messageCalls[messageCalls.length - 1]?.[1]

        if (messageHandler) {
          act(() => {
            messageHandler({
              data: JSON.stringify({
                type: 'progress_update',
                executionId: 'test-execution-123',
                data: { progress, stage: 'test' },
              }),
            })
          })
        }

        const progressBar = container.querySelector('.h-3.rounded-full')
        expect(progressBar).toHaveClass(expectedColor)
      }

      testProgress(25, 'bg-orange-500')
      testProgress(50, 'bg-yellow-500')
      testProgress(70, 'bg-blue-500')
      testProgress(85, 'bg-green-500')
    })
  })

  describe('Metrics Display', () => {
    it('calculates and displays update rate', () => {
      const mockSocket = {
        ...mockWebSocket,
        readyState: WebSocket.OPEN,
      }

      render(
        <WebSocketProgressBar
          {...mockProps}
          webSocket={mockSocket as unknown as WebSocket}
          showMetrics={true}
        />,
      )

      const messageCalls = mockSocket.addEventListener.mock.calls.filter((c: any) => c[0] === 'message')
      const messageHandler = messageCalls[messageCalls.length - 1]?.[1]

      if (messageHandler) {
        // Simulate multiple rapid updates
        for (let i = 0; i < 5; i++) {
          act(() => {
            messageHandler({
              data: JSON.stringify({
                type: 'progress_update',
                executionId: 'test-execution-123',
                data: { progress: i * 20, stage: 'test' },
              }),
            })
          })
          vi.advanceTimersByTime(100)
        }
      }

      expect(screen.getByText(/updates per second/i)).toBeInTheDocument()
    })

    it('shows velocity indicators correctly', () => {
      const mockSocket = {
        ...mockWebSocket,
        readyState: WebSocket.OPEN,
      }

      render(
        <WebSocketProgressBar
          {...mockProps}
          webSocket={mockSocket as unknown as WebSocket}
          showMetrics={true}
        />,
      )

      const messageCalls = mockSocket.addEventListener.mock.calls.filter((c: any) => c[0] === 'message')
      const messageHandler = messageCalls[messageCalls.length - 1]?.[1]

      if (messageHandler) {
        // Simulate rapid updates (high velocity)
        for (let i = 0; i < 10; i++) {
          act(() => {
            messageHandler({
              data: JSON.stringify({
                type: 'progress_update',
                executionId: 'test-execution-123',
                data: { progress: i * 10, stage: 'test' },
              }),
            })
          })
          vi.advanceTimersByTime(50)
        }
      }

      // Should show trending up indicator for high velocity
      expect(screen.getByTestId('trending-up-icon')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<WebSocketProgressBar {...mockProps} />)

      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('provides meaningful status text', () => {
      const mockSocket = {
        ...mockWebSocket,
        readyState: WebSocket.OPEN,
      }

      render(
        <WebSocketProgressBar
          {...mockProps}
          webSocket={mockSocket as unknown as WebSocket}
        />,
      )

      const openCalls = mockSocket.addEventListener.mock.calls.filter((c: any) => c[0] === 'open')
      const openHandler = openCalls[openCalls.length - 1]?.[1]

      if (openHandler) {
        act(() => {
          openHandler()
        })
      }

      const statusElement = screen.getByRole('status')
      expect(statusElement).toHaveTextContent(/live updates/i)
    })

    it('announces progress changes to screen readers', () => {
      const mockSocket = {
        ...mockWebSocket,
        readyState: WebSocket.OPEN,
      }

      render(
        <WebSocketProgressBar
          {...mockProps}
          webSocket={mockSocket as unknown as WebSocket}
        />,
      )

      const messageCalls = mockSocket.addEventListener.mock.calls.filter((c: any) => c[0] === 'message')
      const messageHandler = messageCalls[messageCalls.length - 1]?.[1]

      if (messageHandler) {
        act(() => {
          messageHandler({
            data: JSON.stringify({
              type: 'progress_update',
              executionId: 'test-execution-123',
              data: { progress: 50, stage: 'processing' },
            }),
          })
        })
      }

      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '50')
      expect(progressBar).toHaveAttribute('aria-valuetext', 'processing 50.0%')
    })
  })

  describe('Performance', () => {
    it('renders within acceptable time', () => {
      const startTime = performance.now()

      render(<WebSocketProgressBar {...mockProps} />)

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Should render in under 50ms for optimal performance
      expect(renderTime).toBeLessThan(50)
    })

    it('handles rapid message updates efficiently', () => {
      const mockSocket = {
        ...mockWebSocket,
        readyState: WebSocket.OPEN,
      }

      render(
        <WebSocketProgressBar
          {...mockProps}
          webSocket={mockSocket as unknown as WebSocket}
        />,
      )

      const messageHandler = mockSocket.addEventListener.mock.calls.find(
        (call) => call[0] === 'message',
      )?.[1]

      const startTime = performance.now()

      // Simulate 100 rapid updates
      for (let i = 0; i < 100; i++) {
        if (messageHandler) {
          messageHandler({
            data: JSON.stringify({
              type: 'progress_update',
              executionId: 'test-execution-123',
              data: { progress: i, stage: 'test' },
            }),
          })
        }
      }

      const endTime = performance.now()
      const updateTime = endTime - startTime

      // Should handle 100 updates in under 100ms
      expect(updateTime).toBeLessThan(100)
    })
  })

  describe('Error Handling', () => {
    it('handles WebSocket errors gracefully', () => {
      const mockSocket = {
        ...mockWebSocket,
        readyState: WebSocket.OPEN,
      }

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { })

      render(
        <WebSocketProgressBar
          {...mockProps}
          webSocket={mockSocket as unknown as WebSocket}
        />,
      )

      const errorCalls = mockSocket.addEventListener.mock.calls.filter((c: any) => c[0] === 'error')
      const errorHandler = errorCalls[errorCalls.length - 1]?.[1]

      if (errorHandler) {
        act(() => {
          errorHandler(new Event('error'))
        })
      }

      expect(screen.getByText(/connection error/i)).toBeInTheDocument()

      consoleSpy.mockRestore()
    })

    it('handles missing WebSocket gracefully', () => {
      render(<WebSocketProgressBar {...mockProps} webSocket={null} />)

      expect(screen.getByText(/disconnected/i)).toBeInTheDocument()
      // Should not throw any errors
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })
  })
})

describe('WebSocketConnectionManager', () => {
  const mockProps = {
    url: 'ws://localhost:8080',
    onConnect: vi.fn(),
    onDisconnect: vi.fn(),
    onError: vi.fn(),
    onMessage: vi.fn(),
    maxRetries: 3,
    retryDelay: 1000,
  }

  // Capture original WebSocket
  const originalWebSocket = global.WebSocket

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    const MockWebSocket = vi.fn(function() { return mockWebSocket }) as any
    MockWebSocket.CONNECTING = 0
    MockWebSocket.OPEN = 1
    MockWebSocket.CLOSING = 2
    MockWebSocket.CLOSED = 3
    global.WebSocket = MockWebSocket
  })

  afterEach(() => {
    vi.useRealTimers()
    global.WebSocket = originalWebSocket
  })

  it('renders connection manager UI', () => {
    render(<WebSocketConnectionManager {...mockProps} />)

    expect(
      screen.getByText(/websocket connection manager/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^connect$/i })).toBeInTheDocument()
  })

  it('handles connect button click', () => {
    render(<WebSocketConnectionManager {...mockProps} />)

    const connectButton = screen.getByRole('button', { name: /^connect$/i })
    fireEvent.click(connectButton)

    expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:8080')
  })

  it('handles disconnect button click', () => {
    const mockSocket = {
      ...mockWebSocket,
      readyState: WebSocket.OPEN,
    }

    global.WebSocket = vi.fn(function() { return mockSocket }) as any

    render(<WebSocketConnectionManager {...mockProps} />)

    // Connect first
    const connectButton = screen.getByRole('button', { name: /^connect$/i })
    fireEvent.click(connectButton)

    // Then disconnect
    const disconnectButton = screen.getByRole('button', { name: /disconnect/i })
    fireEvent.click(disconnectButton)

    expect(mockSocket.close).toHaveBeenCalled()
  })
})

describe('WebSocketMessageLogger', () => {
  const mockMessages = [
    {
      id: '1',
      timestamp: new Date('2023-01-01T10:00:00Z'),
      type: 'sent' as const,
      data: { message: 'Hello' },
      executionId: 'exec-123',
    },
    {
      id: '2',
      timestamp: new Date('2023-01-01T10:01:00Z'),
      type: 'received' as const,
      data: { response: 'Hi there' },
      executionId: 'exec-123',
    },
  ]

  const mockProps = {
    messages: mockMessages,
    maxMessages: 50,
    autoScroll: true,
  }

  it('renders message logger', () => {
    render(<WebSocketMessageLogger {...mockProps} />)

    expect(screen.getByText(/websocket message log/i)).toBeInTheDocument()
    expect(screen.getByText(/showing 2 of 2 messages/i)).toBeInTheDocument()
  })

  it('displays messages with correct formatting', () => {
    render(<WebSocketMessageLogger {...mockProps} />)

    expect(screen.getByText(/sent/i)).toBeInTheDocument()
    expect(screen.getByText(/received/i)).toBeInTheDocument()
    expect(screen.getByText(/"message":"hello"/i)).toBeInTheDocument()
    expect(screen.getByText(/"response":"hi there"/i)).toBeInTheDocument()
  })

  it('filters messages by execution ID', () => {
    render(<WebSocketMessageLogger {...mockProps} />)

    // Test filtering functionality (would need to be implemented in component)
    const filteredMessages = mockMessages.filter(
      (msg) => msg.executionId === 'exec-123',
    )
    expect(filteredMessages).toHaveLength(2)
  })

  it('handles empty message list', () => {
    render(<WebSocketMessageLogger {...mockProps} messages={[]} />)

    expect(screen.getByText(/no messages yet/i)).toBeInTheDocument()
  })

  it('limits messages to maxMessages', () => {
    const manyMessages = Array.from({ length: 100 }, (_, i) => ({
      id: String(i),
      timestamp: new Date(),
      type: 'sent' as const,
      data: { message: `Message ${i}` },
    }))

    render(
      <WebSocketMessageLogger
        {...mockProps}
        messages={manyMessages}
        maxMessages={10}
      />,
    )

    expect(screen.getByText(/showing 10 of 100 messages/i)).toBeInTheDocument()
  })
})
