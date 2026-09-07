/**
 * Tests for consent compliance report generator.
 * Mocks PostgreSQL query to test report building logic.
 */

// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @/lib/db
const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));
vi.mock('@/lib/db', () => ({
  query: mockQuery,
  transaction: vi.fn(),
}));

import { generateConsentComplianceReport } from '../consent-compliance-report';
import type { ReportPeriod } from '../types';

const period: ReportPeriod = {
  startDate: '2025-01-01T00:00:00.000Z',
  endDate: '2025-01-31T23:59:59.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

function makeConsentRow(overrides: Record<string, string> = {}) {
  return {
    consent_id: 'consent-1',
    tenant_id: 'tenant-001',
    patient_id: 'patient-1',
    status: 'active',
    scope: 'mental_health:CA',
    category: 'mental_health',
    consent_level: 'written',
    period_start: '2025-01-01T00:00:00.000Z',
    period_end: '2025-12-31T23:59:59.000Z',
    created_at: '2025-01-15T00:00:00.000Z',
    updated_at: '2025-01-15T00:00:00.000Z',
    ...overrides,
  };
}

describe('generateConsentComplianceReport', () => {
  it('builds report from consent records', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        makeConsentRow({ consent_id: 'c1', patient_id: 'p1', status: 'active', scope: 'mental_health:CA' }),
        makeConsentRow({ consent_id: 'c2', patient_id: 'p2', status: 'expired', scope: 'mental_health:CA' }),
        makeConsentRow({ consent_id: 'c3', patient_id: 'p3', status: 'revoked', scope: 'general:NY' }),
      ],
    });

    const report = await generateConsentComplianceReport(period, 'tenant-001');
    expect(report.reportType).toBe('consent_compliance');
    expect(report.summary.totalConsents).toBe(3);
    expect(report.summary.activeConsents).toBe(1);
    expect(report.summary.expiredConsents).toBe(1);
    expect(report.summary.revokedConsents).toBe(1);
  });

  it('groups by state code', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        makeConsentRow({ consent_id: 'c1', status: 'active', scope: 'mental_health:CA' }),
        makeConsentRow({ consent_id: 'c2', status: 'active', scope: 'general:CA' }),
        makeConsentRow({ consent_id: 'c3', status: 'expired', scope: 'mental_health:NY' }),
      ],
    });

    const report = await generateConsentComplianceReport(period, 'tenant-001');
    expect(report.byState).toHaveLength(2);
    const ca = report.byState.find((s) => s.stateCode === 'CA');
    expect(ca).toBeDefined();
    expect(ca?.totalConsents).toBe(2);
    expect(ca?.activeConsents).toBe(2);
    const ny = report.byState.find((s) => s.stateCode === 'NY');
    expect(ny?.totalConsents).toBe(1);
    expect(ny?.expiredConsents).toBe(1);
  });

  it('groups by treatment category', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        makeConsentRow({ consent_id: 'c1', status: 'active', category: 'mental_health' }),
        makeConsentRow({ consent_id: 'c2', status: 'active', category: 'mental_health' }),
        makeConsentRow({ consent_id: 'c3', status: 'expired', category: 'substance_abuse' }),
      ],
    });

    const report = await generateConsentComplianceReport(period, 'tenant-001');
    expect(report.byTreatment).toHaveLength(2);
    const mh = report.byTreatment.find((t) => t.treatmentCategory === 'mental_health');
    expect(mh?.totalConsents).toBe(2);
    const sa = report.byTreatment.find((t) => t.treatmentCategory === 'substance_abuse');
    expect(sa?.totalConsents).toBe(1);
  });

  it('computes compliance rate', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        makeConsentRow({ consent_id: 'c1', status: 'active' }),
        makeConsentRow({ consent_id: 'c2', status: 'active' }),
        makeConsentRow({ consent_id: 'c3', status: 'expired' }),
        makeConsentRow({ consent_id: 'c4', status: 'revoked' }),
      ],
    });

    const report = await generateConsentComplianceReport(period, 'tenant-001');
    // 2 active out of 4 total = 50%
    expect(report.summary.overallComplianceRate).toBe(50);
  });

  it('handles zero consents', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const report = await generateConsentComplianceReport(period, 'tenant-001');
    expect(report.summary.totalConsents).toBe(0);
    expect(report.summary.overallComplianceRate).toBe(0);
    expect(report.byState).toHaveLength(0);
    expect(report.byTreatment).toHaveLength(0);
    expect(report.expiringConsents).toHaveLength(0);
  });

  it('finds expiring consents within 30 days', async () => {
    const now = new Date();
    const in15days = new Date(now);
    in15days.setDate(in15days.getDate() + 15);
    const in45days = new Date(now);
    in45days.setDate(in45days.getDate() + 45);

    mockQuery.mockResolvedValue({
      rows: [
        makeConsentRow({
          consent_id: 'c1', status: 'active',
          period_end: in15days.toISOString(),
        }),
        makeConsentRow({
          consent_id: 'c2', status: 'active',
          period_end: in45days.toISOString(),
        }),
        makeConsentRow({
          consent_id: 'c3', status: 'expired',
          period_end: in15days.toISOString(),
        }),
      ],
    });

    const report = await generateConsentComplianceReport(period, 'tenant-001');
    // Only c1 is active AND expires within 30 days; c2 is too far, c3 is expired
    expect(report.expiringConsents).toHaveLength(1);
    expect(report.expiringConsents[0].consentId).toBe('c1');
    expect(report.expiringConsents[0].daysUntilExpiry).toBeLessThanOrEqual(15);
  });

  it('uses unknown state code when scope has no state', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        makeConsentRow({ consent_id: 'c1', scope: 'mental_health' }),
      ],
    });

    const report = await generateConsentComplianceReport(period, 'tenant-001');
    expect(report.byState).toHaveLength(1);
    expect(report.byState[0].stateCode).toBe('unknown');
  });

  it('determines required level from observed levels', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        makeConsentRow({ consent_id: 'c1', status: 'active', consent_level: 'implicit' }),
        makeConsentRow({ consent_id: 'c2', status: 'active', consent_level: 'written' }),
      ],
    });

    const report = await generateConsentComplianceReport(period, 'tenant-001');
    // 'written' has highest priority
    expect(report.byState[0].requiredLevel).toBe('written');
  });
});
