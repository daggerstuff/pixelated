/**
 * Compliance Report Types
 *
 * Type definitions for automated compliance report generation
 * supporting SOC 2 and HIPAA evidence collection.
 */

// ---------------------------------------------------------------------------
// Report Types
// ---------------------------------------------------------------------------

export type ReportType =
  | 'hipaa_audit'
  | 'soc2_security'
  | 'soc2_availability'
  | 'consent_compliance'
  | 'access_review';

export type ReportFormat = 'pdf' | 'csv' | 'json';

export type ReportSchedule = 'monthly' | 'quarterly' | 'annual' | 'ad-hoc';

export type ReportStatus = 'pending' | 'generating' | 'completed' | 'failed';

// ---------------------------------------------------------------------------
// Report Period
// ---------------------------------------------------------------------------

export interface ReportPeriod {
  startDate: string; // ISO 8601
  endDate: string; // ISO 8601
}

// ---------------------------------------------------------------------------
// Chain Verification
// ---------------------------------------------------------------------------

export interface ChainVerificationResult {
  valid: boolean;
  totalEvents: number;
  brokenAtIndex?: number;
  brokenAtId?: string;
  reason?: string;
}

// ---------------------------------------------------------------------------
// HIPAA Audit Report
// ---------------------------------------------------------------------------

export interface HIPAAAuditReport {
  reportType: 'hipaa_audit';
  reportId: string;
  generatedAt: string;
  period: ReportPeriod;
  tenantId: string;
  chainVerification: ChainVerificationResult;
  phiAccessEvents: PHIAccessEvent[];
  phiModificationEvents: PHIModificationEvent[];
  breakGlassEvents: BreakGlassEvent[];
  summary: HIPAAAuditSummary;
}

export interface PHIAccessEvent {
  eventId: string;
  timestamp: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  patientId?: string;
  severity: string;
  status: 'success' | 'failure';
  ipAddress?: string;
  userAgent?: string;
  hash?: string;
}

export interface PHIModificationEvent {
  eventId: string;
  timestamp: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  previousHash?: string;
  hash?: string;
  status: 'success' | 'failure';
}

export interface BreakGlassEvent {
  eventId: string;
  timestamp: string;
  userId: string;
  reason: string;
  resourceType: string;
  resourceId: string;
  severity: string;
}

export interface HIPAAAuditSummary {
  totalPhiAccess: number;
  totalPhiModifications: number;
  totalBreakGlass: number;
  failedAccess: number;
  uniqueUsers: number;
  uniquePatients: number;
  chainValid: boolean;
}

// ---------------------------------------------------------------------------
// SOC 2 Security Report
// ---------------------------------------------------------------------------

export interface SOC2SecurityReport {
  reportType: 'soc2_security';
  reportId: string;
  generatedAt: string;
  period: ReportPeriod;
  tenantId: string;
  accessControls: AccessControlSummary;
  auditLogIntegrity: ChainVerificationResult;
  encryption: EncryptionSummary;
  incidents: SecurityIncident[];
  summary: SOC2SecuritySummary;
}

export interface AccessControlSummary {
  totalUsers: number;
  roleAssignments: RoleAssignment[];
  permissionGrants: number;
  permissionRevocations: number;
  mfaRequiredPermissions: number;
}

export interface RoleAssignment {
  role: string;
  count: number;
  permissions: string[];
}

export interface EncryptionSummary {
  dataInTransit: boolean;
  dataAtRest: boolean;
  auditLogHashing: boolean;
  algorithm: string;
}

export interface SecurityIncident {
  incidentId: string;
  timestamp: string;
  severity: string;
  type: string;
  description: string;
  resolved: boolean;
}

export interface SOC2SecuritySummary {
  totalAccessEvents: number;
  totalSecurityEvents: number;
  failedAccessAttempts: number;
  chainValid: boolean;
  encryptionCompliant: boolean;
  openIncidents: number;
}

// ---------------------------------------------------------------------------
// SOC 2 Availability Report
// ---------------------------------------------------------------------------

export interface SOC2AvailabilityReport {
  reportType: 'soc2_availability';
  reportId: string;
  generatedAt: string;
  period: ReportPeriod;
  tenantId: string;
  uptime: UptimeSummary;
  backupRestore: BackupRestoreSummary;
  disasterRecovery: DisasterRecoverySummary;
  summary: SOC2AvailabilitySummary;
}

export interface UptimeSummary {
  totalUptimePercentage: number;
  totalDowntimeMinutes: number;
  incidents: AvailabilityIncident[];
}

export interface AvailabilityIncident {
  incidentId: string;
  startTime: string;
  endTime?: string;
  durationMinutes: number;
  description: string;
}

export interface BackupRestoreSummary {
  lastBackupAt: string;
  backupFrequency: string;
  lastRestoreTest?: string;
  backupEncryption: boolean;
}

export interface DisasterRecoverySummary {
  drPlanVersion: string;
  lastTestDate?: string;
  rtoMinutes: number;
  rpoMinutes: number;
}

export interface SOC2AvailabilitySummary {
  uptimePercentage: number;
  totalDowntimeMinutes: number;
  backupCompliant: boolean;
  drCompliant: boolean;
}

// ---------------------------------------------------------------------------
// Consent Compliance Report
// ---------------------------------------------------------------------------

export interface ConsentComplianceReport {
  reportType: 'consent_compliance';
  reportId: string;
  generatedAt: string;
  period: ReportPeriod;
  tenantId: string;
  byState: ConsentByState[];
  byTreatment: ConsentByTreatment[];
  expiringConsents: ExpiringConsent[];
  summary: ConsentComplianceSummary;
}

export interface ConsentByState {
  stateCode: string;
  totalConsents: number;
  activeConsents: number;
  expiredConsents: number;
  revokedConsents: number;
  requiredLevel: string;
  complianceRate: number;
}

export interface ConsentByTreatment {
  treatmentCategory: string;
  totalConsents: number;
  activeConsents: number;
  expiredConsents: number;
  revokedConsents: number;
  complianceRate: number;
}

export interface ExpiringConsent {
  consentId: string;
  patientId: string;
  stateCode: string;
  category: string;
  expiresAt: string;
  daysUntilExpiry: number;
}

export interface ConsentComplianceSummary {
  totalConsents: number;
  activeConsents: number;
  expiredConsents: number;
  revokedConsents: number;
  expiringWithin30Days: number;
  overallComplianceRate: number;
  statesCovered: number;
}

// ---------------------------------------------------------------------------
// Access Review Report
// ---------------------------------------------------------------------------

export interface AccessReviewReport {
  reportType: 'access_review';
  reportId: string;
  generatedAt: string;
  period: ReportPeriod;
  tenantId: string;
  roleAssignments: AccessRoleAssignment[];
  permissionChanges: PermissionChange[];
  summary: AccessReviewSummary;
}

export interface AccessRoleAssignment {
  userId: string;
  role: string;
  permissions: string[];
  assignedAt: string;
  active: boolean;
}

export interface PermissionChange {
  changeId: string;
  timestamp: string;
  userId: string;
  type: 'grant' | 'revocation';
  permission: string;
  role: string;
  reason?: string;
}

export interface AccessReviewSummary {
  totalActiveAssignments: number;
  totalUsers: number;
  totalRoles: number;
  grants: number;
  revocations: number;
  highRiskPermissions: number;
}

// ---------------------------------------------------------------------------
// Report Metadata (stored report reference)
// ---------------------------------------------------------------------------

export interface ReportMetadata {
  reportId: string;
  type: ReportType;
  status: ReportStatus;
  format: ReportFormat;
  period: ReportPeriod;
  tenantId: string;
  generatedBy: string;
  generatedAt: string;
  schedule?: ReportSchedule;
  sizeBytes?: number;
  downloadUrl?: string;
}

// ---------------------------------------------------------------------------
// Report Generation Request
// ---------------------------------------------------------------------------

export interface ReportRequest {
  type: ReportType;
  period: ReportPeriod;
  tenantId: string;
  format?: ReportFormat;
  schedule?: ReportSchedule;
  requestedBy: string;
  emailRecipient?: string;
}

// ---------------------------------------------------------------------------
// Scheduled Report Configuration
// ---------------------------------------------------------------------------

export interface ScheduledReportConfig {
  scheduleId: string;
  type: ReportType;
  schedule: ReportSchedule;
  tenantId: string;
  emailRecipients: string[];
  format: ReportFormat;
  dayOfMonth: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Union type for all report data
// ---------------------------------------------------------------------------

export type ComplianceReport =
  | HIPAAAuditReport
  | SOC2SecurityReport
  | SOC2AvailabilityReport
  | ConsentComplianceReport
  | AccessReviewReport;

// ---------------------------------------------------------------------------
// Report Template (versioned JSON schema)
// ---------------------------------------------------------------------------

export interface ReportTemplate {
  templateId: string;
  type: ReportType;
  version: string;
  sections: ReportSection[];
  schemaVersion: string;
}

export interface ReportSection {
  id: string;
  title: string;
  description: string;
  required: boolean;
}
