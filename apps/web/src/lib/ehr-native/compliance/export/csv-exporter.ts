/**
 * CSV Exporter — renders compliance reports as CSV documents.
 *
 * Each report type produces a multi-section CSV with headers,
 * data rows, and summary statistics.
 */

import type { ComplianceReport, ReportMetadata } from '../types'
import type {
  HIPAAAuditReport,
  SOC2SecurityReport,
  SOC2AvailabilityReport,
  ConsentComplianceReport,
  AccessReviewReport,
} from '../types'

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

/** Escape a cell value for CSV: quote if needed, escape inner quotes. */
function csvEscape(
  value: string | number | boolean | undefined | null,
): string {
  if (value === undefined || value === null) return ''
  const str = String(value)
  if (
    str.includes(',') ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes('\r')
  ) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/** Build a CSV row from an array of cell values. */
function row(cells: (string | number | boolean | undefined | null)[]): string {
  return cells.map(csvEscape).join(',')
}

/** Build a CSV section header. */
function sectionHeader(title: string): string {
  return `\n# ${title}\n`
}

/** Human-readable title for each report type. */
function reportTitle(reportType: ComplianceReport['reportType']): string {
  switch (reportType) {
    case 'hipaa_audit':
      return 'HIPAA Audit Report'
    case 'soc2_security':
      return 'SOC 2 Security Report'
    case 'soc2_availability':
      return 'SOC 2 Availability Report'
    case 'consent_compliance':
      return 'Consent Compliance Report'
    case 'access_review':
      return 'Access Review Report'
    default: {
      const exhaustive: never = reportType
      throw new Error(`Unsupported report type: ${JSON.stringify(exhaustive)}`)
    }
  }
}

/** Build a CSV from headers + data rows. */
function table(
  headers: string[],
  data: (string | number | boolean | undefined | null)[][],
): string {
  const lines = [row(headers)]
  for (const dataRow of data) {
    lines.push(row(dataRow))
  }
  return lines.join('\n') + '\n'
}

// ---------------------------------------------------------------------------
// Report-specific CSV renderers
// ---------------------------------------------------------------------------

function renderHIPAAAuditCSV(report: HIPAAAuditReport): string {
  const parts: string[] = []

  // Chain verification
  parts.push(sectionHeader('Chain Verification'))
  parts.push(
    table(
      ['Field', 'Value'],
      [
        ['Valid', report.chainVerification.valid],
        ['Total Events', report.chainVerification.totalEvents],
        ['Broken At ID', report.chainVerification.brokenAtId ?? ''],
        ['Reason', report.chainVerification.reason ?? ''],
      ],
    ),
  )

  // PHI Access Events
  parts.push(sectionHeader('PHI Access Events'))
  const accessRows = report.phiAccessEvents.map((e) => [
    e.eventId,
    e.timestamp,
    e.userId,
    e.action,
    e.resourceType,
    e.resourceId,
    e.patientId ?? '',
    e.severity,
    e.status,
    e.ipAddress ?? '',
    e.hash ?? '',
  ])
  parts.push(
    table(
      [
        'Event ID',
        'Timestamp',
        'User',
        'Action',
        'Resource Type',
        'Resource ID',
        'Patient ID',
        'Severity',
        'Status',
        'IP Address',
        'Hash',
      ],
      accessRows,
    ),
  )

  // PHI Modification Events
  parts.push(sectionHeader('PHI Modification Events'))
  const modRows = report.phiModificationEvents.map((e) => [
    e.eventId,
    e.timestamp,
    e.userId,
    e.action,
    e.resourceType,
    e.resourceId,
    e.previousHash ?? '',
    e.hash ?? '',
    e.status,
  ])
  parts.push(
    table(
      [
        'Event ID',
        'Timestamp',
        'User',
        'Action',
        'Resource Type',
        'Resource ID',
        'Previous Hash',
        'Hash',
        'Status',
      ],
      modRows,
    ),
  )

  // Break-Glass Events
  parts.push(sectionHeader('Break-Glass Events'))
  const bgRows = report.breakGlassEvents.map((e) => [
    e.eventId,
    e.timestamp,
    e.userId,
    e.reason,
    e.resourceType,
    e.resourceId,
    e.severity,
  ])
  parts.push(
    table(
      [
        'Event ID',
        'Timestamp',
        'User',
        'Reason',
        'Resource Type',
        'Resource ID',
        'Severity',
      ],
      bgRows,
    ),
  )

  // Summary
  parts.push(sectionHeader('Summary'))
  parts.push(
    table(
      ['Metric', 'Value'],
      [
        ['Total PHI Access', report.summary.totalPhiAccess],
        ['Total PHI Modifications', report.summary.totalPhiModifications],
        ['Total Break-Glass', report.summary.totalBreakGlass],
        ['Failed Access', report.summary.failedAccess],
        ['Unique Users', report.summary.uniqueUsers],
        ['Unique Patients', report.summary.uniquePatients],
        ['Chain Valid', report.summary.chainValid],
      ],
    ),
  )

  return parts.join('\n')
}

function renderSOC2SecurityCSV(report: SOC2SecurityReport): string {
  const parts: string[] = []

  // Access Controls
  parts.push(sectionHeader('Access Controls'))
  const roleRows = report.accessControls.roleAssignments.map((r) => [
    r.role,
    r.count,
    r.permissions.join('; '),
  ])
  parts.push(table(['Role', 'Count', 'Permissions'], roleRows))
  parts.push(
    table(
      ['Metric', 'Value'],
      [
        ['Total Users', report.accessControls.totalUsers],
        ['Permission Grants', report.accessControls.permissionGrants],
        ['Permission Revocations', report.accessControls.permissionRevocations],
        [
          'MFA Required Permissions',
          report.accessControls.mfaRequiredPermissions,
        ],
      ],
    ),
  )

  // Audit Log Integrity
  parts.push(sectionHeader('Audit Log Integrity'))
  parts.push(
    table(
      ['Field', 'Value'],
      [
        ['Valid', report.auditLogIntegrity.valid],
        ['Total Events', report.auditLogIntegrity.totalEvents],
      ],
    ),
  )

  // Encryption
  parts.push(sectionHeader('Encryption'))
  parts.push(
    table(
      ['Field', 'Value'],
      [
        ['Data in Transit', report.encryption.dataInTransit],
        ['Data at Rest', report.encryption.dataAtRest],
        ['Audit Log Hashing', report.encryption.auditLogHashing],
        ['Algorithm', report.encryption.algorithm],
      ],
    ),
  )

  // Incidents
  parts.push(sectionHeader('Security Incidents'))
  const incRows = report.incidents.map((i) => [
    i.incidentId,
    i.timestamp,
    i.severity,
    i.type,
    i.description,
    i.resolved,
  ])
  parts.push(
    table(
      [
        'Incident ID',
        'Timestamp',
        'Severity',
        'Type',
        'Description',
        'Resolved',
      ],
      incRows,
    ),
  )

  // Summary
  parts.push(sectionHeader('Summary'))
  parts.push(
    table(
      ['Metric', 'Value'],
      [
        ['Total Access Events', report.summary.totalAccessEvents],
        ['Total Security Events', report.summary.totalSecurityEvents],
        ['Failed Access Attempts', report.summary.failedAccessAttempts],
        ['Chain Valid', report.summary.chainValid],
        ['Encryption Compliant', report.summary.encryptionCompliant],
        ['Open Incidents', report.summary.openIncidents],
      ],
    ),
  )

  return parts.join('\n')
}

function renderSOC2AvailabilityCSV(report: SOC2AvailabilityReport): string {
  const parts: string[] = []

  // Uptime
  parts.push(sectionHeader('Uptime'))
  parts.push(
    table(
      ['Metric', 'Value'],
      [
        ['Uptime Percentage', report.uptime.totalUptimePercentage],
        ['Total Downtime (minutes)', report.uptime.totalDowntimeMinutes],
      ],
    ),
  )
  const uptimeRows = report.uptime.incidents.map((i) => [
    i.incidentId,
    i.startTime,
    i.endTime ?? '',
    i.durationMinutes,
    i.description,
  ])
  parts.push(
    table(
      [
        'Incident ID',
        'Start Time',
        'End Time',
        'Duration (min)',
        'Description',
      ],
      uptimeRows,
    ),
  )

  // Backup & Restore
  parts.push(sectionHeader('Backup & Restore'))
  parts.push(
    table(
      ['Field', 'Value'],
      [
        ['Last Backup', report.backupRestore.lastBackupAt],
        ['Backup Frequency', report.backupRestore.backupFrequency],
        ['Last Restore Test', report.backupRestore.lastRestoreTest ?? ''],
        ['Backup Encryption', report.backupRestore.backupEncryption],
      ],
    ),
  )

  // Disaster Recovery
  parts.push(sectionHeader('Disaster Recovery'))
  parts.push(
    table(
      ['Field', 'Value'],
      [
        ['DR Plan Version', report.disasterRecovery.drPlanVersion],
        ['Last Test Date', report.disasterRecovery.lastTestDate ?? ''],
        ['RTO (minutes)', report.disasterRecovery.rtoMinutes],
        ['RPO (minutes)', report.disasterRecovery.rpoMinutes],
      ],
    ),
  )

  // Summary
  parts.push(sectionHeader('Summary'))
  parts.push(
    table(
      ['Metric', 'Value'],
      [
        ['Uptime Percentage', report.summary.uptimePercentage],
        ['Total Downtime (minutes)', report.summary.totalDowntimeMinutes],
        ['Backup Compliant', report.summary.backupCompliant],
        ['DR Compliant', report.summary.drCompliant],
      ],
    ),
  )

  return parts.join('\n')
}

function renderConsentComplianceCSV(report: ConsentComplianceReport): string {
  const parts: string[] = []

  // By State
  parts.push(sectionHeader('By State'))
  const stateRows = report.byState.map((s) => [
    s.stateCode,
    s.totalConsents,
    s.activeConsents,
    s.expiredConsents,
    s.revokedConsents,
    s.requiredLevel,
    `${s.complianceRate}%`,
  ])
  parts.push(
    table(
      [
        'State',
        'Total',
        'Active',
        'Expired',
        'Revoked',
        'Required Level',
        'Compliance',
      ],
      stateRows,
    ),
  )

  // By Treatment
  parts.push(sectionHeader('By Treatment Category'))
  const treatRows = report.byTreatment.map((t) => [
    t.treatmentCategory,
    t.totalConsents,
    t.activeConsents,
    t.expiredConsents,
    t.revokedConsents,
    `${t.complianceRate}%`,
  ])
  parts.push(
    table(
      ['Category', 'Total', 'Active', 'Expired', 'Revoked', 'Compliance'],
      treatRows,
    ),
  )

  // Expiring Consents
  parts.push(sectionHeader('Expiring Consents (30 days)'))
  const expRows = report.expiringConsents.map((e) => [
    e.consentId,
    e.patientId,
    e.stateCode,
    e.category,
    e.expiresAt,
    e.daysUntilExpiry,
  ])
  parts.push(
    table(
      [
        'Consent ID',
        'Patient ID',
        'State',
        'Category',
        'Expires At',
        'Days Until Expiry',
      ],
      expRows,
    ),
  )

  // Summary
  parts.push(sectionHeader('Summary'))
  parts.push(
    table(
      ['Metric', 'Value'],
      [
        ['Total Consents', report.summary.totalConsents],
        ['Active Consents', report.summary.activeConsents],
        ['Expired Consents', report.summary.expiredConsents],
        ['Revoked Consents', report.summary.revokedConsents],
        ['Expiring Within 30 Days', report.summary.expiringWithin30Days],
        ['Overall Compliance Rate', `${report.summary.overallComplianceRate}%`],
        ['States Covered', report.summary.statesCovered],
      ],
    ),
  )

  return parts.join('\n')
}

function renderAccessReviewCSV(report: AccessReviewReport): string {
  const parts: string[] = []

  // Role Assignments
  parts.push(sectionHeader('Role Assignments'))
  const assignRows = report.roleAssignments.map((a) => [
    a.userId,
    a.role,
    a.permissions.join('; '),
    a.assignedAt,
    a.active,
  ])
  parts.push(
    table(
      ['User ID', 'Role', 'Permissions', 'Assigned At', 'Active'],
      assignRows,
    ),
  )

  // Permission Changes
  parts.push(sectionHeader('Permission Changes'))
  const changeRows = report.permissionChanges.map((c) => [
    c.changeId,
    c.timestamp,
    c.userId,
    c.type,
    c.permission,
    c.role,
    c.reason ?? '',
  ])
  parts.push(
    table(
      [
        'Change ID',
        'Timestamp',
        'User ID',
        'Type',
        'Permission',
        'Role',
        'Reason',
      ],
      changeRows,
    ),
  )

  // Summary
  parts.push(sectionHeader('Summary'))
  parts.push(
    table(
      ['Metric', 'Value'],
      [
        ['Total Active Assignments', report.summary.totalActiveAssignments],
        ['Total Users', report.summary.totalUsers],
        ['Total Roles', report.summary.totalRoles],
        ['Grants', report.summary.grants],
        ['Revocations', report.summary.revocations],
        ['High-Risk Permissions', report.summary.highRiskPermissions],
      ],
    ),
  )

  return parts.join('\n')
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Export a compliance report as a CSV string.
 */
export async function exportReportToCSV(
  report: ComplianceReport,
  _metadata: ReportMetadata,
): Promise<string> {
  // Header
  const header = [
    `# ${reportTitle(report.reportType)}`,
    `# Report ID: ${report.reportId}`,
    `# Generated: ${report.generatedAt}`,
    `# Period: ${report.period.startDate} to ${report.period.endDate}`,
    `# Tenant: ${report.tenantId}`,
    '',
  ].join('\n')

  let body: string
  switch (report.reportType) {
    case 'hipaa_audit':
      body = renderHIPAAAuditCSV(report)
      break
    case 'soc2_security':
      body = renderSOC2SecurityCSV(report)
      break
    case 'soc2_availability':
      body = renderSOC2AvailabilityCSV(report)
      break
    case 'consent_compliance':
      body = renderConsentComplianceCSV(report)
      break
    case 'access_review':
      body = renderAccessReviewCSV(report)
      break
    default: {
      const exhaustive: never = report
      throw new Error(
        `Unsupported report type for CSV: ${JSON.stringify(exhaustive)}`,
      )
    }
  }

  return header + body
}
