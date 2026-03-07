import { render, screen } from '@testing-library/react'
import { UnusualPatterns } from '../UnusualPatterns'
import type { UnusualPattern } from '../../../lib/audit/analysis'

describe('UnusualPatterns', () => {
  const mockPatterns: UnusualPattern[] = [
    {
      type: 'high_frequency',
      severity: 'high',
      description: 'User accessed system 50 times in the last hour',
      relatedLogs: Array(50).fill({
        userId: 'user123',
        timestamp: new Date().toISOString(),
        resourceType: 'user_data',
        action: 'read',
      }),
    },
    {
      type: 'odd_hours',
      severity: 'medium',
      description: 'Multiple access attempts between 2 AM and 4 AM',
      relatedLogs: Array(5).fill({
        userId: 'user456',
        timestamp: new Date().toISOString(),
        resourceType: 'financial',
        action: 'write',
      }),
    },
  ]

  it('renders empty state when no patterns are provided', () => {
    render(<UnusualPatterns patterns={[]} />)
    expect(screen.getByText('No unusual patterns detected')).toBeInTheDocument()
  })

  it('renders patterns with correct information', () => {
    render(<UnusualPatterns patterns={mockPatterns} />)

    // Check if patterns are rendered
    expect(screen.getByText('2 patterns detected')).toBeInTheDocument()
    expect(screen.getByText('high frequency')).toBeInTheDocument()
    expect(screen.getByText('odd hours')).toBeInTheDocument()

    // Check severity badges
    expect(screen.getByText('high')).toBeInTheDocument()
    expect(screen.getByText('medium')).toBeInTheDocument()

    // Check descriptions
    expect(
      screen.getByText('User accessed system 50 times in the last hour'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Multiple access attempts between 2 AM and 4 AM'),
    ).toBeInTheDocument()

    // Check related logs count
    expect(screen.getByText('50 related log entries')).toBeInTheDocument()
    expect(screen.getByText('5 related log entries')).toBeInTheDocument()
  })
})
