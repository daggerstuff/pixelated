/**
 * Consent Compliance Report Generator
 *
 * Generates a consent compliance report broken down by US state and
 * treatment category, with expiring consent tracking and overall
 * compliance rate computation.
 */

import type {
  ReportPeriod,
  ConsentComplianceReport,
  ConsentByState,
  ConsentByTreatment,
  ExpiringConsent,
  ConsentComplianceSummary,
} from './types';

import { query } from '@/lib/db';
import type { QueryResultRow } from 'pg';

// ---------------------------------------------------------------------------
// Consent row from PostgreSQL (matches ConsentRow from consent/repository.ts)
// ---------------------------------------------------------------------------

interface ConsentRecord extends QueryResultRow {
  consent_id: string;
  tenant_id: string;
  patient_id: string;
  status: string; // active | expired | revoked | inactive
  scope: string;
  category: string;
  consent_level: string; // implicit | explicit | written
  period_start: string;
  period_end: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// SQL queries
// ---------------------------------------------------------------------------

const BASE_QUERY = `
  SELECT consent_id, tenant_id, patient_id, status, scope, category,
         consent_level, period_start, period_end, created_at, updated_at
  FROM ehr_consent
  WHERE tenant_id = $1
    AND updated_at >= $2
    AND updated_at <= $3
  ORDER BY created_at ASC
`;

// ---------------------------------------------------------------------------
// Report builders
// ---------------------------------------------------------------------------

/**
 * Extract state code from consent metadata.
 * The FHIR Consent resource may carry state in the provision.period or
 * in a patient's address. We use the patient_id → state_code mapping
 * from the consent scope if available, or default to 'unknown'.
 *
 * In production this would join to patient demographics. For now we
 * extract state from the consent scope field which may contain a
 * state code suffix (e.g., "mental_health:CA").
 */
function extractStateCode(consent: ConsentRecord): string {
  // Try to extract from scope — format may be "category:STATE"
  if (consent.scope) {
    const parts = consent.scope.split(':');
    if (parts.length >= 2 && parts[parts.length - 1]?.length === 2) {
      return parts[parts.length - 1].toUpperCase();
    }
  }
  return 'unknown';
}

/**
 * Build the by-state breakdown.
 */
function buildByState(consents: ConsentRecord[]): ConsentByState[] {
  const stateMap = new Map<string, ConsentRecord[]>();

  for (const consent of consents) {
    const state = extractStateCode(consent);
    if (!stateMap.has(state)) stateMap.set(state, []);
    stateMap.get(state)!.push(consent);
  }

  const result: ConsentByState[] = [];
  for (const [stateCode, records] of stateMap) {
    const total = records.length;
    const active = records.filter((r) => r.status === 'active').length;
    const expired = records.filter((r) => r.status === 'expired').length;
    const revoked = records.filter((r) => r.status === 'revoked').length;

    // Determine the required consent level for this state
    const levels = records.map((r) => r.consent_level);
    const requiredLevel = determineRequiredLevel(levels);

    const complianceRate = total > 0
      ? Math.round((active / total) * 10000) / 100
      : 0;

    result.push({
      stateCode,
      totalConsents: total,
      activeConsents: active,
      expiredConsents: expired,
      revokedConsents: revoked,
      requiredLevel,
      complianceRate,
    });
  }

  // Sort by state code
  result.sort((a, b) => a.stateCode.localeCompare(b.stateCode));
  return result;
}

/**
 * Build the by-treatment-category breakdown.
 */
function buildByTreatment(consents: ConsentRecord[]): ConsentByTreatment[] {
  const categoryMap = new Map<string, ConsentRecord[]>();

  for (const consent of consents) {
    const category = consent.category || 'general';
    if (!categoryMap.has(category)) categoryMap.set(category, []);
    categoryMap.get(category)!.push(consent);
  }

  const result: ConsentByTreatment[] = [];
  for (const [treatmentCategory, records] of categoryMap) {
    const total = records.length;
    const active = records.filter((r) => r.status === 'active').length;
    const expired = records.filter((r) => r.status === 'expired').length;
    const revoked = records.filter((r) => r.status === 'revoked').length;
    const complianceRate = total > 0
      ? Math.round((active / total) * 10000) / 100
      : 0;

    result.push({
      treatmentCategory,
      totalConsents: total,
      activeConsents: active,
      expiredConsents: expired,
      revokedConsents: revoked,
      complianceRate,
    });
  }

  result.sort((a, b) => a.treatmentCategory.localeCompare(b.treatmentCategory));
  return result;
}

/**
 * Find consents expiring within 30 days.
 */
function buildExpiringConsents(consents: ConsentRecord[], now: Date): ExpiringConsent[] {
  const thirtyDaysFromNow = new Date(now);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const expiring: ExpiringConsent[] = [];

  for (const consent of consents) {
    if (consent.status !== 'active') continue;
    const periodEnd = new Date(consent.period_end);
    if (periodEnd <= thirtyDaysFromNow && periodEnd >= now) {
      const daysUntilExpiry = Math.ceil(
        (periodEnd.getTime() - now.getTime()) / 86400000,
      );
      expiring.push({
        consentId: consent.consent_id,
        patientId: consent.patient_id,
        stateCode: extractStateCode(consent),
        category: consent.category || 'general',
        expiresAt: consent.period_end,
        daysUntilExpiry,
      });
    }
  }

  expiring.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  return expiring;
}

/**
 * Determine the effective required consent level from observed levels.
 * Returns the highest security level required.
 */
function determineRequiredLevel(levels: string[]): string {
  const priority = ['written', 'explicit', 'implicit'];
  for (const level of priority) {
    if (levels.includes(level)) return level;
  }
  return 'implicit';
}

/**
 * Build overall compliance summary.
 */
function buildSummary(
  consents: ConsentRecord[],
  byState: ConsentByState[],
  expiring: ExpiringConsent[],
): ConsentComplianceSummary {
  const total = consents.length;
  const active = consents.filter((c) => c.status === 'active').length;
  const expired = consents.filter((c) => c.status === 'expired').length;
  const revoked = consents.filter((c) => c.status === 'revoked').length;
  const overallRate = total > 0
    ? Math.round((active / total) * 10000) / 100
    : 0;

  return {
    totalConsents: total,
    activeConsents: active,
    expiredConsents: expired,
    revokedConsents: revoked,
    expiringWithin30Days: expiring.length,
    overallComplianceRate: overallRate,
    statesCovered: byState.length,
  };
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

export async function generateConsentComplianceReport(
  period: ReportPeriod,
  tenantId: string,
): Promise<ConsentComplianceReport> {
  // Query consent records from PostgreSQL
  const result = await query<ConsentRecord>(BASE_QUERY, [
    tenantId,
    period.startDate,
    period.endDate,
  ]);

  const consents = result.rows;
  const now = new Date();

  const byState = buildByState(consents);
  const byTreatment = buildByTreatment(consents);
  const expiringConsents = buildExpiringConsents(consents, now);
  const summary = buildSummary(consents, byState, expiringConsents);

  return {
    reportType: 'consent_compliance',
    reportId: '',
    generatedAt: now.toISOString(),
    period,
    tenantId,
    byState,
    byTreatment,
    expiringConsents,
    summary,
  };
}
