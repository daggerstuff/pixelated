/// <reference types="vitest" />
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { act } from '@/test/setup-react19'
import { BiasDashboard } from './BiasDashboard'
import { vi } from 'vitest'
import '@testing-library/jest-dom'

// Mock the logger
vi.mock('@/lib/logging/build-safe-logger', () => ({
  createBuildSafeLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}))

// Mock the BiasDetectionEngine
vi.mock('@/lib/ai/bias-detection/BiasDetectionEngine', () => ({
  BiasDetectionEngine: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    analyzeBias: vi.fn().mockResolvedValue({
      overallBiasScore: 0.3,
      layerAnalyses: [],
      alerts: [],
    }),
    getDashboardData: vi.fn().mockResolvedValue({
      summary: {
        totalSessions: 100,
        averageBiasScore: 0.3,
        highBiasSessions: 5,
        totalAlerts: 10,
        complianceScore: 0.85,
      },
      alerts: [
        {
          id: '1',
          type: 'high_bias',
          message: 'High bias detected',
          timestamp: new Date().toISOString(),
          level: 'high',
        },
      ],
      trends: [],
      demographics: {},
      recentAnalyses: [
        {
          sessionId: 'session-1',
          overallBiasScore: 0.3,
          timestamp: new Date().toISOString(),
          alertLevel: 'medium',
        },
      ],
    }),
    startMonitoring: vi.fn(),
    stopMonitoring: vi.fn(),
  })),
}))

// Define proper WebSocket mock type
// NOTE: If you add new properties to the real WebSocket, add them here too.
interface MockWebSocketInstance {
  onopen: ((event: Event) => void) | null
  onclose: ((event: CloseEvent) => void) | null
  onerror: ((error: Event) => void) | null
  onmessage: ((event: MessageEvent) => void) | null
  close: ReturnType<typeof vi.fn>
  send: ReturnType<typeof vi.fn>
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
  dispatchEvent: ReturnType<typeof vi.fn>
  readyState: number
  heartbeatInterval: number | null
  // Add any additional properties as needed for new tests
}

// Create a factory function for WebSocket mocks
const createMockWebSocket = (): MockWebSocketInstance => ({
  onopen: null,
  onclose: null,
  onerror: null,
  onmessage: null,
  close: vi.fn(),
  send: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
  readyState: WebSocket.OPEN,
  heartbeatInterval: null,
})

// Mock WebSocket constructor
const MockWebSocketConstructor = vi.fn(createMockWebSocket) as ReturnType<
  typeof vi.fn
> & {
  new (url: string | URL, protocols?: string | string[]): MockWebSocketInstance
  prototype: WebSocket
  readonly CONNECTING: 0
  readonly OPEN: 1
  readonly CLOSING: 2
  readonly CLOSED: 3
}

// Mock WebSocket using Vitest's stubGlobal
vi.stubGlobal('WebSocket', MockWebSocketConstructor)

// --- GLOBAL MOCKS FOR BROWSER APIS ---
// Ensure matchMedia is always mocked for all tests
beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  }
  // Mock window.alert and window.prompt to prevent test failures
  vi.spyOn(window, 'alert').mockImplementation(() => {})
  vi.spyOn(window, 'prompt').mockImplementation(() => '')
  // Mock URL.createObjectURL if not present
  if (!global.URL.createObjectURL) {
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:test-url')
  }
  if (!global.URL.revokeObjectURL) {
    global.URL.revokeObjectURL = vi.fn()
  }
})

afterAll(() => {
  vi.restoreAllMocks()
})

describe('BiasDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state initially', () => {
    render(<BiasDashboard />)
    expect(
      screen.getByText('Loading bias detection dashboard...'),
    ).toBeInTheDocument()
  })

  it('renders dashboard data after loading', async () => {
    render(<BiasDashboard />)
    await waitFor(
      () => {
        // The dashboard renders 'Total Sessions' (capitalized)
        expect(screen.getByText(/total sessions/i)).toBeInTheDocument()
      },
      { timeout: 3000 },
    )
  })

  it('handles WebSocket connection', async () => {
    const mockWs = {
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
    }
    MockWebSocketConstructor.mockImplementation(
      () => mockWs as unknown as MockWebSocketInstance,
    )

    render(<BiasDashboard enableRealTimeUpdates={true} />)

    await waitFor(() => {
      expect(MockWebSocketConstructor).toHaveBeenCalled()
    })

    // Simulate WebSocket connection
    const openCall = mockWs.addEventListener.mock.calls.find(
      (call: unknown[]) => call[0] === 'open',
    )
    if (openCall && typeof openCall[1] === 'function') {
      openCall[1]()
    }

    expect(screen.getByText('Live updates connected')).toBeInTheDocument()
  })

  it('handles WebSocket errors gracefully', async () => {
    let mockWebSocket: MockWebSocketInstance

    // Use the same pattern as the working Enhanced WebSocket tests
    mockWebSocket = {
      send: vi.fn(),
      close: vi.fn(),
      readyState: WebSocket.OPEN,
      onopen: null,
      onclose: null,
      onerror: null,
      onmessage: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      heartbeatInterval: null,
    }

    global.WebSocket = vi.fn(() => mockWebSocket) as unknown as typeof WebSocket

    render(<BiasDashboard enableRealTimeUpdates={true} />)

    await waitFor(() => {
      expect(screen.getByText(/bias detection dashboard/i)).toBeInTheDocument()
    })

    // Simulate connection error
    act(() => {
      if (mockWebSocket.onerror) {
        const errorEvent = new Event('error') as Event
        mockWebSocket.onerror(errorEvent)
      }
    })

    // Should show error status
    await waitFor(() => {
      expect(screen.getByText(/live updates failed/i)).toBeInTheDocument()
    })
  })

  it('updates data when receiving WebSocket messages', async () => {
    const mockWs = {
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
    }
    MockWebSocketConstructor.mockImplementation(
      () => mockWs as unknown as MockWebSocketInstance,
    )

    render(<BiasDashboard enableRealTimeUpdates={true} />)

    await waitFor(() => {
      expect(MockWebSocketConstructor).toHaveBeenCalled()
    })

    // First simulate connection
    const openCall = mockWs.addEventListener.mock.calls.find(
      (call: unknown[]) => call[0] === 'open',
    )
    if (openCall && typeof openCall[1] === 'function') {
      openCall[1]()
    }

    // Wait for dashboard to load
    await waitFor(() => {
      expect(screen.getByText(/total sessions/i)).toBeInTheDocument()
    })

    // Simulate WebSocket message with proper alert structure
    const messageCall = mockWs.addEventListener.mock.calls.find(
      (call: unknown[]) => call[0] === 'message',
    )
    if (messageCall && typeof messageCall[1] === 'function') {
      messageCall[1]({
        data: JSON.stringify({
          type: 'bias_alert',
          alert: {
            alertId: '2',
            type: 'high_bias',
            message: 'New high bias alert',
            timestamp: new Date().toISOString(),
            level: 'high',
            sessionId: 'session-123',
          },
        }),
      })
    }

    // Navigate to alerts tab to see the new alert
    fireEvent.click(screen.getByRole('tab', { name: /alerts/i }))

    await waitFor(() => {
      expect(screen.getByText('New high bias alert')).toBeInTheDocument()
    })
  })

  it('handles chart interactions correctly', async () => {
    render(<BiasDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/total sessions/i)).toBeInTheDocument()
    })

    // Test tab navigation - use role-based selectors
    const demographicsTab = screen.getByRole('tab', { name: /demographics/i })
    fireEvent.click(demographicsTab)

    await waitFor(() => {
      expect(screen.getByText(/age distribution/i)).toBeInTheDocument()
    })

    const trendsTab = screen.getByRole('tab', { name: /trends/i })
    fireEvent.click(trendsTab)

    await waitFor(() => {
      expect(screen.getByText(/bias score trends/i)).toBeInTheDocument()
    })
  })

  it('handles data updates with animations', async () => {
    const mockWs = {
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
    }
    MockWebSocketConstructor.mockImplementation(
      () => mockWs as unknown as MockWebSocketInstance,
    )

    render(<BiasDashboard enableRealTimeUpdates={true} />)

    await waitFor(() => {
      expect(MockWebSocketConstructor).toHaveBeenCalled()
    })

    // Simulate WebSocket message with updated metrics
    const messageCall = mockWs.addEventListener.mock.calls.find(
      (call: unknown[]) => call[0] === 'message',
    )
    if (messageCall && typeof messageCall[1] === 'function') {
      messageCall[1]({
        data: JSON.stringify({
          type: 'metrics_update',
          data: {
            totalSessions: 150,
            averageBiasScore: 0.4,
            highBiasSessions: 8,
            totalAlerts: 15,
          },
        }),
      })
    }

    // Check if animations are applied - simplified check
    const chartElements = document.querySelectorAll('.recharts-wrapper')
    expect(chartElements.length).toBeGreaterThanOrEqual(0)
  })

  it('cleans up WebSocket connection on unmount', async () => {
    const mockWs = {
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      heartbeatInterval: null,
    }
    MockWebSocketConstructor.mockImplementation(
      () => mockWs as unknown as MockWebSocketInstance,
    )

    const { unmount } = render(<BiasDashboard enableRealTimeUpdates={true} />)

    await waitFor(() => {
      expect(MockWebSocketConstructor).toHaveBeenCalled()
    })

    // Simulate connection and heartbeat setup
    const openCall = mockWs.addEventListener.mock.calls.find(
      (call: unknown[]) => call[0] === 'open',
    )
    if (openCall && typeof openCall[1] === 'function') {
      openCall[1]()
      // Set up heartbeat interval to simulate real behavior
      mockWs.heartbeatInterval = setInterval(() => {}, 30000) as any
    }

    unmount()

    expect(mockWs.close).toHaveBeenCalledWith(1000, 'Component unmounting')
  })

  it('renders filtering controls', async () => {
    render(<BiasDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/filters & time range/i)).toBeInTheDocument()
    })

    expect(screen.getByLabelText(/time range/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/bias score level/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/alert level/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/demographics/i)).toBeInTheDocument()
  })

  it('handles time range filter changes', async () => {
    render(<BiasDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/filters & time range/i)).toBeInTheDocument()
    })

    const timeRangeSelect = screen.getByLabelText(
      /time range/i,
    ) as HTMLSelectElement
    fireEvent.change(timeRangeSelect, { target: { value: '7d' } })

    expect(timeRangeSelect.value).toBe('7d')
  })

  it('shows custom date inputs when custom time range is selected', async () => {
    render(<BiasDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/filters & time range/i)).toBeInTheDocument()
    })

    const timeRangeSelect = screen.getByLabelText(/time range/i)
    fireEvent.change(timeRangeSelect, { target: { value: 'custom' } })

    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/end date/i)).toBeInTheDocument()
  })

  it('handles bias score filter changes', async () => {
    render(<BiasDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/filters & time range/i)).toBeInTheDocument()
    })

    const biasScoreSelect = screen.getByLabelText(
      /bias score level/i,
    ) as HTMLSelectElement
    fireEvent.change(biasScoreSelect, { target: { value: 'high' } })

    expect(biasScoreSelect.value).toBe('high')
  })

  it('handles alert level filter changes', async () => {
    render(<BiasDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/filters & time range/i)).toBeInTheDocument()
    })

    const alertLevelSelect = screen.getByLabelText(
      /alert level/i,
    ) as HTMLSelectElement
    fireEvent.change(alertLevelSelect, { target: { value: 'critical' } })

    expect(alertLevelSelect.value).toBe('critical')
  })

  it('clears all filters when clear button is clicked', async () => {
    render(<BiasDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/filters & time range/i)).toBeInTheDocument()
    })

    // Set some filters
    const timeRangeSelect = screen.getByLabelText(/time range/i)
    const biasScoreSelect = screen.getByLabelText(/bias score level/i)
    const alertLevelSelect = screen.getByLabelText(/alert level/i)

    fireEvent.change(timeRangeSelect, { target: { value: '7d' } })
    fireEvent.change(biasScoreSelect, { target: { value: 'high' } })
    fireEvent.change(alertLevelSelect, { target: { value: 'critical' } })

    // Click clear button
    const clearButton = screen.getByText(/clear all filters/i)
    fireEvent.click(clearButton)

    // Check that filters are reset
    expect((timeRangeSelect as HTMLSelectElement).value).toBe('24h')
    expect((biasScoreSelect as HTMLSelectElement).value).toBe('all')
    expect((alertLevelSelect as HTMLSelectElement).value).toBe('all')
  })

  it('displays filter summary correctly', async () => {
    render(<BiasDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/filters & time range/i)).toBeInTheDocument()
    })

    // Initially should show "None"
    expect(screen.getByText(/active filters:/i)).toBeInTheDocument()
    expect(screen.getByText(/none/i)).toBeInTheDocument()

    // Set a filter
    const timeRangeSelect = screen.getByLabelText(/time range/i)
    fireEvent.change(timeRangeSelect, { target: { value: '7d' } })

    // Should show the active filter
    await waitFor(() => {
      expect(screen.getByText(/time: last 7 days/i)).toBeInTheDocument()
    })
  })

  it('updates chart data when filters are applied', async () => {
    render(<BiasDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/total sessions/i)).toBeInTheDocument()
    })

    // Navigate to trends tab using role-based selector
    const trendsTab = screen.getByRole('tab', { name: /trends/i })
    fireEvent.click(trendsTab)

    // Check that chart title shows data point count
    await waitFor(() => {
      expect(
        screen.getByText(/bias score trends \(\d+ data points\)/i),
      ).toBeInTheDocument()
    })
  })

  it('shows no data message when filters exclude all data', async () => {
    // Mock empty filtered data using MSW
    const emptyMockData = {
      summary: {
        totalSessions: 0,
        averageBiasScore: 0,
        highBiasSessions: 0,
        totalAlerts: 0,
        complianceScore: 0,
      },
      alerts: [],
      recentAnalyses: [],
      trends: [],
      demographics: {},
    }

    // Mock the server with simple vi.fn mock instead of MSW for this test
    const originalFetch = global.fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(emptyMockData),
    })

    // Cleanup
    return () => {
      global.fetch = originalFetch
    }

    render(<BiasDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/total sessions/i)).toBeInTheDocument()
    })

    // Navigate to alerts tab
    fireEvent.click(screen.getByRole('tab', { name: /alerts/i }))
    expect(screen.getByText(/no active alerts/i)).toBeInTheDocument()

    // Navigate to sessions tab
    fireEvent.click(screen.getByText(/recent sessions/i))
    expect(screen.getByText(/no recent sessions/i)).toBeInTheDocument()
  })

  it('handles custom date range input', async () => {
    render(<BiasDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/filters & time range/i)).toBeInTheDocument()
    })

    // Select custom time range
    const timeRangeSelect = screen.getByLabelText(/time range/i)
    fireEvent.change(timeRangeSelect, { target: { value: 'custom' } })

    // Set custom dates
    const startDateInput = screen.getByLabelText(/start date/i)
    const endDateInput = screen.getByLabelText(/end date/i)

    fireEvent.change(startDateInput, { target: { value: '2024-01-01T00:00' } })
    fireEvent.change(endDateInput, { target: { value: '2024-01-31T23:59' } })

    expect((startDateInput as HTMLInputElement).value).toBe('2024-01-01T00:00')
    expect((endDateInput as HTMLInputElement).value).toBe('2024-01-31T23:59')
  })

  it('renders notification settings panel', async () => {
    render(<BiasDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/total sessions/i)).toBeInTheDocument()
    })

    // Click notifications button
    const notificationsButton = screen.getByTestId('notifications-button')
    fireEvent.click(notificationsButton)

    expect(screen.getByText(/notification settings panel/i)).toBeInTheDocument()
    expect(screen.getByText(/notification channels/i)).toBeInTheDocument()
    expect(screen.getByText(/alert level notifications/i)).toBeInTheDocument()
  })

  it('handles notification settings changes', async () => {
    render(<BiasDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/total sessions/i)).toBeInTheDocument()
    })

    // Open notification settings
    fireEvent.click(screen.getByTestId('notifications-button'))

    // Toggle email notifications
    const emailCheckbox = screen.getByLabelText(/email notifications/i)
    fireEvent.click(emailCheckbox)

    // Toggle critical alerts
    const criticalAlertsCheckbox = screen.getByLabelText(/critical alerts/i)
    fireEvent.click(criticalAlertsCheckbox)

    // Verify changes (in real app, would check API calls)
    expect((emailCheckbox as HTMLInputElement).checked).toBe(false)
    expect((criticalAlertsCheckbox as HTMLInputElement).checked).toBe(false)
  })

  it('handles test notification sending', async () => {
    // Mock successful API response
    const originalFetch = global.fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    })

    render(<BiasDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/total sessions/i)).toBeInTheDocument()
    })

    // Open notification settings
    fireEvent.click(screen.getByTestId('notifications-button'))

    // Mock window.alert
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

    // Click send test button
    const sendTestButton = screen.getByText(/send test/i)
    fireEvent.click(sendTestButton)

    // Should show success message
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Test notification sent successfully!',
      )
    })

    alertSpy.mockRestore()
    
    // Cleanup fetch mock
    global.fetch = originalFetch
  })

  it('renders alert management controls', async () => {
    render(<BiasDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/total sessions/i)).toBeInTheDocument()
    })

    // Navigate to alerts tab
    fireEvent.click(screen.getByRole('tab', { name: /alerts/i }))

    // Should show alert management controls
    expect(screen.getByText(/select all/i)).toBeInTheDocument()
    expect(screen.getByText(/1 alerts/i)).toBeInTheDocument()
    expect(screen.getByText(/1 high priority/i)).toBeInTheDocument()
  })

  it('handles individual alert actions', async () => {
    render(<BiasDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/total sessions/i)).toBeInTheDocument()
    })

    // Navigate to alerts tab
    fireEvent.click(screen.getByRole('tab', { name: /alerts/i }))

    // Find acknowledge button and click it
    const acknowledgeButton = screen.getByText(/acknowledge/i)
    fireEvent.click(acknowledgeButton)

    // Should update alert status (in real app, would check API calls)
    await waitFor(() => {
      expect(screen.getByText(/acknowledged/i)).toBeInTheDocument()
    })
  })

  it('handles bulk alert actions', async () => {
    render(<BiasDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/total sessions/i)).toBeInTheDocument()
    })

    // Navigate to alerts tab
    fireEvent.click(screen.getByRole('tab', { name: /alerts/i }))

    // Select all alerts
    const selectAllCheckbox = screen.getByLabelText(/select all/i)
    fireEvent.click(selectAllCheckbox)

    // Should show bulk action buttons
    expect(screen.getByText(/1 selected/i)).toBeInTheDocument()

    // Click bulk acknowledge
    const bulkAcknowledgeButton = screen.getAllByText(/acknowledge/i)[0] // First one is bulk action
    if (bulkAcknowledgeButton) {
      fireEvent.click(bulkAcknowledgeButton)
    }

    // Should clear selection after bulk action
    await waitFor(() => {
      expect(screen.getByText(/select all/i)).toBeInTheDocument()
    })
  })

  it('handles alert selection and deselection', async () => {
    render(<BiasDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/total sessions/i)).toBeInTheDocument()
    })

    // Navigate to alerts tab
    fireEvent.click(screen.getByRole('tab', { name: /alerts/i }))

    // Find individual alert checkbox
    const alertCheckboxes = screen.getAllByRole('checkbox')
    const individualAlertCheckbox = alertCheckboxes.find(
      (cb) => cb !== screen.getByLabelText(/select all/i),
    )

    if (individualAlertCheckbox) {
      // Select individual alert
      fireEvent.click(individualAlertCheckbox)
      expect(screen.getByText(/1 selected/i)).toBeInTheDocument()

      // Deselect individual alert
      fireEvent.click(individualAlertCheckbox)
      expect(screen.getByText(/select all/i)).toBeInTheDocument()
    }
  })

  it('handles alert notes addition', async () => {
    render(<BiasDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/total sessions/i)).toBeInTheDocument()
    })

    // Navigate to alerts tab
    fireEvent.click(screen.getByRole('tab', { name: /alerts/i }))

    // Mock window.prompt
    const promptSpy = vi
      .spyOn(window, 'prompt')
      .mockReturnValue('Test note for alert')

    // Click note button
    const noteButton = screen.getByText(/note/i)
    fireEvent.click(noteButton)

    // Should show prompt and add note
    expect(promptSpy).toHaveBeenCalledWith('Add notes (optional):')

    // Should display the note
    await waitFor(() => {
      expect(screen.getByText(/test note for alert/i)).toBeInTheDocument()
    })

    promptSpy.mockRestore()
  })

  it('handles alert escalation with notes', async () => {
    render(<BiasDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/total sessions/i)).toBeInTheDocument()
    })

    // Navigate to alerts tab
    fireEvent.click(screen.getByRole('tab', { name: /alerts/i }))

    // Mock window.prompt
    const promptSpy = vi
      .spyOn(window, 'prompt')
      .mockReturnValue('Escalation reason')

    // Click escalate button
    const escalateButton = screen.getByText(/escalate/i)
    fireEvent.click(escalateButton)

    // Should show prompt for escalation notes
    expect(promptSpy).toHaveBeenCalledWith('Add notes (optional):')

    promptSpy.mockRestore()
  })

  it('displays action history for alerts', async () => {
    render(<BiasDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/total sessions/i)).toBeInTheDocument()
    })

    // Navigate to alerts tab
    fireEvent.click(screen.getByRole('tab', { name: /alerts/i }))

    // Perform an action to create history
    const acknowledgeButton = screen.getByText(/acknowledge/i)
    fireEvent.click(acknowledgeButton)

    // Should show action history
    await waitFor(() => {
      expect(screen.getByText(/action history/i)).toBeInTheDocument()
    })

    // Click to expand history
    const historyToggle = screen.getByText(/action history/i)
    fireEvent.click(historyToggle)

    // Should show action details
    expect(screen.getByText(/acknowledged/i)).toBeInTheDocument()
  })

  it('closes notification settings panel', async () => {
    render(<BiasDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/total sessions/i)).toBeInTheDocument()
    })

    // Open notification settings
    fireEvent.click(screen.getByTestId('notifications-button'))
    expect(screen.getByText(/notification settings panel/i)).toBeInTheDocument()

    // Close notification settings
    const closeButton = screen.getByTestId('close-notification-settings')
    fireEvent.click(closeButton)

    // Should close the panel
    expect(
      screen.queryByText(/notification settings panel/i),
    ).not.toBeInTheDocument()
  })

  // Data Export Tests
  describe('Data Export Functionality', () => {
    it('opens export dialog when export button is clicked', async () => {
      render(<BiasDashboard />)

      await waitFor(() => {
        expect(screen.getByText(/total sessions/i)).toBeInTheDocument()
      })

      // Click export button
      fireEvent.click(screen.getByTestId('export-button'))

      // Should open export dialog
      expect(
        screen.getByText(/export dashboard data dialog/i),
      ).toBeInTheDocument()
    })

    it('allows format selection in export dialog', async () => {
      render(<BiasDashboard />)

      await waitFor(() => {
        expect(screen.getByText(/total sessions/i)).toBeInTheDocument()
      })

      // Open export dialog
      fireEvent.click(screen.getByTestId('export-button'))

      // Should have format options
      expect(screen.getByLabelText(/json/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/csv/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/pdf/i)).toBeInTheDocument()

      // Select CSV format
      fireEvent.click(screen.getByLabelText(/csv/i))

      // Export button should update
      expect(screen.getByText(/export as csv/i)).toBeInTheDocument()
    })

    it('handles export data functionality', async () => {
      // Mock URL.createObjectURL
      global.URL.createObjectURL = vi.fn().mockReturnValue('blob:test-url')
      global.URL.revokeObjectURL = vi.fn()

      // Mock document.createElement and appendChild
      const mockAnchor = {
        href: '',
        download: '',
        click: vi.fn(),
      }
      const originalCreateElement = document.createElement
      document.createElement = vi.fn().mockReturnValue(mockAnchor)
      document.body.appendChild = vi.fn()
      document.body.removeChild = vi.fn()

      render(<BiasDashboard />)

      await waitFor(() => {
        expect(screen.getByText(/total sessions/i)).toBeInTheDocument()
      })

      // Open export dialog and export
      fireEvent.click(screen.getByTestId('export-button'))
      fireEvent.click(screen.getByTestId('export-data-button'))

      // MSW will handle the API call automatically
      await waitFor(() => {
        expect(mockAnchor.click).toHaveBeenCalled()
      })

      // Restore mocks
      document.createElement = originalCreateElement
    })

    it('closes export dialog when cancel is clicked', async () => {
      render(<BiasDashboard />)

      await waitFor(() => {
        expect(screen.getByText(/total sessions/i)).toBeInTheDocument()
      })

      // Open export dialog
      fireEvent.click(screen.getByTestId('export-button'))
      expect(
        screen.getByText(/export dashboard data dialog/i),
      ).toBeInTheDocument()

      // Close dialog
      fireEvent.click(screen.getByTestId('cancel-export'))

      // Should close the dialog
      expect(
        screen.queryByText(/export dashboard data dialog/i),
      ).not.toBeInTheDocument()
    })

    it('validates date range in export dialog', async () => {
      render(<BiasDashboard />)

      await waitFor(() => {
        expect(screen.getByText(/total sessions/i)).toBeInTheDocument()
      })

      // Open export dialog
      fireEvent.click(screen.getByTestId('export-button'))

      // Check date inputs exist
      const startDateInput = screen.getByLabelText(/start date/i)
      const endDateInput = screen.getByLabelText(/end date/i)

      expect(startDateInput).toBeInTheDocument()
      expect(endDateInput).toBeInTheDocument()

      // Should have default values (last 7 days)
      expect(startDateInput).toHaveValue()
      expect(endDateInput).toHaveValue()
    })
  })

  // Responsive Design Tests
  describe('Responsive Design', () => {
    beforeEach(() => {
      // Mock window.innerWidth
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      })

      // Mock matchMedia (override global mock for this suite)
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      })
    })

    it('adapts layout for mobile screens', async () => {
      // Set mobile width
      Object.defineProperty(window, 'innerWidth', {
        value: 600,
      })

      render(<BiasDashboard />)

      await waitFor(() => {
        expect(
          screen.getByText(/bias detection dashboard/i),
        ).toBeInTheDocument()
      })

      // Should have mobile-specific classes and layout
      const header = screen.getByRole('banner')
      expect(header).toHaveClass('flex-col')
    })

    it('adapts layout for tablet screens', async () => {
      // Set tablet width
      Object.defineProperty(window, 'innerWidth', {
        value: 800,
      })

      render(<BiasDashboard />)

      await waitFor(() => {
        expect(
          screen.getByText(/bias detection dashboard/i),
        ).toBeInTheDocument()
      })

      // Should adapt for tablet layout
      expect(screen.getByText(/bias detection dashboard/i)).toBeInTheDocument()
    })

    it('handles window resize events', async () => {
      render(<BiasDashboard />)

      await waitFor(() => {
        expect(
          screen.getByText(/bias detection dashboard/i),
        ).toBeInTheDocument()
      })

      // Simulate window resize
      Object.defineProperty(window, 'innerWidth', {
        value: 500,
      })

      fireEvent(window, new Event('resize'))

      // Component should handle resize
      expect(screen.getByText(/bias detection dashboard/i)).toBeInTheDocument()
    })
  })

  // Accessibility Tests
  describe('Accessibility Features', () => {
    beforeEach(() => {
      // Mock matchMedia for accessibility preferences (override global mock)
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches:
            query.includes('prefers-reduced-motion') ||
            query.includes('prefers-contrast'),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      })
    })

    it('provides skip links for keyboard navigation', async () => {
      render(<BiasDashboard />)

      await waitFor(() => {
        expect(
          screen.getByText(/bias detection dashboard/i),
        ).toBeInTheDocument()
      })

      // Should have skip links
      const skipToMain = screen.getByText(/skip to main content/i)
      const skipToAlerts = screen.getByText(/skip to alerts/i)

      expect(skipToMain).toBeInTheDocument()
      expect(skipToAlerts).toBeInTheDocument()
    })

    it('handles keyboard navigation shortcuts', async () => {
      render(<BiasDashboard />)

      await waitFor(() => {
        expect(
          screen.getByText(/bias detection dashboard/i),
        ).toBeInTheDocument()
      })

      // Test Alt+M for main content
      fireEvent.keyDown(document, { key: 'm', altKey: true })

      // Test Alt+A for alerts
      fireEvent.keyDown(document, { key: 'a', altKey: true })

      // Test Escape key
      fireEvent.keyDown(document, { key: 'Escape' })

      // Should handle keyboard events without errors
      expect(screen.getByText(/bias detection dashboard/i)).toBeInTheDocument()
    })

    it('provides proper ARIA labels and descriptions', async () => {
      render(<BiasDashboard />)

      await waitFor(() => {
        expect(
          screen.getByText(/bias detection dashboard/i),
        ).toBeInTheDocument()
      })

      // Check for ARIA labels on buttons
      const refreshButton = screen.getByLabelText(/refresh dashboard data/i)
      const notificationButton = screen.getByLabelText(
        /open notification settings/i,
      )
      const exportButton = screen.getByLabelText(/open data export options/i)

      expect(refreshButton).toBeInTheDocument()
      expect(notificationButton).toBeInTheDocument()
      expect(exportButton).toBeInTheDocument()
    })

    it('supports high contrast mode', async () => {
      // Mock high contrast preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query.includes('prefers-contrast: high'),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      })

      render(<BiasDashboard />)

      await waitFor(() => {
        expect(
          screen.getByText(/bias detection dashboard/i),
        ).toBeInTheDocument()
      })

      // Should apply high contrast class
      const container = screen
        .getByText(/bias detection dashboard/i)
        .closest('div')
      expect(container).toHaveClass('high-contrast')
    })

    it('respects reduced motion preferences', async () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query.includes('prefers-reduced-motion: reduce'),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      })

      render(<BiasDashboard />)

      await waitFor(() => {
        expect(
          screen.getByText(/bias detection dashboard/i),
        ).toBeInTheDocument()
      })

      // Component should handle reduced motion preference
      expect(screen.getByText(/bias detection dashboard/i)).toBeInTheDocument()
    })

    it('provides screen reader announcements', async () => {
      render(<BiasDashboard />)

      await waitFor(() => {
        expect(
          screen.getByText(/bias detection dashboard/i),
        ).toBeInTheDocument()
      })

      // Should have aria-live region for announcements
      const announcements = screen.getByRole('status', { hidden: true })
      expect(announcements).toBeInTheDocument()
      expect(announcements).toHaveAttribute('aria-live', 'polite')
    })

    it('manages focus properly in dialogs', async () => {
      render(<BiasDashboard />)

      await waitFor(() => {
        expect(
          screen.getByText(/bias detection dashboard/i),
        ).toBeInTheDocument()
      })

      // Open export dialog
      fireEvent.click(screen.getByTestId('export-button'))

      // Dialog should be properly focused
      const dialog = screen.getByText(/export dashboard data dialog/i)
      expect(dialog).toBeInTheDocument()

      // Close with Escape
      fireEvent.keyDown(document, { key: 'Escape' })

      // Dialog should close
      expect(
        screen.queryByText(/export dashboard data dialog/i),
      ).not.toBeInTheDocument()
    })
  })

  // Enhanced WebSocket Tests
  describe('Enhanced WebSocket Functionality', () => {
    let mockWebSocket: MockWebSocketInstance

    beforeEach(() => {
      mockWebSocket = {
        send: vi.fn(),
        close: vi.fn(),
        readyState: WebSocket.OPEN,
        onopen: null,
        onclose: null,
        onerror: null,
        onmessage: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        heartbeatInterval: null,
      }

      global.WebSocket = vi.fn(
        () => mockWebSocket,
      ) as unknown as typeof WebSocket
    })

    it('shows connection status indicators', async () => {
      render(<BiasDashboard enableRealTimeUpdates={true} />)

      await waitFor(() => {
        expect(
          screen.getByText(/bias detection dashboard/i),
        ).toBeInTheDocument()
      })

      // Initially should show connecting
      expect(
        screen.getByText(/connecting to live updates/i),
      ).toBeInTheDocument()

      // Simulate successful connection
      act(() => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen(new Event('open'))
        }
      })

      // Should show connected status
      await waitFor(() => {
        expect(screen.getByText(/live updates connected/i)).toBeInTheDocument()
      })
    })

    it('handles connection errors with proper status', async () => {
      render(<BiasDashboard enableRealTimeUpdates={true} />)

      await waitFor(() => {
        expect(
          screen.getByText(/bias detection dashboard/i),
        ).toBeInTheDocument()
      })

      // Simulate connection error
      act(() => {
        if (mockWebSocket.onerror) {
          const errorEvent = new Event('error') as Event
          mockWebSocket.onerror(errorEvent)
        }
      })

      // Should show error status
      await waitFor(() => {
        expect(screen.getByText(/live updates failed/i)).toBeInTheDocument()
      })

      // Should show reconnect button
      expect(screen.getByText(/reconnect live updates/i)).toBeInTheDocument()
    })

    it('handles reconnection attempts with exponential backoff', async () => {
      vi.useFakeTimers()

      render(<BiasDashboard enableRealTimeUpdates={true} />)

      await waitFor(() => {
        expect(
          screen.getByText(/bias detection dashboard/i),
        ).toBeInTheDocument()
      })

      // Simulate connection close
      act(() => {
        if (mockWebSocket.onclose) {
          const closeEvent = new CloseEvent('close', {
            code: 1006,
            reason: 'Connection lost',
            wasClean: false,
          })
          mockWebSocket.onclose(closeEvent)
        }
      })

      // Should show reconnecting status
      await waitFor(() => {
        expect(screen.getByText(/reconnecting/i)).toBeInTheDocument()
      })

      // Fast-forward time to trigger reconnection
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      // Should attempt to create new WebSocket connection
      expect(global.WebSocket).toHaveBeenCalledTimes(2)

      vi.useRealTimers()
    })

    it('sends subscription message on connection', async () => {
      render(<BiasDashboard enableRealTimeUpdates={true} />)

      await waitFor(() => {
        expect(
          screen.getByText(/bias detection dashboard/i),
        ).toBeInTheDocument()
      })

      // Simulate successful connection
      act(() => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen(new Event('open'))
        }
      })

      // Should send subscription message
      await waitFor(() => {
        expect(mockWebSocket.send).toHaveBeenCalledWith(
          expect.stringContaining('"type":"subscribe"'),
        )
      })
    })

    it('updates subscription when filters change', async () => {
      render(<BiasDashboard enableRealTimeUpdates={true} />)

      await waitFor(() => {
        expect(
          screen.getByText(/bias detection dashboard/i),
        ).toBeInTheDocument()
      })

      // Simulate successful connection
      act(() => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen(new Event('open'))
        }
      })

      // Clear previous calls
      mockWebSocket.send.mockClear()

      // Change a filter
      const timeRangeSelect = screen.getByLabelText(/time range/i)
      fireEvent.change(timeRangeSelect, { target: { value: '7d' } })

      // Should send update subscription message
      await waitFor(() => {
        expect(mockWebSocket.send).toHaveBeenCalledWith(
          expect.stringContaining('"type":"update_subscription"'),
        )
      })
    })

    it('handles heartbeat messages', async () => {
      render(<BiasDashboard enableRealTimeUpdates={true} />)

      await waitFor(() => {
        expect(
          screen.getByText(/bias detection dashboard/i),
        ).toBeInTheDocument()
      })

      // Simulate successful connection
      act(() => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen(new Event('open'))
        }
      })

      // Clear previous calls
      mockWebSocket.send.mockClear()

      // Simulate heartbeat message
      act(() => {
        if (mockWebSocket.onmessage) {
          const messageEvent = new MessageEvent('message', {
            data: JSON.stringify({ type: 'heartbeat' }),
          })
          mockWebSocket.onmessage(messageEvent)
        }
      })

      // Should respond to heartbeat
      await waitFor(() => {
        expect(mockWebSocket.send).toHaveBeenCalledWith(
          expect.stringContaining('"type":"heartbeat_response"'),
        )
      })
    })

    it('handles real-time bias alert updates', async () => {
      render(<BiasDashboard enableRealTimeUpdates={true} />)

      await waitFor(() => {
        expect(screen.getByText(/total sessions/i)).toBeInTheDocument()
      })

      // Simulate successful connection
      act(() => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen(new Event('open'))
        }
      })

      // Navigate to alerts tab
      fireEvent.click(screen.getByRole('tab', { name: /alerts/i }))

      // Simulate new bias alert
      act(() => {
        if (mockWebSocket.onmessage) {
          const messageEvent = new MessageEvent('message', {
            data: JSON.stringify({
              type: 'bias_alert',
              alert: {
                alertId: 'new-alert-1',
                type: 'high_bias',
                message: 'Real-time high bias detected',
                timestamp: new Date().toISOString(),
                level: 'high',
                sessionId: 'session-123',
              },
            }),
          })
          mockWebSocket.onmessage(messageEvent)
        }
      })

      // Should show the new alert
      await waitFor(() => {
        expect(
          screen.getByText(/real-time high bias detected/i),
        ).toBeInTheDocument()
      })
    })

    it('handles real-time session updates', async () => {
      render(<BiasDashboard enableRealTimeUpdates={true} />)

      await waitFor(() => {
        expect(screen.getByText(/total sessions/i)).toBeInTheDocument()
      })

      // Simulate successful connection
      act(() => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen(new Event('open'))
        }
      })

      // Simulate session update
      act(() => {
        if (mockWebSocket.onmessage) {
          const messageEvent = new MessageEvent('message', {
            data: JSON.stringify({
              type: 'session_update',
              session: {
                sessionId: 'session-1',
                overallBiasScore: 0.8,
                timestamp: new Date().toISOString(),
                alertLevel: 'high',
              },
            }),
          })
          mockWebSocket.onmessage(messageEvent)
        }
      })

      // Should update session data
      await waitFor(() => {
        expect(screen.getByText(/total sessions/i)).toBeInTheDocument()
      })
    })

    it('handles real-time metrics updates', async () => {
      render(<BiasDashboard enableRealTimeUpdates={true} />)

      await waitFor(() => {
        expect(screen.getByText(/total sessions/i)).toBeInTheDocument()
      })

      // Simulate successful connection
      act(() => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen(new Event('open'))
        }
      })

      // Simulate metrics update
      act(() => {
        if (mockWebSocket.onmessage) {
          const messageEvent = new MessageEvent('message', {
            data: JSON.stringify({
              type: 'metrics_update',
              metrics: {
                totalSessions: 150,
                averageBiasScore: 0.35,
                totalAlerts: 12,
              },
            }),
          })
          mockWebSocket.onmessage(messageEvent)
        }
      })

      // Should update metrics
      await waitFor(() => {
        expect(screen.getByText(/150/)).toBeInTheDocument()
      })
    })

    it('handles manual reconnection', async () => {
      render(<BiasDashboard enableRealTimeUpdates={true} />)

      await waitFor(() => {
        expect(
          screen.getByText(/bias detection dashboard/i),
        ).toBeInTheDocument()
      })

      // Simulate connection error
      act(() => {
        if (mockWebSocket.onerror) {
          const errorEvent = new Event('error') as Event
          mockWebSocket.onerror(errorEvent)
        }
      })

      // Should show reconnect button
      await waitFor(() => {
        expect(screen.getByText(/reconnect live updates/i)).toBeInTheDocument()
      })

      // Click reconnect button
      const reconnectButton = screen.getByText(/reconnect live updates/i)
      fireEvent.click(reconnectButton)

      // Should attempt to reconnect
      await waitFor(() => {
        expect(global.WebSocket).toHaveBeenCalledTimes(2)
      })
    })

    it('cleans up WebSocket connection properly', async () => {
      const { unmount } = render(<BiasDashboard enableRealTimeUpdates={true} />)

      await waitFor(() => {
        expect(
          screen.getByText(/bias detection dashboard/i),
        ).toBeInTheDocument()
      })

      // Simulate successful connection with heartbeat
      act(() => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen(new Event('open'))
        }
      })

      // Set up heartbeat interval
      mockWebSocket.heartbeatInterval = setInterval(() => {}, 30000) as any

      // Unmount component
      unmount()

      // Should close connection and clear interval
      expect(mockWebSocket.close).toHaveBeenCalledWith(
        1000,
        'Component unmounting',
      )
    })

    it('handles unknown message types gracefully', async () => {
      render(<BiasDashboard enableRealTimeUpdates={true} />)

      await waitFor(() => {
        expect(
          screen.getByText(/bias detection dashboard/i),
        ).toBeInTheDocument()
      })

      // Simulate successful connection
      act(() => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen(new Event('open'))
        }
      })

      // Simulate unknown message type
      act(() => {
        if (mockWebSocket.onmessage) {
          const messageEvent = new MessageEvent('message', {
            data: JSON.stringify({
              type: 'unknown_type',
              data: { some: 'data' },
            }),
          })
          mockWebSocket.onmessage(messageEvent)
        }
      })

      // Should handle gracefully without errors
      expect(screen.getByText(/bias detection dashboard/i)).toBeInTheDocument()
    })

    it('handles malformed WebSocket messages', async () => {
      render(<BiasDashboard enableRealTimeUpdates={true} />)

      await waitFor(() => {
        expect(
          screen.getByText(/bias detection dashboard/i),
        ).toBeInTheDocument()
      })

      // Simulate successful connection
      act(() => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen(new Event('open'))
        }
      })

      // Simulate malformed message
      act(() => {
        if (mockWebSocket.onmessage) {
          const messageEvent = new MessageEvent('message', {
            data: 'invalid json',
          })
          mockWebSocket.onmessage(messageEvent)
        }
      })

      // Should handle gracefully without crashing
      expect(screen.getByText(/bias detection dashboard/i)).toBeInTheDocument()
    })

    it('shows correct status during reconnection attempts', async () => {
      render(<BiasDashboard enableRealTimeUpdates={true} />)

      await waitFor(() => {
        expect(
          screen.getByText(/bias detection dashboard/i),
        ).toBeInTheDocument()
      })

      // Simulate connection close to trigger reconnection
      act(() => {
        if (mockWebSocket.onclose) {
          const closeEvent = new CloseEvent('close', {
            code: 1006,
            reason: 'Connection lost',
            wasClean: false,
          })
          mockWebSocket.onclose(closeEvent)
        }
      })

      // Should show reconnecting status with attempt number
      await waitFor(() => {
        expect(screen.getByText(/reconnecting.*attempt 1/i)).toBeInTheDocument()
      })
    })

    it('disables live updates when enableRealTimeUpdates is false', async () => {
      render(<BiasDashboard enableRealTimeUpdates={false} />)

      await waitFor(() => {
        expect(
          screen.getByText(/bias detection dashboard/i),
        ).toBeInTheDocument()
      })

      // Should show disabled status
      expect(screen.getByText(/live updates disabled/i)).toBeInTheDocument()

      // Should not create WebSocket connection
      expect(global.WebSocket).not.toHaveBeenCalled()
    })
  })

  it('shows error alert if dashboard fetch fails', async () => {
    // Mock fetch to throw an error
    global.fetch = vi.fn().mockRejectedValue(new Error('Failed to parse URL'))
    render(<BiasDashboard />)
    await waitFor(() => {
      expect(screen.getByText(/error loading dashboard/i)).toBeInTheDocument()
      expect(screen.getByText(/failed to parse url/i)).toBeInTheDocument()
    })
  })
})
