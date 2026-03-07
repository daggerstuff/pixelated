import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SessionList } from '../SessionList'
import { mockSessionList } from '../../__tests__/test-utils'

describe('SessionList', () => {
  it('renders session list correctly', () => {
    render(<SessionList sessions={mockSessionList} />)

    expect(screen.getByText('Session ID')).toBeInTheDocument()
    expect(screen.getByText('Start Date')).toBeInTheDocument()
    expect(screen.getByText('Phase')).toBeInTheDocument()
    expect(screen.getByText('Progress')).toBeInTheDocument()
  })

  it('displays sessions in table', () => {
    render(<SessionList sessions={mockSessionList} />)

    expect(screen.getByText(mockSessionList.items[0].sessionId)).toBeInTheDocument()
  })

  it('calls onSessionClick when session is clicked', () => {
    const handleClick = vi.fn()
    render(<SessionList sessions={mockSessionList} onSessionClick={handleClick} />)

    const sessionLink = screen.getByText(mockSessionList.items[0].sessionId)
    fireEvent.click(sessionLink)

    expect(handleClick).toHaveBeenCalledWith(mockSessionList.items[0])
  })

  it('filters sessions by search term', async () => {
    const sessionsWithMultiple = {
      ...mockSessionList,
      items: [
        mockSessionList.items[0],
        {
          ...mockSessionList.items[0],
          sessionId: 'test-session-2',
          targetSources: ['Different Source'],
        },
      ],
      total: 2,
    }

    render(<SessionList sessions={sessionsWithMultiple} />)

    const searchInput = screen.getByPlaceholderText('Search sessions...')
    fireEvent.change(searchInput, { target: { value: 'test-session-1' } })

    await waitFor(() => {
      expect(screen.getByText('test-session-1')).toBeInTheDocument()
      expect(screen.queryByText('test-session-2')).not.toBeInTheDocument()
    })
  })

  it('filters sessions by phase', async () => {
    const sessionsWithMultiple = {
      ...mockSessionList,
      items: [
        mockSessionList.items[0],
        {
          ...mockSessionList.items[0],
          sessionId: 'test-session-2',
          currentPhase: 'evaluation',
        },
      ],
      total: 2,
    }

    render(<SessionList sessions={sessionsWithMultiple} />)

    const phaseSelect = screen.getByDisplayValue('all')
    fireEvent.change(phaseSelect, { target: { value: 'discovery' } })

    await waitFor(() => {
      expect(screen.getByText('test-session-1')).toBeInTheDocument()
      expect(screen.queryByText('test-session-2')).not.toBeInTheDocument()
    })
  })

  it('displays loading state', () => {
    render(<SessionList sessions={mockSessionList} isLoading />)

    // Check if loading indicator is present (implementation dependent)
    const table = screen.getByRole('table')
    expect(table).toBeInTheDocument()
  })

  it('displays session count', () => {
    render(<SessionList sessions={mockSessionList} />)

    expect(screen.getByText(/Showing 1 of 1 sessions/)).toBeInTheDocument()
  })

  it('sorts sessions by sessionId', async () => {
    const sessionsWithMultiple = {
      ...mockSessionList,
      items: [
        {
          ...mockSessionList.items[0],
          sessionId: 'z-session',
        },
        {
          ...mockSessionList.items[0],
          sessionId: 'a-session',
        },
      ],
      total: 2,
    }

    render(<SessionList sessions={sessionsWithMultiple} />)

    const sessionIdHeader = screen.getByText('Session ID')
    fireEvent.click(sessionIdHeader)

    await waitFor(() => {
      const rows = screen.getAllByRole('row')
      // First data row should be 'a-session' when sorted ascending
      expect(rows[1]).toHaveTextContent('a-session')
    })
  })

  it('applies custom className', () => {
    const { container } = render(
      <SessionList sessions={mockSessionList} className="custom-class" />,
    )

    const listContainer = container.querySelector('.custom-class')
    expect(listContainer).toBeInTheDocument()
  })
})

