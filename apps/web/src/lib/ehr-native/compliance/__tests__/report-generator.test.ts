/**
 * Tests for report-generator orchestration core.
 * Mocks AuditLogger, MongoDB, and type-specific generators.
 */

// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuditEvent } from '@/lib/audit/events';

// Mock AuditLogger
const {
  mockVerifyChain,
  mockGetInstance,
  mockFind,
  mockSort,
  mockCollection,
  mockConnect,
  mockGenerateHIPAA,
  mockGenerateSOC2Sec,
  mockGenerateSOC2Avail,
  mockGenerateConsent,
  mockGenerateAccessReview,
} = vi.hoisted(() => {
  const mockVerifyChain = vi.fn();
  const mockGetInstance = vi.fn(() => ({
    verifyChain: mockVerifyChain,
  }));
  const mockFind = vi.fn();
  const mockSort = vi.fn(() => ({ toArray: vi.fn().mockResolvedValue([]) }));
  const mockCollection = vi.fn(() => ({
    find: mockFind.mockReturnValue({ sort: mockSort }),
  }));
  const mockConnect = vi.fn().mockResolvedValue({ collection: mockCollection });
  const mockGenerateHIPAA = vi.fn();
  const mockGenerateSOC2Sec = vi.fn();
  const mockGenerateSOC2Avail = vi.fn();
  const mockGenerateConsent = vi.fn();
  const mockGenerateAccessReview = vi.fn();
  return {
    mockVerifyChain,
    mockGetInstance,
    mockFind,
    mockSort,
    mockCollection,
    mockConnect,
    mockGenerateHIPAA,
    mockGenerateSOC2Sec,
    mockGenerateSOC2Avail,
    mockGenerateConsent,
    mockGenerateAccessReview,
  };
});

vi.mock('@/lib/audit/logger', () => ({
  AuditLogger: {
    getInstance: mockGetInstance,
  },
}));

vi.mock('@/config/mongodb.config', () => ({
  mongodb: { connect: mockConnect },
}));

vi.mock('../hipaa-report', () => ({
  generateHIPAAAuditReport: mockGenerateHIPAA,
}));
vi.mock('../soc2-report', () => ({
  generateSOC2SecurityReport: mockGenerateSOC2Sec,
  generateSOC2AvailabilityReport: mockGenerateSOC2Avail,
}));
vi.mock('../consent-compliance-report', () => ({
  generateConsentComplianceReport: mockGenerateConsent,
}));
vi.mock('../access-review-report', () => ({
  generateAccessReviewReport: mockGenerateAccessReview,
}));

// Import after mocks are set up
import {
  generateReportId,
  generateReport,
  verifyAuditChain,
  queryAuditEvents,
  computePeriodForSchedule,
  loadTemplate,
  runScheduledReport,
} from '../report-generator';
import type { ReportRequest, ScheduledReportConfig } from '../types';

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyChain.mockResolvedValue({ valid: true, brokenAtIndex: undefined, brokenAtId: undefined, reason: undefined });
});

describe('generateReportId', () => {
  it('generates unique IDs for same type', () => {
    const id1 = generateReportId('hipaa_audit');
    const id2 = generateReportId('hipaa_audit');
    expect(id1).not.toBe(id2);
    expect(id1).toContain('rpt-hipaa_audit-');
    expect(id2).toContain('rpt-hipaa_audit-');
  });

  it('includes report type in ID', () => {
    const id = generateReportId('soc2_security');
    expect(id).toContain('soc2_security');
  });
});

describe('verifyAuditChain', () => {
  it('returns valid chain result when verifyChain succeeds', async () => {
    const result = await verifyAuditChain();
    expect(result.valid).toBe(true);
    expect(result.totalEvents).toBe(0);
    expect(mockVerifyChain).toHaveBeenCalledOnce();
  });

  it('returns invalid chain result when verifyChain fails', async () => {
    mockVerifyChain.mockResolvedValue({
      valid: false, brokenAtIndex: 5, brokenAtId: 'evt-5', reason: 'Hash mismatch',
    });
    const result = await verifyAuditChain();
    expect(result.valid).toBe(false);
    expect(result.brokenAtIndex).toBe(5);
    expect(result.brokenAtId).toBe('evt-5');
    expect(result.reason).toBe('Hash mismatch');
  });
});

describe('queryAuditEvents', () => {
  it('queries MongoDB with date range filter', async () => {
    await queryAuditEvents('2025-01-01T00:00:00.000Z', '2025-01-31T23:59:59.000Z');
    expect(mockConnect).toHaveBeenCalled();
    expect(mockCollection).toHaveBeenCalledWith('audit_logs');
    expect(mockFind).toHaveBeenCalled();
  });

  it('adds tenant filter when tenantId is provided', async () => {
    await queryAuditEvents('2025-01-01', '2025-01-31', 'tenant-001');
    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        'metadata.tenantId': 'tenant-001',
      }),
    );
  });

  it('omits tenant filter when tenantId is not provided', async () => {
    await queryAuditEvents('2025-01-01', '2025-01-31');
    const filter = mockFind.mock.calls[0][0] as Record<string, unknown>;
    expect(filter).not.toHaveProperty('metadata.tenantId');
  });

  it('maps MongoDB docs to AuditEvent shape', async () => {
    const mockDocs = [
      {
        _id: 'doc1', timestamp: new Date('2025-01-15T10:00:00.000Z'),
        userId: 'user-1', type: 'ACCESS', action: 'patient_view',
        severity: 'INFO', status: 'success',
        resourceId: 'patient-1', resourceType: 'Patient',
      },
    ];
    // Override the mock for this test
    mockFind.mockReturnValueOnce({
      sort: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mockDocs),
      }),
    });

    const events = await queryAuditEvents('2025-01-01', '2025-01-31');
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe('doc1');
    expect(events[0].userId).toBe('user-1');
    expect(events[0].action).toBe('patient_view');
  });
});

describe('computePeriodForSchedule', () => {
  it('computes monthly period as last 30 days', () => {
    const now = new Date('2025-02-15T10:00:00.000Z');
    const period = computePeriodForSchedule('monthly', now);
    expect(period.endDate).toBe(now.toISOString());
    const start = new Date(period.startDate);
    expect(start.getMonth()).toBe(now.getMonth() - 1); // 1 month back
  });

  it('computes quarterly period as last 3 months', () => {
    const now = new Date('2025-03-15T10:00:00.000Z');
    const period = computePeriodForSchedule('quarterly', now);
    const start = new Date(period.startDate);
    const expectedStart = new Date(now);
    expectedStart.setMonth(expectedStart.getMonth() - 3);
    expect(start.getTime()).toBe(expectedStart.getTime());
  });

  it('computes annual period as last year', () => {
    const now = new Date('2025-06-15T10:00:00.000Z');
    const period = computePeriodForSchedule('annual', now);
    const start = new Date(period.startDate);
    const expectedStart = new Date(now);
    expectedStart.setFullYear(expectedStart.getFullYear() - 1);
    expect(start.getTime()).toBe(expectedStart.getTime());
  });

  it('computes ad-hoc period as last 30 days', () => {
    const now = new Date('2025-02-15T10:00:00.000Z');
    const period = computePeriodForSchedule('ad-hoc', now);
    const start = new Date(period.startDate);
    const expectedStart = new Date(now);
    expectedStart.setDate(expectedStart.getDate() - 30);
    expect(start.getTime()).toBe(expectedStart.getTime());
  });
});

describe('loadTemplate', () => {
  it('loads hipaa_audit template', async () => {
    const template = await loadTemplate('hipaa_audit');
    expect(template).toBeDefined();
    expect(template.templateId).toBe('tpl-hipaa-audit-v1');
    expect(template.schemaVersion).toBe('1.0.0');
  });

  it('caches templates on second call', async () => {
    const t1 = await loadTemplate('soc2_security');
    const t2 = await loadTemplate('soc2_security');
    expect(t1).toBe(t2); // Same object reference (cached)
  });
});

describe('generateReport', () => {
  const baseRequest: ReportRequest = {
    type: 'hipaa_audit',
    period: { startDate: '2025-01-01T00:00:00.000Z', endDate: '2025-01-31T23:59:59.000Z' },
    tenantId: 'tenant-001',
    requestedBy: 'test-user',
  };

  it('generates HIPAA audit report', async () => {
    mockGenerateHIPAA.mockResolvedValue({
      reportType: 'hipaa_audit', reportId: '', generatedAt: new Date().toISOString(),
      period: baseRequest.period, tenantId: 'tenant-001',
      chainVerification: { valid: true, totalEvents: 0 },
      phiAccessEvents: [], phiModificationEvents: [], breakGlassEvents: [],
      summary: { totalPhiAccess: 0, totalPhiModifications: 0, totalBreakGlass: 0, failedAccess: 0, uniqueUsers: 0, uniquePatients: 0, chainValid: true },
    });

    const { report, metadata } = await generateReport(baseRequest);
    expect(report.reportType).toBe('hipaa_audit');
    expect(metadata.type).toBe('hipaa_audit');
    expect(metadata.reportId).toContain('rpt-hipaa_audit-');
    expect(report.reportId).toBe(metadata.reportId);
    expect(mockGenerateHIPAA).toHaveBeenCalledOnce();
  });

  it('generates SOC 2 security report', async () => {
    mockGenerateSOC2Sec.mockResolvedValue({
      reportType: 'soc2_security', reportId: '', generatedAt: new Date().toISOString(),
      period: baseRequest.period, tenantId: 'tenant-001',
      accessControls: { totalUsers: 0, roleAssignments: [], permissionGrants: 0, permissionRevocations: 0, mfaRequiredPermissions: 0 },
      auditLogIntegrity: { valid: true, totalEvents: 0 },
      encryption: { dataInTransit: true, dataAtRest: true, auditLogHashing: true, algorithm: 'test' },
      incidents: [],
      summary: { totalAccessEvents: 0, totalSecurityEvents: 0, failedAccessAttempts: 0, chainValid: true, encryptionCompliant: true, openIncidents: 0 },
    });

    const { report, metadata } = await generateReport({ ...baseRequest, type: 'soc2_security' });
    expect(report.reportType).toBe('soc2_security');
    expect(metadata.type).toBe('soc2_security');
    expect(mockGenerateSOC2Sec).toHaveBeenCalledOnce();
  });

  it('generates SOC 2 availability report', async () => {
    mockGenerateSOC2Avail.mockResolvedValue({
      reportType: 'soc2_availability', reportId: '', generatedAt: new Date().toISOString(),
      period: baseRequest.period, tenantId: 'tenant-001',
      uptime: { totalUptimePercentage: 99.9, totalDowntimeMinutes: 0, incidents: [] },
      backupRestore: { lastBackupAt: new Date().toISOString(), backupFrequency: 'Daily', backupEncryption: true },
      disasterRecovery: { drPlanVersion: '1.0.0', rtoMinutes: 60, rpoMinutes: 15 },
      summary: { uptimePercentage: 99.9, totalDowntimeMinutes: 0, backupCompliant: true, drCompliant: true },
    });

    const { report, metadata } = await generateReport({ ...baseRequest, type: 'soc2_availability' });
    expect(report.reportType).toBe('soc2_availability');
    expect(metadata.type).toBe('soc2_availability');
    expect(mockGenerateSOC2Avail).toHaveBeenCalledOnce();
  });

  it('generates consent compliance report', async () => {
    mockGenerateConsent.mockResolvedValue({
      reportType: 'consent_compliance', reportId: '', generatedAt: new Date().toISOString(),
      period: baseRequest.period, tenantId: 'tenant-001',
      byState: [], byTreatment: [], expiringConsents: [],
      summary: { totalConsents: 0, activeConsents: 0, expiredConsents: 0, revokedConsents: 0, expiringWithin30Days: 0, overallComplianceRate: 0, statesCovered: 0 },
    });

    const { report, metadata } = await generateReport({ ...baseRequest, type: 'consent_compliance' });
    expect(report.reportType).toBe('consent_compliance');
    expect(metadata.type).toBe('consent_compliance');
    expect(mockGenerateConsent).toHaveBeenCalledOnce();
  });

  it('generates access review report', async () => {
    mockGenerateAccessReview.mockResolvedValue({
      reportType: 'access_review', reportId: '', generatedAt: new Date().toISOString(),
      period: baseRequest.period, tenantId: 'tenant-001',
      roleAssignments: [], permissionChanges: [],
      summary: { totalActiveAssignments: 0, totalUsers: 0, totalRoles: 0, grants: 0, revocations: 0, highRiskPermissions: 0 },
    });

    const { report, metadata } = await generateReport({ ...baseRequest, type: 'access_review' });
    expect(report.reportType).toBe('access_review');
    expect(metadata.type).toBe('access_review');
    expect(mockGenerateAccessReview).toHaveBeenCalledOnce();
  });

  it('sets metadata format from request', async () => {
    mockGenerateHIPAA.mockResolvedValue({
      reportType: 'hipaa_audit', reportId: '', generatedAt: new Date().toISOString(),
      period: baseRequest.period, tenantId: 'tenant-001',
      chainVerification: { valid: true, totalEvents: 0 },
      phiAccessEvents: [], phiModificationEvents: [], breakGlassEvents: [],
      summary: { totalPhiAccess: 0, totalPhiModifications: 0, totalBreakGlass: 0, failedAccess: 0, uniqueUsers: 0, uniquePatients: 0, chainValid: true },
    });

    const { metadata } = await generateReport({ ...baseRequest, format: 'pdf' });
    expect(metadata.format).toBe('pdf');
  });

  it('defaults format to json when not specified', async () => {
    mockGenerateHIPAA.mockResolvedValue({
      reportType: 'hipaa_audit', reportId: '', generatedAt: new Date().toISOString(),
      period: baseRequest.period, tenantId: 'tenant-001',
      chainVerification: { valid: true, totalEvents: 0 },
      phiAccessEvents: [], phiModificationEvents: [], breakGlassEvents: [],
      summary: { totalPhiAccess: 0, totalPhiModifications: 0, totalBreakGlass: 0, failedAccess: 0, uniqueUsers: 0, uniquePatients: 0, chainValid: true },
    });

    const { metadata } = await generateReport(baseRequest);
    expect(metadata.format).toBe('json');
  });
});

describe('runScheduledReport', () => {
  it('generates report using scheduled config', async () => {
    mockGenerateHIPAA.mockResolvedValue({
      reportType: 'hipaa_audit', reportId: '', generatedAt: new Date().toISOString(),
      period: { startDate: '2025-01-01', endDate: '2025-02-01' },
      tenantId: 'tenant-001',
      chainVerification: { valid: true, totalEvents: 0 },
      phiAccessEvents: [], phiModificationEvents: [], breakGlassEvents: [],
      summary: { totalPhiAccess: 0, totalPhiModifications: 0, totalBreakGlass: 0, failedAccess: 0, uniqueUsers: 0, uniquePatients: 0, chainValid: true },
    });

    const config: ScheduledReportConfig = {
      scheduleId: 'sch-001',
      type: 'hipaa_audit',
      schedule: 'monthly',
      tenantId: 'tenant-001',
      emailRecipients: ['admin@example.com'],
      format: 'pdf',
      dayOfMonth: 1,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const metadata = await runScheduledReport(config);
    expect(metadata.type).toBe('hipaa_audit');
    expect(metadata.tenantId).toBe('tenant-001');
    expect(metadata.generatedBy).toBe('system-scheduler');
  });
});
