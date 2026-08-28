/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ehr-native/auth/ehr-rbac', () => ({
  verifyPatientConsent: vi.fn(),
  checkPermission: vi.fn(),
  activateBreakGlass: vi.fn(),
  checkPermissionWithBreakGlass: vi.fn(),
  logEHRAccess: vi.fn(),
}))

import type { ClinicalRole } from '@/lib/ehr-native/auth'
import {
  canAccessDashboard,
  getAccessibleDashboards,
  AnalyticsService,
} from '@/lib/ehr-native/services/analytics.service'
import type {
  DashboardType,
  DashboardFilter,
  AnalyticsRepository,
} from '@/lib/ehr-native/services/analytics.service'

import { dashboardToCSV, exportDashboardCSV } from '../dashboard-export'
import { savedViewsService } from '../saved-views-service'
import {
  DASHBOARD_TYPES,
  DASHBOARD_RBAC,
  WIDGET_REGISTRY,
  canViewWidget,
  getAccessibleWidgets,
  createDefaultLayout,
} from '../types'

// ─── helpers ──────────────────────────────────────────────
function createMockRepo(): AnalyticsRepository {
  return {
    countActivePatients: vi.fn().mockResolvedValue(120),
    countNewPatients: vi.fn().mockResolvedValue(8),
    countAppointments: vi.fn().mockResolvedValue(25),
    getNoShowRate: vi.fn().mockResolvedValue(0.1),
    getAverageWaitTime: vi.fn().mockResolvedValue(12),
    getProvidersOnDuty: vi.fn().mockResolvedValue(15),
    countOpenEncounters: vi.fn().mockResolvedValue(10),
    countPendingTasks: vi.fn().mockResolvedValue(5),
    getProviderLoad: vi.fn().mockResolvedValue([
      { providerId: 'p1', providerName: 'Dr. Smith', patientCount: 40 },
      { providerId: 'p2', providerName: 'Dr. Jones', patientCount: 30 },
    ]),
    getAppointmentTrend: vi.fn().mockResolvedValue([
      { date: '2025-01-01', count: 20 },
      { date: '2025-01-02', count: 25 },
    ]),
    getOutcomeScores: vi.fn().mockResolvedValue({
      average: 12,
      change: -3,
      trend: [{ date: '2025-01-01', score: 15 }],
    }),
    countAssessments: vi.fn().mockResolvedValue(50),
    countImprovedPatients: vi.fn().mockResolvedValue(15),
    countDeterioratedPatients: vi.fn().mockResolvedValue(5),
    countEncounters: vi.fn().mockResolvedValue(200),
    countEncountersByType: vi
      .fn()
      .mockResolvedValue({ inPerson: 140, telehealth: 60 }),
    getAverageVisitDuration: vi.fn().mockResolvedValue(20),
    getRoomUtilization: vi.fn().mockResolvedValue(0.75),
    getEncounterTrend: vi
      .fn()
      .mockResolvedValue([{ date: '2025-01-01', inPerson: 10, telehealth: 5 }]),
    getDepartmentBreakdown: vi
      .fn()
      .mockResolvedValue([
        { department: 'Cardiology', encounters: 50, utilizationRate: 0.8 },
      ]),
    getTotalCharges: vi.fn().mockResolvedValue(150000),
    getTotalCollections: vi.fn().mockResolvedValue(127500),
    getOutstandingAR: vi.fn().mockResolvedValue(22500),
    getDaysInAR: vi.fn().mockResolvedValue(35),
    getClaimDenialRate: vi.fn().mockResolvedValue(0.05),
    getCleanClaimRate: vi.fn().mockResolvedValue(0.95),
    getAverageReimbursement: vi.fn().mockResolvedValue(250),
    getClaimsByStatus: vi.fn().mockResolvedValue([
      { status: 'approved', count: 30, amount: 7500 },
      { status: 'pending', count: 10, amount: 2500 },
    ]),
    getTopPayers: vi
      .fn()
      .mockResolvedValue([
        { payerId: 'p1', payerName: 'Aetna', charges: 50000, payments: 42500 },
      ]),
    getRevenueTrend: vi
      .fn()
      .mockResolvedValue([
        { month: '2025-01', charges: 50000, collections: 42500 },
      ]),
    countAuditEvents: vi.fn().mockResolvedValue(500),
    countAccessViolations: vi.fn().mockResolvedValue(3),
    countBreakGlassEvents: vi.fn().mockResolvedValue(2),
    countPhiExports: vi.fn().mockResolvedValue(10),
    getConsentCoverage: vi.fn().mockResolvedValue(0.98),
    getTrainingCompletion: vi
      .fn()
      .mockResolvedValue({ completion: 0.88, overdue: 0.12 }),
    getAuditByCategory: vi
      .fn()
      .mockResolvedValue([{ category: 'login', count: 200 }]),
    getViolationTrend: vi
      .fn()
      .mockResolvedValue([{ date: '2025-01-01', count: 1 }]),
    getTrainingByRole: vi
      .fn()
      .mockResolvedValue([{ role: 'physician', completed: 8, required: 10 }]),
  }
}

const defaultFilter: DashboardFilter = {
  timeRange: { start: '2025-01-01', end: '2025-12-31' },
}

function makeView(
  id: string,
  dashboard: DashboardType,
  widgets: string[] = ['widget-1', 'widget-2'],
) {
  return {
    id,
    name: `View ${id}`,
    dashboard,
    isDefault: false,
    isShared: false,
    ownerId: 'user-1',
    widgets: widgets.map((w, i) => ({
      widgetId: w,
      colSpan: 4,
      rowSpan: 2,
      order: i,
    })),
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  }
}

// ─── RBAC integration ──────────────────────────────────────
describe('Dashboard RBAC integration', () => {
  it('enforces RBAC on dashboard access for every role × dashboard combination', () => {
    const roles: ClinicalRole[] = [
      'physician',
      'nurse',
      'frontDesk',
      'billingSpecialist',
      'complianceOfficer',
      'systemAdmin',
    ]
    for (const role of roles) {
      const accessible = getAccessibleDashboards(role)
      // systemAdmin should access all dashboards
      if (role === 'systemAdmin') {
        expect(accessible).toEqual(expect.arrayContaining(DASHBOARD_TYPES))
      }
      // billingSpecialist should access billing dashboard
      if (role === 'billingSpecialist') {
        expect(accessible).toContain('billing')
      }
      // complianceOfficer should access compliance dashboard
      if (role === 'complianceOfficer') {
        expect(accessible).toContain('compliance')
      }
      // Every role should access at least one dashboard
      expect(accessible.length).toBeGreaterThan(0)
    }
  })

  it('enforces widget-level RBAC consistently with dashboard access', () => {
    const role: ClinicalRole = 'billingSpecialist'
    const accessibleDashboards = getAccessibleDashboards(role)
    for (const widget of WIDGET_REGISTRY) {
      const canView = canViewWidget(role, widget)
      const canAccessDashboard = accessibleDashboards.includes(widget.dashboard)
      if (!canAccessDashboard) {
        expect(canView).toBe(false)
      }
    }
  })

  it('filters accessible widgets by role for each dashboard', () => {
    for (const dashboard of DASHBOARD_TYPES) {
      const physicianWidgets = getAccessibleWidgets('physician', dashboard)
      const adminWidgets = getAccessibleWidgets('systemAdmin', dashboard)
      expect(adminWidgets.length).toBeGreaterThanOrEqual(
        physicianWidgets.length,
      )
    }
  })
})

// ─── Export round-trip ─────────────────────────────────────
describe('Export round-trip integration', () => {
  it('generates CSV from full dashboard export data', () => {
    const exportData = {
      dashboard: 'practice' as const,
      title: 'Practice Dashboard',
      generatedAt: '2025-01-01T00:00:00Z',
      filters: {},
      sections: [
        {
          name: 'Key Metrics',
          columns: [
            { key: 'metric', label: 'Metric' },
            { key: 'value', label: 'Value' },
          ],
          rows: [
            { metric: 'Active Patients', value: '120' },
            { metric: 'Encounters Today', value: '25' },
            { metric: 'Providers', value: '15' },
          ],
        },
        {
          name: 'Provider Utilization',
          columns: [
            { key: 'provider', label: 'Provider' },
            { key: 'utilization', label: 'Utilization %' },
          ],
          rows: [
            { provider: 'Dr. Smith', utilization: '90%' },
            { provider: 'Dr. Jones', utilization: '70%' },
          ],
        },
      ],
    }
    const csv = dashboardToCSV(exportData)
    expect(csv).toContain('Practice Dashboard')
    expect(csv).toContain('Key Metrics')
    expect(csv).toContain('Active Patients')
    expect(csv).toContain('120')
    expect(csv).toContain('Provider Utilization')
    expect(csv).toContain('Dr. Smith')
    expect(csv).toContain('90%')
  })

  it('handles all 5 dashboard types in export', () => {
    for (const type of DASHBOARD_TYPES) {
      const data = {
        dashboard: type,
        title: `${type} Dashboard`,
        generatedAt: '2025-01-01T00:00:00Z',
        filters: {},
        sections: [
          {
            name: 'Test',
            columns: [{ key: 'a', label: 'A' }],
            rows: [{ a: 'val' }],
          },
        ],
      }
      const csv = dashboardToCSV(data)
      expect(csv).toContain(type)
      expect(csv).toContain('Test')
      expect(csv).toContain('val')
    }
  })
})

// ─── Saved views lifecycle ────────────────────────────────
describe('Saved views lifecycle integration', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value)
        },
        removeItem: (key: string) => {
          store.delete(key)
        },
        clear: () => {
          store.clear()
        },
        length: 0,
        key: (index: number) => Array.from(store.keys())[index] ?? null,
      },
      writable: true,
      configurable: true,
    })
    vi.restoreAllMocks()
  })

  it('full save → load → setDefault → delete lifecycle', async () => {
    const userId = 'user-1'
    const dashboard = 'practice'

    const initial = await savedViewsService.loadViews(userId, dashboard)
    expect(initial).toEqual([])

    const view1 = makeView('v1', dashboard)
    await savedViewsService.saveView(userId, dashboard, view1)

    const loaded1 = await savedViewsService.loadViews(userId, dashboard)
    expect(loaded1).toHaveLength(1)
    expect(loaded1[0].id).toBe('v1')

    const view2 = makeView('v2', dashboard)
    await savedViewsService.saveView(userId, dashboard, view2)
    const loaded2 = await savedViewsService.loadViews(userId, dashboard)
    expect(loaded2).toHaveLength(2)

    await savedViewsService.setDefaultView(userId, dashboard, 'v1')
    const loaded3 = await savedViewsService.loadViews(userId, dashboard)
    const defaultView = loaded3.find((v) => v.id === 'v1')
    const otherView = loaded3.find((v) => v.id === 'v2')
    expect(defaultView?.isDefault).toBe(true)
    expect(otherView?.isDefault).toBe(false)

    await savedViewsService.deleteView(userId, dashboard, 'v2')
    const loaded4 = await savedViewsService.loadViews(userId, dashboard)
    expect(loaded4).toHaveLength(1)
    expect(loaded4[0].id).toBe('v1')
  })

  it('isolates saved views per dashboard type', async () => {
    const userId = 'user-1'
    const practiceView = makeView('pv1', 'practice' as DashboardType)
    const billingView = makeView('bv1', 'billing' as DashboardType)

    await savedViewsService.saveView(userId, 'practice', practiceView)
    await savedViewsService.saveView(userId, 'billing', billingView)

    const practiceViews = await savedViewsService.loadViews(userId, 'practice')
    const billingViews = await savedViewsService.loadViews(userId, 'billing')

    expect(practiceViews).toHaveLength(1)
    expect(practiceViews[0].id).toBe('pv1')
    expect(billingViews).toHaveLength(1)
    expect(billingViews[0].id).toBe('bv1')
  })
})

// ─── Analytics service end-to-end ──────────────────────────
describe('AnalyticsService integration', () => {
  it('returns valid metrics for all dashboard types', async () => {
    const repo = createMockRepo()
    const service = new AnalyticsService(repo)

    for (const type of DASHBOARD_TYPES) {
      const result = await service.getDashboard(
        type,
        'systemAdmin',
        defaultFilter,
      )
      expect(result).toBeDefined()
    }
  })

  it('throws on unauthorized dashboard access', async () => {
    const repo = createMockRepo()
    const service = new AnalyticsService(repo)

    await expect(
      service.getDashboard('compliance', 'frontDesk', defaultFilter),
    ).rejects.toThrow()
  })

  it('createDefaultLayout produces valid layout for each dashboard', () => {
    for (const type of DASHBOARD_TYPES) {
      const layout = createDefaultLayout(type, 'user-1')
      expect(layout.dashboard).toBe(type)
      expect(layout.ownerId).toBe('user-1')
      expect(layout.isDefault).toBe(true)
      expect(layout.widgets.length).toBeGreaterThan(0)
      for (const w of layout.widgets) {
        expect(w.colSpan).toBeGreaterThan(0)
        expect(w.rowSpan).toBeGreaterThan(0)
        expect(w.order).toBeGreaterThanOrEqual(0)
      }
    }
  })
})
