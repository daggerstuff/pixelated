// Vitest is imported via globals
import { screen, fireEvent, waitFor } from '@testing-library/dom'
import { renderAstro } from '@/test/utils/astro'
import SecurityDashboard from '../SecurityDashboard.astro'

describe('SecurityDashboard', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders initial security events and stats', async () => {
    const { container } = await renderAstro(SecurityDashboard)

    // Check stats are rendered
    expect(screen.getByText('Total Events')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()

    expect(screen.getByText('Last 24h')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()

    expect(screen.getByText('Last 7 Days')).toBeInTheDocument()
    expect(screen.getByText('23')).toBeInTheDocument()

    // Check severity counts
    expect(screen.getByText('Critical')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()

    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()

    expect(screen.getByText('Medium')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()

    expect(screen.getByText('Low')).toBeInTheDocument()
    expect(screen.getByText('23')).toBeInTheDocument()

    // Check events table
    expect(container.querySelector('table')).toBeInTheDocument()
    expect(screen.getByText('Failed login attempt')).toBeInTheDocument()
    expect(screen.getByText('Unauthorized access attempt')).toBeInTheDocument()
  })

  it('filters events by type', async () => {
    const { container } = await renderAstro(SecurityDashboard)

    const eventTypeSelect = screen.getByRole('combobox', { name: '' }) as HTMLSelectElement
    expect(eventTypeSelect).toBeInTheDocument()

    // Select 'login' type
    fireEvent.change(eventTypeSelect, { target: { value: 'login' } })

    await waitFor(() => {
      const tableBody = container.querySelector('#eventsTable')
      expect(tableBody).not.toBeNull()
      expect(tableBody!.textContent).toContain('Failed login attempt')
      expect(tableBody!.textContent).not.toContain('Unauthorized access attempt')
    })
  })

  it('filters events by severity', async () => {
    const { container } = await renderAstro(SecurityDashboard)

    const severitySelect = screen.getAllByRole('combobox', { name: '' })[1] as HTMLSelectElement
    expect(severitySelect).toBeInTheDocument()

    // Select 'high' severity
    fireEvent.change(severitySelect, { target: { value: 'high' } })

    await waitFor(() => {
      const tableBody = container.querySelector('#eventsTable')
      expect(tableBody).not.toBeNull()
      expect(tableBody!.textContent).not.toContain('Failed login attempt')
      expect(tableBody!.textContent).toContain('Unauthorized access attempt')
    })
  })

  it('handles page interactions', async () => {
    await renderAstro(SecurityDashboard)
    const selects = screen.getAllByRole('combobox')
    expect(selects).toHaveLength(2) // Type and severity selects
  })
})
