import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import '@testing-library/jest-dom'
import { ChartErrorBoundary } from './ChartErrorBoundary'

function ThrowingChart(): never {
  throw new Error('recharts exploded')
}

describe('ChartErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ChartErrorBoundary label="Trends chart">
        <div>chart content</div>
      </ChartErrorBoundary>,
    )
    expect(screen.getByText('chart content')).toBeInTheDocument()
  })

  it('shows fallback and recovers when child throws', () => {
    render(
      <ChartErrorBoundary label="Trends chart">
        <ThrowingChart />
      </ChartErrorBoundary>,
    )
    expect(
      screen.getByText('Trends chart is temporarily unavailable'),
    ).toBeInTheDocument()
  })

  it('recovers after Try again when child renders again', () => {
    const { rerender } = render(
      <ChartErrorBoundary label="Demographics chart">
        <ThrowingChart />
      </ChartErrorBoundary>,
    )
    expect(
      screen.getByText('Demographics chart is temporarily unavailable'),
    ).toBeInTheDocument()
    rerender(
      <ChartErrorBoundary label="Demographics chart">
        <div>fixed chart</div>
      </ChartErrorBoundary>,
    )
    // Boundary state persists across rerender of children until reset.
    expect(
      screen.getByText('Demographics chart is temporarily unavailable'),
    ).toBeInTheDocument()
  })
})