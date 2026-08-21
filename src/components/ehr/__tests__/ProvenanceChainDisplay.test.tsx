import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ProvenanceChainDisplay } from '../ProvenanceChainDisplay'

interface ProvenanceEntry {
  id: string
  recorded: string
  agentWho: string
  agentOnBehalfOf: string | null
  activityType: string
  targetReference: string
  signatureData: string | null
  signatureFormat: string | null
  signatureWhen: string | null
  raw: Record<string, unknown>
}

const mockProvenanceEntries: ProvenanceEntry[] = [
  {
    id: 'prov-1',
    recorded: '2024-01-15T10:00:00Z',
    agentWho: 'Practitioner/dr-smith',
    agentOnBehalfOf: null,
    activityType: 'create',
    targetReference: 'Consent/consent-1',
    signatureData: 'base64signaturedata1234567890abcdef',
    signatureFormat: 'application/jose',
    signatureWhen: '2024-01-15T10:00:00Z',
    raw: {
      resourceType: 'Provenance',
      id: 'prov-1',
      target: [{ reference: 'Consent/consent-1' }],
      recorded: '2024-01-15T10:00:00Z',
      agent: [{ who: { reference: 'Practitioner/dr-smith' } }],
      signature: [
        {
          when: '2024-01-15T10:00:00Z',
          data: 'base64signaturedata1234567890abcdef',
          sigFormat: 'application/jose',
        },
      ],
    },
  },
  {
    id: 'prov-2',
    recorded: '2024-03-01T12:00:00Z',
    agentWho: 'Practitioner/dr-jones',
    agentOnBehalfOf: 'Organization/hospital-1',
    activityType: 'withdraw',
    targetReference: 'Consent/consent-1',
    signatureData: 'base64signaturedata9876543210fedcba',
    signatureFormat: 'application/jose',
    signatureWhen: '2024-03-01T12:00:00Z',
    raw: {
      resourceType: 'Provenance',
      id: 'prov-2',
      target: [{ reference: 'Consent/consent-1' }],
      recorded: '2024-03-01T12:00:00Z',
      agent: [
        {
          who: { reference: 'Practitioner/dr-jones' },
          onBehalfOf: { reference: 'Organization/hospital-1' },
        },
      ],
      signature: [
        {
          when: '2024-03-01T12:00:00Z',
          data: 'base64signaturedata9876543210fedcba',
          sigFormat: 'application/jose',
        },
      ],
    },
  },
]

function mockFetch(entries: ProvenanceEntry[] = mockProvenanceEntries) {
  return vi.fn().mockImplementation((url: string) => {
    if (url.includes('/provenance?')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(entries),
      })
    }
    if (url.includes('/verify-chain')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            valid: true,
            details: 'Chain verified successfully',
          }),
      })
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    })
  })
}

describe('ProvenanceChainDisplay', () => {
  beforeEach(() => {
    global.fetch = mockFetch()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the component with title', () => {
    render(<ProvenanceChainDisplay patientId="patient-123" />)
    expect(screen.getByText('Provenance Chain')).toBeInTheDocument()
  })

  it('fetches and displays provenance entries', async () => {
    render(<ProvenanceChainDisplay patientId="patient-123" />)

    await waitFor(() => {
      expect(screen.getByText('Practitioner/dr-smith')).toBeInTheDocument()
      expect(screen.getByText('Practitioner/dr-jones')).toBeInTheDocument()
    })
  })

  it('shows loading state while fetching', async () => {
    global.fetch = vi.fn().mockImplementation(
      () =>
        new Promise(() => {
          // Never resolves
        }),
    )

    render(<ProvenanceChainDisplay patientId="patient-123" />)

    await waitFor(() => {
      expect(
        screen.getByText('Loading provenance records...'),
      ).toBeInTheDocument()
    })
  })

  it('shows error state on fetch failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Server error' }),
    })

    render(<ProvenanceChainDisplay patientId="patient-123" />)

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch provenance/)).toBeInTheDocument()
    })
    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('shows empty state when no provenance records', async () => {
    global.fetch = mockFetch([])

    render(<ProvenanceChainDisplay patientId="patient-123" />)

    await waitFor(() => {
      expect(screen.getByText('No provenance records')).toBeInTheDocument()
    })
  })

  it('displays activity type badges', async () => {
    render(<ProvenanceChainDisplay patientId="patient-123" />)

    await waitFor(() => {
      expect(screen.getByText('create')).toBeInTheDocument()
      expect(screen.getByText('withdraw')).toBeInTheDocument()
    })
  })

  it('displays agent information', async () => {
    render(<ProvenanceChainDisplay patientId="patient-123" />)

    await waitFor(() => {
      expect(screen.getAllByText('Agent:').length).toBeGreaterThan(0)
      expect(screen.getByText('Practitioner/dr-smith')).toBeInTheDocument()
      expect(screen.getByText('Practitioner/dr-jones')).toBeInTheDocument()
    })
  })

  it('displays on behalf of when present', async () => {
    render(<ProvenanceChainDisplay patientId="patient-123" />)

    await waitFor(() => {
      expect(screen.getByText('On behalf of:')).toBeInTheDocument()
      expect(screen.getByText('Organization/hospital-1')).toBeInTheDocument()
    })
  })

  it('displays target reference', async () => {
    render(<ProvenanceChainDisplay patientId="patient-123" />)

    await waitFor(() => {
      expect(screen.getAllByText('Target:').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Consent/consent-1').length).toBeGreaterThan(0)
    })
  })

  it('displays signature information', async () => {
    render(<ProvenanceChainDisplay patientId="patient-123" />)

    await waitFor(() => {
      expect(screen.getAllByText('Signature:').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Signed at:').length).toBeGreaterThan(0)
    })
  })

  it('expands entry to show full provenance resource', async () => {
    render(<ProvenanceChainDisplay patientId="patient-123" />)

    await waitFor(() => {
      expect(screen.getByText('Practitioner/dr-smith')).toBeInTheDocument()
    })

    const expandButtons = screen.getAllByLabelText('Expand provenance details')
    fireEvent.click(expandButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Full Provenance Resource')).toBeInTheDocument()
    })
  })

  it('collapses entry when clicking expand again', async () => {
    render(<ProvenanceChainDisplay patientId="patient-123" />)

    await waitFor(() => {
      expect(screen.getByText('Practitioner/dr-smith')).toBeInTheDocument()
    })

    const expandButtons = screen.getAllByLabelText('Expand provenance details')
    fireEvent.click(expandButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Full Provenance Resource')).toBeInTheDocument()
    })

    fireEvent.click(expandButtons[0])

    await waitFor(() => {
      expect(screen.queryByText('Full Provenance Resource')).not.toBeInTheDocument()
    })
  })

  it('calls verify chain endpoint when Verify Chain is clicked', async () => {
    render(<ProvenanceChainDisplay patientId="patient-123" />)

    await waitFor(() => {
      expect(screen.getByText('Practitioner/dr-smith')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByLabelText('Verify provenance chain integrity'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/verify-chain'),
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })

  it('shows Chain Valid result when verification succeeds', async () => {
    render(<ProvenanceChainDisplay patientId="patient-123" />)

    await waitFor(() => {
      expect(screen.getByText('Practitioner/dr-smith')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByLabelText('Verify provenance chain integrity'))

    await waitFor(() => {
      expect(screen.getByText('Chain Valid')).toBeInTheDocument()
      expect(
        screen.getByText('Chain verified successfully'),
      ).toBeInTheDocument()
    })
  })

  it('shows Chain Broken result when verification fails', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/provenance?')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockProvenanceEntries),
        })
      }
      if (url.includes('/verify-chain')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              valid: false,
              details: 'Signature mismatch detected',
            }),
        })
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      })
    })

    render(<ProvenanceChainDisplay patientId="patient-123" />)

    await waitFor(() => {
      expect(screen.getByText('Practitioner/dr-smith')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByLabelText('Verify provenance chain integrity'))

    await waitFor(() => {
      expect(screen.getByText('Chain Broken')).toBeInTheDocument()
      expect(
        screen.getByText('Signature mismatch detected'),
      ).toBeInTheDocument()
    })
  })

  it('shows error in verify result when request fails', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/provenance?')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockProvenanceEntries),
        })
      }
      if (url.includes('/verify-chain')) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({}),
        })
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      })
    })

    render(<ProvenanceChainDisplay patientId="patient-123" />)

    await waitFor(() => {
      expect(screen.getByText('Practitioner/dr-smith')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByLabelText('Verify provenance chain integrity'))

    await waitFor(() => {
      expect(screen.getByText('Chain Broken')).toBeInTheDocument()
      expect(screen.getByText(/Verification failed/)).toBeInTheDocument()
    })
  })

  it('disables Verify Chain button when no entries', async () => {
    global.fetch = mockFetch([])

    render(<ProvenanceChainDisplay patientId="patient-123" />)

    await waitFor(() => {
      expect(screen.getByText('No provenance records')).toBeInTheDocument()
    })

    expect(
      screen.getByLabelText('Verify provenance chain integrity'),
    ).toBeDisabled()
  })

  it('passes consentId to fetch URL when provided', async () => {
    render(
      <ProvenanceChainDisplay
        patientId="patient-123"
        consentId="consent-1"
      />,
    )

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('consent=consent-1'),
      )
    })
  })

  it('shows consent-specific label when consentId is provided', async () => {
    render(
      <ProvenanceChainDisplay
        patientId="patient-123"
        consentId="consent-1"
      />,
    )

    expect(
      screen.getByText('Chain for consent consent-1'),
    ).toBeInTheDocument()
  })

  it('shows patient-specific label when no consentId', async () => {
    render(<ProvenanceChainDisplay patientId="patient-123" />)

    expect(
      screen.getByText(
        'All provenance records for patient patient-123',
      ),
    ).toBeInTheDocument()
  })

  it('retries fetch when Retry button is clicked', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Server error' }),
    })

    render(<ProvenanceChainDisplay patientId="patient-123" />)

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })

    // Fix fetch
    global.fetch = mockFetch()

    fireEvent.click(screen.getByText('Retry'))

    await waitFor(() => {
      expect(screen.getByText('Practitioner/dr-smith')).toBeInTheDocument()
    })
  })

  it('renders timeline with semantic list role', async () => {
    render(<ProvenanceChainDisplay patientId="patient-123" />)

    await waitFor(() => {
      expect(screen.getByText('Practitioner/dr-smith')).toBeInTheDocument()
    })

    const timeline = screen.getByLabelText('Provenance chain timeline')
    expect(timeline.tagName).toBe('OL')
  })

  it('refreshes data when Refresh button is clicked', async () => {
    render(<ProvenanceChainDisplay patientId="patient-123" />)

    await waitFor(() => {
      expect(screen.getByText('Practitioner/dr-smith')).toBeInTheDocument()
    })

    const refreshButton = screen.getByLabelText('Refresh provenance records')
    fireEvent.click(refreshButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })
})
