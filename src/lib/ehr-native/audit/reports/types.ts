/**
 * Compliance report type definitions.
 *
 * Supports HIPAA audit, SOC 2 (security + availability), consent compliance,
 * and access review report generation for evidence collection.
 */

/** Identifies a compliance report template. */
export type ReportType =
  | 'hipaa-audit'
  | 'soc2-security'
  | 'soc2-availability'
  | 'consent-compliance'
  | 'access-review'

/** Severity of a finding within a compliance report. */
export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'

/** Status of a compliance finding. */
export type FindingStatus = 'pass' | 'fail' | 'warning' | 'not-applicable'

/** A single compliance finding within a report. */
export interface ComplianceFinding {
  /** Unique identifier for this finding. */
  id: string
  /** Human-readable title. */
  title: string
  /** Which control or requirement this maps to. */
  controlId: string
  /** Severity of the finding. */
  severity: FindingSeverity
  /** Pass/fail/warning status. */
  status: FindingStatus
  /** Detailed description of the finding. */
  description: string
  /** Evidence supporting this finding. */
  evidence: string[]
  /** Recommended remediation if status is not 'pass'. */
  remediation?: string
}

/** Summary section of a compliance report. */
export interface ReportSummary {
  totalFindings: number
  passed: number
  failed: number
  warnings: number
  notApplicable: number
  /** Overall compliance percentage (0-100). */
  complianceScore: number
}

/** Chain verification result for audit integrity. */
export interface ChainVerificationResult {
  valid: boolean
  totalEvents: number
  brokenAtIndex?: number
  brokenAtId?: string
  reason?: string
}

/** Data section for HIPAA audit report. */
export interface HipaaAuditData {
  /** Total PHI access events in the period. */
  totalPhiAccessEvents: number
  /** Breakdown by action (create/read/update/delete/break-glass). */
  eventsByAction: Record<string, number>
  /** Breakdown by status (success/failure). */
  eventsByStatus: Record<string, number>
  /** Break-glass access events. */
  breakGlassEvents: Array<{
    timestamp: string
    userId: string
    resourceType: string
    resourceId: string
    reason: string
    ipAddress?: string
  }>
  /** Failed access attempts. */
  failedAttempts: Array<{
    timestamp: string
    userId: string
    action: string
    resource: string
    errorMessage: string
  }>
  /** Audit chain verification result. */
  chainVerification: ChainVerificationResult
  /** Unique users who accessed PHI. */
  uniqueUsers: number
  /** Most active users by event count. */
  topUsers: Array<{ userId: string; eventCount: number }>
}

/** Data section for SOC 2 security report. */
export interface Soc2SecurityData {
  /** RBAC role assignments. */
  roleAssignments: Array<{
    userId: string
    role: string
    assignedAt: string
    active: boolean
  }>
  /** Access grants and revocations in the period. */
  accessChanges: Array<{
    timestamp: string
    userId: string
    changeType: 'grant' | 'revoke'
    role: string
    performedBy: string
  }>
  /** Encryption status verification. */
  encryptionStatus: {
    atRest: boolean
    inTransit: boolean
    algorithm: string
    keyRotationDays: number
  }
  /** Incident response events. */
  incidents: Array<{
    id: string
    timestamp: string
    severity: FindingSeverity
    description: string
    resolvedAt?: string
  }>
  /** Failed authentication attempts. */
  failedAuthentications: number
}

/** Data section for SOC 2 availability report. */
export interface Soc2AvailabilityData {
  /** Uptime percentage for the period. */
  uptimePercentage: number
  /** Total downtime in minutes. */
  totalDowntimeMinutes: number
  /** Backup verification results. */
  backups: Array<{
    type: string
    lastRun: string
    status: 'success' | 'failure'
    sizeBytes: number
  }>
  /** Disaster recovery test results. */
  disasterRecoveryTests: Array<{
    testDate: string
    rtoMinutes: number
    rpoMinutes: number
    passed: boolean
  }>
  /** System health checks. */
  healthChecks: Array<{
    service: string
    status: 'healthy' | 'degraded' | 'down'
    lastChecked: string
  }>
}

/** Data section for consent compliance report. */
export interface ConsentComplianceData {
  /** Total consent records. */
  totalConsents: number
  /** Consents by status. */
  consentsByStatus: Record<string, number>
  /** Consents by treatment type. */
  consentsByTreatment: Record<string, number>
  /** Expiring consents (within 30 days). */
  expiringConsents: Array<{
    consentId: string
    patientId: string
    treatmentType: string
    expiryDate: string
  }>
  /** Expired consents. */
  expiredConsents: Array<{
    consentId: string
    patientId: string
    treatmentType: string
    expiredDate: string
  }>
  /** Consent renewals in the period. */
  renewals: Array<{
    consentId: string
    patientId: string
    renewedAt: string
    renewedBy: string
  }>
  /** Consent withdrawals in the period. */
  withdrawals: Array<{
    consentId: string
    patientId: string
    withdrawnAt: string
    withdrawnBy: string
  }>
}

/** Data section for access review report. */
export interface AccessReviewData {
  /** All active RBAC assignments. */
  assignments: Array<{
    userId: string
    role: string
    assignedAt: string
    lastAccessedAt?: string
    active: boolean
  }>
  /** Role definitions and their permissions. */
  roleDefinitions: Array<{
    role: string
    permissions: string[]
    userCount: number
  }>
  /** Dormant accounts (no access in 90 days). */
  dormantAccounts: Array<{
    userId: string
    role: string
    lastAccessedAt: string
    daysDormant: number
  }>
  /** Privileged access review. */
  privilegedAccess: Array<{
    userId: string
    role: string
    permissions: string[]
    lastReviewedAt: string
  }>
}

/** Union of all possible report data sections. */
export type ReportData =
  | HipaaAuditData
  | Soc2SecurityData
  | Soc2AvailabilityData
  | ConsentComplianceData
  | AccessReviewData

/** A complete compliance report. */
export interface ComplianceReport {
  /** Unique report ID. */
  id: string
  /** Report type. */
  type: ReportType
  /** Report title. */
  title: string
  /** Period covered. */
  periodStart: string
  periodEnd: string
  /** When the report was generated. */
  generatedAt: string
  /** Who generated the report. */
  generatedBy: string
  /** Organization covered. */
  organization: string
  /** Summary of findings. */
  summary: ReportSummary
  /** Detailed findings. */
  findings: ComplianceFinding[]
  /** Type-specific data section. */
  data: ReportData
  /** Audit chain verification (if applicable). */
  chainVerification?: ChainVerificationResult
}

/** Parameters for generating a compliance report. */
export interface ReportGenerationParams {
  /** Report type to generate. */
  type: ReportType
  /** Start of the reporting period (ISO date). */
  periodStart: string
  /** End of the reporting period (ISO date). */
  periodEnd: string
  /** User generating the report. */
  generatedBy: string
  /** Organization name. */
  organization: string
  /** Optional tenant ID for multi-tenant filtering. */
  tenantId?: string
}

/** Export format for compliance reports. */
export type ExportFormat = 'csv' | 'pdf' | 'json'

/** Result of a report export operation. */
export interface ExportResult {
  format: ExportFormat
  /** Base64-encoded content for PDF, or plain text for CSV/JSON. */
  content: string
  /** MIME type of the content. */
  mimeType: string
  /** Suggested filename. */
  filename: string
}
