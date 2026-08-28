/**
 * @file analytics.service.ts
 * @description EHR Analytics Service for customizable dashboards.
 * Provides data aggregation across 5 dashboard types:
 *   - Practice overview
 *   - Clinical outcomes
 *   - Utilization metrics
 *   - Billing & claims
 *   - Compliance & audit
 *
 * Follows EHR service patterns: repository injection, typed Records, JSDoc.
 * @module ehr-native/services/analytics
 */

import type { ClinicalRole } from '../auth/index.js'
import { roleHasPermission } from '../auth/index.js'
import type { EHRPermission } from '../auth/index.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DashboardType =
  'practice' | 'outcomes' | 'utilization' | 'billing' | 'compliance'

export const DASHBOARD_TYPES: readonly DashboardType[] = [
  'practice',
  'outcomes',
  'utilization',
  'billing',
  'compliance',
] as const

export interface TimeRange {
  /** ISO date string */
  start: string
  /** ISO date string */
  end: string
}

export interface DashboardFilter {
  timeRange: TimeRange
  /** Optional clinic/site filter */
  siteId?: string
  /** Optional provider filter */
  providerId?: string
  /** Optional payer/insurance filter (billing only) */
  payerId?: string
}

// ---------------------------------------------------------------------------
// Dashboard data shapes (one per type)
// ---------------------------------------------------------------------------

export interface PracticeMetrics {
  totalPatients: number
  activePatients: number
  newPatients: number
  appointmentsToday: number
  appointmentsThisWeek: number
  noShowRate: number
  averageWaitTimeMinutes: number
  providersOnDuty: number
  openEncounters: number
  pendingTasks: number
  /** Per-provider patient counts (top 10) */
  providerLoad: Array<{
    providerId: string
    providerName: string
    patientCount: number
  }>
  /** Appointments by day for the selected range */
  appointmentTrend: Array<{ date: string; count: number }>
}

export interface OutcomesMetrics {
  /** PHQ-9 average score and change */
  phq9Average: number
  phq9Change: number
  /** GAD-7 average score and change */
  gad7Average: number
  gad7Change: number
  /** OQ-45 average score and change */
  oq45Average: number
  oq45Change: number
  /** Total assessments administered */
  totalAssessments: number
  /** Patients showing clinically significant improvement */
  improvedPatients: number
  /** Patients showing deterioration */
  deterioratedPatients: number
  /** Per-measure trend data for charts */
  trends: Array<{
    measure: 'PHQ-9' | 'GAD-7' | 'OQ-45'
    data: Array<{ date: string; score: number }>
  }>
}

export interface UtilizationMetrics {
  totalEncounters: number
  inPersonVisits: number
  telehealthVisits: number
  telehealthRate: number
  averageVisitDurationMinutes: number
  bedDaysUtilization: number
  roomUtilizationRate: number
  peakHoursUtilization: number
  /** Encounter volume by day */
  encounterTrend: Array<{ date: string; inPerson: number; telehealth: number }>
  /** Utilization by department */
  departmentBreakdown: Array<{
    department: string
    encounters: number
    utilizationRate: number
  }>
}

export interface BillingMetrics {
  totalCharges: number
  totalCollections: number
  outstandingAR: number
  daysInAR: number
  claimDenialRate: number
  cleanClaimRate: number
  averageReimbursement: number
  collectionsRate: number
  /** Claims by status */
  claimsByStatus: Array<{ status: string; count: number; amount: number }>
  /** Top payers by volume */
  topPayers: Array<{
    payerId: string
    payerName: string
    charges: number
    payments: number
  }>
  /** Monthly revenue trend */
  revenueTrend: Array<{ month: string; charges: number; collections: number }>
}

export interface ComplianceMetrics {
  totalAuditEvents: number
  accessViolations: number
  breakGlassEvents: number
  phiExports: number
  consentCoverage: number
  requiredTrainingCompletion: number
  overdueTraining: number
  /** Audit events by category */
  auditByCategory: Array<{ category: string; count: number }>
  /** Access violations over time */
  violationTrend: Array<{ date: string; count: number }>
  /** Training completion by role */
  trainingByRole: Array<{ role: string; completed: number; required: number }>
}

export type DashboardMetrics =
  | PracticeMetrics
  | OutcomesMetrics
  | UtilizationMetrics
  | BillingMetrics
  | ComplianceMetrics

// ---------------------------------------------------------------------------
// Dashboard RBAC configuration
// ---------------------------------------------------------------------------

export const DASHBOARD_RBAC: Record<DashboardType, EHRPermission[]> = {
  practice: ['read_patient', 'read_schedule'],
  outcomes: ['read_observation', 'read_patient'],
  utilization: ['read_encounter', 'read_patient'],
  billing: ['read_claim', 'submit_claim'],
  compliance: ['audit_access', 'read_patient'],
}

/**
 * Check whether a clinical role can access a given dashboard type.
 */
export function canAccessDashboard(
  role: ClinicalRole,
  type: DashboardType,
): boolean {
  const required = DASHBOARD_RBAC[type]
  return required.every((perm) => roleHasPermission(role, perm))
}

/**
 * Return the dashboard types accessible to a given role.
 */
export function getAccessibleDashboards(role: ClinicalRole): DashboardType[] {
  return DASHBOARD_TYPES.filter((t) => canAccessDashboard(role, t))
}

// ---------------------------------------------------------------------------
// Repository interface (injected — real implementation provided by caller)
// ---------------------------------------------------------------------------

export interface AnalyticsRepository {
  countActivePatients(filter: DashboardFilter): Promise<number>
  countNewPatients(filter: DashboardFilter): Promise<number>
  countAppointments(
    filter: DashboardFilter,
    scope: 'today' | 'week',
  ): Promise<number>
  getNoShowRate(filter: DashboardFilter): Promise<number>
  getAverageWaitTime(filter: DashboardFilter): Promise<number>
  getProvidersOnDuty(): Promise<number>
  countOpenEncounters(filter: DashboardFilter): Promise<number>
  countPendingTasks(filter: DashboardFilter): Promise<number>
  getProviderLoad(
    filter: DashboardFilter,
  ): Promise<PracticeMetrics['providerLoad']>
  getAppointmentTrend(
    filter: DashboardFilter,
  ): Promise<PracticeMetrics['appointmentTrend']>

  getOutcomeScores(
    filter: DashboardFilter,
    measure: 'PHQ-9' | 'GAD-7' | 'OQ-45',
  ): Promise<{
    average: number
    change: number
    trend: Array<{ date: string; score: number }>
  }>
  countAssessments(filter: DashboardFilter): Promise<number>
  countImprovedPatients(filter: DashboardFilter): Promise<number>
  countDeterioratedPatients(filter: DashboardFilter): Promise<number>

  countEncounters(filter: DashboardFilter): Promise<number>
  countEncountersByType(
    filter: DashboardFilter,
  ): Promise<{ inPerson: number; telehealth: number }>
  getAverageVisitDuration(filter: DashboardFilter): Promise<number>
  getRoomUtilization(filter: DashboardFilter): Promise<number>
  getEncounterTrend(
    filter: DashboardFilter,
  ): Promise<Array<{ date: string; inPerson: number; telehealth: number }>>
  getDepartmentBreakdown(
    filter: DashboardFilter,
  ): Promise<UtilizationMetrics['departmentBreakdown']>

  getTotalCharges(filter: DashboardFilter): Promise<number>
  getTotalCollections(filter: DashboardFilter): Promise<number>
  getOutstandingAR(): Promise<number>
  getDaysInAR(): Promise<number>
  getClaimDenialRate(filter: DashboardFilter): Promise<number>
  getCleanClaimRate(filter: DashboardFilter): Promise<number>
  getAverageReimbursement(filter: DashboardFilter): Promise<number>
  getClaimsByStatus(
    filter: DashboardFilter,
  ): Promise<BillingMetrics['claimsByStatus']>
  getTopPayers(filter: DashboardFilter): Promise<BillingMetrics['topPayers']>
  getRevenueTrend(
    filter: DashboardFilter,
  ): Promise<BillingMetrics['revenueTrend']>

  countAuditEvents(filter: DashboardFilter): Promise<number>
  countAccessViolations(filter: DashboardFilter): Promise<number>
  countBreakGlassEvents(filter: DashboardFilter): Promise<number>
  countPhiExports(filter: DashboardFilter): Promise<number>
  getConsentCoverage(filter: DashboardFilter): Promise<number>
  getTrainingCompletion(): Promise<{ completion: number; overdue: number }>
  getAuditByCategory(
    filter: DashboardFilter,
  ): Promise<ComplianceMetrics['auditByCategory']>
  getViolationTrend(
    filter: DashboardFilter,
  ): Promise<ComplianceMetrics['violationTrend']>
  getTrainingByRole(): Promise<ComplianceMetrics['trainingByRole']>
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * AnalyticsService — aggregates dashboard data from injected repositories.
 *
 * Each `get*Dashboard` method enforces RBAC before returning data.
 */
export class AnalyticsService {
  constructor(private readonly repo: AnalyticsRepository) {}

  // ---- Practice ----

  async getPracticeDashboard(
    role: ClinicalRole,
    filter: DashboardFilter,
  ): Promise<PracticeMetrics> {
    this.assertAccess(role, 'practice')

    const [
      activePatients,
      newPatients,
      appointmentsToday,
      appointmentsThisWeek,
      noShowRate,
      averageWaitTimeMinutes,
      providersOnDuty,
      openEncounters,
      pendingTasks,
      providerLoad,
      appointmentTrend,
    ] = await Promise.all([
      this.repo.countActivePatients(filter),
      this.repo.countNewPatients(filter),
      this.repo.countAppointments(filter, 'today'),
      this.repo.countAppointments(filter, 'week'),
      this.repo.getNoShowRate(filter),
      this.repo.getAverageWaitTime(filter),
      this.repo.getProvidersOnDuty(),
      this.repo.countOpenEncounters(filter),
      this.repo.countPendingTasks(filter),
      this.repo.getProviderLoad(filter),
      this.repo.getAppointmentTrend(filter),
    ])

    return {
      totalPatients: activePatients,
      activePatients,
      newPatients,
      appointmentsToday,
      appointmentsThisWeek,
      noShowRate,
      averageWaitTimeMinutes,
      providersOnDuty,
      openEncounters,
      pendingTasks,
      providerLoad,
      appointmentTrend,
    }
  }

  // ---- Outcomes ----

  async getOutcomesDashboard(
    role: ClinicalRole,
    filter: DashboardFilter,
  ): Promise<OutcomesMetrics> {
    this.assertAccess(role, 'outcomes')

    const [phq9, gad7, oq45, totalAssessments, improved, deteriorated] =
      await Promise.all([
        this.repo.getOutcomeScores(filter, 'PHQ-9'),
        this.repo.getOutcomeScores(filter, 'GAD-7'),
        this.repo.getOutcomeScores(filter, 'OQ-45'),
        this.repo.countAssessments(filter),
        this.repo.countImprovedPatients(filter),
        this.repo.countDeterioratedPatients(filter),
      ])

    return {
      phq9Average: phq9.average,
      phq9Change: phq9.change,
      gad7Average: gad7.average,
      gad7Change: gad7.change,
      oq45Average: oq45.average,
      oq45Change: oq45.change,
      totalAssessments,
      improvedPatients: improved,
      deterioratedPatients: deteriorated,
      trends: [
        { measure: 'PHQ-9', data: phq9.trend },
        { measure: 'GAD-7', data: gad7.trend },
        { measure: 'OQ-45', data: oq45.trend },
      ],
    }
  }

  // ---- Utilization ----

  async getUtilizationDashboard(
    role: ClinicalRole,
    filter: DashboardFilter,
  ): Promise<UtilizationMetrics> {
    this.assertAccess(role, 'utilization')

    const [totalEncounters, byType, avgDuration, roomUtil, trend, depts] =
      await Promise.all([
        this.repo.countEncounters(filter),
        this.repo.countEncountersByType(filter),
        this.repo.getAverageVisitDuration(filter),
        this.repo.getRoomUtilization(filter),
        this.repo.getEncounterTrend(filter),
        this.repo.getDepartmentBreakdown(filter),
      ])

    return {
      totalEncounters,
      inPersonVisits: byType.inPerson,
      telehealthVisits: byType.telehealth,
      telehealthRate:
        totalEncounters > 0 ? byType.telehealth / totalEncounters : 0,
      averageVisitDurationMinutes: avgDuration,
      bedDaysUtilization: 0,
      roomUtilizationRate: roomUtil,
      peakHoursUtilization: 0,
      encounterTrend: trend,
      departmentBreakdown: depts,
    }
  }

  // ---- Billing ----

  async getBillingDashboard(
    role: ClinicalRole,
    filter: DashboardFilter,
  ): Promise<BillingMetrics> {
    this.assertAccess(role, 'billing')

    const [
      totalCharges,
      totalCollections,
      outstandingAR,
      daysInAR,
      denialRate,
      cleanClaimRate,
      avgReimbursement,
      claimsByStatus,
      topPayers,
      revenueTrend,
    ] = await Promise.all([
      this.repo.getTotalCharges(filter),
      this.repo.getTotalCollections(filter),
      this.repo.getOutstandingAR(),
      this.repo.getDaysInAR(),
      this.repo.getClaimDenialRate(filter),
      this.repo.getCleanClaimRate(filter),
      this.repo.getAverageReimbursement(filter),
      this.repo.getClaimsByStatus(filter),
      this.repo.getTopPayers(filter),
      this.repo.getRevenueTrend(filter),
    ])

    return {
      totalCharges,
      totalCollections,
      outstandingAR,
      daysInAR,
      claimDenialRate: denialRate,
      cleanClaimRate,
      averageReimbursement: avgReimbursement,
      collectionsRate: totalCharges > 0 ? totalCollections / totalCharges : 0,
      claimsByStatus,
      topPayers,
      revenueTrend,
    }
  }

  // ---- Compliance ----

  async getComplianceDashboard(
    role: ClinicalRole,
    filter: DashboardFilter,
  ): Promise<ComplianceMetrics> {
    this.assertAccess(role, 'compliance')

    const [
      totalAuditEvents,
      accessViolations,
      breakGlassEvents,
      phiExports,
      consentCoverage,
      training,
      auditByCategory,
      violationTrend,
      trainingByRole,
    ] = await Promise.all([
      this.repo.countAuditEvents(filter),
      this.repo.countAccessViolations(filter),
      this.repo.countBreakGlassEvents(filter),
      this.repo.countPhiExports(filter),
      this.repo.getConsentCoverage(filter),
      this.repo.getTrainingCompletion(),
      this.repo.getAuditByCategory(filter),
      this.repo.getViolationTrend(filter),
      this.repo.getTrainingByRole(),
    ])

    return {
      totalAuditEvents,
      accessViolations,
      breakGlassEvents,
      phiExports,
      consentCoverage,
      requiredTrainingCompletion: training.completion,
      overdueTraining: training.overdue,
      auditByCategory,
      violationTrend,
      trainingByRole,
    }
  }

  // ---- Generic dispatch ----

  async getDashboard<T extends DashboardType>(
    type: T,
    role: ClinicalRole,
    filter: DashboardFilter,
  ): Promise<DashboardMetrics> {
    switch (type) {
      case 'practice':
        return this.getPracticeDashboard(role, filter)
      case 'outcomes':
        return this.getOutcomesDashboard(role, filter)
      case 'utilization':
        return this.getUtilizationDashboard(role, filter)
      case 'billing':
        return this.getBillingDashboard(role, filter)
      case 'compliance':
        return this.getComplianceDashboard(role, filter)
      default: {
        const exhaustive: never = type
        throw new Error(`Unknown dashboard type: ${String(exhaustive)}`)
      }
    }
  }

  // ---- RBAC guard ----

  private assertAccess(role: ClinicalRole, type: DashboardType): void {
    if (!canAccessDashboard(role, type)) {
      throw new Error(
        `Role "${role}" does not have permission to access the "${type}" dashboard.`,
      )
    }
  }
}
