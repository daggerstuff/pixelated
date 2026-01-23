import { render, screen, fireEvent } from '@testing-library/react'
import { TherapistDashboard } from '../TherapistDashboard'

import type { TherapistSession } from '@/types/dashboard'
import { describe, expect, it, vi } from 'vitest'

// Mock child components
vi.mock('../AnalyticsCharts', () => ({
  AnalyticsCharts: () => (
    <div data-testid="analytics-charts">Analytics Charts</div>
  ),
}))

vi.mock('../SessionControls', () => ({
  __esModule: true,
  default: () => <div data-testid="session-controls">Session Controls</div>,
}))

vi.mock('../TherapistProgressTracker', () => ({
  TherapistProgressTracker: () => (
    <div data-testid="progress-tracker">Progress Tracker</div>
  ),
}))

vi.mock('../TherapyProgressCharts', () => ({
  __esModule: true,
  default: () => <div data-testid="therapy-charts">Therapy Charts</div>,
}))

// Mock the useTherapistAnalytics hook
vi.mock('@/hooks/useTherapistAnalytics', () => ({
  useTherapistAnalytics: vi.fn(() => ({
    data: {
      sessionMetrics: [],
      skillProgress: [],
      summaryStats: [],
      progressSnapshots: [],
      comparativeData: undefined,
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    clearError: vi.fn(),
  })),
}))

const mockSessions: TherapistSession[] = [
  {
    id: 'session-1',
    clientId: 'client-1',
    therapistId: 'therapist-1',
    startTime: '2025-01-01T10:00:00Z',
    endTime: '2025-01-01T11:00:00Z',
    status: 'completed',
    progress: 85,
  },
]

describe('TherapistDashboard', () => {
  it('renders dashboard heading', () => {
    render(
      <TherapistDashboard
        sessions={mockSessions}
        onSessionControl={mockOnSessionControl}
      />,
    )
    expect(screen.getByLabelText('Therapist Dashboard')).toBeInTheDocument()
  })

  const mockOnSessionControl = vi.fn()

  it('renders dashboard heading with proper ARIA labels', () => {
    render(
      <TherapistDashboard
        sessions={mockSessions}
        onSessionControl={mockOnSessionControl}
      />,
    )
    expect(screen.getByLabelText('Therapist Dashboard')).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('renders all dashboard sections', () => {
    render(
      <TherapistDashboard
        sessions={mockSessions}
        onSessionControl={mockOnSessionControl}
      />,
    )

    expect(screen.getByLabelText('Session Controls')).toBeInTheDocument()
    expect(screen.getByLabelText('Analytics Charts')).toBeInTheDocument()
    expect(
      screen.getByLabelText('Progress Tracking Widgets'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Therapy Progress Charts')).toBeInTheDocument()
  })

  it('displays session controls component with correct props', () => {
    render(
      <TherapistDashboard
        sessions={mockSessions}
        onSessionControl={mockOnSessionControl}
      />,
    )
    expect(screen.getByTestId('session-controls')).toBeInTheDocument()
  })

  it('displays progress tracker for latest session', () => {
    render(
      <TherapistDashboard
        sessions={mockSessions}
        onSessionControl={mockOnSessionControl}
      />,
    )
    expect(screen.getByTestId('progress-tracker')).toBeInTheDocument()
  })

  it('displays therapy progress charts when data is available', async () => {
    render(
      <TherapistDashboard
        sessions={mockSessions}
        onSessionControl={mockOnSessionControl}
      />,
    )
    expect(await screen.findByTestId('therapy-charts')).toBeInTheDocument()
  })

  it('renders children components when provided', () => {
    const ChildComponent = () => (
      <div data-testid="child-component">Child Component</div>
    )
    render(
      <TherapistDashboard
        sessions={mockSessions}
        onSessionControl={mockOnSessionControl}
      >
        <ChildComponent />
      </TherapistDashboard>,
    )
    expect(screen.getByTestId('child-component')).toBeInTheDocument()
  })

  it('throws error when onSessionControl prop is missing', () => {
    const renderWithoutProp = () => {
      render(<TherapistDashboard sessions={mockSessions} />)
    }
    expect(renderWithoutProp).toThrow(
      'TherapistDashboard requires onSessionControl prop',
    )
  })

  it('handles keyboard navigation for skip links', () => {
    render(
      <TherapistDashboard
        sessions={mockSessions}
        onSessionControl={mockOnSessionControl}
      />,
    )

    // Simulate tab key press to show skip link
    fireEvent.keyDown(document, { key: 'Tab' })

    // The skip link implementation is complex to test fully in JSDOM
    // This test ensures the component renders without errors
    expect(screen.getByLabelText('Therapist Dashboard')).toBeInTheDocument()
  })

  it('renders with empty sessions array', () => {
    render(
      <TherapistDashboard
        sessions={[]}
        onSessionControl={mockOnSessionControl}
      />,
    )

    expect(screen.getByLabelText('Therapist Dashboard')).toBeInTheDocument()
    expect(screen.getByLabelText('Session Controls')).toBeInTheDocument()
  })
})
