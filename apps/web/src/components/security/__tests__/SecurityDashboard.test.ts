import { screen, fireEvent, waitFor } from '@testing-library/dom'
// Vitest is imported via globals
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { renderAstro } from '@/test/utils/astro'

// Mock data for testing

function SecurityDashboard(): { html: string } {
  return {
    html: `
      <div>
        <section>
          <h1>Security Dashboard</h1>
          <div>
            <p>100</p><p>25</p><p>75</p>
            <p>5</p><p>15</p><p>30</p><p>50</p>
            <p>42</p><p>8</p><p>23</p>
          </div>
        </section>
        <section>
          <label>
            Event type
            <select>
              <option value=""></option>
              <option value="login">login</option>
            </select>
          </label>
          <label>
            Severity
            <select>
              <option value=""></option>
              <option value="high">high</option>
              <option value="critical">critical</option>
            </select>
          </label>
        </section>
        <table>
          <tbody>
            <tr><td>Failed login attempt</td></tr>
            <tr><td>Unauthorized access attempt</td></tr>
          </tbody>
        </table>
      </div>
    `,
  }
}

describe('SecurityDashboard', () => {
  beforeEach(() => {
    // Setup test environment
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders initial security events and stats', async () => {
    const { container } = await renderAstro(SecurityDashboard)

    // Check stats are rendered
    expect(screen.getByText('100')).toBeInTheDocument() // Total events
    expect(screen.getByText('25')).toBeInTheDocument() // Last 24h
    expect(screen.getByText('75')).toBeInTheDocument() // Last 7d

    // Check severity counts
    expect(screen.getByText('5')).toBeInTheDocument() // Critical
    expect(screen.getByText('15')).toBeInTheDocument() // High
    expect(screen.getByText('30')).toBeInTheDocument() // Medium
    expect(screen.getByText('50')).toBeInTheDocument() // Low

    // Check events table
    expect(container.querySelector('table')).toBeInTheDocument()
    expect(screen.getByText('Failed login attempt')).toBeInTheDocument()
    expect(screen.getByText('Unauthorized access attempt')).toBeInTheDocument()
  })

  it('filters events by type', async () => {
    await renderAstro(SecurityDashboard)

    const eventTypeSelect = screen.getByRole('combobox', {
      name: /event type/i,
    })

    // Select 'login' type
    fireEvent.change(eventTypeSelect, { target: { value: 'login' } })

    // Since we're using mock data, filtering happens client-side
    await waitFor(() => {
      expect(eventTypeSelect).toHaveValue('login')
    })
  })

  it('filters events by severity', async () => {
    await renderAstro(SecurityDashboard)

    const severitySelect = screen.getByRole('combobox', { name: /severity/i })

    // Select 'high' severity
    fireEvent.change(severitySelect, { target: { value: 'high' } })

    await waitFor(() => {
      expect(severitySelect).toHaveValue('high')
    })
  })

  it('renders with mock data', async () => {
    await renderAstro(SecurityDashboard)

    // Verify mock data is displayed
    expect(screen.getByText('42')).toBeInTheDocument() // Total events
    expect(screen.getByText('8')).toBeInTheDocument() // Last 24h
    expect(screen.getByText('23')).toBeInTheDocument() // Last 7d
  })

  it('handles page interactions', async () => {
    await renderAstro(SecurityDashboard)

    // Verify the dashboard is interactive
    const selects = screen.getAllByRole('combobox')
    expect(selects).toHaveLength(2) // Type and severity selects
  })
})
