import { render, screen } from '@testing-library/react'
import { TherapistDashboard } from '../TherapistDashboard'
import { describe, it, expect, vi } from 'vitest'

const mockSessions = [{ id: 'session-1', clientId: 'client-1', therapistId: 'therapist-1', status: 'completed', progress: 85 }]
const mockOnSessionControl = vi.fn()

describe('Dashboard accessibility (sanitised)', () => {
  it('renders main dashboard and session controls', () => {
    render(<TherapistDashboard sessions={mockSessions as any} onSessionControl={mockOnSessionControl} />)
    expect(screen.getByLabelText('Therapist Dashboard')).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
  })
})
