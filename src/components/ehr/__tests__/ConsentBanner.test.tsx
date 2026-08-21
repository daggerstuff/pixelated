import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'

import { ConsentBanner } from '../ConsentBanner'

const mockFetch = vi.fn()

function mockResponse(data: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(data),
  } as Response
}

describe('ConsentBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
    global.fetch = mockFetch
    // Reset localStorage.getItem mock that may have been overridden in prior tests
    ;(localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(undefined)
  })

  it('renders loading state initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}))
    render(<ConsentBanner patientId="patient-123" />)

    expect(screen.getByText('Loading consent status...')).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders active consent banner with expiry date', async () => {
    const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    mockFetch.mockResolvedValue(
      mockResponse([
        {
          id: 'consent-1',
          patientId: 'patient-123',
          treatmentType: 'therapy',
          scope: 'treatment',
          status: 'active',
          grantedAt: new Date().toISOString(),
          expiresAt: futureDate,
          withdrawnAt: null,
          withdrawnReason: null,
          performerId: 'provider-1',
          organizationId: null,
          provenanceId: null,
          policyRule: null,
          provisions: [],
        },
      ]),
    )

    render(<ConsentBanner patientId="patient-123" />)

    await waitFor(() => {
      expect(screen.getByTestId('consent-banner')).toBeInTheDocument()
    })

    expect(screen.getByText('Consent Active')).toBeInTheDocument()
    expect(screen.getByText(/Expires:/)).toBeInTheDocument()
  })

  it('renders expiring soon banner with days remaining', async () => {
    const soonDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
    mockFetch.mockResolvedValue(
      mockResponse([
        {
          id: 'consent-1',
          patientId: 'patient-123',
          treatmentType: 'therapy',
          scope: 'treatment',
          status: 'active',
          grantedAt: new Date().toISOString(),
          expiresAt: soonDate,
          withdrawnAt: null,
          withdrawnReason: null,
          performerId: 'provider-1',
          organizationId: null,
          provenanceId: null,
          policyRule: null,
          provisions: [],
        },
      ]),
    )

    render(<ConsentBanner patientId="patient-123" />)

    await waitFor(() => {
      expect(screen.getByText(/Consent Expiring Soon/)).toBeInTheDocument()
    })

    expect(screen.getByText(/days remaining/)).toBeInTheDocument()
  })

  it('renders expired consent banner', async () => {
    const pastDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    mockFetch.mockResolvedValue(
      mockResponse([
        {
          id: 'consent-1',
          patientId: 'patient-123',
          treatmentType: 'therapy',
          scope: 'treatment',
          status: 'expired',
          grantedAt: new Date().toISOString(),
          expiresAt: pastDate,
          withdrawnAt: null,
          withdrawnReason: null,
          performerId: 'provider-1',
          organizationId: null,
          provenanceId: null,
          policyRule: null,
          provisions: [],
        },
      ]),
    )

    render(<ConsentBanner patientId="patient-123" />)

    await waitFor(() => {
      expect(screen.getByText('Consent Expired')).toBeInTheDocument()
    })
  })

  it('renders withdrawn consent banner', async () => {
    mockFetch.mockResolvedValue(
      mockResponse([
        {
          id: 'consent-1',
          patientId: 'patient-123',
          treatmentType: 'therapy',
          scope: 'treatment',
          status: 'withdrawn',
          grantedAt: new Date().toISOString(),
          expiresAt: null,
          withdrawnAt: new Date().toISOString(),
          withdrawnReason: 'Patient request',
          performerId: 'provider-1',
          organizationId: null,
          provenanceId: null,
          policyRule: null,
          provisions: [],
        },
      ]),
    )

    render(<ConsentBanner patientId="patient-123" />)

    await waitFor(() => {
      expect(screen.getByText('Consent Withdrawn')).toBeInTheDocument()
    })
  })

  it('renders no consent on file banner', async () => {
    mockFetch.mockResolvedValue(mockResponse([]))

    render(<ConsentBanner patientId="patient-123" />)

    await waitFor(() => {
      expect(screen.getByText('No consent on file')).toBeInTheDocument()
    })
  })

  it('renders error state on fetch failure', async () => {
    mockFetch.mockResolvedValue(mockResponse(null, false))

    render(<ConsentBanner patientId="patient-123" />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load consent status')).toBeInTheDocument()
    })
  })

  it('dismisses banner and persists to localStorage', async () => {
    const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    mockFetch.mockResolvedValue(
      mockResponse([
        {
          id: 'consent-1',
          patientId: 'patient-123',
          treatmentType: 'therapy',
          scope: 'treatment',
          status: 'active',
          grantedAt: new Date().toISOString(),
          expiresAt: futureDate,
          withdrawnAt: null,
          withdrawnReason: null,
          performerId: 'provider-1',
          organizationId: null,
          provenanceId: null,
          policyRule: null,
          provisions: [],
        },
      ]),
    )

    const setItemSpy = vi.spyOn(window.localStorage, 'setItem')

    render(<ConsentBanner patientId="patient-123" />)

    await waitFor(() => {
      expect(screen.getByTestId('consent-banner')).toBeInTheDocument()
    })

    const dismissButton = screen.getByLabelText('Dismiss consent banner')
    fireEvent.click(dismissButton)

    expect(screen.queryByTestId('consent-banner')).not.toBeInTheDocument()
    expect(setItemSpy).toHaveBeenCalledWith(
      'consent-banner-dismissed-patient-123',
      expect.any(String),
    )
  })

  it('does not render banner when already dismissed in localStorage', async () => {
    localStorage.getItem = vi.fn().mockReturnValue('2024-01-01T00:00:00.000Z')
    mockFetch.mockResolvedValue(mockResponse([]))

    render(<ConsentBanner patientId="patient-123" />)

    await waitFor(() => {
      expect(screen.queryByTestId('consent-banner')).not.toBeInTheDocument()
    })
  })

  it('fetches consent with correct API URL', async () => {
    mockFetch.mockResolvedValue(mockResponse([]))

    render(<ConsentBanner patientId="patient-456" />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/ehr/v1/consents?patient=patient-456',
      )
    })
  })

  it('supports keyboard dismissal with Enter key', async () => {
    const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    mockFetch.mockResolvedValue(
      mockResponse([
        {
          id: 'consent-1',
          patientId: 'patient-123',
          treatmentType: 'therapy',
          scope: 'treatment',
          status: 'active',
          grantedAt: new Date().toISOString(),
          expiresAt: futureDate,
          withdrawnAt: null,
          withdrawnReason: null,
          performerId: 'provider-1',
          organizationId: null,
          provenanceId: null,
          policyRule: null,
          provisions: [],
        },
      ]),
    )

    render(<ConsentBanner patientId="patient-123" />)

    await waitFor(() => {
      expect(screen.getByTestId('consent-banner')).toBeInTheDocument()
    })

    const dismissButton = screen.getByLabelText('Dismiss consent banner')
    fireEvent.keyDown(dismissButton, { key: 'Enter' })

    expect(screen.queryByTestId('consent-banner')).not.toBeInTheDocument()
  })

  it('has accessible ARIA attributes', async () => {
    mockFetch.mockResolvedValue(mockResponse([]))

    render(<ConsentBanner patientId="patient-123" />)

    await waitFor(() => {
      const banner = screen.getByTestId('consent-banner')
      expect(banner).toHaveAttribute('role', 'banner')
      expect(banner).toHaveAttribute('aria-live', 'polite')
    })
  })
})
