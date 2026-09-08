/**
 * Compliance Reporting Module — Public API
 *
 * Barrel exports for all compliance reporting functionality.
 */

// Types
export type {
  ReportType,
  ReportFormat,
  ReportSchedule,
  ReportStatus,
  ReportPeriod,
  ChainVerificationResult,
  HIPAAAuditReport,
  PHIAccessEvent,
  PHIModificationEvent,
  BreakGlassEvent,
  HIPAAAuditSummary,
  SOC2SecurityReport,
  AccessControlSummary,
  RoleAssignment,
  EncryptionSummary,
  SecurityIncident,
  SOC2SecuritySummary,
  SOC2AvailabilityReport,
  UptimeSummary,
  AvailabilityIncident,
  BackupRestoreSummary,
  DisasterRecoverySummary,
  SOC2AvailabilitySummary,
  ConsentComplianceReport,
  ConsentByState,
  ConsentByTreatment,
  ExpiringConsent,
  ConsentComplianceSummary,
  AccessReviewReport,
  AccessRoleAssignment,
  PermissionChange,
  AccessReviewSummary,
  ReportMetadata,
  ReportRequest,
  ScheduledReportConfig,
  ComplianceReport,
  ReportTemplate,
  ReportSection,
} from './types'

// Report generator
export {
  loadTemplate,
  verifyAuditChain,
  queryAuditEvents,
  generateReportId,
  generateReport,
  runScheduledReport,
  computePeriodForSchedule,
} from './report-generator'

// Report type generators
export { generateHIPAAAuditReport } from './hipaa-report'
export {
  generateSOC2SecurityReport,
  generateSOC2AvailabilityReport,
} from './soc2-report'
export { generateConsentComplianceReport } from './consent-compliance-report'
export { generateAccessReviewReport } from './access-review-report'

// Export
export { exportReportToPDF } from './export/pdf-exporter'
export { exportReportToCSV } from './export/csv-exporter'

// Scheduler
export {
  createScheduledReport,
  listScheduledReports,
  getScheduledReport,
  updateScheduledReport,
  deleteScheduledReport,
  processScheduledReports,
  triggerScheduledReportNow,
} from './scheduler'
