import type { FC, SubmitEventHandler } from 'react'
import { useMemo, useCallback, useState, memo } from 'react'

import { OfflineIndicator } from '@/components/layout/OfflineIndicator'
import { ResponsiveContainer } from '@/components/layout/ResponsiveUtils'
import { Card } from '@/components/ui/card/index'
import { usePersistentState } from '@/hooks/usePersistentState'
import { AdvancedVisualization } from '@/lib/analytics/advancedVisualization'

import ActiveStudiesList from './dashboard/ActiveStudiesList'
import InsightsPanel from './dashboard/InsightsPanel'
import MetricsGrid from './dashboard/MetricsGrid'
import UpcomingMilestones from './dashboard/UpcomingMilestones'

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

type PublicationStatus =
  | 'draft'
  | 'submitted'
  | 'in-review'
  | 'published'
  | 'rejected'

interface Publication {
  id: string
  title: string
  authors: string[]
  journal: string
  doi?: string
  status: PublicationStatus
  abstract: string
  keywords: string[]
  publicationDate: string
}

interface PublicationFormData {
  title: string
  authors: string
  journal: string
  doi: string
  status: PublicationStatus
  abstract: string
  keywords: string
  publicationDate: string
}

const initialPublications: Publication[] = [
  {
    id: 'pub-1',
    title:
      'AI-Assisted Cognitive Behavioral Therapy: A Randomized Controlled Trial',
    authors: ['Dr. Sarah Chen', 'Dr. Michael Rodriguez', 'Dr. Emily Park'],
    journal: 'Journal of Medical Internet Research',
    doi: '10.2196/jmir.2024.45678',
    status: 'published',
    abstract:
      'This study examines the efficacy of AI-assisted CBT interventions across 245 participants over 12 months, showing significant improvement in treatment outcomes compared to traditional therapy.',
    keywords: ['AI therapy', 'CBT', 'randomized trial', 'digital health'],
    publicationDate: '2024-01-15',
  },
  {
    id: 'pub-2',
    title: 'Federated Learning for Privacy-Preserving Mental Health Analytics',
    authors: ['Dr. James Liu', 'Dr. Anna Kowalski'],
    journal: 'IEEE Transactions on Biomedical Engineering',
    doi: '10.1109/tbme.2024.123456',
    status: 'in-review',
    abstract:
      'We propose a federated learning framework enabling privacy-preserving mental health data analysis across institutions without sharing raw patient data.',
    keywords: ['federated learning', 'privacy', 'mental health', 'distributed'],
    publicationDate: '2024-03-20',
  },
  {
    id: 'pub-3',
    title: 'Real-Time Sentiment Analysis in Therapy Sessions',
    authors: ['Dr. Patricia Gomez', 'Dr. Kevin Wu', 'Dr. Linda Martinez'],
    journal: 'Computers in Human Behavior',
    doi: undefined,
    status: 'submitted',
    abstract:
      'This paper explores real-time sentiment analysis techniques during therapy sessions to provide clinicians with immediate feedback on patient emotional states.',
    keywords: ['sentiment analysis', 'therapy', 'NLP', 'real-time'],
    publicationDate: '2024-05-10',
  },
  {
    id: 'pub-4',
    title: 'Therapeutic Alliance in AI-Mediated Therapy Sessions',
    authors: ['Dr. Robert Taylor'],
    journal: 'Cyberpsychology, Behavior, and Social Networking',
    doi: undefined,
    status: 'draft',
    abstract:
      'An examination of therapeutic alliance quality when AI systems mediate between therapist and patient, with implications for AI system design in mental health.',
    keywords: ['therapeutic alliance', 'AI therapy', 'session quality'],
    publicationDate: '2024-06-01',
  },
  {
    id: 'pub-5',
    title: 'Longitudinal Outcomes of Digital Mental Health Interventions',
    authors: [
      'Dr. Maria Santos',
      'Dr. David Kim',
      "Dr. Fiona O'Brien",
      'Dr. Hassan Ali',
    ],
    journal: 'The Lancet Digital Health',
    doi: '10.1016/s2589-7500(24)00078-9',
    status: 'published',
    abstract:
      'A 24-month longitudinal study tracking outcomes of digital mental health interventions across 1,200 participants, demonstrating sustained efficacy and engagement.',
    keywords: ['longitudinal', 'digital health', 'outcomes', 'follow-up'],
    publicationDate: '2024-02-28',
  },
]

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
  const [publications, setPublications] = usePersistentState<Publication[]>(
    'research_publications',
    initialPublications,
  )
  const [pubSearch, setPubSearch] = useState('')
  const [pubFilterStatus, setPubFilterStatus] = useState<
    PublicationStatus | 'all'
  >('all')
  const dashboardTabs = [
    { id: 'overview', label: 'Overview', icon: 'chart' },
    { id: 'studies', label: 'Studies', icon: '🔬' },
    { id: 'datasets', label: 'Datasets', icon: '💾' },
    { id: 'analytics', label: 'Analytics', icon: 'trending' },
    { id: 'publications', label: 'Publications', icon: '📚' },
  ] as const

  // Mock data - in real app would come from API
  const researchMetrics: ResearchMetrics = useMemo(
    () => ({
      totalStudies: 47,
      activeStudies: 12,
      totalParticipants: 8934,
      publications: publications.length,
      avgEffectSize: 0.67,
      dataQuality: 94,
    }),
    [publications],
  )

  const studies: ResearchStudy[] = useMemo(
    () => [
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
    ],
    [],
  )

  const datasets: DatasetInfo[] = useMemo(
    () => [
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
    ],
    [],
  )

  // ⚡ Bolt: Memoize analytics calculation to prevent expensive O(N) array transformations on every render
  const analyticsData = useMemo(
    () =>
      studies.map((study) => ({
        studyId: study.id,
        studyName: study.title,
        participants: study.participants,
        duration: study.endDate
          ? (study.endDate.getTime() - study.startDate.getTime()) /
            (1000 * 60 * 60 * 24)
          : 0,
        status: study.status,
        outcomesCount: study.outcomes.length,
        methodology: study.methodology,
      })),
    [studies],
  )

  /**
   * ⚡ Bolt: Throttled/stable handler for study selection.
   * Dropped setSelectedStudies from dependencies as it's a stable setter. (Review suggestion)
   */
  const handleStudySelect = useCallback(
    (studyId: string) => {
      setSelectedStudies((prev) =>
        prev.includes(studyId)
          ? prev.filter((id) => id !== studyId)
          : [...prev, studyId],
      )
    },
    [setSelectedStudies],
  )

  const handleAddPublication = useCallback(
    (pub: Publication) => {
      setPublications((prev) => [...prev, pub])
    },
    [setPublications],
  )

  const handleUpdatePublication = useCallback(
    (pub: Publication) => {
      setPublications((prev) => prev.map((p) => (p.id === pub.id ? pub : p)))
    },
    [setPublications],
  )

  const handleDeletePublication = useCallback(
    (id: string) => {
      setPublications((prev) => prev.filter((p) => p.id !== id))
    },
    [setPublications],
  )

  return (
    <ResponsiveContainer size="full">
      <div className="min-h-screen bg-secondary">
        {/* Header */}
        <header className="border-b border-border bg-card">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Research Portal
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Evidence-Based Mental Health Research •{' '}
                  {researchMetrics.totalStudies} studies •{' '}
                  {researchMetrics.totalParticipants.toLocaleString()}{' '}
                  participants
                </p>
              </div>

              <div className="flex items-center gap-4">
                <OfflineIndicator position="inline" />
                <select
                  value={timeRange}
                  onChange={(e) => {
                    const nextValue = e.target.value
                    if (
                      nextValue === 'month' ||
                      nextValue === 'quarter' ||
                      nextValue === 'year' ||
                      nextValue === 'all'
                    ) {
                      setTimeRange(nextValue)
                    }
                  }}
                  className="rounded-none border border-input bg-card px-3 py-2 text-sm"
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
              {dashboardTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setDashboardView(tab.id)}
                  className={`flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                    dashboardView === tab.id
                      ? 'border-ring text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
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
            <div className="space-y-6">
              <MetricsGrid metrics={researchMetrics} />
              <ActiveStudiesList
                studies={studies}
                selectedStudies={selectedStudies}
                onStudySelect={handleStudySelect}
              />
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <InsightsPanel />
                <UpcomingMilestones />
              </div>
            </div>
          )}

          {dashboardView === 'studies' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  Research Studies Management
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {selectedStudies.length} selected
                  </span>
                  <button className="rounded-none bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary">
                    New Study
                  </button>
                </div>
              </div>
              <div className="overflow-hidden rounded-none border border-border bg-card">
                <div className="divide-y divide-border">
                  {studies.map((study) => (
                    <div
                      key={study.id}
                      className="p-4 transition-colors hover:bg-secondary"
                    >
                      <div className="flex items-center gap-4">
                        <input
                          type="checkbox"
                          checked={selectedStudies.includes(study.id)}
                          onChange={() => handleStudySelect(study.id)}
                          className="h-4 w-4 rounded-none text-foreground"
                        />
                        <div className="flex-1">
                          <h3 className="font-medium text-foreground">
                            {study.title}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {study.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {dashboardView === 'datasets' && <DatasetsTab datasets={datasets} />}

          {dashboardView === 'analytics' && (
            <AnalyticsTab data={analyticsData} />
          )}

          {dashboardView === 'publications' && (
            <PublicationsTab
              publications={publications}
              onAdd={handleAddPublication}
              onUpdate={handleUpdatePublication}
              onDelete={handleDeletePublication}
              search={pubSearch}
              onSearchChange={setPubSearch}
              filterStatus={pubFilterStatus}
              onFilterChange={setPubFilterStatus}
            />
          )}
        </main>
      </div>
    </ResponsiveContainer>
  )
}

// Internal components preserved/simplified for clarity within 200 line constraint
const DatasetsTab: FC<{ datasets: DatasetInfo[] }> = memo(({ datasets }) => (
  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
    {datasets.map((dataset) => (
      <Card key={dataset['id']} className="p-6">
        <h3 className="text-lg font-semibold">{dataset['name']}</h3>
        <p className="text-sm text-muted-foreground">
          {dataset['description']}
        </p>
      </Card>
    ))}
  </div>
))

const AnalyticsTab: FC<{ data: any[] }> = memo(({ data }) => (
  <AdvancedVisualization
    data={data}
    config={{
      type: 'scatter' as const,
      dimensions: {
        x: {
          field: 'participants',
          label: 'Participants',
          type: 'numeric' as const,
        },
        y: {
          field: 'outcomesCount',
          label: 'Outcomes',
          type: 'numeric' as const,
        },
      },
      filters: {},
      interactive: true,
      realTime: false,
    }}
  />
))

interface PublicationsTabProps {
  publications: Publication[]
  onAdd: (pub: Publication) => void
  onUpdate: (pub: Publication) => void
  onDelete: (id: string) => void
  search: string
  onSearchChange: (value: string) => void
  filterStatus: PublicationStatus | 'all'
  onFilterChange: (value: PublicationStatus | 'all') => void
}

const statusBadgeColors: Record<PublicationStatus, string> = {
  'draft': 'bg-secondary text-foreground',
  'submitted': 'bg-secondary border border-input text-foreground',
  'in-review': 'bg-secondary border border-ring text-foreground font-medium',
  'published': 'bg-secondary border border-input text-foreground',
  'rejected': 'bg-card border border-ring text-foreground font-semibold',
}

const PublicationsTab: FC<PublicationsTabProps> = memo(
  ({
    publications,
    onAdd,
    onUpdate,
    onDelete,
    search,
    onSearchChange,
    filterStatus,
    onFilterChange,
  }) => {
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [formData, setFormData] = useState<PublicationFormData>({
      title: '',
      authors: '',
      journal: '',
      doi: '',
      status: 'draft',
      abstract: '',
      keywords: '',
      publicationDate: new Date().toISOString().split('T')[0],
    })

    const filteredPublications = useMemo(() => {
      return publications.filter((pub) => {
        const matchesSearch =
          !search ||
          pub.title.toLowerCase().includes(search.toLowerCase()) ||
          pub.authors.some((a) =>
            a.toLowerCase().includes(search.toLowerCase()),
          ) ||
          pub.journal.toLowerCase().includes(search.toLowerCase())
        const matchesFilter =
          filterStatus === 'all' || pub.status === filterStatus
        return matchesSearch && matchesFilter
      })
    }, [publications, search, filterStatus])

    const handleOpenAdd = () => {
      setEditingId(null)
      setFormData({
        title: '',
        authors: '',
        journal: '',
        doi: '',
        status: 'draft',
        abstract: '',
        keywords: '',
        publicationDate: new Date().toISOString().split('T')[0],
      })
      setShowForm(true)
    }

    const handleOpenEdit = (pub: Publication) => {
      setEditingId(pub.id)
      setFormData({
        title: pub.title,
        authors: pub.authors.join(', '),
        journal: pub.journal,
        doi: pub.doi ?? '',
        status: pub.status,
        abstract: pub.abstract,
        keywords: pub.keywords.join(', '),
        publicationDate: pub.publicationDate,
      })
      setShowForm(true)
    }

    const handleSubmit: SubmitEventHandler = (e) => {
      e.preventDefault()
      const pub: Publication = {
        id: editingId ?? crypto.randomUUID(),
        title: formData.title,
        authors: formData.authors
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        journal: formData.journal,
        doi: formData.doi || undefined,
        status: formData.status,
        abstract: formData.abstract,
        keywords: [
          ...new Set(
            formData.keywords
              .split(',')
              .map((k) => k.trim())
              .filter(Boolean),
          ),
        ],
        publicationDate: formData.publicationDate,
      }
      if (editingId) {
        onUpdate(pub)
      } else {
        onAdd(pub)
      }
      setShowForm(false)
      setEditingId(null)
    }

    const handleConfirmDelete = () => {
      if (deletingId) {
        onDelete(deletingId)
        setDeletingId(null)
      }
    }

    const deletingPublication = deletingId
      ? publications.find((p) => p.id === deletingId)
      : null

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-1 items-center gap-3">
            <input
              type="text"
              placeholder="Search publications..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="min-w-0 flex-1 rounded-none border border-input bg-card px-3 py-2 text-sm"
            />
            <select
              value={filterStatus}
              onChange={(e) => {
                const val = e.target.value
                if (
                  val === 'all' ||
                  val === 'draft' ||
                  val === 'submitted' ||
                  val === 'in-review' ||
                  val === 'published' ||
                  val === 'rejected'
                ) {
                  onFilterChange(val)
                }
              }}
              className="rounded-none border border-input bg-card px-3 py-2 text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="in-review">In Review</option>
              <option value="published">Published</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <button
            onClick={handleOpenAdd}
            className="whitespace-nowrap rounded-none bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary"
          >
            Add Publication
          </button>
        </div>

        {filteredPublications.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            No publications found. Click &ldquo;Add Publication&rdquo; to create
            one.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filteredPublications.map((pub) => (
              <Card key={pub.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className={`inline-flex rounded-none px-2.5 py-0.5 text-xs font-medium ${statusBadgeColors[pub.status]}`}
                      >
                        {pub.status}
                      </span>
                    </div>
                    <h3 className="truncate font-semibold text-foreground">
                      {pub.title}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {pub.authors.join(', ')}
                    </p>
                    <p className="mt-1 text-sm italic text-muted-foreground">
                      {pub.journal}
                    </p>
                    {pub.doi && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        DOI: {pub.doi}
                      </p>
                    )}
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                  {pub.abstract}
                </p>
                {pub.keywords.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {pub.keywords.map((kw) => (
                      <span
                        key={kw}
                        className="rounded-none bg-secondary px-2 py-0.5 text-xs"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-xs text-muted-foreground">
                    {pub.publicationDate}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEdit(pub)}
                      className="text-sm font-medium text-foreground hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeletingId(pub.id)}
                      className="text-sm font-medium text-foreground hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {showForm && (
          <div className="bg-black/50 fixed inset-0 z-50 flex items-center justify-center">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-none bg-card p-6">
              <h2 className="mb-4 text-xl font-bold text-foreground">
                {editingId ? 'Edit Publication' : 'Add Publication'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Title
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className="mt-1 w-full rounded-none border border-input bg-card px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Authors (comma-separated)
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.authors}
                    onChange={(e) =>
                      setFormData({ ...formData, authors: e.target.value })
                    }
                    placeholder="Dr. Jane Smith, Dr. John Doe"
                    className="mt-1 w-full rounded-none border border-input bg-card px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground">
                      Journal
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.journal}
                      onChange={(e) =>
                        setFormData({ ...formData, journal: e.target.value })
                      }
                      className="mt-1 w-full rounded-none border border-input bg-card px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground">
                      DOI
                    </label>
                    <input
                      type="text"
                      value={formData.doi}
                      onChange={(e) =>
                        setFormData({ ...formData, doi: e.target.value })
                      }
                      className="mt-1 w-full rounded-none border border-input bg-card px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          status: e.target.value as PublicationStatus,
                        })
                      }
                      className="mt-1 w-full rounded-none border border-input bg-card px-3 py-2 text-sm"
                    >
                      <option value="draft">Draft</option>
                      <option value="submitted">Submitted</option>
                      <option value="in-review">In Review</option>
                      <option value="published">Published</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground">
                      Publication Date
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.publicationDate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          publicationDate: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-none border border-input bg-card px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Abstract
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={formData.abstract}
                    onChange={(e) =>
                      setFormData({ ...formData, abstract: e.target.value })
                    }
                    className="mt-1 w-full rounded-none border border-input bg-card px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Keywords (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.keywords}
                    onChange={(e) =>
                      setFormData({ ...formData, keywords: e.target.value })
                    }
                    placeholder="AI therapy, CBT, digital health"
                    className="mt-1 w-full rounded-none border border-input bg-card px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false)
                      setEditingId(null)
                    }}
                    className="rounded-none border border-input px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-none bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary"
                  >
                    {editingId ? 'Update' : 'Add'} Publication
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {deletingPublication && (
          <div className="bg-black/50 fixed inset-0 z-50 flex items-center justify-center">
            <div className="w-full max-w-md rounded-none bg-card p-6">
              <h2 className="text-lg font-bold text-foreground">
                Delete Publication
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Are you sure you want to delete &ldquo;
                {deletingPublication.title}&rdquo;? This action cannot be
                undone.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeletingId(null)}
                  className="rounded-none border border-input px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="rounded-none bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-accent"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  },
)

export default ResearchDashboard
