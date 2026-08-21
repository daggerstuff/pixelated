import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AuditEntry } from '../AuditLogViewer'
import { AuditLogViewer } from '../AuditLogViewer'

function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: `entry-${Math.random().toString(36).slice(2)}`,
    timestamp: '2024-01-15T10:00:00Z',
    userId: 'user-1',
    action: 'read',
    resourceType: 'Patient',
    resourceId: 'patient-1',
    patientId: 'patient-1',
    outcome: 'success',
    details: 'Accessed patient record',
    ...overrides,
  }
}

const OUTCOMES: AuditEntry['outcome'][] = ['success', 'denied', 'error']
const ACTIONS: string[] = ['read', 'write', 'delete']
const RESOURCE_TYPES: string[] = ['Patient', 'Consent', 'Observation']

const mockEntries: AuditEntry[] = Array.from({ length: 55 }, (_, i) =>
  makeEntry({
    id: `entry-${i}`,
    timestamp: `2024-01-${String((i % 28) + 1).padStart(2, '0')}T10:00:00Z`,
    userId: `user-${i % 3}`,
    action: ACTIONS[i % 3] ?? 'read',
    resourceType: RESOURCE_TYPES[i % 3] ?? 'Patient',
    resourceId: `resource-${i}`,
    patientId: `patient-${i % 5}`,
    outcome: OUTCOMES[i % 3] ?? 'success',
    details: `Audit entry ${i} details`,
  }),
)

function mockFetch(entries: AuditEntry[] = mockEntries) {
  return vi.fn().mockImplementation((url: string) => {
    if (url.includes('/audit-logs')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(entries),
      })
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    })
  })
}

describe('AuditLogViewer', () => {
  beforeEach(() => {
    global.fetch = mockFetch()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the viewer with title', async () => {
    render(<AuditLogViewer />)
    expect(screen.getByText('Audit Log Viewer')).toBeInTheDocument()
  })

  it('fetches and displays audit entries', async () => {
    render(<AuditLogViewer />)

    // Default sort is timestamp descending, so entry-27 (highest day 28) is on page 1
    expect(await screen.findByText('resource-27', {}, { timeout: 5000 })).toBeInTheDocument()
  })

  it('shows loading state while fetching', async () => {
    global.fetch = vi.fn().mockImplementation(
      () =>
        new Promise(() => {
          // Never resolves
        }),
    )

    render(<AuditLogViewer />)

    await waitFor(() => {
      expect(screen.getByText('Loading audit entries...')).toBeInTheDocument()
    })
  })

  it('shows error state on fetch failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Server error' }),
    })

    render(<AuditLogViewer />)

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch audit logs/)).toBeInTheDocument()
    })
    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('shows empty state when no entries', async () => {
    global.fetch = mockFetch([])

    render(<AuditLogViewer />)

    await waitFor(() => {
      expect(screen.getByText('No audit entries found')).toBeInTheDocument()
    })
  })

  it('paginates at 50 rows per page', async () => {
    render(<AuditLogViewer />)

    await waitFor(() => {
      expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument()
    })
    expect(screen.getByText(/Showing 1-50 of 55/)).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Next page'))

    await waitFor(() => {
      expect(screen.getByText(/Page 2 of 2/)).toBeInTheDocument()
    })
    expect(screen.getByText(/Showing 51-55 of 55/)).toBeInTheDocument()
  })

  it('disables Previous button on first page', async () => {
    render(<AuditLogViewer />)

    await waitFor(() => {
      expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument()
    })

    expect(screen.getByLabelText('Previous page')).toBeDisabled()
  })

  it('disables Next button on last page', async () => {
    render(<AuditLogViewer />)

    await waitFor(() => {
      expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByLabelText('Next page'))

    await waitFor(() => {
      expect(screen.getByLabelText('Next page')).toBeDisabled()
    })
  })

  it('filters by user text input', async () => {
    render(<AuditLogViewer />)

    await waitFor(() => {
      expect(screen.getByText(/Showing 1-50 of 55/)).toBeInTheDocument()
    })

    const userFilter = screen.getByLabelText('Filter by user')
    fireEvent.change(userFilter, { target: { value: 'user-0' } })

    await waitFor(() => {
      // user-0 appears in entries 0, 3, 6, ... (every 3rd)
      expect(screen.getByText(/of 19/)).toBeInTheDocument()
    })
  })

  it('filters by action type', async () => {
    render(<AuditLogViewer />)

    await waitFor(() => {
      expect(screen.getByText(/Showing 1-50 of 55/)).toBeInTheDocument()
    })

    const actionFilter = screen.getByLabelText('Filter by action type')
    fireEvent.change(actionFilter, { target: { value: 'delete' } })

    await waitFor(() => {
      // delete appears in entries 2, 5, 8, ... (every 3rd starting at 2)
      expect(screen.getByText(/of 18/)).toBeInTheDocument()
    })
  })

  it('filters by outcome', async () => {
    render(<AuditLogViewer />)

    await waitFor(() => {
      expect(screen.getByText(/Showing 1-50 of 55/)).toBeInTheDocument()
    })

    const outcomeFilter = screen.getByLabelText('Filter by outcome')
    fireEvent.change(outcomeFilter, { target: { value: 'denied' } })

    await waitFor(() => {
      // denied appears in entries 1, 4, 7, ... (every 3rd starting at 1)
      expect(screen.getByText(/of 18/)).toBeInTheDocument()
    })
  })

  it('filters by resource type', async () => {
    render(<AuditLogViewer />)

    await waitFor(() => {
      expect(screen.getByText(/Showing 1-50 of 55/)).toBeInTheDocument()
    })

    const resourceFilter = screen.getByLabelText('Filter by resource type')
    fireEvent.change(resourceFilter, { target: { value: 'Consent' } })

    await waitFor(() => {
      // Consent appears in entries 1, 4, 7, ... (every 3rd starting at 1)
      expect(screen.getByText(/of 18/)).toBeInTheDocument()
    })
  })

  it('filters by search in details', async () => {
    render(<AuditLogViewer />)

    await waitFor(() => {
      expect(screen.getByText(/Showing 1-50 of 55/)).toBeInTheDocument()
    })

    const searchInput = screen.getByLabelText('Search audit entry details')
    fireEvent.change(searchInput, { target: { value: 'entry 10' } })

    await waitFor(() => {
      expect(screen.getByText(/Showing 1-1 of 1/)).toBeInTheDocument()
    })
  })

  it('clears all filters when Clear Filters is clicked', async () => {
    render(<AuditLogViewer />)

    await waitFor(() => {
      expect(screen.getByText(/Showing 1-50 of 55/)).toBeInTheDocument()
    })

    const actionFilter = screen.getByLabelText('Filter by action type')
    fireEvent.change(actionFilter, { target: { value: 'delete' } })

    await waitFor(() => {
      expect(screen.getByText(/of 18/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByLabelText('Clear all filters'))

    await waitFor(() => {
      expect(screen.getByText(/Showing 1-50 of 55/)).toBeInTheDocument()
    })
  })

  it('sorts by column when clicking header', async () => {
    render(<AuditLogViewer />)

    await waitFor(() => {
      expect(screen.getByText(/Showing 1-50 of 55/)).toBeInTheDocument()
    })

    // The table header "User" has aria-sort; the filter label "User" does not
    const userHeaders = screen
      .getAllByText('User')
      .filter((el) => el.tagName === 'TH')
    expect(userHeaders.length).toBe(1)
    fireEvent.click(userHeaders[0])

    expect(userHeaders[0]).toHaveAttribute('aria-sort', 'ascending')

    fireEvent.click(userHeaders[0])
    expect(userHeaders[0]).toHaveAttribute('aria-sort', 'descending')
  })

  it('expands row to show full details', async () => {
    render(<AuditLogViewer />)

    await waitFor(() => {
      expect(screen.getByText(/Showing 1-50 of 55/)).toBeInTheDocument()
    })

    const expandButtons = screen.getAllByLabelText('Expand entry details')
    fireEvent.click(expandButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Full Details:')).toBeInTheDocument()
      expect(screen.getByText('Entry ID:')).toBeInTheDocument()
    })
  })

  it('exports CSV when Export button is clicked', async () => {
    const createObjectURL = vi.fn()
    const revokeObjectURL = vi.fn()
    global.URL.createObjectURL = createObjectURL
    global.URL.revokeObjectURL = revokeObjectURL

    const clickSpy = vi.fn()
    const originalCreateElement = document.createElement.bind(document)
    const originalAppendChild = document.body.appendChild.bind(document.body)
    const originalRemoveChild = document.body.removeChild.bind(document.body)

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const el = originalCreateElement(tag) as HTMLElement & {
          click: () => void
        }
        el.click = clickSpy
        return el
      }
      return originalCreateElement(tag)
    })
    vi.spyOn(document.body, 'appendChild').mockImplementation(originalAppendChild)
    vi.spyOn(document.body, 'removeChild').mockImplementation(originalRemoveChild)

    render(<AuditLogViewer />)

    await waitFor(() => {
      expect(screen.getByText(/Showing 1-50 of 55/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByLabelText('Export filtered results as CSV'))

    expect(createObjectURL).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
  })

  it('passes patientId to fetch URL', async () => {
    render(<AuditLogViewer patientId="patient-42" />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('patient=patient-42'),
      )
    })
  })

  it('shows patient filter text when patientId is provided', async () => {
    render(<AuditLogViewer patientId="patient-42" />)

    expect(
      screen.getByText('Filtered for patient patient-42'),
    ).toBeInTheDocument()
  })

  it('shows all entries text when no patientId', async () => {
    render(<AuditLogViewer />)

    expect(
      screen.getByText('Showing all audit entries'),
    ).toBeInTheDocument()
  })

  it('retries fetch when Retry button is clicked', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Server error' }),
    })

    render(<AuditLogViewer />)

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })

    // Fix fetch to succeed
    global.fetch = mockFetch()

    fireEvent.click(screen.getByText('Retry'))

    await waitFor(() => {
      expect(screen.getByText(/Showing 1-50 of 55/)).toBeInTheDocument()
    })
  })
})
