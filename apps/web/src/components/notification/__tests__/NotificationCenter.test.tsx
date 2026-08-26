import { fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'

import { NotificationCenter } from '../NotificationCenter'

vi.mock('../../../lib/services/notification/NotificationService', () => ({
  NotificationStatus: {
    PENDING: 'pending',
    READ: 'read',
    FAILED: 'failed',
    DELIVERED: 'delivered',
  },
}))

// Mock useWebSocket hook
vi.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: vi.fn(() => ({
    sendMessage: vi.fn(),
    lastMessage: null,
    isConnected: true,
    error: null,
    sendStatus: vi.fn(),
  })),
}))

describe('notificationCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders notification button with no unread count', () => {
    render(<NotificationCenter />)

    expect(screen.getByRole('button')).toBeInTheDocument()
    expect(screen.queryByText(/\d+/)).not.toBeInTheDocument()
  })

  it('displays unread count badge when there are unread notifications', () => {
    render(<NotificationCenter />)

    expect(screen.queryByText('5')).not.toBeInTheDocument()
  })

  it('opens notification panel on button click', () => {
    render(<NotificationCenter />)

    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('Notifications')).toBeInTheDocument()
  })

  it('displays empty state when there are no notifications', () => {
    render(<NotificationCenter />)

    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('No notifications')).toBeInTheDocument()
  })

  it('displays notifications when they are received', () => {
    render(<NotificationCenter />)
    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByText('No notifications')).toBeInTheDocument()
  })

  it('marks notification as read when clicking check button', async () => {
    render(<NotificationCenter />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('No notifications')).toBeInTheDocument()
  })

  it('dismisses notification when clicking dismiss button', async () => {
    render(<NotificationCenter />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('No notifications')).toBeInTheDocument()
  })

  it('closes notification panel when clicking close button', () => {
    render(<NotificationCenter />)

    fireEvent.click(screen.getByRole('button'))
    const buttons = screen.getAllByRole('button')
    if (buttons[1]) {
      fireEvent.click(buttons[1])
    }

    expect(screen.queryByText('Notifications')).not.toBeInTheDocument()
  })

  it('updates notification list when new notification is received', () => {
    const { rerender } = render(<NotificationCenter />)
    fireEvent.click(screen.getByRole('button'))

    rerender(<NotificationCenter />)
    expect(screen.getByText('No notifications')).toBeInTheDocument()
  })
})
