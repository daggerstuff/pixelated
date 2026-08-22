/**
 * Compliance report generation engine.
 *
 * Collects data from audit chain, consent records, and RBAC logs,
 * generates findings from templates, and produces complete compliance reports.
 */

/** Generate a simple unique ID without node:crypto for browser compatibility. */
function generateId(): string {
  return `rpt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

import { getLogger } from '../../../utils/logger'
import { verifyEhrAuditChain } from '../ehr-audit-bridge'
import { REPORT_TEMPLATES, type ReportTemplate } from './templates'
import type {
  AccessReviewData,
  ChainVerificationResult,
  ComplianceFinding,
  ComplianceReport,
  ConsentComplianceData,
  ExportFormat,
  ExportResult,
  HipaaAuditData,
  ReportData,
  ReportGenerationParams,
  ReportSummary,
  ReportType,
  Soc2AvailabilityData,
  Soc2SecurityData,
} from './types'

const logger = getLogger('ComplianceReportGenerator')

/** Data collector interface — fetches raw data for a report type. */
export interface DataCollector {
  /** Collect data for the given report type and period. */
  collect(params: ReportGenerationParams): Promise<ReportData>
}

// ---------------------------------------------------------------------------
// Chain verification helper
// ---------------------------------------------------------------------------

function verifyChain(events: AuditEventInput[]): ChainVerificationResult {
  if (events.length === 0) {
    return { valid: true, totalEvents: 0 }
  }

  const result = verifyEhrAuditChain(events as unknown as Parameters<typeof verifyEhrAuditChain>[0])
  return {
    valid: result.valid,
    totalEvents: events.length,
    ...(result.brokenAtIndex !== undefined ? { brokenAtIndex: result.brokenAtIndex } : {}),
    ...(result.brokenAtId !== undefined ? { brokenAtId: result.brokenAtId } : {}),
    ...(result.reason !== undefined ? { reason: result.reason } : {}),
  }
}

// ---------------------------------------------------------------------------
// Summary builder
// ---------------------------------------------------------------------------

function buildSummary(findings: ComplianceFinding[]): ReportSummary {
  const passed = findings.filter((f) => f.status === 'pass').length
  const failed = findings.filter((f) => f.status === 'fail').length
  const warnings = findings.filter((f) => f.status === 'warning').length
  const notApplicable = findings.filter((f) => f.status === 'not-applicable').length
  const totalFindings = findings.length
  const scoredFindings = totalFindings - notApplicable
  const complianceScore = scoredFindings > 0 ? Math.round((passed / scoredFindings) * 100) : 100

  return {
    totalFindings,
    passed,
    failed,
    warnings,
    notApplicable,
    complianceScore,
  }
}

// ---------------------------------------------------------------------------
// Mock data collectors (production would query real audit/consent/RBAC stores)
// ---------------------------------------------------------------------------

/**
 * Collect HIPAA audit data from audit events.
 *
 * In production, this queries the audit log store (MongoDB/PostgreSQL) for
 * the given period. Tests inject mock collectors.
 */
/** Shape of a consent record as received for report generation. */
interface ConsentInput {
  id?: string
  status?: string
  treatmentType?: string
  patientId?: string
  expiryDate?: string
}

/** Shape of an audit event as received for report generation. */
interface AuditEventInput {
  id: string
  action?: string
  status?: string
  userId?: string
  resourceType?: string
  resourceId?: string
  timestamp?: string
  ipAddress?: string
  errorMessage?: string
  hash?: string
  previousHash?: string
  metadata?: { breakGlassReason?: string; [key: string]: unknown }
}

async function collectHipaaAuditData(
  params: ReportGenerationParams,
  auditEvents?: AuditEventInput[],
): Promise<HipaaAuditData> {
  const events = auditEvents ?? []

  const eventsByAction: Record<string, number> = {}
  const eventsByStatus: Record<string, number> = {}
  const breakGlassEvents: HipaaAuditData['breakGlassEvents'] = []
  const failedAttempts: HipaaAuditData['failedAttempts'] = []
  const userCounts: Record<string, number> = {}

  for (const event of events) {
    const action = event.action ?? 'unknown'
    const status = event.status ?? 'unknown'
    const userId = event.userId ?? 'unknown'

    eventsByAction[action] = (eventsByAction[action] ?? 0) + 1
    eventsByStatus[status] = (eventsByStatus[status] ?? 0) + 1
    userCounts[userId] = (userCounts[userId] ?? 0) + 1

    if (action === 'break-glass') {
      breakGlassEvents.push({
        timestamp: event.timestamp ?? '',
        userId,
        resourceType: event.resourceType ?? '',
        resourceId: event.resourceId ?? '',
        reason: event.metadata?.breakGlassReason ?? '',
        ...(event.ipAddress !== undefined ? { ipAddress: event.ipAddress } : {}),
      })
    }

    if (status === 'failure' || status === 'failed') {
      failedAttempts.push({
        timestamp: event.timestamp ?? '',
        userId,
        action,
        resource: event.resourceType ?? '',
        errorMessage: event.errorMessage ?? 'Unknown error',
      })
    }
  }

  const topUsers = Object.entries(userCounts)
    .map(([userId, eventCount]) => ({ userId, eventCount }))
    .sort((a, b) => b.eventCount - a.eventCount)
    .slice(0, 10)

  return {
    totalPhiAccessEvents: events.length,
    eventsByAction,
    eventsByStatus,
    breakGlassEvents,
    failedAttempts,
    chainVerification: verifyChain(events),
    uniqueUsers: Object.keys(userCounts).length,
    topUsers,
  }
}

/** Collect SOC 2 security data from RBAC and audit logs. */
async function collectSoc2SecurityData(
  _params: ReportGenerationParams,
  raw?: { roleAssignments?: Soc2SecurityData['roleAssignments']; accessChanges?: Soc2SecurityData['accessChanges']; incidents?: Soc2SecurityData['incidents']; failedAuthentications?: number; encryptionStatus?: Soc2SecurityData['encryptionStatus'] },
): Promise<Soc2SecurityData> {
  const roleAssignments = raw?.roleAssignments ?? []
  const accessChanges = raw?.accessChanges ?? []
  const incidents = raw?.incidents ?? []
  const failedAuthentications = raw?.failedAuthentications ?? 0

  return {
    roleAssignments,
    accessChanges,
    encryptionStatus: raw?.encryptionStatus ?? {
      atRest: true,
      inTransit: true,
      algorithm: 'AES-256-GCM',
      keyRotationDays: 90,
    },
    incidents,
    failedAuthentications,
  }
}

/** Collect SOC 2 availability data. */
async function collectSoc2AvailabilityData(
  _params: ReportGenerationParams,
  raw?: { uptimePercentage?: number; totalDowntimeMinutes?: number; backups?: Soc2AvailabilityData['backups']; disasterRecoveryTests?: Soc2AvailabilityData['disasterRecoveryTests']; healthChecks?: Soc2AvailabilityData['healthChecks'] },
): Promise<Soc2AvailabilityData> {
  return {
    uptimePercentage: raw?.uptimePercentage ?? 99.99,
    totalDowntimeMinutes: raw?.totalDowntimeMinutes ?? 4,
    backups: raw?.backups ?? [
      { type: 'database', lastRun: new Date().toISOString(), status: 'success', sizeBytes: 1024 * 1024 * 512 },
      { type: 'audit-log', lastRun: new Date().toISOString(), status: 'success', sizeBytes: 1024 * 1024 * 64 },
    ],
    disasterRecoveryTests: raw?.disasterRecoveryTests ?? [
      { testDate: new Date().toISOString(), rtoMinutes: 15, rpoMinutes: 5, passed: true },
    ],
    healthChecks: raw?.healthChecks ?? [
      { service: 'api', status: 'healthy', lastChecked: new Date().toISOString() },
      { service: 'database', status: 'healthy', lastChecked: new Date().toISOString() },
    ],
  }
}

/** Collect consent compliance data from consent records. */
async function collectConsentComplianceData(
  _params: ReportGenerationParams,
  raw?: { consents?: ConsentInput[]; renewals?: ConsentComplianceData['renewals']; withdrawals?: ConsentComplianceData['withdrawals'] },
): Promise<ConsentComplianceData> {
  const consents = raw?.consents ?? []
  const consentsByStatus: Record<string, number> = {}
  const consentsByTreatment: Record<string, number> = {}
  const expiringConsents: ConsentComplianceData['expiringConsents'] = []
  const expiredConsents: ConsentComplianceData['expiredConsents'] = []
  const now = new Date()
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  for (const consent of consents) {
    const status = consent.status ?? 'active'
    const treatmentType = consent.treatmentType ?? 'general'
    consentsByStatus[status] = (consentsByStatus[status] ?? 0) + 1
    consentsByTreatment[treatmentType] = (consentsByTreatment[treatmentType] ?? 0) + 1

    const expiryDateStr = consent.expiryDate
    if (expiryDateStr !== undefined) {
      const expiryDate = new Date(expiryDateStr)
      if (expiryDate < now) {
        expiredConsents.push({
          consentId: consent.id ?? '',
          patientId: consent.patientId ?? '',
          treatmentType,
          expiredDate: expiryDateStr,
        })
      } else if (expiryDate <= thirtyDaysFromNow) {
        expiringConsents.push({
          consentId: consent.id ?? '',
          patientId: consent.patientId ?? '',
          treatmentType,
          expiryDate: expiryDateStr,
        })
      }
    }
  }

  return {
    totalConsents: consents.length,
    consentsByStatus,
    consentsByTreatment,
    expiringConsents,
    expiredConsents,
    renewals: raw?.renewals ?? [],
    withdrawals: raw?.withdrawals ?? [],
  }
}

/** Collect access review data from RBAC. */
async function collectAccessReviewData(
  _params: ReportGenerationParams,
  raw?: { assignments?: AccessReviewData['assignments']; roleDefinitions?: AccessReviewData['roleDefinitions']; privilegedAccess?: AccessReviewData['privilegedAccess'] },
): Promise<AccessReviewData> {
  const assignments = raw?.assignments ?? []
  const roleDefinitions = raw?.roleDefinitions ?? []
  const privilegedAccess = raw?.privilegedAccess ?? []

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const dormantAccounts = assignments
    .filter((a) => a.lastAccessedAt && new Date(a.lastAccessedAt) < ninetyDaysAgo)
    .map((a) => ({
      userId: a.userId,
      role: a.role,
      lastAccessedAt: a.lastAccessedAt ?? '',
      daysDormant: a.lastAccessedAt
        ? Math.floor((Date.now() - new Date(a.lastAccessedAt).getTime()) / (24 * 60 * 60 * 1000))
        : 0,
    }))

  return {
    assignments,
    roleDefinitions,
    dormantAccounts,
    privilegedAccess,
  }
}

// ---------------------------------------------------------------------------
// Main report generator
// ---------------------------------------------------------------------------

/** Raw data inputs for report generation (all optional — injected by tests or production collectors). */
export interface ReportInputData {
  auditEvents?: AuditEventInput[]
  soc2Security?: {
    roleAssignments?: Soc2SecurityData['roleAssignments']
    accessChanges?: Soc2SecurityData['accessChanges']
    incidents?: Soc2SecurityData['incidents']
    failedAuthentications?: number
    encryptionStatus?: Soc2SecurityData['encryptionStatus']
  }
  soc2Availability?: {
    uptimePercentage?: number
    totalDowntimeMinutes?: number
    backups?: Soc2AvailabilityData['backups']
    disasterRecoveryTests?: Soc2AvailabilityData['disasterRecoveryTests']
    healthChecks?: Soc2AvailabilityData['healthChecks']
  }
  consents?: {
    consents?: Array<Record<string, unknown>>
    renewals?: ConsentComplianceData['renewals']
    withdrawals?: ConsentComplianceData['withdrawals']
  }
  accessReview?: {
    assignments?: AccessReviewData['assignments']
    roleDefinitions?: AccessReviewData['roleDefinitions']
    privilegedAccess?: AccessReviewData['privilegedAccess']
  }
}

/** Generate a compliance report from the given parameters. */
export async function generateReport(
  params: ReportGenerationParams,
  inputData?: ReportInputData,
): Promise<ComplianceReport> {
  const template = REPORT_TEMPLATES[params.type]
  if (!template) {
    throw new Error(`Unknown report type: ${params.type}`)
  }

  logger.info('Generating compliance report', { type: params.type, periodStart: params.periodStart })

  // Collect data for the report type
  let data: ReportData
  let chainVerification: ChainVerificationResult | undefined

  switch (params.type) {
    case 'hipaa-audit':
      data = await collectHipaaAuditData(params, inputData?.auditEvents)
      chainVerification = (data as HipaaAuditData).chainVerification
      break
    case 'soc2-security':
      data = await collectSoc2SecurityData(params, inputData?.soc2Security)
      break
    case 'soc2-availability':
      data = await collectSoc2AvailabilityData(params, inputData?.soc2Availability)
      break
    case 'consent-compliance':
      data = await collectConsentComplianceData(params, inputData?.consents)
      break
    case 'access-review':
      data = await collectAccessReviewData(params, inputData?.accessReview)
      break
    default:
      throw new Error(`Unsupported report type: ${params.type}`)
  }

  // Generate findings from template
  const findings = template.generateFindings(data)

  // Build summary
  const summary = buildSummary(findings)

  // Construct the report
  const report: ComplianceReport = {
    id: generateId(),
    type: params.type,
    title: template.title,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
    generatedAt: new Date().toISOString(),
    generatedBy: params.generatedBy,
    organization: params.organization,
    summary,
    findings,
    data,
  }

  if (chainVerification !== undefined) {
    report.chainVerification = chainVerification
  }

  logger.info('Compliance report generated', {
    reportId: report.id,
    type: params.type,
    findings: findings.length,
    complianceScore: summary.complianceScore,
  })

  return report
}

/** Generate all report types for a given period. */
export async function generateAllReports(
  params: Omit<ReportGenerationParams, 'type'>,
  inputData?: ReportInputData,
): Promise<ComplianceReport[]> {
  const types: ReportType[] = ['hipaa-audit', 'soc2-security', 'soc2-availability', 'consent-compliance', 'access-review']
  const reports: ComplianceReport[] = []

  for (const type of types) {
    try {
      const report = await generateReport({ ...params, type }, inputData)
      reports.push(report)
    } catch (error) {
      logger.error('Failed to generate report', { type, error })
    }
  }

  return reports
}

/** Get template metadata for a report type. */
export function getTemplate(type: ReportType): ReportTemplate {
  const template = REPORT_TEMPLATES[type]
  if (!template) {
    throw new Error(`Unknown report type: ${type}`)
  }
  return template
}

/** List all available report templates. */
export function listTemplates(): ReportTemplate[] {
  return Object.values(REPORT_TEMPLATES)
}
