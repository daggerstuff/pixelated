/**
 * @file dashboards/types.ts
 * @description Dashboard types, widget definitions, and RBAC configuration
 * for the customizable EHR dashboards feature (PIX-4413).
 * @module ehr/dashboards
 */

import type { ClinicalRole, EHRPermission } from '@/lib/ehr-native/auth'

// ---------------------------------------------------------------------------
// Dashboard Types
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

export const DASHBOARD_LABELS: Record<DashboardType, string> = {
  practice: 'Practice Overview',
  outcomes: 'Clinical Outcomes',
  utilization: 'Utilization',
  billing: 'Billing & Claims',
  compliance: 'Compliance & Audit',
}

// ---------------------------------------------------------------------------
// Dashboard-level RBAC
// ---------------------------------------------------------------------------

export const DASHBOARD_RBAC: Record<DashboardType, EHRPermission[]> = {
  practice: ['read_patient', 'read_schedule'],
  outcomes: ['read_observation', 'read_patient'],
  utilization: ['read_encounter', 'read_patient'],
  billing: ['read_claim', 'submit_claim'],
  compliance: ['audit_access', 'read_patient'],
}

// ---------------------------------------------------------------------------
// Widget Types
// ---------------------------------------------------------------------------

export type WidgetSize = 'small' | 'medium' | 'large' | 'wide' | 'tall'

export type WidgetCategory = 'metric' | 'chart' | 'table' | 'list'

export type ChartType =
  'line' | 'area' | 'bar' | 'pie' | 'radar' | 'donut' | 'metric-card'

export interface WidgetDefinition {
  /** Unique widget identifier (e.g. 'practice.appointments-today') */
  id: string
  /** Display label */
  title: string
  /** Short description shown in widget picker */
  description: string
  /** Which dashboard this widget belongs to */
  dashboard: DashboardType
  /** Widget category for grouping in picker UI */
  category: WidgetCategory
  /** Default size on the grid */
  defaultSize: WidgetSize
  /** Chart type for chart widgets */
  chartType?: ChartType
  /** Icon name from lucide-react */
  icon: string
  /** Required permissions to view this widget */
  requiredPermissions: EHRPermission[]
  /** If true, requires MFA to render (e.g. PHI exports, break-glass audit) */
  requiresMFA?: boolean
}

// ---------------------------------------------------------------------------
// Widget Registry — all widgets for all 5 dashboards
// ---------------------------------------------------------------------------

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  // ---- Practice ----
  {
    id: 'practice.total-patients',
    title: 'Total Active Patients',
    description: 'Count of patients with activity in the selected period',
    dashboard: 'practice',
    category: 'metric',
    defaultSize: 'small',
    chartType: 'metric-card',
    icon: 'Users',
    requiredPermissions: ['read_patient'],
  },
  {
    id: 'practice.appointments-today',
    title: "Today's Appointments",
    description: 'Scheduled appointments for today',
    dashboard: 'practice',
    category: 'metric',
    defaultSize: 'small',
    chartType: 'metric-card',
    icon: 'Calendar',
    requiredPermissions: ['read_schedule'],
  },
  {
    id: 'practice.appointment-trend',
    title: 'Appointment Volume',
    description: 'Appointments per day over the selected range',
    dashboard: 'practice',
    category: 'chart',
    defaultSize: 'wide',
    chartType: 'line',
    icon: 'CalendarClock',
    requiredPermissions: ['read_schedule'],
  },
  {
    id: 'practice.no-show-rate',
    title: 'No-Show Rate',
    description: 'Percentage of missed appointments',
    dashboard: 'practice',
    category: 'metric',
    defaultSize: 'small',
    chartType: 'metric-card',
    icon: 'CalendarX',
    requiredPermissions: ['read_schedule'],
  },
  {
    id: 'practice.provider-load',
    title: 'Provider Patient Load',
    description: 'Patient counts per provider (top 10)',
    dashboard: 'practice',
    category: 'table',
    defaultSize: 'medium',
    chartType: 'bar',
    icon: 'UserCheck',
    requiredPermissions: ['read_patient'],
  },
  {
    id: 'practice.open-encounters',
    title: 'Open Encounters',
    description: 'Currently open encounters needing attention',
    dashboard: 'practice',
    category: 'metric',
    defaultSize: 'small',
    chartType: 'metric-card',
    icon: 'FileText',
    requiredPermissions: ['read_encounter'],
  },
  {
    id: 'practice.pending-tasks',
    title: 'Pending Tasks',
    description: 'Orders, referrals, and tasks awaiting completion',
    dashboard: 'practice',
    category: 'metric',
    defaultSize: 'small',
    chartType: 'metric-card',
    icon: 'ClipboardList',
    requiredPermissions: ['read_patient'],
  },
  {
    id: 'practice.avg-wait-time',
    title: 'Average Wait Time',
    description: 'Mean patient wait time in minutes',
    dashboard: 'practice',
    category: 'metric',
    defaultSize: 'small',
    chartType: 'metric-card',
    icon: 'Clock',
    requiredPermissions: ['read_schedule'],
  },

  // ---- Outcomes ----
  {
    id: 'outcomes.phq9-average',
    title: 'PHQ-9 Average',
    description: 'Average PHQ-9 depression score across patients',
    dashboard: 'outcomes',
    category: 'metric',
    defaultSize: 'small',
    chartType: 'metric-card',
    icon: 'Brain',
    requiredPermissions: ['read_observation'],
  },
  {
    id: 'outcomes.gad7-average',
    title: 'GAD-7 Average',
    description: 'Average GAD-7 anxiety score',
    dashboard: 'outcomes',
    category: 'metric',
    defaultSize: 'small',
    chartType: 'metric-card',
    icon: 'Brain',
    requiredPermissions: ['read_observation'],
  },
  {
    id: 'outcomes.oq45-average',
    title: 'OQ-45 Average',
    description: 'Average OQ-45 outcome score',
    dashboard: 'outcomes',
    category: 'metric',
    defaultSize: 'small',
    chartType: 'metric-card',
    icon: 'Activity',
    requiredPermissions: ['read_observation'],
  },
  {
    id: 'outcomes.trends',
    title: 'Outcome Trends',
    description: 'PHQ-9, GAD-7, and OQ-45 trend lines over time',
    dashboard: 'outcomes',
    category: 'chart',
    defaultSize: 'wide',
    chartType: 'line',
    icon: 'TrendingUp',
    requiredPermissions: ['read_observation'],
  },
  {
    id: 'outcomes.improvement',
    title: 'Clinically Significant Improvement',
    description: 'Patients showing reliable improvement',
    dashboard: 'outcomes',
    category: 'metric',
    defaultSize: 'small',
    chartType: 'metric-card',
    icon: 'TrendingUp',
    requiredPermissions: ['read_observation'],
  },
  {
    id: 'outcomes.deterioration',
    title: 'Deterioration Alerts',
    description: 'Patients showing score deterioration',
    dashboard: 'outcomes',
    category: 'metric',
    defaultSize: 'small',
    chartType: 'metric-card',
    icon: 'TrendingDown',
    requiredPermissions: ['read_observation'],
  },
  {
    id: 'outcomes.total-assessments',
    title: 'Total Assessments',
    description: 'Assessments administered in the selected period',
    dashboard: 'outcomes',
    category: 'metric',
    defaultSize: 'small',
    chartType: 'metric-card',
    icon: 'FileSpreadsheet',
    requiredPermissions: ['read_observation'],
  },

  // ---- Utilization ----
  {
    id: 'utilization.total-encounters',
    title: 'Total Encounters',
    description: 'All encounters in the selected period',
    dashboard: 'utilization',
    category: 'metric',
    defaultSize: 'small',
    chartType: 'metric-card',
    icon: 'Stethoscope',
    requiredPermissions: ['read_encounter'],
  },
  {
    id: 'utilization.telehealth-rate',
    title: 'Telehealth Rate',
    description: 'Percentage of visits delivered via telehealth',
    dashboard: 'utilization',
    category: 'metric',
    defaultSize: 'small',
    chartType: 'metric-card',
    icon: 'Video',
    requiredPermissions: ['read_encounter'],
  },
  {
    id: 'utilization.encounter-trend',
    title: 'Encounter Volume Trend',
    description: 'In-person vs telehealth encounters over time',
    dashboard: 'utilization',
    category: 'chart',
    defaultSize: 'wide',
    chartType: 'area',
    icon: 'BarChart3',
    requiredPermissions: ['read_encounter'],
  },
  {
    id: 'utilization.avg-visit-duration',
    title: 'Average Visit Duration',
    description: 'Mean visit length in minutes',
    dashboard: 'utilization',
    category: 'metric',
    defaultSize: 'small',
    chartType: 'metric-card',
    icon: 'Clock',
    requiredPermissions: ['read_encounter'],
  },
  {
    id: 'utilization.room-utilization',
    title: 'Room Utilization',
    description: 'Exam room utilization rate',
    dashboard: 'utilization',
    category: 'metric',
    defaultSize: 'small',
    chartType: 'metric-card',
    icon: 'DoorOpen',
    requiredPermissions: ['read_encounter'],
  },
  {
    id: 'utilization.department-breakdown',
    title: 'Department Breakdown',
    description: 'Encounters and utilization by department',
    dashboard: 'utilization',
    category: 'table',
    defaultSize: 'medium',
    chartType: 'bar',
    icon: 'Building2',
    requiredPermissions: ['read_encounter'],
  },

  // ---- Billing ----
  {
    id: 'billing.total-charges',
    title: 'Total Charges',
    description: 'Sum of all charges in the selected period',
    dashboard: 'billing',
    category: 'metric',
    defaultSize: 'small',
    chartType: 'metric-card',
    icon: 'DollarSign',
    requiredPermissions: ['read_claim'],
  },
  {
    id: 'billing.total-collections',
    title: 'Total Collections',
    description: 'Sum of all payments received',
    dashboard: 'billing',
    category: 'metric',
    defaultSize: 'small',
    chartType: 'metric-card',
    icon: 'DollarSign',
    requiredPermissions: ['read_claim'],
  },
  {
    id: 'billing.outstanding-ar',
    title: 'Outstanding A/R',
    description: 'Total accounts receivable outstanding',
    dashboard: 'billing',
    category: 'metric',
    defaultSize: 'small',
    chartType: 'metric-card',
    icon: 'AlertCircle',
    requiredPermissions: ['read_claim'],
  },
  {
    id: 'billing.days-in-ar',
    title: 'Days in A/R',
    description: 'Average days to collect on receivables',
    dashboard: 'billing',
    category: 'metric',
    defaultSize: 'small',
    chartType: 'metric-card',
    icon: 'CalendarClock',
    requiredPermissions: ['read_claim'],
  },
  {
    id: 'billing.denial-rate',
    title: 'Claim Denial Rate',
    description: 'Percentage of claims denied by payers',
    dashboard: 'billing',
    category: 'metric',
    defaultSize: 'small',
    chartType: 'metric-card',
    icon: 'XCircle',
    requiredPermissions: ['read_claim'],
  },
  {
    id: 'billing.clean-claim-rate',
    title: 'Clean Claim Rate',
    description: 'Percentage of claims processed without rework',
    dashboard: 'billing',
    category: 'metric',
    defaultSize: 'small',
    chartType: 'metric-card',
    icon: 'CheckCircle',
    requiredPermissions: ['read_claim'],
  },
  {
    id: 'billing.revenue-trend',
    title: 'Revenue Trend',
    description: 'Charges vs collections by month',
    dashboard: 'billing',
    category: 'chart',
    defaultSize: 'wide',
    chartType: 'bar',
    icon: 'BarChart3',
    requiredPermissions: ['read_claim'],
  },
  {
    id: 'billing.claims-by-status',
    title: 'Claims by Status',
    description: 'Distribution of claims across statuses',
    dashboard: 'billing',
    category: 'chart',
    defaultSize: 'medium',
    chartType: 'pie',
    icon: 'PieChart',
    requiredPermissions: ['read_claim'],
  },
  {
    id: 'billing.top-payers',
    title: 'Top Payers',
    description: 'Payers ranked by volume and reimbursement',
    dashboard: 'billing',
    category: 'table',
    defaultSize: 'medium',
    chartType: 'bar',
    icon: 'Building',
    requiredPermissions: ['read_claim'],
  },

  // ---- Compliance ----
  {
    id: 'compliance.audit-events',
    title: 'Total Audit Events',
    description: 'Count of all audit log entries',
    dashboard: 'compliance',
    category: 'metric',
    defaultSize: 'small',
    chartType: 'metric-card',
    icon: 'ShieldCheck',
    requiredPermissions: ['audit_access'],
  },
  {
    id: 'compliance.access-violations',
    title: 'Access Violations',
    description: 'Detected access policy violations',
    dashboard: 'compliance',
    category: 'metric',
    defaultSize: 'small',
    chartType: 'metric-card',
    icon: 'ShieldAlert',
    requiredPermissions: ['audit_access'],
  },
  {
    id: 'compliance.break-glass',
    title: 'Break-Glass Events',
    description: 'Emergency PHI access overrides',
    dashboard: 'compliance',
    category: 'metric',
    defaultSize: 'small',
    chartType: 'metric-card',
    icon: 'Unlock',
    requiredPermissions: ['audit_access'],
    requiresMFA: true,
  },
  {
    id: 'compliance.phi-exports',
    title: 'PHI Exports',
    description: 'Count of PHI data exports',
    dashboard: 'compliance',
    category: 'metric',
    defaultSize: 'small',
    chartType: 'metric-card',
    icon: 'Download',
    requiredPermissions: ['export_phi'],
    requiresMFA: true,
  },
  {
    id: 'compliance.consent-coverage',
    title: 'Consent Coverage',
    description: 'Percentage of patients with active consent on file',
    dashboard: 'compliance',
    category: 'metric',
    defaultSize: 'small',
    chartType: 'metric-card',
    icon: 'FileCheck',
    requiredPermissions: ['audit_access'],
  },
  {
    id: 'compliance.training-completion',
    title: 'Training Completion',
    description: 'Required training completion rate',
    dashboard: 'compliance',
    category: 'metric',
    defaultSize: 'small',
    chartType: 'metric-card',
    icon: 'GraduationCap',
    requiredPermissions: ['audit_access'],
  },
  {
    id: 'compliance.violation-trend',
    title: 'Violation Trend',
    description: 'Access violations over time',
    dashboard: 'compliance',
    category: 'chart',
    defaultSize: 'wide',
    chartType: 'line',
    icon: 'TrendingDown',
    requiredPermissions: ['audit_access'],
  },
  {
    id: 'compliance.audit-by-category',
    title: 'Audit by Category',
    description: 'Audit events grouped by category',
    dashboard: 'compliance',
    category: 'chart',
    defaultSize: 'medium',
    chartType: 'donut',
    icon: 'PieChart',
    requiredPermissions: ['audit_access'],
  },
  {
    id: 'compliance.training-by-role',
    title: 'Training by Role',
    description: 'Training completion broken down by clinical role',
    dashboard: 'compliance',
    category: 'table',
    defaultSize: 'medium',
    chartType: 'bar',
    icon: 'Users',
    requiredPermissions: ['audit_access'],
  },
]

// ---------------------------------------------------------------------------
// Widget RBAC helpers
// ---------------------------------------------------------------------------

import { roleHasPermission } from '@/lib/ehr-native/auth'

/**
 * Check whether a role can view a specific widget.
 */
export function canViewWidget(
  role: ClinicalRole,
  widget: WidgetDefinition,
): boolean {
  return widget.requiredPermissions.every((perm) =>
    roleHasPermission(role, perm),
  )
}

/**
 * Get all widgets for a dashboard type that the given role can access.
 */
export function getAccessibleWidgets(
  role: ClinicalRole,
  dashboard: DashboardType,
): WidgetDefinition[] {
  return WIDGET_REGISTRY.filter(
    (w) => w.dashboard === dashboard && canViewWidget(role, w),
  )
}

// ---------------------------------------------------------------------------
// Dashboard Layout (Saved Views)
// ---------------------------------------------------------------------------

/** Grid position for a widget instance */
export interface WidgetPosition {
  /** Widget definition ID from WIDGET_REGISTRY */
  widgetId: string
  /** Grid column span (1-12) */
  colSpan: number
  /** Grid row span (1-N) */
  rowSpan: number
  /** Sort order within the layout (0-based) */
  order: number
}

export interface DashboardLayout {
  /** Unique identifier */
  id: string
  /** Display name */
  name: string
  /** Which dashboard this layout applies to */
  dashboard: DashboardType
  /** Whether this is the user's default for this dashboard type */
  isDefault: boolean
  /** Whether this layout is shared with other users */
  isShared: boolean
  /** User ID who created/owns this layout */
  ownerId: string
  /** Widget positions in this layout */
  widgets: WidgetPosition[]
  /** Time range filter to apply on load (ISO dates) */
  timeRange?: { start: string; end: string }
  /** ISO timestamp of creation */
  createdAt: string
  /** ISO timestamp of last update */
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Grid Layout Configuration
// ---------------------------------------------------------------------------

export const GRID_COLUMNS = 12

export const WIDGET_SIZE_SPANS: Record<
  WidgetSize,
  { colSpan: number; rowSpan: number }
> = {
  small: { colSpan: 3, rowSpan: 1 },
  medium: { colSpan: 6, rowSpan: 2 },
  large: { colSpan: 6, rowSpan: 3 },
  wide: { colSpan: 12, rowSpan: 2 },
  tall: { colSpan: 3, rowSpan: 3 },
}

export const DEFAULT_LAYOUTS: Record<DashboardType, string[]> = {
  practice: [
    'practice.total-patients',
    'practice.appointments-today',
    'practice.no-show-rate',
    'practice.open-encounters',
    'practice.appointment-trend',
    'practice.provider-load',
    'practice.pending-tasks',
    'practice.avg-wait-time',
  ],
  outcomes: [
    'outcomes.phq9-average',
    'outcomes.gad7-average',
    'outcomes.oq45-average',
    'outcomes.total-assessments',
    'outcomes.trends',
    'outcomes.improvement',
    'outcomes.deterioration',
  ],
  utilization: [
    'utilization.total-encounters',
    'utilization.telehealth-rate',
    'utilization.avg-visit-duration',
    'utilization.room-utilization',
    'utilization.encounter-trend',
    'utilization.department-breakdown',
  ],
  billing: [
    'billing.total-charges',
    'billing.total-collections',
    'billing.outstanding-ar',
    'billing.days-in-ar',
    'billing.denial-rate',
    'billing.clean-claim-rate',
    'billing.revenue-trend',
    'billing.claims-by-status',
    'billing.top-payers',
  ],
  compliance: [
    'compliance.audit-events',
    'compliance.access-violations',
    'compliance.break-glass',
    'compliance.phi-exports',
    'compliance.consent-coverage',
    'compliance.training-completion',
    'compliance.violation-trend',
    'compliance.audit-by-category',
    'compliance.training-by-role',
  ],
}

/**
 * Generate a default layout from the registry defaults.
 */
export function createDefaultLayout(
  dashboard: DashboardType,
  userId: string,
): DashboardLayout {
  const widgetIds = DEFAULT_LAYOUTS[dashboard]
  const widgets: WidgetPosition[] = widgetIds.map((widgetId, index) => {
    const def = WIDGET_REGISTRY.find((w) => w.id === widgetId)
    const size = def?.defaultSize ?? 'small'
    const spans = WIDGET_SIZE_SPANS[size]
    return {
      widgetId,
      colSpan: spans.colSpan,
      rowSpan: spans.rowSpan,
      order: index,
    }
  })

  const now = new Date().toISOString()
  return {
    id: `default-${dashboard}`,
    name: 'Default',
    dashboard,
    isDefault: true,
    isShared: false,
    ownerId: userId,
    widgets,
    createdAt: now,
    updatedAt: now,
  }
}
