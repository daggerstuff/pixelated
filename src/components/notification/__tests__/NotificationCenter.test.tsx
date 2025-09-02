import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { fireEvent, render, screen, act } from '@testing-library/react'
import { NotificationCenter } from '../NotificationCenter'
import { useWebSocket } from '@/hooks/useWebSocket'
import { NotificationStatus } from '@/lib/services/notification/NotificationService'
import React from 'react'

// Mock the entire module
vi.mock('@/hooks/useWebSocket')

const mockSendMessage = vi.fn()

const mockNotifications = [
  {
    id: '1',
    title: 'Test Notification',
    body: 'This is a test notification',
    status: NotificationStatus.PENDING,
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Another Notification',
    body: 'This is another test notification',
    status: NotificationStatus.READ,
    createdAt: new Date().toISOString(),
  },
]

// Use a mutable object to simulate incoming messages
let lastMessageContainer = { current: null }

vi.mocked(useWebSocket).mockImplementation(() => ({
  sendMessage: mockSendMessage,
  get lastMessage() {
    return lastMessageContainer.current
  },
  isConnected: true,
  error: null,
  sendStatus: vi.fn(),
}))

describe('notificationCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    lastMessageContainer.current = null // Reset before each test
  })

  it('renders notification button with no unread count initially', () => {
    render(<NotificationCenter />)
    expect(screen.getByRole('button', { name: /open notifications/i })).toBeInTheDocument()
    expect(screen.queryByText(/\d+/)).not.toBeInTheDocument()
  })

  it('displays unread count badge when notifications are received', () => {
    const { rerender } = render(<NotificationCenter />)

    act(() => {
      lastMessageContainer.current = {
        data: JSON.stringify({
          type: 'notifications',
          notifications: mockNotifications,
          unread: 1,
        }),
      }
    })

    rerender(<NotificationCenter />)

    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('opens and closes the notification panel', () => {
    render(<NotificationCenter />)
    // Open panel
    fireEvent.click(screen.getByRole('button', { name: /open notifications/i }))
    expect(screen.getByText('Notifications')).toBeInTheDocument()
    // Close panel
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(screen.queryByText('Notifications')).not.toBeInTheDocument()
  })

  it('displays empty state when there are no notifications', () => {
    const { rerender } = render(<NotificationCenter />)

    act(() => {
      lastMessageContainer.current = {
        data: JSON.stringify({
          type: 'notifications',
          notifications: [],
          unread: 0,
        }),
      }
    })

    rerender(<NotificationCenter />)
    fireEvent.click(screen.getByRole('button', { name: /open notifications/i }))
    expect(screen.getByText('No notifications')).toBeInTheDocument()
  })

  it('displays notifications when they are received', () => {
    const { rerender } = render(<NotificationCenter />)
    act(() => {
      lastMessageContainer.current = {
        data: JSON.stringify({
          type: 'notifications',
          notifications: mockNotifications,
          unread: 1,
        }),
      }
    })

    rerender(<NotificationCenter />)
    fireEvent.click(screen.getByRole('button', { name: /open notifications/i }))

    expect(screen.getByText('Test Notification')).toBeInTheDocument()
    expect(screen.getByText('This is a test notification')).toBeInTheDocument()
    expect(screen.getByText('Another Notification')).toBeInTheDocument()
  })

  it('marks notification as read when clicking check button', async () => {
    const { rerender } = render(<NotificationCenter />)
    act(() => {
      lastMessageContainer.current = {
        data: JSON.stringify({
          type: 'notifications',
          notifications: mockNotifications.filter(n => n.status === NotificationStatus.PENDING),
          unread: 1,
        }),
      }
    })

    rerender(<NotificationCenter />)

    fireEvent.click(screen.getByRole('button', { name: /open notifications/i }))

    const checkButton = screen.getByRole('button', { name: /mark as read/i })
    fireEvent.click(checkButton)

    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('"type":"mark_read"'),
      }),
    )
  })

  it('dismisses notification when clicking dismiss button', async () => {
    const { rerender } = render(<NotificationCenter />)
    act(() => {
      lastMessageContainer.current = {
        data: JSON.stringify({
          type: 'notifications',
          notifications: mockNotifications,
          unread: 1,
        }),
      }
    })

    rerender(<NotificationCenter />)
    fireEvent.click(screen.getByRole('button', { name: /open notifications/i }))

    const dismissButton = screen.getAllByRole('button', { name: /dismiss/i })[0]
    fireEvent.click(dismissButton)

    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('"type":"dismiss"'),
      }),
    )
  })
})
