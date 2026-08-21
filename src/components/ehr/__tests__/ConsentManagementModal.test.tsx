import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ConsentRecord } from '@/lib/ehr-native/consent/types'

import { ConsentManagementModal } from '../ConsentManagementModal'

const mockConsents: ConsentRecord[] = [
  {
    id: 'consent-1',
    patientId: 'patient-123',
    treatmentType: 'therapy',
    scope: 'treatment',
    status: 'active',
    grantedAt: '2024-01-15T10:00:00Z',
    expiresAt: '2025-01-15T10:00:00Z',
    withdrawnAt: null,
    withdrawnReason: null,
    performerId: 'Practitioner/dr-smith',
    organizationId: 'Org/hospital-1',
    provenanceId: 'prov-1',
    policyRule: 'opt-in',
    provisions: [
      { type: 'permit', code: ['therapy'] },
    ],
  },
  {
    id: 'consent-2',
    patientId: 'patient-123',
    treatmentType: 'psychiatry',
    scope: 'patient-privacy',
    status: 'withdrawn',
    grantedAt: '2023-06-01T08:00:00Z',
    expiresAt: '2024-06-01T08:00:00Z',
    withdrawnAt: '2024-03-01T12:00:00Z',
    withdrawnReason: 'Patient requested withdrawal',
    performerId: 'Practitioner/dr-jones',
    organizationId: null,
    provenanceId: null,
    policyRule: null,
    provisions: [],
  },
]

const mockProvenance = {
  resourceType: 'Provenance',
  id: 'prov-1',
  target: [{ reference: 'Consent/consent-1' }],
  recorded: '2024-01-15T10:00:00Z',
  agent: [{ who: { reference: 'Practitioner/dr-smith' } }],
  signature: [
    {
      type: [{ system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.1' }],
      when: '2024-01-15T10:00:00Z',
      who: { reference: 'Practitioner/dr-smith' },
      sigFormat: 'application/jose',
      data: 'base64signaturedatahere1234567890',
    },
  ],
}

function mockFetch(overrides?: {
  consents?: ConsentRecord[]
  provenance?: unknown
  consentStatus?: number
}) {
  const consents = overrides?.consents ?? mockConsents
  const provenance = overrides?.provenance ?? mockProvenance
  const consentStatus = overrides?.consentStatus ?? 200

  return vi.fn().mockImplementation((url: string, options?: RequestInit) => {
    const method = options?.method ?? 'GET'
    if (url.includes('/consents?patient=')) {
      return Promise.resolve({
        ok: true,
        status: consentStatus,
        json: () => Promise.resolve(consents),
      })
    }
    if (url.includes('/provenance/')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(provenance),
      })
    }
    if (url.includes('/consents/') && method === 'PATCH') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      })
    }
    if (url.includes('/consents') && method === 'POST') {
      return Promise.resolve({
        ok: true,
        status: 201,
        json: () => Promise.resolve({}),
      })
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    })
  })
}

describe('ConsentManagementModal', () => {
  beforeEach(() => {
    global.fetch = mockFetch()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders nothing when closed', () => {
    render(
      <ConsentManagementModal
        patientId="patient-123"
        open={false}
        onClose={() => {}}
      />,
    )
    expect(screen.queryByText('Consent Management')).not.toBeInTheDocument()
  })

  it('renders modal title when open', async () => {
    render(
      <ConsentManagementModal
        patientId="patient-123"
        open={true}
        onClose={() => {}}
      />,
    )
    expect(screen.getByText('Consent Management')).toBeInTheDocument()
  })

  it('fetches and displays consent records', async () => {
    render(
      <ConsentManagementModal
        patientId="patient-123"
        open={true}
        onClose={() => {}}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('consent-1')).toBeInTheDocument()
      expect(screen.getByText('consent-2')).toBeInTheDocument()
    })
  })

  it('shows loading state while fetching', async () => {
    global.fetch = vi.fn().mockImplementation(
      () =>
        new Promise(() => {
          // Never resolves
        }),
    )

    render(
      <ConsentManagementModal
        patientId="patient-123"
        open={true}
        onClose={() => {}}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Loading consent records...')).toBeInTheDocument()
    })
  })

  it('shows error state on fetch failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Server error' }),
    })

    render(
      <ConsentManagementModal
        patientId="patient-123"
        open={true}
        onClose={() => {}}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch consents/)).toBeInTheDocument()
    })
    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('shows empty state when no consents', async () => {
    global.fetch = mockFetch({ consents: [] })

    render(
      <ConsentManagementModal
        patientId="patient-123"
        open={true}
        onClose={() => {}}
      />,
    )

    await waitFor(() => {
      expect(
        screen.getByText('No consent records found for this patient.'),
      ).toBeInTheDocument()
    })
  })

  it('displays status badges for each consent', async () => {
    render(
      <ConsentManagementModal
        patientId="patient-123"
        open={true}
        onClose={() => {}}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('active')).toBeInTheDocument()
      expect(screen.getByText('withdrawn')).toBeInTheDocument()
    })
  })

  it('expands details when clicking expand button', async () => {
    render(
      <ConsentManagementModal
        patientId="patient-123"
        open={true}
        onClose={() => {}}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('consent-1')).toBeInTheDocument()
    })

    const expandButtons = screen.getAllByLabelText('Expand details')
    fireEvent.click(expandButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Provisions')).toBeInTheDocument()
      expect(screen.getByText('Provenance Chain')).toBeInTheDocument()
    })
  })

  it('shows provenance info when expanded', async () => {
    render(
      <ConsentManagementModal
        patientId="patient-123"
        open={true}
        onClose={() => {}}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('consent-1')).toBeInTheDocument()
    })

    const expandButtons = screen.getAllByLabelText('Expand details')
    fireEvent.click(expandButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Provenance Chain')).toBeInTheDocument()
    })

    await waitFor(
      () => {
        expect(screen.getAllByText('Signed by:').length).toBeGreaterThan(0)
        expect(
          screen.getAllByText('Practitioner/dr-smith').length,
        ).toBeGreaterThan(0)
      },
      { timeout: 5000 },
    )
  }, 15000)

  it('opens withdraw confirmation dialog', async () => {
    render(
      <ConsentManagementModal
        patientId="patient-123"
        open={true}
        onClose={() => {}}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('consent-1')).toBeInTheDocument()
    })

    const withdrawButton = screen.getByLabelText('Withdraw consent consent-1')
    fireEvent.click(withdrawButton)

    await waitFor(() => {
      expect(screen.getByText('Withdraw Consent')).toBeInTheDocument()
      expect(
        screen.getByText(/Are you sure you want to withdraw/),
      ).toBeInTheDocument()
    })
  })

  it('calls PATCH when confirming withdrawal', async () => {
    const onUpdate = vi.fn()
    render(
      <ConsentManagementModal
        patientId="patient-123"
        open={true}
        onClose={() => {}}
        onUpdate={onUpdate}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('consent-1')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByLabelText('Withdraw consent consent-1'))

    await waitFor(() => {
      expect(screen.getByText('Withdraw Consent')).toBeInTheDocument()
    })

    const confirmButton = screen.getByRole('button', { name: 'Withdraw' })
    fireEvent.click(confirmButton)

    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/consents/consent-1'),
          expect.objectContaining({ method: 'PATCH' }),
        )
      },
      { timeout: 5000 },
    )
    await waitFor(
      () => {
        expect(onUpdate).toHaveBeenCalled()
      },
      { timeout: 5000 },
    )
  })

  it('opens renewal form when clicking Renew', async () => {
    render(
      <ConsentManagementModal
        patientId="patient-123"
        open={true}
        onClose={() => {}}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('consent-1')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByLabelText('Renew consent consent-1'))

    await waitFor(() => {
      expect(screen.getByText('Renew Consent')).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /Submit Renewal/ }),
      ).toBeInTheDocument()
    })
  })

  it('validates renewal form — requires start date', async () => {
    render(
      <ConsentManagementModal
        patientId="patient-123"
        open={true}
        onClose={() => {}}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('consent-1')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByLabelText('Renew consent consent-1'))

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Submit Renewal/ }),
      ).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Submit Renewal/ }))

    await waitFor(() => {
      expect(screen.getByText('Start date is required')).toBeInTheDocument()
    })
  })

  it('validates renewal form — end date after start date', async () => {
    render(
      <ConsentManagementModal
        patientId="patient-123"
        open={true}
        onClose={() => {}}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('consent-1')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByLabelText('Renew consent consent-1'))

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Submit Renewal/ }),
      ).toBeInTheDocument()
    })

    const startDateInput = screen.getByLabelText('Start Date *')
    fireEvent.change(startDateInput, { target: { value: '2025-06-01' } })

    const endDateInput = screen.getByLabelText('End Date')
    fireEvent.change(endDateInput, { target: { value: '2025-05-01' } })

    fireEvent.click(screen.getByRole('button', { name: /Submit Renewal/ }))

    await waitFor(() => {
      expect(
        screen.getByText('End date must be after start date'),
      ).toBeInTheDocument()
    })
  })

  it('submits renewal form with valid data', async () => {
    const onUpdate = vi.fn()
    render(
      <ConsentManagementModal
        patientId="patient-123"
        open={true}
        onClose={() => {}}
        onUpdate={onUpdate}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('consent-1')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByLabelText('Renew consent consent-1'))

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Submit Renewal/ }),
      ).toBeInTheDocument()
    })

    const startDateInput = screen.getByLabelText('Start Date *')
    fireEvent.change(startDateInput, { target: { value: '2025-06-01' } })

    fireEvent.click(screen.getByRole('button', { name: /Submit Renewal/ }))

    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/ehr/v1/consents',
          expect.objectContaining({ method: 'POST' }),
        )
      },
      { timeout: 5000 },
    )
    await waitFor(
      () => {
        expect(onUpdate).toHaveBeenCalled()
      },
      { timeout: 5000 },
    )
  })

  it('calls onClose when modal close is triggered', async () => {
    const onClose = vi.fn()
    render(
      <ConsentManagementModal
        patientId="patient-123"
        open={true}
        onClose={onClose}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Consent Management')).toBeInTheDocument()
    })

    // The DialogModal renders a close button
    const closeButtons = screen.getAllByLabelText('Close dialog')
    fireEvent.click(closeButtons[0])

    expect(onClose).toHaveBeenCalled()
  })

  it('refreshes data when Refresh button is clicked', async () => {
    render(
      <ConsentManagementModal
        patientId="patient-123"
        open={true}
        onClose={() => {}}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('consent-1')).toBeInTheDocument()
    })

    const refreshButton = screen.getByLabelText('Refresh consent records')
    fireEvent.click(refreshButton)

    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledTimes(3)
      },
      { timeout: 5000 },
    )
  })
})
