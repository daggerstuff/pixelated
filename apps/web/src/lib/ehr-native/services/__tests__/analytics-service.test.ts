/**
 * Tests for EHR Analytics Service (PIX-4413)
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { ClinicalRole } from '@/lib/ehr-native/auth'
import {
  AnalyticsService,
  canAccessDashboard,
  getAccessibleDashboards,
  DASHBOARD_RBAC,
  DASHBOARD_TYPES,
  type AnalyticsRepository,
  type DashboardFilter,
  type DashboardType,
} from '@/lib/ehr-native/services/analytics.service'

// ---------------------------------------------------------------------------
// Mock repository factory
// ---------------------------------------------------------------------------

function createMockRepo(
  overrides: Partial<AnalyticsRepository> = {},
): AnalyticsRepository {
  return {
    countActivePatients: vi.fn().mockResolvedValue(100),
    countNewPatients: vi.fn().mockResolvedValue(10),
    countAppointments: vi.fn().mockResolvedValue(25),
    getNoShowRate: vi.fn().mockResolvedValue(0.12),
    getAverageWaitTime: vi.fn().mockResolvedValue(18),
    getProvidersOnDuty: vi.fn().mockResolvedValue(5),
    countOpenEncounters: vi.fn().mockResolvedValue(8),
    countPendingTasks: vi.fn().mockResolvedValue(15),
    getProviderLoad: vi
      .fn()
      .mockResolvedValue([
        { providerId: 'p1', providerName: 'Dr. Smith', patientCount: 30 },
      ]),
    getAppointmentTrend: vi
      .fn()
      .mockResolvedValue([{ date: '2024-01-01', count: 20 }]),

    getOutcomeScores: vi
      .fn()
      .mockResolvedValue({ average: 12.5, change: -2.1, trend: [] }),
    countAssessments: vi.fn().mockResolvedValue(50),
    countImprovedPatients: vi.fn().mockResolvedValue(15),
    countDeterioratedPatients: vi.fn().mockResolvedValue(3),

    countEncounters: vi.fn().mockResolvedValue(200),
    countEncountersByType: vi
      .fn()
      .mockResolvedValue({ inPerson: 150, telehealth: 50 }),
    getAverageVisitDuration: vi.fn().mockResolvedValue(22),
    getRoomUtilization: vi.fn().mockResolvedValue(0.65),
    getEncounterTrend: vi.fn().mockResolvedValue([]),
    getDepartmentBreakdown: vi.fn().mockResolvedValue([]),

    getTotalCharges: vi.fn().mockResolvedValue(500000),
    getTotalCollections: vi.fn().mockResolvedValue(350000),
    getOutstandingAR: vi.fn().mockResolvedValue(150000),
    getDaysInAR: vi.fn().mockResolvedValue(32),
    getClaimDenialRate: vi.fn().mockResolvedValue(0.08),
    getCleanClaimRate: vi.fn().mockResolvedValue(0.92),
    getAverageReimbursement: vi.fn().mockResolvedValue(125),
    getClaimsByStatus: vi.fn().mockResolvedValue([]),
    getTopPayers: vi.fn().mockResolvedValue([]),
    getRevenueTrend: vi.fn().mockResolvedValue([]),

    countAuditEvents: vi.fn().mockResolvedValue(500),
    countAccessViolations: vi.fn().mockResolvedValue(5),
    countBreakGlassEvents: vi.fn().mockResolvedValue(2),
    countPhiExports: vi.fn().mockResolvedValue(8),
    getConsentCoverage: vi.fn().mockResolvedValue(0.95),
    getTrainingCompletion: vi
      .fn()
      .mockResolvedValue({ completion: 0.88, overdue: 3 }),
    getAuditByCategory: vi.fn().mockResolvedValue([]),
    getViolationTrend: vi.fn().mockResolvedValue([]),
    getTrainingByRole: vi.fn().mockResolvedValue([]),
    ...overrides,
  }
}

const baseFilter: DashboardFilter = {
  timeRange: { start: '2024-01-01T00:00:00Z', end: '2024-01-31T23:59:59Z' },
}

// ---------------------------------------------------------------------------
// RBAC tests
// ---------------------------------------------------------------------------

describe('canAccessDashboard', () => {
  it('returns true for physician on practice dashboard', () => {
    expect(canAccessDashboard('physician', 'practice')).toBe(true)
  })

  it('returns true for physician on outcomes dashboard', () => {
    expect(canAccessDashboard('physician', 'outcomes')).toBe(true)
  })

  it('returns true for physician on utilization dashboard', () => {
    expect(canAccessDashboard('physician', 'utilization')).toBe(true)
  })

  it('returns false for frontDesk on compliance dashboard', () => {
    expect(canAccessDashboard('frontDesk', 'compliance')).toBe(false)
  })

  it('returns false for frontDesk on billing dashboard', () => {
    expect(canAccessDashboard('frontDesk', 'billing')).toBe(false)
  })

  it('returns true for systemAdmin on all dashboards', () => {
    for (const type of DASHBOARD_TYPES) {
      expect(canAccessDashboard('systemAdmin', type)).toBe(true)
    }
  })
})

describe('getAccessibleDashboards', () => {
  it('returns subset of dashboards for a role', () => {
    const dashboards = getAccessibleDashboards('physician')
    expect(dashboards).toContain('practice')
    expect(dashboards).toContain('outcomes')
    expect(dashboards).toContain('utilization')
  })

  it('returns all dashboards for systemAdmin', () => {
    const dashboards = getAccessibleDashboards('systemAdmin')
    expect(dashboards).toHaveLength(DASHBOARD_TYPES.length)
  })
})

describe('DASHBOARD_RBAC', () => {
  it('has an entry for every dashboard type', () => {
    for (const type of DASHBOARD_TYPES) {
      expect(DASHBOARD_RBAC[type]).toBeDefined()
      expect(Array.isArray(DASHBOARD_RBAC[type])).toBe(true)
    }
  })

  it('each dashboard requires at least one permission', () => {
    for (const type of DASHBOARD_TYPES) {
      expect(DASHBOARD_RBAC[type].length).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// AnalyticsService — Practice dashboard
// ---------------------------------------------------------------------------

describe('AnalyticsService.getPracticeDashboard', () => {
  let repo: AnalyticsRepository
  let service: AnalyticsService

  beforeEach(() => {
    repo = createMockRepo()
    service = new AnalyticsService(repo)
  })

  it('returns practice metrics with correct shape', async () => {
    const metrics = await service.getPracticeDashboard('physician', baseFilter)
    expect(metrics).toMatchObject({
      totalPatients: 100,
      activePatients: 100,
      newPatients: 10,
      appointmentsToday: 25,
      noShowRate: 0.12,
      providersOnDuty: 5,
      openEncounters: 8,
      pendingTasks: 15,
    })
    expect(metrics.providerLoad).toHaveLength(1)
    expect(metrics.appointmentTrend).toHaveLength(1)
  })

  it('calls all repository methods in parallel', async () => {
    await service.getPracticeDashboard('physician', baseFilter)
    expect(repo.countActivePatients).toHaveBeenCalledWith(baseFilter)
    expect(repo.countNewPatients).toHaveBeenCalledWith(baseFilter)
    expect(repo.countAppointments).toHaveBeenCalledWith(baseFilter, 'today')
    expect(repo.countAppointments).toHaveBeenCalledWith(baseFilter, 'week')
    expect(repo.getNoShowRate).toHaveBeenCalledWith(baseFilter)
    expect(repo.getAverageWaitTime).toHaveBeenCalledWith(baseFilter)
    expect(repo.getProvidersOnDuty).toHaveBeenCalled()
    expect(repo.countOpenEncounters).toHaveBeenCalledWith(baseFilter)
    expect(repo.countPendingTasks).toHaveBeenCalledWith(baseFilter)
    expect(repo.getProviderLoad).toHaveBeenCalledWith(baseFilter)
    expect(repo.getAppointmentTrend).toHaveBeenCalledWith(baseFilter)
  })

  it('throws for role without practice permissions', async () => {
    await expect(
      service.getPracticeDashboard('complianceOfficer', baseFilter),
    ).rejects.toThrow(/does not have permission/)
  })
})

// ---------------------------------------------------------------------------
// AnalyticsService — Outcomes dashboard
// ---------------------------------------------------------------------------

describe('AnalyticsService.getOutcomesDashboard', () => {
  let repo: AnalyticsRepository
  let service: AnalyticsService

  beforeEach(() => {
    repo = createMockRepo()
    service = new AnalyticsService(repo)
  })

  it('returns outcomes metrics with PHQ-9, GAD-7, OQ-45 data', async () => {
    const metrics = await service.getOutcomesDashboard('physician', baseFilter)
    expect(metrics.phq9Average).toBe(12.5)
    expect(metrics.phq9Change).toBe(-2.1)
    expect(metrics.gad7Average).toBe(12.5)
    expect(metrics.oq45Average).toBe(12.5)
    expect(metrics.totalAssessments).toBe(50)
    expect(metrics.improvedPatients).toBe(15)
    expect(metrics.deterioratedPatients).toBe(3)
    expect(metrics.trends).toHaveLength(3)
    expect(metrics.trends[0].measure).toBe('PHQ-9')
    expect(metrics.trends[1].measure).toBe('GAD-7')
    expect(metrics.trends[2].measure).toBe('OQ-45')
  })

  it('calls getOutcomeScores for all three measures', async () => {
    await service.getOutcomesDashboard('physician', baseFilter)
    expect(repo.getOutcomeScores).toHaveBeenCalledWith(baseFilter, 'PHQ-9')
    expect(repo.getOutcomeScores).toHaveBeenCalledWith(baseFilter, 'GAD-7')
    expect(repo.getOutcomeScores).toHaveBeenCalledWith(baseFilter, 'OQ-45')
  })
})

// ---------------------------------------------------------------------------
// AnalyticsService — Utilization dashboard
// ---------------------------------------------------------------------------

describe('AnalyticsService.getUtilizationDashboard', () => {
  let repo: AnalyticsRepository
  let service: AnalyticsService

  beforeEach(() => {
    repo = createMockRepo()
    service = new AnalyticsService(repo)
  })

  it('calculates telehealth rate from byType data', async () => {
    const metrics = await service.getUtilizationDashboard(
      'physician',
      baseFilter,
    )
    expect(metrics.totalEncounters).toBe(200)
    expect(metrics.inPersonVisits).toBe(150)
    expect(metrics.telehealthVisits).toBe(50)
    expect(metrics.telehealthRate).toBeCloseTo(0.25, 5)
  })

  it('telehealth rate is 0 when totalEncounters is 0', async () => {
    repo = createMockRepo({ countEncounters: vi.fn().mockResolvedValue(0) })
    service = new AnalyticsService(repo)
    const metrics = await service.getUtilizationDashboard(
      'physician',
      baseFilter,
    )
    expect(metrics.telehealthRate).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// AnalyticsService — Billing dashboard
// ---------------------------------------------------------------------------

describe('AnalyticsService.getBillingDashboard', () => {
  let repo: AnalyticsRepository
  let service: AnalyticsService

  beforeEach(() => {
    repo = createMockRepo()
    service = new AnalyticsService(repo)
  })

  it('returns billing metrics and calculates collectionsRate', async () => {
    const metrics = await service.getBillingDashboard(
      'billingSpecialist',
      baseFilter,
    )
    expect(metrics.totalCharges).toBe(500000)
    expect(metrics.totalCollections).toBe(350000)
    expect(metrics.collectionsRate).toBeCloseTo(0.7, 5)
    expect(metrics.claimDenialRate).toBe(0.08)
    expect(metrics.cleanClaimRate).toBe(0.92)
  })

  it('collectionsRate is 0 when totalCharges is 0', async () => {
    repo = createMockRepo({ getTotalCharges: vi.fn().mockResolvedValue(0) })
    service = new AnalyticsService(repo)
    const metrics = await service.getBillingDashboard(
      'billingSpecialist',
      baseFilter,
    )
    expect(metrics.collectionsRate).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// AnalyticsService — Compliance dashboard
// ---------------------------------------------------------------------------

describe('AnalyticsService.getComplianceDashboard', () => {
  let repo: AnalyticsRepository
  let service: AnalyticsService

  beforeEach(() => {
    repo = createMockRepo()
    service = new AnalyticsService(repo)
  })

  it('returns compliance metrics from repository', async () => {
    const metrics = await service.getComplianceDashboard(
      'complianceOfficer',
      baseFilter,
    )
    expect(metrics.totalAuditEvents).toBe(500)
    expect(metrics.accessViolations).toBe(5)
    expect(metrics.breakGlassEvents).toBe(2)
    expect(metrics.phiExports).toBe(8)
    expect(metrics.consentCoverage).toBe(0.95)
    expect(metrics.requiredTrainingCompletion).toBe(0.88)
    expect(metrics.overdueTraining).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// AnalyticsService — Generic dispatch
// ---------------------------------------------------------------------------

describe('AnalyticsService.getDashboard', () => {
  it('dispatches to getPracticeDashboard for "practice"', async () => {
    const repo = createMockRepo()
    const service = new AnalyticsService(repo)
    const result = await service.getDashboard(
      'practice',
      'physician',
      baseFilter,
    )
    expect(result).toHaveProperty('totalPatients')
  })

  it('dispatches to getOutcomesDashboard for "outcomes"', async () => {
    const repo = createMockRepo()
    const service = new AnalyticsService(repo)
    const result = await service.getDashboard(
      'outcomes',
      'physician',
      baseFilter,
    )
    expect(result).toHaveProperty('phq9Average')
  })

  it('dispatches to getBillingDashboard for "billing"', async () => {
    const repo = createMockRepo()
    const service = new AnalyticsService(repo)
    const result = await service.getDashboard(
      'billing',
      'billingSpecialist',
      baseFilter,
    )
    expect(result).toHaveProperty('totalCharges')
  })

  it('throws on unauthorized access', async () => {
    const repo = createMockRepo()
    const service = new AnalyticsService(repo)
    await expect(
      service.getDashboard('compliance', 'frontDesk', baseFilter),
    ).rejects.toThrow(/does not have permission/)
  })
})
