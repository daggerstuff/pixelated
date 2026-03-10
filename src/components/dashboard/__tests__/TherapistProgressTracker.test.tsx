import { render, screen, fireEvent, within } from '@testing-library/react'
import { TherapistProgressTracker } from '../TherapistProgressTracker'
import type { TherapistSession } from '@/types/dashboard'
import { describe, expect, it } from 'vitest'

describe('TherapistProgressTracker', () => {
  const mockSession: TherapistSession = {
    id: 'session-1',
    clientId: 'client-1',
    therapistId: 'therapist-1',
    startTime: '2025-01-01T10:00:00Z',
    endTime: '2025-01-01T11:30:00Z',
    status: 'completed',
    progress: 85,
    progressMetrics: {
      totalMessages: 42,
      therapistMessages: 21,
      clientMessages: 21,
      responsesCount: 42,
      sessionDuration: 5400,
      activeTime: 3600,
      skillScores: {
        'Active Listening': 85,
        'Empathy': 78,
        'Questioning': 92,
        'Reflection': 71,
      },
      responseTime: 2.5,
      conversationFlow: 88,
      milestonesReached: ['introduction', 'exploration', 'closure'],
    },
  }

  it('renders progress tracker with session data', () => {
    render(<TherapistProgressTracker session={mockSession} />)

    expect(
      screen.getByLabelText('Therapist Progress Tracker'),
    ).toBeInTheDocument()
    expect(screen.getByText('Session Overview')).toBeInTheDocument()
    expect(screen.getByText('Overall Progress')).toBeInTheDocument()
    expect(screen.getByText('Skill Development')).toBeInTheDocument()
    expect(screen.getByText('Session Notes')).toBeInTheDocument()
  })

  it('displays correct session overview metrics', () => {
    render(<TherapistProgressTracker session={mockSession} />)

    expect(screen.getByText('Session ID')).toBeInTheDocument()
    expect(screen.getByText('session-1')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('completed')).toBeInTheDocument()
    expect(screen.getByText('Duration')).toBeInTheDocument()
    expect(screen.getByText('1h 30m')).toBeInTheDocument()
    expect(screen.getByText('Progress')).toBeInTheDocument()
    // Scope the 85% lookup to the Progress container to avoid colliding with other 85% labels
    const progressLabel = screen.getByText('Progress')
    const progressContainer =
      progressLabel.parentElement ?? progressLabel.closest('div')
    expect(within(progressContainer!).getByText('85%')).toBeInTheDocument()
  })

  it('renders progress bar with correct value', () => {
    render(<TherapistProgressTracker session={mockSession} />)

    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '85')
    expect(progressBar).toHaveAttribute('aria-valuemax', '100')
    // Ensure the textual percentage associated with the progressbar is present in the same container
    const progressBarContainer =
      progressBar.parentElement ?? progressBar.closest('div')
    expect(within(progressBarContainer!).getByText('85%')).toBeInTheDocument()
  })

  it('displays skill development data', async () => {
    render(<TherapistProgressTracker session={mockSession} />)

    // Wait for skills to load
    await screen.findByText('Active Listening')

    // Scope the Active Listening percentage to that metric's container
    const activeListeningLabel = screen.getByText('Active Listening')
    const activeListeningContainer =
      activeListeningLabel.parentElement ?? activeListeningLabel.closest('div')
    expect(
      within(activeListeningContainer!).getByText('85%'),
    ).toBeInTheDocument()
    expect(screen.getByText('Empathy')).toBeInTheDocument()
    expect(screen.getByText('78%')).toBeInTheDocument()
    expect(screen.getByText('Questioning')).toBeInTheDocument()
    expect(screen.getByText('92%')).toBeInTheDocument()
    expect(screen.getByText('Reflection')).toBeInTheDocument()
    expect(screen.getByText('71%')).toBeInTheDocument()
  })

  it('shows skill trends with correct indicators', async () => {
    render(<TherapistProgressTracker session={mockSession} />)

    // Wait for skills to load
    await screen.findByText('Active Listening')

    // Check trend indicators
    const trendIndicators = screen.getAllByText(/[↗↘→]/)
    expect(trendIndicators.length).toBeGreaterThan(0)
  })

  it('handles session without end time (in progress)', () => {
    const inProgressSession: TherapistSession = {
      ...mockSession,
      endTime: undefined,
      status: 'active',
    }

    render(<TherapistProgressTracker session={inProgressSession} />)

    expect(screen.getByText('In Progress')).toBeInTheDocument()
  })

  it('handles session without progress metrics', () => {
    const sessionWithoutMetrics: TherapistSession = {
      ...mockSession,
      progressMetrics: undefined,
    }

    render(<TherapistProgressTracker session={sessionWithoutMetrics} />)

    // Should still render basic session info
    expect(screen.getByText('Session Overview')).toBeInTheDocument()
    expect(screen.getByText('Overall Progress')).toBeInTheDocument()
  })

  it('toggles section expansion', () => {
    render(<TherapistProgressTracker session={mockSession} />)

    const overviewToggle = screen.getByLabelText('Collapse session overview')

    // Initially expanded
    expect(screen.getByText('Session ID')).toBeInTheDocument()
    // Scope the overall progress check to the Progress container
    const progressLabel2 = screen.getByText('Progress')
    const progressContainer2 =
      progressLabel2.parentElement ?? progressLabel2.closest('div')
    expect(within(progressContainer2!).getByText('85%')).toBeInTheDocument()

    // Toggle overview section
    fireEvent.click(overviewToggle)
    expect(screen.queryByText('Session ID')).not.toBeInTheDocument()

    // Toggle back
    fireEvent.click(overviewToggle)
    expect(screen.getByText('Session ID')).toBeInTheDocument()
  })

  it('applies correct styling classes', () => {
    render(<TherapistProgressTracker session={mockSession} />)

    const container = screen.getByLabelText('Therapist Progress Tracker')
    expect(container).toHaveClass('space-y-6')

    const sections = screen.getAllByRole('region')
    sections.forEach((section) => {
      expect(section).toHaveClass('bg-muted', 'rounded-md', 'p-4')
    })
  })

  it('renders with custom className', () => {
    render(
      <TherapistProgressTracker
        session={mockSession}
        className="custom-class"
      />,
    )

    const container = screen.getByLabelText('Therapist Progress Tracker')
    expect(container).toHaveClass('custom-class')
  })

  it('handles keyboard navigation for toggle buttons', () => {
    render(<TherapistProgressTracker session={mockSession} />)

    const toggleButton = screen.getByLabelText('Collapse session overview')
    toggleButton.focus()

    expect(toggleButton).toHaveFocus()
  })

  it('renders session notes section', () => {
    render(<TherapistProgressTracker session={mockSession} />)

    const notesToggle = screen.getByLabelText('Collapse session notes')
    expect(notesToggle).toBeInTheDocument()

    // Notes section should be expanded by default
    expect(
      screen.getByText('Session notes and observations will appear here...'),
    ).toBeInTheDocument()
  })
})
