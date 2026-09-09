/**
 * Tests for PDF Exporter.
 * Verifies PDF generation for all 5 compliance report types.
 * Uses real PDFKit to produce actual PDF buffers.
 */

// @vitest-environment node

import zlib from 'node:zlib'

import { describe, it, expect } from 'vitest'

import { exportReportToPDF } from '../export/pdf-exporter'
import type {
  ComplianceReport,
  ReportMetadata,
  HIPAAAuditReport,
  SOC2SecurityReport,
  SOC2AvailabilityReport,
  ConsentComplianceReport,
  AccessReviewReport,
  ReportPeriod,
  ChainVerificationResult,
} from '../types'

const period: ReportPeriod = {
  startDate: '2025-01-01T00:00:00.000Z',
  endDate: '2025-01-31T23:59:59.000Z',
}

const validChain: ChainVerificationResult = {
  valid: true,
  totalEvents: 5,
}

const baseMetadata: ReportMetadata = {
  reportId: 'rpt-test-001',
  type: 'hipaa_audit',
  status: 'completed',
  format: 'pdf',
  period,
  tenantId: 'tenant-001',
  generatedBy: 'test-user',
  generatedAt: '2025-02-01T00:00:00.000Z',
}

// ---------------------------------------------------------------------------
// Test data builders
// ---------------------------------------------------------------------------

function makeHIPAAReport(): HIPAAAuditReport {
  return {
    reportType: 'hipaa_audit',
    reportId: 'rpt-test-001',
    generatedAt: '2025-02-01T00:00:00.000Z',
    period,
    tenantId: 'tenant-001',
    chainVerification: validChain,
    phiAccessEvents: [
      {
        eventId: 'evt-1',
        timestamp: '2025-01-15T10:00:00.000Z',
        userId: 'user-1',
        action: 'patient_view',
        resourceType: 'patient',
        resourceId: 'patient-001',
        patientId: 'patient-001',
        severity: 'info',
        status: 'success',
      },
    ],
    phiModificationEvents: [
      {
        eventId: 'evt-2',
        timestamp: '2025-01-15T11:00:00.000Z',
        userId: 'user-2',
        action: 'patient_update',
        resourceType: 'patient',
        resourceId: 'patient-002',
        status: 'success',
      },
    ],
    breakGlassEvents: [
      {
        eventId: 'evt-3',
        timestamp: '2025-01-15T12:00:00.000Z',
        userId: 'user-3',
        reason: 'Emergency access',
        resourceType: 'patient',
        resourceId: 'patient-003',
        severity: 'high',
      },
    ],
    summary: {
      totalPhiAccess: 1,
      totalPhiModifications: 1,
      totalBreakGlass: 1,
      failedAccess: 0,
      uniqueUsers: 3,
      uniquePatients: 3,
      chainValid: true,
    },
  }
}

function makeSOC2SecurityReport(): SOC2SecurityReport {
  return {
    reportType: 'soc2_security',
    reportId: 'rpt-test-002',
    generatedAt: '2025-02-01T00:00:00.000Z',
    period,
    tenantId: 'tenant-001',
    accessControls: {
      totalUsers: 5,
      roleAssignments: [
        {
          role: 'physician',
          count: 2,
          permissions: ['read_patient', 'write_patient'],
        },
        { role: 'nurse', count: 3, permissions: ['read_patient'] },
      ],
      permissionGrants: 4,
      permissionRevocations: 1,
      mfaRequiredPermissions: 2,
    },
    auditLogIntegrity: validChain,
    encryption: {
      dataInTransit: true,
      dataAtRest: true,
      auditLogHashing: true,
      algorithm:
        'SHA-256 (audit chain), AES-256 (data at rest), TLS 1.3 (transit)',
    },
    incidents: [
      {
        incidentId: 'inc-1',
        timestamp: '2025-01-15T10:00:00.000Z',
        severity: 'critical',
        type: 'breach',
        description: 'Security breach detected',
        resolved: false,
      },
    ],
    summary: {
      totalAccessEvents: 10,
      totalSecurityEvents: 1,
      failedAccessAttempts: 2,
      chainValid: true,
      encryptionCompliant: true,
      openIncidents: 1,
    },
  }
}

function makeSOC2AvailabilityReport(): SOC2AvailabilityReport {
  return {
    reportType: 'soc2_availability',
    reportId: 'rpt-test-003',
    generatedAt: '2025-02-01T00:00:00.000Z',
    period,
    tenantId: 'tenant-001',
    uptime: {
      totalUptimePercentage: 99.93,
      totalDowntimeMinutes: 30,
      incidents: [
        {
          incidentId: 'dt-1',
          startTime: '2025-01-15T03:00:00.000Z',
          endTime: '2025-01-15T03:30:00.000Z',
          durationMinutes: 30,
          description: 'Planned maintenance',
        },
      ],
    },
    backupRestore: {
      lastBackupAt: '2025-01-31T03:00:00.000Z',
      backupFrequency: 'Daily (automated)',
      lastRestoreTest: '2025-01-20T10:00:00.000Z',
      backupEncryption: true,
    },
    disasterRecovery: {
      drPlanVersion: '2.0.0',
      lastTestDate: '2025-01-10T08:00:00.000Z',
      rtoMinutes: 60,
      rpoMinutes: 15,
    },
    summary: {
      uptimePercentage: 99.93,
      totalDowntimeMinutes: 30,
      backupCompliant: true,
      drCompliant: true,
    },
  }
}

function makeConsentComplianceReport(): ConsentComplianceReport {
  return {
    reportType: 'consent_compliance',
    reportId: 'rpt-test-004',
    generatedAt: '2025-02-01T00:00:00.000Z',
    period,
    tenantId: 'tenant-001',
    byState: [
      {
        stateCode: 'CA',
        totalConsents: 50,
        activeConsents: 45,
        expiredConsents: 3,
        revokedConsents: 2,
        requiredLevel: 'standard',
        complianceRate: 90,
      },
      {
        stateCode: 'NY',
        totalConsents: 30,
        activeConsents: 28,
        expiredConsents: 1,
        revokedConsents: 1,
        requiredLevel: 'standard',
        complianceRate: 93.3,
      },
    ],
    byTreatment: [
      {
        treatmentCategory: 'therapy',
        totalConsents: 40,
        activeConsents: 38,
        expiredConsents: 1,
        revokedConsents: 1,
        complianceRate: 95,
      },
    ],
    expiringConsents: [
      {
        consentId: 'consent-001',
        patientId: 'patient-001',
        stateCode: 'CA',
        category: 'therapy',
        expiresAt: '2025-02-15T00:00:00.000Z',
        daysUntilExpiry: 14,
      },
    ],
    summary: {
      totalConsents: 80,
      activeConsents: 73,
      expiredConsents: 4,
      revokedConsents: 3,
      expiringWithin30Days: 1,
      overallComplianceRate: 91.25,
      statesCovered: 2,
    },
  }
}

function makeAccessReviewReport(): AccessReviewReport {
  return {
    reportType: 'access_review',
    reportId: 'rpt-test-005',
    generatedAt: '2025-02-01T00:00:00.000Z',
    period,
    tenantId: 'tenant-001',
    roleAssignments: [
      {
        userId: 'user-1',
        role: 'physician',
        permissions: ['read_patient', 'write_patient', 'export_phi'],
        assignedAt: '2025-01-10T00:00:00.000Z',
        active: true,
      },
      {
        userId: 'user-2',
        role: 'nurse',
        permissions: ['read_patient'],
        assignedAt: '2025-01-15T00:00:00.000Z',
        active: true,
      },
    ],
    permissionChanges: [
      {
        changeId: 'ch-1',
        timestamp: '2025-01-10T00:00:00.000Z',
        userId: 'user-1',
        type: 'grant',
        permission: 'export_phi',
        role: 'physician',
        reason: 'Promotion',
      },
      {
        changeId: 'ch-2',
        timestamp: '2025-01-20T00:00:00.000Z',
        userId: 'user-2',
        type: 'revocation',
        permission: 'audit_access',
        role: 'nurse',
        reason: 'Role change',
      },
    ],
    summary: {
      totalActiveAssignments: 2,
      totalUsers: 2,
      totalRoles: 2,
      grants: 1,
      revocations: 1,
      highRiskPermissions: 1,
    },
  }
}

// ---------------------------------------------------------------------------
// PDF text extraction helper
// ---------------------------------------------------------------------------

function extractPdfText(buffer: Buffer): string {
  const binaryStr = buffer.toString('binary')
  const chunks: string[] = []
  let searchFrom = 0

  while (true) {
    const streamKeyword = 'stream'
    const streamStart = binaryStr.indexOf(streamKeyword, searchFrom)
    if (streamStart === -1) break

    const afterKeyword = streamStart + streamKeyword.length
    const dataStart = afterKeyword + (binaryStr[afterKeyword] === '\r' ? 2 : 1)
    const streamEnd = binaryStr.indexOf('endstream', dataStart)
    if (streamEnd === -1) break

    try {
      const decompressed = zlib.inflateSync(
        buffer.subarray(dataStart, streamEnd),
      )
      const content = decompressed.toString('latin1')
      const hexMatches = content.match(/<([0-9A-Fa-f]+)>/g)
      if (hexMatches) {
        for (const hexStr of hexMatches) {
          const hex = hexStr.replace(/[<>]/g, '')
          if (hex.length % 2 === 0) {
            chunks.push(Buffer.from(hex, 'hex').toString('latin1'))
          }
        }
      }
    } catch {
      // not a FlateDecode stream
    }

    searchFrom = streamEnd + 'endstream'.length
  }

  return chunks.join('')
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('exportReportToPDF', () => {
  it('exports HIPAA audit report as a valid PDF buffer', async () => {
    const report = makeHIPAAReport()
    const metadata = { ...baseMetadata, type: 'hipaa_audit' as const }
    const buffer = await exportReportToPDF(report, metadata)
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(0)
    // PDF files start with %PDF
    expect(buffer.toString('ascii', 0, 4)).toBe('%PDF')
  })

  it('exports SOC 2 security report as a valid PDF buffer', async () => {
    const report = makeSOC2SecurityReport()
    const metadata = { ...baseMetadata, type: 'soc2_security' as const }
    const buffer = await exportReportToPDF(report, metadata)
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(0)
    expect(buffer.toString('ascii', 0, 4)).toBe('%PDF')
  })

  it('exports SOC 2 availability report as a valid PDF buffer', async () => {
    const report = makeSOC2AvailabilityReport()
    const metadata = { ...baseMetadata, type: 'soc2_availability' as const }
    const buffer = await exportReportToPDF(report, metadata)
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(0)
    expect(buffer.toString('ascii', 0, 4)).toBe('%PDF')
  })

  it('exports consent compliance report as a valid PDF buffer', async () => {
    const report = makeConsentComplianceReport()
    const metadata = { ...baseMetadata, type: 'consent_compliance' as const }
    const buffer = await exportReportToPDF(report, metadata)
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(0)
    expect(buffer.toString('ascii', 0, 4)).toBe('%PDF')
  })

  it('exports access review report as a valid PDF buffer', async () => {
    const report = makeAccessReviewReport()
    const metadata = { ...baseMetadata, type: 'access_review' as const }
    const buffer = await exportReportToPDF(report, metadata)
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(0)
    expect(buffer.toString('ascii', 0, 4)).toBe('%PDF')
  })

  it('produces different content for different report types', async () => {
    const hipaaReport = makeHIPAAReport()
    const soc2Report = makeSOC2SecurityReport()
    const hipaaBuffer = await exportReportToPDF(hipaaReport, {
      ...baseMetadata,
      type: 'hipaa_audit' as const,
    })
    const soc2Buffer = await exportReportToPDF(soc2Report, {
      ...baseMetadata,
      type: 'soc2_security' as const,
    })
    // Different report types should produce different PDFs
    expect(hipaaBuffer.equals(soc2Buffer)).toBe(false)
  })

  it('includes report metadata in PDF', async () => {
    const report = makeHIPAAReport()
    const metadata = {
      ...baseMetadata,
      generatedBy: 'specific-test-user',
      status: 'completed' as const,
    }
    const buffer = await exportReportToPDF(report, metadata)
    const text = extractPdfText(buffer)
    expect(text).toContain('rpt-test-001')
    expect(text).toContain('specific-test-user')
    expect(text).toContain('completed')
    expect(text).toContain('Report Information')
  })

  it('handles empty report data gracefully', async () => {
    const report: HIPAAAuditReport = {
      reportType: 'hipaa_audit',
      reportId: 'rpt-empty',
      generatedAt: '2025-02-01T00:00:00.000Z',
      period,
      tenantId: 'tenant-001',
      chainVerification: { valid: true, totalEvents: 0 },
      phiAccessEvents: [],
      phiModificationEvents: [],
      breakGlassEvents: [],
      summary: {
        totalPhiAccess: 0,
        totalPhiModifications: 0,
        totalBreakGlass: 0,
        failedAccess: 0,
        uniqueUsers: 0,
        uniquePatients: 0,
        chainValid: true,
      },
    }
    const metadata = { ...baseMetadata, type: 'hipaa_audit' as const }
    const buffer = await exportReportToPDF(report, metadata)
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(0)
    expect(buffer.toString('ascii', 0, 4)).toBe('%PDF')
  })
})
