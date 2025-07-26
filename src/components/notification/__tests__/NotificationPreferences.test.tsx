import { NotificationChannel } from '@/lib/services/notification/NotificationService'
import { fireEvent, render, screen } from '@testing-library/react'
import { NotificationPreferences } from '../NotificationPreferences'

// Mock useNotificationPreferences hook
vi.mock('@/hooks/useNotificationPreferences', () => ({
  useNotificationPreferences: () => ({
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
    updateChannel: vi.fn(),
    updateFrequency: vi.fn(),
    updateQuietHours: vi.fn(),
    updateCategory: vi.fn(),
  }),
}))

describe('notificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state', () => {
    vi.mocked(useNotificationPreferences).mockReturnValueOnce({
      ...useNotificationPreferences(),
      isLoading: true,
    })

    render(<NotificationPreferences />)
    expect(screen.getAllByTestId('skeleton')).toHaveLength(5)
  })

  it('renders error state', () => {
    vi.mocked(useNotificationPreferences).mockReturnValueOnce({
      ...useNotificationPreferences(),
      error: new Error('Failed to load'),
    })

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
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('renders quiet hours settings', () => {
    render(<NotificationPreferences />)

    expect(screen.getByText('Quiet Hours')).toBeInTheDocument()
    expect(screen.getByText('Enable quiet hours')).toBeInTheDocument()
  })

  it('shows time inputs when quiet hours are enabled', () => {
    vi.mocked(useNotificationPreferences).mockReturnValueOnce({
      ...useNotificationPreferences(),
      preferences: {
        ...useNotificationPreferences().preferences,
        quiet_hours: {
          enabled: true,
          start: '22:00',
          end: '07:00',
        },
      },
    })

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
    const mockUpdateChannel = vi.fn()
    vi.mocked(useNotificationPreferences).mockReturnValueOnce({
      ...useNotificationPreferences(),
      updateChannel: mockUpdateChannel,
    })

    render(<NotificationPreferences />)

    const emailSwitch = screen.getByRole('switch', {
      name: /email notifications/i,
    })
    fireEvent.click(emailSwitch)

    expect(mockUpdateChannel).toHaveBeenCalledWith(
      NotificationChannel.EMAIL,
      false,
    )
  })

  it('calls updateFrequency when changing frequency', () => {
    const mockUpdateFrequency = vi.fn()
    vi.mocked(useNotificationPreferences).mockReturnValueOnce({
      ...useNotificationPreferences(),
      updateFrequency: mockUpdateFrequency,
    })

    render(<NotificationPreferences />)

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'daily' } })

    expect(mockUpdateFrequency).toHaveBeenCalledWith('daily')
  })

  it('calls updateQuietHours when toggling quiet hours', () => {
    const mockUpdateQuietHours = vi.fn()
    vi.mocked(useNotificationPreferences).mockReturnValueOnce({
      ...useNotificationPreferences(),
      updateQuietHours: mockUpdateQuietHours,
    })

    render(<NotificationPreferences />)

    const quietHoursSwitch = screen.getByRole('switch', {
      name: /enable quiet hours/i,
    })
    fireEvent.click(quietHoursSwitch)

    expect(mockUpdateQuietHours).toHaveBeenCalledWith({
      enabled: true,
      start: '22:00',
      end: '07:00',
    })
  })

  it('calls updateCategory when toggling category switch', () => {
    const mockUpdateCategory = vi.fn()
    vi.mocked(useNotificationPreferences).mockReturnValueOnce({
      ...useNotificationPreferences(),
      updateCategory: mockUpdateCategory,
    })

    render(<NotificationPreferences />)

    const updatesSwitch = screen.getByRole('switch', {
      name: /updates notifications/i,
    })
    fireEvent.click(updatesSwitch)

    expect(mockUpdateCategory).toHaveBeenCalledWith('updates', false)
  })
})
