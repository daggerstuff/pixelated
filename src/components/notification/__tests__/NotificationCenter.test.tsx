import { describe, it, expect, beforeEach, vi } from 'vitest'
import { afterEach } from 'vitest'
import { fireEvent, render, screen, act } from '@testing-library/react'
import { cleanup } from '@testing-library/react'
import { NotificationCenter } from '../NotificationCenter'
import { useWebSocket } from '@/hooks/useWebSocket'
import { NotificationStatus } from '@/lib/services/notification/NotificationService'
import React from 'react'

// Mock useWebSocket hook
vi.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: vi.fn(),
}))

describe('NotificationCenter', () => {
  const mockSendMessage = vi.fn()
  const mockSendStatus = vi.fn()
  let capturedOnMessage: ((message: any) => void) | undefined

  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    capturedOnMessage = undefined

    vi.mocked(useWebSocket).mockImplementation(({ onMessage }: any) => {
      capturedOnMessage = onMessage
      return {
        isConnected: true,
        error: null,
        sendMessage: mockSendMessage,
        sendStatus: mockSendStatus,
      }
    })
  })

  it('renders notification button with no unread count', () => {
    render(<NotificationCenter />)
    const button = screen.getByRole('button', { name: /toggle notifications/i })
    expect(button).toBeInTheDocument()
    expect(screen.queryByText(/\d+/)).not.toBeInTheDocument()
  })

  it('displays unread count badge when there are unread notifications', () => {
    render(<NotificationCenter />)

    act(() => {
      capturedOnMessage?.({
        content: JSON.stringify({ type: 'unreadCount', count: 5 })
      })
    })

    expect(screen.getByText('5')).toBeInTheDocument()
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

  it('displays notifications when they are received', () => {
    render(<NotificationCenter />)

    const mockNotifications = [
      {
        id: '1',
        title: 'Test Notification',
        body: 'This is a test notification',
        status: NotificationStatus.PENDING,
        createdAt: Date.now(),
        userId: 'user1',
        templateId: 't1'
      }
    ]

    act(() => {
      capturedOnMessage?.({
        content: JSON.stringify({ type: 'notifications', data: mockNotifications })
      })
    })

    fireEvent.click(screen.getByRole('button', { name: /toggle notifications/i }))

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
        userId: 'user1',
        templateId: 't1'
      }
    ]

    act(() => {
      capturedOnMessage?.({
        content: JSON.stringify({ type: 'notifications', data: mockNotifications })
      })
    })

    fireEvent.click(screen.getByRole('button', { name: /toggle notifications/i }))

    const checkButton = screen.getByRole('button', { name: /mark as read/i })
    fireEvent.click(checkButton)

    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('"type":"mark_read"')
    }))

    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('"notificationId":"1"')
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
        userId: 'user1',
        templateId: 't1'
      }
    ]

    act(() => {
      capturedOnMessage?.({
        content: JSON.stringify({ type: 'notifications', data: mockNotifications })
      })
    })

    fireEvent.click(screen.getByRole('button', { name: /toggle notifications/i }))

    const dismissButton = screen.getByRole('button', { name: /dismiss notification/i })
    fireEvent.click(dismissButton)

    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('"type":"dismiss"')
    }))

    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('"notificationId":"1"')
    }))
  })

  it('closes notification panel when clicking close button', () => {
    render(<NotificationCenter />)

    fireEvent.click(screen.getByRole('button', { name: /toggle notifications/i }))
    fireEvent.click(screen.getByRole('button', { name: /close/i }))

    expect(screen.queryByText('Notifications')).not.toBeInTheDocument()
  })

  it('updates notification list when new notification is received', () => {
    render(<NotificationCenter />)

    const mockNotification = {
      id: '2',
      title: 'New Notification',
      body: 'You have a new message',
      status: NotificationStatus.PENDING,
      createdAt: Date.now(),
      userId: 'user1',
      templateId: 't1'
    }

    act(() => {
      capturedOnMessage?.({
        content: JSON.stringify({ type: 'notification', data: mockNotification })
      })
    })

    fireEvent.click(screen.getByRole('button', { name: /toggle notifications/i }))
    expect(screen.getByText('New Notification')).toBeInTheDocument()
  })
})
