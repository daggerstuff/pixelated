import type { FC } from 'react'
import React from 'react'
import { usePersistentState } from '@/hooks/usePersistentState'

import { OfflineIndicator } from '@/components/layout/OfflineIndicator'
import { FadeIn, SlideUp } from '@/components/layout/AdvancedAnimations'
import { ResponsiveContainer } from '@/components/layout/ResponsiveUtils'

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
}

interface SystemHealth {
  apiResponseTime: number
  databasePerformance: number
  memoryUsage: number
  errorRate: number
  uptime: number
}

/**
 * Comprehensive Healthcare Administrator Dashboard
 */
export const AdminDashboard: FC = () => {
  // Persistent dashboard preferences
  const [dashboardView, setDashboardView] = usePersistentState<
    'overview' | 'therapists' | 'institutions' | 'system' | 'compliance'
  >('admin_dashboard_view', 'overview')
  const [timeRange, setTimeRange] = usePersistentState<
    'week' | 'month' | 'quarter' | 'year'
  >('admin_dashboard_timerange', 'month')
  const [selectedTherapists, setSelectedTherapists] = usePersistentState<
    string[]
  >('admin_selected_therapists', [])

  // Mock data - in real app would come from API
  const institutionMetrics: InstitutionMetrics = {
    totalPatients: 1247,
    activePatients: 892,
    totalTherapists: 23,
    avgSessionsPerPatient: 8.4,
    overallProgress: 73,
    complianceScore: 94,
  }

  const therapists: TherapistPerformance[] = [
    {
      id: '1',
      name: 'Dr. Sarah Johnson',
      patientsCount: 45,
      avgSessionRating: 4.6,
      completionRate: 96,
      riskLevelDistribution: { low: 60, medium: 30, high: 8, critical: 2 },
    },
    {
      id: '2',
      name: 'Dr. Michael Chen',
      patientsCount: 38,
      avgSessionRating: 4.4,
      completionRate: 94,
      riskLevelDistribution: { low: 55, medium: 35, high: 8, critical: 2 },
    },
    {
      id: '3',
      name: 'Dr. Emily Rodriguez',
      patientsCount: 52,
      avgSessionRating: 4.7,
      completionRate: 98,
      riskLevelDistribution: { low: 65, medium: 25, high: 8, critical: 2 },
    },
  ]

  const systemHealth: SystemHealth = {
    apiResponseTime: 45,
    databasePerformance: 92,
    memoryUsage: 67,
    errorRate: 0.02,
    uptime: 99.9,
  }

  return (
    <ResponsiveContainer size="full">
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Healthcare Administration
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Institutional Overview • {institutionMetrics.totalTherapists}{' '}
                  therapists • {institutionMetrics.totalPatients} patients
                </p>
              </div>

              <div className="flex items-center gap-4">
                <OfflineIndicator position="inline" />
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
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
            <nav className="flex space-x-8">
              {[
                { id: 'overview', label: 'Overview', icon: '📊' },
                { id: 'therapists', label: 'Therapists', icon: '👨‍⚕️' },
                { id: 'institutions', label: 'Institutions', icon: '🏥' },
                { id: 'system', label: 'System Health', icon: '🔧' },
                { id: 'compliance', label: 'Compliance', icon: '📋' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setDashboardView(tab.id as any)}
                  className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                    dashboardView === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <span>{tab.icon}</span>
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
              onTherapistSelect={(therapistId) => {
                if (selectedTherapists.includes(therapistId)) {
                  setSelectedTherapists((prev) =>
                    prev.filter((id) => id !== therapistId),
                  )
                } else {
                  setSelectedTherapists((prev) => [...prev, therapistId])
                }
              }}
              selectedTherapists={selectedTherapists}
            />
          )}

          {dashboardView === 'therapists' && (
            <TherapistsTab
              therapists={therapists}
              onTherapistSelect={(therapistId) => {
                if (selectedTherapists.includes(therapistId)) {
                  setSelectedTherapists((prev) =>
                    prev.filter((id) => id !== therapistId),
                  )
                } else {
                  setSelectedTherapists((prev) => [...prev, therapistId])
                }
              }}
              selectedTherapists={selectedTherapists}
            />
          )}

          {dashboardView === 'institutions' && (
            <InstitutionsTab metrics={institutionMetrics} />
          )}

          {dashboardView === 'system' && <SystemTab health={systemHealth} />}

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
}> = ({ metrics, therapists, onTherapistSelect, selectedTherapists }) => {
  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <FadeIn>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Patients
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {metrics.totalPatients.toLocaleString()}
                </p>
              </div>
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 dark:text-blue-400">👥</span>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {metrics.activePatients} active patients
            </p>
          </div>
        </FadeIn>

        <FadeIn>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Therapists
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {metrics.totalTherapists}
                </p>
              </div>
              <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <span className="text-green-600 dark:text-green-400">👨‍⚕️</span>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-2">Licensed professionals</p>
          </div>
        </FadeIn>

        <FadeIn>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Avg Sessions
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {metrics.avgSessionsPerPatient}
                </p>
              </div>
              <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <span className="text-purple-600 dark:text-purple-400">📈</span>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-2">
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
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Compliance Score
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {metrics.complianceScore}%
                </p>
              </div>
              <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
                <span className="text-yellow-600 dark:text-yellow-400">📋</span>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              HIPAA & security compliance
            </p>
          </div>
        </FadeIn>
      </div>

      {/* Therapist Performance Overview */}
      <SlideUp>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold mb-4">
            Therapist Performance Overview
          </h3>
          <div className="space-y-4">
            {therapists.map((therapist) => (
              <div
                key={therapist.id}
                className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
              >
                <input
                  type="checkbox"
                  checked={selectedTherapists.includes(therapist.id)}
                  onChange={() => onTherapistSelect(therapist.id)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {therapist.name}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        ⭐ {therapist.avgSessionRating}/5.0
                      </span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          therapist.completionRate >= 95
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                            : therapist.completionRate >= 90
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200'
                        }`}
                      >
                        {therapist.completionRate}% completion
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">
                        Patients:
                      </span>
                      <span className="ml-2 font-medium">
                        {therapist.patientsCount}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">
                        High Risk:
                      </span>
                      <span className="ml-2 font-medium text-red-600">
                        {therapist.riskLevelDistribution.high +
                          therapist.riskLevelDistribution.critical}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">
                        Success Rate:
                      </span>
                      <span className="ml-2 font-medium">
                        {Math.floor(Math.random() * 20) + 75}%
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">
                        Last Active:
                      </span>
                      <span className="ml-2 font-medium">
                        {Math.floor(Math.random() * 3) + 1}h ago
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SlideUp>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span>⚡</span>
              Quick Actions
            </h3>
            <div className="space-y-3">
              <button className="w-full text-left p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  Generate Reports
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-200">
                  Create institutional reports
                </p>
              </button>
              <button className="w-full text-left p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors">
                <p className="font-medium text-green-900 dark:text-green-100">
                  Resource Allocation
                </p>
                <p className="text-sm text-green-700 dark:text-green-200">
                  Manage therapist assignments
                </p>
              </button>
              <button className="w-full text-left p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors">
                <p className="font-medium text-purple-900 dark:text-purple-100">
                  System Settings
                </p>
                <p className="text-sm text-purple-700 dark:text-purple-200">
                  Configure platform settings
                </p>
              </button>
            </div>
          </div>
        </SlideUp>

        <SlideUp>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span>📊</span>
              Performance Metrics
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Patient Satisfaction
                </span>
                <span className="font-medium">4.3/5.0</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Treatment Success Rate
                </span>
                <span className="font-medium">78%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Average Treatment Duration
                </span>
                <span className="font-medium">12 weeks</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Readmission Rate
                </span>
                <span className="font-medium">8%</span>
              </div>
            </div>
          </div>
        </SlideUp>

        <SlideUp>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span>🚨</span>
              Alerts & Notifications
            </h3>
            <div className="space-y-3">
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <p className="font-medium text-red-900 dark:text-red-100">
                  High Risk Patients
                </p>
                <p className="text-sm text-red-700 dark:text-red-200">
                  3 patients require immediate attention
                </p>
              </div>
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <p className="font-medium text-yellow-900 dark:text-yellow-100">
                  Compliance Review
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-200">
                  Quarterly audit due in 2 weeks
                </p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  System Update
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-200">
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
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {selectedTherapists.length} selected
          </span>
          <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors">
            Manage Assignments
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <input
              type="text"
              placeholder="Search therapists..."
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
            />
            <select className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm">
              <option>All Performance Levels</option>
              <option>High Performers</option>
              <option>Needs Support</option>
              <option>New Therapists</option>
            </select>
          </div>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {therapists.map((therapist) => (
            <div
              key={therapist.id}
              className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <input
                  type="checkbox"
                  checked={selectedTherapists.includes(therapist.id)}
                  onChange={() => onTherapistSelect(therapist.id)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {therapist.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        ⭐ {therapist.avgSessionRating}/5.0
                      </span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          therapist.completionRate >= 95
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                            : therapist.completionRate >= 90
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200'
                        }`}
                      >
                        {therapist.completionRate}% completion
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">
                        Patients:
                      </span>
                      <span className="ml-2 font-medium">
                        {therapist.patientsCount}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">
                        High Risk:
                      </span>
                      <span className="ml-2 font-medium text-red-600">
                        {therapist.riskLevelDistribution.high +
                          therapist.riskLevelDistribution.critical}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">
                        Success Rate:
                      </span>
                      <span className="ml-2 font-medium">
                        {Math.floor(Math.random() * 20) + 75}%
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">
                        Last Active:
                      </span>
                      <span className="ml-2 font-medium">
                        {Math.floor(Math.random() * 3) + 1}h ago
                      </span>
                    </div>
                  </div>
                </div>
                <button className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors">
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
}> = ({ metrics }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Institutional Management</h2>
        <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors">
          Add Institution
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold mb-4">Resource Allocation</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Therapist Utilization
              </span>
              <span className="font-medium">87%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full"
                style={{ width: '87%' }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Patient Capacity
              </span>
              <span className="font-medium">73%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full"
                style={{ width: '73%' }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                AI System Usage
              </span>
              <span className="font-medium">92%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-purple-500 h-2 rounded-full"
                style={{ width: '92%' }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold mb-4">Department Overview</h3>
          <div className="space-y-3">
            {[
              { name: 'Adult Therapy', patients: 456, therapists: 12 },
              { name: 'Child & Adolescent', patients: 234, therapists: 8 },
              { name: 'Crisis Intervention', patients: 89, therapists: 5 },
              { name: 'Group Therapy', patients: 156, therapists: 4 },
            ].map((dept) => (
              <div
                key={dept.name}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {dept.name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {dept.therapists} therapists • {dept.patients} patients
                  </p>
                </div>
                <button className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
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
}> = ({ health }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">System Health & Performance</h2>
        <button className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors">
          Run Diagnostics
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold mb-4">Performance Metrics</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                API Response Time
              </span>
              <span
                className={`font-medium ${health.apiResponseTime < 50 ? 'text-green-600' : health.apiResponseTime < 100 ? 'text-yellow-600' : 'text-red-600'}`}
              >
                {health.apiResponseTime}ms
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Database Performance
              </span>
              <span
                className={`font-medium ${health.databasePerformance > 90 ? 'text-green-600' : health.databasePerformance > 80 ? 'text-yellow-600' : 'text-red-600'}`}
              >
                {health.databasePerformance}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Memory Usage
              </span>
              <span
                className={`font-medium ${health.memoryUsage < 70 ? 'text-green-600' : health.memoryUsage < 85 ? 'text-yellow-600' : 'text-red-600'}`}
              >
                {health.memoryUsage}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Error Rate
              </span>
              <span
                className={`font-medium ${health.errorRate < 0.01 ? 'text-green-600' : health.errorRate < 0.05 ? 'text-yellow-600' : 'text-red-600'}`}
              >
                {(health.errorRate * 100).toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold mb-4">System Status</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <span className="font-medium text-green-900 dark:text-green-100">
                Platform Uptime
              </span>
              <span className="font-bold text-green-600">{health.uptime}%</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <span className="font-medium text-blue-900 dark:text-blue-100">
                Active Sessions
              </span>
              <span className="font-bold text-blue-600">
                {Math.floor(Math.random() * 50) + 20}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <span className="font-medium text-purple-900 dark:text-purple-100">
                Data Processing
              </span>
              <span className="font-bold text-purple-600">Normal</span>
            </div>
          </div>
        </div>
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
        <button className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors">
          Generate Report
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold mb-4">Compliance Status</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                HIPAA Compliance
              </span>
              <span
                className={`font-medium ${metrics.complianceScore >= 95 ? 'text-green-600' : 'text-yellow-600'}`}
              >
                {metrics.complianceScore}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Data Encryption
              </span>
              <span className="font-medium text-green-600">100%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Access Controls
              </span>
              <span className="font-medium text-green-600">Compliant</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Audit Logging
              </span>
              <span className="font-medium text-green-600">Active</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Audits</h3>
          <div className="space-y-3">
            {[
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
            ].map((audit, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {audit.type}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {audit.date}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      audit.status === 'passed'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                    }`}
                  >
                    {audit.status}
                  </span>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
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
