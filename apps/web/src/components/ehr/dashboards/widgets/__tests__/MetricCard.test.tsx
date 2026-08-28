/**
 * Tests for MetricCard widget (PIX-4413)
 *
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { MetricCard } from '@/components/ehr/dashboards/widgets/MetricCard'

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('MetricCard', () => {
  it('renders the label and numeric value', () => {
    render(<MetricCard value={1500} label="Active Patients" />)
    expect(screen.getByText('Active Patients')).toBeTruthy()
    expect(screen.getByText('1,500')).toBeTruthy()
  })

  it('renders string values as-is', () => {
    render(<MetricCard value="N/A" label="Status" />)
    expect(screen.getByText('N/A')).toBeTruthy()
  })

  it('applies unit suffix', () => {
    render(
      <MetricCard value={12.5} label="No-Show Rate" unit="%" decimals={1} />,
    )
    expect(screen.getByText('12.5')).toBeTruthy()
    expect(screen.getByText('%')).toBeTruthy()
  })

  it('formats with specified decimals', () => {
    render(<MetricCard value={3.14159} label="Score" decimals={2} />)
    expect(screen.getByText('3.14')).toBeTruthy()
  })

  it('renders subtext when provided', () => {
    render(<MetricCard value={100} label="Total" subtext="As of Jan 2024" />)
    expect(screen.getByText('As of Jan 2024')).toBeTruthy()
  })

  it('does not render subtext when omitted', () => {
    const { container } = render(<MetricCard value={100} label="Total" />)
    expect(container.textContent).toContain('Total')
    expect(container.textContent).toContain('100')
  })

  // ---- Delta indicator ----

  it('does not show delta when previousValue is omitted', () => {
    const { container } = render(<MetricCard value={100} label="Metric" />)
    expect(container.textContent).not.toContain('vs last period')
  })

  it('shows positive delta indicator when value increased', () => {
    render(<MetricCard value={120} label="Revenue" previousValue={100} />)
    expect(screen.getByText(/vs last period/)).toBeTruthy()
    expect(screen.getByText(/20\.0%/)).toBeTruthy()
  })

  it('shows negative delta indicator when value decreased', () => {
    render(<MetricCard value={80} label="Errors" previousValue={100} />)
    expect(screen.getByText(/20\.0%/)).toBeTruthy()
  })

  it('shows zero delta when value unchanged', () => {
    render(<MetricCard value={100} label="Stable" previousValue={100} />)
    expect(screen.getByText(/0\.0%/)).toBeTruthy()
  })

  it('handles previousValue of 0 for delta calculation', () => {
    // Division by zero should produce 0 pct, not Infinity
    render(<MetricCard value={10} label="New" previousValue={0} />)
    expect(screen.getByText(/0\.0%/)).toBeTruthy()
  })
})
