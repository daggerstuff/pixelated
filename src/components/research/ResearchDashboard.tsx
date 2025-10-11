import type { FC } from 'react'
import React from 'react'
import { usePersistentState } from '@/hooks/usePersistentState'
import { AdvancedVisualization } from '@/lib/analytics/advancedVisualization'
import { OfflineIndicator } from '@/components/layout/OfflineIndicator'
import { AnimationWrapper, FadeIn, SlideUp } from '@/components/layout/AdvancedAnimations'
import { ResponsiveContainer, ResponsiveText } from '@/components/layout/ResponsiveUtils'

interface ResearchStudy {
  id: string
  title: string
  description: string
  status: 'planning' | 'active' | 'completed' | 'published'
  participants: number
  startDate: Date
  endDate?: Date
  methodology: string
  outcomes: string[]
}

interface ResearchMetrics {
  totalStudies: number
  activeStudies: number
  totalParticipants: number
  publications: number
  avgEffectSize: number
  dataQuality: number
}

interface DatasetInfo {
  id: string
  name: string
  description: string
  size: number
  format: string
  accessLevel: 'public' | 'restricted' | 'private'
  lastUpdated: Date
}

/**
 * Comprehensive Research Dashboard for Mental Health Researchers
 */
export const ResearchDashboard: FC = () => {
  // Persistent dashboard preferences
  const [dashboardView, setDashboardView] = usePersistentState<'overview' | 'studies' | 'datasets' | 'analytics' | 'publications'>('research_dashboard_view', 'overview')
  const [timeRange, setTimeRange] = usePersistentState<'month' | 'quarter' | 'year' | 'all'>('research_dashboard_timerange', 'year')
  const [selectedStudies, setSelectedStudies] = usePersistentState<string[]>('research_selected_studies', [])

  // Mock data - in real app would come from API
  const researchMetrics: ResearchMetrics = {
    totalStudies: 47,
    activeStudies: 12,
    totalParticipants: 8934,
    publications: 23,
    avgEffectSize: 0.67,
    dataQuality: 94,
  }

  const studies: ResearchStudy[] = [
    {
      id: '1',
      title: 'AI-Assisted Therapy Outcomes',
      description: 'Longitudinal study on AI intervention effectiveness',
      status: 'active',
      participants: 245,
      startDate: new Date('2023-06-01'),
      methodology: 'Randomized Controlled Trial',
      outcomes: ['Improved patient outcomes', 'Reduced therapist burden'],
    },
    {
      id: '2',
      title: 'Privacy-Preserving Analytics',
      description: 'Federated learning approaches in mental health',
      status: 'completed',
      participants: 189,
      startDate: new Date('2023-01-15'),
      endDate: new Date('2023-12-15'),
      methodology: 'Multi-center Study',
      outcomes: ['Validated privacy techniques', 'Maintained data utility'],
    },
    {
      id: '3',
      title: 'Real-Time Intervention Efficacy',
      description: 'Live therapy session analysis and intervention timing',
      status: 'planning',
      participants: 0,
      startDate: new Date('2024-03-01'),
      methodology: 'Prospective Cohort Study',
      outcomes: [],
    },
  ]

  const datasets: DatasetInfo[] = [
    {
      id: '1',
      name: 'Depression Treatment Outcomes',
      description: 'Anonymized treatment outcome data from 50+ institutions',
      size: 2500000,
      format: 'JSON/CSV',
      accessLevel: 'restricted',
      lastUpdated: new Date('2024-01-10'),
    },
    {
      id: '2',
      name: 'Anxiety Intervention Study',
      description: 'Clinical trial data on anxiety treatment effectiveness',
      size: 890000,
      format: 'CSV',
      accessLevel: 'private',
      lastUpdated: new Date('2024-01-08'),
    },
    {
      id: '3',
      name: 'Therapeutic Alliance Metrics',
      description: 'Therapist-patient relationship quality indicators',
      size: 450000,
      format: 'JSON',
      accessLevel: 'public',
      lastUpdated: new Date('2024-01-12'),
    },
  ]

  const analyticsData = studies.map((study, index) => ({
    studyId: study.id,
    studyName: study.title,
    participants: study.participants,
    duration: study.endDate ? (study.endDate.getTime() - study.startDate.getTime()) / (1000 * 60 * 60 * 24) : 0,
    status: study.status,
    outcomesCount: study.outcomes.length,
    methodology: study.methodology,
  }))

  return (
    <ResponsiveContainer size="full">
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Research Portal
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Evidence-Based Mental Health Research • {researchMetrics.totalStudies} studies • {researchMetrics.totalParticipants.toLocaleString()} participants
                </p>
              </div>

              <div className="flex items-center gap-4">
                <OfflineIndicator position="inline" />
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                >
                  <option value="month">This Month</option>
                  <option value="quarter">This Quarter</option>
                  <option value="year">This Year</option>
                  <option value="all">All Time</option>
                </select>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="px-6">
            <nav className="flex space-x-8">
              {[
                { id: 'overview', label: 'Overview', icon: '📊' },
                { id: 'studies', label: 'Studies', icon: '🔬' },
                { id: 'datasets', label: 'Datasets', icon: '💾' },
                { id: 'analytics', label: 'Analytics', icon: '📈' },
                { id: 'publications', label: 'Publications', icon: '📚' },
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
              metrics={researchMetrics}
              studies={studies}
              onStudySelect={(studyId) => {
                if (selectedStudies.includes(studyId)) {
                  setSelectedStudies(prev => prev.filter(id => id !== studyId))
                } else {
                  setSelectedStudies(prev => [...prev, studyId])
                }
              }}
              selectedStudies={selectedStudies}
            />
          )}

          {dashboardView === 'studies' && (
            <StudiesTab
              studies={studies}
              onStudySelect={(studyId) => {
                if (selectedStudies.includes(studyId)) {
                  setSelectedStudies(prev => prev.filter(id => id !== studyId))
                } else {
                  setSelectedStudies(prev => [...prev, studyId])
                }
              }}
              selectedStudies={selectedStudies}
            />
          )}

          {dashboardView === 'datasets' && (
            <DatasetsTab datasets={datasets} />
          )}

          {dashboardView === 'analytics' && (
            <AnalyticsTab data={analyticsData} />
          )}

          {dashboardView === 'publications' && (
            <PublicationsTab />
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
  metrics: ResearchMetrics
  studies: ResearchStudy[]
  onStudySelect: (studyId: string) => void
  selectedStudies: string[]
}> = ({ metrics, studies, onStudySelect, selectedStudies }) => {
  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <FadeIn>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Studies</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{metrics.totalStudies}</p>
              </div>
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 dark:text-blue-400">🔬</span>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-2">{metrics.activeStudies} currently active</p>
          </div>
        </FadeIn>

        <FadeIn>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Participants</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{metrics.totalParticipants.toLocaleString()}</p>
              </div>
              <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <span className="text-green-600 dark:text-green-400">👥</span>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-2">Across all studies</p>
          </div>
        </FadeIn>

        <FadeIn>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Publications</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{metrics.publications}</p>
              </div>
              <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <span className="text-purple-600 dark:text-purple-400">📚</span>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-2">Peer-reviewed articles</p>
          </div>
        </FadeIn>

        <FadeIn>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Effect Size</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{metrics.avgEffectSize}</p>
              </div>
              <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
                <span className="text-yellow-600 dark:text-yellow-400">📈</span>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-2">Treatment effectiveness</p>
          </div>
        </FadeIn>
      </div>

      {/* Active Studies Overview */}
      <SlideUp>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold mb-4">Active Research Studies</h3>
          <div className="space-y-4">
            {studies.filter(study => study.status === 'active').map((study) => (
              <div key={study.id} className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <input
                  type="checkbox"
                  checked={selectedStudies.includes(study.id)}
                  onChange={() => onStudySelect(study.id)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-gray-900 dark:text-white">{study.title}</p>
                    <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200 rounded-full text-xs font-medium">
                      {study.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{study.description}</p>
                  <div className="flex items-center gap-4 text-sm">
                    <span>Participants: {study.participants}</span>
                    <span>Methodology: {study.methodology}</span>
                    <span>Started: {study.startDate.toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </SlideUp>

      {/* Research Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SlideUp>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span>💡</span>
              Research Insights
            </h3>
            <div className="space-y-3">
              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <p className="font-medium text-purple-900 dark:text-purple-100">AI Intervention Effectiveness</p>
                <p className="text-sm text-purple-700 dark:text-purple-200">+23% improvement in patient outcomes with AI assistance</p>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <p className="font-medium text-green-900 dark:text-green-100">Privacy Preservation Impact</p>
                <p className="text-sm text-green-700 dark:text-green-200">Federated learning maintains 94% data utility</p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="font-medium text-blue-900 dark:text-blue-100">Real-Time Processing</p>
                <p className="text-sm text-blue-700 dark:text-blue-200">Live interventions improve session effectiveness by 18%</p>
              </div>
            </div>
          </div>
        </SlideUp>

        <SlideUp>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span>📋</span>
              Upcoming Milestones
            </h3>
            <div className="space-y-3">
              {[
                { title: 'AI Ethics Review', date: '2024-01-25', priority: 'high' },
                { title: 'Data Privacy Audit', date: '2024-02-01', priority: 'medium' },
                { title: 'Publication Deadline', date: '2024-02-15', priority: 'high' },
                { title: 'Conference Presentation', date: '2024-03-01', priority: 'medium' },
              ].map((milestone, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{milestone.title}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{milestone.date}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    milestone.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' :
                    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200'
                  }`}>
                    {milestone.priority}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </SlideUp>
      </div>
    </div>
  )
}

/**
 * Studies Tab Component
 */
const StudiesTab: FC<{
  studies: ResearchStudy[]
  onStudySelect: (studyId: string) => void
  selectedStudies: string[]
}> = ({ studies, onStudySelect, selectedStudies }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Research Studies Management</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {selectedStudies.length} selected
          </span>
          <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors">
            New Study
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <input
              type="text"
              placeholder="Search studies..."
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
            />
            <select className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm">
              <option>All Statuses</option>
              <option>Planning</option>
              <option>Active</option>
              <option>Completed</option>
              <option>Published</option>
            </select>
          </div>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {studies.map((study) => (
            <div key={study.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <div className="flex items-center gap-4">
                <input
                  type="checkbox"
                  checked={selectedStudies.includes(study.id)}
                  onChange={() => onStudySelect(study.id)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900 dark:text-white">{study.title}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      study.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' :
                      study.status === 'completed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200' :
                      study.status === 'planning' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' :
                      'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200'
                    }`}>
                      {study.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{study.description}</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Participants:</span>
                      <span className="ml-2 font-medium">{study.participants}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Methodology:</span>
                      <span className="ml-2 font-medium">{study.methodology}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Start Date:</span>
                      <span className="ml-2 font-medium">{study.startDate.toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Outcomes:</span>
                      <span className="ml-2 font-medium">{study.outcomes.length}</span>
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
 * Datasets Tab Component
 */
const DatasetsTab: FC<{
  datasets: DatasetInfo[]
}> = ({ datasets }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Research Datasets</h2>
        <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors">
          Upload Dataset
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {datasets.map((dataset) => (
          <div key={dataset.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{dataset.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{dataset.description}</p>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Size: {(dataset.size / 1000000).toFixed(1)}MB</span>
                  <span className="text-gray-600 dark:text-gray-400">Format: {dataset.format}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    dataset.accessLevel === 'public' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' :
                    dataset.accessLevel === 'restricted' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' :
                    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                  }`}>
                    {dataset.accessLevel}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Updated: {dataset.lastUpdated.toLocaleDateString()}
              </span>
              <div className="flex gap-2">
                <button className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors">
                  Access Data
                </button>
                <button className="px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors">
                  View Metadata
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Analytics Tab Component
 */
const AnalyticsTab: FC<{
  data: any[]
}> = ({ data }) => {
  const visualizationConfig = {
    type: 'scatter' as const,
    dimensions: {
      x: { field: 'participants', label: 'Participants', type: 'numeric' as const },
      y: { field: 'outcomesCount', label: 'Outcomes Measured', type: 'numeric' as const },
      color: { field: 'status', label: 'Status', type: 'categorical' as const },
    },
    filters: {},
    interactive: true,
    realTime: false,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Research Analytics</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Data Points:</span>
          <span className="text-sm font-medium">{data.length}</span>
        </div>
      </div>

      <AdvancedVisualization
        data={data}
        config={visualizationConfig}
        onInsightGenerated={(insight) => {
          console.log('Research insight generated:', insight)
        }}
      />
    </div>
  )
}

/**
 * Publications Tab Component
 */
const PublicationsTab: FC = () => {
  const publications = [
    {
      id: '1',
      title: 'Effectiveness of AI-Assisted Therapy in Depression Treatment',
      journal: 'Journal of Mental Health Technology',
      authors: ['Dr. Sarah Johnson', 'Dr. Michael Chen', 'Dr. Emily Rodriguez'],
      publicationDate: '2024-01-10',
      doi: '10.1234/jmht.2024.001',
      citations: 23,
      status: 'published',
    },
    {
      id: '2',
      title: 'Privacy-Preserving Machine Learning in Mental Healthcare',
      journal: 'Privacy and Security in Healthcare',
      authors: ['Dr. Michael Chen', 'Dr. Sarah Johnson'],
      publicationDate: '2023-12-15',
      doi: '10.1234/psh.2023.045',
      citations: 18,
      status: 'published',
    },
    {
      id: '3',
      title: 'Real-Time Intervention Systems: A New Paradigm in Therapy',
      journal: 'Under Review - American Psychologist',
      authors: ['Dr. Emily Rodriguez', 'Dr. Sarah Johnson'],
      publicationDate: 'Pending',
      doi: 'Preprint Available',
      citations: 0,
      status: 'under_review',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Publications & Research Output</h2>
        <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors">
          Submit Publication
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <input
              type="text"
              placeholder="Search publications..."
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
            />
            <select className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm">
              <option>All Statuses</option>
              <option>Published</option>
              <option>Under Review</option>
              <option>In Preparation</option>
            </select>
          </div>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {publications.map((publication) => (
            <div key={publication.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900 dark:text-white">{publication.title}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      publication.status === 'published' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' :
                      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200'
                    }`}>
                      {publication.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{publication.journal}</p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Authors: {publication.authors.join(', ')}</span>
                    <span className="text-gray-600 dark:text-gray-400">Citations: {publication.citations}</span>
                    <span className="text-gray-600 dark:text-gray-400">DOI: {publication.doi}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors">
                    View
                  </button>
                  <button className="px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors">
                    Download
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ResearchDashboard