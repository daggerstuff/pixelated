import type { FC } from 'react'
import React, { useMemo } from 'react'
import { FadeIn, SlideUp } from '@/components/layout/AdvancedAnimations'
import { OfflineIndicator } from '@/components/layout/OfflineIndicator'
import { ResponsiveContainer } from '@/components/layout/ResponsiveUtils'
import { usePersistentState } from '@/hooks/usePersistentState'
import { AdvancedVisualization } from '@/lib/analytics/advancedVisualization'

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
  const [dashboardView, setDashboardView] = usePersistentState<
    'overview' | 'studies' | 'datasets' | 'analytics' | 'publications'
  >('research_dashboard_view', 'overview')
  const [timeRange, setTimeRange] = usePersistentState<
    'month' | 'quarter' | 'year' | 'all'
  >('research_dashboard_timerange', 'year')
  const [selectedStudies, setSelectedStudies] = usePersistentState<string[]>(
    'research_selected_studies',
    [],
  )

  const dashboardTabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'studies', label: 'Studies', icon: '🔬' },
    { id: 'datasets', label: 'Datasets', icon: '💾' },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
    { id: 'publications', label: 'Publications', icon: '📚' },
  ] as const

  // Mock data - in real app would come from API
  const researchMetrics: ResearchMetrics = {
    totalStudies: 47,
    activeStudies: 12,
    totalParticipants: 8934,
    publications: 23,
    avgEffectSize: 0.67,
    dataQuality: 94,
  }

  const studies = useMemo(() => [
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
  ], [])

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

  // ⚡ Bolt: Memoize analytics calculation to prevent expensive O(N) array transformations on every render
  const analyticsData = useMemo(() => studies.map((study, _index) => ({
    studyId: study.id,
    studyName: study.title,
    participants: study.participants,
    duration: study.endDate ? (study.endDate.getTime() - study.startDate.getTime()) / (1000 * 60 * 60 * 24) : 0,
    status: study.status,
    outcomesCount: study.outcomes.length,
    methodology: study.methodology,
  })), [studies])

  return (
    // ... rest of the code remains the same ...
  )
}