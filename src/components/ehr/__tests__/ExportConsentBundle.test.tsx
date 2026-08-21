import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'

import { ExportConsentBundle } from '../ExportConsentBundle'

const mockFetch = vi.fn()

function mockResponse(data: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(data),
  } as Response
}

describe('ExportConsentBundle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
    global.fetch = mockFetch
  })

  it('renders export button with correct label', () => {
    render(<ExportConsentBundle patientId="patient-123" />)

    expect(
      screen.getByText('Export Consent Bundle'),
    ).toBeInTheDocument()
  })

  it('has accessible aria-label on button', () => {
    render(<ExportConsentBundle patientId="patient-123" />)

    const button = screen.getByRole('button')
    expect(button).toHaveAttribute(
      'aria-label',
      'Export consent bundle as FHIR JSON',
    )
  })

  it('shows loading state during fetch', async () => {
    mockFetch.mockReturnValue(new Promise(() => {}))

    render(<ExportConsentBundle patientId="patient-123" />)

    fireEvent.click(screen.getByText('Export Consent Bundle'))

    await waitFor(() => {
      expect(screen.getByText('Exporting...')).toBeInTheDocument()
    })

    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toBeDisabled()
  })

  it('fetches consents and provenance on click', async () => {
    const consents = [
      { id: 'consent-1', provenanceId: 'prov-1', patientId: 'patient-123' },
      { id: 'consent-2', provenanceId: null, patientId: 'patient-123' },
    ]
    const provenance = {
      resourceType: 'Provenance',
      id: 'prov-1',
      target: [{ reference: 'Consent/consent-1' }],
      recorded: new Date().toISOString(),
      agent: [{ who: { reference: 'Practitioner/provider-1' } }],
    }

    mockFetch
      .mockResolvedValueOnce(mockResponse(consents))
      .mockResolvedValueOnce(mockResponse(provenance))

    render(<ExportConsentBundle patientId="patient-123" />)

    fireEvent.click(screen.getByText('Export Consent Bundle'))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/ehr/v1/consents?patient=patient-123',
      )
    })
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/ehr/v1/consents/consent-1/provenance',
      )
    })
  })

  it('shows success message after successful export', async () => {
    mockFetch.mockResolvedValue(mockResponse([{ id: 'c1', provenanceId: null }]))

    render(<ExportConsentBundle patientId="patient-123" />)

    fireEvent.click(screen.getByText('Export Consent Bundle'))

    await waitFor(() => {
      expect(screen.getByTestId('export-success')).toBeInTheDocument()
    })
    expect(
      screen.getByText('Consent bundle exported successfully'),
    ).toBeInTheDocument()
  })

  it('shows error message on fetch failure', async () => {
    mockFetch.mockResolvedValue(mockResponse(null, false))

    render(<ExportConsentBundle patientId="patient-123" />)

    fireEvent.click(screen.getByText('Export Consent Bundle'))

    await waitFor(() => {
      expect(screen.getByTestId('export-error')).toBeInTheDocument()
    })
    expect(
      screen.getByText('Failed to export consent bundle. Please try again.'),
    ).toBeInTheDocument()
  })

  it('shows error message on network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    render(<ExportConsentBundle patientId="patient-123" />)

    fireEvent.click(screen.getByText('Export Consent Bundle'))

    await waitFor(() => {
      expect(screen.getByTestId('export-error')).toBeInTheDocument()
    })
  })

  it('continues export even if provenance fetch fails', async () => {
    const consents = [
      { id: 'consent-1', provenanceId: 'prov-1', patientId: 'patient-123' },
    ]

    mockFetch
      .mockResolvedValueOnce(mockResponse(consents))
      .mockRejectedValueOnce(new Error('Provenance fetch failed'))

    render(<ExportConsentBundle patientId="patient-123" />)

    fireEvent.click(screen.getByText('Export Consent Bundle'))

    await waitFor(() => {
      expect(screen.getByTestId('export-success')).toBeInTheDocument()
    })
  })

  it('creates download link with correct filename pattern', async () => {
    mockFetch.mockResolvedValue(mockResponse([{ id: 'c1', provenanceId: null }]))

    const originalCreateElement = document.createElement.bind(document)
    const mockLink = {
      href: '',
      download: '',
      click: vi.fn(),
    } as unknown as HTMLAnchorElement
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tag: string) => {
        if (tag === 'a') return mockLink
        return originalCreateElement(tag)
      })

    render(<ExportConsentBundle patientId="patient-123" />)

    fireEvent.click(screen.getByText('Export Consent Bundle'))

    await waitFor(() => {
      expect(mockLink.download).toMatch(
        /^consent-bundle-patient-123-\d{4}-\d{2}-\d{2}\.json$/,
      )
    })

    createElementSpy.mockRestore()
  })

  it('announces loading state via aria-busy', async () => {
    mockFetch.mockReturnValue(new Promise(() => {}))

    render(<ExportConsentBundle patientId="patient-123" />)

    fireEvent.click(screen.getByText('Export Consent Bundle'))

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true')
    })
  })

  it('has status region with aria-live for announcements', () => {
    render(<ExportConsentBundle patientId="patient-123" />)

    const statusRegion = screen.getByRole('status')
    expect(statusRegion).toHaveAttribute('aria-live', 'polite')
  })
})
