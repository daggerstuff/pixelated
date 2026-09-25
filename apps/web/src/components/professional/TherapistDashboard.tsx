import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  StarIcon,
  UserGroupIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline'
import type { FC, ComponentProps, ReactElement } from 'react'
import React from 'react'

import { FadeIn, SlideUp } from '@/components/layout/AdvancedAnimations'
import { OfflineIndicator } from '@/components/layout/OfflineIndicator'
import { ResponsiveContainer } from '@/components/layout/ResponsiveUtils'
import { usePersistentState } from '@/hooks/usePersistentState'
import { AdvancedVisualization } from '@/lib/analytics/advancedVisualization'

interface PatientSummary {
  id: string
  name: string
  lastSession: Date
  riskLevel: RiskLevel
  progress: number // 0-100
  nextAppointment?: Date
  alerts: string[]
}

interface SessionMetrics {
  totalSessions: number
  avgSessionLength: number
  completionRate: number
  patientSatisfaction: number
}

type DashboardView = 'overview' | 'patients' | 'analytics' | 'schedule'
type TimeRange = 'week' | 'month' | 'quarter' | 'year'
type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

type DashboardTab = {
  id: DashboardView
  label: string
  icon: 'chart' | 'users' | 'trending' | 'calendar'
}

const DASHBOARD_TABS: readonly DashboardTab[] = [
  { id: 'overview', label: 'Overview', icon: 'chart' },
  { id: 'patients', label: 'Patients', icon: 'users' },
  { id: 'analytics', label: 'Analytics', icon: 'trending' },
  { id: 'schedule', label: 'Schedule', icon: 'calendar' },
]

const TIME_RANGES: readonly TimeRange[] = ['week', 'month', 'quarter', 'year']
const DASHBOARD_TAB_ICONS: Record<
  DashboardTab['icon'],
  (props: ComponentProps<'svg'>) => ReactElement
> = {
  chart: (props) => <ChartBarIcon {...props} />,
  trending: (props) => <ArrowTrendingUpIcon {...props} />,
  users: (props) => <UserGroupIcon {...props} />,
  calendar: (props) => <CalendarIcon {...props} />,
}

const isTimeRange = (value: string): value is TimeRange =>
  (TIME_RANGES as readonly string[]).includes(value)

// Mock data - defined at module scope to maintain referential identity across renders
const MOCK_PATIENTS: PatientSummary[] = [
  {
    id: '1',
    name: 'Sarah Johnson',
    lastSession: new Date('2024-01-15'),
    riskLevel: 'medium',
    progress: 65,
    nextAppointment: new Date('2024-01-22'),
    alerts: ['Missed last homework', 'Anxiety spike detected'],
  },
  {
    id: '2',
    name: 'Michael Chen',
    lastSession: new Date('2024-01-14'),
    riskLevel: 'low',
    progress: 80,
    nextAppointment: new Date('2024-01-21'),
    alerts: [],
  },
  {
    id: '3',
    name: 'Emily Rodriguez',
    lastSession: new Date('2024-01-13'),
    riskLevel: 'high',
    progress: 45,
    nextAppointment: new Date('2024-01-20'),
    alerts: ['Requires immediate attention', 'Family session needed'],
  },
]

const MOCK_SESSION_METRICS: SessionMetrics = {
  totalSessions: 47,
  avgSessionLength: 52, // minutes
  completionRate: 94,
  patientSatisfaction: 4.2, // out of 5
}

/**
 * Comprehensive Therapist Dashboard for Mental Health Professionals
 */
export const TherapistDashboard: FC = () => {
  // Persistent dashboard preferences
  const [dashboardView, setDashboardView] = usePersistentState<DashboardView>(
    'therapist_dashboard_view',
    'overview',
  )
  const [timeRange, setTimeRange] = usePersistentState<TimeRange>(
    'therapist_dashboard_timerange',
    'month',
  )
  const [selectedPatients, setSelectedPatients] = usePersistentState<string[]>(
    'therapist_selected_patients',
    [],
  )

  // Use module-level mock data to maintain referential identity
  const patients = MOCK_PATIENTS
  const sessionMetrics = MOCK_SESSION_METRICS

  // ⚡ Bolt: Memoize the patient selection handler to prevent unnecessary re-renders of child tabs
  const handlePatientSelect = React.useCallback(
    (patientId: string) => {
      setSelectedPatients((prev) =>
        prev.includes(patientId)
          ? prev.filter((id) => id !== patientId)
          : [...prev, patientId],
      )
    },
    [setSelectedPatients],
  )

  const analyticsData = patients.map((patient, index) => ({
    patientId: patient.id,
    patientName: patient.name,
    sessionsCompleted: 5 + ((index * 7) % 20),
    avgMoodScore: 3 + (index % 3) * 0.5, // 3-5 scale
    progressScore: patient.progress,
    riskScore:
      patient.riskLevel === 'critical'
        ? 4
        : patient.riskLevel === 'high'
          ? 3
          : patient.riskLevel === 'medium'
            ? 2
            : 1,
    lastContact: patient.lastSession,
  }))

  return (
    <ResponsiveContainer size="full">
      <div className="min-h-screen bg-secondary">
        {/* Header */}
        <header className="border-b border-border bg-card">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Therapist Dashboard
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Welcome back, Dr. Smith • {patients.length} active patients
                </p>
              </div>

              <div className="flex items-center gap-4">
                <OfflineIndicator position="inline" />
                <select
                  aria-label="Select time range"
                  value={timeRange}
                  onChange={(event) => {
                    const nextRange = event.target.value
                    if (isTimeRange(nextRange)) {
                      setTimeRange(nextRange)
                    }
                  }}
                  className="rounded-none border border-input bg-card px-3 py-2 text-sm"
                >
                  {TIME_RANGES.map((range) => (
                    <option value={range} key={range}>
                      {range === 'week'
                        ? 'This Week'
                        : range === 'month'
                          ? 'This Month'
                          : range === 'quarter'
                            ? 'This Quarter'
                            : 'This Year'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="px-6">
            <nav className="flex space-x-8">
              {DASHBOARD_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setDashboardView(tab.id)}
                  className={`flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                    dashboardView === tab.id
                      ? 'border-ring text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {DASHBOARD_TAB_ICONS[tab.icon]({ className: 'h-5 w-5' })}
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
              patients={patients}
              metrics={sessionMetrics}
              onPatientSelect={handlePatientSelect}
              selectedPatients={selectedPatients}
              timeRange={timeRange}
            />
          )}

          {dashboardView === 'patients' && (
            <PatientsTab
              patients={patients}
              onPatientSelect={handlePatientSelect}
              selectedPatients={selectedPatients}
            />
          )}

          {dashboardView === 'analytics' && (
            <AnalyticsTab data={analyticsData} timeRange={timeRange} />
          )}

          {dashboardView === 'schedule' && <ScheduleTab patients={patients} />}
        </main>
      </div>
    </ResponsiveContainer>
  )
}

/**
 * Overview Tab Component
 */
type AnalyticsPoint = {
  patientId: string
  patientName: string
  sessionsCompleted: number
  avgMoodScore: number
  progressScore: number
  riskScore: number
  lastContact: Date
}

const OverviewTab: FC<{
  patients: PatientSummary[]
  metrics: SessionMetrics
  onPatientSelect: (patientId: string) => void
  selectedPatients: string[]
  timeRange: 'week' | 'month' | 'quarter' | 'year'
}> = ({ patients, metrics, onPatientSelect, selectedPatients, timeRange }) => {
  // ⚡ Bolt: Use O(1) Set lookup instead of O(N) Array.includes inside map loop
  const selectedPatientsSet = React.useMemo(
    () => new Set(selectedPatients),
    [selectedPatients],
  )

  const urgentPatients = patients.filter(
    (p) => p.riskLevel === 'high' || p.riskLevel === 'critical',
  )
  const patientsNeedingAttention = patients.filter((p) => p.alerts.length > 0)

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <FadeIn>
          <div className="rounded-none border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Sessions
                </p>
                <p className="text-3xl font-bold text-foreground">
                  {metrics.totalSessions}
                </p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-none border border-input bg-secondary">
                <ChartBarIcon className="h-5 w-5 text-foreground" />
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              This{' '}
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
                  Avg Session Length
                </p>
                <p className="text-3xl font-bold text-foreground">
                  {metrics.avgSessionLength}m
                </p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-none border border-input bg-secondary">
                <span className="text-foreground">⏱️</span>
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Average duration
            </p>
          </div>
        </FadeIn>

        <FadeIn>
          <div className="rounded-none border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Completion Rate
                </p>
                <p className="text-3xl font-bold text-foreground">
                  {metrics.completionRate}%
                </p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-none border border-input bg-secondary">
                <span className="text-foreground">✅</span>
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Session completion
            </p>
          </div>
        </FadeIn>

        <FadeIn>
          <div className="rounded-none border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Patient Satisfaction
                </p>
                <p className="text-3xl font-bold text-foreground">
                  {metrics.patientSatisfaction}/5
                </p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-none border border-input bg-secondary">
                <StarIcon className="h-5 w-5 text-foreground" />
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Average rating</p>
          </div>
        </FadeIn>
      </div>

      {/* Alerts and Urgent Items */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SlideUp>
          <div className="rounded-none border border-border bg-card p-6">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <span>🚨</span>
              Urgent Patients ({urgentPatients.length})
            </h3>
            <div className="space-y-3">
              {urgentPatients.map((patient) => (
                <div
                  key={patient.id}
                  className="flex items-center justify-between rounded-none border border-ring bg-card p-3"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ${patient.name}`}
                      checked={selectedPatientsSet.has(patient.id)}
                      onChange={() => onPatientSelect(patient.id)}
                      className="h-4 w-4 rounded-none text-foreground"
                    />
                    <div>
                      <p className="font-medium text-foreground">
                        {patient.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Last session: {patient.lastSession.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-none px-2 py-1 text-xs font-medium ${getRiskColor(patient.riskLevel)}`}
                  >
                    {patient.riskLevel}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </SlideUp>

        <SlideUp>
          <div className="rounded-none border border-border bg-card p-6">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <span>⚠️</span>
              Needs Attention ({patientsNeedingAttention.length})
            </h3>
            <div className="space-y-3">
              {patientsNeedingAttention.map((patient) => (
                <div
                  key={patient.id}
                  className="rounded-none border border-ring bg-secondary p-3"
                >
                  <div className="mb-2 flex items-center gap-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ${patient.name}`}
                      checked={selectedPatientsSet.has(patient.id)}
                      onChange={() => onPatientSelect(patient.id)}
                      className="h-4 w-4 rounded-none text-foreground"
                    />
                    <p className="font-medium text-foreground">
                      {patient.name}
                    </p>
                  </div>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {patient.alerts.map((alert, index) => (
                      <li key={index}>• {alert}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </SlideUp>
      </div>

      {/* Patient Progress Overview */}
      <SlideUp>
        <div className="rounded-none border border-border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold">
            Patient Progress Overview
          </h3>
          <div className="space-y-4">
            {patients.map((patient) => (
              <div
                key={patient.id}
                className="flex items-center gap-4 rounded-none bg-secondary p-4"
              >
                <input
                  type="checkbox"
                  aria-label={`Select ${patient.name}`}
                  checked={selectedPatientsSet.has(patient.id)}
                  onChange={() => onPatientSelect(patient.id)}
                  className="h-4 w-4 rounded-none text-foreground"
                />
                <div className="flex-1">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-medium text-foreground">
                      {patient.name}
                    </p>
                    <span
                      className={`rounded-none px-2 py-1 text-xs font-medium ${getRiskColor(patient.riskLevel)}`}
                    >
                      {patient.riskLevel}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{patient.progress}%</span>
                      </div>
                      <div className="h-2 w-full rounded-none bg-secondary">
                        <div
                          className={`h-2 rounded-none ${getProgressColor(patient.progress)}`}
                          style={{ width: `${patient.progress}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Last: {patient.lastSession.toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </SlideUp>
    </div>
  )
}

/**
 * Patients Tab Component
 */
const PatientsTab: FC<{
  patients: PatientSummary[]
  onPatientSelect: (patientId: string) => void
  selectedPatients: string[]
}> = ({ patients, onPatientSelect, selectedPatients }) => {
  // ⚡ Bolt: Use O(1) Set lookup instead of O(N) Array.includes inside map loop
  const selectedPatientsSet = React.useMemo(
    () => new Set(selectedPatients),
    [selectedPatients],
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Patient Management</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {selectedPatients.length} selected
          </span>
          <button
            className="rounded-none bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
            disabled={selectedPatients.length === 0}
            aria-disabled={selectedPatients.length === 0}
          >
            Bulk Actions
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-none border border-border bg-card">
        <div className="border-b border-border p-4">
          <div className="flex items-center gap-4">
            <input
              type="text"
              aria-label="Search patients"
              placeholder="Search patients..."
              className="flex-1 rounded-none border border-input bg-card px-3 py-2 text-sm"
            />
            <select
              aria-label="Filter by risk level"
              className="rounded-none border border-input bg-card px-3 py-2 text-sm"
            >
              <option>All Risk Levels</option>
              <option>Critical</option>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </div>
        </div>

        <div className="divide-y divide-border">
          {patients.map((patient) => (
            <div
              key={patient.id}
              className="p-4 transition-colors hover:bg-secondary"
            >
              <div className="flex items-center gap-4">
                <input
                  type="checkbox"
                  aria-label={`Select ${patient.name}`}
                  checked={selectedPatientsSet.has(patient.id)}
                  onChange={() => onPatientSelect(patient.id)}
                  className="h-4 w-4 rounded-none text-foreground"
                />
                <div className="flex-1">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-medium text-foreground">
                      {patient.name}
                    </h3>
                    <span
                      className={`rounded-none px-2 py-1 text-xs font-medium ${getRiskColor(patient.riskLevel)}`}
                    >
                      {patient.riskLevel}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground md:grid-cols-4">
                    <div>
                      Last session: {patient.lastSession.toLocaleDateString()}
                    </div>
                    <div>Progress: {patient.progress}%</div>
                    <div>
                      Next appointment:{' '}
                      {patient.nextAppointment?.toLocaleDateString() ??
                        'Not scheduled'}
                    </div>
                    <div>Alerts: {patient.alerts.length}</div>
                  </div>
                  {patient.alerts.length > 0 && (
                    <div className="mt-2">
                      <ul className="space-y-1 text-sm text-foreground">
                        {patient.alerts.map((alert, index) => (
                          <li key={index}>• {alert}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <button className="rounded-none bg-primary px-3 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary">
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
 * Analytics Tab Component
 */
const AnalyticsTab: FC<{
  data: AnalyticsPoint[]
  timeRange: string
}> = ({ data, timeRange }) => {
  const visualizationConfig = {
    type: 'scatter' as const,
    dimensions: {
      x: {
        field: 'sessionsCompleted',
        label: 'Sessions Completed',
        type: 'numeric' as const,
      },
      y: {
        field: 'avgMoodScore',
        label: 'Average Mood Score',
        type: 'numeric' as const,
      },
      color: {
        field: 'riskScore',
        label: 'Risk Level',
        type: 'numeric' as const,
      },
    },
    filters: {},
    interactive: true,
    realTime: false,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Therapeutic Analytics</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Time Range:</span>
          <span className="text-sm font-medium capitalize">{timeRange}</span>
        </div>
      </div>

      <AdvancedVisualization
        data={data}
        config={visualizationConfig}
        onInsightGenerated={(insight) => {
          console.info('New insight generated:', insight)
        }}
      />
    </div>
  )
}

/**
 * Schedule Tab Component
 */
const ScheduleTab: FC<{
  patients: PatientSummary[]
}> = ({ patients }) => {
  const today = new Date()
  const upcomingAppointments = patients
    .filter((p) => p.nextAppointment && p.nextAppointment >= today)
    .sort(
      (a, b) =>
        (a.nextAppointment?.getTime() ?? 0) -
        (b.nextAppointment?.getTime() ?? 0),
    )
    .slice(0, 10)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Schedule Management</h2>
        <button className="rounded-none bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary">
          Schedule Appointment
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-none border border-border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold">Upcoming Appointments</h3>
          <div className="space-y-3">
            {upcomingAppointments.map((patient) => (
              <div
                key={patient.id}
                className="flex items-center justify-between rounded-none bg-secondary p-3"
              >
                <div>
                  <p className="font-medium text-foreground">{patient.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {patient.nextAppointment?.toLocaleDateString()} at{' '}
                    {patient.nextAppointment?.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <span
                  className={`rounded-none px-2 py-1 text-xs font-medium ${getRiskColor(patient.riskLevel)}`}
                >
                  {patient.riskLevel}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-none border border-border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold">Session Templates</h3>
          <div className="space-y-3">
            {[
              'Initial Assessment',
              'CBT Session',
              'Crisis Intervention',
              'Progress Review',
              'Termination Session',
            ].map((template) => (
              <button
                key={template}
                className="w-full rounded-none border border-input bg-secondary p-3 text-left transition-colors hover:bg-accent"
              >
                <p className="font-medium text-foreground">{template}</p>
                <p className="text-sm text-muted-foreground">
                  Standard 50-minute session
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper function (defined outside component to avoid recreation)
function getRiskColor(risk: RiskLevel) {
  const colors: Record<RiskLevel, string> = {
    low: 'bg-secondary border border-input text-foreground',
    medium: 'bg-secondary border border-ring text-foreground font-medium',
    high: 'bg-card border border-ring text-foreground font-medium',
    critical: 'bg-primary text-primary-foreground font-semibold',
  }
  return colors[risk]
}

function getProgressColor(progress: number) {
  if (progress >= 80) return 'bg-primary'
  if (progress >= 60) return 'bg-primary'
  if (progress >= 40) return 'bg-foreground'
  if (progress >= 20) return 'bg-muted-foreground'
  return 'bg-border'
}
export default TherapistDashboard
