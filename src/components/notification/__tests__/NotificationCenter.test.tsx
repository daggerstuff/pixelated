import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fireEvent, render, screen, cleanup, act } from '@testing-library/react'
import { NotificationCenter } from '../NotificationCenter'
import { useWebSocket } from '@/hooks/useWebSocket'
import { NotificationStatus } from '@/lib/services/notification/NotificationService'

// Mock useWebSocket hook
vi.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: vi.fn(),
}))

describe('NotificationCenter', () => {
  let mockSendMessage: any
  let capturedOnMessage: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockSendMessage = vi.fn()
    capturedOnMessage = null

    vi.mocked(useWebSocket).mockImplementation(({ onMessage }: any) => {
      capturedOnMessage = onMessage
      return {
        sendMessage: mockSendMessage,
        isConnected: true,
        error: null,
        sendStatus: vi.fn(),
      }
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders notification button with no unread count', () => {
    render(<NotificationCenter />)
    expect(screen.getByLabelText('Toggle notifications')).toBeInTheDocument()
    expect(screen.queryByText(/\d+/)).not.toBeInTheDocument()
  })

  it('displays unread count badge when there are unread notifications', async () => {
    render(<NotificationCenter />)

    await act(async () => {
      capturedOnMessage({
        content: JSON.stringify({ type: 'unreadCount', count: 5 })
      })
    })

    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('opens notification panel on button click', () => {
    render(<NotificationCenter />)
    fireEvent.click(screen.getByLabelText('Toggle notifications'))
    expect(screen.getByText('Notifications')).toBeInTheDocument()
  })

  it('displays empty state when there are no notifications', () => {
    render(<NotificationCenter />)
    fireEvent.click(screen.getByLabelText('Toggle notifications'))
    expect(screen.getByText('No notifications')).toBeInTheDocument()
  })

  it('displays notifications when they are received', async () => {
    render(<NotificationCenter />)

    const mockNotifications = [
      {
        id: '1',
        title: 'Test Notification',
        body: 'This is a test notification',
        status: NotificationStatus.PENDING,
        createdAt: Date.now(),
      }
    ]

    await act(async () => {
      capturedOnMessage({
        content: JSON.stringify({ type: 'notifications', data: mockNotifications })
      })
    })

    fireEvent.click(screen.getByLabelText('Toggle notifications'))
    expect(screen.getByText('Test Notification')).toBeInTheDocument()
    expect(screen.getByText('This is a test notification')).toBeInTheDocument()
  })

  it('marks notification as read when clicking check button', async () => {
    render(<NotificationCenter />)

    const mockNotifications = [
      {
        id: '1',
        title: 'Test Notification',
        body: 'This is a test notification',
        status: NotificationStatus.PENDING,
        createdAt: Date.now(),
      }
    ]

    await act(async () => {
      capturedOnMessage({
        content: JSON.stringify({ type: 'notifications', data: mockNotifications })
      })
    })

    fireEvent.click(screen.getByLabelText('Toggle notifications'))

    const checkButton = screen.getByLabelText('Mark as read')
    fireEvent.click(checkButton)

    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('"type":"mark_read"')
    }))
  })

  it('dismisses notification when clicking dismiss button', async () => {
    render(<NotificationCenter />)

    const mockNotifications = [
      {
        id: '1',
        title: 'Test Notification',
        body: 'This is a test notification',
        status: NotificationStatus.PENDING,
        createdAt: Date.now(),
      }
    ]

    await act(async () => {
      capturedOnMessage({
        content: JSON.stringify({ type: 'notifications', data: mockNotifications })
      })
    })

    fireEvent.click(screen.getByLabelText('Toggle notifications'))

    const dismissButton = screen.getByLabelText('Dismiss notification')
    fireEvent.click(dismissButton)

    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('"type":"dismiss"')
    }))
  })

  it('closes notification panel when clicking close button', () => {
    render(<NotificationCenter />)

    fireEvent.click(screen.getByLabelText('Toggle notifications')) // Open
    expect(screen.getByText('Notifications')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Close notifications'))

    expect(screen.queryByText('Notifications')).not.toBeInTheDocument()
  })

  it('updates notification list when new notification is received', async () => {
    render(<NotificationCenter />)
    fireEvent.click(screen.getByLabelText('Toggle notifications'))

    const newNotification = {
      id: '2',
      title: 'New Notification',
      body: 'This is a new notification',
      status: NotificationStatus.PENDING,
      createdAt: Date.now(),
    }

    await act(async () => {
      capturedOnMessage({
        content: JSON.stringify({ type: 'notification', data: newNotification })
      })
    })

    expect(screen.getByText('New Notification')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })
})
