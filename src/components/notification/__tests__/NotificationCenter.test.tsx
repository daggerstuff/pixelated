import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { NotificationCenter } from '../NotificationCenter'
import { useWebSocket } from '@/hooks/useWebSocket'

// Mock useWebSocket hook
vi.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: vi.fn(),
}))

describe('notificationCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useWebSocket).mockReturnValue({
      isConnected: true,
      error: null,
      sendMessage: vi.fn(),
      sendStatus: vi.fn(),
      sendRaw: vi.fn(),
    })
  })

  it('renders notification button with no unread count', () => {
    render(<NotificationCenter />)

    expect(screen.getByRole('button')).toBeInTheDocument()
    expect(screen.queryByText(/\d+/)).not.toBeInTheDocument()
  })

  it('displays unread count badge when there are unread notifications', () => {
    let capturedOnMessage: (message: { content: string }) => void = () => {}

    vi.mocked(useWebSocket).mockImplementation(({ onMessage }) => {
      capturedOnMessage = onMessage as any
      return {
        isConnected: true,
        error: null,
        sendMessage: vi.fn(),
        sendStatus: vi.fn(),
        sendRaw: vi.fn(),
      }
    })

    render(<NotificationCenter />)

    act(() => {
      capturedOnMessage({
        content: JSON.stringify({ type: 'unreadCount', count: 5 }),
      })
    })

    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('opens notification panel on button click', () => {
    render(<NotificationCenter />)

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
    expect(screen.getByText('Notifications')).toBeInTheDocument()
  })

  it('displays empty state when there are no notifications', () => {
    render(<NotificationCenter />)

    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('No notifications')).toBeInTheDocument()
  })

  it('displays notifications when they are received', () => {
    let capturedOnMessage: (message: { content: string }) => void = () => {}

    vi.mocked(useWebSocket).mockImplementation(({ onMessage }) => {
      capturedOnMessage = onMessage as any
      return {
        isConnected: true,
        error: null,
        sendMessage: vi.fn(),
        sendStatus: vi.fn(),
        sendRaw: vi.fn(),
      }
    })

    render(<NotificationCenter />)
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    act(() => {
      capturedOnMessage({
        content: JSON.stringify({
          type: 'notifications',
          data: [
            {
              id: '1',
              title: 'Test Notification',
              body: 'This is a test notification',
              createdAt: Date.now(),
              status: 'pending',
            },
          ],
        }),
      })
    })

    expect(screen.getByText('Test Notification')).toBeInTheDocument()
    expect(screen.getByText('This is a test notification')).toBeInTheDocument()
  })

  it('marks notification as read when clicking check button', async () => {
    const mockSendRaw = vi.fn()
    let capturedOnMessage: (message: { content: string }) => void = () => {}

    vi.mocked(useWebSocket).mockImplementation(({ onMessage }) => {
      capturedOnMessage = onMessage as any
      return {
        isConnected: true,
        error: null,
        sendMessage: vi.fn(),
        sendStatus: vi.fn(),
        sendRaw: mockSendRaw,
      }
    })

    render(<NotificationCenter />)
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    act(() => {
      capturedOnMessage({
        content: JSON.stringify({
          type: 'notifications',
          data: [
            {
              id: '1',
              title: 'Test Notification',
              body: 'This is a test notification',
              createdAt: Date.now(),
              status: 'pending',
            },
          ],
        }),
      })
    })

    const checkButton = screen.getByRole('button', { name: /mark as read/i })
    fireEvent.click(checkButton)

    expect(mockSendRaw).toHaveBeenCalledWith({
      type: 'mark_read',
      notificationId: '1',
    })
  })

  it('dismisses notification when clicking dismiss button', async () => {
    const mockSendRaw = vi.fn()
    let capturedOnMessage: (message: { content: string }) => void = () => {}

    vi.mocked(useWebSocket).mockImplementation(({ onMessage }) => {
      capturedOnMessage = onMessage as any
      return {
        isConnected: true,
        error: null,
        sendMessage: vi.fn(),
        sendStatus: vi.fn(),
        sendRaw: mockSendRaw,
      }
    })

    render(<NotificationCenter />)
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    act(() => {
      capturedOnMessage({
        content: JSON.stringify({
          type: 'notifications',
          data: [
            {
              id: '1',
              title: 'Test Notification',
              body: 'This is a test notification',
              createdAt: Date.now(),
              status: 'pending',
            },
          ],
        }),
      })
    })

    const dismissButton = screen.getByRole('button', {
      name: /dismiss notification/i,
    })
    fireEvent.click(dismissButton)

    expect(mockSendRaw).toHaveBeenCalledWith({
      type: 'dismiss',
      notificationId: '1',
    })
  })

  it('closes notification panel when clicking close button', () => {
    render(<NotificationCenter />)

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
    fireEvent.click(screen.getByRole('button', { name: /close notifications/i }))

    expect(screen.queryByText('Notifications')).not.toBeInTheDocument()
  })

  it('updates notification list when new notification is received', () => {
    let capturedOnMessage: (message: { content: string }) => void = () => {}

    vi.mocked(useWebSocket).mockImplementation(({ onMessage }) => {
      capturedOnMessage = onMessage as any
      return {
        isConnected: true,
        error: null,
        sendMessage: vi.fn(),
        sendStatus: vi.fn(),
        sendRaw: vi.fn(),
      }
    })

    render(<NotificationCenter />)
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    act(() => {
      capturedOnMessage({
        content: JSON.stringify({
          type: 'notification',
          data: {
            id: '2',
            title: 'New Notification',
            body: 'A new notification',
            createdAt: Date.now(),
            status: 'pending',
          },
        }),
      })
    })

    expect(screen.getByText('New Notification')).toBeInTheDocument()
  })
})
