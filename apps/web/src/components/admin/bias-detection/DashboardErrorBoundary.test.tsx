import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import '@testing-library/jest-dom'
import { DashboardErrorBoundary } from './DashboardErrorBoundary'

function ThrowingDashboard(): never {
  throw new Error('header exploded')
}

describe('DashboardErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <DashboardErrorBoundary>
        <div>dashboard content</div>
      </DashboardErrorBoundary>,
    )
    expect(screen.getByText('dashboard content')).toBeInTheDocument()
  })

  it('shows fallback instead of blank island when child throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <DashboardErrorBoundary>
        <ThrowingDashboard />
      </DashboardErrorBoundary>,
    )
    expect(
      screen.getByText('Dashboard failed to render'),
    ).toBeInTheDocument()
    expect(screen.getByText('header exploded')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reload dashboard/i })).toBeInTheDocument()
    spy.mockRestore()
  })
})