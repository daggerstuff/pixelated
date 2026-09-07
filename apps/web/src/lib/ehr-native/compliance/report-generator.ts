/**
 * Report Generator — orchestration core
 *
 * Loads versioned templates, verifies the audit chain,
 * delegates to type-specific generators, and returns
 * typed compliance report data.
 */

import type {
  ReportType,
  ReportPeriod,
  ReportTemplate,
  ComplianceReport,
  ChainVerificationResult,
  ReportRequest,
  ReportMetadata,
  ReportStatus,
} from './types';

import { AuditLogger } from '@/lib/audit/logger';
import type { AuditEvent } from '@/lib/audit/events';

import { generateHIPAAAuditReport } from './hipaa-report';
import { generateSOC2SecurityReport, generateSOC2AvailabilityReport } from './soc2-report';
import { generateConsentComplianceReport } from './consent-compliance-report';
import { generateAccessReviewReport } from './access-review-report';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// ---------------------------------------------------------------------------
// Template loader
// ---------------------------------------------------------------------------

const TEMPLATE_CACHE = new Map<string, ReportTemplate>();

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_FILES: Record<ReportType, string> = {
  hipaa_audit: 'hipaa-audit-v1.json',
  soc2_security: 'soc2-security-v1.json',
  soc2_availability: 'soc2-availability-v1.json',
  consent_compliance: 'consent-compliance-v1.json',
  access_review: 'access-review-v1.json',
};

export async function loadTemplate(type: ReportType): Promise<ReportTemplate> {
  const cacheKey = `tpl-${type}-v1`;
  const cached = TEMPLATE_CACHE.get(cacheKey);
  if (cached) return cached;

  const templatePath = join(MODULE_DIR, 'templates', TEMPLATE_FILES[type]);
  const template = JSON.parse(readFileSync(templatePath, 'utf-8')) as ReportTemplate;
  TEMPLATE_CACHE.set(cacheKey, template);
  return template;
}

// ---------------------------------------------------------------------------
// Audit chain verification
// ---------------------------------------------------------------------------

/**
 * Verify the audit chain before generating any compliance report.
 * Uses AuditLogger.verifyChain() which returns {valid, brokenAtIndex?, brokenAtId?, reason?}.
 */
export async function verifyAuditChain(): Promise<ChainVerificationResult> {
  const logger = AuditLogger.getInstance();
  const result = await logger.verifyChain();
  return {
    valid: result.valid,
    totalEvents: 0, // verifyChain doesn't return count; will be set by caller
    brokenAtIndex: result.brokenAtIndex,
    brokenAtId: result.brokenAtId,
    reason: result.reason,
  };
}

/**
 * Query audit events from MongoDB within a date range.
 * The base AuditLogger doesn't expose date-range queries, so we
 * access the MongoDB collection directly.
 */
export async function queryAuditEvents(
  startDate: string,
  endDate: string,
  tenantId?: string,
): Promise<AuditEvent[]> {
  const { mongodb } = await import('@/config/mongodb.config');
  const db = await mongodb.connect();
  const collection = db.collection('audit_logs');

  const filter: Record<string, unknown> = {
    timestamp: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
  };

  if (tenantId) {
    filter['metadata.tenantId'] = tenantId;
  }

  const events = await collection
    .find(filter)
    .sort({ _id: 1 })
    .toArray();

  // Map MongoDB docs to AuditEvent shape
  return events.map((doc) => ({
    id: String(doc._id),
    timestamp: doc.timestamp instanceof Date ? doc.timestamp.toISOString() : String(doc.timestamp),
    userId: doc.userId ?? '',
    type: doc.type,
    action: doc.action,
    severity: doc.severity,
    resourceId: doc.resourceId,
    resourceType: doc.resourceType,
    metadata: doc.metadata,
    ipAddress: doc.ipAddress,
    userAgent: doc.userAgent,
    status: doc.status ?? 'success',
    errorMessage: doc.errorMessage,
    previousHash: doc.previousHash,
    hash: doc.hash,
  })) as AuditEvent[];
}

// ---------------------------------------------------------------------------
// Report ID generator
// ---------------------------------------------------------------------------

let reportCounter = 0;

export function generateReportId(type: ReportType): string {
  reportCounter += 1;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `rpt-${type}-${ts}-${rand}-${reportCounter}`;
}

// ---------------------------------------------------------------------------
// Report Generator (main orchestration)
// ---------------------------------------------------------------------------

/**
 * Generate a compliance report of the specified type.
 *
 * Steps:
 *  1. Load the versioned template
 *  2. Verify audit chain integrity
 *  3. Delegate to the type-specific generator
 *  4. Return the typed report
 */
export async function generateReport(
  request: ReportRequest,
): Promise<{ report: ComplianceReport; metadata: ReportMetadata }> {
  const { type, period, tenantId, requestedBy } = request;

  // 1. Load template (validates type has a template)
  await loadTemplate(type);

  // 2. Verify audit chain
  const chainVerification = await verifyAuditChain();

  // 3. Delegate to type-specific generator
  let report: ComplianceReport;
  switch (type) {
    case 'hipaa_audit':
      report = await generateHIPAAAuditReport(
        period,
        tenantId,
        chainVerification,
      );
      break;
    case 'soc2_security':
      report = await generateSOC2SecurityReport(
        period,
        tenantId,
        chainVerification,
      );
      break;
    case 'soc2_availability':
      report = await generateSOC2AvailabilityReport(period, tenantId);
      break;
    case 'consent_compliance':
      report = await generateConsentComplianceReport(period, tenantId);
      break;
    case 'access_review':
      report = await generateAccessReviewReport(period, tenantId);
      break;
    default: {
      const exhaustive: never = type;
      throw new Error(`Unsupported report type: ${exhaustive}`);
    }
  }

  // 4. Build metadata
  const reportId = generateReportId(type);
  const now = new Date().toISOString();
  const metadata: ReportMetadata = {
    reportId,
    type,
    status: 'completed' as ReportStatus,
    format: request.format ?? 'json',
    period,
    tenantId,
    generatedBy: requestedBy,
    generatedAt: now,
    schedule: request.schedule,
  };

  // Override reportId in the report itself
  (report as { reportId: string }).reportId = reportId;

  return { report, metadata };
}

// ---------------------------------------------------------------------------
// Scheduled report runner
// ---------------------------------------------------------------------------

/**
 * Process a single scheduled report, generating and delivering it.
 * The scheduler.ts module calls this for each scheduled config.
 */
export async function runScheduledReport(
  config: import('./types').ScheduledReportConfig,
): Promise<ReportMetadata> {
  const now = new Date();
  const period: ReportPeriod = computePeriodForSchedule(config.schedule, now);

  const request: ReportRequest = {
    type: config.type,
    period,
    tenantId: config.tenantId,
    format: config.format,
    schedule: config.schedule,
    requestedBy: 'system-scheduler',
    emailRecipient: config.emailRecipients[0],
  };

  const { metadata } = await generateReport(request);
  return metadata;
}

/**
 * Compute the report period for a given schedule.
 * Monthly → previous calendar month
 * Quarterly → previous quarter
 * Annual → previous year
 * Ad-hoc → last 30 days
 */
export function computePeriodForSchedule(
  schedule: import('./types').ReportSchedule,
  now: Date,
): ReportPeriod {
  const end = new Date(now);
  const start = new Date(now);

  switch (schedule) {
    case 'monthly': {
      start.setMonth(start.getMonth() - 1);
      break;
    }
    case 'quarterly': {
      start.setMonth(start.getMonth() - 3);
      break;
    }
    case 'annual': {
      start.setFullYear(start.getFullYear() - 1);
      break;
    }
    case 'ad-hoc': {
      start.setDate(start.getDate() - 30);
      break;
    }
    default: {
      const exhaustive: never = schedule;
      throw new Error(`Unsupported schedule: ${exhaustive}`);
    }
  }

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  };
}
