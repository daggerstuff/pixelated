import { NotificationStatus } from '@/lib/services/notification/NotificationService'
import { fireEvent, render, screen } from '@testing-library/react'
import { NotificationCenter } from '../NotificationCenter'

// Mock useWebSocket hook
vi.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    sendMessage: vi.fn(),
    lastMessage: null,
  }),
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
    const { rerender } = render(<NotificationCenter />)

    // Mock WebSocket message for unread count
    vi.mocked(useWebSocket).mockReturnValue({
      sendMessage: vi.fn(),
      lastMessage: {
        data: JSON.stringify({
          type: 'unread_count',
          data: 5,
        }),
      },
    })

    rerender(<NotificationCenter />)
    expect(screen.getByText('5')).toBeInTheDocument()
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
    const mockNotification = {
      id: '1',
      title: 'Test Notification',
      body: 'This is a test notification',
      status: NotificationStatus.PENDING,
      createdAt: Date.now(),
    }

    vi.mocked(useWebSocket).mockReturnValue({
      sendMessage: vi.fn(),
      lastMessage: {
        data: JSON.stringify({
          type: 'notifications',
          data: [mockNotification],
        }),
      },
    })

    render(<NotificationCenter />)
    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByText('Test Notification')).toBeInTheDocument()
    expect(screen.getByText('This is a test notification')).toBeInTheDocument()
  })

  it('marks notification as read when clicking check button', async () => {
    const mockSendMessage = vi.fn()
    const mockNotification = {
      id: '1',
      title: 'Test Notification',
      body: 'This is a test notification',
      status: NotificationStatus.PENDING,
      createdAt: Date.now(),
    }

    vi.mocked(useWebSocket).mockReturnValue({
      sendMessage: mockSendMessage,
      lastMessage: {
        data: JSON.stringify({
          type: 'notifications',
          data: [mockNotification],
        }),
      },
    })

    render(<NotificationCenter />)
    fireEvent.click(screen.getByRole('button'))

    const checkButton = screen.getByRole('button', { name: /mark as read/i })
    fireEvent.click(checkButton)

    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'mark_read',
      notificationId: '1',
    })
  })

  it('dismisses notification when clicking dismiss button', async () => {
    const mockSendMessage = vi.fn()
    const mockNotification = {
      id: '1',
      title: 'Test Notification',
      body: 'This is a test notification',
      status: NotificationStatus.PENDING,
      createdAt: Date.now(),
    }

    vi.mocked(useWebSocket).mockReturnValue({
      sendMessage: mockSendMessage,
      lastMessage: {
        data: JSON.stringify({
          type: 'notifications',
          data: [mockNotification],
        }),
      },
    })

    render(<NotificationCenter />)
    fireEvent.click(screen.getByRole('button'))

    const dismissButton = screen.getByRole('button', { name: /dismiss/i })
    fireEvent.click(dismissButton)

    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'dismiss',
      notificationId: '1',
    })
  })

  it('closes notification panel when clicking close button', () => {
    render(<NotificationCenter />)

    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByRole('button', { name: /close/i }))

    expect(screen.queryByText('Notifications')).not.toBeInTheDocument()
  })

  it('updates notification list when new notification is received', () => {
    const { rerender } = render(<NotificationCenter />)
    fireEvent.click(screen.getByRole('button'))

    const newNotification = {
      id: '2',
      title: 'New Notification',
      body: 'This is a new notification',
      status: NotificationStatus.PENDING,
      createdAt: Date.now(),
    }

    vi.mocked(useWebSocket).mockReturnValue({
      sendMessage: vi.fn(),
      lastMessage: {
        data: JSON.stringify({
          type: 'notification',
          data: newNotification,
        }),
      },
    })

    rerender(<NotificationCenter />)
    expect(screen.getByText('New Notification')).toBeInTheDocument()
  })
})
