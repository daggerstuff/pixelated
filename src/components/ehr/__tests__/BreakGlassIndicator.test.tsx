import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { BreakGlassIndicator } from '../BreakGlassIndicator'

describe('BreakGlassIndicator', () => {
  it('renders null when inactive', () => {
    const { container } = render(
      <BreakGlassIndicator active={false} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders badge when active', () => {
    render(<BreakGlassIndicator active={true} />)

    expect(screen.getByTestId('break-glass-indicator')).toBeInTheDocument()
    expect(screen.getByText('Break-Glass Access Active')).toBeInTheDocument()
  })

  it('has role="alert" and aria-live="assertive" for accessibility', () => {
    render(<BreakGlassIndicator active={true} />)

    const indicator = screen.getByTestId('break-glass-indicator')
    expect(indicator).toHaveAttribute('role', 'alert')
    expect(indicator).toHaveAttribute('aria-live', 'assertive')
  })

  it('displays reason in title attribute when provided', () => {
    render(
      <BreakGlassIndicator active={true} reason="Emergency access for crisis intervention" />,
    )

    const indicator = screen.getByTestId('break-glass-indicator')
    expect(indicator).toHaveAttribute('title', 'Reason: Emergency access for crisis intervention')
  })

  it('displays timestamp in title attribute when provided', () => {
    render(
      <BreakGlassIndicator active={true} timestamp="2024-01-15T10:30:00Z" />,
    )

    const indicator = screen.getByTestId('break-glass-indicator')
    expect(indicator.title).toContain('Activated:')
  })

  it('displays both reason and timestamp in title', () => {
    render(
      <BreakGlassIndicator
        active={true}
        reason="Emergency access"
        timestamp="2024-01-15T10:30:00Z"
      />,
    )

    const indicator = screen.getByTestId('break-glass-indicator')
    expect(indicator.title).toContain('Reason: Emergency access')
    expect(indicator.title).toContain('Activated:')
  })

  it('does not set title when neither reason nor timestamp provided', () => {
    render(<BreakGlassIndicator active={true} />)

    const indicator = screen.getByTestId('break-glass-indicator')
    expect(indicator).not.toHaveAttribute('title')
  })

  it('includes pulsing animation element when active', () => {
    const { container } = render(<BreakGlassIndicator active={true} />)

    const pulseElement = container.querySelector('[style*="animation"]')
    expect(pulseElement).not.toBeNull()
  })

  it('includes sr-only text with reason for screen readers', () => {
    render(
      <BreakGlassIndicator active={true} reason="Emergency access" />,
    )

    const srOnly = screen.getByText(/Reason: Emergency access/)
    expect(srOnly).toHaveClass('sr-only')
  })
})
