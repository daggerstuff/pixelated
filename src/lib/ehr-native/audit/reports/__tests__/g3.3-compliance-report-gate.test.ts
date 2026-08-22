/**
 * G3.3 Compliance Report Gate Test
 *
 * Gate test verifying all 9 acceptance criteria from issue #5561 against
 * the F3.6 compliance report system. Each describe block maps to one
 * acceptance criterion. Tests that fail indicate gaps the system must close
 * before the gate passes.
 */

import { describe, it, expect, vi } from 'vitest'

import {
  REPORT_TEMPLATES,
  type ReportInputData,
  type ReportTemplate,
  type ReportType,
  type ComplianceReport,
  type ReportGenerationParams,
  type ExportFormat,
  type ExportResult,
  type ConsentComplianceData,
  type AccessReviewData,
  type Soc2AvailabilityData,
  generateAllReports,
  generateReport,
  getTemplate,
  listTemplates,
  exportCsv,
  exportJson,
  exportReport,
} from '../index'

// Mock the logger to avoid real logging during tests
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
  verifyEhrAuditChain: vi.fn(
    (events: Array<{ id: string; hash?: string; previousHash?: string }>) => {
      for (let i = 0; i < events.length; i++) {
        if (!events[i].hash) {
          return { valid: false, brokenAtIndex: i, brokenAtId: events[i].id, reason: 'missing hash' }
        }
        if (i > 0 && events[i].previousHash !== events[i - 1].hash) {
          return { valid: false, brokenAtIndex: i, brokenAtId: events[i].id, reason: 'previousHash mismatch' }
        }
      }
      return { valid: true }
    },
  ),
}))

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const baseParams: Omit<ReportGenerationParams, 'type'> = {
  periodStart: '2025-01-01T00:00:00Z',
  periodEnd: '2025-06-30T23:59:59Z',
  generatedBy: 'compliance-officer@pixelated.test',
  organization: 'Pixelated Empathy Health Systems',
  tenantId: 'tenant-g33',
}

const mockAuditEvents: ReportInputData['auditEvents'] = [
  { id: 'e1', action: 'read', status: 'success', userId: 'clinician1', resourceType: 'Patient', resourceId: 'p1', timestamp: '2025-01-15T10:00:00Z', hash: 'h1', previousHash: 'genesis' },
  { id: 'e2', action: 'create', status: 'success', userId: 'clinician2', resourceType: 'Observation', resourceId: 'o1', timestamp: '2025-02-20T14:30:00Z', hash: 'h2', previousHash: 'h1' },
  { id: 'e3', action: 'break-glass', status: 'success', userId: 'clinician1', resourceType: 'Patient', resourceId: 'p2', timestamp: '2025-03-10T08:15:00Z', hash: 'h3', previousHash: 'h2', metadata: { breakGlassReason: 'Emergency clinical access' }, ipAddress: '10.0.0.5' },
  { id: 'e4', action: 'read', status: 'failure', userId: 'user3', resourceType: 'Patient', resourceId: 'p3', timestamp: '2025-04-05T16:45:00Z', hash: 'h4', previousHash: 'h3', errorMessage: 'Access denied — insufficient privileges' },
  { id: 'e5', action: 'update', status: 'success', userId: 'clinician2', resourceType: 'Patient', resourceId: 'p1', timestamp: '2025-05-12T11:20:00Z', hash: 'h5', previousHash: 'h4' },
]

const mockSoc2SecurityInput: ReportInputData['soc2Security'] = {
  roleAssignments: [
    { userId: 'admin1', role: 'administrator', assignedAt: '2024-12-01T00:00:00Z', active: true },
    { userId: 'clinician1', role: 'clinician', assignedAt: '2024-12-01T00:00:00Z', active: true },
    { userId: 'clinician2', role: 'clinician', assignedAt: '2025-01-15T00:00:00Z', active: true },
  ],
  accessChanges: [
    { timestamp: '2025-01-15T00:00:00Z', userId: 'clinician2', changeType: 'grant', role: 'clinician', performedBy: 'admin1' },
    { timestamp: '2025-04-10T00:00:00Z', userId: 'user3', changeType: 'revoke', role: 'clinician', performedBy: 'admin1' },
  ],
  encryptionStatus: { atRest: true, inTransit: true, algorithm: 'AES-256-GCM', keyRotationDays: 90 },
  incidents: [
    { id: 'inc-001', timestamp: '2025-02-10T00:00:00Z', severity: 'high', description: 'Unauthorized access attempt detected', resolvedAt: '2025-02-12T00:00:00Z' },
  ],
  failedAuthentications: 5,
}

const mockSoc2AvailabilityInput: ReportInputData['soc2Availability'] = {
  uptimePercentage: 99.95,
  totalDowntimeMinutes: 22,
  backups: [
    { type: 'database', lastRun: '2025-06-29T02:00:00Z', status: 'success', sizeBytes: 536870912 },
    { type: 'audit-log', lastRun: '2025-06-29T02:00:00Z', status: 'success', sizeBytes: 67108864 },
    { type: 'config', lastRun: '2025-06-29T02:00:00Z', status: 'failure', sizeBytes: 0 },
  ],
  disasterRecoveryTests: [
    { testDate: '2025-03-15T00:00:00Z', rtoMinutes: 15, rpoMinutes: 5, passed: true },
    { testDate: '2025-06-15T00:00:00Z', rtoMinutes: 20, rpoMinutes: 10, passed: true },
  ],
  healthChecks: [
    { service: 'api-gateway', status: 'healthy', lastChecked: '2025-06-30T23:00:00Z' },
    { service: 'database', status: 'healthy', lastChecked: '2025-06-30T23:00:00Z' },
    { service: 'redis-cache', status: 'degraded', lastChecked: '2025-06-30T23:00:00Z' },
  ],
}

const mockConsentsInput: ReportInputData['consents'] = {
  consents: [
    { id: 'consent-001', status: 'active', treatmentType: 'CBT', patientId: 'patient-001', expiryDate: '2026-12-31T00:00:00Z' },
    { id: 'consent-002', status: 'active', treatmentType: 'DBT', patientId: 'patient-002', expiryDate: '2026-06-30T00:00:00Z' },
    { id: 'consent-003', status: 'withdrawn', treatmentType: 'CBT', patientId: 'patient-003' },
    { id: 'consent-004', status: 'expired', treatmentType: 'Psychodynamic', patientId: 'patient-004', expiryDate: '2024-06-01T00:00:00Z' },
    { id: 'consent-005', status: 'active', treatmentType: 'CBT', patientId: 'patient-005', expiryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString() },
  ],
  renewals: [
    { consentId: 'consent-001', patientId: 'patient-001', renewedAt: '2025-03-15T00:00:00Z', renewedBy: 'admin1' },
  ],
  withdrawals: [
    { consentId: 'consent-003', patientId: 'patient-003', withdrawnAt: '2025-04-01T00:00:00Z', withdrawnBy: 'patient-003' },
  ],
}

const mockAccessReviewInput: ReportInputData['accessReview'] = {
  assignments: [
    { userId: 'admin1', role: 'administrator', assignedAt: '2024-12-01T00:00:00Z', active: true, lastAccessedAt: '2025-06-28T10:00:00Z' },
    { userId: 'clinician1', role: 'clinician', assignedAt: '2024-12-01T00:00:00Z', active: true, lastAccessedAt: '2025-06-29T14:00:00Z' },
    { userId: 'dormant1', role: 'clinician', assignedAt: '2024-01-01T00:00:00Z', active: true, lastAccessedAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString() },
  ],
  roleDefinitions: [
    { role: 'administrator', permissions: ['read', 'write', 'delete', 'manage-users', 'view-audit'], userCount: 1 },
    { role: 'clinician', permissions: ['read', 'write', 'view-phi'], userCount: 2 },
  ],
  privilegedAccess: [
    { userId: 'admin1', role: 'administrator', permissions: ['read', 'write', 'delete', 'manage-users', 'view-audit'], lastReviewedAt: '2025-06-01T00:00:00Z' },
  ],
}

// ---------------------------------------------------------------------------
// Criterion 1: HIPAA audit report matches required format
// ---------------------------------------------------------------------------

describe('G3.3 Criterion 1: HIPAA audit report matches required format', () => {
  it('report has type "hipaa-audit"', async () => {
    const report = await generateReport({ ...baseParams, type: 'hipaa-audit' }, { auditEvents: mockAuditEvents })
    expect(report.type).toBe('hipaa-audit')
  })

  it('report has title "HIPAA Audit Report"', async () => {
    const report = await generateReport({ ...baseParams, type: 'hipaa-audit' }, { auditEvents: mockAuditEvents })
    expect(report.title).toBe('HIPAA Audit Report')
  })

  it('report has all required top-level fields', async () => {
    const report = await generateReport({ ...baseParams, type: 'hipaa-audit' }, { auditEvents: mockAuditEvents })
    expect(report.id).toBeDefined()
    expect(report.type).toBeDefined()
    expect(report.title).toBeDefined()
    expect(report.periodStart).toBeDefined()
    expect(report.periodEnd).toBeDefined()
    expect(report.generatedAt).toBeDefined()
    expect(report.generatedBy).toBeDefined()
    expect(report.organization).toBeDefined()
    expect(report.summary).toBeDefined()
    expect(report.findings).toBeDefined()
    expect(report.data).toBeDefined()
  })

  it('report has chain verification result', async () => {
    const report = await generateReport({ ...baseParams, type: 'hipaa-audit' }, { auditEvents: mockAuditEvents })
    expect(report.chainVerification).toBeDefined()
    expect(report.chainVerification!.valid).toBe(true)
    expect(report.chainVerification!.totalEvents).toBe(mockAuditEvents.length)
  })

  it('findings include HIPAA-001 through HIPAA-004', async () => {
    const report = await generateReport({ ...baseParams, type: 'hipaa-audit' }, { auditEvents: mockAuditEvents })
    const findingIds = report.findings.map((f) => f.id)
    expect(findingIds).toContain('HIPAA-001')
    expect(findingIds).toContain('HIPAA-002')
    expect(findingIds).toContain('HIPAA-003')
    expect(findingIds).toContain('HIPAA-004')
  })

  it('each finding has required structure (id, title, controlId, severity, status, description, evidence)', async () => {
    const report = await generateReport({ ...baseParams, type: 'hipaa-audit' }, { auditEvents: mockAuditEvents })
    for (const finding of report.findings) {
      expect(finding.id).toBeDefined()
      expect(finding.title).toBeDefined()
      expect(finding.controlId).toBeDefined()
      expect(finding.severity).toBeDefined()
      expect(finding.status).toBeDefined()
      expect(finding.description).toBeDefined()
      expect(finding.evidence).toBeInstanceOf(Array)
    }
  })

  it('control IDs reference HIPAA regulatory sections', async () => {
    const report = await generateReport({ ...baseParams, type: 'hipaa-audit' }, { auditEvents: mockAuditEvents })
    for (const finding of report.findings) {
      expect(finding.controlId).toMatch(/§164\./)
    }
  })

  it('break-glass events are captured in findings evidence', async () => {
    const report = await generateReport({ ...baseParams, type: 'hipaa-audit' }, { auditEvents: mockAuditEvents })
    const bgFinding = report.findings.find((f) => f.id === 'HIPAA-003')
    expect(bgFinding).toBeDefined()
    expect(bgFinding!.evidence.length).toBeGreaterThan(0)
    expect(bgFinding!.evidence.some((e) => e.includes('clinician1'))).toBe(true)
  })

  it('summary has compliance score between 0 and 100', async () => {
    const report = await generateReport({ ...baseParams, type: 'hipaa-audit' }, { auditEvents: mockAuditEvents })
    expect(report.summary.complianceScore).toBeGreaterThanOrEqual(0)
    expect(report.summary.complianceScore).toBeLessThanOrEqual(100)
  })
})

// ---------------------------------------------------------------------------
// Criterion 2: SOC 2 security report includes all required evidence
// ---------------------------------------------------------------------------

describe('G3.3 Criterion 2: SOC 2 security report includes all required evidence', () => {
  it('report has type "soc2-security"', async () => {
    const report = await generateReport({ ...baseParams, type: 'soc2-security' }, { soc2Security: mockSoc2SecurityInput })
    expect(report.type).toBe('soc2-security')
  })

  it('findings include SOC2-SEC-001 through SOC2-SEC-004', async () => {
    const report = await generateReport({ ...baseParams, type: 'soc2-security' }, { soc2Security: mockSoc2SecurityInput })
    const ids = report.findings.map((f) => f.id)
    expect(ids).toContain('SOC2-SEC-001')
    expect(ids).toContain('SOC2-SEC-002')
    expect(ids).toContain('SOC2-SEC-003')
    expect(ids).toContain('SOC2-SEC-004')
  })

  it('access control evidence includes role assignments and access changes', async () => {
    const report = await generateReport({ ...baseParams, type: 'soc2-security' }, { soc2Security: mockSoc2SecurityInput })
    const accessFinding = report.findings.find((f) => f.id === 'SOC2-SEC-001')
    expect(accessFinding).toBeDefined()
    expect(accessFinding!.evidence.some((e) => e.includes('Active assignments'))).toBe(true)
    expect(accessFinding!.evidence.some((e) => e.includes('Access changes'))).toBe(true)
  })

  it('encryption evidence includes at-rest, in-transit, algorithm, and key rotation', async () => {
    const report = await generateReport({ ...baseParams, type: 'soc2-security' }, { soc2Security: mockSoc2SecurityInput })
    const encFinding = report.findings.find((f) => f.id === 'SOC2-SEC-002')
    expect(encFinding).toBeDefined()
    expect(encFinding!.evidence.some((e) => e.includes('At rest'))).toBe(true)
    expect(encFinding!.evidence.some((e) => e.includes('In transit'))).toBe(true)
    expect(encFinding!.evidence.some((e) => e.includes('Algorithm'))).toBe(true)
    expect(encFinding!.evidence.some((e) => e.includes('Key rotation'))).toBe(true)
  })

  it('incident response evidence includes total and unresolved counts', async () => {
    const report = await generateReport({ ...baseParams, type: 'soc2-security' }, { soc2Security: mockSoc2SecurityInput })
    const incFinding = report.findings.find((f) => f.id === 'SOC2-SEC-003')
    expect(incFinding).toBeDefined()
    expect(incFinding!.evidence.some((e) => e.includes('Total incidents'))).toBe(true)
    expect(incFinding!.evidence.some((e) => e.includes('Unresolved'))).toBe(true)
  })

  it('authentication failure evidence is present', async () => {
    const report = await generateReport({ ...baseParams, type: 'soc2-security' }, { soc2Security: mockSoc2SecurityInput })
    const authFinding = report.findings.find((f) => f.id === 'SOC2-SEC-004')
    expect(authFinding).toBeDefined()
    expect(authFinding!.evidence.some((e) => e.includes('failed authentication'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Criterion 3: SOC 2 availability report includes uptime + DR evidence
// ---------------------------------------------------------------------------

describe('G3.3 Criterion 3: SOC 2 availability report includes uptime + DR evidence', () => {
  it('report has type "soc2-availability"', async () => {
    const report = await generateReport({ ...baseParams, type: 'soc2-availability' }, { soc2Availability: mockSoc2AvailabilityInput })
    expect(report.type).toBe('soc2-availability')
  })

  it('uptime finding (SOC2-AVAIL-001) is present with uptime evidence', async () => {
    const report = await generateReport({ ...baseParams, type: 'soc2-availability' }, { soc2Availability: mockSoc2AvailabilityInput })
    const uptimeFinding = report.findings.find((f) => f.id === 'SOC2-AVAIL-001')
    expect(uptimeFinding).toBeDefined()
    expect(uptimeFinding!.evidence.some((e) => e.includes('Uptime'))).toBe(true)
    expect(uptimeFinding!.evidence.some((e) => e.includes('Downtime'))).toBe(true)
  })

  it('backup finding (SOC2-AVAIL-002) is present with backup evidence', async () => {
    const report = await generateReport({ ...baseParams, type: 'soc2-availability' }, { soc2Availability: mockSoc2AvailabilityInput })
    const backupFinding = report.findings.find((f) => f.id === 'SOC2-AVAIL-002')
    expect(backupFinding).toBeDefined()
    expect(backupFinding!.evidence.some((e) => e.includes('Total backups'))).toBe(true)
    expect(backupFinding!.evidence.some((e) => e.includes('Failed backups'))).toBe(true)
  })

  it('disaster recovery finding (SOC2-AVAIL-003) is present with RTO/RPO evidence', async () => {
    const report = await generateReport({ ...baseParams, type: 'soc2-availability' }, { soc2Availability: mockSoc2AvailabilityInput })
    const drFinding = report.findings.find((f) => f.id === 'SOC2-AVAIL-003')
    expect(drFinding).toBeDefined()
    expect(drFinding!.evidence.some((e) => e.includes('RTO'))).toBe(true)
    expect(drFinding!.evidence.some((e) => e.includes('RPO'))).toBe(true)
  })

  it('health check finding (SOC2-AVAIL-004) is present with service status evidence', async () => {
    const report = await generateReport({ ...baseParams, type: 'soc2-availability' }, { soc2Availability: mockSoc2AvailabilityInput })
    const healthFinding = report.findings.find((f) => f.id === 'SOC2-AVAIL-004')
    expect(healthFinding).toBeDefined()
    expect(healthFinding!.evidence.some((e) => e.includes('api-gateway'))).toBe(true)
    expect(healthFinding!.evidence.some((e) => e.includes('database'))).toBe(true)
  })

  it('report data includes uptimePercentage and totalDowntimeMinutes', async () => {
    const report = await generateReport({ ...baseParams, type: 'soc2-availability' }, { soc2Availability: mockSoc2AvailabilityInput })
    const data = report.data as { uptimePercentage: number; totalDowntimeMinutes: number }
    expect(data.uptimePercentage).toBe(99.95)
    expect(data.totalDowntimeMinutes).toBe(22)
  })

  it('report data includes disaster recovery test results', async () => {
    const report = await generateReport({ ...baseParams, type: 'soc2-availability' }, { soc2Availability: mockSoc2AvailabilityInput })
    const data = report.data as { disasterRecoveryTests: Array<{ rtoMinutes: number; rpoMinutes: number; passed: boolean }> }
    expect(data.disasterRecoveryTests).toHaveLength(2)
    expect(data.disasterRecoveryTests.every((t) => t.passed)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Criterion 4: Consent compliance report accurate (by state, by treatment type)
// ---------------------------------------------------------------------------

describe('G3.3 Criterion 4: Consent compliance report accurate by state and treatment type', () => {
  it('report has type "consent-compliance"', async () => {
    const report = await generateReport({ ...baseParams, type: 'consent-compliance' }, { consents: mockConsentsInput })
    expect(report.type).toBe('consent-compliance')
  })

  it('consentsByStatus accurately reflects consent states', async () => {
    const report = await generateReport({ ...baseParams, type: 'consent-compliance' }, { consents: mockConsentsInput })
    const data = report.data as { consentsByStatus: Record<string, number> }
    expect(data.consentsByStatus['active']).toBe(3)
    expect(data.consentsByStatus['withdrawn']).toBe(1)
    expect(data.consentsByStatus['expired']).toBe(1)
  })

  it('consentsByTreatment accurately reflects treatment types', async () => {
    const report = await generateReport({ ...baseParams, type: 'consent-compliance' }, { consents: mockConsentsInput })
    const data = report.data as { consentsByTreatment: Record<string, number> }
    expect(data.consentsByTreatment['CBT']).toBe(3)
    expect(data.consentsByTreatment['DBT']).toBe(1)
    expect(data.consentsByTreatment['Psychodynamic']).toBe(1)
  })

  it('expiring consents within 30-day window are detected', async () => {
    const report = await generateReport({ ...baseParams, type: 'consent-compliance' }, { consents: mockConsentsInput })
    const data = report.data as { expiringConsents: Array<{ consentId: string }> }
    expect(data.expiringConsents.length).toBeGreaterThan(0)
    expect(data.expiringConsents.some((e) => e.consentId === 'consent-005')).toBe(true)
  })

  it('expired consents are detected and flagged', async () => {
    const report = await generateReport({ ...baseParams, type: 'consent-compliance' }, { consents: mockConsentsInput })
    const data = report.data as { expiredConsents: Array<{ consentId: string }> }
    expect(data.expiredConsents.length).toBeGreaterThan(0)
    expect(data.expiredConsents.some((e) => e.consentId === 'consent-004')).toBe(true)
  })

  it('renewals are tracked in report data', async () => {
    const report = await generateReport({ ...baseParams, type: 'consent-compliance' }, { consents: mockConsentsInput })
    const data = report.data as { renewals: Array<{ consentId: string }> }
    expect(data.renewals).toHaveLength(1)
    expect(data.renewals[0].consentId).toBe('consent-001')
  })

  it('withdrawals are tracked in report data', async () => {
    const report = await generateReport({ ...baseParams, type: 'consent-compliance' }, { consents: mockConsentsInput })
    const data = report.data as { withdrawals: Array<{ consentId: string }> }
    expect(data.withdrawals).toHaveLength(1)
    expect(data.withdrawals[0].consentId).toBe('consent-003')
  })

  it('totalConsents matches input count', async () => {
    const report = await generateReport({ ...baseParams, type: 'consent-compliance' }, { consents: mockConsentsInput })
    const data = report.data as ConsentComplianceData
    expect(data.totalConsents).toBe(mockConsentsInput.consents!.length)
  })
})

// ---------------------------------------------------------------------------
// Criterion 5: Access review report complete (all RBAC changes)
// ---------------------------------------------------------------------------

describe('G3.3 Criterion 5: Access review report complete with all RBAC changes', () => {
  it('report has type "access-review"', async () => {
    const report = await generateReport({ ...baseParams, type: 'access-review' }, { accessReview: mockAccessReviewInput })
    expect(report.type).toBe('access-review')
  })

  it('findings include ACCESS-001 through ACCESS-004', async () => {
    const report = await generateReport({ ...baseParams, type: 'access-review' }, { accessReview: mockAccessReviewInput })
    const ids = report.findings.map((f) => f.id)
    expect(ids).toContain('ACCESS-001')
    expect(ids).toContain('ACCESS-002')
    expect(ids).toContain('ACCESS-003')
    expect(ids).toContain('ACCESS-004')
  })

  it('active assignments finding includes count and role definitions', async () => {
    const report = await generateReport({ ...baseParams, type: 'access-review' }, { accessReview: mockAccessReviewInput })
    const finding = report.findings.find((f) => f.id === 'ACCESS-001')
    expect(finding).toBeDefined()
    expect(finding!.evidence.some((e) => e.includes('Active assignments'))).toBe(true)
    expect(finding!.evidence.some((e) => e.includes('Role definitions'))).toBe(true)
  })

  it('dormant accounts are detected from assignment data', async () => {
    const report = await generateReport({ ...baseParams, type: 'access-review' }, { accessReview: mockAccessReviewInput })
    const data = report.data as { dormantAccounts: Array<{ userId: string; daysDormant: number }> }
    expect(data.dormantAccounts.length).toBeGreaterThan(0)
    expect(data.dormantAccounts.some((a) => a.userId === 'dormant1')).toBe(true)
  })

  it('dormant account finding flags accounts dormant 90+ days', async () => {
    const report = await generateReport({ ...baseParams, type: 'access-review' }, { accessReview: mockAccessReviewInput })
    const finding = report.findings.find((f) => f.id === 'ACCESS-002')
    expect(finding).toBeDefined()
    expect(finding!.status).toBe('warning')
    expect(finding!.evidence.some((e) => e.includes('dormant1'))).toBe(true)
  })

  it('privileged access review finding includes user and role evidence', async () => {
    const report = await generateReport({ ...baseParams, type: 'access-review' }, { accessReview: mockAccessReviewInput })
    const finding = report.findings.find((f) => f.id === 'ACCESS-003')
    expect(finding).toBeDefined()
    expect(finding!.evidence.some((e) => e.includes('admin1'))).toBe(true)
  })

  it('least-privilege finding checks role permission counts', async () => {
    const report = await generateReport({ ...baseParams, type: 'access-review' }, { accessReview: mockAccessReviewInput })
    const finding = report.findings.find((f) => f.id === 'ACCESS-004')
    expect(finding).toBeDefined()
    expect(finding!.status).toBe('pass')
  })

  it('report data includes all assignments from input', async () => {
    const report = await generateReport({ ...baseParams, type: 'access-review' }, { accessReview: mockAccessReviewInput })
    const data = report.data as AccessReviewData
    expect(data.assignments).toHaveLength(mockAccessReviewInput.assignments!.length)
  })
})

// ---------------------------------------------------------------------------
// Criterion 6: PDF export renders correctly (valid HTML structure)
// ---------------------------------------------------------------------------

describe('G3.3 Criterion 6: PDF export renders correctly with valid HTML structure', () => {
  it('exportReport with pdf format returns ExportResult with format "pdf"', async () => {
    const report = await generateReport({ ...baseParams, type: 'hipaa-audit' }, { auditEvents: mockAuditEvents })
    const result = exportReport(report, 'pdf')
    expect(result.format).toBe('pdf')
  })

  it('PDF export mimeType is text/html', async () => {
    const report = await generateReport({ ...baseParams, type: 'hipaa-audit' }, { auditEvents: mockAuditEvents })
    const result = exportReport(report, 'pdf')
    expect(result.mimeType).toBe('text/html')
  })

  it('PDF export content starts with DOCTYPE html', async () => {
    const report = await generateReport({ ...baseParams, type: 'hipaa-audit' }, { auditEvents: mockAuditEvents })
    const result = exportReport(report, 'pdf')
    expect(result.content).toMatch(/^<!DOCTYPE html>/)
  })

  it('PDF export content has <html> tag with lang attribute', async () => {
    const report = await generateReport({ ...baseParams, type: 'hipaa-audit' }, { auditEvents: mockAuditEvents })
    const result = exportReport(report, 'pdf')
    expect(result.content).toContain('<html lang="en">')
  })

  it('PDF export content has <head> with <title> containing report title', async () => {
    const report = await generateReport({ ...baseParams, type: 'soc2-security' }, { soc2Security: mockSoc2SecurityInput })
    const result = exportReport(report, 'pdf')
    expect(result.content).toContain('<title>')
    expect(result.content).toContain(report.title)
  })

  it('PDF export content has <body> with report metadata', async () => {
    const report = await generateReport({ ...baseParams, type: 'soc2-availability' }, { soc2Availability: mockSoc2AvailabilityInput })
    const result = exportReport(report, 'pdf')
    expect(result.content).toContain('<body>')
    expect(result.content).toContain(report.id)
    expect(result.content).toContain(report.organization)
    expect(result.content).toContain(report.generatedBy)
  })

  it('PDF export content has a <table> for findings', async () => {
    const report = await generateReport({ ...baseParams, type: 'consent-compliance' }, { consents: mockConsentsInput })
    const result = exportReport(report, 'pdf')
    expect(result.content).toContain('<table>')
    expect(result.content).toContain('<thead>')
    expect(result.content).toContain('<tbody>')
  })

  it('PDF export content includes compliance score', async () => {
    const report = await generateReport({ ...baseParams, type: 'access-review' }, { accessReview: mockAccessReviewInput })
    const result = exportReport(report, 'pdf')
    expect(result.content).toContain('Compliance Score')
    expect(result.content).toContain(`${report.summary.complianceScore}%`)
  })

  it('PDF export filename ends with .html', async () => {
    const report = await generateReport({ ...baseParams, type: 'hipaa-audit' }, { auditEvents: mockAuditEvents })
    const result = exportReport(report, 'pdf')
    expect(result.filename).toMatch(/\.html$/)
  })
})

// ---------------------------------------------------------------------------
// Criterion 7: CSV export is parseable (valid CSV with headers)
// ---------------------------------------------------------------------------

describe('G3.3 Criterion 7: CSV export is parseable with valid headers', () => {
  it('exportReport with csv format returns ExportResult with format "csv"', async () => {
    const report = await generateReport({ ...baseParams, type: 'hipaa-audit' }, { auditEvents: mockAuditEvents })
    const result = exportReport(report, 'csv')
    expect(result.format).toBe('csv')
  })

  it('CSV export mimeType is text/csv', async () => {
    const report = await generateReport({ ...baseParams, type: 'hipaa-audit' }, { auditEvents: mockAuditEvents })
    const result = exportReport(report, 'csv')
    expect(result.mimeType).toBe('text/csv')
  })

  it('CSV export has header row with expected columns', async () => {
    const report = await generateReport({ ...baseParams, type: 'hipaa-audit' }, { auditEvents: mockAuditEvents })
    const result = exportReport(report, 'csv')
    const lines = result.content.split('\n')
    const header = lines[0]
    expect(header).toContain('Finding ID')
    expect(header).toContain('Title')
    expect(header).toContain('Control ID')
    expect(header).toContain('Severity')
    expect(header).toContain('Status')
    expect(header).toContain('Description')
    expect(header).toContain('Evidence')
    expect(header).toContain('Remediation')
  })

  it('CSV export has one data row per finding', async () => {
    const report = await generateReport({ ...baseParams, type: 'hipaa-audit' }, { auditEvents: mockAuditEvents })
    const result = exportReport(report, 'csv')
    const lines = result.content.split('\n')
    // First line is header, then one line per finding, then blank line + summary
    const dataRows = lines.slice(1, 1 + report.findings.length)
    expect(dataRows).toHaveLength(report.findings.length)
  })

  it('CSV export includes summary section', async () => {
    const report = await generateReport({ ...baseParams, type: 'soc2-security' }, { soc2Security: mockSoc2SecurityInput })
    const result = exportReport(report, 'csv')
    expect(result.content).toContain('Summary')
    expect(result.content).toContain('Total Findings')
    expect(result.content).toContain('Compliance Score')
  })

  it('CSV export filename ends with .csv', async () => {
    const report = await generateReport({ ...baseParams, type: 'consent-compliance' }, { consents: mockConsentsInput })
    const result = exportReport(report, 'csv')
    expect(result.filename).toMatch(/\.csv$/)
  })

  it('CSV export is parseable — each data row has same column count as header', async () => {
    const report = await generateReport({ ...baseParams, type: 'access-review' }, { accessReview: mockAccessReviewInput })
    const result = exportReport(report, 'csv')
    const lines = result.content.split('\n')

    // Simple CSV parser that respects quoted fields (fields wrapped in
    // double quotes can contain commas and escaped quotes "").
    function parseCsvLine(line: string): string[] {
      const fields: string[] = []
      let current = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (inQuotes) {
          if (ch === '"') {
            if (line[i + 1] === '"') {
              current += '"'
              i++
            } else {
              inQuotes = false
            }
          } else {
            current += ch
          }
        } else {
          if (ch === '"') {
            inQuotes = true
          } else if (ch === ',') {
            fields.push(current)
            current = ''
          } else {
            current += ch
          }
        }
      }
      fields.push(current)
      return fields
    }

    const headerCols = parseCsvLine(lines[0]).length
    expect(headerCols).toBe(8)

    for (let i = 1; i <= report.findings.length; i++) {
      const rowCols = parseCsvLine(lines[i]).length
      expect(rowCols).toBe(headerCols)
    }
  })
})

// ---------------------------------------------------------------------------
// Criterion 8: Scheduled reports deliver on time (report has scheduledAt field)
// ---------------------------------------------------------------------------

describe('G3.3 Criterion 8: Scheduled reports deliver on time', () => {
  it('report has generatedAt field as valid ISO timestamp', async () => {
    const report = await generateReport({ ...baseParams, type: 'hipaa-audit' }, { auditEvents: mockAuditEvents })
    expect(report.generatedAt).toBeDefined()
    const parsed = new Date(report.generatedAt)
    expect(parsed.getTime()).not.toBeNaN()
  })

  it('generatedAt falls within or after the reporting period end', async () => {
    const report = await generateReport({ ...baseParams, type: 'soc2-security' }, { soc2Security: mockSoc2SecurityInput })
    const generated = new Date(report.generatedAt).getTime()
    const periodEnd = new Date(baseParams.periodEnd).getTime()
    expect(generated).toBeGreaterThanOrEqual(periodEnd)
  })

  it('report has scheduledAt field for scheduled delivery tracking', async () => {
    const report = await generateReport({ ...baseParams, type: 'hipaa-audit' }, { auditEvents: mockAuditEvents })
    // Gate test: verifies the report carries a scheduledAt field for
    // tracking scheduled delivery. This will fail until the field is added
    // to the ComplianceReport type and populated by the generator.
    expect(Object.prototype.hasOwnProperty.call(report, 'scheduledAt')).toBe(true)
  })

  it('all report types have generatedAt field', async () => {
    const reports = await generateAllReports(baseParams, {
      auditEvents: mockAuditEvents,
      soc2Security: mockSoc2SecurityInput,
      soc2Availability: mockSoc2AvailabilityInput,
      consents: mockConsentsInput,
      accessReview: mockAccessReviewInput,
    })
    for (const report of reports) {
      expect(report.generatedAt).toBeDefined()
      expect(new Date(report.generatedAt).getTime()).not.toBeNaN()
    }
  })
})

// ---------------------------------------------------------------------------
// Criterion 9: Report templates versioned and change-controlled
// ---------------------------------------------------------------------------

describe('G3.3 Criterion 9: Report templates versioned and change-controlled', () => {
  it('all 5 templates are registered in REPORT_TEMPLATES', () => {
    const keys = Object.keys(REPORT_TEMPLATES)
    expect(keys).toHaveLength(5)
    expect(keys).toContain('hipaa-audit')
    expect(keys).toContain('soc2-security')
    expect(keys).toContain('soc2-availability')
    expect(keys).toContain('consent-compliance')
    expect(keys).toContain('access-review')
  })

  it('each template has a unique type identifier', () => {
    const templates = listTemplates()
    const types = templates.map((t) => t.type)
    expect(new Set(types).size).toBe(types.length)
  })

  it('each template has framework and controlIds for traceability', () => {
    for (const template of listTemplates()) {
      expect(template.framework).toBeDefined()
      expect(template.framework.length).toBeGreaterThan(0)
      expect(template.controlIds).toBeInstanceOf(Array)
      expect(template.controlIds.length).toBeGreaterThan(0)
    }
  })

  it('each template has a generateFindings function', () => {
    for (const template of listTemplates()) {
      expect(typeof template.generateFindings).toBe('function')
    }
  })

  it('template registry is a Record (single source of truth for change control)', () => {
    // REPORT_TEMPLATES is a Record<ReportType, ReportTemplate> — a single
    // immutable-by-convention registry that serves as the change-control gate.
    expect(REPORT_TEMPLATES).toBeInstanceOf(Object)
    expect(Object.getPrototypeOf(REPORT_TEMPLATES)).toBe(Object.prototype)
  })

  it('each template has a version field for change control', () => {
    // Gate test: verifies each template carries a version field for
    // change-controlled template evolution. This will fail until the version
    // field is added to the ReportTemplate interface and each template.
    for (const template of listTemplates()) {
      expect(Object.prototype.hasOwnProperty.call(template, 'version')).toBe(true)
    }
  })

  it('getTemplate returns the same object reference as REPORT_TEMPLATES (no shadow copies)', () => {
    const direct = REPORT_TEMPLATES['hipaa-audit']
    const viaGetter = getTemplate('hipaa-audit')
    expect(viaGetter).toBe(direct)
  })
})

// ---------------------------------------------------------------------------
// Bonus: JSON export validation (mentioned in approach)
// ---------------------------------------------------------------------------

describe('G3.3 Bonus: JSON export produces valid JSON', () => {
  it('exportReport with json format returns valid parseable JSON', async () => {
    const report = await generateReport({ ...baseParams, type: 'hipaa-audit' }, { auditEvents: mockAuditEvents })
    const result = exportReport(report, 'json')
    expect(result.format).toBe('json')
    expect(result.mimeType).toBe('application/json')
    const parsed: ComplianceReport = JSON.parse(result.content)
    expect(parsed.type).toBe('hipaa-audit')
    expect(parsed.findings).toBeInstanceOf(Array)
    expect(parsed.summary).toBeDefined()
  })

  it('JSON export filename ends with .json', async () => {
    const report = await generateReport({ ...baseParams, type: 'soc2-security' }, { soc2Security: mockSoc2SecurityInput })
    const result = exportReport(report, 'json')
    expect(result.filename).toMatch(/\.json$/)
  })

  it('JSON export preserves all findings', async () => {
    const report = await generateReport({ ...baseParams, type: 'consent-compliance' }, { consents: mockConsentsInput })
    const result = exportReport(report, 'json')
    const parsed = JSON.parse(result.content)
    expect(parsed.findings.length).toBe(report.findings.length)
  })
})

// ---------------------------------------------------------------------------
// Bonus: generateAllReports integration
// ---------------------------------------------------------------------------

describe('G3.3 Bonus: generateAllReports produces all report types', () => {
  it('generates exactly 5 reports of distinct types', async () => {
    const reports = await generateAllReports(baseParams, {
      auditEvents: mockAuditEvents,
      soc2Security: mockSoc2SecurityInput,
      soc2Availability: mockSoc2AvailabilityInput,
      consents: mockConsentsInput,
      accessReview: mockAccessReviewInput,
    })
    expect(reports).toHaveLength(5)
    const types = reports.map((r) => r.type)
    expect(new Set(types).size).toBe(5)
  })

  it('each generated report has a unique ID', async () => {
    const reports = await generateAllReports(baseParams, {
      auditEvents: mockAuditEvents,
      soc2Security: mockSoc2SecurityInput,
      soc2Availability: mockSoc2AvailabilityInput,
      consents: mockConsentsInput,
      accessReview: mockAccessReviewInput,
    })
    const ids = reports.map((r) => r.id)
    expect(new Set(ids).size).toBe(5)
  })

  it('each generated report has findings with at least one finding', async () => {
    const reports = await generateAllReports(baseParams, {
      auditEvents: mockAuditEvents,
      soc2Security: mockSoc2SecurityInput,
      soc2Availability: mockSoc2AvailabilityInput,
      consents: mockConsentsInput,
      accessReview: mockAccessReviewInput,
    })
    for (const report of reports) {
      expect(report.findings.length).toBeGreaterThan(0)
    }
  })
})
