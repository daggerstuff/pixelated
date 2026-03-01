import { render, screen } from '@testing-library/react'
import React from 'react'
import { describe, it, expect, vi } from 'vitest'

import { TherapistDashboard } from '../TherapistDashboard'

describe('Dashboard Accessibility (non-JSX shim)', () => {
  it('renders therapist dashboard without JSX', () => {
    const mockOnSessionControl = vi.fn()
    // Use React.createElement to avoid JSX in a .ts file
    render(
      React.createElement(TherapistDashboard as any, {
        sessions: [],
        onSessionControl: mockOnSessionControl,
      }),
    )
    expect(screen.getByLabelText('Therapist Dashboard')).toBeInTheDocument()
  })
})
