import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProgressBar } from '../ProgressBar'

describe('ProgressBar', () => {
  it('renders progress bar with correct value', () => {
    render(<ProgressBar value={50} />)

    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '50')
    expect(progressBar).toHaveAttribute('aria-valuemin', '0')
    expect(progressBar).toHaveAttribute('aria-valuemax', '100')
  })

  it('displays 0% when value is 0', () => {
    render(<ProgressBar value={0} />)

    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '0')
  })

  it('displays 100% when value is 100', () => {
    render(<ProgressBar value={100} />)

    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '100')
  })

  it('clamps value above 100 to 100', () => {
    render(<ProgressBar value={150} />)

    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '100')
  })

  it('clamps value below 0 to 0', () => {
    render(<ProgressBar value={-10} />)

    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '0')
  })

  it('applies custom className', () => {
    const { container } = render(<ProgressBar value={50} className="custom-class" />)

    const progressBar = container.querySelector('.custom-class')
    expect(progressBar).toBeInTheDocument()
  })

  it('displays label when provided', () => {
    render(<ProgressBar value={50} label="Test Progress" />)

    expect(screen.getByText('Test Progress')).toBeInTheDocument()
  })

  it('displays value text when showValue is true', () => {
    render(<ProgressBar value={50} showValue />)

    expect(screen.getByText('50%')).toBeInTheDocument()
  })
})

