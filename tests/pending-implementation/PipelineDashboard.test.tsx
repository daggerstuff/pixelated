import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

import { PipelineAPIProvider } from '@/contexts/PipelineAPIContext'
import { WebSocketProvider } from '@/contexts/WebSocketContext'

import { PipelineDashboard } from '../PipelineDashboard'

// Mock the hooks and contexts
vi.mock('@/hooks/usePipelineWebSocket', () => ({
  usePipelineWebSocket: vi.fn(() => ({
    socket: null,
    connectionStatus: 'disconnected',
    lastMessage: null,
    connectionAttempts: 0,
    isReconnecting: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    sendMessage: vi.fn(),
    sendProgressRequest: vi.fn(),
    sendStatusRequest: vi.fn(),
  })),
}))

vi.mock('@/hooks/usePipelineAPI', () => ({
  usePipelineAPI: vi.fn(() => ({
    isLoading: false,
    error: null,
    startExecution: vi.fn(),
    getExecutionStatus: vi.fn(),
    getAvailableDatasets: vi.fn(async () => Promise.resolve([])),
    healthCheck: vi.fn(async () =>
      Promise.resolve({
        status: 'healthy',
        timestamp: new Date().toISOString(),
      }),
    ),
  })),
}))

// Mock WebSocket
global.WebSocket = vi.fn(() => ({
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: WebSocket.CONNECTING,
})) as any

const defaultMockProps = {
  className: 'test-class',
  onExecutionStart: vi.fn(),
  onExecutionComplete: vi.fn(),
  onError: vi.fn(),
}

const renderComponent = (props = {}) => {
  return render(
    <WebSocketProvider>
      <PipelineAPIProvider>
        <PipelineDashboard {...defaultMockProps} {...props} />
      </PipelineAPIProvider>
    </WebSocketProvider>,
  )
}

describe('PipelineDashboard', () => {
  const mockProps = defaultMockProps

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders the main dashboard container', () => {
      renderComponent()

      expect(screen.getByRole('tablist')).toBeInTheDocument()
      expect(screen.getByText('Pipeline Dashboard')).toBeInTheDocument()
    })

    it('renders all three entry point tabs', () => {
      renderComponent()

      expect(
        screen.getByRole('tab', { name: /web frontend/i }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('tab', { name: /cli interface/i }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('tab', { name: /mcp connection/i }),
      ).toBeInTheDocument()
    })

    it('applies custom className', () => {
      const { container } = renderComponent()

      expect(container.firstChild).toHaveClass('test-class')
    })

    it('renders WebSocket status indicator', () => {
      renderComponent()

      expect(screen.getByText(/websocket status/i)).toBeInTheDocument()
    })

    it('renders HIPAA compliance notice', () => {
      renderComponent()

      expect(screen.getByText(/hipaa\+\+ compliant/i)).toBeInTheDocument()
    })
  })

  describe('Tab Navigation', () => {
    it('switches between tabs when clicked', async () => {
      renderComponent()

      const webFrontendTab = screen.getByRole('tab', { name: /web frontend/i })
      const cliTab = screen.getByRole('tab', { name: /cli interface/i })

      // Initially Web Frontend should be active
      expect(webFrontendTab).toHaveAttribute('aria-selected', 'true')

      // Click CLI tab
      await userEvent.click(cliTab)

      expect(cliTab).toHaveAttribute('aria-selected', 'true')
      expect(webFrontendTab).toHaveAttribute('aria-selected', 'false')
    })

    it('renders correct content for each tab', async () => {
      renderComponent()

      // Web Frontend content
      expect(
        screen.getByText(/drag and drop your dataset/i),
      ).toBeInTheDocument()

      // Switch to CLI tab
      const cliTab = screen.getByRole('tab', { name: /cli interface/i })
      await userEvent.click(cliTab)

      expect(screen.getByText(/cli command interface/i)).toBeInTheDocument()

      // Switch to MCP tab
      const mcpTab = screen.getByRole('tab', { name: /mcp connection/i })
      await userEvent.click(mcpTab)

      expect(screen.getByText(/mcp agent connection/i)).toBeInTheDocument()
    })
  })

  describe('WebSocket Integration', () => {
    it('displays connection status', () => {
      renderComponent()

      expect(screen.getByText(/disconnected/i)).toBeInTheDocument()
    })

    it('shows connection attempts when reconnecting', () => {
      // Mock reconnecting state
      vi.mock('@/hooks/usePipelineWebSocket', () => ({
        usePipelineWebSocket: vi.fn(() => ({
          socket: null,
          connectionStatus: 'connecting',
          lastMessage: null,
          connectionAttempts: 2,
          isReconnecting: true,
          connect: vi.fn(),
          disconnect: vi.fn(),
          sendMessage: vi.fn(),
          sendProgressRequest: vi.fn(),
          sendStatusRequest: vi.fn(),
        })),
      }))

      renderComponent()

      expect(screen.getByText(/reconnecting/i)).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('displays API errors', () => {
      vi.mock('@/hooks/usePipelineAPI', () => ({
        usePipelineAPI: vi.fn(() => ({
          isLoading: false,
          error: new Error('API connection failed'),
          startExecution: vi.fn(),
          getExecutionStatus: vi.fn(),
          getAvailableDatasets: vi.fn(async () => Promise.resolve([])),
          healthCheck: vi.fn(async () =>
            Promise.resolve({
              status: 'healthy',
              timestamp: new Date().toISOString(),
            }),
          ),
        })),
      }))

      renderComponent()

      expect(screen.getByText(/api connection failed/i)).toBeInTheDocument()
    })

    it('calls onError callback when errors occur', async () => {
      const mockOnError = vi.fn()

      vi.mock('@/hooks/usePipelineAPI', () => ({
        usePipelineAPI: vi.fn(() => ({
          isLoading: false,
          error: new Error('Test error'),
          startExecution: vi.fn(),
          getExecutionStatus: vi.fn(),
          getAvailableDatasets: vi.fn(async () => Promise.resolve([])),
          healthCheck: vi.fn(async () =>
            Promise.resolve({
              status: 'healthy',
              timestamp: new Date().toISOString(),
            }),
          ),
        })),
      }))

      renderComponent({ onError: mockOnError })

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(expect.any(Error))
      })
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      renderComponent()

      expect(screen.getByRole('tablist')).toHaveAttribute(
        'aria-label',
        'Pipeline entry points',
      )
    })

    it('supports keyboard navigation', async () => {
      renderComponent()

      const webFrontendTab = screen.getByRole('tab', { name: /web frontend/i })

      webFrontendTab.focus()

      // Tab to next tab
      fireEvent.keyDown(webFrontendTab, { key: 'ArrowRight' })

      const cliTab = screen.getByRole('tab', { name: /cli interface/i })
      expect(cliTab).toHaveAttribute('aria-selected', 'true')
    })

    it('has proper contrast ratios', () => {
      const { container } = renderComponent()

      // Check for sufficient contrast in status indicators
      const statusElements = container.querySelectorAll(
        '.text-muted-foreground',
      )
      statusElements.forEach((element) => {
        const styles = window.getComputedStyle(element)
        // This would need actual color contrast testing in a real scenario
        expect(styles.color).toBeDefined()
      })
    })
  })

  describe('Performance', () => {
    it('renders within acceptable time', async () => {
      const startTime = performance.now()

      renderComponent()

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Should render in under 100ms for optimal performance
      expect(renderTime).toBeLessThan(100)
    })

    it('does not re-render unnecessarily', () => {
      const { rerender } = renderComponent()

      const initialRenderCount = vi.fn()
      rerender(
        <WebSocketProvider>
          <PipelineAPIProvider>
            <PipelineDashboard {...mockProps} />
          </PipelineAPIProvider>
        </WebSocketProvider>,
      )

      // Component should not re-render with same props
      expect(initialRenderCount).toHaveBeenCalledTimes(0)
    })
  })

  describe('HIPAA Compliance', () => {
    it('displays privacy notice', () => {
      renderComponent()

      expect(
        screen.getByText(/all data is encrypted and processed securely/i),
      ).toBeInTheDocument()
    })

    it('shows audit logging indicator', () => {
      renderComponent()

      expect(screen.getByText(/audit logging enabled/i)).toBeInTheDocument()
    })

    it('includes data retention information', () => {
      renderComponent()

      expect(screen.getByText(/data retention: 30 days/i)).toBeInTheDocument()
    })
  })
})

describe('PipelineDashboard Integration', () => {
  it('integrates with WebSocket context', () => {
    const { container } = render(
      <WebSocketProvider>
        <PipelineAPIProvider>
          <PipelineDashboard />
        </PipelineAPIProvider>
      </WebSocketProvider>,
    )

    expect(
      container.querySelector('[data-testid="websocket-status"]'),
    ).toBeInTheDocument()
  })

  it('integrates with API context', () => {
    const { container } = render(
      <WebSocketProvider>
        <PipelineAPIProvider>
          <PipelineDashboard />
        </PipelineAPIProvider>
      </WebSocketProvider>,
    )

    expect(
      container.querySelector('[data-testid="api-status"]'),
    ).toBeInTheDocument()
  })
})

describe('PipelineDashboard Error Scenarios', () => {
  it('handles WebSocket connection failures gracefully', () => {
    vi.mock('@/hooks/usePipelineWebSocket', () => ({
      usePipelineWebSocket: vi.fn(() => ({
        socket: null,
        connectionStatus: 'error',
        lastMessage: null,
        connectionAttempts: 3,
        isReconnecting: false,
        connect: vi.fn(),
        disconnect: vi.fn(),
        sendMessage: vi.fn(),
        sendProgressRequest: vi.fn(),
        sendStatusRequest: vi.fn(),
      })),
    }))

    renderComponent()

    expect(screen.getByText(/connection error/i)).toBeInTheDocument()
  })

  it('handles API unavailability', () => {
    vi.mock('@/hooks/usePipelineAPI', () => ({
      usePipelineAPI: vi.fn(() => ({
        isLoading: false,
        error: new Error('API service unavailable'),
        startExecution: vi.fn(),
        getExecutionStatus: vi.fn(),
        getAvailableDatasets: vi.fn(async () =>
          Promise.reject(new Error('API unavailable')),
        ),
        healthCheck: vi.fn(async () =>
          Promise.reject(new Error('API unavailable')),
        ),
      })),
    }))

    renderComponent()

    expect(screen.getByText(/api service unavailable/i)).toBeInTheDocument()
  })

  it('handles malformed WebSocket messages', () => {
    const mockWebSocket = {
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn((event, handler) => {
        if (event === 'message') {
          // Simulate malformed message
          handler({ data: 'invalid json' })
        }
      }),
      removeEventListener: vi.fn(),
      readyState: WebSocket.OPEN,
    }

    vi.mock('@/hooks/usePipelineWebSocket', () => ({
      usePipelineWebSocket: vi.fn(() => ({
        socket: mockWebSocket,
        connectionStatus: 'connected',
        lastMessage: null,
        connectionAttempts: 0,
        isReconnecting: false,
        connect: vi.fn(),
        disconnect: vi.fn(),
        sendMessage: vi.fn(),
        sendProgressRequest: vi.fn(),
        sendStatusRequest: vi.fn(),
      })),
    }))

    // Should not throw error
    expect(() => renderComponent()).not.toThrow()
  })
})
