/**
 * Tests for CSV exporter — all 5 report types.
 * CSV exporter is pure (no external deps), so tests are straightforward.
 */

// @vitest-environment node

import { describe, it, expect } from 'vitest';
import { exportReportToCSV } from '../export/csv-exporter';
import type {
  HIPAAAuditReport,
  SOC2SecurityReport,
  SOC2AvailabilityReport,
  ConsentComplianceReport,
  AccessReviewReport,
  ReportMetadata,
} from '../types';
import type { ComplianceReport } from '../types';

const baseMetadata: ReportMetadata = {
  reportId: 'rpt-test-001',
  type: 'hipaa_audit',
  status: 'completed',
  format: 'csv',
  period: { startDate: '2025-01-01T00:00:00.000Z', endDate: '2025-01-31T23:59:59.000Z' },
  tenantId: 'tenant-001',
  generatedBy: 'test-user',
  generatedAt: '2025-02-01T00:00:00.000Z',
};

describe('exportReportToCSV', () => {
  it('exports HIPAA audit report with all sections', async () => {
    const report: HIPAAAuditReport = {
      reportType: 'hipaa_audit',
      reportId: 'rpt-test-001',
      generatedAt: '2025-02-01T00:00:00.000Z',
      period: { startDate: '2025-01-01T00:00:00.000Z', endDate: '2025-01-31T23:59:59.000Z' },
      tenantId: 'tenant-001',
      chainVerification: { valid: true, totalEvents: 100 },
      phiAccessEvents: [
        {
          eventId: 'evt-1', timestamp: '2025-01-15T10:00:00.000Z', userId: 'user-1',
          action: 'patient_view', resourceType: 'Patient', resourceId: 'patient-1',
          patientId: 'patient-1', severity: 'INFO', status: 'success',
          ipAddress: '127.0.0.1', hash: 'abc123',
        },
      ],
      phiModificationEvents: [
        {
          eventId: 'evt-2', timestamp: '2025-01-16T10:00:00.000Z', userId: 'user-2',
          action: 'patient_update', resourceType: 'Patient', resourceId: 'patient-2',
          previousHash: 'prev1', hash: 'hash2', status: 'success',
        },
      ],
      breakGlassEvents: [
        {
          eventId: 'evt-3', timestamp: '2025-01-17T10:00:00.000Z', userId: 'user-3',
          reason: 'Emergency access', resourceType: 'Patient', resourceId: 'patient-3',
          severity: 'HIGH',
        },
      ],
      summary: {
        totalPhiAccess: 1, totalPhiModifications: 1, totalBreakGlass: 1,
        failedAccess: 0, uniqueUsers: 3, uniquePatients: 1, chainValid: true,
      },
    };

    const csv = await exportReportToCSV(report as ComplianceReport, baseMetadata);
    expect(csv).toContain('HIPAA Audit Report');
    expect(csv).toContain('Chain Verification');
    expect(csv).toContain('PHI Access Events');
    expect(csv).toContain('PHI Modification Events');
    expect(csv).toContain('Break-Glass Events');
    expect(csv).toContain('Summary');
    expect(csv).toContain('patient_view');
    expect(csv).toContain('patient_update');
    expect(csv).toContain('Emergency access');
  });

  it('exports SOC 2 security report', async () => {
    const report: SOC2SecurityReport = {
      reportType: 'soc2_security',
      reportId: 'rpt-test-002',
      generatedAt: '2025-02-01T00:00:00.000Z',
      period: { startDate: '2025-01-01T00:00:00.000Z', endDate: '2025-01-31T23:59:59.000Z' },
      tenantId: 'tenant-001',
      accessControls: {
        totalUsers: 10,
        roleAssignments: [{ role: 'physician', count: 5, permissions: ['read_patient'] }],
        permissionGrants: 3, permissionRevocations: 1, mfaRequiredPermissions: 2,
      },
      auditLogIntegrity: { valid: true, totalEvents: 500 },
      encryption: {
        dataInTransit: true, dataAtRest: true, auditLogHashing: true,
        algorithm: 'SHA-256, AES-256, TLS 1.3',
      },
      incidents: [
        {
          incidentId: 'inc-1', timestamp: '2025-01-20T10:00:00.000Z',
          severity: 'CRITICAL', type: 'unauthorized_access',
          description: 'Unauthorized access attempt', resolved: false,
        },
      ],
      summary: {
        totalAccessEvents: 200, totalSecurityEvents: 1,
        failedAccessAttempts: 5, chainValid: true,
        encryptionCompliant: true, openIncidents: 1,
      },
    };

    const csv = await exportReportToCSV(report as ComplianceReport, baseMetadata);
    expect(csv).toContain('SOC 2 Security Report');
    expect(csv).toContain('Access Controls');
    expect(csv).toContain('Audit Log Integrity');
    expect(csv).toContain('Encryption');
    expect(csv).toContain('Security Incidents');
    expect(csv).toContain('physician');
    expect(csv).toContain('unauthorized_access');
  });

  it('exports SOC 2 availability report', async () => {
    const report: SOC2AvailabilityReport = {
      reportType: 'soc2_availability',
      reportId: 'rpt-test-003',
      generatedAt: '2025-02-01T00:00:00.000Z',
      period: { startDate: '2025-01-01T00:00:00.000Z', endDate: '2025-01-31T23:59:59.000Z' },
      tenantId: 'tenant-001',
      uptime: {
        totalUptimePercentage: 99.95, totalDowntimeMinutes: 22,
        incidents: [
          { incidentId: 'inc-1', startTime: '2025-01-15T10:00:00.000Z', durationMinutes: 22, description: 'DB outage' },
        ],
      },
      backupRestore: {
        lastBackupAt: '2025-01-31T03:00:00.000Z', backupFrequency: 'Daily (automated)',
        lastRestoreTest: '2025-01-20T10:00:00.000Z', backupEncryption: true,
      },
      disasterRecovery: {
        drPlanVersion: '1.0.0', lastTestDate: '2025-01-10T10:00:00.000Z',
        rtoMinutes: 60, rpoMinutes: 15,
      },
      summary: {
        uptimePercentage: 99.95, totalDowntimeMinutes: 22,
        backupCompliant: true, drCompliant: true,
      },
    };

    const csv = await exportReportToCSV(report as ComplianceReport, baseMetadata);
    expect(csv).toContain('SOC 2 Availability Report');
    expect(csv).toContain('Uptime');
    expect(csv).toContain('Backup & Restore');
    expect(csv).toContain('Disaster Recovery');
    expect(csv).toContain('99.95');
    expect(csv).toContain('DB outage');
  });

  it('exports consent compliance report', async () => {
    const report: ConsentComplianceReport = {
      reportType: 'consent_compliance',
      reportId: 'rpt-test-004',
      generatedAt: '2025-02-01T00:00:00.000Z',
      period: { startDate: '2025-01-01T00:00:00.000Z', endDate: '2025-01-31T23:59:59.000Z' },
      tenantId: 'tenant-001',
      byState: [
        { stateCode: 'CA', totalConsents: 10, activeConsents: 8, expiredConsents: 1, revokedConsents: 1, requiredLevel: 'written', complianceRate: 80 },
        { stateCode: 'NY', totalConsents: 5, activeConsents: 4, expiredConsents: 1, revokedConsents: 0, requiredLevel: 'explicit', complianceRate: 80 },
      ],
      byTreatment: [
        { treatmentCategory: 'mental_health', totalConsents: 8, activeConsents: 7, expiredConsents: 1, revokedConsents: 0, complianceRate: 87.5 },
      ],
      expiringConsents: [
        { consentId: 'consent-1', patientId: 'patient-1', stateCode: 'CA', category: 'mental_health', expiresAt: '2025-02-15T00:00:00.000Z', daysUntilExpiry: 14 },
      ],
      summary: {
        totalConsents: 15, activeConsents: 12, expiredConsents: 2, revokedConsents: 1,
        expiringWithin30Days: 1, overallComplianceRate: 80, statesCovered: 2,
      },
    };

    const csv = await exportReportToCSV(report as ComplianceReport, baseMetadata);
    expect(csv).toContain('Consent Compliance Report');
    expect(csv).toContain('By State');
    expect(csv).toContain('By Treatment Category');
    expect(csv).toContain('Expiring Consents');
    expect(csv).toContain('CA');
    expect(csv).toContain('NY');
    expect(csv).toContain('mental_health');
  });

  it('exports access review report', async () => {
    const report: AccessReviewReport = {
      reportType: 'access_review',
      reportId: 'rpt-test-005',
      generatedAt: '2025-02-01T00:00:00.000Z',
      period: { startDate: '2025-01-01T00:00:00.000Z', endDate: '2025-01-31T23:59:59.000Z' },
      tenantId: 'tenant-001',
      roleAssignments: [
        { userId: 'user-1', role: 'physician', permissions: ['read_patient', 'write_patient'], assignedAt: '2025-01-01T00:00:00.000Z', active: true },
        { userId: 'user-2', role: 'nurse', permissions: ['read_patient'], assignedAt: '2025-01-15T00:00:00.000Z', active: true },
      ],
      permissionChanges: [
        { changeId: 'chg-1', timestamp: '2025-01-10T10:00:00.000Z', userId: 'user-1', type: 'grant', permission: 'export_phi', role: 'physician' },
        { changeId: 'chg-2', timestamp: '2025-01-20T10:00:00.000Z', userId: 'user-2', type: 'revocation', permission: 'delete_patient', role: 'nurse' },
      ],
      summary: {
        totalActiveAssignments: 2, totalUsers: 2, totalRoles: 2,
        grants: 1, revocations: 1, highRiskPermissions: 1,
      },
    };

    const csv = await exportReportToCSV(report as ComplianceReport, baseMetadata);
    expect(csv).toContain('Access Review Report');
    expect(csv).toContain('Role Assignments');
    expect(csv).toContain('Permission Changes');
    expect(csv).toContain('Summary');
    expect(csv).toContain('physician');
    expect(csv).toContain('export_phi');
  });

  it('includes header with report metadata', async () => {
    const report: HIPAAAuditReport = {
      reportType: 'hipaa_audit',
      reportId: 'rpt-test-006',
      generatedAt: '2025-02-01T00:00:00.000Z',
      period: { startDate: '2025-01-01T00:00:00.000Z', endDate: '2025-01-31T23:59:59.000Z' },
      tenantId: 'tenant-001',
      chainVerification: { valid: true, totalEvents: 0 },
      phiAccessEvents: [], phiModificationEvents: [], breakGlassEvents: [],
      summary: { totalPhiAccess: 0, totalPhiModifications: 0, totalBreakGlass: 0, failedAccess: 0, uniqueUsers: 0, uniquePatients: 0, chainValid: true },
    };

    const csv = await exportReportToCSV(report as ComplianceReport, baseMetadata);
    expect(csv).toContain('# HIPAA Audit Report');
    expect(csv).toContain('# Report ID: rpt-test-006');
    expect(csv).toContain('# Tenant: tenant-001');
  });

  it('escapes commas and quotes in CSV cells', async () => {
    const report: AccessReviewReport = {
      reportType: 'access_review',
      reportId: 'rpt-test-007',
      generatedAt: '2025-02-01T00:00:00.000Z',
      period: { startDate: '2025-01-01T00:00:00.000Z', endDate: '2025-01-31T23:59:59.000Z' },
      tenantId: 'tenant-001',
      roleAssignments: [
        { userId: 'user,1', role: 'physician', permissions: ['read,write'], assignedAt: '2025-01-01T00:00:00.000Z', active: true },
      ],
      permissionChanges: [],
      summary: { totalActiveAssignments: 1, totalUsers: 1, totalRoles: 1, grants: 0, revocations: 0, highRiskPermissions: 0 },
    };

    const csv = await exportReportToCSV(report as ComplianceReport, baseMetadata);
    // Commas in values should be quoted
    expect(csv).toContain('"user,1"');
    expect(csv).toContain('"read,write"');
  });
});
