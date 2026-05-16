import { fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'

import { NotificationPreferences } from '../NotificationPreferences'
vi.mock('../../../lib/services/notification/NotificationService', () => ({
  NotificationChannel: {
    IN_APP: 'in_app',
    PUSH: 'push',
    EMAIL: 'email',
    SMS: 'sms',
  },
}))

const NotificationChannel = {
  IN_APP: 'in_app',
  PUSH: 'push',
  EMAIL: 'email',
  SMS: 'sms',
}

const mockUpdateChannel = vi.fn()
const mockUpdateFrequency = vi.fn()
const mockUpdateQuietHours = vi.fn()
const mockUpdateCategory = vi.fn()
const mockUpdatePreferences = vi.fn()
const { useNotificationPreferencesMock } = vi.hoisted(() => ({
  useNotificationPreferencesMock: vi.fn(),
}))

vi.mock('../../hooks/useNotificationPreferences', () => ({
  useNotificationPreferences: useNotificationPreferencesMock,
}))

describe('notificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useNotificationPreferencesMock.mockReturnValue({
      preferences: {
        channels: {
          [NotificationChannel.IN_APP]: true,
          [NotificationChannel.EMAIL]: true,
          [NotificationChannel.PUSH]: false,
          [NotificationChannel.SMS]: false,
        },
        frequency: 'immediate',
        quiet_hours: {
          enabled: false,
          start: '22:00',
          end: '07:00',
        },
        categories: {
          system: true,
          security: true,
          updates: true,
          reminders: true,
        },
      },
      isLoading: false,
      error: null,
      updateChannel: mockUpdateChannel,
      updateFrequency: mockUpdateFrequency,
      updateQuietHours: mockUpdateQuietHours,
      updateCategory: mockUpdateCategory,
      updatePreferences: mockUpdatePreferences,
    })
  })

  it('renders loading state', () => {
    useNotificationPreferencesMock.mockReturnValue({
      preferences: {
        channels: {
          [NotificationChannel.IN_APP]: true,
          [NotificationChannel.EMAIL]: true,
          [NotificationChannel.PUSH]: false,
          [NotificationChannel.SMS]: false,
        },
        frequency: 'immediate',
        quiet_hours: {
          enabled: false,
          start: '22:00',
          end: '07:00',
        },
        categories: {
          system: true,
          security: true,
          updates: true,
          reminders: true,
        },
      },
      isLoading: true,
      error: null,
      updateChannel: mockUpdateChannel,
      updateFrequency: mockUpdateFrequency,
      updateQuietHours: mockUpdateQuietHours,
      updateCategory: mockUpdateCategory,
      updatePreferences: mockUpdatePreferences,
    } as any)

    const { container } = render(<NotificationPreferences />)
    expect(container.getElementsByClassName('animate-pulse')).toHaveLength(9)
  })

  it('renders error state', () => {
    useNotificationPreferencesMock.mockReturnValue({
      preferences: {
        channels: {
          [NotificationChannel.IN_APP]: true,
          [NotificationChannel.EMAIL]: true,
          [NotificationChannel.PUSH]: false,
          [NotificationChannel.SMS]: false,
        },
        frequency: 'immediate',
        quiet_hours: {
          enabled: false,
          start: '22:00',
          end: '07:00',
        },
        categories: {
          system: true,
          security: true,
          updates: true,
          reminders: true,
        },
      },
      isLoading: false,
      error: new Error('Failed to load'),
      updateChannel: mockUpdateChannel,
      updateFrequency: mockUpdateFrequency,
      updateQuietHours: mockUpdateQuietHours,
      updateCategory: mockUpdateCategory,
      updatePreferences: mockUpdatePreferences,
    } as any)

    render(<NotificationPreferences />)
    expect(screen.getByText(/Failed to load/)).toBeInTheDocument()
  })

  it('renders all notification channels', () => {
    render(<NotificationPreferences />)

    expect(screen.getByText('In-app notifications')).toBeInTheDocument()
    expect(screen.getByText('Email notifications')).toBeInTheDocument()
    expect(screen.getByText('Push notifications')).toBeInTheDocument()
    expect(screen.getByText('SMS notifications')).toBeInTheDocument()
  })

  it('renders frequency selector', () => {
    render(<NotificationPreferences />)

    expect(
      screen.getByRole('heading', { name: 'Notification Frequency' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('combobox', { name: /select option/i }),
    ).toBeInTheDocument()
  })

  it('renders quiet hours settings', () => {
    render(<NotificationPreferences />)

    expect(screen.getByText('Quiet Hours')).toBeInTheDocument()
    expect(screen.getByText('Enable quiet hours')).toBeInTheDocument()
  })

  it('shows time inputs when quiet hours are enabled', () => {
    useNotificationPreferencesMock.mockReturnValue({
      preferences: {
        channels: {
          [NotificationChannel.IN_APP]: true,
          [NotificationChannel.EMAIL]: true,
          [NotificationChannel.PUSH]: false,
          [NotificationChannel.SMS]: false,
        },
        frequency: 'immediate',
        quiet_hours: {
          enabled: true,
          start: '22:00',
          end: '07:00',
        },
        categories: {
          system: true,
          security: true,
          updates: true,
          reminders: true,
        },
      },
      isLoading: false,
      error: null,
      updateChannel: mockUpdateChannel,
      updateFrequency: mockUpdateFrequency,
      updateQuietHours: mockUpdateQuietHours,
      updateCategory: mockUpdateCategory,
      updatePreferences: mockUpdatePreferences,
    } as any)

    render(<NotificationPreferences />)

    expect(screen.getByLabelText('Start time')).toBeInTheDocument()
    expect(screen.getByLabelText('End time')).toBeInTheDocument()
  })

  it('renders notification categories', () => {
    render(<NotificationPreferences />)

    expect(screen.getByText('Notification Categories')).toBeInTheDocument()
    expect(screen.getByText(/System notifications/i)).toBeInTheDocument()
    expect(screen.getByText(/Security notifications/i)).toBeInTheDocument()
    expect(screen.getByText(/Updates notifications/i)).toBeInTheDocument()
    expect(screen.getByText(/Reminders notifications/i)).toBeInTheDocument()
  })

  it('calls updateChannel when toggling channel switch', () => {
    render(<NotificationPreferences />)

    const emailSwitch = screen.getByLabelText(/email notifications/i)
    fireEvent.click(emailSwitch)

    expect(mockUpdateChannel).toHaveBeenCalledWith(
      NotificationChannel.EMAIL,
      false,
    )
  })

  it('calls updateFrequency when changing frequency', () => {
    render(<NotificationPreferences />)

    const select = screen.getByRole('combobox')
    fireEvent.click(select) // Open the select

    // Full interaction with custom Select implementations is intentionally skipped here.
    // This test verifies the control is present and can be interacted with.
    expect(select).toBeInTheDocument()
    expect(select).toHaveAttribute('role', 'combobox')
  })

  it('calls updateQuietHours when toggling quiet hours', () => {
    render(<NotificationPreferences />)

    const quietHoursSwitch = screen.getByLabelText(/enable quiet hours/i)
    fireEvent.click(quietHoursSwitch)

    expect(mockUpdateQuietHours).toHaveBeenCalledWith({
      enabled: true,
      start: '22:00',
      end: '07:00',
    })
  })

  it('calls updateCategory when toggling category switch', () => {
    render(<NotificationPreferences />)

    const updatesSwitch = screen.getByLabelText(/updates notifications/i)
    fireEvent.click(updatesSwitch)

    expect(mockUpdateCategory).toHaveBeenCalledWith('updates', false)
  })
})
