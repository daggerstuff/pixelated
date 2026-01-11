// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import { SessionMetrics } from '../SessionMetrics'
import { describe, expect, it } from 'vitest'

describe('SessionMetrics', () => {
  const mockMetrics = [
    { label: 'Total Sessions', value: 25 },
    { label: 'Avg Progress', value: '78%' },
    { label: 'Completed', value: 20 },
    { label: 'Avg Duration', value: '45m' },
  ]

  it('renders session metrics with correct labels and values', () => {
    render(<SessionMetrics metrics={mockMetrics} />)

    expect(screen.getByLabelText('Session Metrics')).toBeInTheDocument()

    // Check that all metrics are rendered
    expect(screen.getByText('Total Sessions')).toBeInTheDocument()
    expect(screen.getByText('25')).toBeInTheDocument()
    expect(screen.getByText('Avg Progress')).toBeInTheDocument()
    expect(screen.getByText('78%')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('Avg Duration')).toBeInTheDocument()
    expect(screen.getByText('45m')).toBeInTheDocument()
  })

  it('renders correct number of metric items', () => {
    render(<SessionMetrics metrics={mockMetrics} />)
    const list = screen.getByRole('list', { name: 'Session Metrics' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(mockMetrics.length)
  })

  it('renders with empty metrics array', () => {
    render(<SessionMetrics metrics={[]} />)

    expect(screen.getByLabelText('Session Metrics')).toBeInTheDocument()
    // Should render empty grid
    const container = screen.getByLabelText('Session Metrics')
    expect(container).toBeInTheDocument()
  })

  it('renders with single metric', () => {
    const singleMetric = [{ label: 'Test Metric', value: 42 }]
    render(<SessionMetrics metrics={singleMetric} />)

    expect(screen.getByText('Test Metric')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('handles string values correctly', () => {
    const stringMetrics = [
      { label: 'Status', value: 'Active' },
      { label: 'Grade', value: 'A+' },
    ]
    render(<SessionMetrics metrics={stringMetrics} />)

    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Grade')).toBeInTheDocument()
    expect(screen.getByText('A+')).toBeInTheDocument()
  })

  it('applies correct styling classes', () => {
    render(<SessionMetrics metrics={mockMetrics} />)

    const container = screen.getByLabelText('Session Metrics')
    expect(container).toHaveClass('grid', 'grid-cols-2', 'gap-4')

    const metricItems = screen.getAllByText(
      /Total Sessions|Avg Progress|Completed|Avg Duration/,
    )
    metricItems.forEach((item) => {
      const parent = item.closest('div')
      if (parent) {
        expect(parent).toHaveClass(
          'bg-muted',
          'rounded-md',
          'p-2',
          'flex',
          'flex-col',
          'items-center',
        )
      }
    })
  })

  it('renders metric labels with correct styling', () => {
    render(<SessionMetrics metrics={[{ label: 'Test Label', value: 100 }]} />)

    const label = screen.getByText('Test Label')
    expect(label).toHaveClass('text-xs', 'text-muted-foreground')
  })

  it('renders metric values with correct styling', () => {
    render(<SessionMetrics metrics={[{ label: 'Test Value', value: 999 }]} />)

    const value = screen.getByText('999')
    expect(value).toHaveClass('text-lg', 'font-bold')
  })
})
