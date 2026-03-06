import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { NotificationCenter } from '../NotificationCenter'
import { useWebSocket } from '@/hooks/useWebSocket'

// Mock useWebSocket hook
vi.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: vi.fn(() => ({
    sendMessage: vi.fn(),
    lastMessage: null,
  })),
}))

describe('notificationCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders notification button with no unread count', () => {
    render(<NotificationCenter />)

    expect(screen.getByRole('button', { name: /toggle notifications/i })).toBeInTheDocument()
    expect(screen.queryByText(/\d+/)).not.toBeInTheDocument()
  })

  it('opens notification panel on button click', () => {
    render(<NotificationCenter />)

    fireEvent.click(screen.getByRole('button', { name: /toggle notifications/i }))
    expect(screen.getByText('Notifications')).toBeInTheDocument()
  })

  it('displays empty state when there are no notifications', () => {
    render(<NotificationCenter />)

    fireEvent.click(screen.getByRole('button', { name: /toggle notifications/i }))
    expect(screen.getByText('No notifications')).toBeInTheDocument()
  })

  it('closes notification panel when clicking close button', () => {
    render(<NotificationCenter />)

    fireEvent.click(screen.getByRole('button', { name: /toggle notifications/i }))
    fireEvent.click(screen.getByRole('button', { name: /close notifications/i }))

    expect(screen.queryByText('Notifications')).not.toBeInTheDocument()
  })
})
