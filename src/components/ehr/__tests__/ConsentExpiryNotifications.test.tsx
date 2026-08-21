import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'

import { ConsentExpiryNotifications } from '../ConsentExpiryNotifications'

const mockFetch = vi.fn()

function mockResponse(data: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(data),
  } as Response
}

const sampleNotifications = [
  {
    patientId: 'patient-1',
    patientName: 'John Doe',
    consentId: 'consent-1',
    expiresAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
    daysRemaining: 20,
    status: 'expiring-soon' as const,
  },
  {
    patientId: 'patient-2',
    patientName: 'Jane Smith',
    consentId: 'consent-2',
    expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    daysRemaining: 5,
    status: 'expiring-critical' as const,
  },
  {
    patientId: 'patient-3',
    patientName: 'Bob Wilson',
    consentId: 'consent-3',
    expiresAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    daysRemaining: -3,
    status: 'expired' as const,
  },
]

describe('ConsentExpiryNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
    global.fetch = mockFetch
  })

  it('renders loading state initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}))
    render(<ConsentExpiryNotifications />)

    expect(screen.getByTestId('expiry-notifications-loading')).toBeInTheDocument()
    expect(screen.getByText('Loading expiry notifications...')).toBeInTheDocument()
  })

  it('renders all current message when no expiring consents', async () => {
    mockFetch.mockResolvedValue(mockResponse([]))

    render(<ConsentExpiryNotifications />)

    await waitFor(() => {
      expect(screen.getByTestId('expiry-notifications-all-current')).toBeInTheDocument()
    })
    expect(screen.getByText('All consents current')).toBeInTheDocument()
  })

  it('renders notification list with correct items', async () => {
    mockFetch.mockResolvedValue(mockResponse(sampleNotifications))

    render(<ConsentExpiryNotifications />)

    await waitFor(() => {
      expect(screen.getByTestId('expiry-notifications')).toBeInTheDocument()
    })

    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('Bob Wilson')).toBeInTheDocument()
  })

  it('shows correct status badges', async () => {
    mockFetch.mockResolvedValue(mockResponse(sampleNotifications))

    render(<ConsentExpiryNotifications />)

    await waitFor(() => {
      expect(screen.getByText('Expiring Soon')).toBeInTheDocument()
      expect(screen.getByText('Expiring Critical')).toBeInTheDocument()
      expect(screen.getByText('Expired — Re-consent Required')).toBeInTheDocument()
    })
  })

  it('renders renew consent links with correct href', async () => {
    mockFetch.mockResolvedValue(mockResponse(sampleNotifications))

    render(<ConsentExpiryNotifications />)

    await waitFor(() => {
      const links = screen.getAllByRole('link')
      expect(links).toHaveLength(3)
      expect(links[0]).toHaveAttribute(
        'href',
        '/admin/consent-management?patient=patient-1',
      )
    })
  })

  it('renders error state on fetch failure', async () => {
    mockFetch.mockResolvedValue(mockResponse(null, false))

    render(<ConsentExpiryNotifications />)

    await waitFor(() => {
      expect(screen.getByTestId('expiry-notifications-error')).toBeInTheDocument()
    })
    expect(screen.getByText('Failed to load expiry notifications')).toBeInTheDocument()
  })

  it('retries fetch when retry button clicked', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse(null, false))
      .mockResolvedValueOnce(mockResponse([]))

    render(<ConsentExpiryNotifications />)

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Retry'))

    await waitFor(() => {
      expect(screen.getByTestId('expiry-notifications-all-current')).toBeInTheDocument()
    })
  })

  it('fetches with patientId when provided', async () => {
    mockFetch.mockResolvedValue(mockResponse([]))

    render(<ConsentExpiryNotifications patientId="patient-123" />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/ehr/v1/consents/expiring?patient=patient-123',
      )
    })
  })

  it('fetches without patientId query when not provided', async () => {
    mockFetch.mockResolvedValue(mockResponse([]))

    render(<ConsentExpiryNotifications />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/ehr/v1/consents/expiring')
    })
  })

  it('shows pagination when more than 10 notifications', async () => {
    const manyNotifications = Array.from({ length: 15 }, (_, i) => ({
      patientId: `patient-${i}`,
      patientName: `Patient ${i}`,
      consentId: `consent-${i}`,
      expiresAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
      daysRemaining: 20,
      status: 'expiring-soon' as const,
    }))

    mockFetch.mockResolvedValue(mockResponse(manyNotifications))

    render(<ConsentExpiryNotifications />)

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
    })

    expect(screen.getByLabelText('Previous page')).toBeDisabled()
    expect(screen.getByLabelText('Next page')).not.toBeDisabled()
  })

  it('navigates to next page on button click', async () => {
    const manyNotifications = Array.from({ length: 15 }, (_, i) => ({
      patientId: `patient-${i}`,
      patientName: `Patient ${i}`,
      consentId: `consent-${i}`,
      expiresAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
      daysRemaining: 20,
      status: 'expiring-soon' as const,
    }))

    mockFetch.mockResolvedValue(mockResponse(manyNotifications))

    render(<ConsentExpiryNotifications />)

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByLabelText('Next page'))

    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
    expect(screen.getByLabelText('Next page')).toBeDisabled()
    expect(screen.getByLabelText('Previous page')).not.toBeDisabled()
  })

  it('has accessible region with aria-label', async () => {
    mockFetch.mockResolvedValue(mockResponse(sampleNotifications))

    render(<ConsentExpiryNotifications />)

    await waitFor(() => {
      const region = screen.getByTestId('expiry-notifications')
      expect(region).toHaveAttribute('role', 'region')
      expect(region).toHaveAttribute('aria-label', 'Consent expiry notifications')
    })
  })

  it('shows days remaining for non-expired notifications', async () => {
    mockFetch.mockResolvedValue(mockResponse([sampleNotifications[0]]))

    render(<ConsentExpiryNotifications />)

    await waitFor(() => {
      expect(screen.getByText(/20 days remaining/)).toBeInTheDocument()
    })
  })

  it('does not show days remaining for expired notifications', async () => {
    mockFetch.mockResolvedValue(mockResponse([sampleNotifications[2]]))

    render(<ConsentExpiryNotifications />)

    await waitFor(() => {
      expect(screen.getByText('Bob Wilson')).toBeInTheDocument()
    })

    expect(screen.queryByText(/days remaining/)).not.toBeInTheDocument()
  })
})
