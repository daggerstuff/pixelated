import {
  ChartBar,
  TrendingUp,
  Star,
  Building,
  Settings,
  Clipboard,
  Stethoscope,
} from 'lucide-react'
import type { FC } from 'react'
import React from 'react'

import { FadeIn, SlideUp } from '@/components/layout/AdvancedAnimations'
import { OfflineIndicator } from '@/components/layout/OfflineIndicator'
import { ResponsiveContainer } from '@/components/layout/ResponsiveUtils'
import { usePersistentState } from '@/hooks/usePersistentState'

interface InstitutionMetrics {
  totalPatients: number
  activePatients: number
  totalTherapists: number
  avgSessionsPerPatient: number
  overallProgress: number
  complianceScore: number
}

interface TherapistPerformance {
  id: string
  name: string
  patientsCount: number
  avgSessionRating: number
  completionRate: number
  riskLevelDistribution: Record<string, number>
  successRate: number
  lastActiveHours: number
}

type DiagnosticIssueSeverity = 'critical' | 'warning' | 'info'

interface DiagnosticIssue {
  id: string
  title: string
  message: string
  action: string
  severity: DiagnosticIssueSeverity
}

interface SystemHealth {
  apiResponseTime: number
  databasePerformance: number
  memoryUsage: number
  errorRate: number
  uptime: number
}

type DashboardTabId =
  | 'overview'
  | 'therapists'
  | 'institutions'
  | 'system'
  | 'compliance'

type DashboardTab = {
  id: DashboardTabId
  label: string
  icon: 'chart' | 'therapist' | 'institution' | 'system' | 'compliance'
}

const dashboardTabs: DashboardTab[] = [
  { id: 'overview', label: 'Overview', icon: 'chart' },
  { id: 'therapists', label: 'Therapists', icon: 'therapist' },
  { id: 'institutions', label: 'Institutions', icon: 'institution' },
  { id: 'system', label: 'System Health', icon: 'system' },
  { id: 'compliance', label: 'Compliance', icon: 'compliance' },
]

// ⚡ Bolt Performance Optimization: Extracted static tabIcons to module scope to prevent re-creating this object on every render
const tabIcons: Record<DashboardTab['icon'], React.ReactNode> = {
  chart: <ChartBar className="h-5 w-5" />,
  therapist: <Stethoscope className="h-5 w-5" />,
  institution: <Building className="h-5 w-5" />,
  system: <Settings className="h-5 w-5" />,
  compliance: <Clipboard className="h-5 w-5" />,
}

// ⚡ Bolt Performance Optimization: Extracted static audits array to module scope to prevent re-creating this array on every render of ComplianceTab
const RECENT_AUDITS = [
  {
    type: 'Security Audit',
    date: '2024-01-15',
    status: 'passed',
    score: 96,
  },
  {
    type: 'HIPAA Compliance',
    date: '2024-01-10',
    status: 'passed',
    score: 94,
  },
  {
    type: 'Data Privacy',
    date: '2024-01-05',
    status: 'passed',
    score: 98,
  },
]

// ⚡ Bolt Performance Optimization: Extracted static severity styles to module scope to prevent re-creating this object on every render of SystemTab
// Zero-chroma doctrine: severity is encoded by border weight/tone and label
// inversion (value contrast), never hue (DESIGN.md §2, §5 Badges).
const ISSUE_SEVERITY_STYLES: Record<
  DiagnosticIssueSeverity,
  { wrapper: string; label: string; glyph: string }
> = {
  critical: {
    // Strongest signal: full-foreground border + inverted (light-on-dark) label
    wrapper: 'bg-card border-foreground text-foreground border',
    label: 'bg-primary text-primary-foreground',
    glyph: '✕',
  },
  warning: {
    // Mid-tone border is the system's only sanctioned mid-tone signal (§5 Inputs)
    wrapper: 'bg-card border-ring text-foreground border',
    label: 'bg-secondary text-foreground',
    glyph: '△',
  },
  info: {
    wrapper: 'bg-secondary border-border text-muted-foreground border',
    label: 'bg-secondary text-muted-foreground',
    glyph: '·',
  },
}

function getHighRiskCount(
  riskLevelDistribution: Record<string, number>,
): number {
  return (
    (riskLevelDistribution['high'] ?? 0) +
    (riskLevelDistribution['critical'] ?? 0)
  )
}

/**
 * Comprehensive Healthcare Administrator Dashboard
 */
export const AdminDashboard: FC = () => {
  // Persistent dashboard preferences
  const [dashboardView, setDashboardView] = usePersistentState<
    'overview' | 'therapists' | 'institutions' | 'system' | 'compliance'
  >({
    key: 'admin_dashboard_view',
    defaultValue: 'overview',
  })
  const [timeRange, setTimeRange] = usePersistentState<
    'week' | 'month' | 'quarter' | 'year'
  >({
    key: 'admin_dashboard_timerange',
    defaultValue: 'month',
  })
  const [selectedTherapists, setSelectedTherapists] = usePersistentState<
    string[]
  >({
    key: 'admin_selected_therapists',
    defaultValue: [],
  })

  // ⚡ Bolt Performance Optimization: Memoize the callback to prevent unnecessary re-renders of child tabs when dashboard state changes
  const handleTherapistSelect = React.useCallback(
    (therapistId: string) => {
      setSelectedTherapists((prev) =>
        prev.includes(therapistId)
          ? prev.filter((id) => id !== therapistId)
          : [...prev, therapistId],
      )
    },
    [setSelectedTherapists],
  )

  // Mock data - in real app would come from API
  const institutionMetrics: InstitutionMetrics = {
    totalPatients: 1247,
    activePatients: 892,
    totalTherapists: 23,
    avgSessionsPerPatient: 8.4,
    overallProgress: 73,
    complianceScore: 94,
  }

  const [therapists] = React.useState<TherapistPerformance[]>(() => [
    {
      id: '1',
      name: 'Dr. Sarah Johnson',
      patientsCount: 45,
      avgSessionRating: 4.6,
      completionRate: 96,
      riskLevelDistribution: { low: 60, medium: 30, high: 8, critical: 2 },
      successRate: Math.floor(Math.random() * 20) + 75,
      lastActiveHours: Math.floor(Math.random() * 3) + 1,
    },
    {
      id: '2',
      name: 'Dr. Michael Chen',
      patientsCount: 38,
      avgSessionRating: 4.4,
      completionRate: 94,
      riskLevelDistribution: { low: 55, medium: 35, high: 8, critical: 2 },
      successRate: Math.floor(Math.random() * 20) + 75,
      lastActiveHours: Math.floor(Math.random() * 3) + 1,
    },
    {
      id: '3',
      name: 'Dr. Emily Rodriguez',
      patientsCount: 52,
      avgSessionRating: 4.7,
      completionRate: 98,
      riskLevelDistribution: { low: 65, medium: 25, high: 8, critical: 2 },
      successRate: Math.floor(Math.random() * 20) + 75,
      lastActiveHours: Math.floor(Math.random() * 3) + 1,
    },
  ])

  const [activeSessions] = React.useState<number>(
    () => Math.floor(Math.random() * 50) + 20,
  )

  const systemHealth: SystemHealth = {
    apiResponseTime: 45,
    databasePerformance: 92,
    memoryUsage: 67,
    errorRate: 0.02,
    uptime: 99.9,
  }

  return (
    <ResponsiveContainer size="full">
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-card">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Healthcare Administration
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Institutional Overview • {institutionMetrics.totalTherapists}{' '}
                  therapists • {institutionMetrics.totalPatients} patients
                </p>
              </div>

              <div className="flex items-center gap-4">
                <OfflineIndicator position="inline" />
                <select
                  aria-label="Select time range"
                  value={timeRange}
                  onChange={(event) => {
                    if (
                      event.target.value === 'week' ||
                      event.target.value === 'month' ||
                      event.target.value === 'quarter' ||
                      event.target.value === 'year'
                    ) {
                      setTimeRange(event.target.value)
                    }
                  }}
                  className="rounded-none border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="quarter">This Quarter</option>
                  <option value="year">This Year</option>
                </select>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="px-6">
            <nav
              className="flex space-x-8"
              aria-label="Dashboard views"
              role="tablist"
            >
              {dashboardTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setDashboardView(tab.id)}
                  role="tab"
                  aria-selected={dashboardView === tab.id}
                  className={`flex items-center gap-2 border-b-2 px-1 py-3 text-sm transition-colors ${
                    dashboardView === tab.id
                      ? 'border-foreground font-semibold text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tabIcons[tab.icon]}
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-6">
          {dashboardView === 'overview' && (
            <OverviewTab
              metrics={institutionMetrics}
              therapists={therapists}
              onTherapistSelect={handleTherapistSelect}
              selectedTherapists={selectedTherapists}
              timeRange={timeRange}
            />
          )}

          {dashboardView === 'therapists' && (
            <TherapistsTab
              therapists={therapists}
              onTherapistSelect={handleTherapistSelect}
              selectedTherapists={selectedTherapists}
            />
          )}

          {dashboardView === 'institutions' && (
            <InstitutionsTab metrics={institutionMetrics} />
          )}

          {dashboardView === 'system' && (
            <SystemTab health={systemHealth} activeSessions={activeSessions} />
          )}

          {dashboardView === 'compliance' && (
            <ComplianceTab metrics={institutionMetrics} />
          )}
        </main>
      </div>
    </ResponsiveContainer>
  )
}

/**
 * Overview Tab Component
 */
const OverviewTab: FC<{
  metrics: InstitutionMetrics
  therapists: TherapistPerformance[]
  onTherapistSelect: (therapistId: string) => void
  selectedTherapists: string[]
  timeRange: 'week' | 'month' | 'quarter' | 'year'
}> = ({
  metrics,
  therapists,
  onTherapistSelect,
  selectedTherapists,
  timeRange,
}) => {
  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <FadeIn>
          <div className="rounded-none border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Patients
                </p>
                <p className="text-3xl font-bold text-foreground">
                  {metrics.totalPatients.toLocaleString()}
                </p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-none bg-secondary">
                <span className="text-foreground">👥</span>
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {metrics.activePatients} active patients
            </p>
          </div>
        </FadeIn>

        <FadeIn>
          <div className="rounded-none border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Therapists
                </p>
                <p className="text-3xl font-bold text-foreground">
                  {metrics.totalTherapists}
                </p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-none bg-secondary">
                <span className="text-foreground">👨‍⚕️</span>
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Licensed professionals
            </p>
          </div>
        </FadeIn>

        <FadeIn>
          <div className="rounded-none border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Avg Sessions
                </p>
                <p className="text-3xl font-bold text-foreground">
                  {metrics.avgSessionsPerPatient}
                </p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-none bg-secondary">
                <TrendingUp className="h-5 w-5 text-foreground" />
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Per patient this{' '}
              {timeRange === 'week'
                ? 'week'
                : timeRange === 'month'
                  ? 'month'
                  : timeRange}
            </p>
          </div>
        </FadeIn>

        <FadeIn>
          <div className="rounded-none border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Compliance Score
                </p>
                <p className="text-3xl font-bold text-foreground">
                  {metrics.complianceScore}%
                </p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-none bg-secondary">
                <span className="text-foreground">📋</span>
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              HIPAA & security compliance
            </p>
          </div>
        </FadeIn>
      </div>

      {/* Therapist Performance Overview */}
      <SlideUp>
        <div className="rounded-none border border-border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold">
            Therapist Performance Overview
          </h3>
          <div className="space-y-4">
            {therapists.map((therapist) => (
              <div
                key={therapist.id}
                className="flex items-center gap-4 rounded-none bg-secondary p-4"
              >
                <input
                  type="checkbox"
                  aria-label={`Select therapist ${therapist.name}`}
                  checked={selectedTherapists.includes(therapist.id)}
                  onChange={() => onTherapistSelect(therapist.id)}
                  className="h-4 w-4"
                />
                <div className="flex-1">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-medium text-foreground">
                      {therapist.name}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        <Star className="h-4 w-4" />{' '}
                        {therapist.avgSessionRating}/5.0
                      </span>
                      <span
                        className={`rounded-none px-2 py-1 text-xs font-medium ${
                          therapist.completionRate >= 95
                            ? 'bg-primary text-primary-foreground'
                            : therapist.completionRate >= 90
                              ? 'bg-secondary text-foreground'
                              : 'bg-secondary text-muted-foreground'
                        }`}
                      >
                        {therapist.completionRate}% completion
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                    <div>
                      <span className="text-muted-foreground">Patients:</span>
                      <span className="ml-2 font-medium">
                        {therapist.patientsCount}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">High Risk:</span>
                      <span className="ml-2 font-semibold text-foreground">
                        {getHighRiskCount(therapist.riskLevelDistribution)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        Success Rate:
                      </span>
                      <span className="ml-2 font-medium">
                        {therapist.successRate}%
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        Last Active:
                      </span>
                      <span className="ml-2 font-medium">
                        {therapist.lastActiveHours}h ago
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </SlideUp>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SlideUp>
          <div className="rounded-none border border-border bg-card p-6">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <span>⚡</span>
              Quick Actions
            </h3>
            <div className="space-y-3">
              <button className="w-full rounded-none border border-input bg-secondary p-3 text-left transition-colors hover:bg-accent">
                <p className="font-medium text-foreground">Generate Reports</p>
                <p className="text-sm text-muted-foreground">
                  Create institutional reports
                </p>
              </button>
              <button className="w-full rounded-none border border-input bg-secondary p-3 text-left transition-colors hover:bg-accent">
                <p className="font-medium text-foreground">
                  Resource Allocation
                </p>
                <p className="text-sm text-muted-foreground">
                  Manage therapist assignments
                </p>
              </button>
              <button className="w-full rounded-none border border-input bg-secondary p-3 text-left transition-colors hover:bg-accent">
                <p className="font-medium text-foreground">System Settings</p>
                <p className="text-sm text-muted-foreground">
                  Configure platform settings
                </p>
              </button>
            </div>
          </div>
        </SlideUp>

        <SlideUp>
          <div className="rounded-none border border-border bg-card p-6">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <ChartBar className="h-5 w-5" />
              Performance Metrics
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Patient Satisfaction
                </span>
                <span className="font-medium">4.3/5.0</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Treatment Success Rate
                </span>
                <span className="font-medium">78%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Average Treatment Duration
                </span>
                <span className="font-medium">12 weeks</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Readmission Rate
                </span>
                <span className="font-medium">8%</span>
              </div>
            </div>
          </div>
        </SlideUp>

        <SlideUp>
          <div className="rounded-none border border-border bg-card p-6">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <span>🚨</span>
              Alerts & Notifications
            </h3>
            <div className="space-y-3">
              <div className="rounded-none border border-foreground bg-card p-3">
                <p className="font-medium text-foreground">
                  High Risk Patients
                </p>
                <p className="text-sm text-muted-foreground">
                  3 patients require immediate attention
                </p>
              </div>
              <div className="rounded-none border border-ring bg-card p-3">
                <p className="font-medium text-foreground">Compliance Review</p>
                <p className="text-sm text-muted-foreground">
                  Quarterly audit due in 2 weeks
                </p>
              </div>
              <div className="rounded-none border border-input bg-secondary p-3">
                <p className="font-medium text-foreground">System Update</p>
                <p className="text-sm text-muted-foreground">
                  New features available
                </p>
              </div>
            </div>
          </div>
        </SlideUp>
      </div>
    </div>
  )
}

/**
 * Therapists Tab Component
 */
const TherapistsTab: FC<{
  therapists: TherapistPerformance[]
  onTherapistSelect: (therapistId: string) => void
  selectedTherapists: string[]
}> = ({ therapists, onTherapistSelect, selectedTherapists }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Therapist Management</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {selectedTherapists.length} selected
          </span>
          <button className="rounded-none bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-accent">
            Manage Assignments
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-none border border-border bg-card">
        <div className="border-b border-border p-4">
          <div className="flex items-center gap-4">
            <input
              type="text"
              aria-label="Search therapists"
              placeholder="Search therapists..."
              className="flex-1 rounded-none border border-input bg-background px-3 py-2 text-sm"
            />
            <select
              aria-label="Filter by performance level"
              className="rounded-none border border-input bg-background px-3 py-2 text-sm"
            >
              <option>All Performance Levels</option>
              <option>High Performers</option>
              <option>Needs Support</option>
              <option>New Therapists</option>
            </select>
          </div>
        </div>

        <div className="divide-y divide-border">
          {therapists.map((therapist) => (
            <div
              key={therapist.id}
              className="p-4 transition-colors hover:bg-secondary"
            >
              <div className="flex items-center gap-4">
                <input
                  type="checkbox"
                  aria-label={`Select therapist ${therapist.name}`}
                  checked={selectedTherapists.includes(therapist.id)}
                  onChange={() => onTherapistSelect(therapist.id)}
                  className="h-4 w-4"
                />
                <div className="flex-1">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-medium text-foreground">
                      {therapist.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        <Star className="h-4 w-4" />{' '}
                        {therapist.avgSessionRating}/5.0
                      </span>
                      <span
                        className={`rounded-none px-2 py-1 text-xs font-medium ${
                          therapist.completionRate >= 95
                            ? 'bg-primary text-primary-foreground'
                            : therapist.completionRate >= 90
                              ? 'bg-secondary text-foreground'
                              : 'bg-secondary text-muted-foreground'
                        }`}
                      >
                        {therapist.completionRate}% completion
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                    <div>
                      <span className="text-muted-foreground">Patients:</span>
                      <span className="ml-2 font-medium">
                        {therapist.patientsCount}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">High Risk:</span>
                      <span className="ml-2 font-semibold text-foreground">
                        {getHighRiskCount(therapist.riskLevelDistribution)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        Success Rate:
                      </span>
                      <span className="ml-2 font-medium">
                        {therapist.successRate}%
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        Last Active:
                      </span>
                      <span className="ml-2 font-medium">
                        {therapist.lastActiveHours}h ago
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  aria-label={`View details for ${therapist.name}`}
                  className="rounded-none bg-primary px-3 py-2 text-sm text-primary-foreground transition-colors hover:bg-accent"
                >
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Institutions Tab Component
 */
const InstitutionsTab: FC<{
  metrics: InstitutionMetrics
}> = ({ metrics: _metrics }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Institutional Management</h2>
        <button className="rounded-none bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-accent">
          Add Institution
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-none border border-border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold">Resource Allocation</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Therapist Utilization
              </span>
              <span className="font-medium">87%</span>
            </div>
            <div className="h-2 w-full rounded-none bg-secondary">
              <div
                className="h-2 rounded-none bg-primary"
                style={{ width: '87%' }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Patient Capacity
              </span>
              <span className="font-medium">73%</span>
            </div>
            <div className="h-2 w-full rounded-none bg-secondary">
              <div
                className="h-2 rounded-none bg-primary"
                style={{ width: '73%' }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                AI System Usage
              </span>
              <span className="font-medium">92%</span>
            </div>
            <div className="h-2 w-full rounded-none bg-secondary">
              <div
                className="h-2 rounded-none bg-primary"
                style={{ width: '92%' }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-none border border-border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold">Department Overview</h3>
          <div className="space-y-3">
            {[
              { name: 'Adult Therapy', patients: 456, therapists: 12 },
              { name: 'Child & Adolescent', patients: 234, therapists: 8 },
              { name: 'Crisis Intervention', patients: 89, therapists: 5 },
              { name: 'Group Therapy', patients: 156, therapists: 4 },
            ].map((dept) => (
              <div
                key={dept.name}
                className="flex items-center justify-between rounded-none bg-secondary p-3"
              >
                <div>
                  <p className="font-medium text-foreground">{dept.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {dept.therapists} therapists • {dept.patients} patients
                  </p>
                </div>
                <button
                  aria-label={`Manage ${dept.name} department`}
                  className="text-sm text-foreground hover:underline"
                >
                  Manage
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * System Tab Component
 */
const SystemTab: FC<{
  health: SystemHealth
  activeSessions: number
}> = ({ health, activeSessions }) => {
  const [diagnosticIssues, setDiagnosticIssues] = React.useState<
    DiagnosticIssue[]
  >([])
  const [isRunningDiagnostics, setIsRunningDiagnostics] =
    React.useState<boolean>(false)
  const [lastDiagnosticsRun, setLastDiagnosticsRun] =
    React.useState<Date | null>(null)

  const runDiagnostics = React.useCallback(async () => {
    setIsRunningDiagnostics(true)

    const issues: DiagnosticIssue[] = []

    if (health.apiResponseTime > 75) {
      issues.push({
        id: 'api-response-time',
        title: 'API latency elevated',
        message: `Current API response time is ${health.apiResponseTime}ms, above the recommended 75ms threshold.`,
        action:
          'Inspect upstream service dependencies and database query plans.',
        severity: 'critical',
      })
    }

    if (health.databasePerformance < 90) {
      issues.push({
        id: 'database-performance',
        title: 'Database health warning',
        message: `Database performance is ${health.databasePerformance}%, below target range.`,
        action: 'Review connection pools and slow query logs.',
        severity: 'warning',
      })
    }

    if (health.memoryUsage > 80) {
      issues.push({
        id: 'memory-usage',
        title: 'High memory pressure',
        message: `Memory usage is ${health.memoryUsage}%, which may increase restart risk.`,
        action:
          'Scale memory resources or trim background worker cache retention.',
        severity: 'warning',
      })
    }

    if (health.errorRate > 0.02) {
      issues.push({
        id: 'error-rate',
        title: 'Error rate spike',
        message: `Current error rate is ${(health.errorRate * 100).toFixed(2)}%, above the 2% alert threshold.`,
        action:
          'Review recent error logs and isolate failing service dependencies.',
        severity: 'critical',
      })
    }

    if (health.uptime < 99.5) {
      issues.push({
        id: 'uptime',
        title: 'Suboptimal uptime',
        message: `Uptime is ${health.uptime}%, indicating recent instability.`,
        action:
          'Correlate deployment events with service restarts and incident logs.',
        severity: 'warning',
      })
    }

    await new Promise((resolve) => setTimeout(resolve, 450))

    setDiagnosticIssues(
      issues.length > 0
        ? issues
        : [
            {
              id: 'no-issues',
              title: 'No diagnostic concerns',
              message: 'All checks are within normal operating thresholds.',
              action: 'Continue scheduled monitoring.',
              severity: 'info',
            },
          ],
    )
    setLastDiagnosticsRun(new Date())
    setIsRunningDiagnostics(false)
  }, [health])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">System Health & Performance</h2>
        <button
          onClick={runDiagnostics}
          disabled={isRunningDiagnostics}
          className="rounded-none bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-accent disabled:opacity-60"
        >
          Run Diagnostics
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-none border border-border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold">Performance Metrics</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                API Response Time
              </span>
              <span
                className={`font-medium ${health.apiResponseTime < 50 ? 'text-muted-foreground' : health.apiResponseTime < 100 ? 'font-medium text-foreground' : 'font-bold text-foreground'}`}
              >
                {health.apiResponseTime}ms
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Database Performance
              </span>
              <span
                className={`font-medium ${health.databasePerformance > 90 ? 'text-muted-foreground' : health.databasePerformance > 80 ? 'font-medium text-foreground' : 'font-bold text-foreground'}`}
              >
                {health.databasePerformance}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Memory Usage
              </span>
              <span
                className={`font-medium ${health.memoryUsage < 70 ? 'text-muted-foreground' : health.memoryUsage < 85 ? 'font-medium text-foreground' : 'font-bold text-foreground'}`}
              >
                {health.memoryUsage}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Error Rate</span>
              <span
                className={`font-medium ${health.errorRate < 0.01 ? 'text-muted-foreground' : health.errorRate < 0.05 ? 'font-medium text-foreground' : 'font-bold text-foreground'}`}
              >
                {(health.errorRate * 100).toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-none border border-border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold">System Status</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-none border border-border bg-card p-3">
              <span className="font-medium text-foreground">
                Platform Uptime
              </span>
              <span className="font-bold text-muted-foreground">
                {health.uptime}%
              </span>
            </div>
            <div className="flex items-center justify-between rounded-none border border-border bg-secondary p-3">
              <span className="font-medium text-foreground">
                Active Sessions
              </span>
              <span className="font-bold text-foreground">
                {activeSessions}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-none border border-border bg-secondary p-3">
              <span className="font-medium text-foreground">
                Data Processing
              </span>
              <span className="font-bold text-foreground">Normal</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-none border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Diagnostic Problems</h3>
          {lastDiagnosticsRun ? (
            <p className="text-sm text-muted-foreground">
              Last run: {lastDiagnosticsRun.toLocaleTimeString()}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Not run yet</p>
          )}
        </div>

        {isRunningDiagnostics ? (
          <div className="text-sm text-muted-foreground">
            Running diagnostics...
          </div>
        ) : diagnosticIssues.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Run diagnostics to scan for current system issues.
          </div>
        ) : (
          <div className="space-y-3">
            {diagnosticIssues.map((issue) => {
              const styles = ISSUE_SEVERITY_STYLES[issue.severity]
              return (
                <div
                  key={issue.id}
                  className={`rounded-none border p-3 ${styles.wrapper}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{issue.title}</p>
                    <span
                      className={`rounded-none px-2 py-1 text-xs font-medium ${styles.label}`}
                      aria-label={`Severity: ${issue.severity}`}
                    >
                      {styles.glyph} {issue.severity.toUpperCase()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">{issue.message}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {issue.action}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Compliance Tab Component
 */
const ComplianceTab: FC<{
  metrics: InstitutionMetrics
}> = ({ metrics }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Compliance & Audit Management</h2>
        <button className="rounded-none bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-accent">
          Generate Report
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-none border border-border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold">Compliance Status</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                HIPAA Compliance
              </span>
              <span
                className={`font-medium ${metrics.complianceScore >= 95 ? 'text-muted-foreground' : 'font-medium text-foreground'}`}
              >
                {metrics.complianceScore}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Data Encryption
              </span>
              <span className="font-medium text-muted-foreground">100%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Access Controls
              </span>
              <span className="font-medium text-muted-foreground">
                Compliant
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Audit Logging
              </span>
              <span className="font-medium text-muted-foreground">Active</span>
            </div>
          </div>
        </div>

        <div className="rounded-none border border-border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold">Recent Audits</h3>
          <div className="space-y-3">
            {RECENT_AUDITS.map((audit) => (
              <div
                key={`${audit.type}-${audit.date}`}
                className="flex items-center justify-between rounded-none bg-secondary p-3"
              >
                <div>
                  <p className="font-medium text-foreground">{audit.type}</p>
                  <p className="text-sm text-muted-foreground">{audit.date}</p>
                </div>
                <div className="text-right">
                  <span
                    className={`rounded-none px-2 py-1 text-xs font-medium ${
                      audit.status === 'passed'
                        ? 'border border-input bg-secondary text-muted-foreground'
                        : 'bg-primary font-semibold text-primary-foreground'
                    }`}
                  >
                    {audit.status}
                  </span>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {audit.score}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard
