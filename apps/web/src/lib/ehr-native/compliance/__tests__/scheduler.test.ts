/**
 * Tests for scheduler — scheduled report CRUD and execution.
 */

// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock runScheduledReport from report-generator
const { mockRunScheduledReport } = vi.hoisted(() => ({
  mockRunScheduledReport: vi.fn(),
}))
vi.mock('../report-generator', () => ({
  runScheduledReport: mockRunScheduledReport,
}))

// Mock export modules (used by deliverReportByEmail indirectly)
vi.mock('../export/pdf-exporter', () => ({
  exportReportToPDF: vi.fn(),
}))
vi.mock('../export/csv-exporter', () => ({
  exportReportToCSV: vi.fn(),
}))

import {
  createScheduledReport,
  listScheduledReports,
  getScheduledReport,
  updateScheduledReport,
  deleteScheduledReport,
  processScheduledReports,
  triggerScheduledReportNow,
} from '../scheduler'
import type { ReportMetadata } from '../types'

beforeEach(() => {
  vi.clearAllMocks()
  // Clear the in-memory store by deleting all entries
  const all = listScheduledReports()
  for (const c of all) {
    deleteScheduledReport(c.scheduleId)
  }
})

describe('createScheduledReport', () => {
  it('creates a scheduled report with defaults', () => {
    const config = createScheduledReport(
      'hipaa_audit',
      'monthly',
      'tenant-001',
      ['admin@example.com'],
    )
    expect(config.scheduleId).toContain('sch-hipaa_audit-')
    expect(config.type).toBe('hipaa_audit')
    expect(config.schedule).toBe('monthly')
    expect(config.tenantId).toBe('tenant-001')
    expect(config.emailRecipients).toEqual(['admin@example.com'])
    expect(config.format).toBe('pdf')
    expect(config.dayOfMonth).toBe(1)
    expect(config.active).toBe(true)
  })

  it('creates with custom format and dayOfMonth', () => {
    const config = createScheduledReport(
      'soc2_security',
      'quarterly',
      'tenant-001',
      ['admin@example.com'],
      'csv',
      15,
    )
    expect(config.format).toBe('csv')
    expect(config.dayOfMonth).toBe(15)
  })
})

describe('listScheduledReports', () => {
  it('lists all scheduled reports', () => {
    createScheduledReport('hipaa_audit', 'monthly', 'tenant-001', ['a@x.com'])
    createScheduledReport('soc2_security', 'quarterly', 'tenant-002', [
      'b@x.com',
    ])
    const all = listScheduledReports()
    expect(all).toHaveLength(2)
  })

  it('filters by tenantId', () => {
    createScheduledReport('hipaa_audit', 'monthly', 'tenant-001', ['a@x.com'])
    createScheduledReport('soc2_security', 'quarterly', 'tenant-002', [
      'b@x.com',
    ])
    const filtered = listScheduledReports('tenant-001')
    expect(filtered).toHaveLength(1)
    expect(filtered[0].tenantId).toBe('tenant-001')
  })
})

describe('getScheduledReport', () => {
  it('returns config by ID', () => {
    const created = createScheduledReport('hipaa_audit', 'monthly', 't1', [
      'a@x.com',
    ])
    const found = getScheduledReport(created.scheduleId)
    expect(found).toBeDefined()
    expect(found?.type).toBe('hipaa_audit')
  })

  it('returns undefined for unknown ID', () => {
    expect(getScheduledReport('nonexistent')).toBeUndefined()
  })
})

describe('updateScheduledReport', () => {
  it('updates schedule and active status', () => {
    const created = createScheduledReport('hipaa_audit', 'monthly', 't1', [
      'a@x.com',
    ])
    const updated = updateScheduledReport(created.scheduleId, {
      active: false,
      schedule: 'quarterly',
    })
    expect(updated).toBeDefined()
    expect(updated?.active).toBe(false)
    expect(updated?.schedule).toBe('quarterly')
  })

  it('returns undefined for unknown ID', () => {
    expect(
      updateScheduledReport('nonexistent', { active: false }),
    ).toBeUndefined()
  })
})

describe('deleteScheduledReport', () => {
  it('deletes existing config', () => {
    const created = createScheduledReport('hipaa_audit', 'monthly', 't1', [
      'a@x.com',
    ])
    expect(deleteScheduledReport(created.scheduleId)).toBe(true)
    expect(getScheduledReport(created.scheduleId)).toBeUndefined()
  })

  it('returns false for unknown ID', () => {
    expect(deleteScheduledReport('nonexistent')).toBe(false)
  })
})

describe('processScheduledReports', () => {
  it('processes due reports', async () => {
    const config = createScheduledReport('hipaa_audit', 'monthly', 't1', [
      'a@x.com',
    ])
    // Make it due by setting dayOfMonth to today
    updateScheduledReport(config.scheduleId, {
      dayOfMonth: new Date().getDate(),
    })

    const mockMeta: ReportMetadata = {
      reportId: 'rpt-1',
      type: 'hipaa_audit',
      status: 'completed',
      format: 'pdf',
      period: { startDate: '2025-01-01', endDate: '2025-02-01' },
      tenantId: 't1',
      generatedBy: 'system-scheduler',
      generatedAt: new Date().toISOString(),
    }
    mockRunScheduledReport.mockResolvedValue(mockMeta)

    const results = await processScheduledReports(new Date())
    expect(results).toHaveLength(1)
    expect(results[0].reportId).toBe('rpt-1')
  })

  it('skips inactive schedules', async () => {
    const config = createScheduledReport('hipaa_audit', 'monthly', 't1', [
      'a@x.com',
    ])
    updateScheduledReport(config.scheduleId, {
      active: false,
      dayOfMonth: new Date().getDate(),
    })

    const results = await processScheduledReports(new Date())
    expect(results).toHaveLength(0)
    expect(mockRunScheduledReport).not.toHaveBeenCalled()
  })

  it('skips non-due schedules', async () => {
    createScheduledReport('hipaa_audit', 'monthly', 't1', ['a@x.com'])
    // dayOfMonth defaults to 1; if today isn't the 1st, it won't be due
    const today = new Date()
    if (today.getDate() === 1) {
      // If today IS the 1st, set to a different day
      const all = listScheduledReports()
      updateScheduledReport(all[0].scheduleId, { dayOfMonth: 15 })
    }

    const results = await processScheduledReports(new Date())
    if (today.getDate() !== 15) {
      expect(results).toHaveLength(0)
    }
  })
})

describe('triggerScheduledReportNow', () => {
  it('triggers report generation immediately', async () => {
    const config = createScheduledReport('hipaa_audit', 'monthly', 't1', [
      'a@x.com',
    ])

    const mockMeta: ReportMetadata = {
      reportId: 'rpt-adhoc',
      type: 'hipaa_audit',
      status: 'completed',
      format: 'pdf',
      period: { startDate: '2025-01-01', endDate: '2025-02-01' },
      tenantId: 't1',
      generatedBy: 'system-scheduler',
      generatedAt: new Date().toISOString(),
    }
    mockRunScheduledReport.mockResolvedValue(mockMeta)

    const result = await triggerScheduledReportNow(config.scheduleId)
    expect(result.reportId).toBe('rpt-adhoc')
    expect(mockRunScheduledReport).toHaveBeenCalledOnce()
  })

  it('throws for unknown schedule ID', async () => {
    await expect(triggerScheduledReportNow('nonexistent')).rejects.toThrow(
      'Scheduled report not found',
    )
  })
})
