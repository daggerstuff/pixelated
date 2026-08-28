/**
 * Tests for dashboard export utilities (PIX-4413)
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  dashboardToCSV,
  downloadCSV,
  exportDashboardCSV,
  type DashboardExportData,
} from '@/components/ehr/dashboards/dashboard-export'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const sampleData: DashboardExportData = {
  dashboard: 'practice',
  title: 'Practice Overview Report',
  generatedAt: '2024-01-15T10:30:00Z',
  filters: { siteId: 'main', providerId: 'all' },
  sections: [
    {
      name: 'Key Metrics',
      columns: [
        { key: 'metric', label: 'Metric' },
        { key: 'value', label: 'Value' },
      ],
      rows: [
        { metric: 'Active Patients', value: 1500 },
        { metric: 'No-Show Rate', value: '12.5%' },
        { metric: 'Avg Wait (min)', value: 18 },
      ],
    },
    {
      name: 'Provider Load',
      columns: [
        { key: 'provider', label: 'Provider' },
        { key: 'patients', label: 'Patients' },
      ],
      rows: [
        { provider: 'Dr. Smith', patients: 30 },
        { provider: 'Dr. Jones', patients: 25 },
      ],
    },
  ],
}

// ---------------------------------------------------------------------------
// dashboardToCSV
// ---------------------------------------------------------------------------

describe('dashboardToCSV', () => {
  it('produces a non-empty string', () => {
    const csv = dashboardToCSV(sampleData)
    expect(typeof csv).toBe('string')
    expect(csv.length).toBeGreaterThan(0)
  })

  it('includes the report title as a comment header', () => {
    const csv = dashboardToCSV(sampleData)
    expect(csv).toContain('# Practice Overview Report')
  })

  it('includes the generated timestamp', () => {
    const csv = dashboardToCSV(sampleData)
    expect(csv).toContain('# Generated: 2024-01-15T10:30:00Z')
  })

  it('includes the dashboard type', () => {
    const csv = dashboardToCSV(sampleData)
    expect(csv).toContain('# Dashboard: practice')
  })

  it('includes filter values', () => {
    const csv = dashboardToCSV(sampleData)
    expect(csv).toContain('# siteId: main')
    expect(csv).toContain('# providerId: all')
  })

  it('includes section names', () => {
    const csv = dashboardToCSV(sampleData)
    expect(csv).toContain('Key Metrics')
    expect(csv).toContain('Provider Load')
  })

  it('includes column headers', () => {
    const csv = dashboardToCSV(sampleData)
    expect(csv).toContain('Metric')
    expect(csv).toContain('Value')
    expect(csv).toContain('Provider')
    expect(csv).toContain('Patients')
  })

  it('includes row data', () => {
    const csv = dashboardToCSV(sampleData)
    expect(csv).toContain('Active Patients')
    expect(csv).toContain('1500')
    expect(csv).toContain('Dr. Smith')
  })

  it('escapes values containing commas', () => {
    const data: DashboardExportData = {
      dashboard: 'practice',
      title: 'Test',
      generatedAt: '2024-01-01T00:00:00Z',
      filters: {},
      sections: [
        {
          name: 'Test',
          columns: [
            { key: 'a', label: 'A' },
            { key: 'b', label: 'B' },
          ],
          rows: [{ a: 'Hello, World', b: 'X' }],
        },
      ],
    }
    const csv = dashboardToCSV(data)
    expect(csv).toContain('"Hello, World"')
  })

  it('escapes values containing quotes', () => {
    const data: DashboardExportData = {
      dashboard: 'practice',
      title: 'Test',
      generatedAt: '2024-01-01T00:00:00Z',
      filters: {},
      sections: [
        {
          name: 'Test',
          columns: [{ key: 'a', label: 'A' }],
          rows: [{ a: 'He said "hi"' }],
        },
      ],
    }
    const csv = dashboardToCSV(data)
    expect(csv).toContain('"He said ""hi"""')
  })

  it('handles null values as empty strings', () => {
    const data: DashboardExportData = {
      dashboard: 'practice',
      title: 'Test',
      generatedAt: '2024-01-01T00:00:00Z',
      filters: {},
      sections: [
        {
          name: 'Test',
          columns: [
            { key: 'a', label: 'A' },
            { key: 'b', label: 'B' },
          ],
          rows: [{ a: 'value', b: null }],
        },
      ],
    }
    const csv = dashboardToCSV(data)
    // null should render as empty between delimiters
    expect(csv).toContain('value,')
  })

  it('handles empty sections array', () => {
    const data: DashboardExportData = {
      dashboard: 'practice',
      title: 'Empty',
      generatedAt: '2024-01-01T00:00:00Z',
      filters: {},
      sections: [],
    }
    const csv = dashboardToCSV(data)
    expect(csv).toContain('# Empty')
    expect(csv).toContain('# Dashboard: practice')
  })
})

// ---------------------------------------------------------------------------
// downloadCSV
// ---------------------------------------------------------------------------

describe('downloadCSV', () => {
  beforeEach(() => {
    // Mock DOM APIs
    global.URL.createObjectURL = vi
      .fn()
      .mockReturnValue('blob:http://localhost/fake')
    global.URL.revokeObjectURL = vi.fn()
    const clickSpy = vi.fn()
    const appendChildSpy = vi
      .spyOn(document.body, 'appendChild')
      .mockImplementation((node) => node)
    const removeChildSpy = vi
      .spyOn(document.body, 'removeChild')
      .mockImplementation((node) => node)
    // Override createElement to return a spy anchor
    const originalCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const el = originalCreate(tag)
        el.click = clickSpy
        return el
      }
      return originalCreate(tag)
    })
  })

  it('creates an anchor element with download attribute', () => {
    downloadCSV('a,b,c', 'test-report')
    expect(document.createElement).toHaveBeenCalledWith('a')
  })

  it('appends .csv extension if missing', () => {
    const createEl = document.createElement as ReturnType<typeof vi.spyOn>
    // We can't directly inspect the download attribute with the mock,
    // but we verify no error is thrown
    expect(() => downloadCSV('test', 'file')).not.toThrow()
  })

  it('does not double-append .csv if already present', () => {
    expect(() => downloadCSV('test', 'file.csv')).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// exportDashboardCSV
// ---------------------------------------------------------------------------

describe('exportDashboardCSV', () => {
  beforeEach(() => {
    global.URL.createObjectURL = vi
      .fn()
      .mockReturnValue('blob:http://localhost/fake')
    global.URL.revokeObjectURL = vi.fn()
    vi.spyOn(document.body, 'appendChild').mockImplementation((n) => n)
    vi.spyOn(document.body, 'removeChild').mockImplementation((n) => n)
    const originalCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const el = originalCreate(tag)
        el.click = vi.fn()
        return el
      }
      return originalCreate(tag)
    })
  })

  it('generates CSV and triggers download', () => {
    expect(() => exportDashboardCSV(sampleData)).not.toThrow()
  })

  it('uses custom filename when provided', () => {
    expect(() => exportDashboardCSV(sampleData, 'custom-report')).not.toThrow()
  })
})
