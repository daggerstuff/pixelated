/**
 * Compliance report template definitions.
 *
 * Each template defines the control mappings, finding criteria, and
 * data collection requirements for a specific compliance report type.
 */

import type {
  AccessReviewData,
  ComplianceFinding,
  ConsentComplianceData,
  FindingSeverity,
  FindingStatus,
  HipaaAuditData,
  ReportType,
  Soc2AvailabilityData,
  Soc2SecurityData,
} from './types'

/** A template for a compliance report. */
export interface ReportTemplate {
  /** Report type identifier. */
  type: ReportType
  /** Human-readable title. */
  title: string
  /** Description of the report purpose. */
  description: string
  /** Regulatory framework (e.g., 'HIPAA', 'SOC 2', 'Internal'). */
  framework: string
  /** Control IDs covered by this report. */
  controlIds: string[]
  /** Generate findings from the collected data. */
  generateFindings: (data: unknown) => ComplianceFinding[]
  /** Template version for change control tracking. */
  version: string
}

/** Helper: create a finding with sensible defaults. */
function makeFinding(
  id: string,
  title: string,
  controlId: string,
  severity: FindingSeverity,
  status: FindingStatus,
  description: string,
  evidence: string[],
  remediation?: string,
): ComplianceFinding {
  const finding: ComplianceFinding = {
    id,
    title,
    controlId,
    severity,
    status,
    description,
    evidence,
  }
  if (remediation !== undefined) {
    finding.remediation = remediation
  }
  return finding
}

// --- HIPAA Audit Findings ---

function hipaaAuditFindings(data: unknown): ComplianceFinding[] {
  const d = data as HipaaAuditData

  const findings: ComplianceFinding[] = []

  // Chain integrity
  const cv = d.chainVerification
  findings.push(
    makeFinding(
      'HIPAA-001',
      'Audit chain integrity verification',
      '§164.312(b) Audit controls',
      cv.valid ? 'info' : 'critical',
      cv.valid ? 'pass' : 'fail',
      cv.valid
        ? `Audit chain verified successfully. ${cv.totalEvents} events in the chain.`
        : `Audit chain BROKEN at index ${cv.brokenAtIndex ?? 0} (event ID: ${cv.brokenAtId ?? 'unknown'}). Reason: ${cv.reason ?? 'unknown'}`,
      [
        `Chain valid: ${cv.valid}`,
        `Total events: ${cv.totalEvents}`,
        ...(cv.reason ? [`Reason: ${cv.reason}`] : []),
      ],
      cv.valid ? undefined : 'Investigate the broken chain link immediately and restore audit integrity.',
    ),
  )

  // PHI access logging
  findings.push(
    makeFinding(
      'HIPAA-002',
      'PHI access event logging',
      '§164.312(b) Audit controls',
      'info',
      d.totalPhiAccessEvents > 0 ? 'pass' : 'warning',
      `${d.totalPhiAccessEvents} PHI access events were logged during the reporting period, involving ${d.uniqueUsers} unique users.`,
      [`Total events: ${d.totalPhiAccessEvents}`, `Unique users: ${d.uniqueUsers}`],
    ),
  )

  // Break-glass access
  findings.push(
    makeFinding(
      'HIPAA-003',
      'Break-glass access events',
      '§164.312(a)(2)(iv) Access establishment',
      d.breakGlassEvents.length > 0 ? 'high' : 'info',
      d.breakGlassEvents.length > 0 ? 'warning' : 'pass',
      d.breakGlassEvents.length > 0
        ? `${d.breakGlassEvents.length} break-glass access events were recorded. Each should be reviewed for appropriateness.`
        : 'No break-glass access events were recorded during the reporting period.',
      d.breakGlassEvents.length > 0
        ? d.breakGlassEvents.map(
            (e) => `User ${e.userId}: ${e.reason} (IP: ${e.ipAddress ?? 'unknown'})`,
          )
        : ['No break-glass events'],
      d.breakGlassEvents.length > 0
        ? 'Review each break-glass event for clinical appropriateness and document justification.'
        : undefined,
    ),
  )

  // Failed access attempts
  findings.push(
    makeFinding(
      'HIPAA-004',
      'Failed PHI access attempts',
      '§164.308(a)(1)(ii)(B) Risk management',
      d.failedAttempts.length > 10 ? 'high' : d.failedAttempts.length > 0 ? 'medium' : 'info',
      d.failedAttempts.length > 0 ? 'warning' : 'pass',
      `${d.failedAttempts.length} failed access attempts were recorded.`,
      d.failedAttempts.length > 0
        ? d.failedAttempts.slice(0, 10).map((f) => `User ${f.userId}: ${f.action} on ${f.resource} — ${f.errorMessage}`)
        : ['No failed access attempts'],
      d.failedAttempts.length > 10
        ? 'Investigate potential unauthorized access attempts and consider rate limiting.'
        : undefined,
    ),
  )

  return findings
}

// --- SOC 2 Security Findings ---

function soc2SecurityFindings(data: unknown): ComplianceFinding[] {
  const d = data as Soc2SecurityData

  const findings: ComplianceFinding[] = []

  // Access controls
  const activeAssignments = d.roleAssignments.filter((a) => a.active).length
  findings.push(
    makeFinding(
      'SOC2-SEC-001',
      'Access control role assignments',
      'CC6.1 - Logical and physical access controls',
      'info',
      activeAssignments > 0 ? 'pass' : 'fail',
      `${activeAssignments} active role assignments are configured. ${d.accessChanges.length} access changes occurred during the period.`,
      [`Active assignments: ${activeAssignments}`, `Access changes: ${d.accessChanges.length}`],
    ),
  )

  // Encryption
  findings.push(
    makeFinding(
      'SOC2-SEC-002',
      'Encryption verification',
      'CC6.7 - Data transmission and disposal',
      d.encryptionStatus.atRest && d.encryptionStatus.inTransit ? 'info' : 'critical',
      d.encryptionStatus.atRest && d.encryptionStatus.inTransit ? 'pass' : 'fail',
      `Encryption at rest: ${d.encryptionStatus.atRest ? 'enabled' : 'DISABLED'}. Encryption in transit: ${d.encryptionStatus.inTransit ? 'enabled' : 'DISABLED'}. Algorithm: ${d.encryptionStatus.algorithm}. Key rotation: ${d.encryptionStatus.keyRotationDays} days.`,
      [
        `At rest: ${d.encryptionStatus.atRest}`,
        `In transit: ${d.encryptionStatus.inTransit}`,
        `Algorithm: ${d.encryptionStatus.algorithm}`,
        `Key rotation: ${d.encryptionStatus.keyRotationDays} days`,
      ],
      !(d.encryptionStatus.atRest && d.encryptionStatus.inTransit)
        ? 'Enable encryption for all data at rest and in transit immediately.'
        : undefined,
    ),
  )

  // Incident response
  const unresolvedIncidents = d.incidents.filter((i) => !i.resolvedAt)
  findings.push(
    makeFinding(
      'SOC2-SEC-003',
      'Incident response',
      'CC7.3 - Incident handling',
      unresolvedIncidents.length > 0 ? 'high' : 'info',
      unresolvedIncidents.length > 0 ? 'fail' : 'pass',
      `${d.incidents.length} security incidents recorded. ${unresolvedIncidents.length} remain unresolved.`,
      [
        `Total incidents: ${d.incidents.length}`,
        `Unresolved: ${unresolvedIncidents.length}`,
      ],
      unresolvedIncidents.length > 0
        ? 'Resolve all open security incidents and document remediation steps.'
        : undefined,
    ),
  )

  // Failed authentications
  findings.push(
    makeFinding(
      'SOC2-SEC-004',
      'Authentication failures',
      'CC6.1 - Logical access security',
      d.failedAuthentications > 100 ? 'high' : d.failedAuthentications > 10 ? 'medium' : 'info',
      d.failedAuthentications > 100 ? 'fail' : 'warning',
      `${d.failedAuthentications} failed authentication attempts were recorded.`,
      [`Total failed authentications: ${d.failedAuthentications}`],
      d.failedAuthentications > 100
        ? 'Implement account lockout policies and investigate potential brute-force attacks.'
        : undefined,
    ),
  )

  return findings
}

// --- SOC 2 Availability Findings ---

function soc2AvailabilityFindings(data: unknown): ComplianceFinding[] {
  const d = data as Soc2AvailabilityData

  const findings: ComplianceFinding[] = []

  // Uptime
  findings.push(
    makeFinding(
      'SOC2-AVAIL-001',
      'System uptime',
      'A1.1 - Environmental protections',
      d.uptimePercentage >= 99.9 ? 'info' : d.uptimePercentage >= 99.5 ? 'medium' : 'high',
      d.uptimePercentage >= 99.9 ? 'pass' : d.uptimePercentage >= 99.5 ? 'warning' : 'fail',
      `System uptime for the period: ${d.uptimePercentage.toFixed(2)}%. Total downtime: ${d.totalDowntimeMinutes} minutes.`,
      [
        `Uptime: ${d.uptimePercentage.toFixed(2)}%`,
        `Downtime: ${d.totalDowntimeMinutes} minutes`,
      ],
      d.uptimePercentage < 99.5
        ? 'Review infrastructure redundancy and implement failover mechanisms.'
        : undefined,
    ),
  )

  // Backups
  const failedBackups = d.backups.filter((b) => b.status === 'failure')
  findings.push(
    makeFinding(
      'SOC2-AVAIL-002',
      'Backup verification',
      'A1.2 - Data backup',
      failedBackups.length > 0 ? 'high' : 'info',
      failedBackups.length > 0 ? 'fail' : 'pass',
      `${d.backups.length} backup operations recorded. ${failedBackups.length} failures.`,
      [
        `Total backups: ${d.backups.length}`,
        `Failed backups: ${failedBackups.length}`,
      ],
      failedBackups.length > 0
        ? 'Investigate and resolve backup failures immediately. Verify backup integrity.'
        : undefined,
    ),
  )

  // Disaster recovery
  const failedTests = d.disasterRecoveryTests.filter((t) => !t.passed)
  findings.push(
    makeFinding(
      'SOC2-AVAIL-003',
      'Disaster recovery testing',
      'A1.3 - Recovery infrastructure',
      failedTests.length > 0 ? 'high' : 'info',
      failedTests.length > 0 ? 'fail' : 'pass',
      `${d.disasterRecoveryTests.length} disaster recovery tests conducted. ${failedTests.length} failed.`,
      d.disasterRecoveryTests.map((t) => `RTO: ${t.rtoMinutes}min, RPO: ${t.rpoMinutes}min, ${t.passed ? 'passed' : 'FAILED'}`),
      failedTests.length > 0
        ? 'Address disaster recovery test failures and update runbook procedures.'
        : undefined,
    ),
  )

  // Health checks
  const unhealthyServices = d.healthChecks.filter((h) => h.status !== 'healthy')
  findings.push(
    makeFinding(
      'SOC2-AVAIL-004',
      'System health monitoring',
      'A1.1 - Environmental protections',
      unhealthyServices.length > 0 ? 'medium' : 'info',
      unhealthyServices.length > 0 ? 'warning' : 'pass',
      `${d.healthChecks.length} services monitored. ${unhealthyServices.length} unhealthy.`,
      d.healthChecks.map((h) => `${h.service}: ${h.status}`),
      unhealthyServices.length > 0
        ? 'Investigate degraded or down services and restore to healthy state.'
        : undefined,
    ),
  )

  return findings
}

// --- Consent Compliance Findings ---

function consentComplianceFindings(data: unknown): ComplianceFinding[] {
  const d = data as ConsentComplianceData

  const findings: ComplianceFinding[] = []

  // Consent coverage
  findings.push(
    makeFinding(
      'CONSENT-001',
      'Consent record coverage',
      '§164.506 Uses and disclosures',
      'info',
      d.totalConsents > 0 ? 'pass' : 'fail',
      `${d.totalConsents} consent records on file. Status breakdown: ${JSON.stringify(d.consentsByStatus)}.`,
      [`Total consents: ${d.totalConsents}`, `By status: ${JSON.stringify(d.consentsByStatus)}`],
    ),
  )

  // Expiring consents
  findings.push(
    makeFinding(
      'CONSENT-002',
      'Expiring consents (30-day window)',
      '§164.508 Authorizations',
      d.expiringConsents.length > 0 ? 'medium' : 'info',
      d.expiringConsents.length > 0 ? 'warning' : 'pass',
      `${d.expiringConsents.length} consents expiring within 30 days.`,
      d.expiringConsents.slice(0, 10).map((e) => `${e.consentId}: ${e.treatmentType}, expires ${e.expiryDate}`),
      d.expiringConsents.length > 0
        ? 'Notify patients of upcoming consent expirations and initiate renewal process.'
        : undefined,
    ),
  )

  // Expired consents
  findings.push(
    makeFinding(
      'CONSENT-003',
      'Expired consents',
      '§164.508 Authorizations',
      d.expiredConsents.length > 0 ? 'high' : 'info',
      d.expiredConsents.length > 0 ? 'fail' : 'pass',
      `${d.expiredConsents.length} consents have expired. PHI access should be blocked for these patients until renewal.`,
      d.expiredConsents.slice(0, 10).map((e) => `${e.consentId}: ${e.treatmentType}, expired ${e.expiredDate}`),
      d.expiredConsents.length > 0
        ? 'Block all PHI access for patients with expired consents. Initiate renewal workflow.'
        : undefined,
    ),
  )

  // Renewals and withdrawals
  findings.push(
    makeFinding(
      'CONSENT-004',
      'Consent renewals and withdrawals',
      '§164.508 Authorizations',
      'info',
      'pass',
      `${d.renewals.length} consent renewals and ${d.withdrawals.length} withdrawals were processed during the period.`,
      [`Renewals: ${d.renewals.length}`, `Withdrawals: ${d.withdrawals.length}`],
    ),
  )

  return findings
}

// --- Access Review Findings ---

function accessReviewFindings(data: unknown): ComplianceFinding[] {
  const d = data as AccessReviewData

  const findings: ComplianceFinding[] = []

  // Active assignments
  const activeCount = d.assignments.filter((a) => a.active).length
  findings.push(
    makeFinding(
      'ACCESS-001',
      'Active role assignments',
      'CC6.1 - Logical access controls',
      'info',
      'pass',
      `${activeCount} active role assignments across ${d.roleDefinitions.length} role definitions.`,
      [
        `Active assignments: ${activeCount}`,
        `Role definitions: ${d.roleDefinitions.length}`,
      ],
    ),
  )

  // Dormant accounts
  findings.push(
    makeFinding(
      'ACCESS-002',
      'Dormant account review',
      'CC6.3 - User access management',
      d.dormantAccounts.length > 0 ? 'medium' : 'info',
      d.dormantAccounts.length > 0 ? 'warning' : 'pass',
      `${d.dormantAccounts.length} accounts have been dormant for 90+ days.`,
      d.dormantAccounts.slice(0, 10).map((a) => `${a.userId}: ${a.role}, ${a.daysDormant} days dormant`),
      d.dormantAccounts.length > 0
        ? 'Review and deactivate dormant accounts. Implement automated deactivation policy.'
        : undefined,
    ),
  )

  // Privileged access
  findings.push(
    makeFinding(
      'ACCESS-003',
      'Privileged access review',
      'CC6.1 - Logical access controls',
      'info',
      'pass',
      `${d.privilegedAccess.length} privileged access assignments reviewed.`,
      d.privilegedAccess.map((p) => `${p.userId}: ${p.role}, last reviewed ${p.lastReviewedAt}`),
    ),
  )

  // Least privilege
  const overPrivileged = d.roleDefinitions.filter((r) => r.permissions.length > 20)
  findings.push(
    makeFinding(
      'ACCESS-004',
      'Least-privilege principle verification',
      'CC6.3 - User access management',
      overPrivileged.length > 0 ? 'medium' : 'info',
      overPrivileged.length > 0 ? 'warning' : 'pass',
      `${overPrivileged.length} roles have 20+ permissions. Verify each follows least-privilege.`,
      overPrivileged.map((r) => `${r.role}: ${r.permissions.length} permissions, ${r.userCount} users`),
      overPrivileged.length > 0
        ? 'Review roles with excessive permissions and split into narrower scopes.'
        : undefined,
    ),
  )

  return findings
}

// --- Template Registry ---

export const REPORT_TEMPLATES: Record<ReportType, ReportTemplate> = {
  'hipaa-audit': {
    type: 'hipaa-audit',
    title: 'HIPAA Audit Report',
    description:
      'All PHI access/modification events, break-glass usage, and audit chain verification results.',
    framework: 'HIPAA',
    controlIds: ['§164.312(b)', '§164.312(a)(2)(iv)', '§164.308(a)(1)(ii)(B)', '§164.506', '§164.508'],
    generateFindings: hipaaAuditFindings,
    version: '1.0.0',
  },
  'soc2-security': {
    type: 'soc2-security',
    title: 'SOC 2 Security Report',
    description:
      'Access controls, audit logs, encryption verification, and incident response evidence.',
    framework: 'SOC 2',
    controlIds: ['CC6.1', 'CC6.7', 'CC7.3', 'CC6.1'],
    generateFindings: soc2SecurityFindings,
    version: '1.0.0',
  },
  'soc2-availability': {
    type: 'soc2-availability',
    title: 'SOC 2 Availability Report',
    description:
      'Uptime, backup/restore verification, and disaster recovery test results.',
    framework: 'SOC 2',
    controlIds: ['A1.1', 'A1.2', 'A1.3'],
    generateFindings: soc2AvailabilityFindings,
    version: '1.0.0',
  },
  'consent-compliance': {
    type: 'consent-compliance',
    title: 'Consent Compliance Report',
    description:
      'All consent records, expirations, renewals, and withdrawals by state and treatment type.',
    framework: 'HIPAA',
    controlIds: ['§164.506', '§164.508'],
    generateFindings: consentComplianceFindings,
    version: '1.0.0',
  },
  'access-review': {
    type: 'access-review',
    title: 'Access Review Report',
    description:
      'RBAC assignments, role changes, access grants/revocations, and dormant account review.',
    framework: 'SOC 2',
    controlIds: ['CC6.1', 'CC6.3'],
    generateFindings: accessReviewFindings,
    version: '1.0.0',
  },
}
