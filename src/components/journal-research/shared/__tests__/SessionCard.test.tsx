import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SessionCard } from '../SessionCard'
import { mockSession } from '../../__tests__/test-utils'

describe('SessionCard', () => {
  it('renders session information correctly', () => {
    render(<SessionCard session={mockSession} />)

    expect(screen.getByText(mockSession.sessionId)).toBeInTheDocument()
    expect(screen.getByText(/Started/)).toBeInTheDocument()
    expect(screen.getByText(mockSession.currentPhase)).toBeInTheDocument()
    expect(screen.getByText(`${mockSession.targetSources.length}`)).toBeInTheDocument()
  })

  it('displays progress percentage correctly', () => {
    render(<SessionCard session={mockSession} />)

    const progressText = screen.getByText(/45%/)
    expect(progressText).toBeInTheDocument()
  })

  it('calls onClick handler when card is clicked', () => {
    const handleClick = vi.fn()
    render(<SessionCard session={mockSession} onClick={handleClick} />)

    const card = screen.getByRole('button')
    fireEvent.click(card)

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('calls onClick handler when Enter key is pressed', () => {
    const handleClick = vi.fn()
    render(<SessionCard session={mockSession} onClick={handleClick} />)

    const card = screen.getByRole('button')
    fireEvent.keyDown(card, { key: 'Enter' })

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('calls onClick handler when Space key is pressed', () => {
    const handleClick = vi.fn()
    render(<SessionCard session={mockSession} onClick={handleClick} />)

    const card = screen.getByRole('button')
    fireEvent.keyDown(card, { key: ' ' })

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('displays progress metrics when available', () => {
    render(<SessionCard session={mockSession} />)

    expect(screen.getByText(/Identified:/)).toBeInTheDocument()
    expect(screen.getByText(/8/)).toBeInTheDocument()
    expect(screen.getByText(/Evaluated:/)).toBeInTheDocument()
    expect(screen.getByText(/3/)).toBeInTheDocument()
    expect(screen.getByText(/Acquired:/)).toBeInTheDocument()
    expect(screen.getByText(/2/)).toBeInTheDocument()
    expect(screen.getByText(/Integrated:/)).toBeInTheDocument()
    expect(screen.getByText(/1/)).toBeInTheDocument()
  })

  it('handles missing progress metrics gracefully', () => {
    const sessionWithoutMetrics = {
      ...mockSession,
      progressMetrics: undefined,
    }
    render(<SessionCard session={sessionWithoutMetrics} />)

    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(
      <SessionCard session={mockSession} className="custom-class" />,
    )

    const card = container.querySelector('.custom-class')
    expect(card).toBeInTheDocument()
  })

  it('displays phase indicator with correct color', () => {
    render(<SessionCard session={mockSession} />)

    const phaseIndicator = screen.getByLabelText(/Current phase: discovery/)
    expect(phaseIndicator).toBeInTheDocument()
    expect(phaseIndicator).toHaveClass('bg-blue-500')
  })

  it('displays target sources in footer', () => {
    render(<SessionCard session={mockSession} />)

    expect(screen.getByText('PubMed, arXiv')).toBeInTheDocument()
  })
})

