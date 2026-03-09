import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { fireEvent, render, screen, act } from '@testing-library/react'
import { NotificationCenter } from '../NotificationCenter'
import { useWebSocket } from '@/hooks/useWebSocket'
import { NotificationStatus } from '@/lib/services/notification/NotificationService'

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

    expect(
      screen.getByRole('button', { name: /toggle notifications/i }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/\d+/)).not.toBeInTheDocument()
  })

  it('displays unread count badge when unreadCount message is received', () => {
    let capturedOnMessage: ((msg: any) => void) | undefined
    ;(useWebSocket as Mock).mockImplementation(({ onMessage }) => {
      capturedOnMessage = onMessage
      return {
        isConnected: true,
        error: null,
        sendMessage: vi.fn(),
        sendStatus: vi.fn(),
      }
    })

    render(<NotificationCenter />)

    act(() => {
      capturedOnMessage?.({
        content: JSON.stringify({
          type: 'unreadCount',
          unreadCount: 5,
        }),
      })
    })

    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('opens notification panel on button click', () => {
    render(<NotificationCenter />)

    fireEvent.click(
      screen.getByRole('button', { name: /toggle notifications/i }),
    )
    expect(screen.getByText('Notifications')).toBeInTheDocument()
  })

  it('displays notifications when they are received', () => {
    let capturedOnMessage: ((msg: any) => void) | undefined
    ;(useWebSocket as Mock).mockImplementation(({ onMessage }) => {
      capturedOnMessage = onMessage
      return {
        isConnected: true,
        error: null,
        sendMessage: vi.fn(),
        sendStatus: vi.fn(),
      }
    })

    render(<NotificationCenter />)
    fireEvent.click(
      screen.getByRole('button', { name: /toggle notifications/i }),
    )

    act(() => {
      capturedOnMessage?.({
        content: JSON.stringify({
          type: 'notifications',
          notifications: [
            {
              id: '1',
              title: 'Test Notification',
              body: 'This is a test notification',
              status: NotificationStatus.PENDING,
              createdAt: Date.now(),
            },
          ],
        }),
      })
    })

    expect(screen.getByText('Test Notification')).toBeInTheDocument()
    expect(screen.getByText('This is a test notification')).toBeInTheDocument()
  })

  it('marks notification as read when clicking check button', async () => {
    const mockSendMessage = vi.fn()
    let capturedOnMessage: ((msg: any) => void) | undefined
    ;(useWebSocket as Mock).mockImplementation(({ onMessage }) => {
      capturedOnMessage = onMessage
      return {
        isConnected: true,
        error: null,
        sendMessage: mockSendMessage,
        sendStatus: vi.fn(),
      }
    })

    render(<NotificationCenter />)
    fireEvent.click(
      screen.getByRole('button', { name: /toggle notifications/i }),
    )

    act(() => {
      capturedOnMessage?.({
        content: JSON.stringify({
          type: 'notifications',
          notifications: [
            {
              id: '1',
              title: 'Test Notification',
              body: 'This is a test notification',
              status: NotificationStatus.PENDING,
              createdAt: Date.now(),
            },
          ],
        }),
      })
    })

    const checkButton = screen.getByRole('button', { name: /mark as read/i })
    fireEvent.click(checkButton)

    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('"type":"mark_read"'),
      }),
    )
  })

  it('dismisses notification when clicking dismiss button', async () => {
    const mockSendMessage = vi.fn()
    let capturedOnMessage: ((msg: any) => void) | undefined
    ;(useWebSocket as Mock).mockImplementation(({ onMessage }) => {
      capturedOnMessage = onMessage
      return {
        isConnected: true,
        error: null,
        sendMessage: mockSendMessage,
        sendStatus: vi.fn(),
      }
    })

    render(<NotificationCenter />)
    fireEvent.click(
      screen.getByRole('button', { name: /toggle notifications/i }),
    )

    act(() => {
      capturedOnMessage?.({
        content: JSON.stringify({
          type: 'notifications',
          notifications: [
            {
              id: '1',
              title: 'Test Notification',
              body: 'This is a test notification',
              status: NotificationStatus.PENDING,
              createdAt: Date.now(),
            },
          ],
        }),
      })
    })

    const dismissButton = screen.getByRole('button', {
      name: /dismiss notification/i,
    })
    fireEvent.click(dismissButton)

    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('"type":"dismiss"'),
      }),
    )
  })

  it('closes notification panel when clicking close button', () => {
    render(<NotificationCenter />)

    fireEvent.click(
      screen.getByRole('button', { name: /toggle notifications/i }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: /close notifications/i }),
    )

    expect(screen.queryByText('Notifications')).not.toBeInTheDocument()
  })
})
