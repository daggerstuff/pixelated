import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NotificationChannel } from '@/lib/services/notification/NotificationService'
import { fireEvent, render, screen } from '@testing-library/react'
import { NotificationPreferences } from '../NotificationPreferences'
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences'

// Mock useNotificationPreferences hook
const mockUpdateChannel = vi.fn()
const mockUpdateFrequency = vi.fn()
const mockUpdateQuietHours = vi.fn()
const mockUpdateCategory = vi.fn()
const mockUpdatePreferences = vi.fn()

vi.mock('@/hooks/useNotificationPreferences', () => ({
  useNotificationPreferences: vi.fn(() => ({
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
  })),
}))

describe('notificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state', () => {
    vi.mocked(useNotificationPreferences).mockReturnValue({
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
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(
      0,
    )
  })

  it('renders error state', () => {
    vi.mocked(useNotificationPreferences).mockReturnValue({
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

    expect(screen.getByText('Notification Frequency')).toBeInTheDocument()
    expect(
      screen.getByRole('combobox', { name: /notification frequency/i }),
    ).toBeInTheDocument()
  })

  it('renders quiet hours settings', () => {
    render(<NotificationPreferences />)

    expect(screen.getByText('Quiet Hours')).toBeInTheDocument()
    expect(screen.getByText('Enable quiet hours')).toBeInTheDocument()
  })

  it('shows time inputs when quiet hours are enabled', () => {
    vi.mocked(useNotificationPreferences).mockReturnValue({
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
    expect(screen.getByText('System notifications')).toBeInTheDocument()
    expect(screen.getByText('Security notifications')).toBeInTheDocument()
    expect(screen.getByText('Updates notifications')).toBeInTheDocument()
    expect(screen.getByText('Reminders notifications')).toBeInTheDocument()
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

    const select = screen.getByRole('combobox', {
      name: /notification frequency/i,
    })
    fireEvent.mouseDown(select) // Radix UI Select responds to mousedown

    const dailyOption = screen.getByText('Daily digest')
    fireEvent.click(dailyOption)

    expect(mockUpdateFrequency).toHaveBeenCalledWith('daily')
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
