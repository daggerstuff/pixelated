/**
 * Compliance Report Scheduler
 *
 * Manages scheduled compliance report generation and email delivery.
 * Supports monthly, quarterly, and annual schedules.
 * Uses a simple in-memory store for scheduled configs; production
 * implementations would persist to PostgreSQL.
 */

import type {
  ReportType,
  ReportSchedule,
  ScheduledReportConfig,
  ReportMetadata,
  ReportFormat,
} from './types';
import { runScheduledReport } from './report-generator';
import { exportReportToPDF } from './export/pdf-exporter';
import { exportReportToCSV } from './export/csv-exporter';

// ---------------------------------------------------------------------------
// Scheduled report store (in-memory; replace with DB in production)
// ---------------------------------------------------------------------------

const SCHEDULED_REPORTS = new Map<string, ScheduledReportConfig>();

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

/**
 * Create a new scheduled report configuration.
 */
export function createScheduledReport(
  type: ReportType,
  schedule: ReportSchedule,
  tenantId: string,
  emailRecipients: string[],
  format: ReportFormat = 'pdf',
  dayOfMonth: number = 1,
): ScheduledReportConfig {
  const scheduleId = `sch-${type}-${Date.now().toString(36)}`;
  const now = new Date().toISOString();

  const config: ScheduledReportConfig = {
    scheduleId,
    type,
    schedule,
    tenantId,
    emailRecipients,
    format,
    dayOfMonth,
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  SCHEDULED_REPORTS.set(scheduleId, config);
  return config;
}

/**
 * List all scheduled reports, optionally filtered by tenant.
 */
export function listScheduledReports(tenantId?: string): ScheduledReportConfig[] {
  const all = Array.from(SCHEDULED_REPORTS.values());
  if (tenantId) {
    return all.filter((c) => c.tenantId === tenantId);
  }
  return all;
}

/**
 * Get a scheduled report by ID.
 */
export function getScheduledReport(scheduleId: string): ScheduledReportConfig | undefined {
  return SCHEDULED_REPORTS.get(scheduleId);
}

/**
 * Update a scheduled report.
 */
export function updateScheduledReport(
  scheduleId: string,
  updates: Partial<Omit<ScheduledReportConfig, 'scheduleId' | 'createdAt'>>,
): ScheduledReportConfig | undefined {
  const existing = SCHEDULED_REPORTS.get(scheduleId);
  if (!existing) return undefined;

  const updated: ScheduledReportConfig = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  SCHEDULED_REPORTS.set(scheduleId, updated);
  return updated;
}

/**
 * Delete a scheduled report.
 */
export function deleteScheduledReport(scheduleId: string): boolean {
  return SCHEDULED_REPORTS.delete(scheduleId);
}

// ---------------------------------------------------------------------------
// Scheduler execution
// ---------------------------------------------------------------------------

/**
 * Process all due scheduled reports.
 * Called by a cron job or interval timer.
 *
 * Returns metadata for each successfully generated report.
 */
export async function processScheduledReports(
  now: Date = new Date(),
): Promise<ReportMetadata[]> {
  const results: ReportMetadata[] = [];

  for (const config of SCHEDULED_REPORTS.values()) {
    if (!config.active) continue;
    if (!isReportDue(config, now)) continue;

    try {
      const metadata = await runScheduledReport(config);

      // Deliver via email
      await deliverReportByEmail(config, metadata);

      results.push(metadata);
    } catch (error) {
      // Log and continue — one failure shouldn't stop others
      console.error(
        `[compliance-scheduler] Failed to generate scheduled report ${config.scheduleId}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return results;
}

/**
 * Check if a scheduled report is due for generation.
 */
function isReportDue(config: ScheduledReportConfig, now: Date): boolean {
  const day = now.getDate();

  switch (config.schedule) {
    case 'monthly':
      return day === config.dayOfMonth;
    case 'quarterly': {
      const month = now.getMonth();
      const isFirstMonthOfQuarter = month % 3 === 0;
      return isFirstMonthOfQuarter && day === config.dayOfMonth;
    }
    case 'annual': {
      const month = now.getMonth();
      return month === 0 && day === config.dayOfMonth;
    }
    case 'ad-hoc':
      return false; // Ad-hoc reports are triggered manually
    default: {
      const exhaustive: never = config.schedule;
      throw new Error(`Unsupported schedule: ${exhaustive}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Email delivery
// ---------------------------------------------------------------------------

/**
 * Deliver a report via email.
 * In production, this uses a real email service (e.g., Nodemailer, SendGrid).
 * Here we log the delivery intent; the actual email would include
 * the report as an attachment (PDF or CSV).
 */
async function deliverReportByEmail(
  config: ScheduledReportConfig,
  metadata: ReportMetadata,
): Promise<void> {
  // Build the email payload
  const subject = `[Compliance Report] ${config.type} — ${metadata.period.startDate} to ${metadata.period.endDate}`;
  const body = [
    `A new compliance report has been generated.`,
    '',
    `Report ID: ${metadata.reportId}`,
    `Type: ${metadata.type}`,
    `Period: ${metadata.period.startDate} to ${metadata.period.endDate}`,
    `Status: ${metadata.status}`,
    `Format: ${config.format}`,
    '',
    `This is an automated message from the Pixelated Empathy Compliance Reporting System.`,
  ].join('\n');

  // In production, send the email with the report attached
  // For now, log the intent
  console.info(
    `[compliance-email] Sending report to ${config.emailRecipients.join(', ')}: ${subject}`,
  );

  // The actual report attachment would be generated here:
  // if (config.format === 'pdf') {
  //   const pdfBuffer = await exportReportToPDF(report, metadata);
  //   attach as application/pdf
  // } else if (config.format === 'csv') {
  //   const csvString = await exportReportToCSV(report, metadata);
  //   attach as text/csv
  // }
}

// ---------------------------------------------------------------------------
// Manual trigger (ad-hoc generation)
// ---------------------------------------------------------------------------

/**
 * Manually trigger a scheduled report immediately, regardless of schedule.
 */
export async function triggerScheduledReportNow(
  scheduleId: string,
): Promise<ReportMetadata> {
  const config = SCHEDULED_REPORTS.get(scheduleId);
  if (!config) {
    throw new Error(`Scheduled report not found: ${scheduleId}`);
  }

  const metadata = await runScheduledReport(config);
  await deliverReportByEmail(config, metadata);
  return metadata;
}
