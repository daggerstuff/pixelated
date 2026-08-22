/**
 * Tests for compliance report generator.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

import { generateAllReports, generateReport, getTemplate, listTemplates, type ReportInputData } from '../generator'
import { exportCsv, exportJson, exportReport } from '../csv-export'
import { REPORT_TEMPLATES } from '../templates'
import type {
  ComplianceReport,
  ExportFormat,
  ReportGenerationParams,
  ReportType,
} from '../types'

// Mock the logger
vi.mock('../../../utils/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

// Mock verifyEhrAuditChain to avoid importing the full audit bridge
vi.mock('../../ehr-audit-bridge', () => ({
  verifyEhrAuditChain: vi.fn((events: Array<{ id: string; hash?: string; previousHash?: string }>) => {
    // Simulate chain verification: valid if all events have hash and previousHash
    for (let i = 0; i < events.length; i++) {
      if (!events[i].hash) return { valid: false, brokenAtIndex: i, brokenAtId: events[i].id, reason: 'missing hash' }
      if (i > 0 && events[i].previousHash !== events[i - 1].hash) {
        return { valid: false, brokenAtIndex: i, brokenAtId: events[i].id, reason: 'previousHash mismatch' }
      }
    }
    return { valid: true }
  }),
}))

const baseParams: Omit<ReportGenerationParams, 'type'> = {
  periodStart: '2025-01-01T00:00:00Z',
  periodEnd: '2025-06-30T23:59:59Z',
  generatedBy: 'admin@pixelated.test',
  organization: 'Pixelated Empathy',
  tenantId: 'tenant-001',
}

// --- Template tests ---

describe('Report templates', () => {
  it('lists all 5 report templates', () => {
    const templates = listTemplates()
    expect(templates).toHaveLength(5)
    expect(templates.map((t) => t.type)).toEqual([
      'hipaa-audit',
      'soc2-security',
      'soc2-availability',
      'consent-compliance',
      'access-review',
    ])
  })

  it('each template has required fields', () => {
    for (const template of listTemplates()) {
      expect(template.type).toBeDefined()
      expect(template.title).toBeDefined()
      expect(template.description).toBeDefined()
      expect(template.framework).toBeDefined()
      expect(template.controlIds).toBeInstanceOf(Array)
      expect(template.controlIds.length).toBeGreaterThan(0)
      expect(typeof template.generateFindings).toBe('function')
    }
  })

  it('getTemplate returns correct template', () => {
    const t = getTemplate('hipaa-audit')
    expect(t.type).toBe('hipaa-audit')
    expect(t.title).toBe('HIPAA Audit Report')
    expect(t.framework).toBe('HIPAA')
  })

  it('getTemplate throws for unknown type', () => {
    expect(() => getTemplate('unknown' as ReportType)).toThrow('Unknown report type')
  })

  it('REPORT_TEMPLATES has all 5 keys', () => {
    const keys = Object.keys(REPORT_TEMPLATES)
    expect(keys).toHaveLength(5)
    expect(keys).toContain('hipaa-audit')
    expect(keys).toContain('soc2-security')
    expect(keys).toContain('soc2-availability')
    expect(keys).toContain('consent-compliance')
    expect(keys).toContain('access-review')
  })
})

// --- HIPAA Audit report tests ---

describe('HIPAA Audit report generation', () => {
  it('generates a report with no audit events', async () => {
    const report = await generateReport({ ...baseParams, type: 'hipaa-audit' })

    expect(report.type).toBe('hipaa-audit')
    expect(report.title).toBe('HIPAA Audit Report')
    expect(report.id).toBeDefined()
    expect(report.generatedAt).toBeDefined()
    expect(report.summary.totalFindings).toBe(4)
    expect(report.summary.passed).toBeGreaterThan(0)
    expect(report.data).toHaveProperty('totalPhiAccessEvents')
  })

  it('processes audit events correctly', async () => {
    const events = [
      { id: 'e1', action: 'read', status: 'success', userId: 'user1', resourceType: 'Patient', hash: 'h1', previousHash: 'genesis' },
      { id: 'e2', action: 'create', status: 'success', userId: 'user2', resourceType: 'Observation', hash: 'h2', previousHash: 'h1' },
      { id: 'e3', action: 'break-glass', status: 'success', userId: 'user1', resourceType: 'Patient', hash: 'h3', previousHash: 'h2', metadata: { breakGlassReason: 'Emergency' }, ipAddress: '10.0.0.1' },
      { id: 'e4', action: 'read', status: 'failure', userId: 'user3', resourceType: 'Patient', hash: 'h4', previousHash: 'h3', errorMessage: 'Access denied' },
    ]

    const report = await generateReport(
      { ...baseParams, type: 'hipaa-audit' },
      { auditEvents: events },
    )

    const data = report.data as { totalPhiAccessEvents: number; eventsByAction: Record<string, number>; breakGlassEvents: unknown[]; failedAttempts: unknown[]; uniqueUsers: number }
    expect(data.totalPhiAccessEvents).toBe(4)
    expect(data.eventsByAction['read']).toBe(2)
    expect(data.eventsByAction['create']).toBe(1)
    expect(data.eventsByAction['break-glass']).toBe(1)
    expect(data.breakGlassEvents).toHaveLength(1)
    expect(data.failedAttempts).toHaveLength(1)
    expect(data.uniqueUsers).toBe(3)
  })

  it('includes chain verification result', async () => {
    const events = [
      { id: 'e1', action: 'read', status: 'success', userId: 'u1', hash: 'h1', previousHash: 'genesis' },
      { id: 'e2', action: 'read', status: 'success', userId: 'u1', hash: 'h2', previousHash: 'h1' },
    ]

    const report = await generateReport(
      { ...baseParams, type: 'hipaa-audit' },
      { auditEvents: events },
    )

    expect(report.chainVerification).toBeDefined()
    expect(report.chainVerification!.valid).toBe(true)
    expect(report.chainVerification!.totalEvents).toBe(2)
  })

  it('detects broken chain', async () => {
    const events = [
      { id: 'e1', action: 'read', status: 'success', userId: 'u1', hash: 'h1', previousHash: 'genesis' },
      { id: 'e2', action: 'read', status: 'success', userId: 'u1', hash: 'WRONG', previousHash: 'wrongprev' },
    ]

    const report = await generateReport(
      { ...baseParams, type: 'hipaa-audit' },
      { auditEvents: events },
    )

    expect(report.chainVerification).toBeDefined()
    expect(report.chainVerification!.valid).toBe(false)
    expect(report.chainVerification!.brokenAtIndex).toBe(1)
  })

  it('generates break-glass findings', async () => {
    const events = [
      { id: 'e1', action: 'break-glass', status: 'success', userId: 'u1', resourceType: 'Patient', hash: 'h1', previousHash: 'genesis', metadata: { breakGlassReason: 'Emergency access' }, ipAddress: '10.0.0.1' },
    ]

    const report = await generateReport(
      { ...baseParams, type: 'hipaa-audit' },
      { auditEvents: events },
    )

    const bgFinding = report.findings.find((f) => f.id === 'HIPAA-003')
    expect(bgFinding).toBeDefined()
    expect(bgFinding!.status).toBe('warning')
    expect(bgFinding!.severity).toBe('high')
    expect(bgFinding!.evidence).toContain('User u1: Emergency access (IP: 10.0.0.1)')
  })

  it('tracks top users by event count', async () => {
    const events = [
      { id: 'e1', action: 'read', status: 'success', userId: 'userA', hash: 'h1', previousHash: 'genesis' },
      { id: 'e2', action: 'read', status: 'success', userId: 'userA', hash: 'h2', previousHash: 'h1' },
      { id: 'e3', action: 'read', status: 'success', userId: 'userA', hash: 'h3', previousHash: 'h2' },
      { id: 'e4', action: 'read', status: 'success', userId: 'userB', hash: 'h4', previousHash: 'h3' },
    ]

    const report = await generateReport(
      { ...baseParams, type: 'hipaa-audit' },
      { auditEvents: events },
    )

    const data = report.data as { topUsers: Array<{ userId: string; eventCount: number }> }
    expect(data.topUsers[0].userId).toBe('userA')
    expect(data.topUsers[0].eventCount).toBe(3)
  })
})

// --- SOC 2 Security report tests ---

describe('SOC 2 Security report generation', () => {
  it('generates report with default data', async () => {
    const report = await generateReport({ ...baseParams, type: 'soc2-security' })

    expect(report.type).toBe('soc2-security')
    expect(report.title).toBe('SOC 2 Security Report')
    expect(report.summary.totalFindings).toBe(4)
    expect(report.data).toHaveProperty('encryptionStatus')
  })

  it('flags encryption failure', async () => {
    const report = await generateReport(
      { ...baseParams, type: 'soc2-security' },
      {
        soc2Security: {
          encryptionStatus: { atRest: false, inTransit: true, algorithm: 'AES-256', keyRotationDays: 90 },
        },
      },
    )

    const encFinding = report.findings.find((f) => f.id === 'SOC2-SEC-002')
    expect(encFinding!.status).toBe('fail')
    expect(encFinding!.severity).toBe('critical')
    expect(encFinding!.remediation).toContain('Enable encryption')
  })

  it('detects unresolved incidents', async () => {
    const report = await generateReport(
      { ...baseParams, type: 'soc2-security' },
      {
        soc2Security: {
          incidents: [
            { id: 'inc1', timestamp: '2025-01-15T00:00:00Z', severity: 'high', description: 'Unauthorized access' },
          ],
        },
      },
    )

    const incFinding = report.findings.find((f) => f.id === 'SOC2-SEC-003')
    expect(incFinding!.status).toBe('fail')
    expect(incFinding!.severity).toBe('high')
  })

  it('flags high failed authentications', async () => {
    const report = await generateReport(
      { ...baseParams, type: 'soc2-security' },
      {
        soc2Security: {
          failedAuthentications: 150,
        },
      },
    )

    const authFinding = report.findings.find((f) => f.id === 'SOC2-SEC-004')
    expect(authFinding!.status).toBe('fail')
    expect(authFinding!.severity).toBe('high')
  })
})

// --- SOC 2 Availability report tests ---

describe('SOC 2 Availability report generation', () => {
  it('generates report with default data', async () => {
    const report = await generateReport({ ...baseParams, type: 'soc2-availability' })

    expect(report.type).toBe('soc2-availability')
    expect(report.title).toBe('SOC 2 Availability Report')
    expect(report.summary.totalFindings).toBe(4)
    expect(report.data).toHaveProperty('uptimePercentage')
  })

  it('flags low uptime', async () => {
    const report = await generateReport(
      { ...baseParams, type: 'soc2-availability' },
      {
        soc2Availability: {
          uptimePercentage: 98.0,
          totalDowntimeMinutes: 500,
        },
      },
    )

    const uptimeFinding = report.findings.find((f) => f.id === 'SOC2-AVAIL-001')
    expect(uptimeFinding!.status).toBe('fail')
    expect(uptimeFinding!.severity).toBe('high')
  })

  it('detects backup failures', async () => {
    const report = await generateReport(
      { ...baseParams, type: 'soc2-availability' },
      {
        soc2Availability: {
          backups: [
            { type: 'database', lastRun: '2025-06-30T00:00:00Z', status: 'failure', sizeBytes: 0 },
          ],
        },
      },
    )

    const backupFinding = report.findings.find((f) => f.id === 'SOC2-AVAIL-002')
    expect(backupFinding!.status).toBe('fail')
    expect(backupFinding!.severity).toBe('high')
  })

  it('detects failed DR tests', async () => {
    const report = await generateReport(
      { ...baseParams, type: 'soc2-availability' },
      {
        soc2Availability: {
          disasterRecoveryTests: [
            { testDate: '2025-06-01T00:00:00Z', rtoMinutes: 60, rpoMinutes: 30, passed: false },
          ],
        },
      },
    )

    const drFinding = report.findings.find((f) => f.id === 'SOC2-AVAIL-003')
    expect(drFinding!.status).toBe('fail')
  })
})

// --- Consent Compliance report tests ---

describe('Consent Compliance report generation', () => {
  it('generates report with no consents', async () => {
    const report = await generateReport({ ...baseParams, type: 'consent-compliance' })

    expect(report.type).toBe('consent-compliance')
    expect(report.summary.totalFindings).toBe(4)
    const data = report.data as { totalConsents: number }
    expect(data.totalConsents).toBe(0)
  })

  it('categorizes consents by status and treatment type', async () => {
    const consents = [
      { id: 'c1', status: 'active', treatmentType: 'CBT', patientId: 'p1', expiryDate: '2026-12-31T00:00:00Z' },
      { id: 'c2', status: 'active', treatmentType: 'DBT', patientId: 'p2', expiryDate: '2026-06-30T00:00:00Z' },
      { id: 'c3', status: 'withdrawn', treatmentType: 'CBT', patientId: 'p3' },
    ]

    const report = await generateReport(
      { ...baseParams, type: 'consent-compliance' },
      { consents: { consents } },
    )

    const data = report.data as { totalConsents: number; consentsByStatus: Record<string, number>; consentsByTreatment: Record<string, number> }
    expect(data.totalConsents).toBe(3)
    expect(data.consentsByStatus['active']).toBe(2)
    expect(data.consentsByStatus['withdrawn']).toBe(1)
    expect(data.consentsByTreatment['CBT']).toBe(2)
    expect(data.consentsByTreatment['DBT']).toBe(1)
  })

  it('detects expiring consents within 30 days', async () => {
    const soon = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
    const consents = [
      { id: 'c1', status: 'active', treatmentType: 'CBT', patientId: 'p1', expiryDate: soon },
    ]

    const report = await generateReport(
      { ...baseParams, type: 'consent-compliance' },
      { consents: { consents } },
    )

    const data = report.data as { expiringConsents: unknown[] }
    expect(data.expiringConsents).toHaveLength(1)
  })

  it('detects expired consents', async () => {
    const past = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const consents = [
      { id: 'c1', status: 'expired', treatmentType: 'CBT', patientId: 'p1', expiryDate: past },
    ]

    const report = await generateReport(
      { ...baseParams, type: 'consent-compliance' },
      { consents: { consents } },
    )

    const data = report.data as { expiredConsents: unknown[] }
    expect(data.expiredConsents).toHaveLength(1)

    const expiredFinding = report.findings.find((f) => f.id === 'CONSENT-003')
    expect(expiredFinding!.status).toBe('fail')
    expect(expiredFinding!.severity).toBe('high')
  })

  it('tracks renewals and withdrawals', async () => {
    const report = await generateReport(
      { ...baseParams, type: 'consent-compliance' },
      {
        consents: {
          renewals: [
            { consentId: 'c1', patientId: 'p1', renewedAt: '2025-03-15T00:00:00Z', renewedBy: 'admin' },
          ],
          withdrawals: [
            { consentId: 'c2', patientId: 'p2', withdrawnAt: '2025-04-01T00:00:00Z', withdrawnBy: 'patient' },
          ],
        },
      },
    )

    const data = report.data as { renewals: unknown[]; withdrawals: unknown[] }
    expect(data.renewals).toHaveLength(1)
    expect(data.withdrawals).toHaveLength(1)
  })
})

// --- Access Review report tests ---

describe('Access Review report generation', () => {
  it('generates report with default data', async () => {
    const report = await generateReport({ ...baseParams, type: 'access-review' })

    expect(report.type).toBe('access-review')
    expect(report.summary.totalFindings).toBe(4)
  })

  it('detects dormant accounts', async () => {
    const oldDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString()
    const report = await generateReport(
      { ...baseParams, type: 'access-review' },
      {
        accessReview: {
          assignments: [
            { userId: 'u1', role: 'clinician', assignedAt: '2024-01-01T00:00:00Z', active: true, lastAccessedAt: oldDate },
          ],
          roleDefinitions: [],
          privilegedAccess: [],
        },
      },
    )

    const data = report.data as { dormantAccounts: Array<{ daysDormant: number }> }
    expect(data.dormantAccounts).toHaveLength(1)
    expect(data.dormantAccounts[0].daysDormant).toBeGreaterThan(90)

    const dormantFinding = report.findings.find((f) => f.id === 'ACCESS-002')
    expect(dormantFinding!.status).toBe('warning')
  })

  it('flags roles with excessive permissions', async () => {
    const report = await generateReport(
      { ...baseParams, type: 'access-review' },
      {
        accessReview: {
          assignments: [],
          roleDefinitions: [
            { role: 'superadmin', permissions: Array.from({ length: 25 }, (_, i) => `perm_${i}`), userCount: 3 },
          ],
          privilegedAccess: [],
        },
      },
    )

    const privilegeFinding = report.findings.find((f) => f.id === 'ACCESS-004')
    expect(privilegeFinding!.status).toBe('warning')
    expect(privilegeFinding!.severity).toBe('medium')
  })
})

// --- generateAllReports tests ---

describe('generateAllReports', () => {
  it('generates all 5 report types', async () => {
    const reports = await generateAllReports(baseParams)

    expect(reports).toHaveLength(5)
    expect(reports.map((r) => r.type)).toEqual([
      'hipaa-audit',
      'soc2-security',
      'soc2-availability',
      'consent-compliance',
      'access-review',
    ])
  })

  it('each report has a unique ID', async () => {
    const reports = await generateAllReports(baseParams)
    const ids = reports.map((r) => r.id)
    expect(new Set(ids).size).toBe(5)
  })
})

// --- Export tests ---

describe('CSV export', () => {
  it('exports report as CSV with headers', async () => {
    const report = await generateReport({ ...baseParams, type: 'hipaa-audit' })
    const result = exportCsv(report)

    expect(result.format).toBe('csv')
    expect(result.mimeType).toBe('text/csv')
    expect(result.filename).toContain('.csv')
    expect(result.content).toContain('Finding ID,Title,Control ID,Severity,Status,Description,Evidence,Remediation')
    expect(result.content).toContain('HIPAA-001')
    expect(result.content).toContain('Compliance Score')
  })

  it('escapes CSV fields with commas and quotes', async () => {
    const report = await generateReport({ ...baseParams, type: 'hipaa-audit' })
    const result = exportCsv(report)

    // The content should be valid CSV (no unescaped quotes breaking structure)
    expect(result.content).toContain('"')
  })
})

describe('JSON export', () => {
  it('exports report as valid JSON', async () => {
    const report = await generateReport({ ...baseParams, type: 'soc2-security' })
    const result = exportJson(report)

    expect(result.format).toBe('json')
    expect(result.mimeType).toBe('application/json')
    expect(result.filename).toContain('.json')

    const parsed = JSON.parse(result.content)
    expect(parsed.type).toBe('soc2-security')
    expect(parsed.findings).toBeInstanceOf(Array)
  })
})

describe('exportReport', () => {
  it('exports in CSV format', async () => {
    const report = await generateReport({ ...baseParams, type: 'consent-compliance' })
    const result = exportReport(report, 'csv')

    expect(result.format).toBe('csv')
    expect(result.content).toContain('Finding ID')
  })

  it('exports in JSON format', async () => {
    const report = await generateReport({ ...baseParams, type: 'access-review' })
    const result = exportReport(report, 'json')

    expect(result.format).toBe('json')
    expect(JSON.parse(result.content).type).toBe('access-review')
  })

  it('exports in PDF (HTML) format', async () => {
    const report = await generateReport({ ...baseParams, type: 'soc2-availability' })
    const result = exportReport(report, 'pdf')

    expect(result.format).toBe('pdf')
    expect(result.mimeType).toBe('text/html')
    expect(result.content).toContain('<!DOCTYPE html>')
    expect(result.content).toContain(report.title)
  })

  it('throws for unsupported format', async () => {
    const report = await generateReport({ ...baseParams, type: 'hipaa-audit' })
    expect(() => exportReport(report, 'xml' as ExportFormat)).toThrow()
  })
})

// --- Summary builder tests ---

describe('Report summary', () => {
  it('calculates compliance score correctly', async () => {
    const events = [
      { id: 'e1', action: 'read', status: 'success', userId: 'u1', hash: 'h1', previousHash: 'genesis' },
    ]
    const report = await generateReport(
      { ...baseParams, type: 'hipaa-audit' },
      { auditEvents: events },
    )

    expect(report.summary.totalFindings).toBe(4)
    expect(report.summary.complianceScore).toBeGreaterThan(0)
    expect(report.summary.complianceScore).toBeLessThanOrEqual(100)
  })

  it('counts findings by status', async () => {
    const report = await generateReport({ ...baseParams, type: 'soc2-security' })

    const statusCounts = report.summary
    expect(statusCounts.passed + statusCounts.failed + statusCounts.warnings + statusCounts.notApplicable).toBe(
      statusCounts.totalFindings,
    )
  })
})
